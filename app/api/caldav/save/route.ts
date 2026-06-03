import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '../../../utils/crypto';
import { serviceClient, requireUser, apiError } from '../../../utils/apiAuth';

/**
 * POST /api/caldav/save
 *
 * Speichert einen oder mehrere CalDAV-Kalender (nach Discovery via /api/caldav/test).
 * organization_id/employee_id werden aus der SESSION abgeleitet — nie aus dem Body
 * (sonst könnte man Credentials in fremde Agenturen schreiben).
 *
 * Body: { providerType, username, password, color, calendars: [{ url, displayName, isWritable, color? }] }
 */
export async function POST(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        if (!caller.employeeId || !caller.organizationId) {
            return NextResponse.json({ error: 'Kein Mitarbeiter-Profil.' }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

        const { providerType, username, password, color, calendars } = body;
        if (!username || !password || !Array.isArray(calendars) || calendars.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const encryptedPassword = encrypt(password);

        const rows = calendars.map((c: any) => ({
            organization_id: caller.organizationId,
            employee_id: caller.employeeId,
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

        const { error } = await admin.from('external_calendars').insert(rows);
        if (error) {
            console.error('[caldav/save] insert error:', error);
            return NextResponse.json({ error: `DB-Fehler: ${error.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, added: rows.length });
    } catch (e) {
        return apiError(e);
    }
}
