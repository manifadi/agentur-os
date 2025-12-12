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

    const [session, setSession] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [loading, setLoading] = useState(false);

    // Data
    const [clients, setClients] = useState<Client[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [allocations, setAllocations] = useState<any[]>([]);

    // State mapping for Sidebar highlighting
    // Mapping: URL path -> ViewState ID used in Sidebar (or just simplified)
    const currentView = pathname?.split('/')[1] || 'dashboard';

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

    const fetchData = async () => {
        setLoading(true);

        const [
            { data: clientsData },
            { data: employeesData },
            { data: departmentsData },
            { data: allocationsData },
            { data: projectsData }
        ] = await Promise.all([
            supabase.from('clients').select('*').order('name'),
            supabase.from('employees').select('*').order('name'),
            supabase.from('departments').select('*').order('name'),
            supabase.from('resource_allocations').select('*'),
            supabase.from('projects').select(`
                *, 
                employees ( id, name, initials ), 
                clients ( name, logo_url ), 
                todos ( * )
            `).order('created_at', { ascending: false })
        ]);

        if (clientsData) setClients(clientsData);
        if (employeesData) setEmployees(employeesData);
        if (departmentsData) setDepartments(departmentsData);
        if (allocationsData) setAllocations(allocationsData);

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
        setLoading(false);
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

    return (
        <AppContext.Provider value={{
            session,
            projects,
            clients,
            employees,
            departments,
            allocations,
            loading,
            setProjects,
            setClients,
            setEmployees,
            fetchData,
            handleLogout
        }}>
            <div className="flex h-screen w-full bg-[#F9FAFB] text-gray-900 font-sans overflow-hidden">
                <MainSidebar
                    currentView={getSidebarView()}
                    setCurrentView={(v) => {
                        // Navigation Logic
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
                <main className="flex-1 h-full overflow-y-auto relative bg-[#F9FAFB] ml-20">
                    {children}
                </main>
            </div>
        </AppContext.Provider>
    );
}
