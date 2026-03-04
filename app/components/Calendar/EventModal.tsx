'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, FileText, Clock, Users, Palette, Trash2, Plus } from 'lucide-react';
import { CalendarEvent, CalendarAttendee, EventColor, Employee } from '../../types';
import { supabase } from '../../supabaseClient';
import UserAvatar from '../UI/UserAvatar';

const COLORS: { id: EventColor; label: string; hex: string }[] = [
    { id: 'blue', label: 'Blau', hex: '#3B82F6' },
    { id: 'violet', label: 'Violett', hex: '#7C3AED' },
    { id: 'rose', label: 'Rose', hex: '#F43F5E' },
    { id: 'green', label: 'Grün', hex: '#10B981' },
    { id: 'amber', label: 'Amber', hex: '#F59E0B' },
    { id: 'cyan', label: 'Cyan', hex: '#06B6D4' },
    { id: 'slate', label: 'Slate', hex: '#64748B' },
    { id: 'red', label: 'Rot', hex: '#EF4444' },
    { id: 'orange', label: 'Orange', hex: '#F97316' },
];

const COLOR_HEX: Record<EventColor, string> = Object.fromEntries(COLORS.map(c => [c.id, c.hex])) as any;

const TIME_OPTIONS = Array.from({ length: 96 }).map((_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

function toLocalDateString(iso: string) {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
}

interface Props {
    event?: CalendarEvent | null;
    defaultStart?: Date;
    defaultEnd?: Date;
    defaultAllDay?: boolean;
    currentUser: Employee;
    employees: Employee[];
    organizationId: string;
    onClose: () => void;
    onSaved: () => void;
    onDeleted?: () => void;
}

export default function EventModal({ event, defaultStart, defaultEnd, defaultAllDay, currentUser, employees, organizationId, onClose, onSaved, onDeleted }: Props) {
    const isEdit = !!event;

    const defaultStartStr = (defaultStart || new Date()).toISOString();
    const defaultEndDate = defaultEnd || new Date((defaultStart || new Date()).getTime() + 60 * 60 * 1000);

    const [title, setTitle] = useState(event?.title || '');
    const [description, setDesc] = useState(event?.description || '');
    const [location, setLocation] = useState(event?.location || '');
    const [color, setColor] = useState<EventColor>(event?.color || 'blue');
    const [allDay, setAllDay] = useState(event?.all_day ?? defaultAllDay ?? false);
    const dStart = new Date(event?.start_at || defaultStartStr);
    const dEnd = new Date(event?.end_at || defaultEndDate.toISOString());
    const formatTimeStr = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0')}`;

    const [startDateStr, setStartDate] = useState(toLocalDateString(dStart.toISOString()));
    const [endDateStr, setEndDate] = useState(toLocalDateString(dEnd.toISOString()));
    const [startTimeStr, setStartTime] = useState(formatTimeStr(dStart));
    const [endTimeStr, setEndTime] = useState(formatTimeStr(dEnd));
    const [attendees, setAttendees] = useState<CalendarAttendee[]>(event?.attendees || []);
    const [loading, setSaving] = useState(false);

    // Initial state reflection to detect dirty form
    const [initialState] = useState({
        title: title, desc: description, loc: location, col: color, ad: allDay,
        sd: toLocalDateString(dStart.toISOString()), ed: toLocalDateString(dEnd.toISOString()),
        st: formatTimeStr(dStart), et: formatTimeStr(dEnd), att: JSON.stringify(event?.attendees || [])
    });

    const isDirty = title !== initialState.title || description !== initialState.desc || location !== initialState.loc ||
        color !== initialState.col || allDay !== initialState.ad || startDateStr !== initialState.sd ||
        endDateStr !== initialState.ed || startTimeStr !== initialState.st || endTimeStr !== initialState.et ||
        JSON.stringify(attendees) !== initialState.att;

    // Sub-modals
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleCloseIntent();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDirty]);

    // Attendee adder
    const [attendeeInput, setAttendeeInput] = useState('');
    const [attendeeName, setAttendeeName] = useState('');
    const [showEmpDropdown, setShowEmpDropdown] = useState(false);
    const attRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (attRef.current && !attRef.current.contains(e.target as Node)) setShowEmpDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const addEmployee = (emp: Employee) => {
        if (attendees.find(a => a.employee_id === emp.id)) return;
        setAttendees(prev => [...prev, { name: emp.name, email: emp.email || '', employee_id: emp.id }]);
        setShowEmpDropdown(false);
        setAttendeeInput('');
    };

    const addExternalAttendee = () => {
        const email = attendeeInput.trim();
        if (!email) return;
        setAttendees(prev => [...prev, { name: attendeeName || email, email, employee_id: null }]);
        setAttendeeInput(''); setAttendeeName('');
    };

    const removeAttendee = (idx: number) => setAttendees(prev => prev.filter((_, i) => i !== idx));

    const filteredEmps = employees.filter(e =>
        e.id !== currentUser.id &&
        !attendees.find(a => a.employee_id === e.id) &&
        (e.name.toLowerCase().includes(attendeeInput.toLowerCase()) || (e.email || '').toLowerCase().includes(attendeeInput.toLowerCase()))
    );

    const buildDates = () => {
        let start: Date, end: Date;
        if (allDay) {
            start = new Date(startDateStr + 'T00:00:00'); end = new Date(endDateStr + 'T23:59:59');
        } else {
            start = new Date(`${startDateStr}T${startTimeStr}:00`);
            end = new Date(`${endDateStr}T${endTimeStr}:00`);
            if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);
        }
        return { start, end };
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        setSaving(true);
        const { start, end } = buildDates();
        const payload = {
            organization_id: organizationId,
            employee_id: currentUser.id,
            title: title.trim(),
            description: description || null,
            location: location || null,
            start_at: start.toISOString(),
            end_at: end.toISOString(),
            all_day: allDay,
            color,
            attendees,
        };
        if (isEdit) {
            await supabase.from('calendar_events').update(payload).eq('id', event!.id);
        } else {
            await supabase.from('calendar_events').insert(payload);
        }
        setSaving(false);
        onSaved();
        onClose();
    };

    const handleDelete = async () => {
        if (!event) return;
        setSaving(true);
        await supabase.from('calendar_events').delete().eq('id', event.id);
        onDeleted?.();
        onClose();
    };

    const handleCloseIntent = () => {
        if (isDirty) setShowCancelConfirm(true);
        else onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', maxHeight: '90vh' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
                    <button onClick={handleCloseIntent} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Title */}
                    <div>
                        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLOR_HEX[color] }} />
                            <input
                                autoFocus
                                placeholder="Titel"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="flex-1 bg-transparent text-sm font-semibold outline-none"
                                style={{ color: 'var(--text-primary)' }}
                            />
                        </div>
                    </div>

                    {/* All Day toggle + dates */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock size={15} style={{ color: 'var(--text-muted)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Ganztägig</span>
                            </div>
                            <button
                                onClick={() => setAllDay(!allDay)}
                                className="relative w-9 h-5 rounded-full transition-colors"
                                style={{ background: allDay ? 'var(--accent)' : 'var(--border-strong)' }}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${allDay ? 'translate-x-4' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2" style={{ fontSize: 13 }}>
                            <div>
                                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Von</label>
                                <div className="flex gap-1">
                                    <input type="date" value={startDateStr} onChange={e => setStartDate(e.target.value)} className="w-full p-2 rounded-xl text-xs" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                    {!allDay && (
                                        <select value={startTimeStr} onChange={e => setStartTime(e.target.value)} className="w-20 p-2 rounded-xl text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Bis</label>
                                <div className="flex gap-1">
                                    <input type="date" value={endDateStr} onChange={e => setEndDate(e.target.value)} className="w-full p-2 rounded-xl text-xs" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                    {!allDay && (
                                        <select value={endTimeStr} onChange={e => setEndTime(e.target.value)} className="w-20 p-2 rounded-xl text-xs outline-none" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                        <MapPin size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                        <input
                            placeholder="Ort hinzufügen"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            className="flex-1 bg-transparent text-xs outline-none"
                            style={{ color: 'var(--text-primary)' }}
                        />
                    </div>

                    {/* Description */}
                    <div className="flex gap-2 p-2.5 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                        <FileText size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0 mt-0.5" />
                        <textarea
                            placeholder="Notizen hinzufügen..."
                            rows={2}
                            value={description}
                            onChange={e => setDesc(e.target.value)}
                            className="flex-1 bg-transparent text-xs outline-none resize-none"
                            style={{ color: 'var(--text-primary)' }}
                        />
                    </div>

                    {/* Color */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Palette size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Farbe</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map(c => (
                                <button key={c.id} onClick={() => setColor(c.id)}
                                    className="w-6 h-6 rounded-full ring-offset-2 transition-all"
                                    style={{ background: c.hex, outline: color === c.id ? `3px solid ${c.hex}` : 'none', outlineOffset: 2 }}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Attendees */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Users size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Teilnehmer</span>
                        </div>

                        {/* Current attendees */}
                        {attendees.length > 0 && (
                            <div className="space-y-1.5 mb-3">
                                {attendees.map((a, i) => {
                                    const emp = employees.find(e => e.id === a.employee_id);
                                    return (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-subtle)' }}>
                                            {emp
                                                ? <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                                : <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: 'var(--accent)' }}>{a.name[0]}</div>
                                            }
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</div>
                                                {a.email && <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{a.email}</div>}
                                            </div>
                                            <button onClick={() => removeAttendee(i)} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><X size={12} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Add attendee */}
                        <div className="relative" ref={attRef}>
                            <div className="flex gap-2">
                                <input
                                    placeholder="Name oder E-Mail eingeben..."
                                    value={attendeeInput}
                                    onChange={e => { setAttendeeInput(e.target.value); setShowEmpDropdown(true); }}
                                    onFocus={() => setShowEmpDropdown(true)}
                                    className="flex-1 p-2 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                />
                                {attendeeInput.includes('@') && (
                                    <button onClick={addExternalAttendee} className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                                        <Plus size={12} /> Hinzufügen
                                    </button>
                                )}
                            </div>
                            {showEmpDropdown && filteredEmps.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                    {filteredEmps.slice(0, 6).map(emp => (
                                        <button key={emp.id} onClick={() => addEmployee(emp)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                                            style={{ color: 'var(--text-primary)' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        >
                                            <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                            <div>
                                                <div className="text-xs font-medium">{emp.name}</div>
                                                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{emp.email}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {isEdit ? (
                        <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-colors" style={{ color: '#EF4444' }}>
                            <Trash2 size={13} /> Löschen
                        </button>
                    ) : <div />}
                    <div className="flex gap-2">
                        <button onClick={handleCloseIntent} className="text-xs font-medium px-4 py-2 rounded-xl transition-colors" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                            Abbrechen
                        </button>
                        <button onClick={handleSave} disabled={!title.trim() || loading} className="text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                            {loading ? '...' : isEdit ? 'Speichern' : 'Erstellen'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Cancel Confirm Sub-Modal */}
            {showCancelConfirm && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Wirklich verwerfen?</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Du hast ungespeicherte Änderungen vorgenommen. Möchtest du diese wirklich verwerfen?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowCancelConfirm(false)} className="px-4 py-2 rounded-xl text-xs font-medium transition-colors" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                                Nein, bearbeiten
                            </button>
                            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold transition-all" style={{ background: '#EF4444', color: '#fff' }}>
                                Ja, verwerfen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Sub-Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
                    <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Termin löschen?</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Möchtest du diesen Termin wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-xl text-xs font-medium transition-colors" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
                                Abbrechen
                            </button>
                            <button onClick={handleDelete} disabled={loading} className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50" style={{ background: '#EF4444', color: '#fff' }}>
                                {loading ? 'Lösche...' : 'Löschen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
