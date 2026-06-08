import { describe, it, expect } from 'vitest';
import { detectMeetingUrl, providerLabel, providerColor } from '../meetingUrl';

describe('detectMeetingUrl', () => {
    it('erkennt Teams-Links', () => {
        const r = detectMeetingUrl('Beitreten: https://teams.microsoft.com/l/meetup-join/abc123');
        expect(r?.provider).toBe('teams');
        expect(r?.url).toContain('teams.microsoft.com');
    });

    it('erkennt Zoom-Links', () => {
        expect(detectMeetingUrl('https://acme.zoom.us/j/123456789')?.provider).toBe('zoom');
    });

    it('erkennt Google Meet', () => {
        expect(detectMeetingUrl('siehe https://meet.google.com/abc-defg-hij')?.provider).toBe('meet');
    });

    it('gibt null zurück, wenn keine Meeting-URL vorhanden ist', () => {
        expect(detectMeetingUrl('nur normaler text', null, undefined)).toBeNull();
    });

    it('durchsucht mehrere übergebene Texte', () => {
        expect(detectMeetingUrl(null, 'Beschreibung', 'https://meet.jit.si/room')?.provider).toBe('jitsi');
    });
});

describe('providerLabel / providerColor', () => {
    it('liefert Label und Farbe pro Provider', () => {
        expect(providerLabel('teams')).toBe('Microsoft Teams');
        expect(providerColor('zoom')).toBe('#2D8CFF');
    });
});
