'use client';
import React, { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Globe, Lock, Chrome, Monitor, Apple, Building2, Link, Check } from 'lucide-react';
import { Employee, ExternalCalendar, CalendarProviderType } from '../../types';
import { isSameDay } from './views/WeekView';
import UserAvatar from '../UI/UserAvatar';
import { supabase } from '../../supabaseClient';
import CalendarProviderModal from './CalendarProviderModal';

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

    const [myCalExpanded, setMyCalExpanded] = useState(true);
    const [showProviderModal, setShowProviderModal] = useState(false);

    const teammates = employees.filter(e => e.id !== currentUser.id);

    const handleDeleteExternal = async (id: string) => {
        if (!confirm('Kalender entfernen?')) return;
        await supabase.from('external_calendars').delete().eq('id', id);
        onRefreshExternals();
    };

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

                            {/* External calendars */}
                            {externalCalendars.map(cal => {
                                const visible = cal.is_visible;
                                return (
                                    <div key={cal.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg group transition-colors"
                                        style={{ background: visible ? cal.color + '16' : 'transparent' }}>
                                        <button onClick={() => onToggleExternal(cal.id)} className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: visible ? cal.color : 'var(--border-strong)' }} />
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
        </div>
    );
}
