import React, { useMemo, useState } from 'react';
import { X, CheckCircle2, RotateCcw, Layout, Search, Building2, FolderOpen, Check } from 'lucide-react';
import { Todo, Project } from '../../types';

interface TaskHistoryModalProps {
    projects: Project[];
    personalTodos: Todo[];
    onClose: () => void;
    onToggle: (id: string, status: boolean) => Promise<void>;
    onTaskClick?: (task: Todo) => void;
}

interface GroupedData {
    customerName: string;
    projects: {
        projectName: string;
        jobNumber: string;
        tasks: Todo[];
    }[];
}

export default function TaskHistoryModal({ projects, personalTodos, onClose, onToggle, onTaskClick }: TaskHistoryModalProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const groupedTasks = useMemo(() => {
        const query = searchQuery.toLowerCase();
        const dataMap: { [customer: string]: { [project: string]: { name: string, job: string, tasks: Todo[] } } } = {};
        const personalList: Todo[] = [];

        // Process project tasks
        projects.forEach(proj => {
            const customerName = proj.clients?.name || 'Unbekannter Kunde';
            const projectName = proj.title;
            const jobNumber = proj.job_number;

            const completedInProj = proj.todos?.filter(t => t.is_done && (
                t.title.toLowerCase().includes(query) ||
                projectName.toLowerCase().includes(query) ||
                customerName.toLowerCase().includes(query)
            )) || [];

            if (completedInProj.length > 0) {
                if (!dataMap[customerName]) dataMap[customerName] = {};
                if (!dataMap[customerName][projectName]) {
                    dataMap[customerName][projectName] = { name: projectName, job: jobNumber, tasks: [] };
                }
                dataMap[customerName][projectName].tasks.push(...completedInProj);
            }
        });

        // Process personal tasks
        personalTodos.filter(t => t.is_done && t.title.toLowerCase().includes(query)).forEach(t => {
            personalList.push(t);
        });

        // Convert map to array and sort
        const sortedGroups: GroupedData[] = Object.keys(dataMap).sort().map(cust => ({
            customerName: cust,
            projects: Object.values(dataMap[cust]).map(p => ({
                projectName: p.name,
                jobNumber: p.job,
                tasks: p.tasks.sort((a, b) => b.id.localeCompare(a.id))
            })).sort((a, b) => a.projectName.localeCompare(b.projectName))
        }));

        return { groups: sortedGroups, personal: personalList.sort((a, b) => b.id.localeCompare(a.id)) };
    }, [projects, personalTodos, searchQuery]);

    const totalCount = groupedTasks.groups.reduce((acc, g) => acc + g.projects.reduce((pa, p) => pa + p.tasks.length, 0), 0) + groupedTasks.personal.length;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <CheckCircle2 size={24} className="text-green-500" />
                                Aufgaben Historie
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Strukturierte Übersicht aller erledigten Aufgaben</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-900 transition shadow-sm border border-transparent hover:border-gray-200"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Search Field */}
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Historie durchsuchen (Aufgabe, Projekt oder Kunde)..."
                            className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-12">
                    {totalCount === 0 ? (
                        <div className="py-24 text-center text-gray-400">
                            <Search size={48} className="mx-auto mb-4 opacity-10" />
                            <p className="text-sm font-medium">Keine passenden Aufgaben in der Historie gefunden.</p>
                        </div>
                    ) : (
                        <>
                            {/* Individual/Personal Tasks */}
                            {groupedTasks.personal.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-2 mb-4 px-1">
                                        <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                                            <Layout size={14} />
                                        </div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Persönliche Aufgaben</h3>
                                    </div>
                                    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
                                        {groupedTasks.personal.map(todo => (
                                            <TaskRow key={todo.id} todo={todo} onToggle={onToggle} onTaskClick={onTaskClick} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Grouped by Customer / Project */}
                            {groupedTasks.groups.map(group => (
                                <section key={group.customerName} className="space-y-6">
                                    <div className="flex items-center gap-2 px-1 border-b border-gray-100 pb-2">
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                            <Building2 size={14} />
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{group.customerName}</h3>
                                    </div>

                                    <div className="space-y-6 pl-4 md:pl-8">
                                        {group.projects.map(project => (
                                            <div key={project.projectName} className="space-y-3">
                                                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                                                    <FolderOpen size={12} className="opacity-70" />
                                                    <span>{project.projectName}</span>
                                                    <span className="font-mono text-[9px] opacity-50 px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100">
                                                        {project.jobNumber}
                                                    </span>
                                                </div>
                                                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden shadow-sm">
                                                    {project.tasks.map(todo => (
                                                        <TaskRow key={todo.id} todo={todo} onToggle={onToggle} onTaskClick={onTaskClick} />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </>
                    )}
                </div>

                {/* Status Bar */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center flex justify-between px-8">
                    <p className="text-[10px] text-gray-400 font-medium">Anzeige: {totalCount} Einträge</p>
                    <p className="text-[10px] text-gray-400 font-medium italic">Tipp: Klicke auf "Reaktivieren", um Aufgaben zurückzuholen.</p>
                </div>
            </div>
        </div>
    );
}

function TaskRow({ todo, onToggle, onTaskClick }: { todo: Todo, onToggle: (id: string, s: boolean) => Promise<void>, onTaskClick?: (t: Todo) => void }) {
    return (
        <div
            className="group flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => onTaskClick?.(todo)}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle(todo.id, true);
                }}
                className={`w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center shrink-0 bg-blue-500 border-blue-500 group/check`}
            >
                <Check size={12} className="text-white" />
            </button>

            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-400 line-through truncate leading-tight group-hover:text-gray-900 group-hover:no-underline transition-colors">
                    {todo.title}
                </h3>
                {todo.deadline && (
                    <span className="text-[10px] text-gray-400 mt-1 block font-medium opacity-60">
                        Fällig war am: {new Date(todo.deadline).toLocaleDateString('de-DE')}
                    </span>
                )}
            </div>

            <div className="text-[10px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <RotateCcw size={10} /> Reaktivieren
            </div>
        </div>
    );
}
