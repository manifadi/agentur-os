import { NextRequest, NextResponse } from 'next/server';
import { safeDecrypt } from '../../../utils/crypto';
import { serviceClient, requireUser, loadOwnedCalendar, apiError } from '../../../utils/apiAuth';
import crypto from 'crypto';

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

// Authentifiziert den Aufrufer, prüft Kalender-Ownership und liefert die CalDAV-Credentials.
async function getOwnedCredentials(request: NextRequest, calendarId: string) {
    const supabase = serviceClient();
    const caller = await requireUser(request, supabase);
    const cal: any = await loadOwnedCalendar(supabase, calendarId, caller);
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
    try {
        const sp = request.nextUrl.searchParams;
        const calendarId = sp.get('calendarId');
        const from = sp.get('from');
        const to = sp.get('to');

        if (!calendarId) return NextResponse.json({ error: 'Missing calendarId' }, { status: 400 });

        const creds = await getOwnedCredentials(request, calendarId);
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
    } catch (e) {
        return apiError(e);
    }
}

async function caldavPut(creds: { username: string; password: string; url: string }, uid: string, ics: string, isCreate: boolean): Promise<{ ok: boolean; status: number }> {
    const eventUrl = creds.url.replace(/\/?$/, '/') + encodeURIComponent(uid) + '.ics';
    const headers: Record<string, string> = {
        'Authorization': buildAuth(creds.username, creds.password),
        'Content-Type': 'text/calendar; charset=utf-8',
    };
    if (isCreate) headers['If-None-Match'] = '*';
    const res = await fetch(eventUrl, { method: 'PUT', headers, body: ics });
    return { ok: res.ok || res.status === 201 || res.status === 204, status: res.status };
}

// ── POST: create event on CalDAV server (PUT a new .ics resource) ─────
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { calendarId, event } = body;

        if (!calendarId || !event) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const creds = await getOwnedCredentials(request, calendarId);
        if (!creds.isWritable) {
            return NextResponse.json({ error: 'Dieser Kalender ist schreibgeschützt.' }, { status: 403 });
        }
        if (!creds.username || !creds.password || !creds.url) {
            return NextResponse.json({ error: 'Missing CalDAV credentials' }, { status: 400 });
        }

        const uid = event.uid || `${crypto.randomUUID()}@vela`;
        const ics = buildICalEvent({ ...event, uid });

        const result = await caldavPut({ username: creds.username, password: creds.password, url: creds.url }, uid, ics, true);
        if (result.status === 401) return NextResponse.json({ error: 'Anmeldung fehlgeschlagen' }, { status: 401 });
        if (!result.ok) return NextResponse.json({ error: `CalDAV PUT fehlgeschlagen: HTTP ${result.status}` }, { status: 502 });
        return NextResponse.json({ success: true, uid });
    } catch (e) {
        return apiError(e);
    }
}

// ── PATCH: update existing event on CalDAV server (overwrite .ics) ─────
// Body: { calendarId, uid, event }
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { calendarId, uid, event } = body;

        if (!calendarId || !uid || !event) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const creds = await getOwnedCredentials(request, calendarId);
        if (!creds.isWritable) {
            return NextResponse.json({ error: 'Dieser Kalender ist schreibgeschützt.' }, { status: 403 });
        }
        if (!creds.username || !creds.password || !creds.url) {
            return NextResponse.json({ error: 'Missing CalDAV credentials' }, { status: 400 });
        }

        const ics = buildICalEvent({ ...event, uid });

        const result = await caldavPut({ username: creds.username, password: creds.password, url: creds.url }, uid, ics, false);
        if (result.status === 401) return NextResponse.json({ error: 'Anmeldung fehlgeschlagen' }, { status: 401 });
        if (!result.ok) return NextResponse.json({ error: `CalDAV PATCH fehlgeschlagen: HTTP ${result.status}` }, { status: 502 });
        return NextResponse.json({ success: true });
    } catch (e) {
        return apiError(e);
    }
}

// ── DELETE: remove event from CalDAV server ─────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        const sp = request.nextUrl.searchParams;
        const calendarId = sp.get('calendarId');
        const uid = sp.get('uid');

        if (!calendarId || !uid) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

        const creds = await getOwnedCredentials(request, calendarId);
        if (!creds.isWritable) {
            return NextResponse.json({ error: 'Dieser Kalender ist schreibgeschützt.' }, { status: 403 });
        }
        if (!creds.username || !creds.password || !creds.url) {
            return NextResponse.json({ error: 'Missing CalDAV credentials' }, { status: 400 });
        }

        const eventUrl = creds.url.replace(/\/?$/, '/') + encodeURIComponent(uid) + '.ics';

        const res = await fetch(eventUrl, {
            method: 'DELETE',
            headers: { 'Authorization': buildAuth(creds.username, creds.password) },
        });

        if (!res.ok && res.status !== 204 && res.status !== 404) {
            return NextResponse.json({ error: `CalDAV DELETE fehlgeschlagen: HTTP ${res.status}` }, { status: 502 });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return apiError(e);
    }
}

// ── Helper: build iCalendar VEVENT body ─────────────────────────
function buildICalEvent(event: {
    uid: string;
    title: string;
    start_at: string;
    end_at: string;
    all_day?: boolean;
    description?: string;
    location?: string;
    meeting_url?: string;
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
    const descParts: string[] = [];
    if (event.description) descParts.push(event.description);
    if (event.meeting_url) descParts.push(`Meeting: ${event.meeting_url}`);
    if (descParts.length) lines.push(`DESCRIPTION:${escapeText(descParts.join('\n\n'))}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.meeting_url) lines.push(`URL:${event.meeting_url}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');

    return lines.join('\r\n');
}
