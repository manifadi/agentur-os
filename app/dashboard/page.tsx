'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import UserDashboard from '../components/Dashboard/UserDashboard';
import { useApp } from '../context/AppContext';
import { Project, Todo } from '../types';
import { supabase } from '../supabaseClient';
import CreateProjectModal from '../components/Modals/CreateProjectModal';
import ClientModal from '../components/Modals/ClientModal';

export default function DashboardPage() {
    const router = useRouter();
    const { session, employees, projects, allocations, clients, fetchData } = useApp();

    // Local state for modals triggers
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    const [createClientOpen, setCreateClientOpen] = useState(false);

    const currentUser = employees.find(e => e.email === session?.user?.email);

    // Actions
    const handleToggleTodo = async (todoId: string, isDone: boolean) => {
        // Optimistic update in Context would be ideal, but for now just trigger DB + simple refetch or let Realtime handle it. 
        // Since Context has 'setProjects', we could optimistically update it too, but let's stick to consistency first.
        await supabase.from('todos').update({ is_done: isDone }).eq('id', todoId);
        fetchData();
    };

    const handleCreateProject = async (data: { title: string; jobNr: string; clientId: string; pmId: string }) => {
        await supabase.from('projects').insert([{
            title: data.title, job_number: data.jobNr, client_id: data.clientId, project_manager_id: data.pmId || null, status: 'Bearbeitung'
        }]);
        fetchData();
        setCreateProjectOpen(false);
    };

    const handleCreateClient = async (name: string, logo: File | null) => {
        // Simplified creation for quick action - might need full modal logic if we want logo upload here
        // For now reuse the modal logic? 
        // Actually, reusing the existing Modals is best.
        // But the Modals are currently in page.tsx actions. 
        // We should just pass the open handlers to UserDashboard.
        // And render the Modals here? Yes.
    };

    return (
        <div className="p-4 md:p-8 h-full">
            <UserDashboard
                currentUser={currentUser}
                projects={projects}
                allocations={allocations}
                onSelectProject={(p) => router.push(`/uebersicht?projectId=${p.id}`)}
                onToggleTodo={handleToggleTodo}
                onQuickAction={(action) => {
                    if (action === 'create_project') setCreateProjectOpen(true);
                    // For client creation, we'll need the full modal logic, keeping it simple for now or adding the modal here.
                    // Let's implement CreateProjectModal at least.
                }}
            />

            <CreateProjectModal
                isOpen={createProjectOpen}
                clients={clients}
                employees={employees}
                onClose={() => setCreateProjectOpen(false)}
                onCreate={handleCreateProject}
            />
        </div>
    );
}
