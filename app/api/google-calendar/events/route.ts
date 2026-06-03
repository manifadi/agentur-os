import { NextRequest, NextResponse } from 'next/server';
import { encrypt, safeDecrypt } from '../../../utils/crypto';
import { serviceClient, requireUser, loadOwnedCalendar, apiError } from '../../../utils/apiAuth';

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
        }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
}

// Erwartet die bereits per loadOwnedCalendar geprüfte Kalender-Zeile.
async function getValidToken(supabase: any, cal: any): Promise<{ token: string; calId: string } | null> {
    if (!cal) return null;

    let token = safeDecrypt(cal.oauth_access_token);
    const expired = cal.oauth_expires_at && new Date(cal.oauth_expires_at) < new Date(Date.now() + 60_000);

    if (expired && cal.oauth_refresh_token) {
        const refreshToken = safeDecrypt(cal.oauth_refresh_token);
        token = (await refreshGoogleToken(refreshToken)) || '';
        if (token) {
            const expiresAt = new Date(Date.now() + 3600_000).toISOString();
            const encrypted = encrypt(token);
            // Update ALL sibling calendars from the same Google account
            // so they don't each trigger their own refresh.
            const query = (supabase.from('external_calendars') as any)
                .update({ oauth_access_token: encrypted, oauth_expires_at: expiresAt });
            if (cal.account_label) {
                await query
                    .eq('employee_id', cal.employee_id)
                    .eq('provider_type', 'google')
                    .eq('account_label', cal.account_label);
            } else {
                await query.eq('id', cal.id);
            }
        }
    }

    return token ? { token, calId: cal.external_calendar_id || 'primary' } : null;
}

// GET /api/google-calendar/events?calendarId=...&from=...&to=...
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

        const auth = await getValidToken(admin, cal);
        if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const params = new URLSearchParams({
            singleEvents: 'true',
            orderBy: 'startTime',
            ...(from && { timeMin: new Date(from).toISOString() }),
            ...(to && { timeMax: new Date(to).toISOString() }),
        });

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calId)}/events?${params}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
        });

        if (!res.ok) return NextResponse.json({ error: 'Google API error', status: res.status }, { status: 502 });

        const data = await res.json();
        const events = (data.items || []).map((ev: any) => {
            const allDay = !!ev.start?.date;
            const start = allDay ? ev.start.date + 'T00:00:00' : ev.start?.dateTime;
            const end = allDay ? (ev.end?.date || ev.start?.date) + 'T23:59:59' : ev.end?.dateTime;
            const meetingUrl = ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;

            return {
                id: `ext-${calendarId}-${ev.id}`,
                uid: ev.id,
                externalCalendarId: calendarId,
                title: ev.summary || '(Kein Titel)',
                start_at: new Date(start).toISOString(),
                end_at: new Date(end).toISOString(),
                all_day: allDay,
                color: cal?.color || '#3B82F6',
                calendarName: cal?.name || 'Google Kalender',
                description: ev.description,
                location: ev.location,
                meeting_url: meetingUrl,
            };
        });

        return NextResponse.json({ events });
    } catch (e) {
        return apiError(e);
    }
}

function buildGoogleEventBody(event: any): any {
    const body: any = {
        summary: event.title,
        description: event.description,
        location: event.location,
        start: event.all_day
            ? { date: event.start_at.slice(0, 10) }
            : { dateTime: event.start_at, timeZone: 'Europe/Vienna' },
        end: event.all_day
            ? { date: event.end_at.slice(0, 10) }
            : { dateTime: event.end_at, timeZone: 'Europe/Vienna' },
    };
    if (event.attendees?.length) {
        body.attendees = event.attendees.map((a: any) => ({ email: a.email, displayName: a.name }));
    }
    // hangoutLink is read-only — Meeting-Link kommt in die Description als sichtbarer Hinweis.
    if (event.meeting_url) {
        const note = `Meeting: ${event.meeting_url}`;
        body.description = body.description ? `${body.description}\n\n${note}` : note;
    }
    return body;
}

// POST /api/google-calendar/events — create event on Google Calendar
export async function POST(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const body = await request.json();
        const { calendarId, event } = body;

        if (!calendarId || !event) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        const cal = await loadOwnedCalendar(admin, calendarId, caller);

        const auth = await getValidToken(admin, cal);
        if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calId)}/events`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(buildGoogleEventBody(event)),
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Google API error' }, { status: 502 });
        }

        const created = await res.json();
        return NextResponse.json({ success: true, googleEventId: created.id });
    } catch (e) {
        return apiError(e);
    }
}

// PATCH /api/google-calendar/events — update existing event
// Body: { calendarId, googleEventId, event }
export async function PATCH(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const body = await request.json();
        const { calendarId, googleEventId, event } = body;

        if (!calendarId || !googleEventId || !event) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        const cal = await loadOwnedCalendar(admin, calendarId, caller);

        const auth = await getValidToken(admin, cal);
        if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calId)}/events/${encodeURIComponent(googleEventId)}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(buildGoogleEventBody(event)),
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Google API error' }, { status: 502 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return apiError(e);
    }
}

// DELETE /api/google-calendar/events?calendarId=...&googleEventId=...
export async function DELETE(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const sp = request.nextUrl.searchParams;
        const calendarId = sp.get('calendarId');
        const googleEventId = sp.get('googleEventId');

        if (!calendarId || !googleEventId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        const cal = await loadOwnedCalendar(admin, calendarId, caller);

        const auth = await getValidToken(admin, cal);
        if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calId)}/events/${encodeURIComponent(googleEventId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${auth.token}` },
        });

        // 410 = already deleted → idempotent OK
        if (!res.ok && res.status !== 410 && res.status !== 404) {
            return NextResponse.json({ error: `Google DELETE failed: HTTP ${res.status}` }, { status: 502 });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return apiError(e);
    }
}
