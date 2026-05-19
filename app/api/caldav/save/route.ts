import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '../../../utils/crypto';

const SUPABASE_URL = 'https://lkyqohkdxmchrjicvurn.supabase.co';

/**
 * POST /api/caldav/save
 *
 * Saves one or more CalDAV calendars (after discovery via /api/caldav/test).
 * Encrypts the password server-side so plaintext never touches the database.
 *
 * Body: {
 *   organizationId, employeeId,
 *   providerType: 'troi' | 'apple' | 'ical',
 *   username, password,
 *   color,
 *   calendars: [{ url, displayName, isWritable, color? }]
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

        const { organizationId, employeeId, providerType, username, password, color, calendars } = body;

        if (!organizationId || !employeeId || !username || !password || !Array.isArray(calendars) || calendars.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRole) {
            return NextResponse.json({ error: 'Server-Konfiguration fehlt (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, serviceRole);
        const encryptedPassword = encrypt(password);

        const rows = calendars.map((c: any) => ({
            organization_id: organizationId,
            employee_id: employeeId,
            name: c.displayName,
            url: c.url,
            color: c.color || color || '#7C3AED',
            is_visible: true,
            provider_type: providerType,
            is_writable: !!c.isWritable,
            caldav_username: username,
            oauth_access_token: encryptedPassword,
            account_label: username,
        }));

        const { error } = await supabase.from('external_calendars').insert(rows);
        if (error) {
            console.error('[caldav/save] insert error:', error);
            return NextResponse.json({ error: `DB-Fehler: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, added: rows.length });
    } catch (e: any) {
        console.error('[caldav/save] unexpected:', e);
        return NextResponse.json({ error: `Unerwarteter Fehler: ${e?.message || String(e)}` }, { status: 500 });
    }
}
