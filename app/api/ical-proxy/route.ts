import { NextRequest, NextResponse } from 'next/server';

// CORS-safe server-side proxy for iCal feeds
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    // Only allow http/https/webcal URLs
    const normalized = url.replace(/^webcal:\/\//i, 'https://');
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 });
    }

    try {
        const res = await fetch(normalized, {
            headers: {
                'Accept': 'text/calendar, application/ics, text/plain',
                'User-Agent': 'AgenturOS/1.0 (CalendarSync)',
            },
            next: { revalidate: 300 }, // cache for 5 minutes
        });

        if (!res.ok) {
            return NextResponse.json({ error: `Upstream error: ${res.status}` }, { status: 502 });
        }

        const text = await res.text();
        return new NextResponse(text, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
