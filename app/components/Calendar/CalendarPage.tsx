'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, AlertCircle, X } from 'lucide-react';
import { Employee, CalendarEvent, ExternalCalendar, ParsedExternalEvent, CalendarView, HiddenCalendarEvent } from '../../types';
import { supabase } from '../../supabaseClient';
import { useApp } from '../../context/AppContext';
import { getWeekDays, isSameDay } from './views/WeekView';
import { getEmployeeColor } from './CalendarSidebar';
import CalendarSidebar from './CalendarSidebar';
import EventModal from './EventModal';
import WeekView from './views/WeekView';
import DayView from './views/DayView';
import MonthView from './views/MonthView';
import { parseICalText } from '../../utils/icalParser';

interface Props {
    employees: Employee[];
    currentUser?: Employee;
}

const VIEW_LABELS: Record<CalendarView, string> = { day: 'Tag', week: 'Woche', month: 'Monat' };

export default function CalendarPage({ employees, currentUser }: Props) {
    const { agencySettings } = useApp();
    if (!currentUser) return (
        <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Lade Kalender...</div>
    );

    const organizationId = (currentUser as any).organization_id as string;

    const [view, setView] = useState<CalendarView>('week');
    const [anchor, setAnchor] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [showModal, setShowModal] = useState(false);
    const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
    const [modalDefaultStart, setModalDefaultStart] = useState<Date | undefined>();
    const [modalDefaultEnd, setModalDefaultEnd] = useState<Date | undefined>();
    const [modalAllDay, setModalAllDay] = useState(false);

    const [ownEvents, setOwnEvents] = useState<CalendarEvent[]>([]);
    const [teamEvents, setTeamEvents] = useState<CalendarEvent[]>([]);
    const [externalCalendars, setExternals] = useState<ExternalCalendar[]>([]);
    const [externalEvents, setExternalEvents] = useState<ParsedExternalEvent[]>([]);
    const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[]>([]);
    const [showOwnEvents, setShowOwnEvents] = useState(true);

    // Hidden events
    const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(new Set());
    const [hiddenExternalKeys, setHiddenExternalKeys] = useState<Set<string>>(new Set()); // uid|calendarId

    // Sync errors from external calendars
    const [syncErrors, setSyncErrors] = useState<{ calendarName: string; message: string }[]>([]);
    const [dismissedErrors, setDismissedErrors] = useState(false);

    // Reset dismissed state when new errors appear
    useEffect(() => {
        if (syncErrors.length > 0) setDismissedErrors(false);
    }, [syncErrors]);

    const weekDays = getWeekDays(anchor);

    const getDateRange = useCallback(() => {
        if (view === 'day') {
            const s = new Date(anchor); s.setHours(0, 0, 0, 0);
            const e = new Date(anchor); e.setHours(23, 59, 59, 999);
            return { from: s, to: e };
        }
        if (view === 'week') {
            const days = getWeekDays(anchor);
            const s = new Date(days[0]); s.setHours(0, 0, 0, 0);
            const e = new Date(days[6]); e.setHours(23, 59, 59, 999);
            return { from: s, to: e };
        }
        const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
        const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
        return { from: s, to: e };
    }, [view, anchor]);

    const fetchOwnEvents = useCallback(async () => {
        const { from, to } = getDateRange();
        const { data } = await supabase.from('calendar_events')
            .select('*')
            .eq('employee_id', currentUser.id)
            .gte('start_at', from.toISOString())
            .lte('start_at', to.toISOString())
            .order('start_at');
        if (data) setOwnEvents(data as CalendarEvent[]);
    }, [currentUser.id, getDateRange]);

    const fetchTeamEvents = useCallback(async () => {
        if (visibleEmployeeIds.length === 0) { setTeamEvents([]); return; }
        const { from, to } = getDateRange();
        // Only fetch public events from team members
        const { data } = await supabase.from('calendar_events')
            .select('*, employees(id, name, initials, avatar_url)')
            .in('employee_id', visibleEmployeeIds)
            .eq('visibility', 'public')
            .gte('start_at', from.toISOString())
            .lte('start_at', to.toISOString())
            .order('start_at');
        if (data) setTeamEvents(data as CalendarEvent[]);
    }, [visibleEmployeeIds, getDateRange]);

    const fetchExternalCalendars = useCallback(async () => {
        const { data } = await supabase.from('external_calendars')
            .select('*')
            .eq('employee_id', currentUser.id)
            .order('created_at');
        if (data) setExternals(data as ExternalCalendar[]);
    }, [currentUser.id]);

    const fetchExternalEvents = useCallback(async () => {
        const visibleCals = externalCalendars.filter(c => c.is_visible);
        if (visibleCals.length === 0) { setExternalEvents([]); setSyncErrors([]); return; }

        const { from, to } = getDateRange();
        const allParsed: ParsedExternalEvent[] = [];
        const errors: { calendarName: string; message: string }[] = [];

        const handleResponse = async (cal: ExternalCalendar, res: Response): Promise<any | null> => {
            if (res.ok) return res.json();
            let msg = `HTTP ${res.status}`;
            try {
                const data = await res.json();
                if (data.error) msg = data.error;
            } catch { /* ignore */ }
            errors.push({ calendarName: cal.name, message: msg });
            return null;
        };

        await Promise.all(visibleCals.map(async cal => {
            try {
                if (cal.provider_type === 'google') {
                    const params = new URLSearchParams({ calendarId: cal.id, from: from.toISOString(), to: to.toISOString() });
                    const res = await fetch(`/api/google-calendar/events?${params}`);
                    const data = await handleResponse(cal, res);
                    if (data) allParsed.push(...(data.events || []));
                } else if (cal.provider_type === 'outlook' || cal.provider_type === 'teams') {
                    const params = new URLSearchParams({ calendarId: cal.id, from: from.toISOString(), to: to.toISOString() });
                    const res = await fetch(`/api/microsoft/events?${params}`);
                    const data = await handleResponse(cal, res);
                    if (data) allParsed.push(...(data.events || []));
                } else if ((cal.provider_type === 'troi' || cal.provider_type === 'apple') && cal.caldav_username) {
                    const params = new URLSearchParams({ calendarId: cal.id, from: from.toISOString(), to: to.toISOString() });
                    const res = await fetch(`/api/caldav/events?${params}`);
                    const data = await handleResponse(cal, res);
                    if (data?.ical) {
                        const parsed = parseICalText(data.ical, cal.id, cal.name, cal.color);
                        allParsed.push(...parsed);
                    }
                } else {
                    if (!cal.url) return;
                    const proxied = `/api/ical-proxy?url=${encodeURIComponent(cal.url)}`;
                    const res = await fetch(proxied);
                    if (!res.ok) {
                        errors.push({ calendarName: cal.name, message: `iCal-Feed nicht erreichbar (${res.status})` });
                        return;
                    }
                    const text = await res.text();
                    const parsed = parseICalText(text, cal.id, cal.name, cal.color);
                    allParsed.push(...parsed);
                }
            } catch (err: any) {
                errors.push({ calendarName: cal.name, message: err?.message || 'Netzwerkfehler' });
                console.warn('[CalendarPage] Failed to fetch external cal:', cal.name, err);
            }
        }));

        setExternalEvents(allParsed);
        setSyncErrors(errors);
    }, [externalCalendars, getDateRange]);

    const fetchHiddenEvents = useCallback(async () => {
        const res = await fetch(`/api/calendar/hidden-events?employeeId=${currentUser.id}&organizationId=${organizationId}`);
        if (!res.ok) return;
        const data = await res.json();
        const hidden: HiddenCalendarEvent[] = data.hidden || [];
        const eventIds = new Set(hidden.filter(h => h.event_id).map(h => h.event_id!));
        const externalKeys = new Set(hidden.filter(h => h.external_event_uid && h.external_calendar_id).map(h => `${h.external_event_uid}|${h.external_calendar_id}`));
        setHiddenEventIds(eventIds);
        setHiddenExternalKeys(externalKeys);
    }, [currentUser.id, organizationId]);

    useEffect(() => { fetchOwnEvents(); }, [fetchOwnEvents]);
    useEffect(() => { fetchTeamEvents(); }, [fetchTeamEvents]);
    useEffect(() => { fetchExternalCalendars(); }, [fetchExternalCalendars]);
    useEffect(() => { fetchExternalEvents(); }, [fetchExternalEvents]);
    useEffect(() => { fetchHiddenEvents(); }, [fetchHiddenEvents]);

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
        setModalDefaultStart(start);
        setModalDefaultEnd(end);
        setModalAllDay(allDay ?? false);
        setShowModal(true);
    };

    const openEdit = (ev: CalendarEvent) => {
        setEditEvent(ev);
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
        fetchExternalCalendars();
    };

    const handleHideEvent = (eventId: string) => {
        setHiddenEventIds(prev => new Set(Array.from(prev).concat(eventId)));
    };

    const handleHideExternal = async (uid: string, externalCalendarId: string) => {
        const key = `${uid}|${externalCalendarId}`;
        setHiddenExternalKeys(prev => new Set(Array.from(prev).concat(key)));
        // Persist to DB
        const cal = externalCalendars.find(c => c.id === externalCalendarId);
        await fetch('/api/calendar/hidden-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: currentUser.id, organizationId, externalEventUid: uid, externalCalendarId }),
        });
    };

    // Filter events
    const filteredOwnEvents = showOwnEvents
        ? ownEvents.filter(e => !hiddenEventIds.has(e.id))
        : [];

    const visibleExternal = externalEvents.filter(e => {
        if (!externalCalendars.find(c => c.id === e.externalCalendarId && c.is_visible)) return false;
        const key = `${e.uid || ''}|${e.externalCalendarId}`;
        if (hiddenExternalKeys.has(key)) return false;
        return true;
    });

    const coloredTeamEvents = teamEvents.map(e => ({
        ...e,
        color: getEmployeeColor(e.employee_id) as any,
    }));

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
                onRefreshExternals={fetchExternalCalendars}
                ownEvents={ownEvents}
                showOwnEvents={showOwnEvents}
                onToggleOwnEvents={() => setShowOwnEvents(x => !x)}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Sync error banner */}
                {syncErrors.length > 0 && !dismissedErrors && (
                    <div className="px-6 py-2 flex items-start gap-3 shrink-0" style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                        <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: '#DC2626' }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold" style={{ color: '#991B1B' }}>
                                {syncErrors.length === 1 ? 'Ein Kalender konnte nicht synchronisiert werden:' : `${syncErrors.length} Kalender konnten nicht synchronisiert werden:`}
                            </p>
                            <ul className="text-[11px] mt-0.5 space-y-0.5" style={{ color: '#7F1D1D' }}>
                                {syncErrors.slice(0, 3).map((e, i) => (
                                    <li key={i}><span className="font-semibold">{e.calendarName}:</span> {e.message}</li>
                                ))}
                                {syncErrors.length > 3 && <li className="italic">…und {syncErrors.length - 3} weitere</li>}
                            </ul>
                        </div>
                        <button onClick={() => setDismissedErrors(true)} className="p-1 rounded-lg shrink-0" style={{ color: '#991B1B' }}>
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

                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
                        {(['day', 'week', 'month'] as CalendarView[]).map(v => (
                            <button key={v} onClick={() => setView(v)}
                                className="px-3 py-1.5 text-xs font-semibold transition-all"
                                style={view === v ? { background: 'var(--accent)', color: 'var(--accent-text)' } : { color: 'var(--text-muted)' }}>
                                {VIEW_LABELS[v]}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={() => navigate(-1)} className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                        ><ChevronLeft size={18} /></button>

                        <button onClick={goToday} className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                        >Heute</button>

                        <button onClick={() => navigate(1)} className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                        ><ChevronRight size={18} /></button>
                    </div>

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
                            externalEvents={visibleExternal}
                            onSlotClick={d => openCreate(d, new Date(d.getTime() + 60 * 60 * 1000))}
                            onEventClick={openEdit}
                            onHideExternal={handleHideExternal}
                        />
                    )}
                    {view === 'day' && (
                        <DayView
                            day={anchor}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={filteredOwnEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={visibleExternal}
                            onSlotClick={d => openCreate(d, new Date(d.getTime() + 60 * 60 * 1000))}
                            onEventClick={openEdit}
                            onHideExternal={handleHideExternal}
                        />
                    )}
                    {view === 'month' && (
                        <MonthView
                            anchor={anchor}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={filteredOwnEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={visibleExternal}
                            onDayClick={onMonthDayClick}
                            onEventClick={openEdit}
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
                    onClose={() => setShowModal(false)}
                    onSaved={() => { fetchOwnEvents(); fetchTeamEvents(); }}
                    onDeleted={() => { fetchOwnEvents(); fetchTeamEvents(); }}
                    onHidden={handleHideEvent}
                />
            )}
        </div>
    );
}
