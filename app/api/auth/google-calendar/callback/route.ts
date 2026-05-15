import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '../../../../utils/crypto';

const SUPABASE_URL = 'https://lkyqohkdxmchrjicvurn.supabase.co';

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const code = sp.get('code');
    const stateRaw = sp.get('state');
    const error = sp.get('error');

    if (error || !code || !stateRaw) {
        return NextResponse.redirect(`${getAppUrl(request)}/kalender?error=google_auth_failed`);
    }

    let state: { employeeId: string; organizationId: string; name: string; color: string; returnUrl: string };
    try {
        state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());
    } catch {
        return NextResponse.redirect(`${getAppUrl(request)}/kalender?error=invalid_state`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const appUrl = getAppUrl(request);
    const redirectUri = `${appUrl}/api/auth/google-calendar/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });

    if (!tokenRes.ok) {
        return NextResponse.redirect(`${appUrl}/kalender?error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();

    // Fetch primary calendar info
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const calInfo = calRes.ok ? await calRes.json() : null;

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
        provider_type: 'google',
        is_writable: true,
        external_calendar_id: calInfo?.id || 'primary',
        oauth_access_token: encrypt(tokens.access_token),
        oauth_refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        oauth_expires_at: expiresAt,
    });

    return NextResponse.redirect(`${appUrl}${state.returnUrl}?connected=google`);
}

function getAppUrl(req: NextRequest) {
    return process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
}
