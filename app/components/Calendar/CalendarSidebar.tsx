'use client';
import React, { useState, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Eye, EyeOff, ExternalLink, Trash2, X } from 'lucide-react';
import { Employee, ExternalCalendar } from '../../types';
import { isSameDay } from './views/WeekView';
import UserAvatar from '../UI/UserAvatar';
import { supabase } from '../../supabaseClient';

// Deterministic per-employee color based on id hash
const EMPLOYEE_COLORS = ['#3B82F6', '#7C3AED', '#F43F5E', '#10B981', '#F59E0B', '#06B6D4', '#64748B', '#EF4444', '#F97316', '#8B5CF6'];
export function getEmployeeColor(empId: string): string {
    let hash = 0;
    for (let i = 0; i < empId.length; i++) hash = (hash * 31 + empId.charCodeAt(i)) & 0xffffffff;
    return EMPLOYEE_COLORS[Math.abs(hash) % EMPLOYEE_COLORS.length];
}

// Mini calendar component
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
                            {/* Event dot */}
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
}

export default function CalendarSidebar({ currentUser, employees, organizationId, selectedDate, onSelectDate, visibleEmployeeIds, onToggleEmployee, externalCalendars, onToggleExternal, onRefreshExternals, ownEvents }: Props) {
    // Build set of ISO date keys with events for mini-calendar dots
    const eventDates = React.useMemo(() => {
        const s = new Set<string>();
        for (const e of ownEvents) {
            const d = new Date(e.start_at);
            s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        }
        return s;
    }, [ownEvents]);
    const [showAddExt, setShowAddExt] = useState(false);
    const [extName, setExtName] = useState('');
    const [extUrl, setExtUrl] = useState('');
    const [extColor, setExtColor] = useState('#06B6D4');
    const [saving, setSaving] = useState(false);

    const extColors = ['#3B82F6', '#7C3AED', '#F43F5E', '#10B981', '#F59E0B', '#06B6D4', '#64748B'];

    const handleAddExternal = async () => {
        if (!extName.trim() || !extUrl.trim()) return;
        setSaving(true);
        await supabase.from('external_calendars').insert({
            organization_id: organizationId,
            employee_id: currentUser.id,
            name: extName.trim(),
            url: extUrl.trim(),
            color: extColor,
            is_visible: true,
        });
        setSaving(false);
        setExtName(''); setExtUrl(''); setShowAddExt(false);
        onRefreshExternals();
    };

    const handleDeleteExternal = async (id: string) => {
        if (!confirm('Kalender entfernen?')) return;
        await supabase.from('external_calendars').delete().eq('id', id);
        onRefreshExternals();
    };

    const teammates = employees.filter(e => e.id !== currentUser.id);

    return (
        <div className="w-64 shrink-0 flex flex-col h-full overflow-y-auto scrollbar-none" style={{ borderRight: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
            {/* Mini Calendar */}
            <MiniCalendar anchor={selectedDate} selected={selectedDate} onSelect={onSelectDate} eventDates={eventDates} />

            <div className="flex-1 px-3 pb-4 space-y-5 mt-1">
                {/* Meine Kalender */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Meine Kalender</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-subtle)' }}>
                        <div className="w-3 h-3 rounded-sm" style={{ background: getEmployeeColor(currentUser.id) }} />
                        <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{currentUser.name}</span>
                        <div className="w-3 h-3 rounded-full" style={{ background: getEmployeeColor(currentUser.id) }} />
                    </div>
                </div>

                {/* Team Kalender */}
                {teammates.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Team</span>
                        </div>
                        <div className="space-y-1">
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
                                        <div className="w-3 h-3 rounded-sm transition-colors shrink-0" style={{ background: visible ? col : 'var(--border-strong)' }} />
                                        <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                        <span className="text-xs font-medium flex-1 text-left truncate" style={{ color: visible ? 'var(--text-primary)' : 'var(--text-muted)' }}>{emp.name}</span>
                                        {visible ? <Eye size={11} style={{ color: col }} /> : <EyeOff size={11} style={{ color: 'var(--text-muted)' }} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Externe Kalender */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Extern</span>
                        <button onClick={() => setShowAddExt(true)} className="p-0.5 rounded" style={{ color: 'var(--text-muted)' }} title="iCal importieren">
                            <Plus size={13} />
                        </button>
                    </div>

                    {externalCalendars.length === 0 && !showAddExt && (
                        <button onClick={() => setShowAddExt(true)} className="w-full text-left px-2 py-2 rounded-lg text-xs transition-colors" style={{ color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
                            + iCal-Kalender importieren
                        </button>
                    )}

                    <div className="space-y-1">
                        {externalCalendars.map(cal => {
                            const visible = cal.is_visible;
                            return (
                                <div key={cal.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg group" style={{ background: visible ? cal.color + '16' : 'transparent' }}>
                                    <button onClick={() => onToggleExternal(cal.id)} className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: visible ? cal.color : 'var(--border-strong)' }} />
                                        <span className="text-xs font-medium truncate text-left" style={{ color: visible ? 'var(--text-primary)' : 'var(--text-muted)' }}>{cal.name}</span>
                                    </button>
                                    <button onClick={() => handleDeleteExternal(cal.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded" style={{ color: 'var(--text-muted)' }}>
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add External Form */}
                    {showAddExt && (
                        <div className="mt-2 p-3 rounded-xl space-y-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>iCal importieren</span>
                                <button onClick={() => setShowAddExt(false)} style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
                            </div>
                            <input placeholder="Name (z.B. Google Kalender)" value={extName} onChange={e => setExtName(e.target.value)}
                                className="w-full p-2 rounded-lg text-xs outline-none"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            <input placeholder="iCal URL (webcal:// oder https://)" value={extUrl} onChange={e => setExtUrl(e.target.value)}
                                className="w-full p-2 rounded-lg text-xs outline-none"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            <div className="flex gap-1.5">
                                {extColors.map(c => (
                                    <button key={c} onClick={() => setExtColor(c)} className="w-5 h-5 rounded-full"
                                        style={{ background: c, outline: extColor === c ? `2px solid ${c}` : undefined, outlineOffset: 2 }} />
                                ))}
                            </div>
                            <button onClick={handleAddExternal} disabled={saving || !extName || !extUrl}
                                className="w-full py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                                style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                                {saving ? '...' : 'Importieren'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
