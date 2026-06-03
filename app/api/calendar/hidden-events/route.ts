import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, requireUser, apiError } from '../../../utils/apiAuth';

// Alle Handler: Identität kommt aus der Session (requireUser), NICHT aus dem
// Request-Body/Query. Damit ist kein Cross-Tenant-Schreiben/Lesen/Löschen möglich.

// POST /api/calendar/hidden-events — hide an event
// Body: { eventId? } oder { externalEventUid, externalCalendarId }
export async function POST(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        if (!caller.employeeId || !caller.organizationId) {
            return NextResponse.json({ error: 'Kein Mitarbeiter-Profil.' }, { status: 403 });
        }

        const { eventId, externalEventUid, externalCalendarId } = await request.json();

        const { data, error } = await admin.from('hidden_calendar_events').insert({
            organization_id: caller.organizationId,
            employee_id: caller.employeeId,
            event_id: eventId || null,
            external_event_uid: externalEventUid || null,
            external_calendar_id: externalCalendarId || null,
        }).select().single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, id: data.id });
    } catch (e) {
        return apiError(e);
    }
}

// DELETE /api/calendar/hidden-events?id=...  (nur eigene Einträge)
export async function DELETE(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        if (!caller.employeeId) return NextResponse.json({ error: 'Kein Mitarbeiter-Profil.' }, { status: 403 });

        // Org + Employee einschränken → fremde Einträge sind nicht löschbar.
        await admin.from('hidden_calendar_events')
            .delete()
            .eq('id', id)
            .eq('organization_id', caller.organizationId)
            .eq('employee_id', caller.employeeId);
        return NextResponse.json({ success: true });
    } catch (e) {
        return apiError(e);
    }
}

// GET /api/calendar/hidden-events  (nur eigene Einträge)
export async function GET(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        if (!caller.employeeId || !caller.organizationId) return NextResponse.json({ hidden: [] });

        const { data } = await admin.from('hidden_calendar_events')
            .select('*')
            .eq('employee_id', caller.employeeId)
            .eq('organization_id', caller.organizationId);

        return NextResponse.json({ hidden: data || [] });
    } catch (e) {
        return apiError(e);
    }
}
