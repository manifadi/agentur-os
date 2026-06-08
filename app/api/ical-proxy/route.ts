import { NextRequest, NextResponse } from 'next/server';
import { assertSafeExternalUrl } from '../../utils/ssrfGuard';

// CORS-safe server-side proxy für iCal-Feeds — mit SSRF-Schutz (siehe ssrfGuard).

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    let parsed: URL;
    try {
        parsed = await assertSafeExternalUrl(url);
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Ungültige URL.' }, { status: 400 });
    }

    try {
        const res = await fetch(parsed.toString(), {
            headers: {
                'Accept': 'text/calendar, application/ics, text/plain',
                'User-Agent': 'Vela/1.0 (CalendarSync)',
            },
            redirect: 'error', // Redirects nicht folgen → kein Redirect-basiertes SSRF-Bypass
            next: { revalidate: 300 },
        });

        if (!res.ok) {
            return NextResponse.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
        }

        // Antwortgröße begrenzen (max 5 MB)
        const text = (await res.text()).slice(0, 5 * 1024 * 1024);
        return new NextResponse(text, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
            },
        });
    } catch {
        return NextResponse.json({ error: 'Feed nicht erreichbar.' }, { status: 502 });
    }
}
