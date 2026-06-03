import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, signState } from '../../../utils/apiAuth';

// GET /api/auth/microsoft?at=<access_token>&name=...&color=...&returnUrl=...
// employeeId/organizationId aus der Session (nicht aus Query); State HMAC-signiert.
export async function GET(request: NextRequest) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'MICROSOFT_CLIENT_ID not configured' }, { status: 500 });
    }

    const sp = request.nextUrl.searchParams;
    const accessToken = sp.get('at') || '';
    const name = sp.get('name') || 'Outlook Kalender';
    const color = sp.get('color') || '#0078D4';
    const returnUrl = sp.get('returnUrl') || '/kalender';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;

    const admin = serviceClient();
    const { data: { user } } = await admin.auth.getUser(accessToken);
    if (!user) {
        return NextResponse.redirect(`${appUrl}/kalender?error=not_authenticated`);
    }
    const { data: emp } = await admin
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
    if (!emp?.id || !emp.organization_id) {
        return NextResponse.redirect(`${appUrl}/kalender?error=no_profile`);
    }

    const safeReturn = returnUrl.startsWith('/') ? returnUrl : '/kalender';
    const state = signState({ employeeId: emp.id, organizationId: emp.organization_id, name, color, returnUrl: safeReturn });

    const redirectUri = `${appUrl}/api/auth/microsoft/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'Calendars.ReadWrite offline_access',
        response_mode: 'query',
        state,
    });

    return NextResponse.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
}
