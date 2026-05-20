'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

type Row = { id: string };

interface UseRealtimeTableOptions<T extends Row> {
    table: string;
    /** Postgres-CDC filter, e.g. "organization_id=eq.123". Set to null to disable subscription. */
    filter?: string | null;
    /** Initial + refresh fetcher. Should return the rows with any joined fields the UI needs. */
    fetchFn: () => Promise<T[]>;
    /** Re-run when these change → triggers refresh() */
    deps?: any[];
    /** Optional: predicate for client-side filtering of realtime events (e.g. is the row in the current date range?) */
    matchRow?: (row: T) => boolean;
    /** If true (default), refetch the full row on UPDATE/INSERT instead of using the payload (use when payload misses joins). */
    refetchOnChange?: boolean;
    /** Disable subscription entirely (data is still fetched on deps change) */
    enabled?: boolean;
}

interface UseRealtimeTableResult<T extends Row> {
    data: T[];
    setData: React.Dispatch<React.SetStateAction<T[]>>;
    loading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Subscribes to a Supabase table via Realtime and keeps a local React state in sync.
 * INSERT/UPDATE/DELETE events are applied incrementally — no full refetch on every change.
 */
export function useRealtimeTable<T extends Row>({
    table,
    filter = null,
    fetchFn,
    deps = [],
    matchRow,
    refetchOnChange = false,
    enabled = true,
}: UseRealtimeTableOptions<T>): UseRealtimeTableResult<T> {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    const matchRowRef = useRef(matchRow);
    matchRowRef.current = matchRow;
    const fetchFnRef = useRef(fetchFn);
    fetchFnRef.current = fetchFn;

    const refresh = useCallback(async () => {
        try {
            const rows = await fetchFnRef.current();
            setData(rows);
        } catch (e) {
            console.warn(`[useRealtimeTable:${table}] refresh failed`, e);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [table]);

    // Initial + deps-driven fetch
    useEffect(() => {
        if (!enabled) { setLoading(false); return; }
        setLoading(true);
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps]);

    // Realtime subscription
    useEffect(() => {
        if (!enabled || filter === null) return;

        let channel: RealtimeChannel | null = null;
        const channelName = `realtime:${table}:${filter}`;

        channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes' as any,
                { event: '*', schema: 'public', table, filter },
                async (payload: any) => {
                    const evt = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
                    const newRow = payload.new as T | null;
                    const oldRow = payload.old as { id?: string } | null;

                    if (evt === 'DELETE') {
                        if (oldRow?.id) setData(prev => prev.filter(r => r.id !== oldRow.id));
                        return;
                    }

                    if (!newRow) return;
                    if (matchRowRef.current && !matchRowRef.current(newRow)) {
                        if (evt === 'UPDATE') setData(prev => prev.filter(r => r.id !== newRow.id));
                        return;
                    }

                    if (refetchOnChange) {
                        await refresh();
                        return;
                    }

                    setData(prev => {
                        const idx = prev.findIndex(r => r.id === newRow.id);
                        if (idx === -1) return [...prev, newRow];
                        const copy = prev.slice();
                        copy[idx] = newRow;
                        return copy;
                    });
                },
            )
            .subscribe();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, table, filter, refetchOnChange]);

    return { data, setData, loading, refresh };
}
