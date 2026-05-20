'use client';
import React, { useEffect } from 'react';
import { X, MapPin, Clock, ExternalLink, Video, EyeOff, FileText, Users, Calendar as CalIcon } from 'lucide-react';
import { Employee } from '../../types';
import UserAvatar from '../UI/UserAvatar';
import { detectMeetingUrl, providerLabel, providerColor } from '../../utils/meetingUrl';

interface DetailEvent {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
    all_day: boolean;
    color: string;
    location?: string | null;
    description?: string | null;
    meeting_url?: string | null;
    attendees?: { name: string; email: string; employee_id?: string | null }[];
    calendarName?: string;
    employee_id?: string;
    uid?: string;
    externalCalendarId?: string;
}

interface Props {
    event: DetailEvent;
    employees: Employee[];
    isExternal?: boolean;
    onClose: () => void;
    onHideExternal?: (uid: string, externalCalendarId: string) => void;
}

function formatRange(start: string, end: string, allDay: boolean): string {
    const s = new Date(start), e = new Date(end);
    if (allDay) {
        if (s.toDateString() === e.toDateString()) return s.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return `${s.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    const time = (d: Date) => d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    const sameDay = s.toDateString() === e.toDateString();
    if (sameDay) {
        return `${s.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${time(s)} – ${time(e)}`;
    }
    return `${s.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })} ${time(s)} – ${e.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' })} ${time(e)}`;
}

export default function EventDetailModal({ event, employees, isExternal, onClose, onHideExternal }: Props) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const colorHex = event.color.startsWith('#') ? event.color : ({
        blue: '#3B82F6', violet: '#7C3AED', rose: '#F43F5E', green: '#10B981',
        amber: '#F59E0B', cyan: '#06B6D4', slate: '#64748B', red: '#EF4444', orange: '#F97316',
    } as any)[event.color] || '#3B82F6';

    // Auto-detect meeting URL if not explicit
    const explicitUrl = event.meeting_url || undefined;
    const detected = explicitUrl ? null : detectMeetingUrl(event.description, event.location);
    const meetingUrl = explicitUrl || detected?.url;
    const provider = detected?.provider || null;
    const meetingLabel = provider ? providerLabel(provider) : 'Meeting';
    const meetingBg = provider ? providerColor(provider) : '#5059C9';

    const ownerEmp = event.employee_id ? employees.find(e => e.id === event.employee_id) : null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', maxHeight: '85vh' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="h-1 w-full shrink-0" style={{ background: colorHex }} />

                {/* Header */}
                <div className="flex items-start justify-between p-5 pb-3 gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colorHex }} />
                            {isExternal && event.calendarName && (
                                <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: colorHex }}>
                                    <ExternalLink size={9} className="inline mr-1" />{event.calendarName}
                                </span>
                            )}
                        </div>
                        <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{event.title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: 'var(--text-muted)' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
                    {/* Time */}
                    <div className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0 mt-0.5" />
                        <span>{formatRange(event.start_at, event.end_at, event.all_day)}</span>
                    </div>

                    {/* Meeting link */}
                    {meetingUrl && (
                        <a href={meetingUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-90"
                            style={{ background: meetingBg, color: '#fff' }}
                        >
                            <Video size={14} />
                            <span className="flex-1">{meetingLabel} beitreten</span>
                            <ExternalLink size={11} />
                        </a>
                    )}

                    {/* Location */}
                    {event.location && (
                        <div className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <MapPin size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0 mt-0.5" />
                            <span className="break-words">{event.location}</span>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div className="flex items-start gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <FileText size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0 whitespace-pre-wrap break-words leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                {renderDescriptionWithLinks(event.description)}
                            </div>
                        </div>
                    )}

                    {/* Organizer (team events) */}
                    {!isExternal && ownerEmp && (
                        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <UserAvatar src={ownerEmp.avatar_url} name={ownerEmp.name} initials={ownerEmp.initials} size="xs" />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ownerEmp.name}</span>
                        </div>
                    )}

                    {/* Attendees */}
                    {event.attendees && event.attendees.length > 0 && (
                        <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Users size={12} style={{ color: 'var(--text-muted)' }} />
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                    {event.attendees.length} Teilnehmer
                                </span>
                            </div>
                            <div className="space-y-1.5">
                                {event.attendees.map((a, i) => {
                                    const emp = a.employee_id ? employees.find(e => e.id === a.employee_id) : null;
                                    return (
                                        <div key={i} className="flex items-center gap-2">
                                            {emp
                                                ? <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                                : <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: colorHex }}>{a.name[0]}</div>
                                            }
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</div>
                                                {a.email && <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{a.email}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {isExternal && onHideExternal && event.uid && event.externalCalendarId && (
                    <div className="flex justify-end p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => { onHideExternal(event.uid!, event.externalCalendarId!); onClose(); }}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                            <EyeOff size={12} />
                            Ausblenden
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Description mit URLs als klickbare Links rendern.
function renderDescriptionWithLinks(text: string): React.ReactNode[] {
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = urlRegex.exec(text)) !== null) {
        if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
        parts.push(
            <a key={key++} href={m[0]} target="_blank" rel="noopener noreferrer"
                className="underline break-all"
                style={{ color: 'var(--accent)' }}
            >{m[0]}</a>
        );
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
}
