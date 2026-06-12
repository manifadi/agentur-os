import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Clock } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { AttendanceEntry } from '../../types';
import { toast } from 'sonner';

interface AttendanceEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    organizationId: string;
    employeeId: string;          // Ziel-Mitarbeiter (eigene oder – als Admin – fremde)
    entryToEdit?: AttendanceEntry | null;
    onSaved: () => void;
}

// Lokales Datum/Uhrzeit aus einem ISO-Timestamp ziehen
function localDate(iso?: string | null): string {
    if (!iso) return new Date().toISOString().split('T')[0];
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function localTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
// Datum + Uhrzeit (lokal) → ISO-Timestamp
function toIso(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
}

export default function AttendanceEntryModal({
    isOpen, onClose, organizationId, employeeId, entryToEdit, onSaved,
}: AttendanceEntryModalProps) {
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (entryToEdit) {
            setDate(localDate(entryToEdit.clock_in));
            setStartTime(localTime(entryToEdit.clock_in));
            setEndTime(localTime(entryToEdit.clock_out));
            setNote(entryToEdit.note || '');
        } else {
            setDate(new Date().toISOString().split('T')[0]);
            setStartTime('');
            setEndTime('');
            setNote('');
        }
    }, [isOpen, entryToEdit]);

    const handleSave = async () => {
        if (!date || !startTime) { toast.error('Bitte Datum und Beginn angeben.'); return; }
        const clockIn = toIso(date, startTime);
        const clockOut = endTime ? toIso(date, endTime) : null;
        if (clockOut && new Date(clockOut) < new Date(clockIn)) {
            toast.error('Das Ende muss nach dem Beginn liegen.');
            return;
        }
        setIsSubmitting(true);

        const payload: any = {
            organization_id: organizationId,
            employee_id: employeeId,
            clock_in: clockIn,
            clock_out: clockOut,
            note: note.trim() || null,
        };

        const result = entryToEdit
            ? await supabase.from('attendance_entries').update(payload).eq('id', entryToEdit.id)
            : await supabase.from('attendance_entries').insert([payload]);

        if (result.error) {
            const msg = /uq_attendance_one_open_session/.test(result.error.message)
                ? 'Es gibt bereits eine offene Session — bitte zuerst ein Ende eintragen.'
                : (result.error.message || 'Speichern fehlgeschlagen.');
            toast.error(msg);
            setIsSubmitting(false);
            return;
        }
        toast.success(entryToEdit ? 'Eintrag aktualisiert.' : 'Eintrag gespeichert.');
        onSaved();
        onClose();
        setIsSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-default rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-default flex justify-between items-center" style={{ background: 'var(--bg-subtle)' }}>
                    <h3 className="text-[17px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {entryToEdit ? 'Stempelzeit bearbeiten' : 'Stempelzeit nachtragen'}
                    </h3>
                    <button onClick={onClose} className="btn-ghost"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="section-header-label mb-2 block">Datum</label>
                        <div className="relative">
                            <input
                                type="date"
                                className="w-full p-3 pl-10 bg-subtle border border-default text-text-primary rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="section-header-label mb-2 block">Beginn</label>
                            <div className="relative">
                                <input
                                    type="time"
                                    className="w-full p-3 pl-10 bg-subtle border border-default text-text-primary rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            </div>
                        </div>
                        <div>
                            <label className="section-header-label mb-2 block">Ende <span className="font-normal text-text-muted normal-case">(optional)</span></label>
                            <div className="relative">
                                <input
                                    type="time"
                                    className="w-full p-3 pl-10 bg-subtle border border-default text-text-primary rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-text-muted -mt-2">Ohne Ende läuft die Session weiter (offen).</p>

                    <div>
                        <label className="section-header-label mb-2 block">Notiz <span className="font-normal text-text-muted normal-case">(optional)</span></label>
                        <input
                            type="text"
                            className="w-full p-3 bg-subtle border border-default text-text-primary rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition"
                            placeholder="z.B. Homeoffice, Korrektur …"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>

                    <button onClick={handleSave} disabled={isSubmitting} className="btn-primary w-full py-3 justify-center">
                        {isSubmitting
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Check size={16} />}
                        {isSubmitting ? 'Speichert…' : 'Speichern'}
                    </button>
                </div>
            </div>
        </div>
    );
}
