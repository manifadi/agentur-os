import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '../../../../utils/crypto';
import { verifyState } from '../../../../utils/apiAuth';

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
        state = verifyState(stateRaw); // HMAC-Signatur prüfen → kein gefälschter State
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

    // Fetch user email (for account_label / grouping in UI)
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    const accountEmail = profile?.email || 'google';

    // Fetch all calendars in this Google account
    const calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?showHidden=false', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!calListRes.ok) {
        return NextResponse.redirect(`${appUrl}/kalender?error=calendar_list_failed`);
    }

    const calList = await calListRes.json();
    const items: any[] = calList.items || [];

    if (items.length === 0) {
        return NextResponse.redirect(`${appUrl}${state.returnUrl}?error=no_calendars`);
    }

    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(SUPABASE_URL, serviceRole);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const encAccess = encrypt(tokens.access_token);
    const encRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    // If user is reconnecting (same Google account), remove old rows for this account.
    // Also clean up legacy rows (no account_label, single 'primary' calendar) from before this migration.
    await supabase.from('external_calendars')
        .delete()
        .eq('employee_id', state.employeeId)
        .eq('provider_type', 'google')
        .or(`account_label.eq.${accountEmail},account_label.is.null`);

    // Insert one row per calendar
    const rows = items.map(item => {
        const isPrimary = !!item.primary;
        const accessRole = item.accessRole as string | undefined;
        const isWritable = accessRole === 'owner' || accessRole === 'writer';

        return {
            organization_id: state.organizationId,
            employee_id: state.employeeId,
            name: item.summaryOverride || item.summary || (isPrimary ? 'Mein Kalender' : 'Kalender'),
            url: '',
            color: item.backgroundColor || state.color,
            // Default: primary + explicitly selected calendars are visible; rest hidden
            is_visible: isPrimary || item.selected !== false,
            provider_type: 'google',
            is_writable: isWritable,
            external_calendar_id: item.id || 'primary',
            account_label: accountEmail,
            oauth_access_token: encAccess,
            oauth_refresh_token: encRefresh,
            oauth_expires_at: expiresAt,
        };
    });

    const { error: insertError } = await supabase.from('external_calendars').insert(rows);
    if (insertError) {
        console.error('[google-callback] Insert error:', insertError);
        return NextResponse.redirect(`${appUrl}${state.returnUrl}?error=save_failed`);
    }

    return NextResponse.redirect(`${appUrl}${state.returnUrl}?connected=google&count=${items.length}`);
}

function getAppUrl(req: NextRequest) {
    return process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
}
