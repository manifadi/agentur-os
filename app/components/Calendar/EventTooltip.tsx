'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Users, Clock, ExternalLink } from 'lucide-react';
import { Employee } from '../../types';
import UserAvatar from '../UI/UserAvatar';

interface TooltipEvent {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    all_day: boolean;
    color: string;
    location?: string | null;
    description?: string | null;
    attendees?: { name: string; email: string; employee_id?: string | null }[];
    calendarName?: string; // if external
    employee_id?: string;
}

interface Props {
    event: TooltipEvent;
    employees: Employee[];
    isOwn: boolean;
    isExternal?: boolean;
    children: React.ReactNode;
    onEventClick?: () => void;
}

function formatRange(start: string, end: string, allDay: boolean): string {
    if (allDay) {
        const s = new Date(start), e = new Date(end);
        if (s.toDateString() === e.toDateString()) return s.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
        return `${s.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })}`;
    }
    const s = new Date(start), e = new Date(end);
    const time = (d: Date) => d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    return `${s.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })}  ·  ${time(s)} – ${time(e)}`;
}

export default function EventTooltip({ event, employees, isOwn, isExternal, children, onEventClick }: Props) {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const show = useCallback((e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        timerRef.current = setTimeout(() => {
            // smart positioning
            const x = Math.min(rect.right + 8, window.innerWidth - 260);
            const y = Math.max(rect.top, 8);
            setPos({ x, y });
            setVisible(true);
        }, 380);
    }, []);

    const hide = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    }, []);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const colorHex = event.color.startsWith('#') ? event.color : ({
        blue: '#3B82F6', violet: '#7C3AED', rose: '#F43F5E', green: '#10B981',
        amber: '#F59E0B', cyan: '#06B6D4', slate: '#64748B', red: '#EF4444', orange: '#F97316',
    } as any)[event.color] || '#3B82F6';

    const ownerEmp = event.employee_id ? employees.find(e => e.id === event.employee_id) : null;

    const child = React.Children.only(children) as React.ReactElement;
    const clonedChild = React.cloneElement(child, {
        onMouseEnter: (e: React.MouseEvent) => {
            show(e);
            if (child.props.onMouseEnter) child.props.onMouseEnter(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
            hide();
            if (child.props.onMouseLeave) child.props.onMouseLeave(e);
        },
        onClick: (e: React.MouseEvent) => {
            if (onEventClick) onEventClick();
            if (child.props.onClick) child.props.onClick(e);
        }
    });

    return (
        <>
            {clonedChild}

            {visible && (
                <div
                    ref={tooltipRef}
                    className="fixed z-[999] w-56 rounded-2xl shadow-2xl overflow-hidden pointer-events-none"
                    style={{
                        left: pos.x,
                        top: pos.y,
                        background: 'var(--bg-card)',
                        border: `1px solid ${colorHex}44`,
                        boxShadow: `0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px ${colorHex}22`,
                    }}
                >
                    {/* Color bar */}
                    <div className="h-1 w-full" style={{ background: colorHex }} />

                    <div className="p-3 space-y-2">
                        {/* Title row */}
                        <div className="flex items-start gap-2">
                            <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: colorHex }} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
                                    {event.title}
                                </div>
                                {isExternal && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <ExternalLink size={9} style={{ color: colorHex }} />
                                        <span className="text-[9px]" style={{ color: colorHex }}>{event.calendarName}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-1.5">
                            <Clock size={10} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                                {formatRange(event.start_at, event.end_at, event.all_day)}
                            </span>
                        </div>

                        {/* Location */}
                        {event.location && (
                            <div className="flex items-center gap-1.5">
                                <MapPin size={10} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                                <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{event.location}</span>
                            </div>
                        )}

                        {/* Organizer (for team events) */}
                        {!isOwn && ownerEmp && (
                            <div className="flex items-center gap-1.5 pt-0.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <UserAvatar src={ownerEmp.avatar_url} name={ownerEmp.name} initials={ownerEmp.initials} size="xs" />
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ownerEmp.name}</span>
                            </div>
                        )}

                        {/* Attendees */}
                        {isOwn && event.attendees && event.attendees.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
                                <div className="flex items-center gap-1 mb-1.5">
                                    <Users size={9} style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{event.attendees.length} Teilnehmer</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {event.attendees.slice(0, 5).map((a, i) => {
                                        const emp = a.employee_id ? employees.find(e => e.id === a.employee_id) : null;
                                        return emp
                                            ? <UserAvatar key={i} src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                            : <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ background: colorHex }}>{a.name[0]}</div>;
                                    })}
                                    {event.attendees.length > 5 && (
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                                            +{event.attendees.length - 5}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {isOwn && (
                        <div className="px-3 pb-2.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Klicken zum Bearbeiten</div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
