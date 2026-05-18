import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt } from '../../../../utils/crypto';

const SUPABASE_URL = 'https://lkyqohkdxmchrjicvurn.supabase.co';

// Microsoft Graph color names → hex
const MS_COLOR_MAP: Record<string, string> = {
    auto: '#0078D4',
    lightBlue: '#3B82F6',
    lightGreen: '#10B981',
    lightOrange: '#F97316',
    lightGray: '#64748B',
    lightYellow: '#F59E0B',
    lightTeal: '#14B8A6',
    lightPink: '#EC4899',
    lightBrown: '#92400E',
    lightRed: '#EF4444',
    maxColor: '#0078D4',
};

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

    // Fetch user profile for account label
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    const accountEmail = profile?.mail || profile?.userPrincipalName || 'microsoft';

    // Fetch all calendars in this Microsoft account
    const calListRes = await fetch('https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,color,canEdit,owner,isDefaultCalendar', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!calListRes.ok) {
        return NextResponse.redirect(`${appUrl}/kalender?error=calendar_list_failed`);
    }

    const calList = await calListRes.json();
    const items: any[] = calList.value || [];

    if (items.length === 0) {
        return NextResponse.redirect(`${appUrl}${state.returnUrl}?error=no_calendars`);
    }

    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(SUPABASE_URL, serviceRole);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const encAccess = encrypt(tokens.access_token);
    const encRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

    // Remove existing rows for this account + legacy rows without account_label (reconnect support)
    await supabase.from('external_calendars')
        .delete()
        .eq('employee_id', state.employeeId)
        .eq('provider_type', 'outlook')
        .or(`account_label.eq.${accountEmail},account_label.is.null`);

    const rows = items.map(item => {
        const isDefault = !!item.isDefaultCalendar;
        return {
            organization_id: state.organizationId,
            employee_id: state.employeeId,
            name: item.name || 'Kalender',
            url: '',
            color: MS_COLOR_MAP[item.color] || state.color,
            is_visible: isDefault, // only default visible by default; user can enable rest
            provider_type: 'outlook',
            is_writable: item.canEdit !== false,
            external_calendar_id: item.id,
            account_label: accountEmail,
            oauth_access_token: encAccess,
            oauth_refresh_token: encRefresh,
            oauth_expires_at: expiresAt,
        };
    });

    const { error: insertError } = await supabase.from('external_calendars').insert(rows);
    if (insertError) {
        console.error('[microsoft-callback] Insert error:', insertError);
        return NextResponse.redirect(`${appUrl}${state.returnUrl}?error=save_failed`);
    }

    return NextResponse.redirect(`${appUrl}${state.returnUrl}?connected=microsoft&count=${items.length}`);
}

function getAppUrl(req: NextRequest) {
    return process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
}
