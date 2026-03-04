'use client';
import React, { useRef, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { CalendarEvent, Employee, ParsedExternalEvent } from '../../../types';
import EventTooltip from '../EventTooltip';
import { computeOverlapLayout } from '../../../utils/overlapLayout';

// ─────────────────────────────────────────────
// Shared constants & helpers
// ─────────────────────────────────────────────
export const HOUR_HEIGHT = 64; // px per hour in week view

export const EVENT_COLORS: Record<string, string> = {
    blue: '#3B82F6', violet: '#7C3AED', rose: '#F43F5E',
    green: '#10B981', amber: '#F59E0B', cyan: '#06B6D4',
    slate: '#64748B', red: '#EF4444', orange: '#F97316',
};

export function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date) {
    const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}

export function getWeekDays(anchor: Date): Date[] {
    const d = new Date(anchor);
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

function resolveColor(color: string): string {
    return EVENT_COLORS[color] || color;
}

// ─────────────────────────────────────────────
// Live time indicator position (minutes → px)
// ─────────────────────────────────────────────
function useCurrentMinute(): number {
    const getNow = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
    const [mins, setMins] = useState(getNow);
    useEffect(() => {
        const tick = () => setMins(getNow());
        const id = setInterval(tick, 60_000);
        return () => clearInterval(id);
    }, []);
    return mins;
}

// ─────────────────────────────────────────────
// WeekView
// ─────────────────────────────────────────────
type AnyEvent = {
    id: string; title: string; start_at: string; end_at: string; all_day: boolean; color: string;
    employee_id?: string; calendarName?: string; location?: string | null; description?: string | null;
    attendees?: any[]; _type: 'own' | 'team' | 'ext';
};

interface WeekViewProps {
    days: Date[];
    currentUser: Employee;
    employees: Employee[];
    ownEvents: CalendarEvent[];
    teamEvents: CalendarEvent[];
    externalEvents: ParsedExternalEvent[];
    onSlotClick: (date: Date) => void;
    onEventClick: (event: CalendarEvent) => void;
}

export default function WeekView({ days, currentUser, employees, ownEvents, teamEvents, externalEvents, onSlotClick, onEventClick }: WeekViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const currentMins = useCurrentMinute();
    const today = new Date();

    // Auto-scroll to current time on mount
    useEffect(() => {
        if (scrollRef.current) {
            const now = new Date();
            const target = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT);
            scrollRef.current.scrollTop = target;
        }
    }, []);

    // Combine all events, tagged by type
    const allEvents: AnyEvent[] = [
        ...ownEvents.map(e => ({ ...e, _type: 'own' as const })),
        ...teamEvents.map(e => ({ ...e, _type: 'team' as const })),
        ...externalEvents.map(e => ({ ...e, employee_id: undefined, _type: 'ext' as const })),
    ];

    const eventsForDay = (day: Date, allDay: boolean) =>
        allEvents.filter(e => e.all_day === allDay && isSameDay(new Date(e.start_at), day));

    const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });

    const renderTimedEvent = (e: AnyEvent, col: number, totalCols: number) => {
        const start = new Date(e.start_at), end = new Date(e.end_at);
        const top = (start.getHours() * 60 + start.getMinutes()) / 60 * HOUR_HEIGHT;
        const durMin = Math.max(30, (end.getTime() - start.getTime()) / 60000);
        const height = Math.max(durMin / 60 * HOUR_HEIGHT - 2, 22);
        const hex = resolveColor(e.color);
        const isOwn = e._type === 'own';
        const isExt = e._type === 'ext';
        const widthPct = 100 / totalCols;
        const leftPct = col * widthPct;

        return (
            <EventTooltip
                key={e.id}
                event={e as any}
                employees={employees}
                isOwn={isOwn}
                isExternal={isExt}
                onEventClick={() => isOwn && onEventClick(e as any)}
            >
                <div
                    className="absolute overflow-hidden rounded-lg px-1.5 py-1 group transition-all duration-100"
                    style={{
                        top: top + 1,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        background: isOwn ? hex + 'DD' : hex + '33',
                        border: `1px solid ${hex}${isOwn ? 'BB' : '66'}`,
                        borderLeft: `3px solid ${hex}`,
                        borderStyle: isExt ? 'dashed' : undefined,
                        cursor: isOwn ? 'pointer' : 'default',
                        zIndex: 10,
                    }}
                    onMouseEnter={ev => { if (isOwn) (ev.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
                    onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.filter = ''; }}
                >
                    {/* Extern badge */}
                    {isExt && (
                        <ExternalLink size={8} className="absolute top-1 right-1 opacity-60" style={{ color: hex }} />
                    )}
                    <div className="text-[10px] font-bold truncate leading-tight" style={{ color: isOwn ? '#fff' : hex }}>
                        {e.title}
                    </div>
                    {height > 36 && (
                        <div className="text-[9px] truncate opacity-80" style={{ color: isOwn ? '#fff' : hex }}>
                            {formatTime(e.start_at)}–{formatTime(e.end_at)}
                        </div>
                    )}
                </div>
            </EventTooltip>
        );
    };

    const todayIdx = days.findIndex(d => isSameDay(d, today));
    const timeBarTop = (currentMins / 60) * HOUR_HEIGHT;
    const isWeekContainsToday = todayIdx >= 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Day headers ─────────────────────────────── */}
            <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div className="w-14 shrink-0" />
                {days.map((day, di) => {
                    const isToday = isSameDay(day, today);
                    const isWeekend = di >= 5;
                    const allDayEvs = eventsForDay(day, true);
                    return (
                        <div key={di} className="flex-1 min-w-0" style={{
                            borderLeft: '1px solid var(--border-subtle)',
                            background: isWeekend ? 'var(--bg-subtle)' : undefined,
                        }}>
                            <div className="flex flex-col items-center py-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: isToday ? 'var(--accent)' : isWeekend ? 'var(--text-muted)' : 'var(--text-muted)' }}>
                                    {day.toLocaleDateString('de-AT', { weekday: 'short' })}
                                </span>
                                <button
                                    onClick={() => { const d = new Date(day); d.setHours(9, 0, 0, 0); onSlotClick(d); }}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                                    style={isToday
                                        ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                                        : { color: isWeekend ? 'var(--text-muted)' : 'var(--text-primary)', background: 'transparent' }
                                    }
                                    title="Ganztägigen Termin erstellen"
                                >
                                    {day.getDate()}
                                </button>
                            </div>
                            {/* All-day events */}
                            <div className="px-1 pb-1 space-y-0.5" style={{ minHeight: 6 }}>
                                {allDayEvs.slice(0, 3).map(e => {
                                    const hex = resolveColor(e.color);
                                    const isOwn = e._type === 'own';
                                    const isExt = e._type === 'ext';
                                    return (
                                        <EventTooltip key={e.id} event={e as any} employees={employees} isOwn={isOwn} isExternal={isExt} onEventClick={() => isOwn && onEventClick(e as any)}>
                                            <div className="relative text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate cursor-pointer flex items-center gap-1"
                                                style={{ background: hex + '22', color: hex, border: `1px solid ${hex}44`, borderStyle: isExt ? 'dashed' : undefined }}>
                                                {isExt && <ExternalLink size={8} />}
                                                {e.title}
                                            </div>
                                        </EventTooltip>
                                    );
                                })}
                                {allDayEvs.length > 3 && (
                                    <div className="text-[9px] px-1" style={{ color: 'var(--text-muted)' }}>+{allDayEvs.length - 3} mehr</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Time grid ───────────────────────────────── */}
            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                <div className="flex relative" style={{ height: HOUR_HEIGHT * 24 }}>
                    {/* Time labels */}
                    <div className="w-14 shrink-0 relative select-none">
                        {HOURS.map(h => (
                            <div key={h} className="absolute w-full flex items-start justify-end pr-2" style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                                <span className="text-[10px] font-medium -translate-y-2" style={{ color: 'var(--text-muted)' }}>
                                    {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {days.map((day, di) => {
                        const isToday = isSameDay(day, today);
                        const isWeekend = di >= 5;
                        const timedEvs = eventsForDay(day, false);
                        const layoutMap = computeOverlapLayout(timedEvs.map(e => ({ id: e.id, start_at: e.start_at, end_at: e.end_at })));

                        return (
                            <div key={di} className="flex-1 min-w-0 relative"
                                style={{
                                    borderLeft: '1px solid var(--border-subtle)',
                                    background: isWeekend ? 'var(--bg-subtle)' : undefined,
                                }}>
                                {/* Hour slots */}
                                {HOURS.map(h => (
                                    <div key={h} className="absolute w-full"
                                        style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT, borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                        onClick={() => { const d = new Date(day); d.setHours(h, 0, 0, 0); onSlotClick(d); }}
                                        onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--accent-subtle)')}
                                        onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                                    />
                                ))}

                                {/* Events with overlap columns */}
                                {timedEvs.map(e => {
                                    const layout = layoutMap.get(e.id) ?? { col: 0, totalCols: 1 };
                                    return renderTimedEvent(e, layout.col, layout.totalCols);
                                })}

                                {/* Live time bar */}
                                {isToday && (
                                    <>
                                        {/* Red dot on left edge */}
                                        <div className="absolute left-0 z-20 w-2 h-2 rounded-full -translate-x-1 -translate-y-1"
                                            style={{ top: timeBarTop, background: '#EF4444', boxShadow: '0 0 0 2px white' }} />
                                        {/* Red line */}
                                        <div className="absolute left-0 right-0 z-20 pointer-events-none"
                                            style={{ top: timeBarTop, height: 1.5, background: '#EF4444', opacity: 0.8 }} />
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {/* Full-width red time line behind all columns (for the dot to connect to) */}
                    {isWeekContainsToday && (
                        <div className="absolute pointer-events-none z-20"
                            style={{
                                top: timeBarTop,
                                left: `calc(56px + ${todayIdx / 7 * 100}%)`,
                                width: `${100 / 7}%`,
                                height: 0,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
