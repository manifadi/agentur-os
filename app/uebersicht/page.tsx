'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import DashboardView from '../components/Dashboard/DashboardView';
import ProjectDetail from '../components/Projects/ProjectDetail';
import TimeEntryModal from '../components/Modals/TimeEntryModal'; // NEW
import ClientModal from '../components/Modals/ClientModal';
import EmployeeModal from '../components/Modals/EmployeeModal';
import CreateProjectModal from '../components/Modals/CreateProjectModal';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { supabase } from '../supabaseClient';
import { Project, Client, Employee } from '../types';
import { deleteFileFromSupabase, uploadFileToSupabase } from '../utils/supabaseUtils';

export default function UebersichtPage() {
    const { session, projects, clients, employees, members, allocations, fetchData, setClients, setEmployees, setProjects } = useApp();

    // Calculate joined IDs for modal
    const activeUser = employees.find(e => e.email?.toLowerCase() === session?.user?.email?.toLowerCase());
    const joinedProjectIds = members
        ?.filter((m: any) => m.employee_id === activeUser?.id)
        .map((m: any) => m.project_id) || [];
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    // -- FILTER PROJECTS: Show only "My Projects" --
    // Definition: PM, Member, Has Tasks, OR Has Allocations
    const myProjects = useMemo(() => {
        if (!activeUser) return [];
        return projects.filter(p => {
            const isPM = p.project_manager_id === activeUser.id;
            const hasTasks = p.todos?.some(t => t.assigned_to === activeUser.id && !t.is_done);
            const isMember = members?.some((m: any) => m.project_id === p.id && m.employee_id === activeUser.id);
            const hasAllocations = allocations?.some((a: any) => a.project_id === p.id && a.employee_id === activeUser.id && (a.monday + a.tuesday + a.wednesday + a.thursday + a.friday) > 0);
            return isPM || hasTasks || isMember || hasAllocations;
        });
    }, [projects, activeUser, members, allocations]);

    // Modal States
    const [clientModalOpen, setClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: () => { } });
    const [todaysHours, setTodaysHours] = useState(0); // NEW
    const [timeModalOpen, setTimeModalOpen] = useState(false); // NEW
    const [pendingProject, setPendingProject] = useState<Project | null>(null); // Project awaiting membership confirmation
    const [joinConfirmOpen, setJoinConfirmOpen] = useState(false); // Join confirmation modal
    const isInternalNavigationRef = useRef(false); // Track if navigation is from within the app (not URL change)
    const scrollContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

    // Helper to check if user is member of a project
    const isUserMemberOfProject = (projectId: string) => {
        if (!activeUser) return false;
        const project = projects.find(p => p.id === projectId);
        if (!project) return false;
        const isPM = project.project_manager_id === activeUser.id;
        const isMember = members?.some((m: any) => m.project_id === projectId && m.employee_id === activeUser.id);
        return isPM || isMember;
    };

    // URL Param Sync & State Management (only for external navigation/deep links)
    useEffect(() => {
        // Skip if this was an internal navigation (we already handled it)
        if (isInternalNavigationRef.current) {
            isInternalNavigationRef.current = false;
            return;
        }

        const pId = searchParams.get('project_id') || searchParams.get('projectId');
        if (pId && projects.length > 0) {
            const found = projects.find(p => p.id === pId);
            if (found && found.id !== selectedProject?.id) {
                // Check if user is member
                if (isUserMemberOfProject(pId)) {
                    setSelectedProject(found);
                } else {
                    // Show join confirmation
                    setPendingProject(found);
                    setJoinConfirmOpen(true);
                }
            }
        } else if (!pId && selectedProject) {
            setSelectedProject(null);
        }
    }, [searchParams, projects, activeUser, members]);

    // NEW: Fetch Today's Hours
    useEffect(() => {
        if (activeUser) fetchTodaysHours();
    }, [activeUser]);

    const fetchTodaysHours = async () => {
        if (!activeUser) return;
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('time_entries')
            .select('hours')
            .eq('employee_id', activeUser.id)
            .eq('date', today);

        if (data) {
            const sum = data.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
            setTodaysHours(sum);
        }
    };

    // Filter Logic for Stats (using myProjects instead of all projects)
    const stats = useMemo(() => {
        if (!myProjects) return { activeProjects: 0, openTasks: 0, nextDeadline: null };
        const activeCount = myProjects.filter(p => ['Bearbeitung', 'In Umsetzung'].includes(p.status)).length;
        const openTaskCount = myProjects.reduce((acc, curr) => acc + ((curr.totalTodos || 0) - (curr.doneTodos || 0)), 0);

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const futureProjects = myProjects
            .filter(proj => proj.deadline && new Date(proj.deadline) >= today)
            .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
        return { activeProjects: activeCount, openTasks: openTaskCount, nextDeadline: futureProjects[0] || null };
    }, [myProjects]);


    // -- Action Handlers (Replicated from page.tsx) --

    // Clients
    const handleSaveClient = async (clientData: any) => {
        const p = { ...clientData, organization_id: activeUser?.organization_id };
        if (editingClient) {
            const { data } = await supabase.from('clients').update(p).eq('id', editingClient.id).select();
            if (data) setClients(clients.map(c => c.id === data[0].id ? data[0] : c));
        } else {
            const { data } = await supabase.from('clients').insert([p]).select();
            if (data) setClients([...clients, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setClientModalOpen(false);
    };


    // Employees
    const handleSaveEmployee = async (name: string) => {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const p = { name, initials };
        if (editingEmployee) {
            const { data } = await supabase.from('employees').update(p).eq('id', editingEmployee.id).select();
            if (data) setEmployees(employees.map(e => e.id === data[0].id ? data[0] : e));
        } else {
            const { data } = await supabase.from('employees').insert([p]).select();
            if (data) setEmployees([...employees, data[0]]);
        }
        setEmployeeModalOpen(false);
    };

    // Projects
    const handleCreateProject = async (data: { title: string; jobNr: string; clientId: string; pmId: string }) => {
        const { data: newProject } = await supabase.from('projects').insert([{
            title: data.title, job_number: data.jobNr, client_id: data.clientId, project_manager_id: data.pmId || null, status: 'Bearbeitung', organization_id: activeUser?.organization_id
        }]).select().single();

        if (newProject && activeUser) {
            await supabase.from('project_members').insert([{
                project_id: newProject.id,
                employee_id: activeUser.id,
                organization_id: activeUser.organization_id,
                role: 'member'
            }]);
        }

        fetchData();
        setCreateProjectOpen(false);
    };

    const handleSelectProject = (project: Project) => {
        // Check if user is member
        if (!isUserMemberOfProject(project.id)) {
            setPendingProject(project);
            setJoinConfirmOpen(true);
            return;
        }
        setSelectedProject(project);
        isInternalNavigationRef.current = true; // Prevent useEffect from re-checking
        scrollContainerRef.current?.scrollTo(0, 0); // Scroll container to top
        const params = new URLSearchParams(searchParams.toString());
        params.set('project_id', project.id);
        router.push(`/uebersicht?${params.toString()}`);
    };

    const handleCloseProject = () => {
        setSelectedProject(null);
        scrollContainerRef.current?.scrollTo(0, 0); // Scroll container to top
        router.push('/uebersicht');
    };

    const handleConfirmJoin = async () => {
        if (!pendingProject || !activeUser) return;
        await handleJoinProject(pendingProject.id);
        setJoinConfirmOpen(false);
        setSelectedProject(pendingProject);
        isInternalNavigationRef.current = true; // Prevent useEffect from re-checking
        scrollContainerRef.current?.scrollTo(0, 0); // Scroll container to top
        const params = new URLSearchParams(searchParams.toString());
        params.set('project_id', pendingProject.id);
        router.push(`/uebersicht?${params.toString()}`);
        setPendingProject(null);
    };

    const handleCancelJoin = () => {
        setJoinConfirmOpen(false);
        setPendingProject(null);
        // Remove project_id from URL if it was set
        router.push('/uebersicht');
    };

    const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
        const { data } = await supabase.from('projects').update(updates).eq('id', id).select();
        if (data) {
            await fetchData();
            const updated = projects.find(p => p.id === id);
            // Keep selectedProject in sync, but no URL change needed
            if (updated) setSelectedProject({ ...updated, ...updates } as any);
        }
    };

    const handleDeleteProject = () => {
        if (!selectedProject) return;
        setConfirmConfig({
            title: "Projekt löschen?",
            message: "Sicher?",
            action: async () => {
                await supabase.from('projects').delete().eq('id', selectedProject.id);
                setProjects(projects.filter(p => p.id !== selectedProject.id));
                handleCloseProject();
            }
        });
        setConfirmOpen(true);
    };

    const handleJoinProject = async (projectId: string) => {
        if (!activeUser) return;
        const { error } = await supabase.from('project_members').insert([{
            project_id: projectId,
            employee_id: activeUser.id,
            organization_id: activeUser.organization_id,
            role: 'member'
        }]);
        if (error) console.error(error);
        fetchData();
    };

    return (
        <div className="h-full w-full">
            <div ref={scrollContainerRef} className="h-full overflow-y-auto p-4 md:p-8">
                {selectedProject ? (
                    <ProjectDetail
                        project={selectedProject}
                        employees={employees}
                        currentEmployee={activeUser}
                        onClose={handleCloseProject}
                        onUpdateProject={handleUpdateProject}
                        onDeleteProject={handleDeleteProject}
                    />
                ) : (
                    <DashboardView
                        projects={myProjects}
                        clients={clients}
                        employees={employees}
                        stats={stats}
                        selectedClient={selectedClient}
                        onSelectProject={handleSelectProject}
                        onSelectClient={setSelectedClient}

                        onOpenCreateModal={() => setCreateProjectOpen(true)}
                        todaysHours={todaysHours}
                        onAddTime={() => setTimeModalOpen(true)}
                    />
                )}
            </div>

            {/* Modals */}
            <ClientModal isOpen={clientModalOpen} client={editingClient} onClose={() => setClientModalOpen(false)} onSave={handleSaveClient} />
            <EmployeeModal isOpen={employeeModalOpen} employee={editingEmployee} onClose={() => setEmployeeModalOpen(false)} onSave={handleSaveEmployee} onDelete={async () => { }} />
            <CreateProjectModal
                isOpen={createProjectOpen}
                clients={clients}
                employees={employees}
                projects={projects}
                joinedProjectIds={joinedProjectIds}
                currentUserId={activeUser?.id || ''}
                onClose={() => setCreateProjectOpen(false)}
                onCreate={handleCreateProject}
                onJoin={handleJoinProject}
            />
            {activeUser && (
                <TimeEntryModal
                    isOpen={timeModalOpen}
                    onClose={() => setTimeModalOpen(false)}
                    currentUser={activeUser}
                    projects={projects}
                    onEntryCreated={() => {
                        fetchTodaysHours();
                        setTimeModalOpen(false);
                    }}
                />
            )}
            <ConfirmModal isOpen={confirmOpen} title={confirmConfig.title} message={confirmConfig.message} onConfirm={() => { confirmConfig.action(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} />

            {/* Join Project Confirmation Modal */}
            <ConfirmModal
                isOpen={joinConfirmOpen}
                title="Projekt beitreten?"
                message={`Du bist dem Projekt "${pendingProject?.title}" noch nicht zugewiesen. Möchtest du dich jetzt zuweisen?`}
                onConfirm={handleConfirmJoin}
                onCancel={handleCancelJoin}
                confirmText="Zuweisen"
                cancelText="Abbrechen"
                type="info"
            />
        </div>
    );
}
