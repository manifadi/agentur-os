'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
    OrganizationOverview,
    SuperAdminAuditEntry,
    RegistrationRequest,
} from '../../types';

// ─────────────────────────────────────────────────────────────
// Source of Truth für alle /admin-Daten.
//
// - Daten leben im Layout-Context, nicht in einzelnen Pages.
// - Realtime-Subscriptions halten alles aktuell.
// - Beim Page-Switch wird NICHT neu geladen — der Provider lebt
//   solange das /admin-Layout gemountet ist.
// ─────────────────────────────────────────────────────────────

export interface AgencyBackup {
    id: string;
    org_id: string;
    org_name: string;
    org_plan: string | null;
    reason: string;
    size_bytes: number;
    employee_count: number;
    project_count: number;
    created_at: string;
    created_by_email: string | null;
    org_still_exists: boolean;
}

interface SuperAdminContextValue {
    orgs: OrganizationOverview[];
    audit: SuperAdminAuditEntry[];
    requests: RegistrationRequest[];
    backups: AgencyBackup[];
    loading: boolean;
    refresh: () => Promise<void>;
    refreshOrgs: () => Promise<void>;
    refreshBackups: () => Promise<void>;
}

const SuperAdminContext = createContext<SuperAdminContextValue | null>(null);

export function useSuperAdmin() {
    const ctx = useContext(SuperAdminContext);
    if (!ctx) throw new Error('useSuperAdmin must be used inside SuperAdminProvider');
    return ctx;
}

export function SuperAdminProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
    const [orgs, setOrgs] = useState<OrganizationOverview[]>([]);
    const [audit, setAudit] = useState<SuperAdminAuditEntry[]>([]);
    const [requests, setRequests] = useState<RegistrationRequest[]>([]);
    const [backups, setBackups] = useState<AgencyBackup[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshOrgs = useCallback(async () => {
        const { data } = await supabase.rpc('get_super_admin_overview');
        if (data) setOrgs(data as OrganizationOverview[]);
    }, []);

    const refreshAudit = useCallback(async () => {
        const { data } = await supabase
            .from('super_admin_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);
        if (data) setAudit(data as SuperAdminAuditEntry[]);
    }, []);

    const refreshRequests = useCallback(async () => {
        const { data } = await supabase
            .from('registration_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (data) setRequests(data as RegistrationRequest[]);
    }, []);

    const refreshBackups = useCallback(async () => {
        const { data } = await supabase.rpc('list_agency_backups_super_admin');
        if (data) setBackups(data as AgencyBackup[]);
    }, []);

    const refresh = useCallback(async () => {
        await Promise.all([refreshOrgs(), refreshAudit(), refreshRequests(), refreshBackups()]);
    }, [refreshOrgs, refreshAudit, refreshRequests, refreshBackups]);

    // Initial load — nur einmal beim Mount, solange enabled
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        (async () => {
            await refresh();
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [enabled, refresh]);

    // Realtime-Subscriptions — halten alles live aktuell
    useEffect(() => {
        if (!enabled) return;

        const channels = [
            supabase.channel('admin:organizations')
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'organizations' },
                    () => refreshOrgs())
                .subscribe(),

            supabase.channel('admin:audit')
                .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'super_admin_audit_log' },
                    () => refreshAudit())
                .subscribe(),

            supabase.channel('admin:requests')
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'registration_requests' },
                    () => refreshRequests())
                .subscribe(),

            supabase.channel('admin:backups')
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'agency_backups' },
                    () => refreshBackups())
                .subscribe(),

            // employees/projects ändern die Counts in orgs → orgs refetchen
            supabase.channel('admin:employees')
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'employees' },
                    () => refreshOrgs())
                .subscribe(),

            supabase.channel('admin:projects')
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'projects' },
                    () => refreshOrgs())
                .subscribe(),
        ];

        return () => {
            for (const ch of channels) supabase.removeChannel(ch);
        };
    }, [enabled, refreshOrgs, refreshAudit, refreshRequests, refreshBackups]);

    return (
        <SuperAdminContext.Provider
            value={{ orgs, audit, requests, backups, loading, refresh, refreshOrgs, refreshBackups }}
        >
            {children}
        </SuperAdminContext.Provider>
    );
}
