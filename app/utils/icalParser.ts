import { ParsedExternalEvent } from '../types';
import { detectMeetingUrl } from './meetingUrl';

function parseICalDate(raw: string): Date {
    // Handles: 20260304T100000Z, 20260304T100000, 20260304
    const clean = raw.split(';').pop()?.replace('Z', '') || raw.replace('Z', '');
    if (clean.includes('T')) {
        const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
        const h = +clean.slice(9, 11), m = +clean.slice(11, 13), s = +clean.slice(13, 15);
        if (raw.endsWith('Z')) return new Date(Date.UTC(y, mo, d, h, m, s));
        return new Date(y, mo, d, h, m, s);
    }
    const y = +clean.slice(0, 4), mo = +clean.slice(4, 6) - 1, d = +clean.slice(6, 8);
    return new Date(y, mo, d);
}

function unfold(raw: string): string {
    return raw.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function extractMeetingUrl(lines: string[], description: string): string | undefined {
    // Teams: X-MICROSOFT-SKYPETEAMSMEETINGURL
    const teamsLine = lines.find(l => l.startsWith('X-MICROSOFT-SKYPETEAMSMEETINGURL'));
    if (teamsLine) return teamsLine.substring(teamsLine.indexOf(':') + 1).trim();

    // Google Meet: X-GOOGLE-CONFERENCE
    const meetLine = lines.find(l => l.startsWith('X-GOOGLE-CONFERENCE'));
    if (meetLine) return meetLine.substring(meetLine.indexOf(':') + 1).trim();

    // Generic CONFERENCE property
    const confLine = lines.find(l => l.startsWith('CONFERENCE:') || l.startsWith('CONFERENCE;'));
    if (confLine) {
        const val = confLine.substring(confLine.indexOf(':') + 1).trim();
        if (val.startsWith('http')) return val;
    }

    // Universal fallback: alle gängigen Provider via shared detector
    const detected = detectMeetingUrl(description);
    if (detected) return detected.url;

    return undefined;
}

export function parseICalText(
    rawIcal: string,
    externalCalendarId: string,
    calendarName: string,
    color: string
): ParsedExternalEvent[] {
    const text = unfold(rawIcal);
    const events: ParsedExternalEvent[] = [];
    const vevents = text.split('BEGIN:VEVENT').slice(1);

    for (const block of vevents) {
        const lines = block.split('\n');
        const get = (key: string) => {
            const line = lines.find(l => l.startsWith(key + ':') || l.startsWith(key + ';'));
            if (!line) return '';
            return line.substring(line.indexOf(':') + 1).trim();
        };

        const uid = get('UID') || Math.random().toString(36);
        const summary = get('SUMMARY') || '(Kein Titel)';
        const dtstart = get('DTSTART');
        const dtend = get('DTEND') || get('DTSTART');
        const desc = get('DESCRIPTION');
        const location = get('LOCATION');

        if (!dtstart) continue;

        const allDay = !dtstart.includes('T');
        const meetingUrl = extractMeetingUrl(lines, desc);

        try {
            const startDate = parseICalDate(dtstart);
            const endDate = parseICalDate(dtend || dtstart);

            events.push({
                id: `ext-${externalCalendarId}-${uid}`,
                uid,
                externalCalendarId,
                title: summary,
                start_at: startDate.toISOString(),
                end_at: endDate.toISOString(),
                all_day: allDay,
                color,
                calendarName,
                description: desc || undefined,
                location: location || undefined,
                meeting_url: meetingUrl,
            });
        } catch {
            // skip unparseable events
        }
    }
    return events;
}
