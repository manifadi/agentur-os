'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Project, Todo, Employee } from '../../types';
import {
    ChevronRight, CheckCircle2, Plus, History, Check, Search, X, Briefcase, User,
    Flame, Star, Calendar, Inbox, ListTree, LayoutGrid,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import TaskHistoryModal from './TaskHistoryModal';
import MultiSelectDropdown, { MultiSelectItem } from '../Dashboard/MultiSelectDropdown';
import UserAvatar from '../UI/UserAvatar';
import ClientLogo from '../UI/ClientLogo';

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

type ViewMode = 'today' | 'list';
type SourceFilter = 'all' | 'project' | 'private';

// Unified task type with attached project info
interface UnifiedTask extends Todo {
    _project: Project | null; // null = personal
    _parent?: Todo | null;    // parent task if this is a subtask
}

const PAGE_SIZE = 50;
const PREFS_KEY = 'vela-tasks-view';

export default function GlobalTasks({
    projects, personalTodos, employees, onSelectProject, onUpdate,
    currentUser, onTaskClick,
}: GlobalTasksProps) {
    // ── UI state ──────────────────────────────────────────
    // Default: Projekt-Tasks (zugewiesene) in Heute-View. Wird beim Mount aus localStorage überschrieben.
    const [viewMode, setViewMode] = useState<ViewMode>('today');
    const [source, setSource] = useState<SourceFilter>('project');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterProjectIds, setFilterProjectIds] = useState<string[]>([]);
    const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
    const [showHistory, setShowHistory] = useState(false);
    // Inline-add private task
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [addingPrivate, setAddingPrivate] = useState(false);

    // ── Persist last-used view in localStorage ────────────
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    useEffect(() => {
        try {
            const raw = localStorage.getItem(PREFS_KEY);
            if (raw) {
                const prefs = JSON.parse(raw);
                if (prefs.viewMode === 'today' || prefs.viewMode === 'list') setViewMode(prefs.viewMode);
                if (prefs.source === 'all' || prefs.source === 'project' || prefs.source === 'private') setSource(prefs.source);
            }
        } catch { /* ignore */ }
        setPrefsLoaded(true);
    }, []);
    useEffect(() => {
        if (!prefsLoaded) return;
        try { localStorage.setItem(PREFS_KEY, JSON.stringify({ viewMode, source })); } catch { /* ignore */ }
    }, [viewMode, source, prefsLoaded]);

    // ── Task-row interaction state ────────────────────────
    const pendingTimeouts = React.useRef<Record<string, NodeJS.Timeout>>({});
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const [editingPersonalId, setEditingPersonalId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    useEffect(() => {
        return () => {
            Object.entries(pendingTimeouts.current).forEach(([id, timeout]) => {
                clearTimeout(timeout);
                supabase.from('todos').update({ is_done: true }).eq('id', id).then(() => { });
            });
            pendingTimeouts.current = {};
        };
    }, []);

    // Reset pagination when filters change
    useEffect(() => {
        setDisplayLimit(PAGE_SIZE);
    }, [searchQuery, filterProjectIds, source, viewMode]);

    // ── Build unified task list ───────────────────────────
    // Includes top-level tasks AND subtasks — every assigned task is its own row.
    // Parent reference is attached for breadcrumb display in the row.
    const allTasks = useMemo<UnifiedTask[]>(() => {
        const result: UnifiedTask[] = [];

        if (source !== 'private') {
            for (const p of projects) {
                const todos = p.todos || [];
                const byId = new Map(todos.map(t => [t.id, t]));
                for (const t of todos) {
                    if (t.is_done && !pendingIds.has(t.id)) continue;
                    if (t.assigned_to !== currentUser?.id) continue;
                    const parent = t.parent_id ? byId.get(t.parent_id) || null : null;
                    result.push({ ...t, _project: p, _parent: parent });
                }
            }
        }

        if (source !== 'project') {
            const byId = new Map(personalTodos.map(t => [t.id, t]));
            for (const t of personalTodos) {
                if (t.is_done && !pendingIds.has(t.id)) continue;
                const parent = t.parent_id ? byId.get(t.parent_id) || null : null;
                result.push({ ...t, _project: null, _parent: parent });
            }
        }

        return result;
    }, [projects, personalTodos, currentUser, pendingIds, source]);

    // ── Apply filters ─────────────────────────────────────
    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return allTasks.filter(t => {
            if (q) {
                const titleMatch = t.title?.toLowerCase().includes(q);
                const projMatch = t._project?.title?.toLowerCase().includes(q);
                const jobMatch = t._project?.job_number?.toLowerCase().includes(q);
                if (!titleMatch && !projMatch && !jobMatch) return false;
            }
            if (filterProjectIds.length > 0) {
                const pid = t._project?.id;
                if (!pid || !filterProjectIds.includes(pid)) return false;
            }
            return true;
        });
    }, [allTasks, searchQuery, filterProjectIds]);

    // ── Build day buckets ─────────────────────────────────
    const buckets = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart); todayEnd.setHours(23, 59, 59, 999);
        const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7);

        const overdue: UnifiedTask[] = [];
        const today: UnifiedTask[] = [];
        const thisWeek: UnifiedTask[] = [];
        const later: UnifiedTask[] = [];

        for (const t of filtered) {
            if (!t.deadline) { later.push(t); continue; }
            const dd = new Date(t.deadline);
            if (dd < todayStart) overdue.push(t);
            else if (dd <= todayEnd) today.push(t);
            else if (dd <= weekEnd) thisWeek.push(t);
            else later.push(t);
        }

        // Sort each bucket by deadline ascending; later by no-deadline-last
        const byDeadline = (a: UnifiedTask, b: UnifiedTask) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        };
        overdue.sort(byDeadline);
        today.sort(byDeadline);
        thisWeek.sort(byDeadline);
        later.sort(byDeadline);

        return { overdue, today, thisWeek, later };
    }, [filtered]);

    // ── List view: sort by deadline (overdue first) ───────
    const listSorted = useMemo(() => {
        const result = [...filtered];
        result.sort((a, b) => {
            // Overdue/today first
            const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
            const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
            return aDate - bDate;
        });
        return result;
    }, [filtered]);

    const visibleListTasks = listSorted.slice(0, displayLimit);
    const hasMore = listSorted.length > displayLimit;

    // ── Handlers ──────────────────────────────────────────
    const handleToggle = async (todoId: string, currentIsDone: boolean) => {
        if (!currentIsDone) {
            if (pendingTimeouts.current[todoId]) return;
            setPendingIds(prev => new Set(prev).add(todoId));
            const timeout = setTimeout(async () => {
                await supabase.from('todos').update({ is_done: true }).eq('id', todoId);
                delete pendingTimeouts.current[todoId];
                setPendingIds(prev => { const n = new Set(prev); n.delete(todoId); return n; });
                onUpdate();
            }, 3000);
            pendingTimeouts.current[todoId] = timeout;
        } else {
            if (pendingTimeouts.current[todoId]) {
                clearTimeout(pendingTimeouts.current[todoId]);
                delete pendingTimeouts.current[todoId];
                setPendingIds(prev => { const n = new Set(prev); n.delete(todoId); return n; });
            } else {
                await supabase.from('todos').update({ is_done: false }).eq('id', todoId);
                onUpdate();
            }
        }
    };

    const handleAssignee = async (todoId: string, newAssigneeId: string) => {
        await supabase.from('todos').update({ assigned_to: newAssigneeId || null }).eq('id', todoId);
        onUpdate();
    };

    const handleAddPrivate = async (title: string) => {
        if (!currentUser || !title.trim()) return false;
        const { error } = await supabase.from('todos').insert({
            title: title.trim(),
            assigned_to: currentUser.id,
            organization_id: currentUser.organization_id,
            is_done: false,
        });
        if (error) {
            console.error('[GlobalTasks] insert failed:', error);
            return false;
        }
        await onUpdate();
        return true;
    };

    // ── Stats for header ──────────────────────────────────
    const stats = {
        overdue: buckets.overdue.length,
        today: buckets.today.length,
        thisWeek: buckets.thisWeek.length,
        total: filtered.length,
    };

    // ── Filter options ────────────────────────────────────
    const projectsWithTasks = useMemo(() => {
        const ids = new Set(allTasks.map(t => t._project?.id).filter(Boolean));
        return projects.filter(p => ids.has(p.id));
    }, [allTasks, projects]);

    const projectFilterItems: MultiSelectItem[] = useMemo(() =>
        projectsWithTasks.map(p => ({
            id: p.id,
            label: p.title,
            leading: <ClientLogo src={p.clients?.logo_url} name={p.clients?.name || 'NA'} size={20} rounded="rounded" />,
            sublabel: p.job_number,
        }))
        , [projectsWithTasks]);

    return (
        <div className="max-w-6xl mx-auto py-6 px-4 space-y-5 animate-in fade-in duration-500">

            {/* ─── Header ──────────────────────────────────── */}
            <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h1 className="ds-display">Aufgaben</h1>
                    <p className="ds-caption mt-1">Dein persönlicher Arbeitsbereich</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowHistory(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        <History size={14} /> Historie
                    </button>
                </div>
            </header>

            {/* ─── Stats row (clickable to switch view+filter) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                    label="Überfällig" value={stats.overdue} icon={<Flame size={14} />} color="#EF4444"
                    onClick={() => setViewMode('today')}
                    active={viewMode === 'today' && stats.overdue > 0}
                />
                <StatCard
                    label="Heute" value={stats.today} icon={<Star size={14} />} color="#F59E0B"
                    onClick={() => setViewMode('today')}
                />
                <StatCard
                    label="Diese Woche" value={stats.thisWeek} icon={<Calendar size={14} />} color="#3B82F6"
                    onClick={() => setViewMode('today')}
                />
                <StatCard
                    label="Alle offen" value={stats.total} icon={<Inbox size={14} />} color="#6B7280"
                    onClick={() => setViewMode('list')}
                    active={viewMode === 'list'}
                />
            </div>

            {/* ─── Toolbar: View toggle + Scope + Filters ───── */}
            <div className="p-3 rounded-2xl flex flex-col md:flex-row md:items-center gap-3 flex-wrap"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

                {/* View toggle */}
                <div className="inline-flex p-0.5 rounded-xl"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                    <SegmentButton active={viewMode === 'today'} onClick={() => setViewMode('today')}>
                        <LayoutGrid size={13} /> Heute
                    </SegmentButton>
                    <SegmentButton active={viewMode === 'list'} onClick={() => setViewMode('list')}>
                        <ListTree size={13} /> Liste
                    </SegmentButton>
                </div>

                {/* Source toggle */}
                <div className="inline-flex p-0.5 rounded-xl"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                    <SegmentButton active={source === 'all'} onClick={() => setSource('all')}>
                        Alle
                    </SegmentButton>
                    <SegmentButton active={source === 'project'} onClick={() => setSource('project')}>
                        <Briefcase size={11} /> Projekt
                    </SegmentButton>
                    <SegmentButton active={source === 'private'} onClick={() => setSource('private')}>
                        <User size={11} /> Privat
                    </SegmentButton>
                </div>

                <div className="flex-1" />

                {/* Search */}
                <div className="relative flex-1 md:max-w-xs min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Aufgabe oder Projekt suchen…"
                        className="w-full pl-9 pr-8 py-2 text-[13px] rounded-xl outline-none"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5" style={{ color: 'var(--text-muted)' }}>
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Project filter — only shown when projects are visible in current source */}
                {source !== 'private' && projectsWithTasks.length > 0 && (
                    <MultiSelectDropdown
                        label="Projekt"
                        icon={<Briefcase size={13} />}
                        items={projectFilterItems}
                        selectedIds={filterProjectIds}
                        onChange={setFilterProjectIds}
                        searchable={projectsWithTasks.length > 6}
                        searchPlaceholder="Projekt filtern…"
                        alignRight
                    />
                )}
            </div>

            {/* ─── Inline add (Privat-Tasks) ────────────────── */}
            {source !== 'project' && (
                <InlineAddBar
                    title={newTaskTitle}
                    setTitle={setNewTaskTitle}
                    adding={addingPrivate}
                    onSubmit={async () => {
                        if (!newTaskTitle.trim()) return;
                        setAddingPrivate(true);
                        const ok = await handleAddPrivate(newTaskTitle);
                        setAddingPrivate(false);
                        if (ok) setNewTaskTitle('');
                    }}
                />
            )}

            {/* ─── Content: Today or List view ──────────────── */}
            {filtered.length === 0 ? (
                <EmptyState />
            ) : viewMode === 'today' ? (
                <TodayView
                    buckets={buckets}
                    employees={employees}
                    onSelectProject={onSelectProject}
                    onTaskClick={onTaskClick}
                    onToggle={handleToggle}
                    onAssignee={handleAssignee}
                    pendingIds={pendingIds}
                    editingPersonalId={editingPersonalId}
                    editingTitle={editingTitle}
                    setEditingPersonalId={setEditingPersonalId}
                    setEditingTitle={setEditingTitle}
                    onUpdate={onUpdate}
                />
            ) : (
                <>
                    <ListView
                        tasks={visibleListTasks}
                        employees={employees}
                        onSelectProject={onSelectProject}
                        onTaskClick={onTaskClick}
                        onToggle={handleToggle}
                        onAssignee={handleAssignee}
                        pendingIds={pendingIds}
                        editingPersonalId={editingPersonalId}
                        editingTitle={editingTitle}
                        setEditingPersonalId={setEditingPersonalId}
                        setEditingTitle={setEditingTitle}
                        onUpdate={onUpdate}
                    />
                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={() => setDisplayLimit(d => d + PAGE_SIZE)}
                                className="px-4 py-2 rounded-xl text-[13px] font-bold transition-all shadow-sm"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                            >
                                Weitere {Math.min(PAGE_SIZE, listSorted.length - displayLimit)} laden
                            </button>
                        </div>
                    )}
                </>
            )}

            {showHistory && (
                <TaskHistoryModal
                    projects={projects}
                    personalTodos={personalTodos}
                    onClose={() => setShowHistory(false)}
                    onToggle={handleToggle}
                    onTaskClick={(t) => { setShowHistory(false); onTaskClick?.(t); }}
                />
            )}
        </div>
    );
}

