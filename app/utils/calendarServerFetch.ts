import { SupabaseClient } from '@supabase/supabase-js';
import { encrypt, safeDecrypt } from './crypto';
import { parseICalText } from './icalParser';
import { assertSafeExternalUrl } from './ssrfGuard';
import { ParsedExternalEvent } from '../types';

/**
 * Serverseitiger Event-Fetch für EINEN externen Kalender (Google/Outlook/CalDAV/iCal).
 * Läuft mit Service-Role und nutzt die gespeicherten Tokens des Kalender-Besitzers —
 * gedacht für Team-Sichtbarkeit, wo ein Kollege die Termine eines anderen Mitarbeiters
 * sieht (der Besitzer hat den Kalender via shared_with_team freigegeben).
 *
 * Privat markierte Termine werden best-effort herausgefiltert (Google visibility,
 * Outlook sensitivity, iCal CLASS) — Freigabe gilt nur für nicht-private Termine.
 *
 * Wirft NICHT — bei Fehlern wird [] zurückgegeben (ein kaputter Kalender darf nicht
 * die ganze Team-Ansicht killen).
 */
// ── Kurzlebiger In-Memory-Cache (pro warmer Serverless-Instanz) ──────────────
// Team-Kalender werden von vielen Betrachtern alle paar Minuten gepollt. Ohne
// Cache löst jeder Poll jedes Betrachters einen eigenen Provider-Abruf (inkl.
// Token-Refresh) aus. Der Cache dedupliziert das pro (Kalender, Zeitraum).
// TTL etwas unter dem Client-Poll (3 Min), damit Daten frisch genug bleiben.
interface CacheEntry { events: ParsedExternalEvent[]; expires: number; }
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 120_000; // 2 Min

export async function fetchCalendarEventsServer(
    admin: SupabaseClient,
    cal: any,
    from: Date,
    to: Date,
): Promise<ParsedExternalEvent[]> {
    const key = `${cal.id}|${from.toISOString()}|${to.toISOString()}`;
    const now = Date.now();
    const hit = CACHE.get(key);
    if (hit && hit.expires > now) return hit.events;

    try {
        let events: ParsedExternalEvent[];
        switch (cal.provider_type) {
            case 'google': events = await fetchGoogle(admin, cal, from, to); break;
            case 'outlook':
            case 'teams': events = await fetchMicrosoft(admin, cal, from, to); break;
            case 'apple':
            case 'troi': events = await fetchCalDav(cal, from, to); break;
            default: events = await fetchIcal(cal); break;
        }
        CACHE.set(key, { events, expires: now + CACHE_TTL_MS });
        // Abgelaufene Einträge gelegentlich aufräumen (Memory-Leak-Schutz).
        if (CACHE.size > 1000) {
            CACHE.forEach((v, k) => { if (v.expires <= now) CACHE.delete(k); });
        }
        return events;
    } catch (e) {
        // Strukturiert loggen → in Vercel-Logs auffindbar (welcher Kalender/Mitarbeiter).
        // Ein kaputter Kalender darf die Team-Ansicht nicht killen → [] zurück.
        console.error('[calendarServerFetch] failed', {
            calendar: cal?.name,
            employeeId: cal?.employee_id,
            provider: cal?.provider_type,
            error: e instanceof Error ? e.message : String(e),
        });
        return [];
    }
}

// ── Google ───────────────────────────────────────────────────────
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
        }),
    });
    if (!res.ok) return null;
    return (await res.json()).access_token;
}

async function googleToken(admin: SupabaseClient, cal: any): Promise<{ token: string; calId: string } | null> {
    let token = safeDecrypt(cal.oauth_access_token);
    const expired = cal.oauth_expires_at && new Date(cal.oauth_expires_at) < new Date(Date.now() + 60_000);
    if (expired && cal.oauth_refresh_token) {
        token = (await refreshGoogleToken(safeDecrypt(cal.oauth_refresh_token))) || '';
        if (token) {
            const q = (admin.from('external_calendars') as any)
                .update({ oauth_access_token: encrypt(token), oauth_expires_at: new Date(Date.now() + 3600_000).toISOString() });
            if (cal.account_label) await q.eq('employee_id', cal.employee_id).eq('provider_type', 'google').eq('account_label', cal.account_label);
            else await q.eq('id', cal.id);
        }
    }
    return token ? { token, calId: cal.external_calendar_id || 'primary' } : null;
}

async function fetchGoogle(admin: SupabaseClient, cal: any, from: Date, to: Date): Promise<ParsedExternalEvent[]> {
    const auth = await googleToken(admin, cal);
    if (!auth) return [];
    const params = new URLSearchParams({
        singleEvents: 'true', orderBy: 'startTime',
        timeMin: from.toISOString(), timeMax: to.toISOString(),
    });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calId)}/events?${params}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || [])
        .filter((ev: any) => ev.visibility !== 'private' && ev.visibility !== 'confidential')
        .map((ev: any) => {
            const allDay = !!ev.start?.date;
            const start = allDay ? ev.start.date + 'T00:00:00' : ev.start?.dateTime;
            const end = allDay ? (ev.end?.date || ev.start?.date) + 'T23:59:59' : ev.end?.dateTime;
            return {
                id: `ext-${cal.id}-${ev.id}`,
                uid: ev.id,
                externalCalendarId: cal.id,
                title: ev.summary || '(Kein Titel)',
                start_at: new Date(start).toISOString(),
                end_at: new Date(end).toISOString(),
                all_day: allDay,
                color: cal?.color || '#3B82F6',
                calendarName: cal?.name || 'Google Kalender',
                description: ev.description,
                location: ev.location,
                meeting_url: ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri,
            } as ParsedExternalEvent;
        });
}

