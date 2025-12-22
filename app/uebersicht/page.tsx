'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import DashboardView from '../components/Dashboard/DashboardView';
import ContextSidebar from '../components/ContextSidebar';
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

    // URL Param Sync
    useEffect(() => {
        const pId = searchParams.get('projectId');
        if (pId && projects.length > 0) {
            const found = projects.find(p => p.id === pId);
            if (found) setSelectedProject(found);
        }
    }, [searchParams, projects]);

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
    const handleSaveClient = async (name: string, logo: File | null) => {
        let logoUrl = editingClient?.logo_url;
        if (logo) {
            if (logoUrl) await deleteFileFromSupabase(logoUrl, 'logos');
            logoUrl = await uploadFileToSupabase(logo, 'logos');
        }
        const p = { name, logo_url: logoUrl, organization_id: activeUser?.organization_id };
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
                role: 'member'
            }]);
        }

        fetchData();
        setCreateProjectOpen(false);
    };

    const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
        const { data } = await supabase.from('projects').update(updates).eq('id', id).select();
        if (data) {
            await fetchData();
            const updated = projects.find(p => p.id === id);
            // We need to fetch data again to get relations, but mostly we just need to keep `selectedProject` in sync
            if (updated) setSelectedProject({ ...updated, ...updates } as any); // Type cast simplified
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
                setSelectedProject(null);
                router.replace('/uebersicht'); // Clear URL param
            }
        });
        setConfirmOpen(true);
    };

    const handleJoinProject = async (projectId: string) => {
        if (!activeUser) return;
        const { error } = await supabase.from('project_members').insert([{
            project_id: projectId,
            employee_id: activeUser.id,
            role: 'member'
        }]);
        if (error) console.error(error);
        fetchData();
        // Keep modal open to show status change
        // setCreateProjectOpen(false); 
    };

    return (
        <div className="flex h-full">
            {/* Sidebar (Hidden if Viewing Project?) */}
            {!selectedProject && (
                <div className="flex-shrink-0 h-full">
                    <ContextSidebar
                        clients={clients}
                        employees={employees}
                        selectedClient={selectedClient}
                        setSelectedClient={setSelectedClient}
                        openClientModal={(c) => { setEditingClient(c); setClientModalOpen(true); }}
                        openEmployeeModal={(e) => { setEditingEmployee(e); setEmployeeModalOpen(true); }}
                        onResetSelection={() => setSelectedClient(null)}
                    />
                </div>
            )}

            <div className="flex-1 h-full overflow-y-auto p-4 md:p-8">
                {selectedProject ? (
                    <ProjectDetail
                        project={selectedProject}
                        employees={employees}
                        currentEmployee={activeUser}
                        onClose={() => {
                            setSelectedProject(null);
                            router.replace('/uebersicht');
                            fetchData();
                        }}
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
                        onSelectProject={(p) => setSelectedProject(p)}
                        onSelectClient={setSelectedClient}

                        onOpenCreateModal={() => setCreateProjectOpen(true)}
                        todaysHours={todaysHours}
                        onAddTime={() => setTimeModalOpen(true)}
                    />
                )}
            </div>

            {/* Modals */}
            <ClientModal isOpen={clientModalOpen} client={editingClient} onClose={() => setClientModalOpen(false)} onSave={handleSaveClient} onDelete={async () => { }} />
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
        </div>
    );
}
