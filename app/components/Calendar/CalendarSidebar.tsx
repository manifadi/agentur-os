'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Globe, Lock, Chrome, Monitor, Apple, Building2, Link, Check, Palette } from 'lucide-react';
import { Employee, ExternalCalendar, CalendarProviderType } from '../../types';
import { isSameDay } from './views/WeekView';
import UserAvatar from '../UI/UserAvatar';
import { supabase } from '../../supabaseClient';
import CalendarProviderModal from './CalendarProviderModal';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const CAL_COLOR_PALETTE = [
    '#3B82F6', '#7C3AED', '#F43F5E', '#10B981', '#F59E0B', '#06B6D4', '#64748B',
    '#EF4444', '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#84CC16', '#0078D4',
];

interface ColorPickerPopoverProps {
    current: string;
    onPick: (color: string) => void;
    onClose: () => void;
    anchorRect: DOMRect;
}

function ColorPickerPopover({ current, onPick, onClose, anchorRect }: ColorPickerPopoverProps) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
    }, [onClose]);

    const x = Math.min(anchorRect.left, window.innerWidth - 200);
    const y = anchorRect.bottom + 4;

    return (
        <div ref={ref}
            className="fixed z-[400] p-2.5 rounded-xl shadow-2xl grid grid-cols-7 gap-1.5"
            style={{ left: x, top: y, background: 'var(--bg-card)', border: '1px solid var(--border-default)', width: 188 }}
        >
            {CAL_COLOR_PALETTE.map(c => (
                <button key={c} onClick={() => { onPick(c); onClose(); }}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                    style={{ background: c, outline: c === current ? `2.5px solid ${c}` : 'none', outlineOffset: 2 }}
                    title={c}
                />
            ))}
        </div>
    );
}

function providerGroupLabel(type: CalendarProviderType): string {
    switch (type) {
        case 'google': return 'Google';
        case 'outlook':
        case 'teams': return 'Outlook';
        case 'apple': return 'Apple iCloud';
        case 'troi': return 'Troi';
        default: return 'Kalender';
    }
}

interface CalendarGroup {
    key: string;
    providerType: CalendarProviderType;
    accountLabel: string | null;
    calendars: ExternalCalendar[];
}

function groupExternalCalendars(calendars: ExternalCalendar[]): CalendarGroup[] {
    const map = new Map<string, CalendarGroup>();
    for (const cal of calendars) {
        const provider = cal.provider_type || 'ical';
        // Group by provider+account_label. Calendars without account_label stand alone.
        const label = cal.account_label || cal.caldav_username || null;
        const key = label ? `${provider}::${label}` : `single::${cal.id}`;
        if (!map.has(key)) {
            map.set(key, { key, providerType: provider, accountLabel: label, calendars: [] });
        }
        map.get(key)!.calendars.push(cal);
    }
    return Array.from(map.values());
}

const EMPLOYEE_COLORS = ['#3B82F6', '#7C3AED', '#F43F5E', '#10B981', '#F59E0B', '#06B6D4', '#64748B', '#EF4444', '#F97316', '#8B5CF6'];
export function getEmployeeColor(empId: string): string {
    let hash = 0;
    for (let i = 0; i < empId.length; i++) hash = (hash * 31 + empId.charCodeAt(i)) & 0xffffffff;
    return EMPLOYEE_COLORS[Math.abs(hash) % EMPLOYEE_COLORS.length];
}

function providerIcon(type: CalendarProviderType, size = 11) {
    switch (type) {
        case 'google': return <Chrome size={size} style={{ color: '#3B82F6' }} />;
        case 'outlook':
        case 'teams': return <Monitor size={size} style={{ color: '#0078D4' }} />;
        case 'apple': return <Apple size={size} style={{ color: '#64748B' }} />;
        case 'troi': return <Building2 size={size} style={{ color: '#7C3AED' }} />;
        default: return <Link size={size} style={{ color: '#06B6D4' }} />;
    }
}

