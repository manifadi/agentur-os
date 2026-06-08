import { describe, it, expect } from 'vitest';
import { parseICalText } from '../icalParser';

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-1
SUMMARY:Team Sync
DTSTART:20260615T090000Z
DTEND:20260615T100000Z
DESCRIPTION:Call https://meet.google.com/abc-defg-hij
LOCATION:Büro
END:VEVENT
END:VCALENDAR`;

describe('parseICalText', () => {
    it('parst ein einzelnes VEVENT mit allen Feldern', () => {
        const evs = parseICalText(ICS, 'cal-1', 'Mein Kalender', '#ffffff');
        expect(evs).toHaveLength(1);
        const e = evs[0];
        expect(e.title).toBe('Team Sync');
        expect(e.uid).toBe('evt-1');
        expect(e.externalCalendarId).toBe('cal-1');
        expect(e.all_day).toBe(false);
        expect(e.location).toBe('Büro');
        expect(e.meeting_url).toContain('meet.google.com');
    });

    it('erkennt Ganztags-Events (DTSTART;VALUE=DATE)', () => {
        const ics = 'BEGIN:VEVENT\nUID:x\nSUMMARY:Feiertag\nDTSTART;VALUE=DATE:20260615\nEND:VEVENT';
        const evs = parseICalText(ics, 'c', 'n', '#000000');
        expect(evs[0].all_day).toBe(true);
    });

    it('überspringt VEVENTs ohne DTSTART', () => {
        const ics = 'BEGIN:VEVENT\nUID:y\nSUMMARY:Ohne Datum\nEND:VEVENT';
        expect(parseICalText(ics, 'c', 'n', '#000000')).toHaveLength(0);
    });
});
