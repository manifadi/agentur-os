import React, { useState } from 'react';
import { Client } from '../../types';
import { supabase } from '../../supabaseClient';
import { Trash2, AlertTriangle, Building2, ArrowRight } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';
import ClientModal from '../Modals/ClientModal';
import { useApp } from '../../context/AppContext'; // Need context to refetch? Or props? Props have onUpdate.

interface AdminClientManagementProps {
    clients: Client[];
    onUpdate: () => void;
}

export default function AdminClientManagement({ clients, onUpdate }: AdminClientManagementProps) {
    const [loading, setLoading] = useState(false);

    // Deletion State
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmStep, setConfirmStep] = useState<'none' | 'initial' | 'final'>('none');

    // Edit State
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const openEdit = (client: Client) => {
        setEditingClient(client);
        setIsEditOpen(true);
    };

    const handleSaveClient = async (data: any) => {
        if (!editingClient) return;
        const { error } = await supabase.from('clients').update(data).eq('id', editingClient.id);
        if (error) throw error;
        onUpdate();
    };

    const initiateDelete = (id: string) => {
        setDeletingId(id);
        setConfirmStep('initial');
    };

    const handleFirstConfirm = () => {
        setConfirmStep('final');
    };

    const handleFinalConfirm = async () => {
        if (!deletingId) return;
        setLoading(true);
        console.log("Deleting client:", deletingId);

        // Supabase Delete (Cascade should handle projects if configured, or manual delete)
        // Assumption: Database has ON DELETE CASCADE for projects referencing clients.
        // If not, we might fail or leave orphans. 
        // User requirement: "somit auch alle Projekte, die damit verbunden sind".
        // Let's assume manual delete safety or rely on DB constraint.
        // Ideally we delete projects first or rely on cascade. 
        // With Supabase, usually foreign keys prevent delete unless cascade is on.

        const { error } = await supabase.from('clients').delete().eq('id', deletingId);

        if (error) {
            alert('Fehler beim Löschen: ' + error.message);
        } else {
            onUpdate();
        }

        setLoading(false);
        resetDelete();
    };

    const resetDelete = () => {
        setDeletingId(null);
        setConfirmStep('none');
    };

    const deletingClient = clients.find(c => c.id === deletingId);

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-gray-400" /> Kunden Verwaltung
            </h2>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                        <tr>
                            <th className="p-4">Logo</th>
                            <th className="p-4">Name</th>
                            <th className="p-4 w-24 text-right">Aktion</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {clients.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-gray-400">Keine Kunden gefunden.</td></tr>
                        ) : clients.map(client => (
                            <tr key={client.id} className="hover:bg-gray-50/50 transition">
                                <td className="p-4 w-16">
                                    {client.logo_url ? (
                                        <div className="w-8 h-8 rounded bg-white border border-gray-100 flex items-center justify-center p-0.5">
                                            <img src={client.logo_url} className="w-full h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                                            {client.name.substring(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 font-medium text-gray-900">{client.name}</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button
                                        onClick={() => window.location.href = `/clients/${client.id}`}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                        title="Details öffnen"
                                    >
                                        <ArrowRight size={16} />
                                    </button>
                                    <button
                                        onClick={() => openEdit(client)}
                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"
                                        title="Kunde bearbeiten"
                                    >
                                        <Building2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => initiateDelete(client.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                        title="Kunde löschen"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* CONFIRM MODAL 1 */}
            <ConfirmModal
                isOpen={confirmStep === 'initial'}
                title="Kunden löschen?"
                message={`Möchtest du den Kunden "${deletingClient?.name}" wirklich löschen?`}
                onConfirm={handleFirstConfirm}
                onCancel={resetDelete}
                type="danger"
                confirmText="Ja, weiter"
                cancelText="Abbrechen"
            />

            {/* CONFIRM MODAL 2 */}
            <ConfirmModal
                isOpen={confirmStep === 'final'}
                title="Endgültig löschen?"
                message={`ACHTUNG: Dies löscht den Kunden "${deletingClient?.name}" UND ALLE zugehörigen Projekte, Aufgaben und Zeiten! Diese Aktion kann nicht rückgängig gemacht werden.`}
                onConfirm={handleFinalConfirm}
                onCancel={resetDelete}
                isLoading={loading}
                type="danger"
                confirmText="Ja, alles löschen"
                cancelText="Zurück"
            />

            {/* EDIT MODAL */}
            <ClientModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                onSave={handleSaveClient}
                client={editingClient}
            />
        </div>
    );
}
