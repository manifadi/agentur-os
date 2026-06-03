'use client';
import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import {
    CalendarEvent, ExternalCalendar, ParsedExternalEvent, HiddenCalendarEvent, Employee,
} from '../types';
import { parseICalText } from '../utils/icalParser';
import { authFetch } from '../utils/authFetch';
import { useRealtimeTable } from '../hooks/useRealtimeTable';

const EXTERNAL_POLL_MS = 3 * 60 * 1000; // 3 min

export interface SyncError {
    calendarId: string;
    calendarName: string;
    providerType: ExternalCalendar['provider_type'];
    message: string;
    isAuthError: boolean;
}

interface CalendarDataContextValue {
    // Range — set by CalendarPage when view/anchor change
    rangeFrom: Date;
    rangeTo: Date;
    setRange: (from: Date, to: Date) => void;

    // Visibility (sidebar)
    visibleEmployeeIds: string[];
    setVisibleEmployeeIds: React.Dispatch<React.SetStateAction<string[]>>;

    // Data
    ownEvents: CalendarEvent[];
    teamEvents: CalendarEvent[];
    externalCalendars: ExternalCalendar[];
    externalEvents: ParsedExternalEvent[];
    hiddenEventIds: Set<string>;
    hiddenExternalKeys: Set<string>;
    syncErrors: SyncError[];

    // Loading flags (only true on cold load — subsequent refetches are silent)
    initialLoading: boolean;

    // Actions
    refreshExternals: () => Promise<void>;
    refreshExternalCalendars: () => Promise<void>;
    hideEventLocally: (eventId: string) => void;
    hideExternalEvent: (uid: string, externalCalendarId: string) => Promise<void>;
}

const Ctx = createContext<CalendarDataContextValue | null>(null);

export function useCalendarData() {
    const v = useContext(Ctx);
    if (!v) throw new Error('useCalendarData must be used inside <CalendarDataProvider>');
    return v;
}

interface ProviderProps {
    currentUser?: Employee;
    organizationId?: string;
    children: React.ReactNode;
}

