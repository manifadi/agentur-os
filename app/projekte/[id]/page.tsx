'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../supabaseClient';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { Project } from '../../types';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ArrowLeft, Loader2 } from 'lucide-react';

// Detailansicht zieht @react-pdf/renderer → erst beim Öffnen laden.
const ProjectDetail = dynamic(() => import('../../components/Projects/ProjectDetail'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center py-32 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="animate-spin mr-2" /> Projekt wird geladen…
        </div>
    ),
});

export default function ProjektDetailPage() {
    const params = useParams();
    const id = (Array.isArray(params?.id) ? params?.id[0] : params?.id) as string;
    const router = useRouter();
    const { projects, employees, members, currentUser, setProjects, fetchData, loading, previousModule } = useApp();

    const project = projects.find(p => p.id === id) || null;
    usePageTitle(project ? project.title : 'Projekt');

    const [confirmDelete, setConfirmDelete] = useState(false);

    const goBack = () => router.push(previousModule.path);

    const isMember = !!currentUser && !!project && (
        project.project_manager_id === currentUser.id
        || (members?.some((m: any) => m.project_id === project.id && m.employee_id === currentUser.id) ?? false)
    );

    // ── Handlers ──────────────────────────────────────────────
    const handleUpdateProject = async (pid: string, updates: Partial<Project>) => {
        const { data, error } = await supabase.from('projects').update(updates).eq('id', pid).select();
        if (error) { toast.error('Änderungen konnten nicht gespeichert werden.'); return; }
        if (data) {
            await fetchData();
            // Status-only-Updates haben ihren eigenen Toast
            if (!('status' in updates && Object.keys(updates).length === 1)) {
                toast.success('Änderungen gespeichert.');
            }
        }
    };

    const handleDeleteProject = () => setConfirmDelete(true);

    const doDelete = async () => {
        if (!project) return;
        const { error } = await supabase.from('projects').delete().eq('id', project.id);
        if (error) { toast.error('Projekt konnte nicht gelöscht werden.'); return; }
        setProjects(projects.filter(p => p.id !== project.id));
        setConfirmDelete(false);
        toast.success('Projekt gelöscht.');
        router.push(previousModule.path);
    };

    const handleJoin = async () => {
        if (!currentUser || !project) return;
        const { error } = await supabase.from('project_members').insert([{
            project_id: project.id,
            employee_id: currentUser.id,
            organization_id: currentUser.organization_id,
            role: 'member',
        }]);
        if (error) { toast.error('Beitritt fehlgeschlagen.'); return; }
        await fetchData();
        toast.success('Projekt beigetreten.');
    };

    // ── States ────────────────────────────────────────────────
    // Noch am Laden (Projekte noch nicht da)
    if (loading && projects.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="animate-spin mr-2" /> Lade…
            </div>
        );
    }

    // Projekt nicht gefunden
    if (!project) {
        return (
            <div className="h-full w-full overflow-y-auto p-4 md:p-8">
                <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors group mb-8">
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    {previousModule.label}
                </button>
                <div className="max-w-md mx-auto text-center py-24">
                    <div className="text-base font-bold text-text-primary mb-1">Projekt nicht gefunden</div>
                    <div className="text-sm text-text-muted">Es existiert nicht (mehr) oder du hast keinen Zugriff.</div>
                </div>
            </div>
        );
    }

    // Kein Mitglied → Beitritts-Abfrage (gilt für alle Einstiegspunkte/Deep-Links)
    if (!isMember) {
        return (
            <div className="h-full w-full overflow-y-auto p-4 md:p-8">
                <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors group mb-8">
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    {previousModule.label}
                </button>
                <ConfirmModal
                    isOpen={true}
                    title="Projekt beitreten?"
                    message={`Du bist dem Projekt „${project.title}" noch nicht zugewiesen. Möchtest du dich jetzt zuweisen?`}
                    onConfirm={handleJoin}
                    onCancel={goBack}
                    confirmText="Zuweisen"
                    cancelText="Abbrechen"
                    type="info"
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-y-auto p-4 md:p-8">
            <ProjectDetail
                project={project}
                employees={employees}
                currentEmployee={currentUser}
                onClose={goBack}
                backLabel={previousModule.label}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
            />

            <ConfirmModal
                isOpen={confirmDelete}
                title="Projekt löschen?"
                message={`„${project.title}" wird unwiderruflich gelöscht.`}
                onConfirm={doDelete}
                onCancel={() => setConfirmDelete(false)}
                type="danger"
                confirmText="Löschen"
            />
        </div>
    );
}
