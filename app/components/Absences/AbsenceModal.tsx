'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import { X, Loader2, Check, CalendarDays, Home, Stethoscope, Pin, Plane, Scale, Wallet, AlertTriangle } from 'lucide-react';
import {
    AbsenceType, AbsenceHalfDay, ABSENCE_TYPE_LABEL, Absence,
} from '../../types';
import { absenceWorkingDays, absenceWorkingHours, scheduleOf, computeVacationBalance } from '../../utils/absences';
import { useApp } from '../../context/AppContext';

const fmt = (n: number) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1 });

// Referenz-Zeitfenster für Halbtage — nur informativ, damit klar ist
// "von wann bis wann" Vormittag/Nachmittag gemeint sind.
const VORMITTAG_RANGE = '08:00–12:00';
const NACHMITTAG_RANGE = '12:00–16:00';

type DayMode = 'full' | 'morning' | 'afternoon' | 'custom';

interface Props {
    employeeId: string;
    countryCode?: string;
    federalState?: string | null;
    /** Optional: vorbelegen für "andere Person eintragen" */
    onClose: () => void;
    onSuccess: () => void;
}

const TYPES: { value: AbsenceType; label: string; icon: any; needsApproval: boolean; description: string }[] = [
    { value: 'vacation',        label: 'Urlaub',            icon: Plane,       needsApproval: true,  description: 'Manager-Freigabe nötig' },
    { value: 'zeitausgleich',   label: 'Zeitausgleich',     icon: Scale,       needsApproval: true,  description: 'Manager-Freigabe nötig' },
    { value: 'unpaid_vacation', label: 'Unbezahlter Urlaub', icon: Wallet,     needsApproval: true,  description: 'Kein Resturlaub nötig' },
    { value: 'home_office',     label: 'Homeoffice',        icon: Home,        needsApproval: false, description: 'Sofort aktiv' },
    { value: 'sick',            label: 'Krankmeldung',      icon: Stethoscope, needsApproval: false, description: 'Sofort aktiv' },
    { value: 'other',           label: 'Sonstige',          icon: Pin,         needsApproval: true,  description: 'Manager-Freigabe nötig' },
];

