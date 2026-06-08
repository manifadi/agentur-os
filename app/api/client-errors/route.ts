import { NextRequest, NextResponse } from 'next/server';

// Nimmt clientseitig gefangene Fehler entgegen und loggt sie serverseitig
// (von Vercel erfasst → zentral durchsuchbar). Bewusst ohne Auth, aber mit
// Größen-Limit gegen Missbrauch. Antwortet immer 204.
export async function POST(request: NextRequest) {
    try {
        const text = await request.text();
        if (text.length > 20_000) {
            console.warn('[client-error] payload too large, truncated');
        }
        let data: any = {};
        try { data = JSON.parse(text.slice(0, 20_000)); } catch { data = { raw: text.slice(0, 2_000) }; }

        console.error('[client-error]', {
            message: data.message,
            source: data.source,
            url: data.url,
            digest: data.digest,
            ts: data.ts,
            stack: typeof data.stack === 'string' ? data.stack.slice(0, 4_000) : undefined,
            userAgent: data.userAgent,
        });
    } catch {
        /* nie werfen */
    }
    return new NextResponse(null, { status: 204 });
}
