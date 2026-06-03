import { NextRequest, NextResponse } from 'next/server';
import { encrypt, safeDecrypt } from '../../../utils/crypto';
import { serviceClient, requireUser, loadOwnedCalendar, apiError } from '../../../utils/apiAuth';

async function refreshMicrosoftToken(refreshToken: string): Promise<string | null> {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            scope: 'Calendars.ReadWrite offline_access',
        }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
}

// Erwartet die bereits per loadOwnedCalendar geprüfte Kalender-Zeile.
async function getValidToken(supabase: any, cal: any): Promise<string | null> {
    if (!cal) return null;

    let token = safeDecrypt(cal.oauth_access_token);
    const expired = cal.oauth_expires_at && new Date(cal.oauth_expires_at) < new Date(Date.now() + 60_000);

    if (expired && cal.oauth_refresh_token) {
        const refreshToken = safeDecrypt(cal.oauth_refresh_token);
        token = (await refreshMicrosoftToken(refreshToken)) || '';
        if (token) {
            const expiresAt = new Date(Date.now() + 3600_000).toISOString();
            const encrypted = encrypt(token);
            const query = (supabase.from('external_calendars') as any)
                .update({ oauth_access_token: encrypted, oauth_expires_at: expiresAt });
            if (cal.account_label) {
                await query
                    .eq('employee_id', cal.employee_id)
                    .eq('provider_type', 'outlook')
                    .eq('account_label', cal.account_label);
            } else {
                await query.eq('id', cal.id);
            }
        }
    }

    return token || null;
}

function extractTeamsUrl(event: any): string | undefined {
    if (event.onlineMeeting?.joinUrl) return event.onlineMeeting.joinUrl;
    if (event.onlineMeetingUrl) return event.onlineMeetingUrl;
    const bodyMatch = event.body?.content?.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/i);
    if (bodyMatch) return bodyMatch[0];
    return undefined;
}

// GET /api/microsoft/events?calendarId=...&from=...&to=...
export async function GET(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const sp = request.nextUrl.searchParams;
        const calendarId = sp.get('calendarId');
        const from = sp.get('from');
        const to = sp.get('to');

        if (!calendarId) return NextResponse.json({ error: 'Missing calendarId' }, { status: 400 });
        const cal = await loadOwnedCalendar(admin, calendarId, caller);

        const token = await getValidToken(admin, cal);
        if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const filter: string[] = [];
        if (from) filter.push(`start/dateTime ge '${new Date(from).toISOString()}'`);
        if (to) filter.push(`end/dateTime le '${new Date(to).toISOString()}'`);

        const params = new URLSearchParams({
            $select: 'id,subject,start,end,location,body,onlineMeeting,onlineMeetingUrl,isAllDay,attendees',
            $orderby: 'start/dateTime',
            $top: '100',
            ...(filter.length && { $filter: filter.join(' and ') }),
        });

        // Use specific calendar endpoint if external_calendar_id is set (multi-calendar support).
        // Otherwise fall back to /me/events (legacy single-calendar rows).
        const msCalId = (cal as any)?.external_calendar_id;
        const endpoint = msCalId && msCalId !== 'me'
            ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(msCalId)}/events`
            : `https://graph.microsoft.com/v1.0/me/events`;

        const res = await fetch(`${endpoint}?${params}`, {
            headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="Europe/Vienna"' },
        });

        if (!res.ok) return NextResponse.json({ error: 'Microsoft API error' }, { status: 502 });

        const data = await res.json();
        const events = (data.value || []).map((ev: any) => {
            const allDay = ev.isAllDay;
            return {
                id: `ext-${calendarId}-${ev.id}`,
                uid: ev.id,
                externalCalendarId: calendarId,
                title: ev.subject || '(Kein Titel)',
                start_at: new Date(ev.start.dateTime + (ev.start.timeZone === 'UTC' ? 'Z' : '')).toISOString(),
                end_at: new Date(ev.end.dateTime + (ev.end.timeZone === 'UTC' ? 'Z' : '')).toISOString(),
                all_day: allDay,
                color: cal?.color || '#0078D4',
                calendarName: cal?.name || 'Outlook',
                description: ev.body?.content?.replace(/<[^>]+>/g, '') || undefined,
                location: ev.location?.displayName || undefined,
                meeting_url: extractTeamsUrl(ev),
            };
        });

        return NextResponse.json({ events });
    } catch (e) {
        return apiError(e);
    }
}

function buildMsEventBody(event: any): any {
    const descParts = [event.description || ''];
    if (event.meeting_url) descParts.push(`Meeting: ${event.meeting_url}`);
    const description = descParts.filter(Boolean).join('\n\n');

    const body: any = {
        subject: event.title,
        body: { contentType: 'text', content: description },
        start: event.all_day
            ? { dateTime: event.start_at.slice(0, 10) + 'T00:00:00', timeZone: 'Europe/Vienna' }
            : { dateTime: event.start_at, timeZone: 'UTC' },
        end: event.all_day
            ? { dateTime: event.end_at.slice(0, 10) + 'T23:59:59', timeZone: 'Europe/Vienna' }
            : { dateTime: event.end_at, timeZone: 'UTC' },
        isAllDay: event.all_day,
        location: event.location ? { displayName: event.location } : undefined,
    };
    if (event.attendees?.length) {
        body.attendees = event.attendees.map((a: any) => ({
            emailAddress: { address: a.email, name: a.name },
            type: 'required',
        }));
    }
    return body;
}

function msEndpoint(calMsId?: string | null): string {
    return calMsId && calMsId !== 'me'
        ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calMsId)}/events`
        : `https://graph.microsoft.com/v1.0/me/events`;
}

// POST /api/microsoft/events — create event in Outlook/Teams
export async function POST(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const body = await request.json();
        const { calendarId, event } = body;

        if (!calendarId || !event) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        const cal = await loadOwnedCalendar(admin, calendarId, caller);

        const token = await getValidToken(admin, cal);
        if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const endpoint = msEndpoint((cal as any)?.external_calendar_id);

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(buildMsEventBody(event)),
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Microsoft API error' }, { status: 502 });
        }

        const created = await res.json();
        return NextResponse.json({ success: true, microsoftEventId: created.id });
    } catch (e) {
        return apiError(e);
    }
}

// PATCH /api/microsoft/events — update event
// Body: { calendarId, microsoftEventId, event }
export async function PATCH(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const body = await request.json();
        const { calendarId, microsoftEventId, event } = body;

        if (!calendarId || !microsoftEventId || !event) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        const cal = await loadOwnedCalendar(admin, calendarId, caller);

        const token = await getValidToken(admin, cal);
        if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        // Single-event endpoint accepts /me/events/{id} regardless of which calendar — Graph API resolves it.
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(microsoftEventId)}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(buildMsEventBody(event)),
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Microsoft API error' }, { status: 502 });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return apiError(e);
    }
}

// DELETE /api/microsoft/events?calendarId=...&microsoftEventId=...
export async function DELETE(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const sp = request.nextUrl.searchParams;
        const calendarId = sp.get('calendarId');
        const microsoftEventId = sp.get('microsoftEventId');

        if (!calendarId || !microsoftEventId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        const cal = await loadOwnedCalendar(admin, calendarId, caller);

        const token = await getValidToken(admin, cal);
        if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(microsoftEventId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok && res.status !== 404) {
            return NextResponse.json({ error: `Microsoft DELETE failed: HTTP ${res.status}` }, { status: 502 });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return apiError(e);
    }
}
