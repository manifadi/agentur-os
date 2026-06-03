import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Zentrale Auth-/Ownership-Helfer für API-Routen, die mit dem Service-Role-Key
 * laufen (und damit RLS umgehen). JEDE solche Route MUSS hier durch:
 *   1. requireUser()        — validiert die Session (Bearer-Token)
 *   2. loadOwnedCalendar()  — stellt sicher, dass die Ziel-Ressource zur
 *                             Organisation/zum Mitarbeiter des Aufrufers gehört
 * Ohne diese Checks ist eine Service-Role-Route ein Cross-Tenant-IDOR.
 */

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://lkyqohkdxmchrjicvurn.supabase.co';

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

/** Service-Role-Client (umgeht RLS) — nur serverseitig, nie an den Client geben. */
export function serviceClient(): SupabaseClient {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new ApiError(500, 'SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt.');
    return createClient(SUPABASE_URL, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export interface Caller {
    userId: string;
    email: string | null;
    employeeId: string | null;
    organizationId: string | null;
    role: string | null;
    isSuperAdmin: boolean;
}

/**
 * Validiert das Bearer-Token aus dem Authorization-Header und löst den
 * zugehörigen Mitarbeiter-Eintrag auf. Wirft ApiError(401) ohne gültige Session.
 */
export async function requireUser(req: NextRequest, admin: SupabaseClient): Promise<Caller> {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) throw new ApiError(401, 'Nicht authentifiziert.');

    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) throw new ApiError(401, 'Sitzung ungültig.');

    const { data: emp } = await admin
        .from('employees')
        .select('id, organization_id, role, is_super_admin')
        .eq('user_id', user.id)
        .maybeSingle();

    return {
        userId: user.id,
        email: user.email ?? null,
        employeeId: (emp as any)?.id ?? null,
        organizationId: (emp as any)?.organization_id ?? null,
        role: (emp as any)?.role ?? null,
        isSuperAdmin: (emp as any)?.is_super_admin === true,
    };
}

/**
 * Lädt eine external_calendars-Zeile und stellt sicher, dass sie zum Aufrufer
 * gehört. Super-Admins dürfen alles (Support). Wirft 404/403 sonst.
 */
export async function loadOwnedCalendar(admin: SupabaseClient, calendarId: string, caller: Caller): Promise<any> {
    const { data: cal } = await admin.from('external_calendars').select('*').eq('id', calendarId).single();
    if (!cal) throw new ApiError(404, 'Kalender nicht gefunden.');

    if (!caller.isSuperAdmin) {
        const sameOrg = !!caller.organizationId && (cal as any).organization_id === caller.organizationId;
        const ownCalendar = !!caller.employeeId && (cal as any).employee_id === caller.employeeId;
        // external_calendars sind persönliche OAuth-/CalDAV-Verbindungen → nur der
        // verbundene Mitarbeiter (oder Super-Admin) darf darauf zugreifen.
        if (!sameOrg || !ownCalendar) {
            throw new ApiError(403, 'Kein Zugriff auf diesen Kalender.');
        }
    }
    return cal;
}

/** Wandelt ApiError (und unbekannte Fehler) in eine NextResponse um. */
export function apiError(e: unknown): NextResponse {
    if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[api] unhandled error:', e);
    return NextResponse.json({ error: 'Server-Fehler.' }, { status: 500 });
}

// ─────────────────────────────────────────────────────────────
// HMAC-signierter OAuth-State (gegen Account-Linking-CSRF)
// ─────────────────────────────────────────────────────────────
function hmacKey(): Buffer {
    // Der Service-Role-Key ist ein hochentropes, rein serverseitiges Geheimnis —
    // als HMAC-Schlüssel für die State-Signatur völlig ausreichend, ohne neue ENV.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new ApiError(500, 'SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt.');
    return crypto.createHash('sha256').update(key).digest();
}

/** Signiert ein State-Objekt: base64url(payload).base64url(hmac). */
export function signState(payload: Record<string, unknown>): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', hmacKey()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

/** Verifiziert + parst einen signierten State. Wirft bei Manipulation/Fehlen. */
export function verifyState<T = any>(state: string | null): T {
    if (!state || !state.includes('.')) throw new ApiError(400, 'Ungültiger State.');
    const [body, sig] = state.split('.');
    const expected = crypto.createHmac('sha256', hmacKey()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new ApiError(400, 'State-Signatur ungültig.');
    }
    return JSON.parse(Buffer.from(body, 'base64url').toString());
}
