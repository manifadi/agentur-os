'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import DaySwitcher from '../components/TimeTracking/DaySwitcher';
import TimeStats from '../components/TimeTracking/TimeStats';
import TimeStream from '../components/TimeTracking/TimeStream';
import TimeEntryModal from '../components/Modals/TimeEntryModal';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { Plus } from 'lucide-react';
import { TimeEntry } from '../types';
import { usePageTitle } from '../hooks/usePageTitle';

export default function ZeiterfassungPage() {
    usePageTitle('Zeiterfassung');
    const { session, employees, projects } = useApp();
    const currentUser = employees.find(e => e.email === session?.user?.email);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser) {
            fetchEntries();

            // Realtime listener for time entries of the current user
            const channel = supabase
                .channel(`user-time-entries-${currentUser.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'time_entries',
                        filter: `employee_id=eq.${currentUser.id}`
                    },
                    () => fetchEntries()
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [currentDate, currentUser]);

    const fetchEntries = async () => {
        if (!currentUser) return;
        setLoading(true);
        const dateStr = currentDate.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('time_entries')
            .select(`
                *,
                projects ( title, job_number, clients ( name ) ),
                positions:agency_positions ( title )
            `)
            .eq('employee_id', currentUser.id)
            .eq('date', dateStr)
            .order('created_at', { ascending: false });

        if (error) console.error(error);
        if (data) setEntries(data as any);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        setEntryToDelete(id);
    };

    const confirmDelete = async () => {
        if (entryToDelete) {
            await supabase.from('time_entries').delete().eq('id', entryToDelete);
            fetchEntries();
            setEntryToDelete(null);
        }
    };

    const handleEdit = (entry: TimeEntry) => {
        setEditingEntry(entry);
        setIsModalOpen(true);
    };

    const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);

    return (
        <div className="flex h-screen bg-surface">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header
                    className="px-8 py-5 flex justify-between items-center flex-wrap gap-4 z-10"
                    style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}
                >
                    <div>
                        <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                            Zeiterfassung
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Stunden erfassen & überblicken
                        </p>
                    </div>
                    <DaySwitcher currentDate={currentDate} onDateChange={setCurrentDate} />
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-subtle/30">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {/* Summary & Stats */}
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <TimeStats totalHours={totalHours} />
                            </div>
                            <button
                                onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.98] shadow-sm"
                                style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                                onMouseLeave={e => (e.currentTarget.style.filter = '')}
                            >
                                <Plus size={16} />
                                Zeit erfassen
                            </button>
                        </div>

                        {/* Stream */}
                        <TimeStream
                            entries={entries}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    </div>
                </div>

                {currentUser && (
                    <TimeEntryModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        currentUser={currentUser}
                        projects={projects}
                        entryToEdit={editingEntry}
                        onEntryCreated={() => {
                            fetchEntries();
                            setIsModalOpen(false);
                        }}
                        defaultDate={currentDate}
                    />
                )}

                <ConfirmModal
                    isOpen={!!entryToDelete}
                    title="Eintrag löschen?"
                    message="Möchtest du diesen Zeit-Eintrag wirklich löschen?"
                    onConfirm={confirmDelete}
                    onCancel={() => setEntryToDelete(null)}
                    type="danger"
                    confirmText="Löschen"
                    cancelText="Abbrechen"
                />
            </main>
        </div>
    );
}
