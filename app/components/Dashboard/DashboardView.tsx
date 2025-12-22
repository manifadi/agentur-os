import React, { useState, useMemo } from 'react';
import { Activity, ListTodo, Timer, Plus, Search, FilePlus } from 'lucide-react';
import { Project, Client, Employee } from '../../types';
import ProjectList from '../Projects/ProjectList';
import GlobalSearch from '../GlobalSearch';
import FilterMenu from './FilterMenu';

interface DashboardViewProps {
    projects: Project[];
    clients: Client[];
    employees: Employee[];
    stats: { activeProjects: number; openTasks: number; nextDeadline: Project | null };
    selectedClient: Client | null;
    onSelectProject: (project: Project) => void;
    onSelectClient: (client: Client) => void;
    onOpenCreateModal: () => void;
    todaysHours: number; // NEW
    onAddTime: () => void; // NEW
}

export default function DashboardView({
    projects,
    clients,
    employees,
    stats,
    selectedClient,
    onSelectProject,
    onSelectClient,
    onOpenCreateModal,
    todaysHours,
    onAddTime
}: DashboardViewProps) {
    // New Filter States
    const [activeStatus, setActiveStatus] = useState<string[]>([]);
    const [activePmId, setActivePmId] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'deadline_asc' | 'deadline_desc' | 'created_desc' | 'title_asc'>('created_desc');

    // --- FILTER LOGIC ---
    const filteredProjects = useMemo(() => {
        let result = projects.filter(p => {
            // Client Filter
            if (selectedClient && p.client_id !== selectedClient.id) return false;

            // Status Filter (Multi-select)
            if (activeStatus.length > 0 && !activeStatus.includes(p.status)) return false;

            // PM Filter
            if (activePmId && p.project_manager_id !== activePmId) return false;

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            if (sortOrder === 'title_asc') return a.title.localeCompare(b.title);
            if (sortOrder === 'created_desc') return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();

            // Deadline logic requires handling nulls
            const timeA = a.deadline ? new Date(a.deadline).getTime() : (sortOrder === 'deadline_asc' ? Infinity : -Infinity);
            const timeB = b.deadline ? new Date(b.deadline).getTime() : (sortOrder === 'deadline_asc' ? Infinity : -Infinity);

            if (sortOrder === 'deadline_asc') return timeA - timeB;
            if (sortOrder === 'deadline_desc') return timeB - timeA;
            return 0;
        });

        return result;
    }, [projects, selectedClient, activeStatus, activePmId, sortOrder]);

    // Compute relevant PMs (only those who govern at least one project in the current list)
    // If a client is selected, we only show PMs for projects of that client.
    // If no client is selected, we show PMs for all projects.
    const relevantPms = useMemo(() => {
        // Base list of projects to derive PMs from (respecting client selection but IGNORING other filters to keep dropdown populated)
        // Actually, usually users want to see all potential managers for the current scope (Client or Global)
        const scopeProjects = selectedClient ? projects.filter(p => p.client_id === selectedClient.id) : projects;
        const pmIds = new Set(scopeProjects.map(p => p.project_manager_id).filter(Boolean));
        return employees.filter(e => pmIds.has(e.id));
    }, [projects, selectedClient, employees]);

    return (
        <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div><h1 className="text-2xl font-bold tracking-tight mb-1">{selectedClient ? selectedClient.name : 'Alle Projekte'}</h1><p className="text-gray-500 text-sm">Übersicht aller laufenden Jobs</p></div>
                <div className="flex items-center gap-3 w-full md:w-auto relative z-20">
                    <GlobalSearch
                        projects={projects}
                        clients={clients}
                        onSelectProject={onSelectProject}
                        onSelectClient={onSelectClient}
                    />
                    <button onClick={onOpenCreateModal} className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"><FilePlus size={16} /> Projekt hinzufügen</button>

                    {/* FILTER MENU */}
                    <div className="ml-2">
                        <FilterMenu
                            employees={relevantPms}
                            activeStatus={activeStatus}
                            setActiveStatus={setActiveStatus}
                            activePmId={activePmId}
                            setActivePmId={setActivePmId}
                            sortOrder={sortOrder}
                            setSortOrder={setSortOrder}
                        />
                    </div>
                </div>
            </header>

            {!selectedClient && activeStatus.length === 0 && !activePmId && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Activity size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{stats.activeProjects}</div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Aktive Projekte</div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><ListTodo size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{stats.openTasks}</div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Offene Aufgaben</div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Timer size={24} /></div>
                        <div>
                            <div className="text-sm font-bold text-gray-900 line-clamp-1">{stats.nextDeadline ? stats.nextDeadline.title : 'Keine Deadlines'}</div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                {stats.nextDeadline && stats.nextDeadline.deadline ? `Deadline: ${new Date(stats.nextDeadline.deadline).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}` : 'Alles erledigt'}
                            </div>
                        </div>
                    </div>
                    {/* Time Tracking Widget */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative group cursor-pointer hover:border-blue-200 transition-colors" onClick={onAddTime}>
                        <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center text-white"><Timer size={24} /></div>
                        <div>
                            <div className="text-2xl font-bold text-gray-900">{todaysHours.toLocaleString('de-DE')} h</div>
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Heute erfasst</div>
                        </div>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Plus size={16} /></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-4 flex items-center gap-2">
                {/* Remove redundant horizontal filter list, or keep as active filter pills? */}
                {/* For cleaner UI, let's keep it clean. But maybe show active filters? */}
                {(activeStatus.length > 0 || activePmId) && (
                    <div className="flex gap-2">
                        {activeStatus.map(s => <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md border border-gray-200">{s}</span>)}
                        {activePmId && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-md border border-blue-100">{employees.find(e => e.id === activePmId)?.initials}</span>}
                    </div>
                )}
            </div>

            <ProjectList
                projects={filteredProjects}
                selectedClient={selectedClient}
                onSelectProject={onSelectProject}
                showOpenTodos={false} // Removed legacy prop requirement or handled inside? The prop was showOpenTodos={advancedFilters.showOpenTodos}. We removed that filter from menu for now as current user didn't request it explicitly in new prompt, but could re-add if needed.
            />
        </>
    );
}