function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export default function AbsenceModal({ employeeId, countryCode = 'DE', federalState, onClose, onSuccess }: Props) {
    const [mounted, setMounted] = useState(false);
    const [type, setType]       = useState<AbsenceType>('vacation');
    const [startDate, setStartDate] = useState<string>(toIsoDate(new Date()));
    const [endDate, setEndDate]     = useState<string>(toIsoDate(new Date()));
    const [dayMode, setDayMode]     = useState<DayMode>('full');
    const [startTime, setStartTime] = useState<string>('08:00');
    const [endTime, setEndTime]     = useState<string>('12:00');
    const [reason, setReason]       = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [empAbsences, setEmpAbsences] = useState<Absence[]>([]);

    const { employees } = useApp();
    const employee = useMemo(() => employees.find(e => e.id === employeeId), [employees, employeeId]);

    useEffect(() => { setMounted(true); }, []);

    // Abwesenheiten des Mitarbeiters laden (für stundenbasierte Resturlaub-Bilanz)
    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('absences').select('*').eq('employee_id', employeeId);
            if (Array.isArray(data)) setEmpAbsences(data as Absence[]);
        })();
    }, [employeeId]);

    // Wenn endDate < startDate → auto-anpassen
    useEffect(() => {
        if (new Date(endDate) < new Date(startDate)) setEndDate(startDate);
    }, [startDate]);

    // Bei Mehrtages-Auswahl: zurück auf Ganztags
    useEffect(() => {
        if (startDate !== endDate && dayMode !== 'full') setDayMode('full');
    }, [startDate, endDate]);

    const isSingleDay = startDate === endDate;
    const halfDay: AbsenceHalfDay = dayMode === 'morning' ? 'start' : dayMode === 'afternoon' ? 'end' : 'none';
    const useCustomTime = isSingleDay && dayMode === 'custom';

    const draft = useMemo(() => ({
        start_date: startDate, end_date: endDate,
        half_day: (isSingleDay ? halfDay : 'none') as AbsenceHalfDay,
        start_time: useCustomTime ? startTime : null,
        end_time:   useCustomTime ? endTime : null,
    }), [startDate, endDate, halfDay, useCustomTime, startTime, endTime, isSingleDay]);

    const days = useMemo(() => {
        try { return absenceWorkingDays(draft, countryCode, federalState); } catch { return 0; }
    }, [draft, countryCode, federalState]);

    const hours = useMemo(() => {
        try { return employee ? absenceWorkingHours(draft, scheduleOf(employee), countryCode, federalState) : 0; } catch { return 0; }
    }, [draft, employee, countryCode, federalState]);

    // Stundenbasierte Resturlaub-Bilanz für das Jahr des Eintrags
    const balance = useMemo(() => {
        if (!employee) return null;
        const yr = new Date(startDate).getFullYear() || new Date().getFullYear();
        return computeVacationBalance(employee, empAbsences, yr, countryCode, federalState);
    }, [employee, empAbsences, startDate, countryCode, federalState]);

    // Reicht der Resturlaub? (nur relevant für bezahlten Urlaub)
    const lacksVacation = type === 'vacation' && balance != null && (balance.remainingHours - hours) < 0;

    const meta = TYPES.find(t => t.value === type)!;

    const handleSubmit = async () => {
        if (!startDate || !endDate) { toast.error('Bitte wähle Start- und Enddatum.'); return; }
        if (new Date(endDate) < new Date(startDate)) { toast.error('Das Enddatum darf nicht vor dem Startdatum liegen.'); return; }
        if (useCustomTime) {
            if (!startTime || !endTime) { toast.error('Bitte Start- und Endzeit angeben.'); return; }
            if (endTime <= startTime) { toast.error('Die Endzeit muss nach der Startzeit liegen.'); return; }
        }
        setSubmitting(true);
        const { error } = await supabase.rpc('request_absence', {
            p_employee_id: employeeId,
            p_type:        type,
            p_start_date:  startDate,
            p_end_date:    endDate,
            p_half_day:    isSingleDay ? halfDay : 'none',
            p_start_time:  useCustomTime ? startTime : null,
            p_end_time:    useCustomTime ? endTime : null,
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

                    {/* Tages-Umfang (nur bei Einzeltag) */}
                    {isSingleDay && (
                        <div>
                            <label className="ds-caption mb-2 block">Umfang</label>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { value: 'full',      label: 'Ganztags',    hint: '' },
                                    { value: 'morning',   label: 'Vormittag',   hint: VORMITTAG_RANGE },
                                    { value: 'afternoon', label: 'Nachmittag',  hint: NACHMITTAG_RANGE },
                                    { value: 'custom',    label: 'Genaue Zeit', hint: 'z.B. 08:15–14:30' },
                                ] as const).map(opt => {
                                    const active = dayMode === opt.value;
                                    return (
                                        <button key={opt.value} type="button" onClick={() => setDayMode(opt.value)}
                                            className="px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left"
                                            style={active ? {
                                                background: 'var(--accent)', color: 'var(--accent-text)',
                                            } : {
                                                background: 'var(--bg-subtle)', color: 'var(--text-secondary)',
                                                border: '1px solid var(--border-default)',
                                            }}>
                                            <div>{opt.label}</div>
                                            {opt.hint && (
                                                <div className="text-[10px] font-normal mt-0.5"
                                                    style={{ color: active ? 'var(--accent-text)' : 'var(--text-muted)', opacity: active ? 0.85 : 1 }}>
                                                    {opt.hint}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Exakte Uhrzeiten */}
                            {dayMode === 'custom' && (
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="ds-caption mb-2 block">Von (Uhrzeit)</label>
                                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition bg-subtle border border-border-strong text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent" />
                                    </div>
                                    <div>
                                        <label className="ds-caption mb-2 block">Bis (Uhrzeit)</label>
                                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition bg-subtle border border-border-strong text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent" />
                                    </div>
                                </div>
                            )}
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

                    {/* Working-Day-Anzeige (Tage + Stunden) */}
                    {type === 'vacation' && days > 0 && (
                        <div className="flex items-center gap-2 text-xs"
                             style={{ color: 'var(--text-muted)' }}>
                            <CalendarDays size={12} />
                            <span>
                                <strong style={{ color: 'var(--text-primary)' }}>{fmt(days)} Arbeitstag{days === 1 ? '' : 'e'} ({fmt(hours)} h)</strong>
                                {' '}werden vom Resturlaub abgezogen (Wochenenden + Feiertage ausgenommen)
                                {balance != null && <> · {fmt(Math.max(0, balance.remainingHours))} h verbleibend</>}
                            </span>
                        </div>
                    )}

                    {/* Zu wenig Resturlaub → unbezahlten Urlaub anbieten */}
                    {lacksVacation && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl text-xs"
                             style={{ background: 'var(--color-warning-subtle)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning-text)' }}>
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <div>
                                <div className="font-bold">Nicht genug Resturlaub</div>
                                <div className="mt-0.5">Verfügbar sind nur {fmt(Math.max(0, balance!.remainingHours))} h ({fmt(Math.max(0, balance!.remainingDays))} Tage).</div>
                                <button type="button" onClick={() => setType('unpaid_vacation')}
                                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition"
                                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                                    <Wallet size={12} /> Als unbezahlten Urlaub eintragen
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <button onClick={onClose} disabled={submitting} className="btn-ghost px-4 py-2 rounded-xl">Abbrechen</button>
                    <button onClick={handleSubmit} disabled={submitting}
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
