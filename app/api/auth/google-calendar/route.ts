import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, signState } from '../../../utils/apiAuth';

// GET /api/auth/google-calendar?at=<access_token>&name=...&color=...&returnUrl=...
// employeeId/organizationId werden aus der Session abgeleitet (nicht aus Query) →
// kein Account-Linking-CSRF. Der State wird HMAC-signiert.
export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 });
    }

    const sp = request.nextUrl.searchParams;
    const accessToken = sp.get('at') || '';
    const name = sp.get('name') || 'Google Kalender';
    const color = sp.get('color') || '#3B82F6';
    const returnUrl = sp.get('returnUrl') || '/kalender';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;

    // Session validieren + Identität serverseitig bestimmen
    const admin = serviceClient();
    const { data: { user } } = await admin.auth.getUser(accessToken);
    if (!user) {
        return NextResponse.redirect(`${appUrl}${returnUrl.startsWith('/') ? returnUrl : '/kalender'}?error=not_authenticated`);
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

    const redirectUri = `${appUrl}/api/auth/google-calendar/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar',
        access_type: 'offline',
        prompt: 'consent',
        state,
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
