'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Menu as MenuIcon } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Project, Client, Employee, ViewState, Todo, ProjectLog } from './types';
import { uploadFileToSupabase, deleteFileFromSupabase } from './utils/supabaseUtils';

// Components
// Components
import LoginScreen from './components/LoginScreen';
// import Sidebar from './components/Sidebar'; -- REMOVED
import MainSidebar from './components/MainSidebar';
import ContextSidebar from './components/ContextSidebar';
import DashboardView from './components/Dashboard/DashboardView'; // This is now 'projects_overview'
import UserDashboard from './components/Dashboard/UserDashboard'; // This is now 'dashboard'
import ProjectDetail from './components/Projects/ProjectDetail';
import GlobalTasks from './components/Tasks/GlobalTasks';
import ResourcePlanner from './components/ResourcePlanner/ResourcePlanner';
import Settings from './components/Profile/Settings';

// Modals
import ClientModal from './components/Modals/ClientModal';
import EmployeeModal from './components/Modals/EmployeeModal';
import CreateProjectModal from './components/Modals/CreateProjectModal';
import ConfirmModal from './components/Modals/ConfirmModal';

export default function AgenturDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);

  // UI State
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // NOTE: mobileMenuOpen is less relevant with the new layout on desktop, but let's keep it simply false for now or unimplemented for MVP of this Refactor
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dashboard Stats (Only for Projects Overview)
  const [stats, setStats] = useState({ activeProjects: 0, openTasks: 0, nextDeadline: null as Project | null });

  // Modals
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: () => { } });

  // --- INIT & FETCH ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoadingSession(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session]);

  const fetchData = async () => {
    setLoading(true);
    const { data: c } = await supabase.from('clients').select('*').order('name');
    if (c) setClients(c);
    const { data: e } = await supabase.from('employees').select('*').order('name');
    if (e) setEmployees(e);
    const { data: d } = await supabase.from('departments').select('*').order('name');
    if (d) setDepartments(d);

    // FETCH ALLOCATIONS
    const { data: allocs } = await supabase.from('resource_allocations').select('*');
    if (allocs) setAllocations(allocs);

    // FETCH PROJECTS WITH TODOS
    const { data: p } = await supabase
      .from('projects')
      .select(`
        *, 
        employees ( id, name, initials ), 
        clients ( name, logo_url ), 
        todos ( * )
      `)
      .order('created_at', { ascending: false });

    if (p) {
      // Process stats
      const projectsWithStats = p.map(proj => {
        const totalTodos = proj.todos ? proj.todos.length : 0;
        const doneTodos = proj.todos ? proj.todos.filter((t: Todo) => t.is_done).length : 0;
        const openTodosPreview = proj.todos ? proj.todos.filter((t: Todo) => !t.is_done).slice(0, 3) : [];
        return { ...proj, totalTodos, doneTodos, openTodosPreview };
      });
      setProjects(projectsWithStats as any);

      const activeCount = projectsWithStats.filter(proj => ['Bearbeitung', 'In Umsetzung'].includes(proj.status)).length;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const futureProjects = projectsWithStats
        .filter(proj => proj.deadline && new Date(proj.deadline) >= today)
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
      const nextDl = futureProjects.length > 0 ? futureProjects[0] : null;
      const openTaskCount = projectsWithStats.reduce((acc, curr) => acc + (curr.totalTodos - curr.doneTodos), 0);
      setStats({ activeProjects: activeCount, openTasks: openTaskCount, nextDeadline: nextDl as any });
    }
    setLoading(false);
  };

  // --- ACTIONS ---
  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setProjects([]); };
  const openConfirm = (title: string, message: string, action: () => void) => { setConfirmConfig({ title, message, action }); setConfirmOpen(true); };

  // Client Actions
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
  const handleDeleteClient = async (id: string) => {
    openConfirm("Kunde löschen?", "Alle Projekte werden gelöscht.", async () => {
      await supabase.from('clients').delete().eq('id', id);
      setClients(clients.filter(c => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
    });
  };

  // Employee Actions
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
  const handleDeleteEmployee = async (id: string) => {
    openConfirm("Löschen?", "Weg.", async () => {
      await supabase.from('employees').delete().eq('id', id);
      setEmployees(employees.filter(e => e.id !== id));
    });
  };

  // Project Actions
  const handleCreateProject = async (data: { title: string; jobNr: string; clientId: string; pmId: string }) => {
    await supabase.from('projects').insert([{
      title: data.title,
      job_number: data.jobNr,
      client_id: data.clientId,
      project_manager_id: data.pmId || null,
      deadline: null,
      status: 'Bearbeitung'
    }]);
    fetchData();
    setCreateProjectModalOpen(false);
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>) => {
    const { data } = await supabase.from('projects').update(updates).eq('id', id).select();
    if (data) {
      await fetchData(); // Refresh to update view
      const updated = projects.find(p => p.id === id); // old
      if (updated) setSelectedProject({ ...updated, ...updates } as any);
    }
  };

  const handleDeleteProject = () => {
    if (!selectedProject) return;
    openConfirm("Projekt löschen?", "Sicher?", async () => {
      await supabase.from('projects').delete().eq('id', selectedProject.id);
      setProjects(prev => prev.filter(p => p.id !== selectedProject!.id));
    });
  };

  const handleToggleTodo = async (todoId: string, isDone: boolean) => {
    await supabase.from('todos').update({ is_done: isDone }).eq('id', todoId);
    // Optimistic update
    const updatedProjects = projects.map(p => {
      if (!p.todos) return p;
      return {
        ...p,
        todos: p.todos.map(t => t.id === todoId ? { ...t, is_done: isDone } : t)
      };
    });
    setProjects(updatedProjects as any);
  };


  if (loadingSession) return <div className="flex h-screen items-center justify-center text-gray-400 font-medium">Lade App...</div>;
  if (!session) return <LoginScreen />;

  const currentUser = employees.find(e => e.email === session?.user?.email);

  return (
    <div className="flex h-screen w-full bg-[#F9FAFB] text-gray-900 font-sans overflow-hidden">

      {/* 1. MAIN SIDEBAR (Always Visible) */}
      <MainSidebar
        currentView={currentView}
        setCurrentView={(v) => {
          setCurrentView(v);
          if (v !== 'projects_overview') setSelectedProject(null);
        }}
        handleLogout={handleLogout}
      />

      {/* 2. CONTEXT SIDEBAR (Only in Projects Overview) */}
      {currentView === 'projects_overview' && !selectedProject && (
        <div className="ml-20 flex-shrink-0 h-full"> {/* Wrapper to push it right */}
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

      {/* 3. MAIN CONTENT AREA */}
      {/* 
          MainSidebar is fixed w-20 (80px).
          If ContextSidebar is present, it has ml-20. Main content follows naturally.
          If ContextSidebar is NOT present, Main content needs ml-20 to avoid being hidden.
      */}
      <main className={`flex-1 h-full overflow-y-auto relative ${currentView === 'projects_overview' && !selectedProject ? '' : 'ml-20'}`}>
        <div className="p-4 md:p-8 h-full">
          {selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              employees={employees}
              currentEmployee={currentUser}
              onClose={() => { setSelectedProject(null); fetchData(); }}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
            />
          ) : currentView === 'global_tasks' ? (
            <GlobalTasks
              projects={projects}
              employees={employees}
              onSelectProject={setSelectedProject}
              onUpdate={fetchData}
            />
          ) : currentView === 'resource_planning' ? (
            <ResourcePlanner
              employees={employees}
              projects={projects}
            />
          ) : currentView === 'settings' ? (
            <Settings
              session={session}
              employees={employees}
              departments={departments}
              onUpdate={fetchData}
            />
          ) : currentView === 'projects_overview' ? (
            <DashboardView
              projects={projects}
              clients={clients}
              employees={employees}
              stats={stats}
              selectedClient={selectedClient}
              onSelectProject={setSelectedProject}
              onOpenCreateModal={() => setCreateProjectModalOpen(true)}
            />
          ) : (
            /* DEFAULT: USER DASHBOARD */
            <UserDashboard
              currentUser={currentUser}
              projects={projects}
              allocations={allocations}
              onSelectProject={(p) => { setSelectedProject(p); }}
              onToggleTodo={handleToggleTodo}
              onQuickAction={(action) => {
                if (action === 'create_project') setCreateProjectModalOpen(true);
                if (action === 'create_client') { setEditingClient(null); setClientModalOpen(true); }
              }}
            />
          )}
        </div>
      </main>

      {/* --- MODALS --- */}
      <ConfirmModal
        isOpen={confirmOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => { confirmConfig.action(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ClientModal
        isOpen={clientModalOpen}
        client={editingClient}
        onClose={() => setClientModalOpen(false)}
        onSave={handleSaveClient}
        onDelete={handleDeleteClient}
      />

      <EmployeeModal
        isOpen={employeeModalOpen}
        employee={editingEmployee}
        onClose={() => setEmployeeModalOpen(false)}
        onSave={handleSaveEmployee}
        onDelete={handleDeleteEmployee}
      />

      <CreateProjectModal
        isOpen={createProjectModalOpen}
        clients={clients}
        employees={employees}
        onClose={() => setCreateProjectModalOpen(false)}
        onCreate={handleCreateProject}
      />

    </div>
  );
}