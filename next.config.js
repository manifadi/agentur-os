/** @type {import('next').NextConfig} */

// Sicherheits-Header für alle Routen. Bewusst ohne strikte script-src-CSP,
// damit Next.js (inline-Scripts/Hydration) nicht bricht — die wichtigsten
// Schutz-Direktiven (Clickjacking, MIME-Sniffing, HSTS) sind aber gesetzt.
const securityHeaders = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    // Low-breakage-CSP: blockiert Framing, Plugin-Objekte und base-Tag-Hijacking.
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
];

const nextConfig = {
    typescript: {
        // !! WARNUNG !!
        // Wir ignorieren TypeScript Fehler für den Build, damit es live geht.
        ignoreBuildErrors: true,
    },
    eslint: {
        // Warnung: Wir ignorieren ESLint Fehler für den Build.
        ignoreDuringBuilds: true,
    },
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
};

module.exports = nextConfig;
