import React, { useMemo, useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Employee, Project, Todo, TimeEntry, DashboardConfig, WidgetId, DashboardWidgetConfig } from '../../types';
import { CheckSquare, Briefcase, Clock, Calendar, ArrowRight, Check, Plus, Search, Settings2, Minus, Star, Users, Briefcase as BriefcaseIcon, CheckCircle2 } from 'lucide-react';
import { getStatusStyle, getDeadlineColorClass } from '../../utils';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../supabaseClient';
import TimeEntryModal from '../Modals/TimeEntryModal';
import TaskDetailSidebar from '../Tasks/TaskDetailSidebar';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import ConfirmModal from '../Modals/ConfirmModal';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Define our own LayoutItem interface to avoid type confusion
interface RGLLayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
}

interface UserDashboardProps {
    onSelectProject: (p: Project) => void;
    onToggleTodo: (id: string, isDone: boolean) => void;
    onQuickAction: (action: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────
// 12-column grid for maximum flexibility
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const ROW_HEIGHT = 60;

// Default layout matching the screenshot:
// Row 1: Tasks (4), Time (4), Deadlines (4)
// Row 2: Resource Planning / Schedule (12)
const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
    { id: 'assigned_todos', x: 0, y: 0, w: 4, h: 6 },
    { id: 'time_tracking', x: 4, y: 0, w: 4, h: 6 },
    { id: 'deadlines', x: 8, y: 0, w: 4, h: 6 },
    { id: 'resource_planning', x: 0, y: 6, w: 12, h: 5 } // Wide bottom widget
];

const MIN_W = 2;
const MIN_H = 3;

// ─── Migration Helper ─────────────────────────────────────────────
function migrateConfig(savedWidgets: any[]): DashboardWidgetConfig[] {
    if (!Array.isArray(savedWidgets)) return DEFAULT_WIDGETS;

    // Check if completely new schema (x, y, w, h) or old (position, size)
    const isNewSchema = savedWidgets.every(w => 'x' in w && 'y' in w && 'w' in w && 'h' in w);
    if (isNewSchema) return savedWidgets;

    // Migrate old 4x2 grid (position 0-7) to 12-col grid
    return savedWidgets.map((w: any) => {
        // Old size map: small(1x1) -> 3x4 (in 12-col), medium(2x1) -> 6x4, large(2x2) -> 6x8
        let width = 3; // default small
        let height = 4;

        if (w.size === 'medium' || w.w === 2) width = 6;
        if (w.size === 'large' || (w.w === 2 && w.h === 2)) { width = 6; height = 8; }

        // Map position (0-3 row 1, 4-7 row 2) to x/y
        const pos = typeof w.position === 'number' ? w.position : 0;
        const oldCol = pos % 4; // 0-3
        const oldRow = Math.floor(pos / 4); // 0-1

        return {
            id: w.id,
            x: oldCol * 3, // 0->0, 1->3, 2->6, 3->9
            y: oldRow * 5, // Arbitrary spacing
            w: width,
            h: height
        };
    });
}

// ─── Component ────────────────────────────────────────────────────
export default function UserDashboard({ onSelectProject, onToggleTodo, onQuickAction }: UserDashboardProps) {
    const router = useRouter();
    const { currentUser, employees, projects, allocations, members, timeEntries, fetchData } = useApp();
    const [showAddTimeModal, setShowAddTimeModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showGallery, setShowGallery] = useState(false); // Widget gallery

    // We keep local state for the layout to ensure smooth dragging
    const [layoutState, setLayoutState] = useState<RGLLayoutItem[]>([]);
    const [entryToEdit, setEntryToEdit] = useState<TimeEntry | undefined>(undefined);
    const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
    const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void; } | null>(null);

    // ─── Data Prep ───────────────────────────────────────────────
    const assignedTasks = currentUser ? projects.flatMap(p =>
        (p.todos || [])
            .filter(t => t.assigned_to === currentUser.id && (!t.is_done))
            .map(t => ({ ...t, project: p }))
    ) : [];

