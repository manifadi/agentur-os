'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import DaySwitcher from '../components/TimeTracking/DaySwitcher';
import TimeStats from '../components/TimeTracking/TimeStats';
import TimeStream from '../components/TimeTracking/TimeStream';
import TimeEntryModal from '../components/Modals/TimeEntryModal';
import { Plus } from 'lucide-react';
import { TimeEntry } from '../types';

export default function ZeiterfassungPage() {
    const { session, employees, projects } = useApp();
    const currentUser = employees.find(e => e.email === session?.user?.email);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

    useEffect(() => {
        if (currentUser) {
            fetchEntries();
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
        if (!confirm('Eintrag wirklich löschen?')) return;
        await supabase.from('time_entries').delete().eq('id', id);
        fetchEntries();
    };

    const handleEdit = (entry: TimeEntry) => {
        setEditingEntry(entry);
        setIsModalOpen(true);
    };

    const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);

    return (
        <div className="flex h-screen bg-white">
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                    <h1 className="text-2xl font-bold tracking-tight">Zeiterfassung</h1>
                    <DaySwitcher currentDate={currentDate} onDateChange={setCurrentDate} />
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                    <div className="max-w-3xl mx-auto space-y-8">
                        {/* Summary & Stats */}
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <TimeStats totalHours={totalHours} />
                            </div>
                            <button
                                onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}
                                className="flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-gray-900/20 hover:scale-[1.02] transition-transform"
                            >
                                <Plus size={24} />
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
                        // We pass current date to modal if new entry? 
                        // Modal defaults to today. DaySwitcher might be on another day.
                        // Ideally modal should take `defaultDate` prop.
                        defaultDate={currentDate}
                    />
                )}
            </main>
        </div>
    );
}
