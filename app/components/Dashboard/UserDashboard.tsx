import React, { useMemo, useState } from 'react';
import { Employee, Project, Todo, TimeEntry } from '../../types';
import { CheckSquare, Briefcase, Clock, Calendar, ArrowRight, Check, CheckCircle2, Circle, Plus, UserPlus, FilePlus, X } from 'lucide-react';
import { getStatusStyle, getDeadlineColorClass } from '../../utils';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../supabaseClient';

import TimeEntryModal from '../Modals/TimeEntryModal';
import GlobalSearch from '../GlobalSearch';

interface UserDashboardProps {
    onSelectProject: (p: Project) => void;
    onToggleTodo: (id: string, isDone: boolean) => void;
    onQuickAction: (action: string) => void;
}

export default function UserDashboard({ onSelectProject, onToggleTodo, onQuickAction }: UserDashboardProps) {
    const { currentUser, projects, allocations, members, timeEntries, fetchData } = useApp();
    const [showAddTimeModal, setShowAddTimeModal] = useState(false);
    const [pendingCompletions, setPendingCompletions] = useState<Record<string, NodeJS.Timeout>>({});

    React.useEffect(() => {
        return () => {
            Object.values(pendingCompletions).forEach(clearTimeout);
        };
    }, [pendingCompletions]);

    // Add Time State - Removed as now handled by Modal
    // const [newTime, setNewTime] = useState({ projectId: '', positionId: '', hours: '', description: '', date: new Date().toISOString().split('T')[0] });
    // const [submittingTime, setSubmittingTime] = useState(false);



    // [NEW] Edit Entry State
    const [entryToEdit, setEntryToEdit] = useState<TimeEntry | undefined>(undefined);

    // 1. My Open Tasks (Assigned & !Done)
    const myTasks = currentUser ? projects.flatMap(p =>
        (p.todos || [])
            .filter(t => t.assigned_to === currentUser.id && (!t.is_done || pendingCompletions[t.id]))
            .map(t => ({ ...t, project: p }))
    ) : [];

    // [NEW] Today's Time Entries
    const todayEntries = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        return (timeEntries || []).filter((t: any) => t.date === todayStr);
    }, [timeEntries]);

    const todayTotal = todayEntries.reduce((acc: number, t: any) => acc + (Number(t.hours) || 0), 0);

    // handleAddTime moved to TimeEntryModal

    // 2. My Projects
    const myProjects = currentUser ? projects.filter(p => {
        const isPM = p.project_manager_id === currentUser.id;
        const hasTasks = p.todos?.some(t => t.assigned_to === currentUser.id && !t.is_done);
        const isMember = members?.some((m: any) => m.project_id === p.id && m.employee_id === currentUser.id);
        const hasAllocations = allocations?.some((a: any) => a.project_id === p.id && a.employee_id === currentUser.id);
        return isPM || hasTasks || isMember || hasAllocations;
    }) : [];

    // 3. Upcoming Deadlines (Derived for 3rd Box)
    const deadlines = projects // Use all projects for deadlines or filtered? Using filtered myProjects is safer if logic exists.
        .filter(p => p.deadline && new Date(p.deadline) > new Date())
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
        .slice(0, 5);

    // 4. Weekly Data (unchanged logic, just ensuring it's here)
    const weeklyData = useMemo(() => {
        if (!allocations || !currentUser) return { days: [], rows: [], total: 0, dailyTotals: {} };
        // ... (Simplified re-implementation for brevity, relying on identical logic as before)
        // Note: For this tool call, I'll copy the logic if I can, but to save space/complexity I'll trust the previous logic was fine. 
        // Actually, I need the logic to render the bottom table. I will include a stripped down version or assume the full re-write.
        // Let's assume standard logic for now or copy it from previous.
        const today = new Date();
        const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const currentWeek = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        const currentYear = today.getFullYear();

        const mondayDate = new Date(d);
        mondayDate.setUTCDate(d.getUTCDate() - 3);

        const isoDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const dateLabels = [];
        const formatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
        for (let i = 0; i < 5; i++) {
            const dayDate = new Date(mondayDate);
            dayDate.setUTCDate(mondayDate.getUTCDate() + i);
            dateLabels.push({ iso: isoDays[i], label: formatter.format(dayDate) });
        }

        const myAllocs = allocations.filter((a: any) => a.employee_id === currentUser.id && a.year === currentYear && a.week_number === currentWeek);
        const projectGroups: Record<string, any> = {};
        const dailyTotals: Record<string, number> = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0 };
        let grandTotal = 0;

        myAllocs.forEach((a: any) => {
            if (!projectGroups[a.project_id]) projectGroups[a.project_id] = { project: projects.find(p => p.id === a.project_id), hoursByDay: {}, total: 0 };
            isoDays.forEach(day => {
                const val = a[day] || 0;
                if (val > 0) {
                    projectGroups[a.project_id].hoursByDay[day] = (projectGroups[a.project_id].hoursByDay[day] || 0) + val;
                    projectGroups[a.project_id].total += val;
                    dailyTotals[day] += val;
                    grandTotal += val;
                }
            });
        });

        return { days: dateLabels, rows: Object.values(projectGroups), total: grandTotal, dailyTotals };
    }, [allocations, currentUser?.id, projects]);


    // --- APPLE DESIGN COMPONENTS ---
    const BentoBox = ({ title, icon: Icon, children, count, color = "blue" }: any) => (
        <div className="flex flex-col bg-white/70 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden h-full transition-all duration-500 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
            <div className="p-6 pb-4 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-${color}-500/10 text-${color}-600`}>
                        <Icon size={20} strokeWidth={2.5} />
                    </div>
                    {title}
                </h2>
                {count !== undefined && (
                    <span className="bg-gray-100 text-gray-500 text-[13px] font-bold px-3 py-1 rounded-full">{count}</span>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {children}
            </div>
        </div>
    );

    const ListItem = ({ title, subtitle, icon, action, onClick, showTooltip }: any) => (
        <div className="group/item relative flex items-center mx-2 rounded-2xl transition-all duration-300">
            {/* Checkbox Area */}
            {icon && (
                <div className="relative z-20 p-4 pr-1 shrink-0">
                    {icon}
                </div>
            )}

            {/* Content Area */}
            <div
                onClick={onClick}
                className="flex-1 flex items-center justify-between gap-4 p-4 pl-2 rounded-2xl hover:bg-gray-50/80 transition-all cursor-pointer group/content overflow-hidden min-h-[72px]"
            >
                <div className="flex-1 min-w-0 max-w-[260px]">
                    <div className="font-semibold text-gray-900 line-clamp-2 tracking-tight leading-tight">{title}</div>
                    {subtitle && <div className="text-[11px] text-gray-500 truncate mt-1 font-medium">{subtitle}</div>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {action && <div className="text-gray-400 group-hover/content:text-gray-600 transition-colors">{action}</div>}
                    <ArrowRight size={14} className="text-gray-300 opacity-0 group-hover/content:opacity-100 -translate-x-2 group-hover/content:translate-x-0 transition-all duration-300" />
                </div>

                {/* Tooltip */}
                {showTooltip && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/content:opacity-100 transition-all duration-200 pointer-events-none z-30 translate-x-2 group-hover/content:translate-x-0">
                        <div className="bg-gray-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-xl whitespace-nowrap shadow-2xl flex items-center gap-1.5 border border-white/10">
                            Zum Projekt
                            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const handleToggleTodoWithDelay = async (todoId: string, currentIsDone: boolean) => {
        if (!currentIsDone) {
            if (pendingCompletions[todoId]) return;

            const timeout = setTimeout(async () => {
                await onToggleTodo(todoId, true); // Mark as done
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[todoId];
                    return next;
                });
            }, 3000);

            setPendingCompletions(prev => ({ ...prev, [todoId]: timeout }));
        } else {
            if (pendingCompletions[todoId]) {
                clearTimeout(pendingCompletions[todoId]);
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[todoId];
                    return next;
                });
            } else {
                await onToggleTodo(todoId, false); // Mark as active
            }
        }
    };

    if (!currentUser) return null;

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col p-6 max-w-[1920px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* HERADER */}
            <header className="shrink-0 flex justify-between items-center gap-8">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Guten Morgen, {currentUser.name.split(' ')[0]}.</h1>
                    <p className="text-lg text-gray-500 font-medium">Hier ist dein Überblick für heute.</p>
                </div>

                {/* Global Search */}
                <div className="flex-1 max-w-2xl">
                    <GlobalSearch />
                </div>

                <div className="flex gap-3 shrink-0">
                    <button onClick={() => onQuickAction('create_project')} style={{ minWidth: 'fit-content' }} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transform whitespace-nowrap"><Plus size={18} /> Projekt hinzufügen</button>
                    <button onClick={() => onQuickAction('create_client')} className="flex items-center gap-2 bg-white/80 backdrop-blur border border-white/60 text-gray-900 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-white transition shadow-sm hover:shadow-md"><UserPlus size={18} /> Kunde</button>
                </div>
            </header>

            {/* BENTO GRID */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. TASKS */}
                <BentoBox title="Meine Aufgaben" icon={CheckSquare} count={myTasks.length} color="blue">
                    {myTasks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Check size={32} className="opacity-20" /></div>
                            <p className="font-medium">Alles erledigt</p>
                            <p className="text-sm">Genieß deinen Tag!</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {myTasks.map(t => (
                                <ListItem
                                    key={t.id}
                                    icon={
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleTodoWithDelay(t.id, t.is_done || !!pendingCompletions[t.id]) }}
                                            className={`w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center group/check ${t.is_done || pendingCompletions[t.id] ? 'bg-blue-500 border-blue-500' : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50/10'}`}
                                        >
                                            <Check size={12} className={`text-white transition-opacity ${t.is_done || pendingCompletions[t.id] ? 'opacity-100' : 'opacity-0 stroke-[3px]'}`} />
                                        </button>
                                    }
                                    title={<span className={t.is_done || pendingCompletions[t.id] ? 'text-gray-400 line-through' : ''}>{t.title}</span>}
                                    subtitle={`${t.project.job_number} • ${t.project.clients?.name}`}
                                    onClick={() => onSelectProject(t.project)}
                                    showTooltip={true}
                                    action={
                                        t.deadline && (
                                            <span className={`text-[10px] font-bold tracking-tight ${new Date(t.deadline) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                                {new Date(t.deadline).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                                            </span>
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}
                </BentoBox>

                {/* 2. TIME TRACKING (Replaces Active Projects) */}
                <BentoBox title="Stundenerfassung" icon={Clock} count={todayTotal > 0 ? `${todayTotal.toFixed(1)} h` : undefined} color="blue">
                    <div className="flex flex-col h-full">
                        {todayEntries.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <p className="text-sm">Noch keine Stunden heute.</p>
                            </div>
                        ) : (
                            <div className="flex-1 space-y-2 overflow-y-auto min-h-0 px-1">
                                {todayEntries.map((t: any) => (
                                    <div
                                        key={t.id}
                                        onClick={() => {
                                            setEntryToEdit(t);
                                            setShowAddTimeModal(true);
                                        }}
                                        className="relative flex items-start justify-between p-3 rounded-xl bg-blue-50/30 border border-blue-100/50 hover:bg-blue-50 transition group cursor-pointer"
                                    >
                                        <div className="min-w-0 flex-1 mr-4">
                                            {/* Top: Client Info */}
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {t.projects?.clients?.logo_url && (
                                                    <img
                                                        src={t.projects.clients.logo_url}
                                                        alt={t.projects.clients.name}
                                                        className="h-3 w-auto max-w-[20px] object-contain opacity-70 grayscale group-hover:grayscale-0 transition-all"
                                                    />
                                                )}
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-500 transition-colors">
                                                    {t.projects?.clients?.name} <span className="text-gray-300">|</span> {t.projects?.job_number}
                                                </span>
                                            </div>

                                            {/* Main: Title & Desc */}
                                            <div className="font-bold text-gray-900 truncate text-sm leading-tight group-hover:text-blue-700 transition-colors">
                                                {t.projects?.title || 'Unbekanntes Projekt'}
                                            </div>
                                            {t.description && (
                                                <div className="text-xs text-gray-500 truncate mt-0.5">
                                                    {t.description}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Hours (Hidden on Hover) */}
                                        <div className="font-mono font-bold text-blue-600 text-sm whitespace-nowrap bg-blue-100/50 px-2 py-1 rounded-lg group-hover:opacity-0 transition-opacity duration-200">
                                            {Number(t.hours).toFixed(2)} h
                                        </div>

                                        {/* Hover Action: Edit Button */}
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                                            <span className="bg-gray-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-md flex items-center gap-1.5">
                                                Bearbeiten
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setEntryToEdit(undefined);
                                setShowAddTimeModal(true);
                            }}
                            className="mt-4 w-[90%] mx-auto py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm hover:shadow-md"
                        >
                            <Plus size={16} /> Stunden hinzufügen
                        </button>
                    </div>
                </BentoBox>

                {/* 3. DEADLINES / UPDATES */}
                <BentoBox title="Nächste Deadlines" icon={Calendar} color="orange">
                    {deadlines.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400">Keine anstehenden Termine.</div>
                    ) : (
                        <div className="space-y-1">
                            {deadlines.map(p => (
                                <ListItem
                                    key={p.id + 'dl'}
                                    icon={<span className="text-orange-500 font-bold text-xs">{new Date(p.deadline!).getDate()}.</span>}
                                    title={p.title}
                                    subtitle={p.clients?.name || 'Deadline'}
                                    onClick={() => onSelectProject(p)}
                                    action={<span className="text-xs text-gray-400 font-medium">{Math.ceil((new Date(p.deadline!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} Tage</span>}
                                />
                            ))}
                        </div>
                    )}
                </BentoBox>
            </div>

            {/* BOTTOM: SCHEDULE (GLASS CARD) */}
            <div className="h-[35%] shrink-0 flex flex-col bg-white/70 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="p-6 border-b border-gray-100/50 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <Clock size={20} className="text-gray-400" />
                        Wochenplan {new Date().getFullYear()} / {weeklyData.rows?.[0] ? 'KW Current' : 'Aktuell'}
                        <span className="text-gray-400 font-medium text-lg ml-2">({weeklyData.total.toFixed(1)} h)</span>
                    </h2>
                </div>
                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50/50 text-xs font-bold text-gray-500 sticky top-0 backdrop-blur-md z-10">
                            <tr>
                                <th className="px-6 py-3 border-b border-gray-200/50 w-1/3">Projekt</th>
                                {weeklyData.days.map(d => (
                                    <th key={d.iso} className="px-2 py-3 text-center border-b border-gray-200/50 w-16">
                                        {d.iso.substring(0, 2).toUpperCase()}
                                    </th>
                                ))}
                                <th className="px-6 py-3 text-center border-b border-gray-200/50 w-24">Gesamt</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/50">
                            {weeklyData.rows.map((row: any) => (
                                <tr key={row.project?.id} className="hover:bg-white/50 transition">
                                    <td className="px-6 py-3">
                                        <div className="font-bold text-gray-900">{row.project?.title}</div>
                                        <div className="text-xs text-gray-500">{row.project?.clients?.name}</div>
                                    </td>
                                    {weeklyData.days.map((d: any) => (
                                        <td key={d.iso} className="px-2 py-3 text-center">
                                            {row.hoursByDay[d.iso] > 0 ? (
                                                <span className="font-bold text-gray-900">{row.hoursByDay[d.iso]}</span>
                                            ) : <span className="text-gray-300">-</span>}
                                        </td>
                                    ))}
                                    <td className="px-6 py-3 text-center font-bold text-gray-900">{row.total.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* ADD TIME MODAL */}
            {/* ADD TIME MODAL */}
            <TimeEntryModal
                isOpen={showAddTimeModal}
                onClose={() => setShowAddTimeModal(false)}
                currentUser={currentUser}
                projects={projects}
                entryToEdit={entryToEdit} // Pass the entry to edit
                onEntryCreated={() => {
                    fetchData(); // Refresh data
                    setShowAddTimeModal(false);
                }}
            />
        </div>
    );
}
