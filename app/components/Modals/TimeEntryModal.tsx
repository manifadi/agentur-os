import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Search, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Project, Employee, TimeEntry } from '../../types';

interface TimeEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: Employee;
    projects: Project[];
    preselectedProject?: Project;
    entryToEdit?: TimeEntry | null; // NEW
    defaultDate?: Date; // NEW
    onEntryCreated: () => void;
}

export default function TimeEntryModal({ isOpen, onClose, currentUser, projects, preselectedProject, onEntryCreated, entryToEdit, defaultDate }: TimeEntryModalProps) {
    const [projectId, setProjectId] = useState('');
    const [agencyPositionId, setAgencyPositionId] = useState<string | null>(null); // NEW: Agency Position ID
    const [agencyPositionTitle, setAgencyPositionTitle] = useState<string>(''); // For debug display
    const [description, setDescription] = useState('');
    const [hours, setHours] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // EDIT MODE
            if (entryToEdit) {
                setProjectId(entryToEdit.project_id);
                setSearchTerm(entryToEdit.projects ? `${entryToEdit.projects.job_number} • ${entryToEdit.projects.title}` : '');
                setAgencyPositionId(entryToEdit.agency_position_id || null);
                // We don't have position title in entryToEdit usually unless joined, but we can fetch or just leave empty for now?
                // Actually the page query joins positions (contract not agency).
                // Agency position lookup might be needed if we want to show it correctly.
                // For now, let's keep it simple: assume user role is enough or just re-fetch if needed.
                // But wait, if editing, we shouldn't change agency position logic unless user changes it?
                // The current logic fetches based on USER job title.
                // Let's stick to user job title logic for now, or use what's in DB if we had it joined.
                // The page fetches `positions` (contract) but not `agency_positions` joined?
                // The page query: `projects ( title, job_number, clients ( name ) ), positions ( title )` -> positions is contract position.
                // We should probably rely on User Job Title for now as the modal does.

                setDescription(entryToEdit.description || '');
                setHours(String(entryToEdit.hours));
                setDate(entryToEdit.date);
            }
            // PRESELECT PROJECT MODE
            else if (preselectedProject) {
                setProjectId(preselectedProject.id);
                setSearchTerm(`${preselectedProject.job_number} • ${preselectedProject.title}`);
                resetForm();
            }
            // DEFAULT NEW MODE
            else {
                setProjectId('');
                setSearchTerm('');
                resetForm();
            }

            // Always check user position (or should we respect saved pos if editing?)
            // If editing, ideally we prefer the saved one. But we don't have it joined easily.
            // Let's assume the user is the same.
            if (currentUser.job_title) {
                fetchAndSetAgencyPosition(currentUser.job_title);
            }
        }
    }, [isOpen, preselectedProject, currentUser, entryToEdit, defaultDate]);

    const resetForm = () => {
        setAgencyPositionId(null);
        setAgencyPositionTitle('');
        setDescription('');
        setHours('');
        setDate(defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    };

    // Helper to find the agency position ID based on user title
    const fetchAndSetAgencyPosition = async (title: string) => {
        // ... (Keep existing logic)
        try {
            const { data, error } = await supabase
                .from('agency_positions')
                .select('id, title')
                .ilike('title', title)
                .maybeSingle();

            if (data) {
                setAgencyPositionId(data.id);
                setAgencyPositionTitle(data.title);
            }
        } catch (err) { console.error(err); }
    };

    const filteredProjects = useMemo(() => {
        if (!searchTerm) return projects.slice(0, 10);
        const lower = searchTerm.toLowerCase();
        return projects
            .filter(p => p.title.toLowerCase().includes(lower) || p.job_number.toLowerCase().includes(lower))
            .slice(0, 10);
    }, [projects, searchTerm]);

    const handleSave = async () => {
        if (!projectId || !hours || !currentUser) return;
        setIsSubmitting(true);

        const payload = {
            project_id: projectId,
            position_id: null,
            agency_position_id: agencyPositionId || null,
            employee_id: currentUser.id,
            date: date,
            hours: Number(hours),
            description: description
        };

        let result;
        if (entryToEdit) {
            result = await supabase.from('time_entries').update(payload).eq('id', entryToEdit.id);
        } else {
            result = await supabase.from('time_entries').insert([payload]);
        }

        if (!result.error) {
            onEntryCreated();
            onClose();
        } else {
            console.error('[TimeEntryModal] Error saving time entry:', result.error);
            alert('Fehler beim Speichern: ' + (result.error.message || 'Unbekannter Fehler'));
        }
        setIsSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-xl text-gray-900">{entryToEdit ? 'Eintrag bearbeiten' : 'Stunden erfassen'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400 hover:text-gray-900">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                    {/* Project Search */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Projekt</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                placeholder="Projekt suchen (Nr oder Name)..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setIsDropdownOpen(true);
                                    if (!e.target.value) setProjectId('');
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                            />
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>

                        {/* Dropdown Results */}
                        {isDropdownOpen && searchTerm && !projectId && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-50 divide-y divide-gray-50">
                                {filteredProjects.length > 0 ? (
                                    filteredProjects.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setProjectId(p.id);
                                                setSearchTerm(`${p.job_number} • ${p.title}`);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="w-full text-left p-3 hover:bg-blue-50 transition flex flex-col"
                                        >
                                            <span className="font-bold text-sm text-gray-900">{p.title}</span>
                                            <span className="text-xs text-gray-500">{p.job_number} | {p.clients?.name}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-sm text-gray-400">Kein Projekt gefunden</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Show Current User Position (Agency Position) - and Match Status */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Meine Position (Intern)</label>
                        <div className={`p-3 border rounded-xl text-sm font-bold flex justify-between items-center ${agencyPositionId ? 'bg-green-50 border-green-200 text-green-900' : 'bg-orange-50 border-orange-200 text-orange-900'}`}>
                            <div className="flex flex-col">
                                <span>{currentUser.job_title || 'Keine Job-Bezeichnung im Profil'}</span>
                                {agencyPositionId && agencyPositionTitle !== currentUser.job_title && (
                                    <span className="text-[10px] font-normal opacity-70">Gematcht als: {agencyPositionTitle}</span>
                                )}
                            </div>

                            {agencyPositionId ? (
                                <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                    <Check size={12} /> ID gefunden
                                </span>
                            ) : (
                                <span className="text-xs font-medium text-orange-600 flex items-center gap-1">
                                    <AlertCircle size={12} /> Keine ID
                                </span>
                            )}
                        </div>
                        {!agencyPositionId && currentUser.job_title && (
                            <p className="text-[10px] text-orange-500 mt-1 pl-1">
                                Hinweis: "{currentUser.job_title}" wurde nicht in den Agentur-Positionen gefunden.
                            </p>
                        )}
                    </div>

                    {/* Date & Hours */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Datum</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Stunden</label>
                            <input
                                type="number"
                                step="0.25"
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                                placeholder="0.00"
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Beschreibung</label>
                        <textarea
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition min-h-[100px] resize-none"
                            placeholder="Was hast du gemacht?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSubmitting || !projectId || !hours}
                        className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={20} />}
                        {isSubmitting ? 'Speichert...' : 'Eintrag speichern'}
                    </button>
                </div>
            </div>
        </div>
    );
}
