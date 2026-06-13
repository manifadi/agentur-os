import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, ChevronDown } from 'lucide-react';
import { Project, Client, Employee } from '../../types';
import ProjectList from '../Projects/ProjectList';
import TaskDetailSidebar from '../Tasks/TaskDetailSidebar';
import { supabase } from '../../supabaseClient';
import { Todo } from '../../types';
import { useApp } from '../../context/AppContext';
import ConfirmModal from '../Modals/ConfirmModal';
import { getStatusSortRank } from '../../utils';
import ProjectFilterBar, { SortOrder } from './ProjectFilterBar';

const PAGE_SIZE = 50;

interface DashboardViewProps {
    projects: Project[];
    clients: Client[];
    employees: Employee[];
    stats: { activeProjects: number; openTasks: number; nextDeadline: Project | null };
    selectedClient: Client | null;
    onSelectProject: (project: Project) => void;
    onSelectClient: (client: Client) => void;
    onOpenCreateModal: () => void;
    todaysHours: number;
    onAddTime: () => void;
    activeStatus: string[];
    setActiveStatus: (status: string[]) => void;
    activePmId: string | null;
    setActivePmId: (id: string | null) => void;
    sortOrder: SortOrder;
    setSortOrder: (order: SortOrder) => void;
}

export default function DashboardView({
    projects, clients, employees,
    selectedClient, onSelectProject, onSelectClient, onOpenCreateModal,
    activeStatus, setActiveStatus,
    activePmId, setActivePmId,
    sortOrder, setSortOrder,
}: DashboardViewProps) {
    const { fetchData } = useApp();
    const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

    // ── Filter state ───────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>(selectedClient ? [selectedClient.id] : []);
    // Convert legacy single-PM filter into multi-select
    const [selectedPmIds, setSelectedPmIds] = useState<string[]>(activePmId ? [activePmId] : []);
    const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

    // Sync external single-client prop → local multi-select state (e.g. via deep links)
    useEffect(() => {
        if (selectedClient && !selectedClientIds.includes(selectedClient.id)) {
            setSelectedClientIds([selectedClient.id]);
        }
    }, [selectedClient?.id]); // eslint-disable-line

    // Sync local multi-PM state → parent's single-PM prop (legacy)
    useEffect(() => {
        setActivePmId(selectedPmIds[0] || null);
    }, [selectedPmIds, setActivePmId]);

    // Reset pagination when filters change
    useEffect(() => {
        setDisplayLimit(PAGE_SIZE);
    }, [searchQuery, selectedClientIds, activeStatus, selectedPmIds, sortOrder]);

    // ── Filter + sort ──────────────────────────────────────
    const filteredProjects = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        const result = projects.filter(p => {
            if (selectedClientIds.length > 0 && !selectedClientIds.includes(p.client_id)) return false;
            if (activeStatus.length > 0 && !activeStatus.includes(p.status)) return false;
            if (selectedPmIds.length > 0 && !selectedPmIds.includes(p.project_manager_id || '')) return false;

            if (q) {
                const titleMatch = p.title?.toLowerCase().includes(q);
                const jobMatch = p.job_number?.toLowerCase().includes(q);
                const clientMatch = p.clients?.name?.toLowerCase().includes(q);
                if (!titleMatch && !jobMatch && !clientMatch) return false;
            }
            return true;
        });

        result.sort((a, b) => {
            const statusDiff = getStatusSortRank(a.status) - getStatusSortRank(b.status);
            if (statusDiff !== 0) return statusDiff;
            if (sortOrder === 'title_asc') return a.title.localeCompare(b.title);
            if (sortOrder === 'created_desc') return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
            const timeA = a.deadline ? new Date(a.deadline).getTime() : (sortOrder === 'deadline_asc' ? Infinity : -Infinity);
            const timeB = b.deadline ? new Date(b.deadline).getTime() : (sortOrder === 'deadline_asc' ? Infinity : -Infinity);
            if (sortOrder === 'deadline_asc') return timeA - timeB;
            if (sortOrder === 'deadline_desc') return timeB - timeA;
            return 0;
        });

        return result;
    }, [projects, selectedClientIds, activeStatus, selectedPmIds, sortOrder, searchQuery]);

    // Only relevant PMs (have at least one project in current client scope)
    const relevantPms = useMemo(() => {
        const scopeProjects = selectedClientIds.length > 0
            ? projects.filter(p => selectedClientIds.includes(p.client_id))
            : projects;
        const pmIds = new Set(scopeProjects.map(p => p.project_manager_id).filter(Boolean));
        return employees.filter(e => pmIds.has(e.id));
    }, [projects, selectedClientIds, employees]);

    // Sorted client list — clients with projects come first, alphabetically
    const sortedClients = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of projects) {
            counts.set(p.client_id, (counts.get(p.client_id) || 0) + 1);
        }
        return [...clients].sort((a, b) => {
            const ca = counts.get(a.id) || 0;
            const cb = counts.get(b.id) || 0;
            if (ca !== cb) return cb - ca; // most projects first
            return a.name.localeCompare(b.name);
        });
    }, [clients, projects]);

    const visibleProjects = filteredProjects.slice(0, displayLimit);
    const hasMore = filteredProjects.length > displayLimit;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="ds-display">Projekte</h1>
                    <p className="ds-caption mt-1">
                        {selectedClientIds.length === 1
                            ? clients.find(c => c.id === selectedClientIds[0])?.name || 'Gesamtübersicht'
                            : selectedClientIds.length > 1
                                ? `${selectedClientIds.length} Kunden ausgewählt`
                                : 'Gesamtübersicht'}
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('agentur-os-open-search'))}
                        className="btn-ghost p-2.5 border border-border-default bg-surface shadow-sm rounded-xl"
                        title="Globale Suche öffnen (⌘K)"
                    >
                        <Search size={18} />
                    </button>
                    <button onClick={onOpenCreateModal} className="btn-primary whitespace-nowrap">
                        <Plus size={16} strokeWidth={2.5} /> Projekt hinzufügen
                    </button>
                </div>
            </header>

            {/* Filter bar */}
            <div className="mb-6 p-4 rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <ProjectFilterBar
                    clients={sortedClients}
                    employees={relevantPms.length > 0 ? relevantPms : employees}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedClientIds={selectedClientIds}
                    setSelectedClientIds={(ids) => {
                        setSelectedClientIds(ids);
                        // Bubble single client up so deep-links / breadcrumb still work
                        if (ids.length === 1) {
                            const client = clients.find(c => c.id === ids[0]);
                            if (client) onSelectClient(client);
                        } else if (ids.length === 0) {
                            onSelectClient(null as any);
                        }
                    }}
                    selectedStatuses={activeStatus}
                    setSelectedStatuses={setActiveStatus}
                    selectedPmIds={selectedPmIds}
                    setSelectedPmIds={setSelectedPmIds}
                    sortOrder={sortOrder}
                    setSortOrder={setSortOrder}
                    totalCount={projects.length}
                    filteredCount={filteredProjects.length}
                />
            </div>

            {/* Empty state */}
            {filteredProjects.length === 0 && projects.length > 0 && (
                <div className="text-center py-20 rounded-2xl border-2 border-dashed"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                    <div className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Keine Projekte gefunden</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Versuch's mit weniger Filtern oder einer anderen Suchanfrage.
                    </div>
                </div>
            )}

            {/* Project list */}
            <ProjectList
                projects={visibleProjects}
                selectedClient={selectedClient}
                onSelectProject={onSelectProject}
                showOpenTodos={false}
                onTaskClick={(t) => setSelectedTask(t)}
            />

            {/* Pagination */}
            {hasMore && (
                <div className="mt-6 flex flex-col items-center gap-2">
                    <button
                        onClick={() => setDisplayLimit(d => d + PAGE_SIZE)}
                        className="btn-secondary"
                    >
                        <ChevronDown size={14} /> Weitere {Math.min(PAGE_SIZE, filteredProjects.length - displayLimit)} laden
                    </button>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {visibleProjects.length} von {filteredProjects.length} angezeigt
                    </span>
                </div>
            )}

            {selectedTask && (
                <TaskDetailSidebar
                    task={selectedTask}
                    employees={employees}
                    projects={projects}
                    onClose={() => setSelectedTask(null)}
                    onTaskClick={(t) => setSelectedTask(t)}
                    onUpdate={async (id, updates) => {
                        const { data } = await supabase.from('todos').update(updates).eq('id', id).select(`*, employees(id, initials, name, avatar_url)`);
                        if (data) {
                            setSelectedTask(data[0] as any);
                            fetchData();
                        }
                    }}
                    onDelete={async (id) => {
                        setTaskToDelete(id);
                    }}
                />
            )}

            <ConfirmModal
                isOpen={!!taskToDelete}
                title="Aufgabe löschen?"
                message="Möchtest du diese Aufgabe wirklich löschen?"
                onConfirm={async () => {
                    if (taskToDelete) {
                        await supabase.from('todos').delete().eq('id', taskToDelete);
                        fetchData();
                        setSelectedTask(null);
                        setTaskToDelete(null);
                    }
                }}
                onCancel={() => setTaskToDelete(null)}
                type="danger"
                confirmText="Löschen"
                cancelText="Abbrechen"
            />
        </div>
    );
}
