import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { AgencyPosition } from '../../types';
import { Plus, Trash2, Save, X, Edit2 } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';

export default function AdminRateManagement() {
    const [positions, setPositions] = useState<AgencyPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<string | null>(null);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'info' | 'warning' | 'success';
        confirmText?: string;
        showCancel?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'info'
    });

    // Filter/Sort State
    const [categoryFilter, setCategoryFilter] = useState<string>('All');

    // New Position State
    const [newPos, setNewPos] = useState<Partial<AgencyPosition>>({
        title: '',
        hourly_rate: 0,
        category: 'Allgemein'
    });

    useEffect(() => {
        fetchPositions();
    }, []);

    const fetchPositions = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('agency_positions')
            .select('*')
            .order('category', { ascending: true })
            .order('title', { ascending: true });

        if (data) setPositions(data);
        setLoading(false);
    };

    const handleSaveNew = async () => {
        if (!newPos.title || !newPos.hourly_rate) return;

        const { data: { user } } = await supabase.auth.getUser();
        // Fallback: fetch user's org
        const { data: emp } = await supabase.from('employees').select('organization_id').eq('email', user?.email).single();

        if (emp) {
            const { error } = await supabase.from('agency_positions').insert([{
                ...newPos,
                organization_id: emp.organization_id
            }]);

            if (!error) {
                setNewPos({ title: '', hourly_rate: 0, category: 'Allgemein' });
                fetchPositions();
            } else {
                setConfirmConfig({
                    isOpen: true,
                    title: 'Fehler',
                    message: error.message,
                    onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                    type: 'danger',
                    confirmText: 'OK',
                    showCancel: false
                });
            }
        }
    };

    const handleUpdate = async (id: string, updates: Partial<AgencyPosition>) => {
        const { error } = await supabase.from('agency_positions').update(updates).eq('id', id);
        if (!error) {
            setEditId(null);
            fetchPositions();
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Position löschen?',
            message: 'Möchtest du diese Position wirklich löschen?',
            onConfirm: async () => {
                await supabase.from('agency_positions').delete().eq('id', id);
                fetchPositions();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            },
            type: 'danger',
            confirmText: 'Löschen'
        });
    };

    const categories = Array.from(new Set(positions.map(p => p.category || 'Unkategorisiert')));

    const filteredPositions = categoryFilter === 'All'
        ? positions
        : positions.filter(p => p.category === categoryFilter);

    // Grouping for Display
    const groupedPositions = filteredPositions.reduce((acc, pos) => {
        const cat = pos.category || 'Unkategorisiert';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(pos);
        return acc;
    }, {} as Record<string, AgencyPosition[]>);

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in fade-in duration-300">
            <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
                <span>Stundensätze & Positionen</span>
                <span className="text-xs font-normal text-gray-400 bg-gray-50 px-2 py-1 rounded">Global für die Agentur</span>
            </h2>

            {/* CREATE NEW */}
            <div className="bg-gray-50 p-4 rounded-xl mb-8 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Neue Position anlegen</h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Titel</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                            placeholder="z.B. Senior Developer"
                            value={newPos.title}
                            onChange={e => setNewPos({ ...newPos, title: e.target.value })}
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs text-gray-500 mb-1">Kategorie</label>
                        <input
                            type="text"
                            className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                            placeholder="z.B. Digital"
                            list="categoriesList"
                            value={newPos.category}
                            onChange={e => setNewPos({ ...newPos, category: e.target.value })}
                        />
                        <datalist id="categoriesList">
                            {categories.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                    <div className="w-24">
                        <label className="block text-xs text-gray-500 mb-1">Rate (€)</label>
                        <input
                            type="number"
                            className="w-full p-2 rounded-lg border border-gray-200 text-sm"
                            placeholder="0.00"
                            value={newPos.hourly_rate}
                            onChange={e => setNewPos({ ...newPos, hourly_rate: parseFloat(e.target.value) })}
                        />
                    </div>
                    <button
                        onClick={handleSaveNew}
                        disabled={!newPos.title || !newPos.hourly_rate}
                        className="bg-gray-900 text-white p-2 rounded-xl hover:bg-black transition disabled:opacity-50"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="space-y-6">
                {Object.entries(groupedPositions).map(([category, items]) => (
                    <div key={category} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 font-bold text-sm text-gray-600 flex justify-between items-center">
                            {category}
                            <span className="bg-white text-gray-400 text-xs px-2 py-0.5 rounded-full border">{items.length} Positionen</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {items.map(pos => (
                                <div key={pos.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition group">
                                    {editId === pos.id ? (
                                        <div className="flex gap-2 w-full items-center">
                                            <input
                                                className="flex-1 p-1 border rounded-xl text-sm font-bold"
                                                defaultValue={pos.title}
                                                id={`edit-title-${pos.id}`}
                                            />
                                            <input
                                                className="w-24 p-1 border rounded-xl text-sm text-right"
                                                defaultValue={pos.hourly_rate}
                                                type="number"
                                                id={`edit-rate-${pos.id}`}
                                            />
                                            <button
                                                onClick={() => {
                                                    const t = (document.getElementById(`edit-title-${pos.id}`) as HTMLInputElement).value;
                                                    const r = (document.getElementById(`edit-rate-${pos.id}`) as HTMLInputElement).value;
                                                    handleUpdate(pos.id, { title: t, hourly_rate: parseFloat(r) });
                                                }}
                                                className="text-green-600 hover:bg-green-50 p-1 rounded-xl"
                                            >
                                                <Save size={16} />
                                            </button>
                                            <button onClick={() => setEditId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="font-medium text-gray-900 text-sm flex-1">{pos.title}</div>
                                            <div className="font-mono text-gray-600 w-24 text-right">{pos.hourly_rate.toFixed(2)} €</div>
                                            <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={() => setEditId(pos.id)} className="p-1 text-gray-400 hover:text-blue-600 rounded-xl"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDelete(pos.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-xl"><Trash2 size={14} /></button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {positions.length === 0 && !loading && (
                    <div className="text-center py-10 text-gray-400">Keine Positionen gefunden.</div>
                )}
            </div>
            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                type={confirmConfig.type}
                confirmText={confirmConfig.confirmText}
                showCancel={confirmConfig.showCancel}
            />
        </div>
    );
}
