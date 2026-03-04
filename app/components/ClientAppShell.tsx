'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';
import { Project, Client, Employee, Todo } from '../types';
import { AppContext } from '../context/AppContext';
import MainSidebar from './MainSidebar';
import LoginScreen from './LoginScreen';
import GlobalSearch from './GlobalSearch';
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

    // Resolve current user after employees load
    const currentUser = employees.find(e => e.email === session?.user?.email);

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

    const fetchData = async () => {
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

        const orgId = currentUserData.organization_id;

        try {
            const [
                { data: clientsData },
                { data: employeesData },
                { data: departmentsData },
                { data: allocationsData },
                { data: membersData },
                { data: projectsData },
                { data: timeEntriesData },
                { data: personalTodosData },
                { data: agencySettingsData }
            ] = await Promise.all([
                supabase.from('clients').select('*').eq('organization_id', orgId).order('name'),
                supabase.from('employees').select('*').eq('organization_id', orgId).order('name'),
                supabase.from('departments').select('*').eq('organization_id', orgId).order('name'),
                supabase.from('resource_allocations').select('*')
                    .eq('organization_id', orgId)
                    .eq('employee_id', currentUserData.id)
                    .gte('year', new Date().getFullYear() - 1),
                supabase.from('project_members').select('*'),
                supabase.from('projects').select(`
                        *, 
                        employees ( id, name, initials, email, phone, avatar_url ), 
                        clients ( * ), 
                        todos ( * ),
                        positions:project_positions ( * )
                    `).eq('organization_id', orgId).order('created_at', { ascending: false }),
                supabase.from('time_entries').select(`*, projects(job_number, title, clients(name)), positions:agency_positions(title)`)
                    .eq('employee_id', currentUserData.id)
                    .gte('date', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString())
                    .order('date', { ascending: false }),
                supabase.from('todos').select(`*, employees(id, name, initials, avatar_url)`).is('project_id', null).eq('organization_id', orgId).order('created_at', { ascending: false }),
                supabase.from('agency_settings').select('*').eq('organization_id', orgId).single()
            ]);

            if (clientsData) setClients(clientsData);
            if (employeesData) setEmployees(employeesData);
            if (departmentsData) setDepartments(departmentsData);
            if (allocationsData) setAllocations(allocationsData);
            if (membersData) setMembers(membersData);
            if (timeEntriesData) setTimeEntries(timeEntriesData as any);
            if (personalTodosData) setPersonalTodos(personalTodosData as any);
            if (agencySettingsData) setAgencySettings(agencySettingsData);

            if (projectsData) {
                const projectsWithStats = projectsData.map(proj => {
                    const totalTodos = proj.todos ? proj.todos.length : 0;
                    const doneTodos = proj.todos ? proj.todos.filter((t: Todo) => t.is_done).length : 0;
                    const openTodosPreview = proj.todos ? proj.todos.filter((t: Todo) => !t.is_done).slice(0, 3) : [];
                    return { ...proj, totalTodos, doneTodos, openTodosPreview };
                });
                setProjects(projectsWithStats as any);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!session) return;
        fetchData();

        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                () => fetchData()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session]);

    // GATEKEEPER: Check if user is approved
    useEffect(() => {
        if (!loadingSession && session && !loading && pathname !== '/onboarding' && pathname !== '/reset-password') {
            const found = employees.find(e => e.email === session.user.email);
            if (!found) router.replace('/onboarding');
        }
    }, [loadingSession, session, loading, pathname, router, employees]);

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
    if (!session && !isResetPassword) return <LoginScreen />;

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
            <div
                className="flex h-screen w-screen overflow-hidden antialiased"
                style={{ background: 'var(--bg-app)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)' }}
            >
                {!['/login', '/onboarding', '/reset-password'].includes(pathname || '') && (
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
                <Toaster position="bottom-right" expand={true} richColors duration={8000} closeButton />

                <main
                    className={`flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden relative transition-all duration-300 ${isSidebarExpanded ? 'pl-72' : 'pl-20'}`}
                    style={{ background: 'var(--bg-app)' }}
                >
                    {children}
                </main>
            </div>
        </AppContext.Provider>
    );
}
