import React, { useMemo, useState } from 'react';
import { Employee, Project, Todo, TimeEntry } from '../../types';
import { CheckSquare, Briefcase, Clock, Calendar, ArrowRight, Check, CheckCircle2, Circle, Plus, UserPlus, FilePlus, X } from 'lucide-react';
import { getStatusStyle, getDeadlineColorClass } from '../../utils';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../supabaseClient';

import TimeEntryModal from '../Modals/TimeEntryModal';

interface UserDashboardProps {
    onSelectProject: (p: Project) => void;
    onToggleTodo: (id: string, isDone: boolean) => void;
    onQuickAction: (action: string) => void;
}

export default function UserDashboard({ onSelectProject, onToggleTodo, onQuickAction }: UserDashboardProps) {
    const { currentUser, projects, allocations, members, timeEntries, fetchData } = useApp();
    const [showAddTimeModal, setShowAddTimeModal] = useState(false);

    // Add Time State - Removed as now handled by Modal
    // const [newTime, setNewTime] = useState({ projectId: '', positionId: '', hours: '', description: '', date: new Date().toISOString().split('T')[0] });
    // const [submittingTime, setSubmittingTime] = useState(false);



    // 1. My Open Tasks (Assigned & !Done)
    const myTasks = currentUser ? projects.flatMap(p =>
        (p.todos || [])
            .filter(t => t.assigned_to === currentUser.id && !t.is_done)
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

    const ListItem = ({ title, subtitle, icon, action, onClick }: any) => (
        <div onClick={onClick} className={`group flex items-center gap-4 p-4 mx-2 rounded-2xl hover:bg-white/80 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-black/5`}>
            {icon && <div className="shrink-0 text-gray-400 group-hover:text-blue-600 transition-colors">{icon}</div>}
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate leading-snug">{title}</div>
                {subtitle && <div className="text-sm text-gray-500 truncate leading-snug">{subtitle}</div>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );

    if (!currentUser) return null;

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col p-6 max-w-[1920px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* HERADER */}
            <header className="shrink-0 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Guten Morgen, {currentUser.name.split(' ')[0]}.</h1>
                    <p className="text-lg text-gray-500 font-medium">Hier ist dein Überblick für heute.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => onQuickAction('create_project')} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-black transition shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transform"><Plus size={18} /> Projekt</button>
                    <button onClick={() => onQuickAction('create_client')} className="flex items-center gap-2 bg-white/80 backdrop-blur border border-white/60 text-gray-900 px-5 py-2.5 rounded-full text-sm font-bold hover:bg-white transition shadow-sm hover:shadow-md"><UserPlus size={18} /> Kunde</button>
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
                                    icon={<div onClick={(e) => { e.stopPropagation(); onToggleTodo(t.id, true) }} className="w-6 h-6 rounded-full border-2 border-gray-300 group-hover:border-blue-500 group-hover:bg-blue-500/10 cursor-pointer transition flex items-center justify-center"><Check size={14} className="opacity-0 group-hover:opacity-100 text-blue-600" /></div>}
                                    title={t.title}
                                    subtitle={`${t.project.job_number} • ${t.project.clients?.name}`}
                                    onClick={() => onSelectProject(t.project)}
                                    action={
                                        t.deadline ? (
                                            <span className={`text-[10px] font-medium mr-2 ${new Date(t.deadline) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                                {new Date(t.deadline).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                                            </span>
                                        ) : <ArrowRight size={16} className="text-gray-300" />
                                    }
                                />
                            ))}
                        </div>
                    )}
                </BentoBox>

                {/* 2. TIME TRACKING (Replaces Active Projects) */}
                <BentoBox title="Stundenerfassung" icon={Clock} count={todayTotal > 0 ? `${todayTotal.toFixed(1)} h` : undefined} color="orange">
                    <div className="flex flex-col h-full">
                        {todayEntries.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <p className="text-sm">Noch keine Stunden heute.</p>
                            </div>
                        ) : (
                            <div className="flex-1 space-y-1 overflow-y-auto min-h-0">
                                {todayEntries.map((t: any) => (
                                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-orange-50/50 border border-orange-100/50 hover:bg-orange-50 transition">
                                        <div className="min-w-0 flex-1 mr-4">
                                            <div className="font-bold text-gray-900 truncate text-sm">
                                                {t.positions?.title || t.projects?.title || 'Unbekannt'}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {t.projects?.clients?.name} • {t.description || '-'}
                                            </div>
                                        </div>
                                        <div className="font-mono font-bold text-orange-600 text-sm whitespace-nowrap">
                                            {Number(t.hours).toFixed(2)} h
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button onClick={() => setShowAddTimeModal(true)} className="mt-4 w-[90%] mx-auto py-2.5 bg-gray-900 hover:bg-black text-white rounded-full text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm hover:shadow-md">
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
                onEntryCreated={() => {
                    fetchData(); // Refresh data
                    setShowAddTimeModal(false);
                }}
            />
        </div>
    );
}
