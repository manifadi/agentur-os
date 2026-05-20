/**
 * Erkennt Meeting-URLs aus beliebigem Text (Description, Location, etc.)
 * Unterstützt: Teams, Google Meet, Zoom, Webex, Whereby, Jitsi, GoToMeeting, BlueJeans
 */

const PATTERNS: { provider: MeetingProvider; regex: RegExp }[] = [
    { provider: 'teams', regex: /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"'`]+/i },
    { provider: 'teams', regex: /https:\/\/teams\.live\.com\/meet\/[^\s<>"'`]+/i },
    { provider: 'meet', regex: /https:\/\/meet\.google\.com\/[a-z0-9-]+/i },
    { provider: 'zoom', regex: /https:\/\/[a-z0-9-]+\.zoom\.us\/j\/[0-9]+(?:\?[^\s<>"'`]*)?/i },
    { provider: 'zoom', regex: /https:\/\/zoom\.us\/j\/[0-9]+(?:\?[^\s<>"'`]*)?/i },
    { provider: 'webex', regex: /https:\/\/[a-z0-9-]+\.webex\.com\/[^\s<>"'`]+/i },
    { provider: 'whereby', regex: /https:\/\/whereby\.com\/[^\s<>"'`]+/i },
    { provider: 'jitsi', regex: /https:\/\/meet\.jit\.si\/[^\s<>"'`]+/i },
    { provider: 'gotomeeting', regex: /https:\/\/(?:www\.)?gotomeeting\.com\/join\/[^\s<>"'`]+/i },
    { provider: 'bluejeans', regex: /https:\/\/[a-z0-9.-]*bluejeans\.com\/[^\s<>"'`]+/i },
];

export type MeetingProvider = 'teams' | 'meet' | 'zoom' | 'webex' | 'whereby' | 'jitsi' | 'gotomeeting' | 'bluejeans';

export interface DetectedMeeting {
    url: string;
    provider: MeetingProvider;
}

export function detectMeetingUrl(...texts: (string | null | undefined)[]): DetectedMeeting | null {
    const haystack = texts.filter(Boolean).join('\n');
    if (!haystack) return null;
    for (const { provider, regex } of PATTERNS) {
        const m = haystack.match(regex);
        if (m) return { url: m[0], provider };
    }
    return null;
}

export function providerLabel(p: MeetingProvider): string {
    switch (p) {
        case 'teams': return 'Microsoft Teams';
        case 'meet': return 'Google Meet';
        case 'zoom': return 'Zoom';
        case 'webex': return 'Webex';
        case 'whereby': return 'Whereby';
        case 'jitsi': return 'Jitsi';
        case 'gotomeeting': return 'GoToMeeting';
        case 'bluejeans': return 'BlueJeans';
    }
}

export function providerColor(p: MeetingProvider): string {
    switch (p) {
        case 'teams': return '#5059C9';
        case 'meet': return '#00897B';
        case 'zoom': return '#2D8CFF';
        case 'webex': return '#00BCEB';
        case 'whereby': return '#FF3B7B';
        case 'jitsi': return '#1F4E79';
        case 'gotomeeting': return '#F68B1F';
        case 'bluejeans': return '#1B5E92';
    }
}
