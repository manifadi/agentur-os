import { supabase } from '../supabaseClient';

/**
 * fetch-Wrapper, der automatisch das Supabase-Access-Token als Bearer-Header
 * anhängt. Für alle Aufrufe an Service-Role-API-Routen verwenden, die jetzt
 * requireUser() erzwingen (Kalender-Sync, hidden-events, caldav/save …).
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = new Headers(init.headers || {});
    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    return fetch(input, { ...init, headers });
}

/** Liefert das aktuelle Access-Token (oder '') — für Redirect-Flows (OAuth-Init). */
export async function currentAccessToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
}
