'use client';
import React from 'react';
import { CalendarEvent, Employee, ParsedExternalEvent } from '../../../types';
import { EVENT_COLORS, HOURS, isSameDay } from './WeekView';

interface MonthViewProps {
    anchor: Date;
    currentUser: Employee;
    employees: Employee[];
    ownEvents: CalendarEvent[];
    teamEvents: CalendarEvent[];
    externalEvents: ParsedExternalEvent[];
    onDayClick: (date: Date) => void;
    onEventClick: (event: CalendarEvent) => void;
}

export default function MonthView({ anchor, currentUser, employees, ownEvents, teamEvents, externalEvents, onDayClick, onEventClick }: MonthViewProps) {
    const today = new Date();
    const year = anchor.getFullYear(), month = anchor.getMonth();

    // Build grid: 6 rows × 7 cols, starting Monday
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(year, month, 1 - startOffset + i);
        cells.push(d);
    }

    const allEvs = [
        ...ownEvents.map(e => ({ ...e, _own: true, _ext: false })),
        ...teamEvents.map(e => ({ ...e, _own: false, _ext: false })),
        ...externalEvents.map(e => ({ ...e, employee_id: undefined, _own: false, _ext: true })),
    ];

    const eventsForDay = (d: Date) => allEvs.filter(e => isSameDay(new Date(e.start_at), d));
    const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const getColor = (e: any) => EVENT_COLORS[e.color] || e.color;

    return (
        <div className="flex flex-col h-full">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
                {weekDays.map(d => (
                    <div key={d} className="text-center py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{d}</div>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
                {cells.map((day, i) => {
                    const isThisMonth = day.getMonth() === month;
                    const isToday = isSameDay(day, today);
                    const dayEvs = eventsForDay(day);

                    const isWeekend = i % 7 >= 5; // Columns 5 (Sa) and 6 (So)
                    return (
                        <div key={i}
                            className="flex flex-col p-1 cursor-pointer"
                            onClick={() => onDayClick(day)}
                            style={{
                                borderRight: i % 7 !== 6 ? '1px solid var(--border-subtle)' : undefined,
                                borderBottom: i < 35 ? '1px solid var(--border-subtle)' : undefined,
                                background: isToday ? 'var(--accent-subtle)' : isWeekend ? 'var(--bg-subtle)' : undefined,
                                minHeight: 0,
                            }}>
                            {/* Day number */}
                            <div className="flex justify-center mb-1">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold`}
                                    style={isToday
                                        ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                                        : { color: isThisMonth ? 'var(--text-primary)' : 'var(--text-muted)', opacity: isThisMonth ? 1 : 0.4 }
                                    }>
                                    {day.getDate()}
                                </div>
                            </div>

                            {/* Events pills */}
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                {dayEvs.slice(0, 3).map(e => {
                                    const col = getColor(e);
                                    const emp = e.employee_id ? employees.find(em => em.id === e.employee_id) : null;
                                    return (
                                        <button key={e.id}
                                            onClick={ev => { ev.stopPropagation(); if (e._own) onEventClick(e as any); }}
                                            className="w-full text-left px-1 py-0.5 rounded text-[10px] font-medium truncate leading-tight"
                                            style={{
                                                background: e._own ? col + 'CC' : col + '33',
                                                color: e._own ? '#fff' : col,
                                                borderLeft: `2px solid ${col}`,
                                                fontStyle: e._ext ? 'italic' : undefined,
                                            }}>
                                            {e.title}
                                        </button>
                                    );
                                })}
                                {dayEvs.length > 3 && (
                                    <div className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>+{dayEvs.length - 3} mehr</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
