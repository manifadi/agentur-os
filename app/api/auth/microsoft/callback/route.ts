import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lkyqohkdxmchrjicvurn.supabase.co';

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const code = sp.get('code');
    const stateRaw = sp.get('state');
    const error = sp.get('error');

    if (error || !code || !stateRaw) {
        return NextResponse.redirect(`${getAppUrl(request)}/kalender?error=microsoft_auth_failed`);
    }

    let state: { employeeId: string; organizationId: string; name: string; color: string; returnUrl: string };
    try {
        state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());
    } catch {
        return NextResponse.redirect(`${getAppUrl(request)}/kalender?error=invalid_state`);
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID!;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
    const appUrl = getAppUrl(request);
    const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: 'Calendars.ReadWrite offline_access' }),
    });

    if (!tokenRes.ok) {
        return NextResponse.redirect(`${appUrl}/kalender?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    // Fetch user profile to get display name
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;

    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(SUPABASE_URL, serviceRole);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from('external_calendars').insert({
        organization_id: state.organizationId,
        employee_id: state.employeeId,
        name: state.name,
        url: '',
        color: state.color,
        is_visible: true,
        provider_type: 'outlook',
        is_writable: true,
        external_calendar_id: profile?.mail || 'me',
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token || null,
        oauth_expires_at: expiresAt,
    });

    return NextResponse.redirect(`${appUrl}${state.returnUrl}?connected=microsoft`);
}

function getAppUrl(req: NextRequest) {
    return process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
}
