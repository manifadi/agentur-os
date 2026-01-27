import React, { useMemo } from 'react';
import { Project, Todo, Employee } from '../../types';
import { ChevronRight, CheckCircle2, User, Plus, X, History, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import TaskHistoryModal from './TaskHistoryModal';

interface GlobalTasksProps {
    projects: Project[];
    personalTodos: Todo[];
    employees: Employee[];
    onSelectProject: (project: Project) => void;
    onUpdate: () => void;
    onAddPersonal?: (title: string) => Promise<void>;
    currentUser?: Employee;
    onTaskClick?: (task: Todo) => void;
}

export default function GlobalTasks({ projects, personalTodos, employees, onSelectProject, onUpdate, onAddPersonal, currentUser, onTaskClick }: GlobalTasksProps) {
    const [newPersonalTitle, setNewPersonalTitle] = React.useState('');
    const [isAddingPersonal, setIsAddingPersonal] = React.useState(false);
    const [personalSort, setPersonalSort] = React.useState<'created' | 'deadline'>('created');
    const [showHistory, setShowHistory] = React.useState(false);
    const [pendingCompletions, setPendingCompletions] = React.useState<Record<string, NodeJS.Timeout>>({});

    React.useEffect(() => {
        return () => {
            Object.values(pendingCompletions).forEach(clearTimeout);
        };
    }, [pendingCompletions]);

    const getTasksByProject = useMemo(() => {
        const list: { project: Project, visibleTodos: Todo[], allProjectTodos: Todo[] }[] = [];
        projects.forEach(proj => {
            // Filter: (Not done OR pending) AND assigned to me AND top-level
            const openTodos = proj.todos ? proj.todos.filter(t =>
                !t.parent_id &&
                (!t.is_done || pendingCompletions[t.id]) &&
                (currentUser ? t.assigned_to === currentUser.id : true)
            ) : [];
            if (openTodos.length > 0) {
                list.push({ project: proj, visibleTodos: openTodos, allProjectTodos: proj.todos || [] });
            }
        });
        return list;
    }, [projects, currentUser, pendingCompletions]);

    const sortedPersonalTodos = useMemo(() => {
        let list = personalTodos.filter(t => !t.parent_id && (!t.is_done || pendingCompletions[t.id]));
        if (personalSort === 'deadline') {
            list.sort((a, b) => {
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            });
        } else {
            list.sort((a, b) => new Date(b.id).getTime() - new Date(a.id).getTime());
        }
        return list;
    }, [personalTodos, personalSort, pendingCompletions]);

    // ... handlers ...
    const handleGlobalToggle = async (todoId: string, currentIsDone: boolean) => {
        // If we are marking as DONE, add delay
        if (!currentIsDone) {
            // Check if already pending (shouldn't happen with UI, but for safety)
            if (pendingCompletions[todoId]) return;

            const timeout = setTimeout(async () => {
                await supabase.from('todos').update({ is_done: true }).eq('id', todoId);
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[todoId];
                    return next;
                });
                onUpdate();
            }, 3000);

            setPendingCompletions(prev => ({ ...prev, [todoId]: timeout }));
        } else {
            // If we are unmarking a PENDING task
            if (pendingCompletions[todoId]) {
                clearTimeout(pendingCompletions[todoId]);
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[todoId];
                    return next;
                });
            } else {
                // Regular unmark (from history or similar)
                await supabase.from('todos').update({ is_done: false }).eq('id', todoId);
                onUpdate();
            }
        }
    };

    const handleAssigneeUpdateGlobal = async (todoId: string, newAssigneeId: string) => {
        const target = newAssigneeId === "" ? null : newAssigneeId;
        await supabase.from('todos').update({ assigned_to: target }).eq('id', todoId);
        onUpdate();
    };

    return (
        <>
            <div className="max-w-5xl mx-auto py-8 px-4 space-y-12 animate-in fade-in duration-500">
                <header className="mb-0 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight text-nowrap">Meine To-Do Liste</h1>
                        <p className="text-gray-500 mt-2 truncate">Alle offenen Aufgaben, die mir zugewiesen sind.</p>
                    </div>
                    <button
                        onClick={() => setShowHistory(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-gray-200 text-sm font-bold text-gray-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 shadow-sm transition group"
                    >
                        <History size={18} className="text-gray-400 group-hover:text-blue-500 transition" />
                        Historie
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                    {/* LEFT COLUMN: Project Tasks */}
                    <div className="space-y-8">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-1">Zugewiesene To-Do's in Projekten</h2>

                        {getTasksByProject.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                <p className="text-gray-400 text-sm">Keine offenen Projektaufgaben.</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {getTasksByProject.map(item => {
                                    const project = item.project;
                                    const projectTodos = item.visibleTodos;

                                    return (
                                        <section key={project.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                            {/* Project Header */}
                                            <div
                                                onClick={() => { onSelectProject(project); }}
                                                className="bg-gray-50/50 px-5 py-3.5 flex items-center justify-between border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {project.clients?.logo_url ? (
                                                        <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 p-1 flex items-center justify-center shrink-0">
                                                            <img src={project.clients.logo_url} className="max-w-full max-h-full object-contain" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center shrink-0 text-[10px] font-bold text-gray-400">
                                                            {project.clients?.name?.substring(0, 2).toUpperCase() || 'NA'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h2 className="text-sm font-bold text-gray-900 leading-tight">{project.title}</h2>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
                                                            <span className="font-mono">{project.job_number}</span>
                                                            <span>•</span>
                                                            <span>{project.clients?.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[10px] font-bold px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-500">
                                                        {projectTodos.length}
                                                    </div>
                                                    <ChevronRight size={16} className="text-gray-300" />
                                                </div>
                                            </div>

                                            {/* Task List */}
                                            <div className="divide-y divide-gray-100">
                                                {projectTodos.map(todo => (
                                                    <div
                                                        key={todo.id}
                                                        className="group flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                                                        onClick={() => onTaskClick?.(todo)}
                                                    >
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleGlobalToggle(todo.id, todo.is_done || !!pendingCompletions[todo.id]); }}
                                                            className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center group/check ${todo.is_done || pendingCompletions[todo.id]
                                                                ? 'bg-blue-500 border-blue-500'
                                                                : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50/10'
                                                                }`}
                                                        >
                                                            <Check size={12} className={`text-white transition-opacity ${todo.is_done || pendingCompletions[todo.id] ? 'opacity-100' : 'opacity-0 stroke-[3px]'}`} />
                                                        </button>

                                                        <div className="flex flex-col flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-sm font-medium leading-relaxed ${(todo.is_done || pendingCompletions[todo.id]) ? 'text-gray-400 line-through' : 'text-gray-900 group-hover:text-blue-600'}`}>
                                                                    {todo.title}
                                                                </p>
                                                                {item.allProjectTodos.some(t => t.parent_id === todo.id) && (
                                                                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-gray-400 min-w-[18px] text-center">
                                                                        {item.allProjectTodos.filter(t => t.parent_id === todo.id).length}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {todo.deadline && (
                                                                <span className={`text-[10px] mt-0.5 font-medium ${new Date(todo.deadline) < new Date() && !todo.is_done ? 'text-red-500' : 'text-gray-400'}`}>
                                                                    Fällig: {new Date(todo.deadline).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Assignee Selector */}
                                                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                                            <div className="relative group/select">
                                                                <select
                                                                    className="appearance-none pl-7 pr-2 py-1 bg-white border border-gray-100 rounded-full text-[11px] font-medium text-gray-500 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-all w-28 truncate"
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

                    {/* RIGHT COLUMN: Personal To-Dos */}
                    <div className="space-y-8">
                        <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-4">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Persönliche To-Do's</h2>
                                <select
                                    className="text-[10px] bg-transparent border-none font-bold text-gray-400 cursor-pointer focus:ring-0 p-0"
                                    value={personalSort}
                                    onChange={(e) => setPersonalSort(e.target.value as any)}
                                >
                                    <option value="created">Nach Datum</option>
                                    <option value="deadline">Nach Fälligkeit</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[400px]">
                            {isAddingPersonal && (
                                <div className="p-4 bg-blue-50/50 border-b border-blue-100 animate-in slide-in-from-top-2 duration-300">
                                    <input
                                        autoFocus
                                        className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Was steht an? (Enter zum Speichern)"
                                        value={newPersonalTitle}
                                        onChange={(e) => setNewPersonalTitle(e.target.value)}
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && newPersonalTitle.trim()) {
                                                await onAddPersonal?.(newPersonalTitle.trim());
                                                setNewPersonalTitle('');
                                                setIsAddingPersonal(false);
                                            }
                                            if (e.key === 'Escape') setIsAddingPersonal(false);
                                        }}
                                    />
                                </div>
                            )}

                            <div className="divide-y divide-gray-100 flex-1">
                                {sortedPersonalTodos.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 text-gray-400 px-6 text-center">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <CheckCircle2 size={32} strokeWidth={1.5} />
                                        </div>
                                        <p className="text-sm font-medium">Deine private Liste ist leer.</p>
                                        <p className="text-xs mt-1">Hier kannst du Aufgaben für dich selbst verwalten.</p>
                                    </div>
                                ) : (
                                    sortedPersonalTodos.map(todo => (
                                        <div
                                            key={todo.id}
                                            className="group flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                                            onClick={() => onTaskClick?.(todo)}
                                        >
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleGlobalToggle(todo.id, todo.is_done || !!pendingCompletions[todo.id]); }}
                                                className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center group/check ${todo.is_done || pendingCompletions[todo.id]
                                                    ? 'bg-blue-500 border-blue-500'
                                                    : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50/10'
                                                    }`}
                                            >
                                                <Check size={12} className={`text-white transition-opacity ${todo.is_done || pendingCompletions[todo.id] ? 'opacity-100' : 'opacity-0 stroke-[3px]'}`} />
                                            </button>

                                            <div className="flex flex-col flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-sm font-medium leading-relaxed ${todo.is_done ? 'text-gray-400 line-through' : 'text-gray-900 group-hover:text-blue-600'}`}>
                                                        {todo.title}
                                                    </p>
                                                    {personalTodos.some(t => t.parent_id === todo.id) && (
                                                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-gray-400 min-w-[18px] text-center">
                                                            {personalTodos.filter(t => t.parent_id === todo.id).length}
                                                        </span>
                                                    )}
                                                </div>
                                                {todo.deadline && (
                                                    <span className={`text-[10px] mt-0.5 font-medium ${new Date(todo.deadline) < new Date() && !todo.is_done ? 'text-red-500' : 'text-gray-400'}`}>
                                                        Fällig: {new Date(todo.deadline).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-[10px] text-gray-400 font-medium px-2 py-0.5 bg-gray-50 rounded-full">
                                                Privat
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                        </div>
                    </div>
                </div>

                {showHistory && (
                    <TaskHistoryModal
                        projects={projects}
                        personalTodos={personalTodos}
                        onClose={() => setShowHistory(false)}
                        onToggle={handleGlobalToggle}
                        onTaskClick={(t) => {
                            setShowHistory(false);
                            onTaskClick?.(t);
                        }}
                    />
                )}
            </div>
        </>
    );
}
