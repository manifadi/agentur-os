import { NextRequest, NextResponse } from 'next/server';
import { serviceClient, requireUser, apiError } from '../../../utils/apiAuth';
import { fetchCalendarEventsServer } from '../../../utils/calendarServerFetch';
import { ParsedExternalEvent } from '../../../types';

/**
 * GET /api/calendar/team-external-events?employeeIds=a,b,c&from=ISO&to=ISO
 *
 * Liefert die für das Team freigegebenen EXTERNEN Termine der angefragten
 * Kollegen (shared_with_team = true). Läuft mit Service-Role, nutzt die Tokens
 * der jeweiligen Besitzer — aber NUR für Mitarbeiter derselben Organisation wie
 * der Aufrufer, und nur für Kalender, die der Besitzer explizit freigegeben hat.
 *
 * Die Kalender-Herkunft wird bewusst NICHT zurückgegeben (kein calendarName,
 * keine Farbe) — der Client färbt die Termine pro Mitarbeiter. Der Kollege sieht
 * also "die Termine von X", nicht "aus welchem Kalender genau".
 */
export async function GET(request: NextRequest) {
    try {
        const admin = serviceClient();
        const caller = await requireUser(request, admin);
        if (!caller.organizationId) return NextResponse.json({ events: [] });

        const sp = request.nextUrl.searchParams;
        const ids = (sp.get('employeeIds') || '').split(',').map(s => s.trim()).filter(Boolean);
        const from = sp.get('from');
        const to = sp.get('to');
        if (ids.length === 0 || !from || !to) return NextResponse.json({ events: [] });

        const fromDate = new Date(from);
        const toDate = new Date(to);

        // Nur freigegebene Kalender von Mitarbeitern DERSELBEN Org laden.
        const { data: cals } = await admin
            .from('external_calendars')
            .select('*')
            .in('employee_id', ids)
            .eq('organization_id', caller.organizationId)
            .eq('shared_with_team', true);

        const calendars = (cals || []) as any[];
        if (calendars.length === 0) return NextResponse.json({ events: [] });

        const results = await Promise.all(
            calendars.map(async cal => {
                const events = await fetchCalendarEventsServer(admin, cal, fromDate, toDate);
                // Herkunft entfernen, Besitzer setzen → Client färbt pro Mitarbeiter.
                return events.map(e => ({
                    ...e,
                    ownerEmployeeId: cal.employee_id,
                    calendarName: '',
                    color: '',
                })) as ParsedExternalEvent[];
            }),
        );

        return NextResponse.json({ events: results.flat() });
    } catch (e) {
        return apiError(e);
    }
}
