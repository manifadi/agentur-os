import React, { useMemo } from 'react';
import { Employee, Project, Todo } from '../../types';
import { CheckSquare, Briefcase, Clock, Calendar, ArrowRight, Check, CheckCircle2, Circle, Plus, UserPlus, FilePlus } from 'lucide-react';
import { getStatusStyle, getDeadlineColorClass } from '../../utils';

interface UserDashboardProps {
    currentUser: Employee | undefined;
    projects: Project[];
    allocations: any[];
    onSelectProject: (p: Project) => void;
    onToggleTodo: (id: string, isDone: boolean) => void;
    onQuickAction: (action: string) => void;
}

export default function UserDashboard({ currentUser, projects, allocations, onSelectProject, onToggleTodo, onQuickAction }: UserDashboardProps) {
    if (!currentUser) return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">👋</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Willkommen im Agentur OS</h1>
            <p className="text-gray-500 max-w-md">Bitte verknüpfe deinen Account in den Einstellungen (Profil), um dein persönliches Dashboard zu sehen.</p>
        </div>
    );

    // 2. My Open Tasks (Assigned & !Done)
    const myTasks = projects.flatMap(p =>
        (p.todos || [])
            .filter(t => t.assigned_to === currentUser.id && !t.is_done)
            .map(t => ({ ...t, project: p }))
    );

    // 1. My Projects (PM OR Has Tasks)
    // "Projects, where I am ProjectManager OR have tasks assigned"
    const myProjects = projects.filter(p => {
        const isPM = p.project_manager_id === currentUser.id;
        const hasTasks = p.todos?.some(t => t.assigned_to === currentUser.id && !t.is_done); // Show if I have OPEN tasks? Or any tasks? Usually open tasks is more relevant for "active" view.
        return isPM || hasTasks;
    });

    // 3. Weekly Allocations Table Data
    const weeklyData = useMemo(() => {
        if (!allocations) return { days: [], rows: [], total: 0 };

        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day == 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        const weekDates = [];
        const dateLabels = [];
        const formatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

        for (let i = 0; i < 5; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            weekDates.push(iso);
            dateLabels.push({ iso, label: formatter.format(d) });
        }

        const myAllocs = allocations.filter(a => a.employee_id === currentUser.id && weekDates.includes(a.date));

        // Group by Project
        const projectGroups: Record<string, { project: Project | undefined, minutesByDay: Record<string, number>, total: number }> = {};

        myAllocs.forEach(a => {
            if (!projectGroups[a.project_id]) {
                projectGroups[a.project_id] = {
                    project: projects.find(p => p.id === a.project_id),
                    minutesByDay: {},
                    total: 0
                };
            }
            projectGroups[a.project_id].minutesByDay[a.date] = (projectGroups[a.project_id].minutesByDay[a.date] || 0) + a.minutes;
            projectGroups[a.project_id].total += a.minutes;
        });

        const rows = Object.values(projectGroups);
        const totalMinutes = myAllocs.reduce((sum, a) => sum + a.minutes, 0);

        return { days: dateLabels, rows, total: totalMinutes / 60 };

    }, [allocations, currentUser.id, projects]);


    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col p-4 max-w-[1920px] mx-auto space-y-4">
            <header className="shrink-0 flex justify-between items-end pb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-1">Hallo, {currentUser.name.split(' ')[0]}! 👋</h1>
                    <p className="text-gray-500">Dein Dashboard.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onQuickAction('create_project')} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition shadow-lg hover:shadow-xl"><FilePlus size={16} /> Projekt anlegen</button>
                    <button onClick={() => onQuickAction('create_client')} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"><UserPlus size={16} /> Kunde anlegen</button>
                </div>
            </header>

            {/* TOP ROW: TASKS & PROJECTS (Flex-1 to fill available space, but shared) */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* COLUMN 1: MY TASKS */}
                <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CheckSquare size={20} /> Meine Aufgaben</h2>
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">{myTasks.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                        {myTasks.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <CheckCircle2 size={48} className="text-gray-200 mb-2" />
                                <div>Alles erledigt!</div>
                            </div>
                        ) : (
                            myTasks.map((task) => (
                                <div key={task.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition group flex items-center gap-4">

                                    {/* Left: JobNr & Client */}
                                    <div className="w-32 shrink-0">
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">{task.project.job_number}</div>
                                        <div className="text-xs font-bold text-gray-800 truncate" title={task.project.clients?.name}>{task.project.clients?.name || 'Unbekannt'}</div>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-px self-stretch bg-gray-100"></div>

                                    {/* Middle: Checkbox & Title */}
                                    <div className="flex-1 flex items-center gap-3 overflow-hidden">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleTodo(task.id, true); }}
                                            className="shrink-0 w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 text-white flex items-center justify-center transition-all focus:outline-none"
                                        >
                                            <Check size={12} className="opacity-0 hover:opacity-100 text-green-600" />
                                        </button>
                                        <div className="font-medium text-gray-900 text-sm truncate" title={task.title}>{task.title}</div>
                                    </div>

                                    {/* Right: Arrow */}
                                    <button onClick={() => onSelectProject(task.project)} className="text-gray-300 hover:text-blue-600 transition shrink-0 p-1 hover:bg-blue-50 rounded">
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* COLUMN 2: MY PROJECTS */}
                <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Briefcase size={20} /> Meine Projekte</h2>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{myProjects.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {myProjects.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-400">Keine Projekte.</div>
                        ) : (
                            <table className="w-full text-left text-sm relative">
                                <thead className="bg-gray-50/90 backdrop-blur text-xs text-gray-500 uppercase sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">Projekt</th>
                                        <th className="px-5 py-3 font-semibold w-32">Status</th>
                                        <th className="px-5 py-3 font-semibold w-24">Deadline</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {myProjects.map(p => (
                                        <tr key={p.id} onClick={() => onSelectProject(p)} className="hover:bg-gray-50 cursor-pointer transition group">
                                            <td className="px-5 py-3">
                                                <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.title}</div>
                                                <div className="text-xs text-gray-500 font-mono mt-0.5">{p.job_number} • {p.clients?.name}</div>
                                            </td>
                                            <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(p.status)}`}>{p.status}</span></td>
                                            <td className={`px-5 py-3 font-mono text-xs ${getDeadlineColorClass(p.deadline)}`}>{p.deadline ? new Date(p.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* BOTTOM ROW: RESOURCE PLAN (Fixed height portion, e.g. 1/3 or specific h) */}
            <div className="h-[35%] min-h-[250px] flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Clock size={20} /> Mein Wochenplan <span className="text-gray-400 font-normal text-sm">({weeklyData.total.toFixed(1)} h)</span></h2>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {weeklyData.rows.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400">Keine Ressourcen geplant für diese Woche.</div>
                    ) : (
                        <table className="w-full text-sm text-left relative">
                            <thead className="bg-gray-50/90 backdrop-blur text-xs text-gray-500 uppercase sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 font-semibold text-gray-900">Projekt</th>
                                    {weeklyData.days.map(d => (
                                        <th key={d.iso} className="px-4 py-3 font-semibold text-center w-20 bg-gray-50">{d.label}</th>
                                    ))}
                                    <th className="px-6 py-3 font-bold text-right text-gray-900">Gesamt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {weeklyData.rows.map((row: any) => (
                                    <tr key={row.project?.id || 'unknown'} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-3">
                                            <div className="font-bold text-gray-900">{row.project?.title || 'Unbekanntes Projekt'}</div>
                                            <div className="text-xs text-gray-500">{row.project?.clients?.name}</div>
                                        </td>
                                        {weeklyData.days.map(d => {
                                            const mins = row.minutesByDay[d.iso] || 0;
                                            return (
                                                <td key={d.iso} className="px-4 py-3 text-center">
                                                    {mins > 0 ? (
                                                        <div className="inline-block bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded text-xs min-w-[3rem]">
                                                            {(mins / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                        </div>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </td>
                                            );
                                        })}
                                        <td className="px-6 py-3 text-right font-black text-gray-900">{(row.total / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
