import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/microsoft?employeeId=...&organizationId=...&name=...&color=...&returnUrl=...
export async function GET(request: NextRequest) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
        return NextResponse.json({ error: 'MICROSOFT_CLIENT_ID not configured' }, { status: 500 });
    }

    const sp = request.nextUrl.searchParams;
    const employeeId = sp.get('employeeId') || '';
    const organizationId = sp.get('organizationId') || '';
    const name = sp.get('name') || 'Outlook Kalender';
    const color = sp.get('color') || '#0078D4';
    const returnUrl = sp.get('returnUrl') || '/kalender';

    const state = Buffer.from(JSON.stringify({ employeeId, organizationId, name, color, returnUrl })).toString('base64url');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;
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
