import React, { useMemo } from 'react';
import { Project, Todo, Employee } from '../../types';
import { ChevronRight, CheckCircle2, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface GlobalTasksProps {
    projects: Project[];
    employees: Employee[];
    onSelectProject: (project: Project) => void;
    onUpdate: () => void;
    currentUser?: Employee;
}

export default function GlobalTasks({ projects, employees, onSelectProject, onUpdate, currentUser }: GlobalTasksProps) {

    const getTasksByProject = useMemo(() => {
        const list: { project: Project, visibleTodos: Todo[] }[] = [];
        projects.forEach(proj => {
            // Filter: Not done AND assigned to me (if currentUser exists)
            const openTodos = proj.todos ? proj.todos.filter(t => !t.is_done && (currentUser ? t.assigned_to === currentUser.id : true)) : [];
            if (openTodos.length > 0) {
                list.push({ project: proj, visibleTodos: openTodos });
            }
        });
        return list;
    }, [projects, currentUser]);

    // ... handlers ...
    const handleGlobalToggle = async (todoId: string, status: boolean) => {
        await supabase.from('todos').update({ is_done: !status }).eq('id', todoId);
        onUpdate();
    };

    const handleAssigneeUpdateGlobal = async (todoId: string, newAssigneeId: string) => {
        const target = newAssigneeId === "" ? null : newAssigneeId;
        await supabase.from('todos').update({ assigned_to: target }).eq('id', todoId);
        onUpdate();
    };

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 space-y-12 animate-in fade-in duration-500">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Meine To-Do Liste</h1>
                <p className="text-gray-500 mt-2">Alle offenen Aufgaben, die mir zugewiesen sind.</p>
            </header>

            {getTasksByProject.length === 0 ? (
                <div className="text-center py-24 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400">Keine offenen Aufgaben gefunden.</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {getTasksByProject.map(item => {
                        const project = item.project;
                        const projectTodos = item.visibleTodos;

                        return (
                            <section key={project.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* Project Header */}
                                <div
                                    onClick={() => { onSelectProject(project); }}
                                    className="bg-gray-50/50 px-6 py-4 flex items-center justify-between border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition"
                                >
                                    <div className="flex items-center gap-4">
                                        {project.clients?.logo_url ? (
                                            <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 p-1 flex items-center justify-center shrink-0">
                                                <img src={project.clients.logo_url} className="max-w-full max-h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-400">
                                                {project.clients?.name?.substring(0, 2).toUpperCase() || 'NA'}
                                            </div>
                                        )}
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900 leading-tight">{project.title}</h2>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
                                                <span>{project.job_number}</span>
                                                <span>•</span>
                                                <span className="font-sans">{project.clients?.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs font-medium px-2.5 py-1 bg-white border border-gray-200 rounded-md text-gray-500 shadow-sm">
                                            {projectTodos.length} {projectTodos.length === 1 ? 'Aufgabe' : 'Aufgaben'}
                                        </div>
                                        <ChevronRight size={20} className="text-gray-300" />
                                    </div>
                                </div>

                                {/* Task List */}
                                <div className="divide-y divide-gray-100">
                                    {projectTodos.map(todo => (
                                        <div key={todo.id} className="group flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors duration-200">
                                            <button
                                                onClick={() => handleGlobalToggle(todo.id, todo.is_done)}
                                                className={`mt-0.5 shrink-0 w-5 h-5 rounded border transition-all flex items-center justify-center ${todo.is_done
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : 'bg-white border-gray-300 text-transparent hover:border-green-500'
                                                    }`}
                                            >
                                                <CheckCircle2 size={12} fill="currentColor" />
                                            </button>

                                            <div className="flex flex-col">
                                                <p className={`text-sm font-medium leading-relaxed ${todo.is_done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                    {todo.title}
                                                </p>
                                                {todo.deadline && (
                                                    <span className={`text-[10px] mt-0.5 font-medium ${new Date(todo.deadline) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                                        Fällig: {new Date(todo.deadline).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Assignee Selector */}
                                            <div className="shrink-0">
                                                <div className="relative group/select">
                                                    <select
                                                        className="appearance-none pl-7 pr-2 py-1 bg-white border border-gray-100 rounded-full text-[11px] font-medium text-gray-500 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-all w-32 truncate"
                                                        value={todo.assigned_to || ''}
                                                        onChange={(e) => handleAssigneeUpdateGlobal(todo.id, e.target.value)}
                                                    >
                                                        <option value="">Offen</option>
                                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                                    </select>
                                                    <User size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