function MiniCalendar({ anchor, onSelect, selected, eventDates }: { anchor: Date; onSelect: (d: Date) => void; selected: Date; eventDates: Set<string> }) {
    const [view, setView] = useState(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const year = view.getFullYear(), month = view.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(new Date(year, month, 1 - startOffset + i));
    const today = new Date();

    const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const prev = () => setView(new Date(year, month - 1, 1));
    const next = () => setView(new Date(year, month + 1, 1));

    return (
        <div className="p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {view.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex gap-1">
                    <button onClick={prev} className="p-0.5 rounded" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={14} /></button>
                    <button onClick={next} className="p-0.5 rounded" style={{ color: 'var(--text-muted)' }}><ChevronRight size={14} /></button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-0">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                    <div key={d} className="text-center text-[9px] font-bold py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
                ))}
                {cells.map((d, i) => {
                    const inMonth = d.getMonth() === month;
                    const isToday = isSameDay(d, today);
                    const isSel = isSameDay(d, selected);
                    const hasEvents = eventDates.has(toKey(d));
                    return (
                        <div key={i} className="flex flex-col items-center justify-center p-0.5" style={{ aspectRatio: '1/1' }}>
                            <button onClick={() => { setView(new Date(d.getFullYear(), d.getMonth(), 1)); onSelect(d); }}
                                className="w-6 h-6 flex items-center justify-center text-[10px] font-medium rounded-full transition-colors"
                                style={{
                                    color: isSel ? 'var(--accent-text)' : !inMonth ? 'var(--text-muted)' : isToday ? 'var(--accent)' : 'var(--text-primary)',
                                    background: isSel ? 'var(--accent)' : isToday && !isSel ? 'var(--accent-subtle)' : undefined,
                                    opacity: inMonth ? 1 : 0.35,
                                    fontWeight: isToday ? 700 : undefined,
                                }}>
                                {d.getDate()}
                            </button>
                            <div className="h-1 mt-0.5">
                                {hasEvents && inMonth && !isSel && (
                                    <div className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)', opacity: 0.7 }} />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface Props {
    currentUser: Employee;
    employees: Employee[];
    organizationId: string;
    selectedDate: Date;
    onSelectDate: (d: Date) => void;
    visibleEmployeeIds: string[];
    onToggleEmployee: (id: string) => void;
    externalCalendars: ExternalCalendar[];
    onToggleExternal: (id: string) => void;
    onRefreshExternals: () => void;
    ownEvents: { start_at: string }[];
    showOwnEvents: boolean;
    onToggleOwnEvents: () => void;
}

export default function CalendarSidebar({
    currentUser, employees, organizationId, selectedDate, onSelectDate,
    visibleEmployeeIds, onToggleEmployee, externalCalendars, onToggleExternal,
    onRefreshExternals, ownEvents, showOwnEvents, onToggleOwnEvents,
}: Props) {
    const eventDates = React.useMemo(() => {
        const s = new Set<string>();
        for (const e of ownEvents) {
            const d = new Date(e.start_at);
            s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        return s;
    }, [ownEvents]);

    const [myCalExpanded, setMyCalExpanded] = useLocalStorage<boolean>('cal-sidebar:myCalExpanded', true);
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [collapsedKeys, setCollapsedKeys] = useLocalStorage<string[]>('cal-sidebar:collapsedGroups', []);
    const collapsedGroups = React.useMemo(() => new Set(collapsedKeys), [collapsedKeys]);
    const [colorPicker, setColorPicker] = useState<{ calId: string; current: string; rect: DOMRect } | null>(null);

    const teammates = employees.filter(e => e.id !== currentUser.id);

    const handleDeleteExternal = async (id: string) => {
        if (!confirm('Kalender entfernen?')) return;
        await supabase.from('external_calendars').delete().eq('id', id);
        onRefreshExternals();
    };

    const handleDeleteAccount = async (group: CalendarGroup) => {
        const accountName = group.accountLabel || group.calendars[0]?.name || 'diesen Account';
        if (!confirm(`Alle ${group.calendars.length} Kalender von ${accountName} entfernen?`)) return;
        const ids = group.calendars.map(c => c.id);
        await supabase.from('external_calendars').delete().in('id', ids);
        onRefreshExternals();
    };

    const handleToggleGroup = async (group: CalendarGroup) => {
        // If any are visible → hide all. Else show all.
        const anyVisible = group.calendars.some(c => c.is_visible);
        const ids = group.calendars.map(c => c.id);
        await supabase.from('external_calendars').update({ is_visible: !anyVisible }).in('id', ids);
        onRefreshExternals();
    };

    const toggleGroupCollapse = (key: string) => {
        setCollapsedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const handleColorPick = async (calId: string, color: string) => {
        // Realtime sync updated row → kein Refresh nötig
        await supabase.from('external_calendars').update({ color }).eq('id', calId);
    };

    const openColorPicker = (e: React.MouseEvent, cal: ExternalCalendar) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setColorPicker({ calId: cal.id, current: cal.color, rect });
    };

    const groups = groupExternalCalendars(externalCalendars);

    const myColor = getEmployeeColor(currentUser.id);

    return (
        <div className="w-64 shrink-0 flex flex-col h-full overflow-y-auto scrollbar-none" style={{ borderRight: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
            <MiniCalendar anchor={selectedDate} selected={selectedDate} onSelect={onSelectDate} eventDates={eventDates} />

            <div className="flex-1 px-3 pb-4 space-y-5 mt-1">
                {/* Meine Kalender */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <button onClick={() => setMyCalExpanded(x => !x)} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                            {myCalExpanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                            Meine Kalender
                        </button>
                        <button
                            onClick={() => setShowProviderModal(true)}
                            className="p-0.5 rounded"
                            style={{ color: 'var(--text-muted)' }}
                            title="Kalender hinzufügen"
                        >
                            <Plus size={13} />
                        </button>
                    </div>

                    {myCalExpanded && (
                        <div className="space-y-0.5">
                            {/* Intern (own events from DB) */}
                            <button
                                onClick={onToggleOwnEvents}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
                                style={{ background: showOwnEvents ? myColor + '16' : 'transparent' }}
                                onMouseEnter={e => !showOwnEvents && (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                onMouseLeave={e => !showOwnEvents && (e.currentTarget.style.background = 'transparent')}
                            >
                                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: showOwnEvents ? myColor : 'var(--border-strong)' }} />
                                <span className="text-xs font-medium flex-1 text-left truncate" style={{ color: showOwnEvents ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {currentUser.name}
                                </span>
                                {showOwnEvents
                                    ? <Eye size={11} style={{ color: myColor }} />
                                    : <EyeOff size={11} style={{ color: 'var(--text-muted)' }} />
                                }
                            </button>

                            {/* External calendar groups */}
                            {groups.map(group => {
                                // Single standalone calendar → render directly without group header
                                if (group.key.startsWith('single::') || group.calendars.length === 1 && !group.accountLabel) {
                                    const cal = group.calendars[0];
                                    const visible = cal.is_visible;
                                    return (
                                        <div key={cal.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg group transition-colors"
                                            style={{ background: visible ? cal.color + '16' : 'transparent' }}>
                                            <button onClick={(e) => openColorPicker(e, cal)} className="w-3 h-3 rounded-sm shrink-0 transition-transform hover:scale-125" style={{ background: visible ? cal.color : 'var(--border-strong)' }} title="Farbe ändern" />
                                            <button onClick={() => onToggleExternal(cal.id)} className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="shrink-0">{providerIcon(cal.provider_type || 'ical')}</span>
                                                <span className="text-xs font-medium truncate text-left" style={{ color: visible ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                    {cal.name}
                                                </span>
                                            </button>
                                            {cal.is_writable && <span title="Bidirektional synchronisiert"><Check size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /></span>}
                                            <button onClick={() => handleDeleteExternal(cal.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded" style={{ color: 'var(--text-muted)' }}>
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    );
                                }

                                // Multi-calendar account → collapsible group header
                                const collapsed = collapsedGroups.has(group.key);
                                const visibleCount = group.calendars.filter(c => c.is_visible).length;
                                const allVisible = visibleCount === group.calendars.length;
                                const groupLabel = providerGroupLabel(group.providerType);

                                return (
                                    <div key={group.key} className="space-y-0.5">
                                        {/* Group header */}
                                        <div className="flex items-center gap-1 px-1 py-1 rounded-lg group/header">
                                            <button onClick={() => toggleGroupCollapse(group.key)} className="p-0.5 rounded transition-transform" style={{ color: 'var(--text-muted)' }}>
                                                {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                            <button onClick={() => handleToggleGroup(group)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                                                <span className="shrink-0">{providerIcon(group.providerType, 12)}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[11px] font-bold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{groupLabel}</div>
                                                    {group.accountLabel && (
                                                        <div className="text-[9px] font-medium truncate leading-tight" style={{ color: 'var(--text-muted)' }}>{group.accountLabel}</div>
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                                                    {visibleCount}/{group.calendars.length}
                                                </span>
                                            </button>
                                            <button onClick={() => handleDeleteAccount(group)} className="opacity-0 group-hover/header:opacity-100 transition-opacity p-0.5 rounded" style={{ color: 'var(--text-muted)' }} title="Account und alle Kalender entfernen">
                                                <Trash2 size={11} />
                                            </button>
                                        </div>

                                        {/* Group children */}
                                        {!collapsed && (
                                            <div className="pl-4 space-y-0.5">
                                                {group.calendars.map(cal => {
                                                    const visible = cal.is_visible;
                                                    return (
                                                        <div key={cal.id} className="flex items-center gap-2 px-2 py-1 rounded-lg group transition-colors"
                                                            style={{ background: visible ? cal.color + '16' : 'transparent' }}>
                                                            <button onClick={(e) => openColorPicker(e, cal)} className="w-3 h-3 rounded-sm shrink-0 transition-transform hover:scale-125" style={{ background: visible ? cal.color : 'var(--border-strong)' }} title="Farbe ändern" />
                                                            <button onClick={() => onToggleExternal(cal.id)} className="flex items-center gap-2 flex-1 min-w-0">
                                                                <span className="text-xs font-medium truncate text-left" style={{ color: visible ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                                    {cal.name}
                                                                </span>
                                                            </button>
                                                            {cal.is_writable && <span title="Bidirektional synchronisiert"><Check size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /></span>}
                                                            {visible
                                                                ? <Eye size={10} style={{ color: cal.color, flexShrink: 0 }} />
                                                                : <EyeOff size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                            }
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {externalCalendars.length === 0 && (
                                <button onClick={() => setShowProviderModal(true)} className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
                                    + Kalender hinzufügen
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Team */}
                {teammates.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Team</span>
                        </div>
                        <div className="space-y-0.5">
                            {teammates.map(emp => {
                                const visible = visibleEmployeeIds.includes(emp.id);
                                const col = getEmployeeColor(emp.id);
                                return (
                                    <button key={emp.id} onClick={() => onToggleEmployee(emp.id)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
                                        style={{ background: visible ? col + '16' : 'transparent' }}
                                        onMouseEnter={e => !visible && (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                        onMouseLeave={e => !visible && (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: visible ? col : 'var(--border-strong)' }} />
                                        <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                        <span className="text-xs font-medium flex-1 text-left truncate" style={{ color: visible ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {emp.name}
                                        </span>
                                        <span className="text-[9px] shrink-0" style={{ color: 'var(--text-muted)' }} title="Zeigt nur öffentliche Termine">
                                            <Globe size={9} />
                                        </span>
                                        {visible ? <Eye size={11} style={{ color: col }} /> : <EyeOff size={11} style={{ color: 'var(--text-muted)' }} />}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[9px] mt-2 px-2" style={{ color: 'var(--text-muted)' }}>
                            Nur öffentliche Termine sichtbar
                        </p>
                    </div>
                )}
            </div>

            {showProviderModal && (
                <CalendarProviderModal
                    currentUser={currentUser}
                    organizationId={organizationId}
                    onClose={() => setShowProviderModal(false)}
                    onAdded={() => { onRefreshExternals(); setShowProviderModal(false); }}
                />
            )}

            {colorPicker && (
                <ColorPickerPopover
                    current={colorPicker.current}
                    anchorRect={colorPicker.rect}
                    onPick={(c) => handleColorPick(colorPicker.calId, c)}
                    onClose={() => setColorPicker(null)}
                />
            )}
        </div>
    );
}
