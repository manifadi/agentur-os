import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt, safeDecrypt } from '../../../utils/crypto';
import crypto from 'crypto';

const SUPABASE_URL = 'https://lkyqohkdxmchrjicvurn.supabase.co';

function formatDateUTC(d: Date): string {
    // CalDAV time-range format: 20260101T000000Z
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildAuth(username: string, password: string): string {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

function parseCalDavXml(xml: string): string[] {
    const blocks: string[] = [];
    const pattern = /<(?:[A-Za-z]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?calendar-data>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(xml)) !== null) {
        const raw = match[1].trim();
        const unescaped = raw
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"');
        if (unescaped.includes('BEGIN:VCALENDAR') || unescaped.includes('BEGIN:VEVENT')) {
            blocks.push(unescaped);
        }
    }
    return blocks;
}

async function getCalendarCredentials(calendarId: string) {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: calRaw } = await supabase.from('external_calendars').select('*').eq('id', calendarId).single();
    const cal = calRaw as any;
    if (!cal) return null;
    return {
        cal,
        username: cal.caldav_username,
        password: safeDecrypt(cal.oauth_access_token),
        url: cal.url,
        isWritable: !!cal.is_writable,
        supabase,
    };
}

// ── GET: fetch events ─────────────────────────────────────────
export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const calendarId = sp.get('calendarId');
    const from = sp.get('from');
    const to = sp.get('to');

    if (!calendarId) return NextResponse.json({ error: 'Missing calendarId' }, { status: 400 });

    const creds = await getCalendarCredentials(calendarId);
    if (!creds) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    if (!creds.username || !creds.password || !creds.url) {
        return NextResponse.json({ error: 'Missing CalDAV credentials' }, { status: 400 });
    }

    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${formatDateUTC(fromDate)}" end="${formatDateUTC(toDate)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    try {
        const res = await fetch(creds.url, {
            method: 'REPORT',
            headers: {
                'Authorization': buildAuth(creds.username, creds.password),
                'Depth': '1',
                'Content-Type': 'application/xml; charset=utf-8',
                'Prefer': 'return-minimal',
            },
            body: reportBody,
        });

        if (res.status === 401) {
            return NextResponse.json({ error: 'CalDAV-Anmeldung fehlgeschlagen (401). Passwort wurde möglicherweise geändert.' }, { status: 401 });
        }
        if (!res.ok && res.status !== 207) {
            return NextResponse.json({ error: `CalDAV REPORT fehlgeschlagen: HTTP ${res.status}` }, { status: 502 });
        }

        const xml = await res.text();
        const icalBlocks = parseCalDavXml(xml);
        const combined = icalBlocks.join('\n\n');

        // Update last_synced_at
        await creds.supabase
            .from('external_calendars')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', calendarId);

        return NextResponse.json({
            ical: combined,
            calendarId,
            calendarName: creds.cal.name,
            color: creds.cal.color,
            eventCount: icalBlocks.length,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Unbekannter Fehler beim CalDAV-Abruf' }, { status: 502 });
    }
}

// ── POST: create event on CalDAV server (PUT a new .ics resource) ─────
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { calendarId, event } = body;

    if (!calendarId || !event) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const creds = await getCalendarCredentials(calendarId);
    if (!creds) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    if (!creds.isWritable) {
        return NextResponse.json({ error: 'Dieser Kalender ist schreibgeschützt.' }, { status: 403 });
    }
    if (!creds.username || !creds.password || !creds.url) {
        return NextResponse.json({ error: 'Missing CalDAV credentials' }, { status: 400 });
    }

    const uid = event.uid || `${crypto.randomUUID()}@vela`;
    const ics = buildICalEvent({ ...event, uid });
    const eventUrl = creds.url.replace(/\/?$/, '/') + encodeURIComponent(uid) + '.ics';

    try {
        const res = await fetch(eventUrl, {
            method: 'PUT',
            headers: {
                'Authorization': buildAuth(creds.username, creds.password),
                'Content-Type': 'text/calendar; charset=utf-8',
                'If-None-Match': '*', // create only
            },
            body: ics,
        });

        if (res.status === 401) return NextResponse.json({ error: 'Anmeldung fehlgeschlagen' }, { status: 401 });
        if (!res.ok && res.status !== 201 && res.status !== 204) {
            return NextResponse.json({ error: `CalDAV PUT fehlgeschlagen: HTTP ${res.status}` }, { status: 502 });
        }

        return NextResponse.json({ success: true, uid, eventUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 502 });
    }
}

// ── DELETE: remove event from CalDAV server ─────────────────────────
export async function DELETE(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const calendarId = sp.get('calendarId');
    const uid = sp.get('uid');

    if (!calendarId || !uid) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const creds = await getCalendarCredentials(calendarId);
    if (!creds) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    if (!creds.isWritable) {
        return NextResponse.json({ error: 'Dieser Kalender ist schreibgeschützt.' }, { status: 403 });
    }
    if (!creds.username || !creds.password || !creds.url) {
        return NextResponse.json({ error: 'Missing CalDAV credentials' }, { status: 400 });
    }

    const eventUrl = creds.url.replace(/\/?$/, '/') + encodeURIComponent(uid) + '.ics';

    try {
        const res = await fetch(eventUrl, {
            method: 'DELETE',
            headers: { 'Authorization': buildAuth(creds.username, creds.password) },
        });

        if (!res.ok && res.status !== 204 && res.status !== 404) {
            return NextResponse.json({ error: `CalDAV DELETE fehlgeschlagen: HTTP ${res.status}` }, { status: 502 });
        }
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 502 });
    }
}

// Re-export encrypt so other server code can encrypt password when saving from modal
export { encrypt };

// ── Helper: build iCalendar VEVENT body ─────────────────────────
function buildICalEvent(event: {
    uid: string;
    title: string;
    start_at: string;
    end_at: string;
    all_day?: boolean;
    description?: string;
    location?: string;
}): string {
    const fmt = (iso: string, allDay: boolean): string => {
        const d = new Date(iso);
        if (allDay) {
            return d.toISOString().slice(0, 10).replace(/-/g, '');
        }
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const allDay = !!event.all_day;
    const dtstart = fmt(event.start_at, allDay);
    const dtend = fmt(event.end_at, allDay);
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const escapeText = (s: string) =>
        s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Vela//EN',
        'BEGIN:VEVENT',
        `UID:${event.uid}`,
        `DTSTAMP:${now}`,
        allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
        allDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`,
        `SUMMARY:${escapeText(event.title)}`,
    ];
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');

    return lines.join('\r\n');
}
