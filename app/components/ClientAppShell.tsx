'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';
import { Project, Client, Employee, Todo } from '../types';
import { AppContext } from '../context/AppContext';
import { CalendarDataProvider } from '../context/CalendarDataContext';
import MainSidebar from './MainSidebar';
import LoginScreen from './LoginScreen';
import GlobalSearch from './GlobalSearch';
import WelcomeModal from './UI/WelcomeModal';
import { Toaster } from 'sonner';
import { useTheme } from '../hooks/useTheme';

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
    const [showWelcome, setShowWelcome] = useState(false);

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
        return 'dashboard';
    };

    // --- INIT & FETCH ---
    useEffect(() => {
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setLoadingSession(false);
            })
            .catch(() => setLoadingSession(false));

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
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

    // Cold-load: fetches everything in parallel
    const fetchData = useCallback(async () => {
        if (!session?.user?.email) {
            setLoading(false);
            return;
        }

        setLoading(true);

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
            ]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [session, fetchClients, fetchEmployees, fetchDepartments, fetchAllocations, fetchMembers, fetchProjects, fetchTimeEntries, fetchPersonalTodos, fetchAgencySettings]);

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
        ];

        return () => {
            for (const ch of channels) supabase.removeChannel(ch);
        };
    }, [orgId, currentUser?.id, fetchClients, fetchEmployees, fetchDepartments, fetchProjects, fetchPersonalTodos, fetchMembers, fetchAllocations, fetchTimeEntries, fetchAgencySettings]);

    // GATEKEEPER: Check if user is approved
    useEffect(() => {
        if (!loadingSession && session && !loading && pathname !== '/onboarding' && pathname !== '/reset-password' && pathname !== '/auth/callback') {
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

    const handleLogout = async () => {
        await supabase.auth.signOut();
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
                <div
                    className="flex h-screen w-screen overflow-hidden antialiased"
                    style={{ background: 'var(--bg-app)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)' }}
                >
                    {!['/login', '/onboarding', '/reset-password', '/auth/callback'].includes(pathname || '') && (
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
                    {showWelcome && currentUser && (
                        <WelcomeModal userName={currentUser.name} onDismiss={handleWelcomeDismiss} />
                    )}

                    <main
                        className={`flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden relative transition-all duration-300 ${isSidebarExpanded ? 'pl-72' : 'pl-20'}`}
                        style={{ background: 'var(--bg-app)' }}
                    >
                        {children}
                    </main>
                </div>
            </CalendarDataProvider>
        </AppContext.Provider>
    );
}
