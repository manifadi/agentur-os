import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import net from 'net';

// CORS-safe server-side proxy für iCal-Feeds — mit SSRF-Schutz.
// Verhindert, dass der Server interne/Cloud-Metadata-Endpoints abruft.

function isPrivateIPv4(ip: string): boolean {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some(n => Number.isNaN(n))) return true; // im Zweifel blocken
    const [a, b] = p;
    return (
        a === 10 ||                          // 10.0.0.0/8
        a === 127 ||                         // 127.0.0.0/8 loopback
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) ||          // 192.168.0.0/16
        (a === 169 && b === 254) ||          // 169.254.0.0/16 link-local (AWS-Metadata!)
        a === 0 ||                           // 0.0.0.0/8
        a >= 224                             // multicast / reserved
    );
}

function isPrivateIPv6(ip: string): boolean {
    const v = ip.toLowerCase();
    return (
        v === '::1' ||            // loopback
        v.startsWith('fc') ||     // unique local fc00::/7
        v.startsWith('fd') ||
        v.startsWith('fe80') ||   // link-local
        v.startsWith('::ffff:')   // IPv4-mapped → separat prüfen
    );
}

async function isSafeHost(hostname: string): Promise<boolean> {
    // Direkte IP-Eingabe abfangen
    if (net.isIP(hostname)) {
        return net.isIPv6(hostname) ? !isPrivateIPv6(hostname) : !isPrivateIPv4(hostname);
    }
    if (hostname === 'localhost') return false;
    try {
        const records = await dns.lookup(hostname, { all: true });
        if (!records.length) return false;
        for (const r of records) {
            const bad = r.family === 6
                ? (isPrivateIPv6(r.address) || (r.address.toLowerCase().startsWith('::ffff:') && isPrivateIPv4(r.address.split(':').pop() || '')))
                : isPrivateIPv4(r.address);
            if (bad) return false; // ein einziges privates Ergebnis → blocken (DNS-Rebinding)
        }
        return true;
    } catch {
        return false;
    }
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    const normalized = url.replace(/^webcal:\/\//i, 'https://');

    let parsed: URL;
    try {
        parsed = new URL(normalized);
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Nur http/https (kein file:/gopher:/etc.). SSRF-Schutz greift über den IP-Block unten.
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return NextResponse.json({ error: 'Ungültiges URL-Schema.' }, { status: 400 });
    }

    if (!(await isSafeHost(parsed.hostname))) {
        return NextResponse.json({ error: 'Zieladresse nicht erlaubt.' }, { status: 400 });
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
