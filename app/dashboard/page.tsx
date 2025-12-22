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
    const { session, employees, projects, allocations, clients, members, fetchData, setClients } = useApp();

    // Local state for modals triggers
    const [createProjectOpen, setCreateProjectOpen] = useState(false);
    const [createClientOpen, setCreateClientOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);

    const currentUser = employees.find(e => e.email?.toLowerCase() === session?.user?.email?.toLowerCase());

    // Actions
    const handleToggleTodo = async (todoId: string, isDone: boolean) => {
        // Optimistic update in Context would be ideal, but for now just trigger DB + simple refetch or let Realtime handle it. 
        // Since Context has 'setProjects', we could optimistically update it too, but let's stick to consistency first.
        await supabase.from('todos').update({ is_done: isDone }).eq('id', todoId);
        fetchData();
    };

    const handleCreateProject = async (data: { title: string; jobNr: string; clientId: string; pmId: string }) => {
        const { data: newProject } = await supabase.from('projects').insert([{
            title: data.title, job_number: data.jobNr, client_id: data.clientId, project_manager_id: data.pmId || null, status: 'Bearbeitung', organization_id: currentUser?.organization_id
        }]).select().single();

        if (newProject && currentUser) {
            // 1. Add creator as member automatically
            await supabase.from('project_members').insert([{
                project_id: newProject.id,
                employee_id: currentUser.id,
                role: 'member' // or 'owner' if we had that role
            }]);

            // 2. If PM is selected and DIFFERENT from creator, add them too?
            // Usually DB FK ensures PM is linked, but project_members is for "My List".
            // If I assign someone else, they should see it. The logic "isPM" handles that.
            // So we only need to ensure CREATOR sees it if they are NOT the PM.
        }

        fetchData();
        setCreateProjectOpen(false);
    };

    const handleCreateClient = async (name: string, logo: File | null) => {
        // Reuse upload logic if possible or move to utils? Ideally use same logic as Uebersicht.
        // For now, simplified:
        let logoUrl = undefined;
        // NOTE: we need uploadFileToSupabase import if we want logos. 
        // Let's assume for Quick Action, maybe just name? Or we import the util.
        // We need to import `uploadFileToSupabase`.

        const p = { name, logo_url: logoUrl, organization_id: currentUser?.organization_id };
        const { data } = await supabase.from('clients').insert([p]).select();

        if (data) {
            setClients([...clients, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setCreateClientOpen(false);
    };

    const handleJoinProject = async (projectId: string) => {
        if (!currentUser) return;

        // Check if already member? The DB might throw unique constraint error, let's catch it or just insert.
        // The modal logic might filter, but safety first.
        const { error } = await supabase.from('project_members').insert([{
            project_id: projectId,
            employee_id: currentUser.id,
            role: 'member'
        }]);

        if (error) {
            // duplicate key value violates unique constraint usually means already member
            console.error('Join error:', error);
        }

        fetchData();
        // Keep modal open to show status change
        // setCreateProjectOpen(false); 
    };

    // Calcluate joined projects IDs (Member table)
    const joinedProjectIds = members
        ?.filter((m: any) => m.employee_id === currentUser?.id)
        .map((m: any) => m.project_id) || [];

    return (
        <div className="p-4 md:p-8 h-full">
            <UserDashboard
                onSelectProject={(p) => router.push(`/uebersicht?projectId=${p.id}`)}
                onToggleTodo={handleToggleTodo}
                onQuickAction={(action) => {
                    if (action === 'create_project') setCreateProjectOpen(true);
                    if (action === 'create_client') setCreateClientOpen(true);
                }}
            />

            <ClientModal isOpen={createClientOpen} client={null} onClose={() => setCreateClientOpen(false)} onSave={handleCreateClient} onDelete={async () => { }} />

            <CreateProjectModal
                isOpen={createProjectOpen}
                clients={clients}
                employees={employees}
                projects={projects}
                joinedProjectIds={joinedProjectIds}
                currentUserId={currentUser?.id || ''}
                onClose={() => setCreateProjectOpen(false)}
                onCreate={handleCreateProject}
                onJoin={handleJoinProject}
            />
        </div>
    );
}