// ─── Reusable: Stat card ──────────────────────────────────
function StatCard({ label, value, icon, color, onClick, active }: {
    label: string; value: number; icon: React.ReactNode; color: string;
    onClick?: () => void; active?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 p-4 rounded-2xl transition-all text-left"
            style={{
                background: 'var(--bg-card)',
                border: `1px solid ${active ? color : 'var(--border-default)'}`,
                boxShadow: active ? `0 0 0 2px ${color}20` : 'none',
            }}
        >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${color}15`, color }}>
                {icon}
            </div>
            <div>
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</div>
                <div className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{value}</div>
            </div>
        </button>
    );
}

// ─── Reusable: Segment toggle button ──────────────────────
function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all"
            style={{
                background: active ? 'var(--bg-surface)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
        >
            {children}
        </button>
    );
}

// ─── Empty state ──────────────────────────────────────────
function EmptyState() {
    return (
        <div className="text-center py-20 rounded-3xl border-2 border-dashed"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-placeholder)' }}>
                <CheckCircle2 size={32} strokeWidth={1.5} />
            </div>
            <p className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Nichts zu tun.</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Genieß den Moment oder fügst eine neue Aufgabe hinzu.</p>
        </div>
    );
}

// ─── Today view: 4 buckets ────────────────────────────────
interface RowProps {
    employees: Employee[];
    onSelectProject: (p: Project) => void;
    onTaskClick?: (t: Todo) => void;
    onToggle: (id: string, currentDone: boolean) => Promise<void>;
    onAssignee: (id: string, assigneeId: string) => Promise<void>;
    pendingIds: Set<string>;
    editingPersonalId: string | null;
    editingTitle: string;
    setEditingPersonalId: (id: string | null) => void;
    setEditingTitle: (s: string) => void;
    onUpdate: () => void;
}

function TodayView({ buckets, ...rowProps }: { buckets: { overdue: UnifiedTask[]; today: UnifiedTask[]; thisWeek: UnifiedTask[]; later: UnifiedTask[] } } & RowProps) {
    return (
        <div className="space-y-5">
            {buckets.overdue.length > 0 && (
                <BucketSection title="Überfällig" icon={<Flame size={14} />} color="#EF4444" count={buckets.overdue.length}>
                    {buckets.overdue.map(t => <TaskRow key={t.id} task={t} highlight="overdue" {...rowProps} />)}
                </BucketSection>
            )}
            {buckets.today.length > 0 && (
                <BucketSection title="Heute" icon={<Star size={14} />} color="#F59E0B" count={buckets.today.length}>
                    {buckets.today.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
                </BucketSection>
            )}
            {buckets.thisWeek.length > 0 && (
                <BucketSection title="Diese Woche" icon={<Calendar size={14} />} color="#3B82F6" count={buckets.thisWeek.length}>
                    {buckets.thisWeek.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
                </BucketSection>
            )}
            {buckets.later.length > 0 && (
                <BucketSection title="Später / kein Datum" icon={<Inbox size={14} />} color="#6B7280" count={buckets.later.length}>
                    {buckets.later.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
                </BucketSection>
            )}
        </div>
    );
}

function BucketSection({ title, icon, color, count, children }: {
    title: string; icon: React.ReactNode; color: string; count: number; children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl overflow-hidden shadow-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <header className="flex items-center gap-2 px-4 py-2.5"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>
                    {icon}
                </div>
                <h2 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>{title}</h2>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${color}15`, color }}>{count}</span>
            </header>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {children}
            </div>
        </section>
    );
}

