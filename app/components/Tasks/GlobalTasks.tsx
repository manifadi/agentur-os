import React, { useMemo } from 'react';
import { Project, Todo, Employee } from '../../types';
import { ChevronRight, CheckCircle2, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface GlobalTasksProps {
    projects: Project[];
    employees: Employee[];
    onSelectProject: (project: Project) => void;
    onUpdate: () => void; // Trigger refresh
}

export default function GlobalTasks({ projects, employees, onSelectProject, onUpdate }: GlobalTasksProps) {

    const getTasksByProject = useMemo(() => {
        const list: { project: Project, visibleTodos: Todo[] }[] = [];
        projects.forEach(proj => {
            const openTodos = proj.todos ? proj.todos.filter(t => !t.is_done) : [];
            if (openTodos.length > 0) {
                list.push({ project: proj, visibleTodos: openTodos });
            }
        });
        return list;
    }, [projects]);

    const handleGlobalToggle = async (todoId: string, status: boolean) => {
        await supabase.from('todos').update({ is_done: !status }).eq('id', todoId);
        onUpdate(); // Needs to start a refetch in parent
    };

    const handleAssigneeUpdateGlobal = async (todoId: string, newAssigneeId: string) => {
        const target = newAssigneeId === "" ? null : newAssigneeId;
        await supabase.from('todos').update({ assigned_to: target }).eq('id', todoId);
        onUpdate();
    };

    return (
        <div className="p-0">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div><h1 className="text-2xl font-bold tracking-tight mb-1">Offene Aufgaben</h1><p className="text-gray-500 text-sm">Alle To-Dos im Überblick</p></div>
            </header>
            <div className="space-y-6 pb-12">
                {getTasksByProject.length === 0 && <div className="text-center p-12 text-gray-400">Keine offenen Aufgaben gefunden.</div>}
                {getTasksByProject.map((item) => (
                    <div key={item.project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        {/* PROJECT HEADER */}
                        <div
                            onClick={() => { onSelectProject(item.project); }}
                            className="bg-gray-50 px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-100 transition border-b border-gray-100"
                        >
                            {item.project.clients?.logo_url ? (
                                <div className="w-10 h-10 bg-white rounded-md border border-gray-200 flex items-center justify-center p-0.5 shrink-0 shadow-sm">
                                    <img src={item.project.clients.logo_url} className="w-full h-full object-contain" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-md bg-white border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 shrink-0 font-bold">
                                    {item.project.clients?.name ? item.project.clients.name.substring(0, 2).toUpperCase() : '??'}
                                </div>
                            )}

                            <div>
                                <div className="font-bold text-gray-900 text-lg">{item.project.title}</div>
                                <div className="text-xs text-gray-500 font-mono">{item.project.job_number}</div>
                            </div>
                            <div className="ml-auto">
                                <ChevronRight size={20} className="text-gray-300" />
                            </div>
                        </div>

                        {/* TASK LIST */}
                        <div className="divide-y divide-gray-100">
                            {item.visibleTodos.map((t) => (
                                <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition group">
                                    <div className="flex items-center gap-3 flex-1">
                                        <button
                                            onClick={() => handleGlobalToggle(t.id, t.is_done)}
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${t.is_done ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}
                                        >
                                            {t.is_done && <CheckCircle2 size={12} className="text-white" />}
                                        </button>
                                        <span className={`text-sm text-gray-700 ${t.is_done ? 'line-through text-gray-400' : ''}`}>{t.title}</span>
                                    </div>

                                    {/* ASSIGNEE SELECTOR */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="relative">
                                            <select
                                                className="appearance-none pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                                value={t.assigned_to || ''}
                                                onChange={(e) => handleAssigneeUpdateGlobal(t.id, e.target.value)}
                                            >
                                                <option value="">Nicht zugewiesen</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                            </select>
                                            <User size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
