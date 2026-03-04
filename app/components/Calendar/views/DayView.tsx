'use client';
import React, { useRef, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { CalendarEvent, Employee, ParsedExternalEvent } from '../../../types';
import EventTooltip from '../EventTooltip';
import { computeOverlapLayout } from '../../../utils/overlapLayout';
import { EVENT_COLORS, HOURS, isSameDay, HOUR_HEIGHT as WEEK_HOUR_HEIGHT } from './WeekView';

const HOUR_HEIGHT = 80; // larger for day view

function resolveColor(color: string): string {
    return EVENT_COLORS[color] || color;
}

function useCurrentMinute(): number {
    const getNow = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
    const [mins, setMins] = useState(getNow);
    useEffect(() => {
        const id = setInterval(() => setMins(getNow()), 60_000);
        return () => clearInterval(id);
    }, []);
    return mins;
}

interface DayViewProps {
    day: Date;
    currentUser: Employee;
    employees: Employee[];
    ownEvents: CalendarEvent[];
    teamEvents: CalendarEvent[];
    externalEvents: ParsedExternalEvent[];
    onSlotClick: (date: Date) => void;
    onEventClick: (event: CalendarEvent) => void;
}

export default function DayView({ day, currentUser, employees, ownEvents, teamEvents, externalEvents, onSlotClick, onEventClick }: DayViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const currentMins = useCurrentMinute();
    const today = new Date();
    const isToday = isSameDay(day, today);

    // Auto-scroll to current time
    useEffect(() => {
        if (scrollRef.current) {
            const now = new Date();
            const target = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT);
            scrollRef.current.scrollTop = target;
        }
    }, []);

    type AnyEvent = {
        id: string; title: string; start_at: string; end_at: string; all_day: boolean; color: string;
        employee_id?: string; calendarName?: string; location?: string | null; description?: string | null;
        attendees?: any[]; _type: 'own' | 'team' | 'ext';
    };

    const allEvs: AnyEvent[] = [
        ...ownEvents.map(e => ({ ...e, _type: 'own' as const })),
        ...teamEvents.map(e => ({ ...e, _type: 'team' as const })),
        ...externalEvents.map(e => ({ ...e, employee_id: undefined, _type: 'ext' as const })),
    ].filter(e => isSameDay(new Date(e.start_at), day));

    const allDayEvs = allEvs.filter(e => e.all_day);
    const timedEvs = allEvs.filter(e => !e.all_day);

    const layoutMap = computeOverlapLayout(timedEvs.map(e => ({ id: e.id, start_at: e.start_at, end_at: e.end_at })));

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    const timeBarTop = (currentMins / 60) * HOUR_HEIGHT;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-5 py-3 flex items-center gap-4 flex-wrap" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isToday ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {day.toLocaleDateString('de-AT', { weekday: 'long' })}
                    </span>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold"
                        style={isToday ? { background: 'var(--accent)', color: 'var(--accent-text)' } : { color: 'var(--text-primary)' }}>
                        {day.getDate()}
                    </div>
                </div>

                {/* All-day events */}
                {allDayEvs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 flex-1">
                        {allDayEvs.map(e => {
                            const hex = resolveColor(e.color);
                            const isOwn = e._type === 'own';
                            const isExt = e._type === 'ext';
                            return (
                                <EventTooltip key={e.id} event={e as any} employees={employees} isOwn={isOwn} isExternal={isExt} onEventClick={() => isOwn && onEventClick(e as any)}>
                                    <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg cursor-pointer"
                                        style={{ background: hex + '22', color: hex, border: `1px solid ${hex}44`, borderStyle: isExt ? 'dashed' : undefined }}>
                                        {isExt && <ExternalLink size={10} />}
                                        {e.title}
                                    </div>
                                </EventTooltip>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                <div className="flex relative" style={{ height: HOUR_HEIGHT * 24 }}>
                    {/* Time labels */}
                    <div className="w-16 shrink-0 relative select-none">
                        {HOURS.map(h => (
                            <div key={h} className="absolute w-full flex items-start justify-end pr-3" style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                                <span className="text-[11px] font-medium -translate-y-2" style={{ color: 'var(--text-muted)' }}>
                                    {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Main column */}
                    <div className="flex-1 relative" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
                        {/* Hour slots */}
                        {HOURS.map(h => (
                            <div key={h} className="absolute w-full"
                                style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT, borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                onClick={() => { const d = new Date(day); d.setHours(h, 0, 0, 0); onSlotClick(d); }}
                                onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--accent-subtle)')}
                                onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                            />
                        ))}

                        {/* Timed events with overlap layout */}
                        {timedEvs.map(e => {
                            const { col, totalCols } = layoutMap.get(e.id) ?? { col: 0, totalCols: 1 };
                            const start = new Date(e.start_at), end = new Date(e.end_at);
                            const top = (start.getHours() * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT;
                            const durMin = Math.max(30, (end.getTime() - start.getTime()) / 60000);
                            const height = Math.max(durMin / 60 * HOUR_HEIGHT - 2, 28);
                            const hex = resolveColor(e.color);
                            const isOwn = e._type === 'own';
                            const isExt = e._type === 'ext';
                            const widthPct = 100 / totalCols;
                            const leftPct = col * widthPct;
                            const emp = e.employee_id ? employees.find(em => em.id === e.employee_id) : null;

                            return (
                                <EventTooltip key={e.id} event={e as any} employees={employees} isOwn={isOwn} isExternal={isExt} onEventClick={() => isOwn && onEventClick(e as any)}>
                                    <div className="absolute rounded-xl px-3 py-2 overflow-hidden group transition-all"
                                        style={{
                                            top: top + 1,
                                            height,
                                            left: `calc(${leftPct}% + 4px)`,
                                            width: `calc(${widthPct}% - 8px)`,
                                            background: isOwn ? hex + 'EE' : hex + '33',
                                            border: `1px solid ${hex}${isOwn ? 'AA' : '55'}`,
                                            borderLeft: `4px solid ${hex}`,
                                            borderStyle: isExt ? 'dashed' : undefined,
                                            cursor: isOwn ? 'pointer' : 'default',
                                            zIndex: 10,
                                        }}
                                        onMouseEnter={ev => { if (isOwn) (ev.currentTarget as HTMLElement).style.filter = 'brightness(1.06)'; }}
                                        onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.filter = ''; }}
                                    >
                                        {isExt && <ExternalLink size={10} className="absolute top-2 right-2 opacity-60" style={{ color: hex }} />}
                                        <div className="text-sm font-bold truncate leading-tight" style={{ color: isOwn ? '#fff' : hex }}>
                                            {e.title}
                                        </div>
                                        {height > 40 && (
                                            <div className="text-xs opacity-80 mt-0.5" style={{ color: isOwn ? '#fff' : hex }}>
                                                {formatTime(e.start_at)} – {formatTime(e.end_at)}
                                                {!isOwn && emp && ` · ${emp.name}`}
                                                {isExt && ` · ${(e as any).calendarName}`}
                                            </div>
                                        )}
                                        {(e as any).location && height > 60 && (
                                            <div className="text-xs mt-1 opacity-70 truncate" style={{ color: isOwn ? '#fff' : hex }}>
                                                📍 {(e as any).location}
                                            </div>
                                        )}
                                    </div>
                                </EventTooltip>
                            );
                        })}

                        {/* Live time bar */}
                        {isToday && (
                            <>
                                <div className="absolute left-0 z-20 w-2.5 h-2.5 rounded-full -translate-x-1.5 -translate-y-1.5 pointer-events-none"
                                    style={{ top: timeBarTop, background: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.25)' }} />
                                <div className="absolute left-0 right-0 z-20 pointer-events-none"
                                    style={{ top: timeBarTop, height: 2, background: 'linear-gradient(to right, #EF4444, #EF444455)' }} />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