    const todayEntries = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        return (timeEntries || []).filter((t: any) => t.date === todayStr);
    }, [timeEntries]);

    const todayTotal = useMemo(() => {
        return todayEntries.reduce((acc: number, t: any) => acc + (Number(t.hours) || 0), 0);
    }, [todayEntries]);

    const deadlines = projects
        .filter(p => {
            if (!p.deadline) return false;
            const deadlineDate = new Date(p.deadline);
            const now = new Date();
            const diffDays = (deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            // Show if upcoming OR overdue by less than 3 days
            return diffDays > -3;
        })
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
        .slice(0, 5);

    const favoriteProjects = useMemo(() => {
        const favIds = currentUser?.dashboard_config?.favoriteProjectIds || [];
        return projects.filter(p => favIds.includes(p.id));
    }, [projects, currentUser]);

    const { personalTodos } = useApp();
    const userPersonalTodos = useMemo(() => {
        return (personalTodos || [])
            .filter(t => currentUser ? t.assigned_to === currentUser.id : true)
            .filter(t => !t.is_done);
    }, [personalTodos, currentUser]);

    const allAvailableWidgets = [
        { id: 'favorite_projects', title: 'Favoriten', icon: Star, color: 'blue' },
        { id: 'deadlines', title: 'Nächste Termine/Deadlines', icon: Calendar, color: 'orange' },
        { id: 'assigned_todos', title: 'Zugewiesene To-Dos', icon: CheckSquare, color: 'blue' },
        { id: 'private_todos', title: 'Private To-Do-Liste', icon: CheckSquare, color: 'green' },
        { id: 'resource_planning', title: 'Wochenplan', icon: Calendar, color: 'purple' },
        { id: 'time_tracking', title: 'Stundenerfassung', icon: Clock, color: 'blue' }
    ];

    // ─── Config & Layout ──────────────────────────────────────────
    const currentWidgets = useMemo(() => {
        if (!currentUser?.dashboard_config?.widgets) return DEFAULT_WIDGETS;
        return migrateConfig(currentUser.dashboard_config.widgets);
    }, [currentUser]);

    // Sync layoutState with currentWidgets on load/change
    useEffect(() => {
        const initialLayout: RGLLayoutItem[] = currentWidgets.map(w => ({
            i: w.id,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            minW: MIN_W,
            minH: MIN_H
        }));
        setLayoutState(initialLayout);
    }, [currentWidgets]);

    // ─── Handlers ─────────────────────────────────────────────────
    const handleLayoutChange = (newLayout: RGLLayoutItem[]) => {
        setLayoutState(newLayout); // Update local state immediately for smoothness
    };

    const saveLayout = async (finalLayout: RGLLayoutItem[]) => {
        if (!currentUser) return;

        // Convert Layout[] back to DashboardWidgetConfig[]
        const newWidgets: DashboardWidgetConfig[] = finalLayout.map(l => ({
            id: l.i as WidgetId,
            x: l.x,
            y: l.y,
            w: l.w,
            h: l.h
        }));

        const { error } = await supabase
            .from('employees')
            .update({ dashboard_config: { widgets: newWidgets } })
            .eq('id', currentUser.id);

        if (!error) fetchData();
    };

    const handleRemoveWidget = async (id: WidgetId) => {
        const newWidgets = currentWidgets.filter(w => w.id !== id);
        if (!currentUser) return;
        const { error } = await supabase
            .from('employees')
            .update({ dashboard_config: { widgets: newWidgets } })
            .eq('id', currentUser.id);
        if (!error) fetchData();
    };

    const handleAddWidget = async (id: WidgetId) => {
        // Add at top left or find first open spot (react-grid-layout handles collision automatically by pushing down)
        const newWidget: DashboardWidgetConfig = { id, x: 0, y: 0, w: 4, h: 6 };
        const newWidgets = [...currentWidgets, newWidget];

        if (!currentUser) return;
        const { error } = await supabase
            .from('employees')
            .update({ dashboard_config: { widgets: newWidgets } })
            .eq('id', currentUser.id);

        if (!error) {
            fetchData();
            setShowGallery(false);
        }
    };

    // ─── Render Widget Content ────────────────────────────────────
    const renderWidgetContent = (id: string, w: number, h: number) => {
        const isSmall = w < 4 && h < 4;

        switch (id) {
            case 'assigned_todos':
                return (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-3 custom-scrollbar">
                            {assignedTasks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                    <CheckSquare size={32} strokeWidth={1.5} />
                                    <span className="text-xs font-medium mt-2">Alles erledigt</span>
                                </div>
                            ) : (
                                (assignedTasks as any[]).map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => router.push(`/uebersicht?projectId=${t.project_id}&highlight_task_id=${t.id}`)}
                                        className="group/item relative flex items-start gap-4 p-4 rounded-2xl hover:bg-white/60 transition-all border border-transparent hover:border-gray-200/50 hover:shadow-sm cursor-pointer"
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleTodo(t.id, !t.is_done); }}
                                            className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${t.is_done ? 'bg-blue-500 border-blue-500' : 'border-gray-300 group-hover/item:border-blue-400'}`}
                                        >
                                            {t.is_done && <Check size={10} className="text-white" />}
                                        </button>
                                        <div className="flex-1 min-w-0 pr-8">
                                            <div className="flex flex-col gap-0.5">
                                                <div className={`text-sm font-semibold transition-all leading-tight ${t.is_done ? 'text-gray-400 line-through' : 'text-gray-900 group-hover/item:text-blue-700'}`}>
                                                    {t.title}
                                                    {t.title.length > 30 && '...'}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{t.project?.title}</span>
                                            </div>
                                            {t.deadline && (
                                                <div className={`flex items-center gap-1 text-[10px] font-medium mt-1.5 ${new Date(t.deadline) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                                                    <Calendar size={10} />
                                                    {new Date(t.deadline).toLocaleDateString('de-DE')}
                                                </div>
                                            )}
                                        </div>

                                        {/* Floating Action Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/uebersicht?projectId=${t.project_id}&highlight_task_id=${t.id}`);
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 translate-x-4 opacity-0 group-hover/item:translate-x-0 group-hover/item:opacity-100 transition-all duration-300 ease-out z-10 bg-black text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-xl flex items-center gap-1.5 hover:scale-105 active:scale-95"
                                        >
                                            Details <ArrowRight size={10} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            case 'time_tracking':
                return (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar pb-14">
                            {todayEntries.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 py-8">
                                    <Clock size={32} strokeWidth={1.5} />
                                    <span className="text-xs font-medium mt-2">Noch keine Einträge heute</span>
                                </div>
                            ) : (
                                todayEntries.map((entry: any) => (
                                    <div
                                        key={entry.id}
                                        onClick={() => { setEntryToEdit(entry); setShowAddTimeModal(true); }}
                                        className="group flex items-center justify-between p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-900">{entry.hours}h</span>
                                                <span className="text-xs text-gray-500 truncate">{entry.projects?.title || 'Intern'}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-400 truncate mt-0.5">{entry.description || 'Keine Beschreibung'}</div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEntryToEdit(entry); setShowAddTimeModal(true); }}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-blue-600 transition-all"
                                        >
                                            <Settings2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-gray-100 shadow-lg">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Heute Gesamt</span>
                                <span className="text-xl font-black text-gray-900">{todayTotal.toFixed(2)}h</span>
                            </div>
                            <button
                                onClick={() => { setEntryToEdit(undefined); setShowAddTimeModal(true); }}
                                className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:scale-105 transition-all shadow-md shadow-gray-200"
                            >
                                <Plus size={18} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                );
            case 'deadlines':
                return (
                    <div className="h-full flex flex-col items-center justify-center">
                        {deadlines.length === 0 ? (
                            <span className="text-sm text-gray-400 font-medium opacity-60">Keine anstehenden Termine.</span>
                        ) : (
                            <div className="w-full space-y-2">
                                {deadlines.map(p => (
                                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50/50 border border-orange-100">
                                        <div className={`w-2 h-2 rounded-full ${getDeadlineColorClass(p.deadline!)}`} />
                                        <span className="text-sm font-bold text-gray-800 truncate flex-1">{p.title}</span>
                                        <span className="text-[10px] font-bold text-gray-400">{new Date(p.deadline!).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}.</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'resource_planning':
                return (
                    <div className="h-full flex items-center justify-center text-gray-300">
                        {/* Placeholder for weekly plan visualization */}
                        <div className="w-full grid grid-cols-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center opacity-50">
                            <span>Projekt</span>
                            <span>Mo</span>
                            <span>Di</span>
                            <span>Mi</span>
                            <span>Do</span>
                            <span>Fr</span>
                        </div>
                    </div>
                );
            case 'favorite_projects':
                return (
                    <div className="h-full flex flex-col gap-3">
                        {favoriteProjects.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 py-8">
                                <Star size={32} strokeWidth={1.5} className="opacity-40" />
                                <span className="text-xs font-medium mt-3">Noch keine Favoriten</span>
                            </div>
                        ) : (
                            favoriteProjects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => onSelectProject(p)}
                                    className="group relative flex items-center gap-4 p-4 bg-white/50 backdrop-blur-sm border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 rounded-2xl transition-all w-full text-left shadow-sm hover:shadow-md"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                                        <Star size={18} fill="currentColor" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-sm font-bold text-gray-800 truncate">{p.title}</span>
                                        <span className="block text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-0.5">{p.clients?.name}</span>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                            ))
                        )}
                    </div>
                );
            case 'private_todos':
                return (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 space-y-3 custom-scrollbar">
                            {userPersonalTodos.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 py-8">
                                    <CheckCircle2 size={32} strokeWidth={1.5} />
                                    <span className="text-xs font-medium mt-2">Private Liste leer</span>
                                </div>
                            ) : (
                                userPersonalTodos.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => setSelectedTask(t as any)}
                                        className="group/item relative flex items-center gap-4 p-4 rounded-2xl hover:bg-white/60 transition-all border border-transparent hover:border-gray-200/50 hover:shadow-sm cursor-pointer"
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleTodo(t.id, !t.is_done); }}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${t.is_done ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover/item:border-green-500'}`}
                                        >
                                            {t.is_done && <Check size={10} className="text-white" />}
                                        </button>
                                        <div className="flex-1 min-w-0 pr-10">
                                            <div className={`text-sm font-semibold transition-all leading-tight ${t.is_done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                {t.title}
                                            </div>
                                        </div>

                                        {/* Floating Action Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTask(t as any);
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 translate-x-4 opacity-0 group-hover/item:translate-x-0 group-hover/item:opacity-100 transition-all duration-300 ease-out z-10 bg-black text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-xl flex items-center gap-1.5 hover:scale-105 active:scale-95"
                                        >
                                            Bearbeiten
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    // ─── Render ───────────────────────────────────────────────────
    if (!currentUser) return null;

    return (
        <div className="min-h-screen p-6 md:p-10 max-w-[1920px] mx-auto animate-in fade-in duration-500">

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">Guten Morgen, {currentUser.name.split(' ')[0]}.</h1>
                    <p className="text-gray-500 font-medium mt-2">Hier ist dein Überblick für heute.</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('agentur-os-open-search'))}
                        className="w-11 h-11 bg-white border border-gray-100 rounded-xl text-gray-400 flex items-center justify-center hover:border-blue-300 hover:text-blue-500 hover:shadow-md transition-all group"
                        title="Suche (Cmd+K)"
                    >
                        <Search size={20} strokeWidth={2.5} />
                    </button>
                    {isEditMode && (
                        <button onClick={() => setShowGallery(true)} className="bg-white border border-gray-100 hover:border-blue-300 text-gray-700 hover:text-blue-600 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                            <Plus size={16} strokeWidth={3} /> Widget
                        </button>
                    )}
                    <button onClick={() => onQuickAction('create_project')} className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-gray-200 flex items-center gap-2">
                        <Plus size={16} strokeWidth={3} /> Projekt
                    </button>
                    {/* Settings / Edit Mode Toggle */}
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${isEditMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-gray-100 text-gray-400 hover:text-gray-900'}`}
                    >
                        {isEditMode ? <Check size={20} strokeWidth={3} /> : <Settings2 size={20} />}
                    </button>
                </div>
            </header>

            {/* Grid Layout */}
            <div className="relative">
                <ResponsiveGridLayout
                    className="layout"
                    layouts={{ lg: layoutState }}
                    breakpoints={GRID_COLS}
                    cols={GRID_COLS}
                    rowHeight={ROW_HEIGHT}
                    isDraggable={isEditMode}
                    isResizable={isEditMode}
                    onLayoutChange={(layout) => handleLayoutChange(layout as any)}
                    onDragStop={(layout) => saveLayout(layout as any)}
                    onResizeStop={(layout) => saveLayout(layout as any)}
                    margin={[24, 24]}
                    containerPadding={[0, 0]}
                    draggableHandle=".drag-handle"
                >
                    {currentWidgets.map(widget => {
                        const info = allAvailableWidgets.find(i => i.id === widget.id);
                        if (!info) return <div key={widget.id} data-grid={{ x: 0, y: 0, w: 4, h: 6 }}>Unknown Widget</div>;

                        return (
                            <div key={widget.id} className="group relative flex flex-col bg-white rounded-[32px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-white hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-shadow">
                                {/* Header */}
                                <div className="p-6 pb-2 flex items-center gap-3 shrink-0 drag-handle cursor-grab active:cursor-grabbing">
                                    <div className={`w-8 h-8 rounded-xl bg-${info.color}-50 text-${info.color}-500 flex items-center justify-center`}>
                                        <info.icon size={16} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-base font-bold text-gray-900 tracking-tight">{info.title}</span>
                                    {widget.id === 'assigned_todos' && (
                                        <span className="ml-auto w-6 h-6 rounded-full bg-gray-50 text-gray-500 text-[10px] font-black flex items-center justify-center">
                                            {assignedTasks.length}
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-6 pt-2 overflow-hidden">
                                    {renderWidgetContent(widget.id, widget.w, widget.h)}
                                </div>

                                {/* Edit Mode Controls */}
                                {isEditMode && (
                                    <>
                                        <div className="absolute inset-0 border-2 border-blue-500/20 rounded-[32px] pointer-events-none" />
                                        <button
                                            onClick={() => handleRemoveWidget(widget.id)}
                                            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer z-50"
                                        >
                                            <Minus size={16} strokeWidth={4} />
                                        </button>
                                        {/* Resize Handle Override - react-grid-layout adds its own handle, but we can style it or overlay */}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </ResponsiveGridLayout>

                {/* Empty State / Add Widget Button (if no widgets) */}
                {currentWidgets.length === 0 && (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-[32px]">
                        <p className="text-gray-400 font-medium mb-4">Dein Dashboard ist leer.</p>
                        <button onClick={() => setShowGallery(true)} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold">Variablen hinzufügen</button>
                    </div>
                )}
            </div>

            {/* Widget Gallery Modal */}
            {showGallery && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-gray-900/40 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 p-12">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-3xl font-black text-gray-900">Widget hinzufügen</h2>
                            <button onClick={() => setShowGallery(false)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Plus size={24} className="rotate-45" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {allAvailableWidgets.filter(w => !currentWidgets.find(cw => cw.id === w.id)).map(w => (
                                <button key={w.id} onClick={() => handleAddWidget(w.id as WidgetId)} className="flex items-center gap-4 p-6 rounded-3xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left group">
                                    <div className={`w-12 h-12 rounded-2xl bg-${w.color}-50 text-${w.color}-500 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                        <w.icon size={24} />
                                    </div>
                                    <span className="font-bold text-gray-900">{w.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <TimeEntryModal isOpen={showAddTimeModal} onClose={() => setShowAddTimeModal(false)} currentUser={currentUser} projects={projects} entryToEdit={entryToEdit} onEntryCreated={() => { fetchData(); setShowAddTimeModal(false); }} />

            {selectedTask && (
                <TaskDetailSidebar
                    task={selectedTask}
                    employees={employees}
                    projects={projects}
                    onClose={() => setSelectedTask(null)}
                    onTaskClick={(t) => setSelectedTask(t)}
                    onUpdate={async (id, updates) => {
                        const { error } = await supabase.from('todos').update(updates).eq('id', id);
                        if (!error) fetchData();
                    }}
                    onDelete={async (id) => {
                        setConfirmConfig({
                            title: 'Aufgabe löschen?',
                            message: 'Möchtest du diese Aufgabe wirklich unwiderruflich löschen?',
                            onConfirm: async () => {
                                const { error } = await supabase.from('todos').delete().eq('id', id);
                                if (!error) {
                                    setSelectedTask(null);
                                    fetchData();
                                }
                                setConfirmConfig(null);
                            }
                        });
                    }}
                    onRefresh={fetchData}
                />
            )}

            <ConfirmModal
                isOpen={!!confirmConfig}
                onCancel={() => setConfirmConfig(null)}
                onConfirm={confirmConfig?.onConfirm || (() => { })}
                title={confirmConfig?.title || ''}
                message={confirmConfig?.message || ''}
            />
        </div>
    );
}
