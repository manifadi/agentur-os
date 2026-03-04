'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';
import { Employee, CalendarEvent, ExternalCalendar, ParsedExternalEvent, CalendarView } from '../../types';
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

    // ── View state ──────────────────────────────────────────────────
    const [view, setView] = useState<CalendarView>('week');
    const [anchor, setAnchor] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // ── Modal state ─────────────────────────────────────────────────
    const [showModal, setShowModal] = useState(false);
    const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
    const [modalDefaultStart, setModalDefaultStart] = useState<Date | undefined>();
    const [modalDefaultEnd, setModalDefaultEnd] = useState<Date | undefined>();
    const [modalAllDay, setModalAllDay] = useState(false);

    // ── Data ────────────────────────────────────────────────────────
    const [ownEvents, setOwnEvents] = useState<CalendarEvent[]>([]);
    const [teamEvents, setTeamEvents] = useState<CalendarEvent[]>([]);
    const [externalCalendars, setExternals] = useState<ExternalCalendar[]>([]);
    const [externalEvents, setExternalEvents] = useState<ParsedExternalEvent[]>([]);
    const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[]>([]);

    // ── Helpers ─────────────────────────────────────────────────────
    const weekDays = getWeekDays(anchor);
    const today = new Date();

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
        // month
        const s = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
        const e = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
        return { from: s, to: e };
    }, [view, anchor]);

    // ── Fetch own events ─────────────────────────────────────────────
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

    // ── Fetch team events ────────────────────────────────────────────
    const fetchTeamEvents = useCallback(async () => {
        if (visibleEmployeeIds.length === 0) { setTeamEvents([]); return; }
        const { from, to } = getDateRange();
        const { data } = await supabase.from('calendar_events')
            .select('*, employees(id, name, initials, avatar_url)')
            .in('employee_id', visibleEmployeeIds)
            .gte('start_at', from.toISOString())
            .lte('start_at', to.toISOString())
            .order('start_at');
        if (data) setTeamEvents(data as CalendarEvent[]);
    }, [visibleEmployeeIds, getDateRange]);

    // ── Fetch external calendars ─────────────────────────────────────
    const fetchExternalCalendars = useCallback(async () => {
        const { data } = await supabase.from('external_calendars')
            .select('*')
            .eq('employee_id', currentUser.id)
            .order('created_at');
        if (data) setExternals(data as ExternalCalendar[]);
    }, [currentUser.id]);

    // ── Fetch & parse iCal feeds ──────────────────────────────────────
    const fetchExternalEvents = useCallback(async () => {
        const visibleCals = externalCalendars.filter(c => c.is_visible);
        if (visibleCals.length === 0) { setExternalEvents([]); return; }

        const allParsed: ParsedExternalEvent[] = [];
        await Promise.all(visibleCals.map(async cal => {
            try {
                const proxied = `/api/ical-proxy?url=${encodeURIComponent(cal.url)}`;
                const res = await fetch(proxied);
                if (!res.ok) return;
                const text = await res.text();
                const parsed = parseICalText(text, cal.id, cal.name, cal.color);
                allParsed.push(...parsed);
            } catch (err) {
                console.warn('[CalendarPage] Failed to fetch external cal:', cal.name, err);
            }
        }));
        setExternalEvents(allParsed);
    }, [externalCalendars]);

    useEffect(() => { fetchOwnEvents(); }, [fetchOwnEvents]);
    useEffect(() => { fetchTeamEvents(); }, [fetchTeamEvents]);
    useEffect(() => { fetchExternalCalendars(); }, [fetchExternalCalendars]);
    useEffect(() => { fetchExternalEvents(); }, [fetchExternalEvents]);

    // ── Keyboard shortcuts ───────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't fire when typing in an input/textarea
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            if (showModal) return; // EventModal handles its own Escape
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

    // ── Navigation ──────────────────────────────────────────────────
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

    // ── Header title ────────────────────────────────────────────────
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

    // ── Open modal helpers ──────────────────────────────────────────
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

    // Filtered external events (only visible calendars)
    const visibleExternal = externalEvents.filter(e =>
        externalCalendars.find(c => c.id === e.externalCalendarId && c.is_visible)
    );

    // Apply employee color to team events
    const coloredTeamEvents = teamEvents.map(e => ({
        ...e,
        color: getEmployeeColor(e.employee_id) as any,
    }));

    return (
        <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-app)' }}>
            {/* Left Sidebar */}
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
            />

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top header bar */}
                <div className="flex items-center gap-4 px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
                    {/* Title block */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{headerTitle()}</h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>Kalender</p>
                    </div>

                    {/* View switcher */}
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-subtle)' }}>
                        {(['day', 'week', 'month'] as CalendarView[]).map(v => (
                            <button key={v} onClick={() => setView(v)}
                                className="px-3 py-1.5 text-xs font-semibold transition-all"
                                style={view === v
                                    ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                                    : { color: 'var(--text-muted)' }
                                }>
                                {VIEW_LABELS[v]}
                            </button>
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => navigate(-1)} className="p-2 rounded-xl transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                        ><ChevronLeft size={18} /></button>

                        <button onClick={goToday} className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                        >Heute</button>

                        <button onClick={() => navigate(1)} className="p-2 rounded-xl transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                        ><ChevronRight size={18} /></button>
                    </div>

                    {/* New event button */}
                    <button onClick={() => openCreate()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                        <Plus size={14} /> Neuer Termin
                    </button>
                </div>

                {/* Calendar view */}
                <div className="flex-1 overflow-hidden">
                    {view === 'week' && (
                        <WeekView
                            days={weekDays}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={ownEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={visibleExternal}
                            onSlotClick={d => openCreate(d, new Date(d.getTime() + 60 * 60 * 1000))}
                            onEventClick={openEdit}
                        />
                    )}
                    {view === 'day' && (
                        <DayView
                            day={anchor}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={ownEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={visibleExternal}
                            onSlotClick={d => openCreate(d, new Date(d.getTime() + 60 * 60 * 1000))}
                            onEventClick={openEdit}
                        />
                    )}
                    {view === 'month' && (
                        <MonthView
                            anchor={anchor}
                            currentUser={currentUser}
                            employees={employees}
                            ownEvents={ownEvents}
                            teamEvents={coloredTeamEvents}
                            externalEvents={visibleExternal}
                            onDayClick={onMonthDayClick}
                            onEventClick={openEdit}
                        />
                    )}
                </div>
            </div>

            {/* Event Modal */}
            {showModal && (
                <EventModal
                    event={editEvent}
                    defaultStart={modalDefaultStart}
                    defaultEnd={modalDefaultEnd}
                    defaultAllDay={modalAllDay}
                    currentUser={currentUser}
                    employees={employees}
                    organizationId={organizationId}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { fetchOwnEvents(); fetchTeamEvents(); }}
                    onDeleted={() => { fetchOwnEvents(); fetchTeamEvents(); }}
                />
            )}
        </div>
    );
}