// ── Microsoft (Outlook / Teams) ──────────────────────────────────
async function refreshMicrosoftToken(refreshToken: string): Promise<string | null> {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            scope: 'Calendars.ReadWrite offline_access',
        }),
    });
    if (!res.ok) return null;
    return (await res.json()).access_token;
}

async function microsoftToken(admin: SupabaseClient, cal: any): Promise<string | null> {
    let token = safeDecrypt(cal.oauth_access_token);
    const expired = cal.oauth_expires_at && new Date(cal.oauth_expires_at) < new Date(Date.now() + 60_000);
    if (expired && cal.oauth_refresh_token) {
        token = (await refreshMicrosoftToken(safeDecrypt(cal.oauth_refresh_token))) || '';
        if (token) {
            const q = (admin.from('external_calendars') as any)
                .update({ oauth_access_token: encrypt(token), oauth_expires_at: new Date(Date.now() + 3600_000).toISOString() });
            if (cal.account_label) await q.eq('employee_id', cal.employee_id).eq('provider_type', 'outlook').eq('account_label', cal.account_label);
            else await q.eq('id', cal.id);
        }
    }
    return token || null;
}

function extractTeamsUrl(event: any): string | undefined {
    if (event.onlineMeeting?.joinUrl) return event.onlineMeeting.joinUrl;
    if (event.onlineMeetingUrl) return event.onlineMeetingUrl;
    const m = event.body?.content?.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i);
    return m ? m[0] : undefined;
}

async function fetchMicrosoft(admin: SupabaseClient, cal: any, from: Date, to: Date): Promise<ParsedExternalEvent[]> {
    const token = await microsoftToken(admin, cal);
    if (!token) return [];
    const params = new URLSearchParams({
        $select: 'id,subject,start,end,location,body,onlineMeeting,onlineMeetingUrl,isAllDay,sensitivity',
        $orderby: 'start/dateTime', $top: '100',
        $filter: `start/dateTime ge '${from.toISOString()}' and end/dateTime le '${to.toISOString()}'`,
    });
    const msCalId = cal.external_calendar_id;
    const endpoint = msCalId && msCalId !== 'me'
        ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(msCalId)}/events`
        : `https://graph.microsoft.com/v1.0/me/events`;
    const res = await fetch(`${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="Europe/Vienna"' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.value || [])
        .filter((ev: any) => ev.sensitivity !== 'private' && ev.sensitivity !== 'confidential')
        .map((ev: any) => ({
            id: `ext-${cal.id}-${ev.id}`,
            uid: ev.id,
            externalCalendarId: cal.id,
            title: ev.subject || '(Kein Titel)',
            start_at: new Date(ev.start.dateTime + (ev.start.timeZone === 'UTC' ? 'Z' : '')).toISOString(),
            end_at: new Date(ev.end.dateTime + (ev.end.timeZone === 'UTC' ? 'Z' : '')).toISOString(),
            all_day: ev.isAllDay,
            color: cal?.color || '#0078D4',
            calendarName: cal?.name || 'Outlook',
            description: ev.body?.content?.replace(/<[^>]+>/g, '') || undefined,
            location: ev.location?.displayName || undefined,
            meeting_url: extractTeamsUrl(ev),
        } as ParsedExternalEvent));
}

// ── CalDAV (Apple / Troi) ────────────────────────────────────────
function formatDateUTC(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Entfernt privat/vertraulich markierte VEVENT-Blöcke vor dem Parsen.
function stripPrivateVevents(ical: string): string {
    const head = ical.split('BEGIN:VEVENT')[0];
    const blocks = ical.split('BEGIN:VEVENT').slice(1)
        .filter(b => !/CLASS:(PRIVATE|CONFIDENTIAL)/i.test(b))
        .map(b => 'BEGIN:VEVENT' + b);
    return head + blocks.join('');
}

async function fetchCalDav(cal: any, from: Date, to: Date): Promise<ParsedExternalEvent[]> {
    const username = cal.caldav_username;
    const password = safeDecrypt(cal.oauth_access_token);
    const url = cal.url;
    if (!username || !password || !url) return [];

    const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT">
    <C:time-range start="${formatDateUTC(from)}" end="${formatDateUTC(to)}"/>
  </C:comp-filter></C:comp-filter></C:filter>
</C:calendar-query>`;

    const res = await fetch(url, {
        method: 'REPORT',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
            'Depth': '1',
            'Content-Type': 'application/xml; charset=utf-8',
            'Prefer': 'return-minimal',
        },
        body: reportBody,
    });
    if (!res.ok && res.status !== 207) return [];

    const xml = await res.text();
    const pattern = /<(?:[A-Za-z]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?calendar-data>/gi;
    const blocks: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) {
        const raw = match[1].trim()
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/&apos;/g, "'").replace(/&quot;/g, '"');
        if (raw.includes('BEGIN:VCALENDAR') || raw.includes('BEGIN:VEVENT')) blocks.push(raw);
    }
    const combined = stripPrivateVevents(blocks.join('\n\n'));
    return parseICalText(combined, cal.id, cal.name, cal.color);
}

// ── iCal-Abo ─────────────────────────────────────────────────────
async function fetchIcal(cal: any): Promise<ParsedExternalEvent[]> {
    if (!cal.url) return [];
    // SSRF-Schutz: kein Abruf interner/Metadata-Endpoints, keine Redirects.
    let parsed: URL;
    try {
        parsed = await assertSafeExternalUrl(cal.url);
    } catch {
        return [];
    }
    const res = await fetch(parsed.toString(), { redirect: 'error' });
    if (!res.ok) return [];
    const text = stripPrivateVevents((await res.text()).slice(0, 5 * 1024 * 1024));
    return parseICalText(text, cal.id, cal.name, cal.color);
}
