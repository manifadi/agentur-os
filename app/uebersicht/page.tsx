'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import DashboardView from '../components/Dashboard/DashboardView';
import TimeEntryModal from '../components/Modals/TimeEntryModal';
import ClientModal from '../components/Modals/ClientModal';
import EmployeeModal from '../components/Modals/EmployeeModal';
import CreateProjectModal from '../components/Modals/CreateProjectModal';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { supabase } from '../supabaseClient';
import { Project, Client, Employee } from '../types';
import { toast } from 'sonner';
import { usePageTitle } from '../hooks/usePageTitle';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Projekt-Detail lebt jetzt unter /projekte/[id] (eigene Route → Browser-Back,
// Deep-Links, kontextsensitiver Zurück-Button). Diese Seite ist nur noch die Liste.
export default function UebersichtPage() {
    const { session, projects, clients, employees, members, allocations, fetchData, setClients, setEmployees } = useApp();
    usePageTitle('Projekte');

    const activeUser = employees.find(e => e.email?.toLowerCase() === session?.user?.email?.toLowerCase());
    const joinedProjectIds = members
        ?.filter((m: any) => m.employee_id === activeUser?.id)
        .map((m: any) => m.project_id) || [];
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    // Filter persistent (localStorage) — bleiben beim Öffnen/Zurück eines Projekts erhalten
    const [activeStatus, setActiveStatus] = useLocalStorage<string[]>('uebersicht:status', []);
    const [activePmId, setActivePmId] = useLocalStorage<string | null>('uebersicht:pm', null);
    const [sortOrder, setSortOrder] = useLocalStorage<'deadline_asc' | 'deadline_desc' | 'created_desc' | 'title_asc'>('uebersicht:sort', 'created_desc');

    // -- Nur "Meine Projekte": PM, Member, eigene Aufgaben oder Allokationen --
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
    const [todaysHours, setTodaysHours] = useState(0);
    const [timeModalOpen, setTimeModalOpen] = useState(false);
    const [pendingProject, setPendingProject] = useState<Project | null>(null);
    const [joinConfirmOpen, setJoinConfirmOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const isUserMemberOfProject = (projectId: string) => {
        if (!activeUser) return false;
        const project = projects.find(p => p.id === projectId);
        if (!project) return false;
        const isPM = project.project_manager_id === activeUser.id;
        const isMember = members?.some((m: any) => m.project_id === projectId && m.employee_id === activeUser.id);
        return isPM || isMember;
    };

    // Deep-Links / Alt-Links umleiten: ?action=create öffnet das Modal,
    // ?project_id/?projectId → neue Detail-Route (Zusatzparameter bleiben erhalten).
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'create') {
            setCreateProjectOpen(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('action');
            router.replace(`/uebersicht${params.toString() ? '?' + params.toString() : ''}`);
            return;
        }

        const pId = searchParams.get('project_id') || searchParams.get('projectId');
        if (pId) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('project_id');
            params.delete('projectId');
            const qs = params.toString();
            router.replace(`/projekte/${pId}${qs ? '?' + qs : ''}`);
        }
    }, [searchParams, router]);

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
        if (data) setTodaysHours(data.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0));
    };

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

    // -- Handlers --
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

    const handleCreateProject = async (data: { title: string; jobNr: string; clientId: string; pmId: string; deadline?: string }) => {
        const { data: newProject, error } = await supabase.from('projects').insert([{
            title: data.title, job_number: data.jobNr, client_id: data.clientId, project_manager_id: data.pmId || null, status: 'Bearbeitung', deadline: data.deadline || null, organization_id: activeUser?.organization_id
        }]).select().single();
        if (error) { toast.error('Projekt konnte nicht erstellt werden.'); return; }
        if (newProject && activeUser) {
            await supabase.from('project_members').insert([{
                project_id: newProject.id, employee_id: activeUser.id, organization_id: activeUser.organization_id, role: 'member'
            }]);
        }
        fetchData();
        setCreateProjectOpen(false);
        toast.success(`„${data.title}" wurde erstellt.`);
    };

    const openProject = (projectId: string) => router.push(`/projekte/${projectId}`);

    const handleSelectProject = (project: Project) => {
        if (!isUserMemberOfProject(project.id)) {
            setPendingProject(project);
            setJoinConfirmOpen(true);
            return;
        }
        openProject(project.id);
    };

    const handleConfirmJoin = async () => {
        if (!pendingProject || !activeUser) return;
        await handleJoinProject(pendingProject.id);
        setJoinConfirmOpen(false);
        const target = pendingProject.id;
        setPendingProject(null);
        openProject(target);
    };

    const handleCancelJoin = () => {
        setJoinConfirmOpen(false);
        setPendingProject(null);
    };

    const handleJoinProject = async (projectId: string) => {
        if (!activeUser) return;
        const { error } = await supabase.from('project_members').insert([{
            project_id: projectId, employee_id: activeUser.id, organization_id: activeUser.organization_id, role: 'member'
        }]);
        if (error) { toast.error('Beitritt fehlgeschlagen.'); return; }
        fetchData();
        toast.success('Projekt beigetreten.');
    };

    return (
        <div className="h-full w-full">
            <div ref={scrollContainerRef} className="h-full overflow-y-auto p-4 md:p-8">
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
                    activeStatus={activeStatus}
                    setActiveStatus={setActiveStatus}
                    activePmId={activePmId}
                    setActivePmId={setActivePmId}
                    sortOrder={sortOrder}
                    setSortOrder={setSortOrder}
                />
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
                    onEntryCreated={() => { fetchTodaysHours(); setTimeModalOpen(false); }}
                />
            )}

            {/* Beitritts-Bestätigung beim Öffnen eines fremden Projekts */}
            <ConfirmModal
                isOpen={joinConfirmOpen}
                title="Projekt beitreten?"
                message={`Du bist dem Projekt „${pendingProject?.title}" noch nicht zugewiesen. Möchtest du dich jetzt zuweisen?`}
                onConfirm={handleConfirmJoin}
                onCancel={handleCancelJoin}
                confirmText="Zuweisen"
                cancelText="Abbrechen"
                type="info"
            />
        </div>
    );
}
