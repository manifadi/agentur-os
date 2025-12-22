'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';
import { Project, Client, Employee, Todo } from '../types';
import { AppContext } from '../context/AppContext';
import MainSidebar from './MainSidebar';
import LoginScreen from './LoginScreen';

export default function ClientAppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    // Apple Design System Global Styles
    // Background: #F5F5F7 (Apple Light Gray)
    // Font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto...
    const appleBg = "bg-[#F5F5F7] text-gray-900 font-[system-ui]";

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
    const [timeEntries, setTimeEntries] = useState<any[]>([]); // [NEW]

    // State mapping for Sidebar highlighting
    // Mapping: URL path -> ViewState ID used in Sidebar (or just simplified)
    const currentView = (pathname?.split('/')[1] || 'dashboard') as any;

    // --- INIT & FETCH ---
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoadingSession(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session) fetchData();
    }, [session]);

    // GATEKEEPER: Check if user is approved
    useEffect(() => {
        if (!loading && session && pathname !== '/onboarding') {
            const isApproved = employees.some(e => e.email === session.user.email);
            if (!isApproved) {
                // Strict check: If user is not in the loaded employees list, redirect.
                // This covers: 
                // 1. New users (no employee record)
                // 2. Users not assigned to an organization (fetchData returns no employees for them)
                router.replace('/onboarding');
            }
        }
    }, [session, employees, loading, pathname, router]);

    const fetchData = async () => {
        setLoading(true);

        // 1. Get current employee to find organization_id
        if (!session?.user?.email) {
            setLoading(false);
            return;
        }

        const { data: currentUserData } = await supabase.from('employees')
            .select('*')
            .eq('email', session.user.email)
            .single();

        if (!currentUserData || !currentUserData.organization_id) {
            // Cannot fetch organization data without an org ID.
            // But we might need to load basic stuff? Or just stop.
            // If we stop here, 'employees' state is empty, so Gatekeeper will hold.
            // EXCEPT: Gatekeeper checks 'employees.some...' logic which depends on this fetch.
            // Critical fix: We must at least load the USER record into 'employees' state 
            // OR handle 'no org' state carefully.

            // For now, if no org, we fetch NOTHING.
            // The Gatekeeper will see empty employees and redirect to Onboarding.
            setLoading(false);
            return;
        }

        const orgId = currentUserData.organization_id;

        // 2. Fetch scoped data
        try {
            const [
                { data: clientsData },
                { data: employeesData },
                { data: departmentsData },
                { data: allocationsData },
                { data: membersData }, // project_members doesn't have org_id directly usually, but projects do.
                { data: projectsData },
                { data: timeEntriesData } // [NEW] Catch the 7th result
            ] = await Promise.all([
                supabase.from('clients').select('*').eq('organization_id', orgId).order('name'),
                supabase.from('employees').select('*').eq('organization_id', orgId).order('name'),
                supabase.from('departments').select('*').eq('organization_id', orgId).order('name'),
                supabase.from('resource_allocations').select('*')
                    .eq('organization_id', orgId)
                    .eq('employee_id', currentUserData.id)
                    .gte('year', new Date().getFullYear() - 1),
                supabase.from('project_members').select('*'), // TODO: Filter this? Ideally, RLS handles it. OR we filter locally based on projects we get.
                supabase.from('projects').select(`
                *, 
                employees ( id, name, initials ), 
                clients ( name, logo_url ), 
                todos ( * ),
                positions:project_positions ( * )
            `).eq('organization_id', orgId).order('created_at', { ascending: false }),
                // [NEW] Fetch recent time entries for Dashboard
                supabase.from('time_entries').select(`*, projects(job_number, title, clients(name)), positions:agency_positions(title)`)
                    .eq('employee_id', currentUserData.id)
                    .gte('date', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString()) // Last 30 days
                    .order('date', { ascending: false })
            ]);

            if (clientsData) setClients(clientsData);
            if (employeesData) setEmployees(employeesData);
            if (departmentsData) setDepartments(departmentsData);
            if (allocationsData) setAllocations(allocationsData);
            if (membersData) setMembers(membersData);
            if (timeEntriesData) setTimeEntries(timeEntriesData as any); // Type assertion until robust

            if (projectsData) {
                // Process stats / computed fields
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

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProjects([]);
        router.push('/');
    };

    if (loadingSession) return <div className="flex h-screen items-center justify-center text-gray-400 font-medium">Lade App...</div>;
    if (!session) return <LoginScreen />;

    // Helper to map pathname to legacy 'ViewState' for the Sidebar
    // Only if MainSidebar expects strict types, otherwise we might need to update MainSidebarProps
    // Current MainSidebar Expects: 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'settings'
    const getSidebarView = () => {
        switch (pathname) {
            case '/uebersicht': return 'projects_overview';
            case '/aufgaben': return 'global_tasks';
            case '/ressourcen': return 'resource_planning';
            case '/einstellungen': return 'settings';
            default: return 'dashboard';
        }
    };

    // Derived Current User
    const currentUser = employees.find(e => e.email === session?.user?.email);

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
            loading,
            setProjects,
            setClients,
            setEmployees,
            fetchData,
            handleLogout,
            timeEntries, // [NEW]
            setTimeEntries  // [NEW]
        }}>
            <div className={`flex h-screen w-screen overflow-hidden ${appleBg} antialiased selection:bg-blue-500/30 scroll-smooth`}>
                {/* SIDEBAR */}
                {!['/login', '/onboarding'].includes(pathname || '') && (
                    <MainSidebar
                        currentView={getSidebarView()}
                        setCurrentView={(v) => {
                            switch (v) {
                                case 'dashboard': router.push('/dashboard'); break;
                                case 'projects_overview': router.push('/uebersicht'); break;
                                case 'global_tasks': router.push('/aufgaben'); break;
                                case 'resource_planning': router.push('/ressourcen'); break;
                                case 'settings': router.push('/einstellungen'); break;
                            }
                        }}
                        handleLogout={handleLogout}
                    />
                )}

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden relative ml-20">
                    {/* Glassmorphism Header Background Effect if needed here */}
                    {children}
                </main>
            </div>
        </AppContext.Provider>
    );
}