// ─── List view: flat sorted list ──────────────────────────
function ListView({ tasks, ...rowProps }: { tasks: UnifiedTask[] } & RowProps) {
    return (
        <section className="rounded-2xl overflow-hidden shadow-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {tasks.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
            </div>
        </section>
    );
}

// ─── Inline add bar (Todoist-style) ────────────────────────
function InlineAddBar({ title, setTitle, adding, onSubmit }: {
    title: string; setTitle: (s: string) => void; adding: boolean; onSubmit: () => void;
}) {
    return (
        <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
            style={{
                background: 'var(--bg-card)',
                border: `1px dashed ${title ? 'var(--accent)' : 'var(--border-default)'}`,
            }}
        >
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ border: '2px dashed var(--border-strong)', color: 'var(--text-muted)' }}>
                <Plus size={11} strokeWidth={3} />
            </div>
            <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') onSubmit();
                    if (e.key === 'Escape') setTitle('');
                }}
                placeholder="Neue private Aufgabe — tippen und Enter drücken…"
                disabled={adding}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-primary)' }}
            />
            {title && (
                <button
                    onClick={onSubmit}
                    disabled={adding}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                >
                    {adding ? '…' : 'Hinzufügen'}
                </button>
            )}
        </div>
    );
}

// ─── Single task row (used by both views) ─────────────────
function TaskRow({
    task, highlight, employees, onSelectProject, onTaskClick, onToggle, onAssignee,
    pendingIds, editingPersonalId, editingTitle, setEditingPersonalId, setEditingTitle, onUpdate,
}: { task: UnifiedTask; highlight?: 'overdue' } & RowProps) {
    const isDone = task.is_done || pendingIds.has(task.id);
    const isPersonal = !task._project;
    const isEditing = editingPersonalId === task.id;
    const overdue = task.deadline && new Date(task.deadline) < new Date();

    const isSubtask = !!task._parent;

    return (
        <div
            className="group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
            style={{
                background: 'transparent',
                paddingLeft: isSubtask ? '32px' : undefined,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => !isEditing && onTaskClick?.(task)}
        >
            {/* Subtask indent indicator */}
            {isSubtask && (
                <div className="shrink-0 mt-2" style={{ color: 'var(--text-placeholder)' }}>
                    <span className="text-[14px]">↳</span>
                </div>
            )}

            {/* Checkbox */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggle(task.id, isDone); }}
                className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                style={{
                    background: isDone ? 'var(--accent)' : 'transparent',
                    border: `2px solid ${isDone ? 'var(--accent)' : 'var(--border-strong)'}`,
                }}
            >
                {isDone && <Check size={11} style={{ color: 'var(--accent-text)' }} strokeWidth={3} />}
            </button>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <input
                        autoFocus
                        type="text"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onFocus={e => e.target.select()}
                        onBlur={async () => {
                            if (editingTitle.trim()) {
                                await supabase.from('todos').update({ title: editingTitle.trim() }).eq('id', task.id);
                                onUpdate();
                            }
                            setEditingPersonalId(null);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            if (e.key === 'Escape') setEditingPersonalId(null);
                        }}
                        className="w-full text-sm font-medium px-2 py-0.5 rounded outline-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }}
                    />
                ) : (
                    <p className="text-sm font-medium leading-snug"
                        style={{ color: isDone ? 'var(--text-placeholder)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}
                    >
                        {task.title}
                    </p>
                )}

                {/* Meta line */}
                <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {/* Parent task breadcrumb (for subtasks) */}
                    {task._parent && (
                        <>
                            <span className="font-medium italic truncate max-w-[180px]" title={task._parent.title}>
                                ↳ in „{task._parent.title}"
                            </span>
                            <span>·</span>
                        </>
                    )}
                    {/* Source: project or personal */}
                    {isPersonal ? (
                        <span className="font-bold uppercase tracking-widest">Privat</span>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); if (task._project) onSelectProject(task._project); }}
                            className="inline-flex items-center gap-1.5 hover:underline transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <ClientLogo src={task._project?.clients?.logo_url} name={task._project?.clients?.name || 'NA'} size={14} rounded="rounded" />

                            <span className="font-medium truncate max-w-[160px]">{task._project?.title}</span>
                        </button>
                    )}

                    {task.deadline && (
                        <>
                            <span>·</span>
                            <span style={{ color: overdue && !isDone ? '#EF4444' : 'var(--text-muted)', fontWeight: overdue && !isDone ? 600 : 500 }}>
                                {new Date(task.deadline).toLocaleDateString('de-DE')}
                            </span>
                        </>
                    )}

                    {/* Subtask-Count nur am Parent zeigen (zur Übersicht wie viele es insgesamt sind) */}
                    {!isSubtask && task._project && task._project.todos?.some(t => t.parent_id === task.id) && (
                        <>
                            <span>·</span>
                            <span>
                                {task._project.todos.filter(t => t.parent_id === task.id).length} Subtasks
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Assignee selector (only for project tasks in team view, or always for unassigned) */}
            {!isPersonal && (
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                        <select
                            className="appearance-none pl-7 pr-2 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-all w-28 truncate outline-none"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                            value={task.assigned_to || ''}
                            onChange={(e) => onAssignee(task.id, e.target.value)}
                        >
                            <option value="">Offen</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <User size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-placeholder)' }} />
                    </div>
                </div>
            )}

            {/* Inline edit trigger for private tasks (on hover) */}
            {isPersonal && !isEditing && (
                <button
                    onClick={(e) => { e.stopPropagation(); setEditingPersonalId(task.id); setEditingTitle(task.title); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-[10px] font-bold px-2 py-1 rounded transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                >
                    Umbenennen
                </button>
            )}
        </div>
    );
}