export function CalendarDataProvider({ currentUser, organizationId, children }: ProviderProps) {
    // Default range: current week, computed once. CalendarPage will update via setRange.
    const initialRange = useMemo(() => {
        const now = new Date();
        const day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((day + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { from: monday, to: sunday };
    }, []);

    const [rangeFrom, setRangeFrom] = useState<Date>(initialRange.from);
    const [rangeTo, setRangeTo] = useState<Date>(initialRange.to);
    const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[]>([]);

    const setRange = useCallback((from: Date, to: Date) => {
        setRangeFrom(from);
        setRangeTo(to);
    }, []);

    const enabled = !!currentUser?.id && !!organizationId;

    // ── Gepufferter Fetch-Range ──────────────────────────────────
    // Wir laden NICHT nur die sichtbare Woche, sondern einen monats-
    // quantisierten Block: Anfang Vormonat → Ende Folgemonat.
    // Solange der User innerhalb dieses Fensters navigiert (Woche/Monat
    // vor & zurück), sind die Events bereits geladen — die Views filtern
    // clientseitig, also kein Warten beim Wechseln. Erst beim Verlassen
    // des Fensters quantisiert der Block neu und lädt nach.
    const fetchFrom = useMemo(
        () => new Date(rangeFrom.getFullYear(), rangeFrom.getMonth() - 1, 1, 0, 0, 0, 0),
        [rangeFrom],
    );
    const fetchTo = useMemo(
        () => new Date(rangeTo.getFullYear(), rangeTo.getMonth() + 2, 0, 23, 59, 59, 999),
        [rangeTo],
    );
    const fetchFromMs = fetchFrom.getTime();
    const fetchToMs = fetchTo.getTime();

    // Predicate: does this event fall inside the loaded (buffered) range?
    const fetchFromRef = useRef(fetchFrom);
    const fetchToRef = useRef(fetchTo);
    fetchFromRef.current = fetchFrom;
    fetchToRef.current = fetchTo;

    const inRange = useCallback((row: { start_at: string }) => {
        const t = new Date(row.start_at).getTime();
        return t >= fetchFromRef.current.getTime() && t <= fetchToRef.current.getTime();
    }, []);

    // ── Own events ───────────────────────────────────────────────
    const ownTable = useRealtimeTable<CalendarEvent>({
        table: 'calendar_events',
        filter: enabled ? `employee_id=eq.${currentUser!.id}` : null,
        enabled,
        deps: [currentUser?.id, fetchFromMs, fetchToMs],
        fetchFn: async () => {
            if (!currentUser?.id) return [];
            const { data } = await supabase.from('calendar_events')
                .select('*')
                .eq('employee_id', currentUser.id)
                .gte('start_at', fetchFromRef.current.toISOString())
                .lte('start_at', fetchToRef.current.toISOString())
                .order('start_at');
            return (data as CalendarEvent[]) || [];
        },
        matchRow: inRange,
    });

    // ── Team events ──────────────────────────────────────────────
    // Realtime filter doesn't support `in()`. We subscribe per-org and filter client-side.
    const teamFilter = enabled && organizationId ? `organization_id=eq.${organizationId}` : null;
    const teamTable = useRealtimeTable<CalendarEvent>({
        table: 'calendar_events',
        filter: visibleEmployeeIds.length > 0 ? teamFilter : null,
        enabled: enabled && visibleEmployeeIds.length > 0,
        deps: [visibleEmployeeIds.join(','), fetchFromMs, fetchToMs],
        // Need joined `employees` data — payload doesn't include it, so refetch on change.
        refetchOnChange: true,
        fetchFn: async () => {
            if (visibleEmployeeIds.length === 0) return [];
            const { data } = await supabase.from('calendar_events')
                .select('*, employees(id, name, initials, avatar_url)')
                .in('employee_id', visibleEmployeeIds)
                .eq('visibility', 'public')
                .gte('start_at', fetchFromRef.current.toISOString())
                .lte('start_at', fetchToRef.current.toISOString())
                .order('start_at');
            return (data as CalendarEvent[]) || [];
        },
        matchRow: (row) => {
            if (!visibleEmployeeIds.includes(row.employee_id)) return false;
            if (row.visibility !== 'public') return false;
            return inRange(row);
        },
    });

    // ── External calendars (metadata) ────────────────────────────
    const externalCalsTable = useRealtimeTable<ExternalCalendar>({
        table: 'external_calendars',
        filter: enabled ? `employee_id=eq.${currentUser!.id}` : null,
        enabled,
        deps: [currentUser?.id],
        fetchFn: async () => {
            if (!currentUser?.id) return [];
            const { data } = await supabase.from('external_calendars')
                .select('*')
                .eq('employee_id', currentUser.id)
                .order('created_at');
            return (data as ExternalCalendar[]) || [];
        },
    });

    // ── Hidden events ────────────────────────────────────────────
    const hiddenTable = useRealtimeTable<HiddenCalendarEvent>({
        table: 'hidden_calendar_events',
        filter: enabled ? `employee_id=eq.${currentUser!.id}` : null,
        enabled,
        deps: [currentUser?.id],
        fetchFn: async () => {
            if (!currentUser?.id || !organizationId) return [];
            const res = await authFetch('/api/calendar/hidden-events');
            if (!res.ok) return [];
            const data = await res.json();
            return (data.hidden || []) as HiddenCalendarEvent[];
        },
    });

    const hiddenEventIds = useMemo(
        () => new Set(hiddenTable.data.filter(h => h.event_id).map(h => h.event_id!)),
        [hiddenTable.data],
    );
    const hiddenExternalKeys = useMemo(
        () => new Set(
            hiddenTable.data
                .filter(h => h.external_event_uid && h.external_calendar_id)
                .map(h => `${h.external_event_uid}|${h.external_calendar_id}`),
        ),
        [hiddenTable.data],
    );

    // ── External events (Google/Outlook/CalDAV/iCal) — polled, not realtime ─
    const [externalEvents, setExternalEvents] = useState<ParsedExternalEvent[]>([]);
    const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
    const externalCalsRef = useRef(externalCalsTable.data);
    externalCalsRef.current = externalCalsTable.data;

    const refreshExternals = useCallback(async () => {
        const visibleCals = externalCalsRef.current.filter(c => c.is_visible);
        if (visibleCals.length === 0) {
            setExternalEvents([]);
            setSyncErrors([]);
            return;
        }

        const from = fetchFromRef.current;
        const to = fetchToRef.current;
        const allParsed: ParsedExternalEvent[] = [];
        const errors: SyncError[] = [];

        const isAuthErr = (status: number, msg: string) =>
            status === 401 || /authent|anmeld|401|invalid_grant/i.test(msg);

        const pushErr = (cal: ExternalCalendar, status: number, msg: string) => {
            errors.push({
                calendarId: cal.id,
                calendarName: cal.name,
                providerType: cal.provider_type,
                message: msg,
                isAuthError: isAuthErr(status, msg),
            });
        };

        const handleResponse = async (cal: ExternalCalendar, res: Response): Promise<any | null> => {
            if (res.ok) return res.json();
            let msg = `HTTP ${res.status}`;
            try { const d = await res.json(); if (d.error) msg = d.error; } catch { /* */ }
            pushErr(cal, res.status, msg);
            return null;
        };

        await Promise.all(visibleCals.map(async cal => {
            try {
                if (cal.provider_type === 'google') {
                    const params = new URLSearchParams({ calendarId: cal.id, from: from.toISOString(), to: to.toISOString() });
                    const res = await authFetch(`/api/google-calendar/events?${params}`);
                    const data = await handleResponse(cal, res);
                    if (data) allParsed.push(...(data.events || []));
                } else if (cal.provider_type === 'outlook' || cal.provider_type === 'teams') {
                    const params = new URLSearchParams({ calendarId: cal.id, from: from.toISOString(), to: to.toISOString() });
                    const res = await authFetch(`/api/microsoft/events?${params}`);
                    const data = await handleResponse(cal, res);
                    if (data) allParsed.push(...(data.events || []));
                } else if ((cal.provider_type === 'troi' || cal.provider_type === 'apple') && cal.caldav_username) {
                    const params = new URLSearchParams({ calendarId: cal.id, from: from.toISOString(), to: to.toISOString() });
                    const res = await authFetch(`/api/caldav/events?${params}`);
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
                        pushErr(cal, res.status, `iCal-Feed nicht erreichbar (${res.status})`);
                        return;
                    }
                    const text = await res.text();
                    const parsed = parseICalText(text, cal.id, cal.name, cal.color);
                    allParsed.push(...parsed);
                }
            } catch (err: any) {
                pushErr(cal, 0, err?.message || 'Netzwerkfehler');
                console.warn('[CalendarData] Failed external fetch:', cal.name, err);
            }
        }));

        setExternalEvents(allParsed);
        setSyncErrors(errors);
    }, []);

    // Refresh externals when: visible-cal set changes, or range changes
    const visibleCalsKey = useMemo(
        () => externalCalsTable.data.filter(c => c.is_visible).map(c => c.id).sort().join(','),
        [externalCalsTable.data],
    );

    useEffect(() => {
        if (!enabled) return;
        refreshExternals();
    }, [enabled, visibleCalsKey, fetchFromMs, fetchToMs, refreshExternals]);

    // Background polling for externals
    useEffect(() => {
        if (!enabled) return;
        const id = window.setInterval(() => { refreshExternals(); }, EXTERNAL_POLL_MS);
        return () => window.clearInterval(id);
    }, [enabled, refreshExternals]);

    // Refresh on tab focus
    useEffect(() => {
        if (!enabled) return;
        const onFocus = () => { refreshExternals(); };
        const onVisibility = () => { if (document.visibilityState === 'visible') refreshExternals(); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [enabled, refreshExternals]);

    const hideEventLocally = useCallback((eventId: string) => {
        // Optimistic — DB-Write hat EventModal-Hide bereits gemacht; Realtime sollte syncen.
        // Hier nur lokales Echo bis Realtime-Payload eintrifft.
        const tmpId = `tmp-${eventId}-${Date.now()}`;
        hiddenTable.setData(prev => [
            ...prev,
            {
                id: tmpId,
                organization_id: organizationId || '',
                employee_id: currentUser?.id || '',
                event_id: eventId,
                external_event_uid: null,
                external_calendar_id: null,
                created_at: new Date().toISOString(),
            },
        ]);
    }, [hiddenTable, organizationId, currentUser?.id]);

    const hideExternalEvent = useCallback(async (uid: string, externalCalendarId: string) => {
        if (!currentUser?.id || !organizationId) return;
        const tmpId = `tmp-${uid}-${externalCalendarId}-${Date.now()}`;
        // Optimistic insert
        hiddenTable.setData(prev => [
            ...prev,
            {
                id: tmpId,
                organization_id: organizationId,
                employee_id: currentUser.id,
                event_id: null,
                external_event_uid: uid,
                external_calendar_id: externalCalendarId,
                created_at: new Date().toISOString(),
            },
        ]);
        try {
            const res = await authFetch('/api/calendar/hidden-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ externalEventUid: uid, externalCalendarId }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `HTTP ${res.status}`);
            }
            // Realtime kommt eh — temp-id mit Datum bleibt aber drin. Refresh räumt auf.
        } catch (e: any) {
            // Rollback
            hiddenTable.setData(prev => prev.filter(h => h.id !== tmpId));
            toast.error(`Ausblenden fehlgeschlagen: ${e.message || 'Unbekannt'}`);
        }
    }, [hiddenTable, currentUser?.id, organizationId]);

    const value: CalendarDataContextValue = {
        rangeFrom, rangeTo, setRange,
        visibleEmployeeIds, setVisibleEmployeeIds,
        ownEvents: ownTable.data,
        teamEvents: teamTable.data,
        externalCalendars: externalCalsTable.data,
        externalEvents,
        hiddenEventIds, hiddenExternalKeys,
        syncErrors,
        initialLoading: enabled && (ownTable.loading || externalCalsTable.loading || hiddenTable.loading),
        refreshExternals,
        refreshExternalCalendars: externalCalsTable.refresh,
        hideEventLocally,
        hideExternalEvent,
    };

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
