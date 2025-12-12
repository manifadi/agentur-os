'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import DashboardView from '../components/Dashboard/DashboardView';
import ContextSidebar from '../components/ContextSidebar';
import ProjectDetail from '../components/Projects/ProjectDetail';
import ClientModal from '../components/Modals/ClientModal';
import EmployeeModal from '../components/Modals/EmployeeModal';
import CreateProjectModal from '../components/Modals/CreateProjectModal';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { supabase } from '../supabaseClient';
import { Project, Client, Employee } from '../types';
import { deleteFileFromSupabase, uploadFileToSupabase } from '../utils/supabaseUtils';

export default function UebersichtPage() {
    const { session, projects, clients, employees, fetchData, setClients, setEmployees, setProjects } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    // Modal States
    const [clientModalOpen, setClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: () => { } });

    // URL Param Sync
    useEffect(() => {
        const pId = searchParams.get('projectId');
        if (pId && projects.length > 0) {
            const found = projects.find(p => p.id === pId);
            if (found) setSelectedProject(found);
        }
    }, [searchParams, projects]);

    const activeUser = employees.find(e => e.email === session?.user?.email);

    // Filter Logic for Stats
    const stats = useMemo(() => {
        if (!projects) return { activeProjects: 0, openTasks: 0, nextDeadline: null };
        const activeCount = projects.filter(p => ['Bearbeitung', 'In Umsetzung'].includes(p.status)).length;
        const openTaskCount = projects.reduce((acc, curr) => acc + ((curr.totalTodos || 0) - (curr.doneTodos || 0)), 0);

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const futureProjects = projects
            .filter(proj => proj.deadline && new Date(proj.deadline) >= today)
            .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
        return { activeProjects: activeCount, openTasks: openTaskCount, nextDeadline: futureProjects[0] || null };
    }, [projects]);


    // -- Action Handlers (Replicated from page.tsx) --

    // Clients
    const handleSaveClient = async (name: string, logo: File | null) => {
        let logoUrl = editingClient?.logo_url;
        if (logo) {
            if (logoUrl) await deleteFileFromSupabase(logoUrl, 'logos');
            logoUrl = await uploadFileToSupabase(logo, 'logos');
        }
        const p = { name, logo_url: logoUrl };
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
        await supabase.from('projects').insert([{
            title: data.title, job_number: data.jobNr, client_id: data.clientId, project_manager_id: data.pmId || null, status: 'Bearbeitung'
        }]);
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
                setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
                setSelectedProject(null);
                router.replace('/uebersicht'); // Clear URL param
            }
        });
        setConfirmOpen(true);
    };

    return (
        <div className="flex h-full">
            {/* Sidebar (Hidden if Viewing Project?) - Original Logic: hidden if selectedProject. 
                Wait, user requirements usually imply Sidebar stays. 
                But in 'page.tsx', ContextSidebar was hidden if ViewState != 'projects_overview' or if selectedProject was set?
                Looking at page.tsx:
                {currentView === 'projects_overview' && !selectedProject && ( ... ContextSidebar )}
                So yes, sidebar hides when detail view opens.
            */}
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
                        projects={projects}
                        clients={clients}
                        employees={employees}
                        stats={stats}
                        selectedClient={selectedClient}
                        onSelectProject={(p) => setSelectedProject(p)}
                        onSelectClient={setSelectedClient}
                        onOpenCreateModal={() => setCreateProjectOpen(true)}
                    />
                )}
            </div>

            {/* Modals */}
            <ClientModal isOpen={clientModalOpen} client={editingClient} onClose={() => setClientModalOpen(false)} onSave={handleSaveClient} onDelete={() => { }} />
            <EmployeeModal isOpen={employeeModalOpen} employee={editingEmployee} onClose={() => setEmployeeModalOpen(false)} onSave={handleSaveEmployee} onDelete={() => { }} />
            <CreateProjectModal isOpen={createProjectOpen} clients={clients} employees={employees} onClose={() => setCreateProjectOpen(false)} onCreate={handleCreateProject} />
            <ConfirmModal isOpen={confirmOpen} title={confirmConfig.title} message={confirmConfig.message} onConfirm={() => { confirmConfig.action(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} />
        </div>
    );
}
