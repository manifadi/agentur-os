import { NextRequest, NextResponse } from 'next/server';

// POST /api/caldav/test — test CalDAV connection credentials
// Body: { url, username, password }
// Returns { success, calendarName?, discoveredUrl?, error? } — always HTTP 200
export async function POST(request: NextRequest) {
    const { url, username, password } = await request.json();

    if (!url || !username || !password) {
        return NextResponse.json({ success: false, error: 'URL, Benutzername und Passwort sind erforderlich' });
    }

    const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const propfindBody = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`;

    const extractName = (text: string): string => {
        const m = text.match(/<[A-Za-z:]*displayname[^>]*>([^<]+)<\/[A-Za-z:]*displayname>/i);
        return m?.[1]?.trim() || '';
    };

    // Try PROPFIND on provided URL
    const tryUrl = async (targetUrl: string): Promise<{ status: number; text: string; finalUrl: string } | null> => {
        try {
            const res = await fetch(targetUrl, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': auth,
                    'Depth': '0',
                    'Content-Type': 'application/xml; charset=utf-8',
                },
                body: propfindBody,
                redirect: 'follow',
            });
            return { status: res.status, text: await res.text(), finalUrl: res.url || targetUrl };
        } catch {
            return null;
        }
    };

    // Extract server origin for .well-known discovery
    let serverBase = url;
    try {
        const parsed = new URL(url);
        serverBase = `${parsed.protocol}//${parsed.host}`;
    } catch { /* keep url */ }

    // Attempt 1: PROPFIND on the exact provided URL
    const attempt1 = await tryUrl(url);
    if (attempt1) {
        if (attempt1.status === 401) {
            return NextResponse.json({ success: false, error: 'Benutzername oder Passwort falsch (401)' });
        }
        if (attempt1.status === 207 || attempt1.status === 200) {
            return NextResponse.json({ success: true, calendarName: extractName(attempt1.text), discoveredUrl: attempt1.finalUrl });
        }
    }

    // Attempt 2: /.well-known/caldav discovery
    const wellKnown = `${serverBase}/.well-known/caldav`;
    const attempt2 = await tryUrl(wellKnown);
    if (attempt2) {
        if (attempt2.status === 401) {
            return NextResponse.json({ success: false, error: 'Benutzername oder Passwort falsch (401)' });
        }
        if (attempt2.status === 207 || attempt2.status === 200) {
            return NextResponse.json({ success: true, calendarName: extractName(attempt2.text), discoveredUrl: attempt2.finalUrl });
        }
    }

    // Attempt 3: try server root with PROPFIND (some servers redirect from root)
    const attempt3 = await tryUrl(serverBase + '/');
    if (attempt3) {
        if (attempt3.status === 401) {
            return NextResponse.json({ success: false, error: 'Benutzername oder Passwort falsch (401)' });
        }
        if (attempt3.status === 207 || attempt3.status === 200) {
            return NextResponse.json({ success: true, calendarName: extractName(attempt3.text), discoveredUrl: attempt3.finalUrl });
        }
    }

    return NextResponse.json({ success: false, error: 'CalDAV-Server nicht erreichbar. Bitte Server-Adresse und Pfad prüfen.' });
}
