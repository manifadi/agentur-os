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
    const body = await request.json();
    const { organizationId, employeeId, providerType, username, password, color, calendars } = body;

    if (!organizationId || !employeeId || !username || !password || !Array.isArray(calendars) || calendars.length === 0) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
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
    }));

    const { error } = await supabase.from('external_calendars').insert(rows);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, added: rows.length });
}
