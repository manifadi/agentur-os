import dns from 'dns/promises';
import net from 'net';

// SSRF-Schutz: verhindert, dass der Server interne/Cloud-Metadata-Endpoints
// abruft (z.B. 169.254.169.254). Geteilt von ical-proxy + serverseitigem
// Kalender-Fetch. NUR serverseitig importieren (nutzt dns/net).

export function isPrivateIPv4(ip: string): boolean {
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

export function isPrivateIPv6(ip: string): boolean {
    const v = ip.toLowerCase();
    return (
        v === '::1' ||            // loopback
        v.startsWith('fc') ||     // unique local fc00::/7
        v.startsWith('fd') ||
        v.startsWith('fe80') ||   // link-local
        v.startsWith('::ffff:')   // IPv4-mapped
    );
}

export async function isSafeHost(hostname: string): Promise<boolean> {
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

/**
 * Normalisiert webcal→https, validiert Schema (nur http/https) und Host (kein
 * privates Netz). Wirft bei unsicherer/ungültiger URL. Gibt die geparste URL zurück.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
    const normalized = rawUrl.replace(/^webcal:\/\//i, 'https://');
    let parsed: URL;
    try {
        parsed = new URL(normalized);
    } catch {
        throw new Error('Ungültige URL.');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('Ungültiges URL-Schema.');
    }
    if (!(await isSafeHost(parsed.hostname))) {
        throw new Error('Zieladresse nicht erlaubt.');
    }
    return parsed;
}
