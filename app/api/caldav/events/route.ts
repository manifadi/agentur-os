import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lkyqohkdxmchrjicvurn.supabase.co';

function formatDateUTC(d: Date): string {
    // CalDAV time-range format: 20260101T000000Z
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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

async function fetchCalDavEvents(
    calendarUrl: string,
    username: string,
    password: string,
    from: Date,
    to: Date
): Promise<string[]> {
    const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${formatDateUTC(from)}" end="${formatDateUTC(to)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const res = await fetch(calendarUrl, {
        method: 'REPORT',
        headers: {
            'Authorization': auth,
            'Depth': '1',
            'Content-Type': 'application/xml; charset=utf-8',
            'Prefer': 'return-minimal',
        },
        body: reportBody,
    });

    if (!res.ok && res.status !== 207) {
        throw new Error(`CalDAV REPORT failed: ${res.status} ${res.statusText}`);
    }

    const xml = await res.text();
    return parseCalDavXml(xml);
}

// GET /api/caldav/events?calendarId=...&from=...&to=...
export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const calendarId = sp.get('calendarId');
    const from = sp.get('from');
    const to = sp.get('to');

    if (!calendarId) return NextResponse.json({ error: 'Missing calendarId' }, { status: 400 });

    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: calRaw } = await supabase.from('external_calendars').select('*').eq('id', calendarId).single();
    const cal = calRaw as any;
    if (!cal) return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });

    const username = cal.caldav_username;
    const password = cal.oauth_access_token;
    const calendarUrl = cal.url;

    if (!username || !password || !calendarUrl) {
        return NextResponse.json({ error: 'Missing CalDAV credentials' }, { status: 400 });
    }

    try {
        const fromDate = from ? new Date(from) : new Date();
        const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const icalBlocks = await fetchCalDavEvents(calendarUrl, username, password, fromDate, toDate);

        // Combine into one big iCal text and return for client-side parsing
        const combined = icalBlocks.join('\n\n');

        return NextResponse.json({
            ical: combined,
            calendarId,
            calendarName: cal.name,
            color: cal.color,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 502 });
    }
}
