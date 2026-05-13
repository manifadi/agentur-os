import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/google-calendar?employeeId=...&organizationId=...&name=...&color=...&returnUrl=...
export async function GET(request: NextRequest) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'GOOGLE_CLIENT_ID not configured' }, { status: 500 });
    }

    const sp = request.nextUrl.searchParams;
    const employeeId = sp.get('employeeId') || '';
    const organizationId = sp.get('organizationId') || '';
    const name = sp.get('name') || 'Google Kalender';
    const color = sp.get('color') || '#3B82F6';
    const returnUrl = sp.get('returnUrl') || '/kalender';

    const state = Buffer.from(JSON.stringify({ employeeId, organizationId, name, color, returnUrl })).toString('base64url');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;
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
