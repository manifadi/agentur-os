'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import { X, Loader2, Check, CalendarDays, Home, Stethoscope, Pin, Plane } from 'lucide-react';
import {
    AbsenceType, AbsenceHalfDay, ABSENCE_TYPE_LABEL,
} from '../../types';
import { workingDaysInRange, absenceWorkingDays } from '../../utils/absences';

interface Props {
    employeeId: string;
    countryCode?: string;
    federalState?: string | null;
    /** Optional: vorbelegen für "andere Person eintragen" */
    onClose: () => void;
    onSuccess: () => void;
}

const TYPES: { value: AbsenceType; label: string; icon: any; needsApproval: boolean; description: string }[] = [
    { value: 'vacation',    label: 'Urlaub',       icon: Plane,       needsApproval: true,  description: 'Manager-Freigabe nötig' },
    { value: 'home_office', label: 'Homeoffice',   icon: Home,        needsApproval: false, description: 'Sofort aktiv' },
    { value: 'sick',        label: 'Krankmeldung', icon: Stethoscope, needsApproval: false, description: 'Sofort aktiv' },
    { value: 'other',       label: 'Sonstige',     icon: Pin,         needsApproval: true,  description: 'Manager-Freigabe nötig' },
];

function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export default function AbsenceModal({ employeeId, countryCode = 'DE', federalState, onClose, onSuccess }: Props) {
    const [mounted, setMounted] = useState(false);
    const [type, setType]       = useState<AbsenceType>('vacation');
    const [startDate, setStartDate] = useState<string>(toIsoDate(new Date()));
    const [endDate, setEndDate]     = useState<string>(toIsoDate(new Date()));
    const [halfDay, setHalfDay]     = useState<AbsenceHalfDay>('none');
    const [reason, setReason]       = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Wenn endDate < startDate → auto-anpassen
    useEffect(() => {
        if (new Date(endDate) < new Date(startDate)) setEndDate(startDate);
    }, [startDate]);

    // Bei Mehrtages-Auswahl: Half-Day reset
    useEffect(() => {
        if (startDate !== endDate && halfDay !== 'none') setHalfDay('none');
    }, [startDate, endDate]);

    const days = useMemo(() => {
        try {
            return absenceWorkingDays({ start_date: startDate, end_date: endDate, half_day: halfDay }, countryCode, federalState);
        } catch { return 0; }
    }, [startDate, endDate, halfDay, countryCode, federalState]);

    const isValid = !!startDate && !!endDate && new Date(endDate) >= new Date(startDate);
    const isSingleDay = startDate === endDate;

    const meta = TYPES.find(t => t.value === type)!;

    const handleSubmit = async () => {
        if (!isValid) return;
        setSubmitting(true);
        const { error } = await supabase.rpc('request_absence', {
            p_employee_id: employeeId,
            p_type:        type,
            p_start_date:  startDate,
            p_end_date:    endDate,
            p_half_day:    halfDay,
            p_reason:      reason.trim() || null,
        });
        setSubmitting(false);
        if (error) { toast.error('Fehler: ' + error.message); return; }
        toast.success(meta.needsApproval
            ? `Anfrage gesendet (${ABSENCE_TYPE_LABEL[type]}).`
            : `${ABSENCE_TYPE_LABEL[type]} eingetragen.`);
        onSuccess();
        onClose();
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
             onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                 className="bg-surface rounded-2xl shadow-lg max-w-md w-full animate-in zoom-in-95 duration-200"
                 style={{ border: '1px solid var(--border-subtle)' }}>

                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                             style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                            <CalendarDays size={16} />
                        </div>
                        <h2 className="ds-title">Abwesenheit eintragen</h2>
                    </div>
                    <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Type */}
                    <div>
                        <label className="ds-caption mb-2 block">Typ</label>
                        <div className="grid grid-cols-2 gap-2">
                            {TYPES.map(t => {
                                const Icon = t.icon;
                                const active = type === t.value;
                                return (
                                    <button key={t.value} type="button" onClick={() => setType(t.value)}
                                        className="text-left p-3 rounded-xl transition-all"
                                        style={active ? {
                                            border: '1.5px solid var(--accent)',
                                            background: 'var(--accent-subtle)',
                                        } : {
                                            border: '1.5px solid var(--border-default)',
                                            background: 'var(--bg-subtle)',
                                        }}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon size={14} style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }} />
                                            <span className="text-xs font-bold text-text-primary">{t.label}</span>
                                        </div>
                                        <div className="text-[10px] text-text-muted">{t.description}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="ds-caption mb-2 block">Von</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition bg-subtle border border-border-strong text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent" />
                        </div>
                        <div>
                            <label className="ds-caption mb-2 block">Bis</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition bg-subtle border border-border-strong text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent" />
                        </div>
                    </div>

                    {/* Half day (nur bei Einzeltag) */}
                    {isSingleDay && (
                        <div>
                            <label className="ds-caption mb-2 block">Halber Tag</label>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'none',  label: 'Ganztags' },
                                    { value: 'start', label: 'Vormittag' },
                                    { value: 'end',   label: 'Nachmittag' },
                                ] as const).map(opt => {
                                    const active = halfDay === opt.value;
                                    return (
                                        <button key={opt.value} type="button" onClick={() => setHalfDay(opt.value)}
                                            className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                                            style={active ? {
                                                background: 'var(--accent)', color: 'var(--accent-text)',
                                            } : {
                                                background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
                                                border: '1px solid var(--border-default)',
                                            }}>
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="ds-caption mb-2 block">
                            Notiz {meta.needsApproval && <span className="text-text-muted normal-case font-normal">— wird mit Anfrage übermittelt</span>}
                        </label>
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                            placeholder={type === 'vacation' ? 'Optional — z.B. "Familienurlaub Italien"' : 'Optional'}
                            className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition bg-subtle border border-border-strong text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent" />
                    </div>

                    {/* Working-Day-Anzeige */}
                    {type === 'vacation' && days > 0 && (
                        <div className="flex items-center gap-2 text-xs"
                             style={{ color: 'var(--text-muted)' }}>
                            <CalendarDays size={12} />
                            <span>
                                <strong style={{ color: 'var(--text-primary)' }}>{days} Arbeitstag{days === 1 ? '' : 'e'}</strong>
                                {' '}werden vom Resturlaub abgezogen (Wochenenden + Feiertage ausgenommen)
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <button onClick={onClose} disabled={submitting} className="btn-ghost px-4 py-2 rounded-xl">Abbrechen</button>
                    <button onClick={handleSubmit} disabled={!isValid || submitting}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {meta.needsApproval ? 'Anfragen' : 'Eintragen'}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
