import React, { useState, useMemo } from 'react';
import { Activity, ListTodo, Timer, Plus, Search, Filter, X } from 'lucide-react';
import { Project, Client, Employee } from '../../types';
import { STATUS_OPTIONS } from '../../utils';
import ProjectList from '../Projects/ProjectList';

interface DashboardViewProps {
    projects: Project[];
    clients: Client[];
    employees: Employee[];
    stats: { activeProjects: number; openTasks: number; nextDeadline: Project | null };
    selectedClient: Client | null;
    onSelectProject: (project: Project) => void;
    onOpenCreateModal: () => void;
}

export default function DashboardView({
    projects,
    clients,
    employees,
    stats,
    selectedClient,
    onSelectProject,
    onOpenCreateModal
}: DashboardViewProps) {
    const [statusFilter, setStatusFilter] = useState('Alle');
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({ pmId: 'Alle', showOpenTodos: false });

    // --- FILTER LOGIC ---
    const filteredProjects = useMemo(() => projects.filter(p => {
        // Basic
        if (selectedClient && p.client_id !== selectedClient.id) return false;
        if (statusFilter !== 'Alle' && p.status !== statusFilter) return false;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            return p.title?.toLowerCase().includes(lower) || p.job_number?.toLowerCase().includes(lower) || p.clients?.name?.toLowerCase().includes(lower);
        }

        // Advanced Filters
        if (advancedFilters.pmId !== 'Alle' && p.project_manager_id !== advancedFilters.pmId) return false;
        if (advancedFilters.showOpenTodos) {
            const hasOpen = p.todos && p.todos.some(t => !t.is_done);
            if (!hasOpen) return false;
        }

        return true;
    }), [projects, selectedClient, statusFilter, searchTerm, advancedFilters]);

    return (
        <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div><h1 className="text-2xl font-bold tracking-tight mb-1">{selectedClient ? selectedClient.name : 'Alle Projekte'}</h1><p className="text-gray-500 text-sm">Übersicht aller laufenden Jobs</p></div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Suchen..." className="w-full md:w-64 pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <button onClick={onOpenCreateModal} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-gray-800 transition flex items-center gap-2 whitespace-nowrap"><Plus size={16} /> <span className="hidden md:inline">Neues Projekt</span></button>
                </div>
            </header>

            {!selectedClient && !searchTerm && statusFilter === 'Alle' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {['Alle', ...STATUS_OPTIONS].map(filter => (
                    <button key={filter} onClick={() => setStatusFilter(filter)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${statusFilter === filter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{filter}</button>
                ))}

                {/* ADVANCED FILTER BUTTON */}
                <div className="ml-auto relative">
                    <button onClick={() => setShowFilterModal(!showFilterModal)} className={`p-1.5 rounded-full border transition ${showFilterModal || advancedFilters.pmId !== 'Alle' || advancedFilters.showOpenTodos ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                        <Filter size={16} />
                    </button>
                    {showFilterModal && (
                        <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-20 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-4"><span className="text-xs font-bold uppercase text-gray-400">Filter</span><X size={14} className="cursor-pointer text-gray-400" onClick={() => setShowFilterModal(false)} /></div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">Projektmanager</label>
                                    <select className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-gray-50" value={advancedFilters.pmId} onChange={(e) => setAdvancedFilters({ ...advancedFilters, pmId: e.target.value })}>
                                        <option value="Alle">Alle</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-gray-600">Nur mit offenen To-Dos</label>
                                    <input type="checkbox" checked={advancedFilters.showOpenTodos} onChange={(e) => setAdvancedFilters({ ...advancedFilters, showOpenTodos: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                </div>
                                <button onClick={() => { setAdvancedFilters({ pmId: 'Alle', showOpenTodos: false }); }} className="w-full text-xs text-gray-400 hover:text-red-500 pt-2 border-t border-gray-100 mt-2">Filter zurücksetzen</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ProjectList
                projects={filteredProjects}
                selectedClient={selectedClient}
                onSelectProject={onSelectProject}
                showOpenTodos={advancedFilters.showOpenTodos}
            />
        </>
    );
}
