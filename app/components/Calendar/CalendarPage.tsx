'use client';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, AlertCircle, X } from 'lucide-react';
import { Employee, CalendarEvent, CalendarView } from '../../types';
import { supabase } from '../../supabaseClient';
import { useCalendarData } from '../../context/CalendarDataContext';
import { getWeekDays, isSameDay } from './views/WeekView';
import { getEmployeeColor } from './CalendarSidebar';
import CalendarSidebar from './CalendarSidebar';
import EventModal, { ExternalEditContext } from './EventModal';
import EventDetailModal from './EventDetailModal';
import WeekView from './views/WeekView';
import DayView from './views/DayView';
import MonthView from './views/MonthView';
import ViewSwitcher from '../UI/ViewSwitcher';
import PeriodNavigator from '../UI/PeriodNavigator';

interface Props {
    employees: Employee[];
    currentUser?: Employee;
}

const VIEW_LABELS: Record<CalendarView, string> = { day: 'Tag', week: 'Woche', month: 'Monat' };

export default function CalendarPage({ employees, currentUser }: Props) {
    if (!currentUser) return (
        <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Lade Kalender...</div>
    );

    const organizationId = (currentUser as any).organization_id as string;

    const {
        setRange,
        visibleEmployeeIds, setVisibleEmployeeIds,
        ownEvents, teamEvents,
        externalCalendars, externalEvents, teamExternalEvents,
        hiddenEventIds, hiddenExternalKeys,
        syncErrors,
        refreshExternals,
        refreshExternalCalendars,
        hideEventLocally, hideExternalEvent,
    } = useCalendarData();

    const [view, setView] = useState<CalendarView>('week');
    const [anchor, setAnchor] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [showModal, setShowModal] = useState(false);
    const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
    const [externalEditCtx, setExternalEditCtx] = useState<ExternalEditContext | null>(null);
    const [modalDefaultStart, setModalDefaultStart] = useState<Date | undefined>();
    const [modalDefaultEnd, setModalDefaultEnd] = useState<Date | undefined>();
    const [modalAllDay, setModalAllDay] = useState(false);
    const [detailEvent, setDetailEvent] = useState<any | null>(null);

    const [showOwnEvents, setShowOwnEvents] = useState(true);
    const [dismissedErrors, setDismissedErrors] = useState(false);

    useEffect(() => {
        if (syncErrors.length > 0) setDismissedErrors(false);
    }, [syncErrors]);

    const weekDays = getWeekDays(anchor);

    // Push range to provider whenever view/anchor changes
    useEffect(() => {
        let from: Date, to: Date;
        if (view === 'day') {
            from = new Date(anchor); from.setHours(0, 0, 0, 0);
            to = new Date(anchor); to.setHours(23, 59, 59, 999);
        } else if (view === 'week') {
            const days = getWeekDays(anchor);
            from = new Date(days[0]); from.setHours(0, 0, 0, 0);
            to = new Date(days[6]); to.setHours(23, 59, 59, 999);
        } else {
            from = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
            to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
        }
        setRange(from, to);
    }, [view, anchor, setRange]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            if (showModal) return;
            switch (e.key) {
                case 'T': case 't': goToday(); break;
                case 'W': case 'w': setView('week'); break;
                case 'M': case 'm': setView('month'); break;
                case 'D': case 'd': setView('day'); break;
                case 'ArrowLeft': e.preventDefault(); navigate(-1); break;
                case 'ArrowRight': e.preventDefault(); navigate(1); break;
                case 'N': case 'n': e.preventDefault(); openCreate(); break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showModal, view]);

    const navigate = (dir: -1 | 1) => {
        setAnchor(prev => {
            const d = new Date(prev);
            if (view === 'day') d.setDate(d.getDate() + dir);
            if (view === 'week') d.setDate(d.getDate() + dir * 7);
            if (view === 'month') d.setMonth(d.getMonth() + dir);
            return d;
        });
    };

    const goToday = () => { setAnchor(new Date()); setSelectedDate(new Date()); };

    const handleSelectDate = (d: Date) => {
        setSelectedDate(d);
        setAnchor(d);
        setView('day');
    };

    const headerTitle = () => {
        if (view === 'day') return anchor.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (view === 'week') {
            const d = weekDays;
            if (d[0].getMonth() === d[6].getMonth())
                return `${d[0].toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })}`;
            return `${d[0].toLocaleDateString('de-AT', { month: 'short' })} – ${d[6].toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })}`;
        }
        return anchor.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
    };

    const openCreate = (start?: Date, end?: Date, allDay?: boolean) => {
        setEditEvent(null);
        setExternalEditCtx(null);
        setModalDefaultStart(start);
        setModalDefaultEnd(end);
        setModalAllDay(allDay ?? false);
        setShowModal(true);
    };

    const openEdit = (ev: CalendarEvent) => {
        setEditEvent(ev);
        setExternalEditCtx(null);
        setModalDefaultStart(undefined);
        setShowModal(true);
    };

    const openDetail = (ev: any) => {
        setDetailEvent(ev);
    };

    // Externes Event (Google/Outlook/CalDAV) direkt bearbeiten — sofern der
    // zugehörige Kalender beschreibbar ist. Schreibt direkt zum Provider zurück.
    const openExternalEdit = (ev: any) => {
        const cal = externalCalendars.find(c => c.id === ev.externalCalendarId);
        if (!cal || !cal.is_writable || !ev.uid) return;
        const synthetic: CalendarEvent = {
            id: ev.id,
            organization_id: organizationId,
            employee_id: currentUser.id,
            title: ev.title,
            description: ev.description ?? null,
            location: ev.location ?? null,
            start_at: ev.start_at,
            end_at: ev.end_at,
            all_day: ev.all_day,
            color: 'blue',
            attendees: [],
            visibility: 'public',
            meeting_url: ev.meeting_url ?? null,
            source_external_id: ev.uid,
            target_calendar_id: cal.id,
        } as CalendarEvent;
        setEditEvent(synthetic);
        setExternalEditCtx({ calendar: cal, uid: ev.uid });
        setDetailEvent(null);
        setModalDefaultStart(undefined);
        setShowModal(true);
    };

    const onMonthDayClick = (d: Date) => { openCreate(d, undefined, true); };

    const toggleEmployee = (id: string) => {
        setVisibleEmployeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleExternal = async (id: string) => {
        const cal = externalCalendars.find(c => c.id === id);
        if (!cal) return;
        await supabase.from('external_calendars').update({ is_visible: !cal.is_visible }).eq('id', id);
        // Realtime subscription on external_calendars will sync state automatically.
    };

    // Filter events
    const filteredOwnEvents = showOwnEvents
        ? ownEvents.filter(e => !hiddenEventIds.has(e.id))
        : [];

    // Vela-Kalender-Freigabe des Besitzers respektieren (default: erlaubt).
    const teamShareDenied = new Set(
        employees.filter(e => e.calendar_shared_with_team === false).map(e => e.id),
    );
    const coloredTeamEvents = teamEvents
        .filter(e => !teamShareDenied.has(e.employee_id))
        .map(e => ({ ...e, color: getEmployeeColor(e.employee_id) as any }));

    // Dedup intern ↔ extern: ein in Vela gespeicherter & nach extern gespiegelter
    // Termin kommt vom Provider zurück — wir zeigen nur die interne Kopie.
    const internalExtIds = new Set(
        [...filteredOwnEvents, ...coloredTeamEvents]
            .map(e => e.source_external_id)
            .filter(Boolean) as string[],
    );

    const visibleExternal = externalEvents.filter(e => {
        if (!externalCalendars.find(c => c.id === e.externalCalendarId && c.is_visible)) return false;
        if (e.uid && internalExtIds.has(e.uid)) return false;
        const key = `${e.uid || ''}|${e.externalCalendarId}`;
        if (hiddenExternalKeys.has(key)) return false;
        return true;
    });

    // Freigegebene externe Termine aktivierter Kollegen — pro Mitarbeiter eingefärbt,
    // Herkunfts-Kalender bewusst nicht differenziert.
    const visibleTeamExternal = teamExternalEvents
        .filter(e => !(e.uid && internalExtIds.has(e.uid)))
        .filter(e => !hiddenExternalKeys.has(`${e.uid || ''}|${e.externalCalendarId}`))
        .map(e => ({ ...e, color: getEmployeeColor(e.ownerEmployeeId || '') as any }));

    const allExternalEvents = [...visibleExternal, ...visibleTeamExternal];

    return (
        <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-app)' }}>
            <CalendarSidebar
                currentUser={currentUser}
                employees={employees}
                organizationId={organizationId}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                visibleEmployeeIds={visibleEmployeeIds}
                onToggleEmployee={toggleEmployee}
                externalCalendars={externalCalendars}
                onToggleExternal={toggleExternal}
                onRefreshExternals={refreshExternalCalendars}
                ownEvents={ownEvents}
                showOwnEvents={showOwnEvents}
                onToggleOwnEvents={() => setShowOwnEvents(x => !x)}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Sync error banner */}
                {syncErrors.length > 0 && !dismissedErrors && (
                    <div className="px-6 py-2 flex items-start gap-3 shrink-0" style={{ background: 'var(--color-danger-subtle)', borderBottom: '1px solid var(--color-danger-border)' }}>
                        <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-danger-text)' }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold" style={{ color: 'var(--color-danger-text)' }}>
                                {syncErrors.length === 1 ? 'Ein Kalender konnte nicht synchronisiert werden:' : `${syncErrors.length} Kalender konnten nicht synchronisiert werden:`}
                            </p>
                            <ul className="text-[11px] mt-0.5 space-y-1" style={{ color: 'var(--color-danger-text)' }}>
                                {syncErrors.slice(0, 3).map((e, i) => {
                                    const reauthUrl = e.isAuthError
                                        ? (e.providerType === 'google'
                                            ? `/api/auth/google-calendar?employeeId=${currentUser.id}&organizationId=${organizationId}&name=${encodeURIComponent(e.calendarName)}&returnUrl=/kalender`
                                            : (e.providerType === 'outlook' || e.providerType === 'teams')
                                                ? `/api/auth/microsoft?employeeId=${currentUser.id}&organizationId=${organizationId}&name=${encodeURIComponent(e.calendarName)}&returnUrl=/kalender`
                                                : null)
                                        : null;
                                    return (
                                        <li key={i} className="flex items-start gap-2 flex-wrap">
                                            <span><span className="font-semibold">{e.calendarName}:</span> {e.message}</span>
                                            {reauthUrl && (
                                                <a href={reauthUrl} className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'var(--color-danger)', color: '#fff' }}>
                                                    Erneut anmelden
                                                </a>
                                            )}
                                            {e.isAuthError && !reauthUrl && e.providerType !== 'ical' && (
                                                <a
                                                    href="/einstellungen?section=kalender"
                                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                                                    style={{ background: 'var(--color-danger)', color: '#fff' }}
                                                >
                                                    Passwort aktualisieren
                                                </a>
                                            )}
                                        </li>
                                    );
                                })}
                                {syncErrors.length > 3 && <li className="italic">…und {syncErrors.length - 3} weitere</li>}
                            </ul>
                        </div>
                        <button onClick={() => setDismissedErrors(true)} className="p-1 rounded-lg shrink-0" style={{ color: 'var(--color-danger-text)' }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{headerTitle()}</h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>Kalender</p>
                    </div>

                    <ViewSwitcher<CalendarView>
                        options={[
                            { value: 'day',   label: 'Tag' },
                            { value: 'week',  label: 'Woche' },
                            { value: 'month', label: 'Monat' },
                        ]}
                        value={view}
                        onChange={setView}
                    />

                    <PeriodNavigator
                        onPrev={() => navigate(-1)}
                        onNext={() => navigate(1)}
                        centerLabel="Heute"
                        onCenterClick={goToday}
                        centerTitle="Zu heute springen"
                    />

                    <button onClick={() => openCreate()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                        <Plus size={14} /> Neuer Termin
                    </button>
                </div>

                <div className="flex-1 overflow-hidden">
                    {view === 'week' && (
                        <WeekView
                            days={weekDays}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={filteredOwnEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={allExternalEvents}
                            onSlotClick={d => openCreate(d, new Date(d.getTime() + 60 * 60 * 1000))}
                            onEventClick={openEdit}
                            onDetailClick={openDetail}
                            onHideExternal={hideExternalEvent}
                        />
                    )}
                    {view === 'day' && (
                        <DayView
                            day={anchor}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={filteredOwnEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={allExternalEvents}
                            onSlotClick={d => openCreate(d, new Date(d.getTime() + 60 * 60 * 1000))}
                            onEventClick={openEdit}
                            onDetailClick={openDetail}
                            onHideExternal={hideExternalEvent}
                        />
                    )}
                    {view === 'month' && (
                        <MonthView
                            anchor={anchor}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={filteredOwnEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={allExternalEvents}
                            onDayClick={onMonthDayClick}
                            onEventClick={openEdit}
                            onDetailClick={openDetail}
                        />
                    )}
                </div>
            </div>

            {showModal && (
                <EventModal
                    event={editEvent}
                    defaultStart={modalDefaultStart}
                    defaultEnd={modalDefaultEnd}
                    defaultAllDay={modalAllDay}
                    currentUser={currentUser}
                    employees={employees}
                    organizationId={organizationId}
                    externalCalendars={externalCalendars}
                    externalEdit={externalEditCtx}
                    onClose={() => { setShowModal(false); setExternalEditCtx(null); }}
                    onSaved={() => { if (externalEditCtx) refreshExternals(); /* sonst: realtime */ }}
                    onDeleted={() => { if (externalEditCtx) refreshExternals(); /* sonst: realtime */ }}
                    onHidden={hideEventLocally}
                />
            )}

            {detailEvent && (
                <EventDetailModal
                    event={detailEvent}
                    employees={employees}
                    isExternal={!!detailEvent.externalCalendarId || !!detailEvent.uid}
                    canEdit={!!externalCalendars.find(c => c.id === detailEvent.externalCalendarId && c.is_writable)}
                    onClose={() => setDetailEvent(null)}
                    onEdit={() => openExternalEdit(detailEvent)}
                    onHideExternal={hideExternalEvent}
                />
            )}
        </div>
    );
}
