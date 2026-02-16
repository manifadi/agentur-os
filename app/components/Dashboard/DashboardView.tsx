import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutGrid, Plus, Search, Timer, ChevronsUpDown } from 'lucide-react';
import { Project, Client, Employee } from '../../types';
import ProjectList from '../Projects/ProjectList';
import UserAvatar from '../UI/UserAvatar';
import GlobalSearch from '../GlobalSearch';
import FilterMenu from './FilterMenu';
import TaskDetailSidebar from '../Tasks/TaskDetailSidebar';
import { supabase } from '../../supabaseClient';
import { Todo } from '../../types';
import { useApp } from '../../context/AppContext';
import ConfirmModal from '../Modals/ConfirmModal';

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
    const { fetchData } = useApp();
    // New Filter States
    const [activeStatus, setActiveStatus] = useState<string[]>([]);
    const [activePmId, setActivePmId] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'deadline_asc' | 'deadline_desc' | 'created_desc' | 'title_asc'>('created_desc');
    const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

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

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-100 pb-8">
                <div className="relative" ref={dropdownRef}>
                    <div
                        className="flex items-center gap-3 hover:bg-gray-50 p-2 -m-2 rounded-2xl transition-all cursor-pointer group"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                    >
                        {selectedClient && (
                            <div className="w-10 h-10 flex items-center justify-center overflow-hidden shrink-0">
                                {selectedClient.logo_url ? (
                                    <img src={selectedClient.logo_url} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                                        <LayoutGrid size={20} />
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                    {selectedClient ? selectedClient.name : 'Alle Projekte'}
                                </h1>
                                <ChevronsUpDown size={20} className={`text-gray-300 group-hover:text-blue-500 transition-all ${dropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                                {selectedClient ? 'Fokussierte Ansicht' : 'Gesamtübersicht'}
                            </p>
                        </div>
                    </div>

                    {/* DROP-DOWN MENU */}
                    {dropdownOpen && (
                        <div className="absolute top-full left-0 mt-4 w-72 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-2 space-y-1">
                                <button
                                    onClick={() => { onSelectClient(null as any); setDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${!selectedClient ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <LayoutGrid size={18} />
                                    <span className="text-sm font-bold">Alle Projekte</span>
                                </button>
                                <div className="h-px bg-gray-50 my-1 mx-2" />
                                <div className="max-h-[70vh] overflow-y-auto scrollbar-none space-y-1">
                                    {clients.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { onSelectClient(c); setDropdownOpen(false); }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${selectedClient?.id === c.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 text-gray-600'}`}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-gray-100 shrink-0 overflow-hidden">
                                                {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-contain" /> : c.name[0]}
                                            </div>
                                            <span className="text-sm font-semibold truncate">{c.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Search Trigger Button */}
                    <button
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('agentur-os-open-search'));
                        }}
                        className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all border border-gray-100 shadow-sm"
                        title="Suche öffnen (⌘K)"
                    >
                        <Search size={22} />
                    </button>

                    <button
                        onClick={onOpenCreateModal}
                        className="flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transform whitespace-nowrap"
                    >
                        <Plus size={18} strokeWidth={3} /> Projekt hinzufügen
                    </button>

                    {/* FILTER MENU */}
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
            </header>

            <div className="mb-4 flex items-center gap-2">
                {/* Remove redundant horizontal filter list, or keep as active filter pills? */}
                {/* For cleaner UI, let's keep it clean. But maybe show active filters? */}
                {(activeStatus.length > 0 || activePmId) && (
                    <div className="flex gap-2">
                        {activeStatus.map(s => <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md border border-gray-200">{s}</span>)}
                        {activePmId && (
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-1 rounded-md border border-blue-100">
                                {employees.find(e => e.id === activePmId) && (
                                    <UserAvatar
                                        src={employees.find(e => e.id === activePmId)?.avatar_url}
                                        name={employees.find(e => e.id === activePmId)?.name}
                                        initials={employees.find(e => e.id === activePmId)?.initials}
                                        size="xs"
                                    />
                                )}
                                <span className="text-xs">{employees.find(e => e.id === activePmId)?.name}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ProjectList
                projects={filteredProjects}
                selectedClient={selectedClient}
                onSelectProject={onSelectProject}
                showOpenTodos={false} // Removed legacy prop requirement or handled inside? The prop was showOpenTodos={advancedFilters.showOpenTodos}. We removed that filter from menu for now as current user didn't request it explicitly in new prompt, but could re-add if needed.
                onTaskClick={(t) => setSelectedTask(t)}
            />

            {selectedTask && (
                <TaskDetailSidebar
                    task={selectedTask}
                    employees={employees}
                    projects={projects}
                    onClose={() => setSelectedTask(null)}
                    onTaskClick={(t) => setSelectedTask(t)}
                    onUpdate={async (id, updates) => {
                        const { data } = await supabase.from('todos').update(updates).eq('id', id).select(`*, employees(id, initials, name)`);
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
