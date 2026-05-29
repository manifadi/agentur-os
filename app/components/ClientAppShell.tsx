'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';
import { Project, Client, Employee, Todo, OrganizationFeature, FEATURE_CATALOG } from '../types';
import { AppContext } from '../context/AppContext';
import { CalendarDataProvider } from '../context/CalendarDataContext';
import MainSidebar from './MainSidebar';
import LoginScreen from './LoginScreen';
import GlobalSearch from './GlobalSearch';
import WelcomeModal from './UI/WelcomeModal';
import ImpersonationBanner from './SuperAdmin/ImpersonationBanner';
import FeedbackWidget from './Feedback/FeedbackWidget';
import { Toaster, toast } from 'sonner';
import { useTheme } from '../hooks/useTheme';
import {
    StoredAccount, getAccounts, upsertAccount, updateAccountMeta,
    removeAccount as removeAccountFromVault, subscribeAccounts,
} from '../utils/accountVault';

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const [session, setSession] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [loading, setLoading] = useState(true);

    // Data
    const [clients, setClients] = useState<Client[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [timeEntries, setTimeEntries] = useState<any[]>([]);
    const [personalTodos, setPersonalTodos] = useState<Todo[]>([]);
    const [agencySettings, setAgencySettings] = useState<any>(null);
    const [orgFeatures, setOrgFeatures] = useState<OrganizationFeature[]>([]);
    const [showWelcome, setShowWelcome] = useState(false);

    // Multi-Account / Agentur-Switcher
    const [accounts, setAccounts] = useState<StoredAccount[]>([]);
    const [addingAccount, setAddingAccount] = useState(false);
    const [switchingAccount, setSwitchingAccount] = useState(false);
    const prevSessionUserIdRef = useRef<string | undefined>(undefined);

    // Resolve current user after employees load
    const currentUser = employees.find(e => e.email === session?.user?.email);
    const orgId = currentUser?.organization_id;

    // Theme — pass employeeId so prefs sync to Supabase
    const { prefs: themePrefs, updateThemePrefs, isSidebarExpanded, setSidebarExpanded, loaded: themeLoaded } = useTheme(currentUser?.id);

    // State mapping for Sidebar highlighting
    const getSidebarView = () => {
        if (!pathname) return 'dashboard';
        if (pathname.startsWith('/uebersicht')) return 'projects_overview';
        if (pathname.startsWith('/aufgaben')) return 'global_tasks';
        if (pathname.startsWith('/ressourcen')) return 'resource_planning';
        if (pathname.startsWith('/zeiterfassung')) return 'time_tracking';
        if (pathname.startsWith('/einstellungen')) return 'settings';
        if (pathname.startsWith('/kalender')) return 'kalender';
        if (pathname.startsWith('/reporting')) return 'reporting';
        if (pathname.startsWith('/abwesenheiten')) return 'absences';
        return 'dashboard';
    };

    // Aktive Session in den Account-Vault übernehmen (Tokens für Switcher)
    const captureSession = useCallback((s: any) => {
        if (!s?.user?.id || !s.access_token || !s.refresh_token) return;
        upsertAccount({
            id: s.user.id,
            email: s.user.email || '',
            accessToken: s.access_token,
            refreshToken: s.refresh_token,
        });
        setAccounts(getAccounts());
    }, []);

    // --- INIT & FETCH ---
    useEffect(() => {
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setLoadingSession(false);
                if (session) {
                    captureSession(session);
                    prevSessionUserIdRef.current = session.user.id;
                }
            })
            .catch(() => setLoadingSession(false));

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            if (session) {
                captureSession(session);
                // Tatsächlicher Account-Wechsel (nicht nur Token-Refresh) → Daten neu laden,
                // bis dahin loading=true halten, sonst springt der Gatekeeper auf /onboarding.
                if (session.user.id !== prevSessionUserIdRef.current) setLoading(true);
                prevSessionUserIdRef.current = session.user.id;
            } else {
                prevSessionUserIdRef.current = undefined;
            }
            // Nach erfolgreichem Login (auch beim "weitere Agentur hinzufügen") Overlay schließen
            if (event === 'SIGNED_IN') setAddingAccount(false);
            // Passwort-vergessen-Link angeklickt → immer zur Passwort-Setzen-Seite
            if (event === 'PASSWORD_RECOVERY') router.replace('/reset-password');
        });
        return () => subscription.unsubscribe();
    }, [captureSession, router]);

    // Vault-Liste laden + auf Änderungen (auch aus anderen Tabs) hören
    useEffect(() => {
        setAccounts(getAccounts());
        return subscribeAccounts(() => setAccounts(getAccounts()));
    }, []);

    // ── Per-table refetchers (memoized so subscriptions can call them) ──
    const fetchClients = useCallback(async (organizationId: string) => {
        const { data } = await supabase.from('clients').select('*').eq('organization_id', organizationId).order('name');
        if (data) setClients(data);
    }, []);

    const fetchEmployees = useCallback(async (organizationId: string) => {
        const { data } = await supabase.from('employees').select('*').eq('organization_id', organizationId).order('name');
        if (data) setEmployees(data);
    }, []);

    const fetchDepartments = useCallback(async (organizationId: string) => {
        const { data } = await supabase.from('departments').select('*').eq('organization_id', organizationId).order('name');
        if (data) setDepartments(data);
    }, []);

    const fetchAllocations = useCallback(async (organizationId: string, employeeId: string) => {
        const { data } = await supabase.from('resource_allocations').select('*')
            .eq('organization_id', organizationId)
            .eq('employee_id', employeeId)
            .gte('year', new Date().getFullYear() - 1);
        if (data) setAllocations(data);
    }, []);

    const fetchMembers = useCallback(async () => {
        const { data } = await supabase.from('project_members').select('*');
        if (data) setMembers(data);
    }, []);

    const fetchProjects = useCallback(async (organizationId: string) => {
        const { data } = await supabase.from('projects').select(`
            *,
            employees ( id, name, initials, email, phone, avatar_url ),
            clients ( * ),
            todos ( * ),
            positions:project_positions ( * )
        `).eq('organization_id', organizationId).order('created_at', { ascending: false });
        if (data) {
            const withStats = data.map((proj: any) => {
                const totalTodos = proj.todos ? proj.todos.length : 0;
                const doneTodos = proj.todos ? proj.todos.filter((t: Todo) => t.is_done).length : 0;
                const openTodosPreview = proj.todos ? proj.todos.filter((t: Todo) => !t.is_done).slice(0, 3) : [];
                return { ...proj, totalTodos, doneTodos, openTodosPreview };
            });
            setProjects(withStats as any);
        }
    }, []);

    const fetchTimeEntries = useCallback(async (employeeId: string) => {
        const { data } = await supabase.from('time_entries').select(`*, projects(job_number, title, clients(name)), positions:agency_positions(title)`)
            .eq('employee_id', employeeId)
            .gte('date', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString())
            .order('date', { ascending: false });
        if (data) setTimeEntries(data as any);
    }, []);

    const fetchPersonalTodos = useCallback(async (organizationId: string, employeeId: string) => {
        const { data } = await supabase.from('todos').select(`*, employees(id, name, initials, avatar_url)`)
            .is('project_id', null).eq('organization_id', organizationId).eq('assigned_to', employeeId)
            .order('created_at', { ascending: false });
        if (data) setPersonalTodos(data as any);
    }, []);

    const fetchAgencySettings = useCallback(async (organizationId: string) => {
        const { data } = await supabase.from('agency_settings').select('*').eq('organization_id', organizationId).single();
        if (data) setAgencySettings(data);
    }, []);

    const fetchOrgFeatures = useCallback(async (organizationId: string) => {
        const { data } = await supabase.from('organization_features').select('*').eq('organization_id', organizationId);
        setOrgFeatures((data as OrganizationFeature[]) || []);
    }, []);

    // Feature-Flag-Check: explizit gesetzter Wert, sonst Katalog-Default
    const isFeatureEnabled = useCallback((key: string): boolean => {
        const f = orgFeatures.find(x => x.feature_key === key);
        if (f) return f.enabled;
        return FEATURE_CATALOG.find(c => c.key === key)?.defaultEnabled ?? false;
    }, [orgFeatures]);

    // Cold-load: fetches everything in parallel
    const fetchData = useCallback(async () => {
        if (!session?.user?.email) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Self-Heal: eingeloggten Account mit seinem Mitarbeiter-Eintrag verknüpfen.
        // Idempotent (no-op, wenn user_id schon gesetzt). Nötig, wenn ein Account über
        // den Agentur-Switcher hinzugefügt wurde und damit /onboarding (= Linking) übersprang.
        await supabase.rpc('link_invited_employee');

        const { data: currentUserData } = await supabase.from('employees')
            .select('*')
            .eq('email', session.user.email)
            .single();

        if (!currentUserData || !currentUserData.organization_id) {
            setLoading(false);
            return;
        }

        const organizationId = currentUserData.organization_id;
        const employeeId = currentUserData.id;

        try {
            await Promise.all([
                fetchClients(organizationId),
                fetchEmployees(organizationId),
                fetchDepartments(organizationId),
                fetchAllocations(organizationId, employeeId),
                fetchMembers(),
                fetchProjects(organizationId),
                fetchTimeEntries(employeeId),
                fetchPersonalTodos(organizationId, employeeId),
                fetchAgencySettings(organizationId),
                fetchOrgFeatures(organizationId),
            ]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [session, fetchClients, fetchEmployees, fetchDepartments, fetchAllocations, fetchMembers, fetchProjects, fetchTimeEntries, fetchPersonalTodos, fetchAgencySettings, fetchOrgFeatures]);

    useEffect(() => {
        if (!session) return;
        fetchData();
    }, [session, fetchData]);

    // ── Per-table realtime subscriptions ──
    // Each subscription refetches ONLY its own table (with joins) on change.
    // No more "any change → refetch everything".
    const currentUserIdRef = useRef<string | undefined>(currentUser?.id);
    currentUserIdRef.current = currentUser?.id;

    useEffect(() => {
        if (!orgId) return;
        const channels = [
            supabase.channel(`shell:clients:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'clients', filter: `organization_id=eq.${orgId}` },
                    () => fetchClients(orgId))
                .subscribe(),

            supabase.channel(`shell:employees:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'employees', filter: `organization_id=eq.${orgId}` },
                    () => fetchEmployees(orgId))
                .subscribe(),

            supabase.channel(`shell:departments:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'departments', filter: `organization_id=eq.${orgId}` },
                    () => fetchDepartments(orgId))
                .subscribe(),

            supabase.channel(`shell:projects:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'projects', filter: `organization_id=eq.${orgId}` },
                    () => fetchProjects(orgId))
                .subscribe(),

            // todos affects both personalTodos and projects (joined). Refetch both.
            supabase.channel(`shell:todos:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'todos', filter: `organization_id=eq.${orgId}` },
                    () => {
                        const empId = currentUserIdRef.current;
                        if (empId) fetchPersonalTodos(orgId, empId);
                        fetchProjects(orgId);
                    })
                .subscribe(),

            // project_positions affects the joined projects payload
            supabase.channel(`shell:project_positions:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'project_positions' },
                    () => fetchProjects(orgId))
                .subscribe(),

            supabase.channel(`shell:project_members`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'project_members' },
                    () => fetchMembers())
                .subscribe(),

            supabase.channel(`shell:resource_allocations:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'resource_allocations', filter: `organization_id=eq.${orgId}` },
                    () => {
                        const empId = currentUserIdRef.current;
                        if (empId) fetchAllocations(orgId, empId);
                    })
                .subscribe(),

            // time_entries: filter by employee at the DB level — each user only cares about own
            supabase.channel(`shell:time_entries:${currentUser?.id}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'time_entries' },
                    () => {
                        const empId = currentUserIdRef.current;
                        if (empId) fetchTimeEntries(empId);
                    })
                .subscribe(),

            supabase.channel(`shell:agency_settings:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'agency_settings', filter: `organization_id=eq.${orgId}` },
                    () => fetchAgencySettings(orgId))
                .subscribe(),

            // Feature-Flags: Super-Admin-Toggles greifen sofort, ohne Neu-Login
            supabase.channel(`shell:organization_features:${orgId}`)
                .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'organization_features', filter: `organization_id=eq.${orgId}` },
                    () => fetchOrgFeatures(orgId))
                .subscribe(),
        ];

        return () => {
            for (const ch of channels) supabase.removeChannel(ch);
        };
    }, [orgId, currentUser?.id, fetchClients, fetchEmployees, fetchDepartments, fetchProjects, fetchPersonalTodos, fetchMembers, fetchAllocations, fetchTimeEntries, fetchAgencySettings, fetchOrgFeatures]);

    // GATEKEEPER: Check if user is approved
    useEffect(() => {
        if (!loadingSession && session && !loading && pathname !== '/onboarding' && pathname !== '/reset-password' && pathname !== '/set-password' && pathname !== '/auth/callback') {
            const found = employees.find(e => e.email === session.user.email);
            if (!found) router.replace('/onboarding');
        }
    }, [loadingSession, session, loading, pathname, router, employees]);

    // Welcome modal: show once for users who haven't seen it
    useEffect(() => {
        if (currentUser && !currentUser.dashboard_config?.has_seen_welcome) {
            setShowWelcome(true);
        }
    }, [currentUser?.id]);

    const handleWelcomeDismiss = async () => {
        setShowWelcome(false);
        if (!currentUser) return;
        const newConfig = {
            ...currentUser.dashboard_config,
            has_seen_welcome: true,
        };
        await supabase.from('employees').update({ dashboard_config: newConfig }).eq('id', currentUser.id);
    };

    // Anzeige-Infos (Agenturname, Logo, Nutzername) für den Switcher nachtragen
    useEffect(() => {
        const id = session?.user?.id;
        if (!id) return;
        updateAccountMeta(id, {
            agencyName: agencySettings?.company_name || undefined,
            logoUrl: agencySettings?.logo_url || null,
            userName: currentUser?.name || undefined,
        });
        setAccounts(getAccounts());
    }, [session?.user?.id, agencySettings?.company_name, agencySettings?.logo_url, currentUser?.name]);

    // Zu gespeichertem Account wechseln (ohne erneutes Anmelden)
    const switchAccount = useCallback(async (id: string) => {
        if (id === session?.user?.id) return;
        const acc = getAccounts().find(a => a.id === id);
        if (!acc) return;

        setSwitchingAccount(true);
        setLoading(true); // Gatekeeper blockieren, bis Daten der neuen Agentur geladen sind
        if (session) captureSession(session); // aktuellen Stand sichern

        const { data, error } = await supabase.auth.setSession({
            access_token: acc.accessToken,
            refresh_token: acc.refreshToken,
        });

        if (error || !data.session) {
            setSwitchingAccount(false);
            setLoading(false); // Wechsel fehlgeschlagen — aktive Agentur bleibt, App wieder freigeben
            removeAccountFromVault(id);
            setAccounts(getAccounts());
            toast.error('Sitzung abgelaufen — bitte diese Agentur erneut hinzufügen.');
            return;
        }

        setSession(data.session);
        captureSession(data.session); // ggf. rotierte Tokens speichern
        toast.success(`Gewechselt zu ${acc.agencyName || acc.email}`);
        setSwitchingAccount(false);
    }, [session, captureSession]);

    const startAddAccount = useCallback(() => setAddingAccount(true), []);

    const handleLogout = async () => {
        const currentId = session?.user?.id;
        await supabase.auth.signOut({ scope: 'local' });
        if (currentId) removeAccountFromVault(currentId);

        const remaining = getAccounts();
        setAccounts(remaining);

        // Noch andere Agenturen gespeichert? → direkt dorthin wechseln
        if (remaining.length > 0) {
            const next = remaining[0];
            const { data, error } = await supabase.auth.setSession({
                access_token: next.accessToken,
                refresh_token: next.refreshToken,
            });
            if (!error && data.session) {
                setSession(data.session);
                captureSession(data.session);
                toast.success(`Gewechselt zu ${next.agencyName || next.email}`);
                return;
            }
            // Token unbrauchbar → ebenfalls entfernen und normal ausloggen
            removeAccountFromVault(next.id);
            setAccounts(getAccounts());
        }

        setSession(null);
        setProjects([]);
        router.push('/');
    };

    const isResetPassword = pathname === '/reset-password';

    if (loadingSession) return (
        <div className="flex h-screen items-center justify-center text-sm font-medium" style={{ color: 'var(--text-muted)', background: 'var(--bg-app)' }}>
            Lade App Session...
        </div>
    );
    const isAuthCallback = pathname === '/auth/callback';
    if (!session && !isResetPassword && !isAuthCallback) return <LoginScreen />;

    return (
        <AppContext.Provider value={{
            session,
            projects,
            clients,
            employees,
            currentUser,
            departments,
            allocations,
            members,
            agencySettings,
            loading,
            isFeatureEnabled,
            accounts,
            activeAccountId: session?.user?.id,
            switchAccount,
            startAddAccount,
            switchingAccount,
            setProjects,
            setClients,
            setEmployees,
            fetchData,
            handleLogout,
            timeEntries,
            setTimeEntries,
            personalTodos,
            setPersonalTodos,
            themePrefs,
            updateThemePrefs,
            isSidebarExpanded,
            setSidebarExpanded,
        }}>
            <CalendarDataProvider currentUser={currentUser} organizationId={orgId}>
                <ImpersonationBanner />
                <div
                    className="flex h-screen w-screen overflow-hidden antialiased"
                    style={{ background: 'var(--bg-app)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)' }}
                >
                    {!['/login', '/onboarding', '/reset-password', '/set-password', '/auth/callback'].includes(pathname || '') && !pathname?.startsWith('/admin') && (
                        <MainSidebar
                            currentView={getSidebarView()}
                            onLogout={handleLogout}
                            isSidebarExpanded={isSidebarExpanded}
                            setIsSidebarExpanded={setSidebarExpanded}
                            agencySettings={agencySettings}
                            session={session}
                            activeUser={currentUser}
                        />
                    )}

                    <GlobalSearch />
                    <Toaster position="bottom-right" richColors duration={3500} closeButton toastOptions={{ style: { fontFamily: 'var(--font-family)', fontSize: '13px', fontWeight: '500' } }} />
                    {showWelcome && currentUser && !pathname?.startsWith('/admin') && (
                        <WelcomeModal userName={currentUser.name} onDismiss={handleWelcomeDismiss} />
                    )}

                    {currentUser && orgId && isFeatureEnabled('feedback_button')
                        && !['/login', '/onboarding', '/reset-password', '/set-password', '/auth/callback'].includes(pathname || '')
                        && !pathname?.startsWith('/admin') && (
                        <FeedbackWidget currentUser={currentUser} organizationId={orgId} />
                    )}

                    <main
                        className={`flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden relative transition-all duration-300 ${pathname?.startsWith('/admin') ? '' : (isSidebarExpanded ? 'pl-72' : 'pl-20')}`}
                        style={{ background: 'var(--bg-app)' }}
                    >
                        {children}
                    </main>
                </div>

                {addingAccount && (
                    <div className="fixed inset-0 z-[200]" style={{ background: 'var(--bg-app)' }}>
                        <LoginScreen isAddingAccount onCancel={() => setAddingAccount(false)} />
                    </div>
                )}
            </CalendarDataProvider>
        </AppContext.Provider>
    );
}
