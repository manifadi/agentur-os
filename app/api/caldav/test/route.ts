import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/caldav/test — Full CalDAV discovery and credential validation.
 *
 * Performs a 3-step RFC 4791 / 6764 discovery:
 *   1. Find user principal URL via PROPFIND on server root (or .well-known/caldav)
 *   2. Find calendar-home-set on the principal URL
 *   3. List all calendars under calendar-home-set (with displayname, color, writable)
 *
 * This is what macOS Calendar / iOS does behind the scenes.
 *
 * Body: { url, username, password }
 * Returns: { success, calendars?: Array<{ url, displayName, color?, isWritable }>, error? }
 */

interface DiscoveredCalendar {
    url: string;
    displayName: string;
    color?: string;
    isWritable: boolean;
}

function buildAuth(username: string, password: string): string {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

async function propfind(url: string, auth: string, depth: '0' | '1', body: string): Promise<{ status: number; text: string; finalUrl: string } | null> {
    try {
        const res = await fetch(url, {
            method: 'PROPFIND',
            headers: {
                'Authorization': auth,
                'Depth': depth,
                'Content-Type': 'application/xml; charset=utf-8',
            },
            body,
            redirect: 'follow',
        });
        return { status: res.status, text: await res.text(), finalUrl: res.url || url };
    } catch {
        return null;
    }
}

function resolveHref(href: string, base: string): string {
    // href can be absolute URL, server-relative path, or full path
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    try {
        const baseUrl = new URL(base);
        if (href.startsWith('/')) return `${baseUrl.protocol}//${baseUrl.host}${href}`;
        // Relative to base path
        return new URL(href, base).toString();
    } catch {
        return href;
    }
}

function extractHref(xml: string, key: string): string | null {
    // Looking for <key><D:href>...</D:href></key>
    const tagRe = new RegExp(`<(?:[A-Za-z]+:)?${key}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z]+:)?${key}>`, 'i');
    const sect = xml.match(tagRe);
    if (!sect) return null;
    const hrefMatch = sect[1].match(/<(?:[A-Za-z]+:)?href[^>]*>([^<]+)<\/(?:[A-Za-z]+:)?href>/i);
    return hrefMatch?.[1]?.trim() || null;
}

function extractDisplayName(responseBlock: string): string {
    const m = responseBlock.match(/<(?:[A-Za-z]+:)?displayname[^>]*>([^<]*)<\/(?:[A-Za-z]+:)?displayname>/i);
    return m?.[1]?.trim() || '';
}

function extractCalendarColor(responseBlock: string): string | undefined {
    const m = responseBlock.match(/<(?:[A-Za-z]+:)?calendar-color[^>]*>([^<]+)<\/(?:[A-Za-z]+:)?calendar-color>/i);
    if (m?.[1]) {
        // Apple uses #RRGGBBAA — strip alpha
        const raw = m[1].trim();
        return raw.length === 9 ? raw.slice(0, 7) : raw;
    }
    return undefined;
}

function isCalendarResource(responseBlock: string): boolean {
    // Must have <C:calendar/> inside <D:resourcetype>
    const rt = responseBlock.match(/<(?:[A-Za-z]+:)?resourcetype[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?resourcetype>/i);
    if (!rt) return false;
    return /<(?:[A-Za-z]+:)?calendar\s*\/?>/i.test(rt[1]);
}

function isWritable(responseBlock: string): boolean {
    // Check for write privileges. If privilege-set found, look for write/write-content.
    // If not present, assume writable (server didn't advertise restrictions).
    const ps = responseBlock.match(/<(?:[A-Za-z]+:)?current-user-privilege-set[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?current-user-privilege-set>/i);
    if (!ps) return true;
    return /<(?:[A-Za-z]+:)?write(?:-content)?\s*\/?>/i.test(ps[1]);
}

function splitResponses(xml: string): string[] {
    const blocks: string[] = [];
    const pattern = /<(?:[A-Za-z]+:)?response[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?response>/gi;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(xml)) !== null) blocks.push(m[1]);
    return blocks;
}

const PROP_PRINCIPAL = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:current-user-principal/>
    <D:principal-URL/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`;

const PROP_HOME = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>`;

const PROP_CALENDARS = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:I="http://apple.com/ns/ical/">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <D:current-user-privilege-set/>
    <I:calendar-color/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>`;

export async function POST(request: NextRequest) {
    const { url, username, password } = await request.json();

    if (!url || !username || !password) {
        return NextResponse.json({ success: false, error: 'URL, Benutzername und Passwort sind erforderlich' });
    }

    const auth = buildAuth(username, password);

    let parsedBase: URL;
    try {
        parsedBase = new URL(url);
    } catch {
        return NextResponse.json({ success: false, error: 'Ungültige Server-URL' });
    }
    const serverOrigin = `${parsedBase.protocol}//${parsedBase.host}`;

    // ── Step 1: Find user principal ──────────────────────────
    // Try entered URL first, then .well-known/caldav, then server root
    const startCandidates = [
        url,
        `${serverOrigin}/.well-known/caldav`,
        `${serverOrigin}/`,
    ];

    let principalUrl: string | null = null;
    let lastStatus = 0;

    for (const candidate of startCandidates) {
        const res = await propfind(candidate, auth, '0', PROP_PRINCIPAL);
        if (!res) continue;
        lastStatus = res.status;
        if (res.status === 401) {
            return NextResponse.json({ success: false, error: 'Benutzername oder Passwort falsch (401)' });
        }
        if (res.status === 207 || res.status === 200) {
            const href = extractHref(res.text, 'current-user-principal') || extractHref(res.text, 'principal-URL');
            if (href) {
                principalUrl = resolveHref(href, res.finalUrl);
                break;
            }
            // No principal in response? URL might already be a principal/home. Continue with finalUrl.
            principalUrl = res.finalUrl;
            break;
        }
    }

    if (!principalUrl) {
        return NextResponse.json({ success: false, error: `CalDAV-Server nicht erreichbar (Status ${lastStatus || 'keine Antwort'}). Bitte Server-Adresse prüfen.` });
    }

    // ── Step 2: Find calendar-home-set ─────────────────────────
    let calendarHome: string | null = null;
    const homeRes = await propfind(principalUrl, auth, '0', PROP_HOME);
    if (homeRes && (homeRes.status === 207 || homeRes.status === 200)) {
        const href = extractHref(homeRes.text, 'calendar-home-set');
        if (href) calendarHome = resolveHref(href, homeRes.finalUrl);
    }
    // Fallback: principal URL itself, or final URL if it's a calendar collection
    if (!calendarHome) calendarHome = principalUrl;

    // ── Step 3: List calendars under calendar-home ─────────────
    const listRes = await propfind(calendarHome, auth, '1', PROP_CALENDARS);
    if (!listRes) {
        return NextResponse.json({ success: false, error: 'Kalender-Liste konnte nicht abgerufen werden.' });
    }
    if (listRes.status === 401) {
        return NextResponse.json({ success: false, error: 'Benutzername oder Passwort falsch (401)' });
    }
    if (listRes.status !== 207 && listRes.status !== 200) {
        return NextResponse.json({ success: false, error: `CalDAV-Server antwortete mit Status ${listRes.status}` });
    }

    // Parse each <response> block for calendar resources
    const calendars: DiscoveredCalendar[] = [];
    const responseBlocks = splitResponses(listRes.text);

    for (const block of responseBlocks) {
        if (!isCalendarResource(block)) continue;
        const hrefMatch = block.match(/<(?:[A-Za-z]+:)?href[^>]*>([^<]+)<\/(?:[A-Za-z]+:)?href>/i);
        if (!hrefMatch) continue;
        const calUrl = resolveHref(hrefMatch[1].trim(), listRes.finalUrl);
        // Skip if same as home (self-listing)
        if (calUrl.replace(/\/$/, '') === calendarHome.replace(/\/$/, '')) continue;

        calendars.push({
            url: calUrl,
            displayName: extractDisplayName(block) || decodeURIComponent(calUrl.split('/').filter(Boolean).pop() || 'Kalender'),
            color: extractCalendarColor(block),
            isWritable: isWritable(block),
        });
    }

    if (calendars.length === 0) {
        // Maybe the entered URL is itself a calendar — try it directly
        const directRes = await propfind(calendarHome, auth, '0', PROP_CALENDARS);
        if (directRes && (directRes.status === 207 || directRes.status === 200)) {
            const blocks = splitResponses(directRes.text);
            for (const block of blocks) {
                if (!isCalendarResource(block)) continue;
                calendars.push({
                    url: calendarHome,
                    displayName: extractDisplayName(block) || 'Kalender',
                    color: extractCalendarColor(block),
                    isWritable: isWritable(block),
                });
                break;
            }
        }
    }

    if (calendars.length === 0) {
        return NextResponse.json({
            success: false,
            error: 'Verbindung erfolgreich, aber keine Kalender gefunden. Bitte prüfe ob der Server-Pfad auf Dein Konto zeigt.',
        });
    }

    return NextResponse.json({ success: true, calendars });
}
