import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lkyqohkdxmchrjicvurn.supabase.co';

// POST /api/calendar/hidden-events — hide an event
// Body: { employeeId, organizationId, eventId? } or { employeeId, organizationId, externalEventUid, externalCalendarId }
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { employeeId, organizationId, eventId, externalEventUid, externalCalendarId } = body;

    if (!employeeId || !organizationId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await supabase.from('hidden_calendar_events').insert({
        organization_id: organizationId,
        employee_id: employeeId,
        event_id: eventId || null,
        external_event_uid: externalEventUid || null,
        external_calendar_id: externalCalendarId || null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id });
}

// DELETE /api/calendar/hidden-events?id=...
export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await supabase.from('hidden_calendar_events').delete().eq('id', id);
    return NextResponse.json({ success: true });
}

// GET /api/calendar/hidden-events?employeeId=...&organizationId=...
export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams;
    const employeeId = sp.get('employeeId');
    const organizationId = sp.get('organizationId');

    if (!employeeId || !organizationId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await supabase.from('hidden_calendar_events')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('organization_id', organizationId);

    return NextResponse.json({ hidden: data || [] });
}
