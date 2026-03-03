import React, { useState } from 'react';
import { X, Search, User } from 'lucide-react';
import { Client } from '../../types';

interface DuplicateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (targetClientId: string) => void;
    clients: Client[];
    currentClientId?: string;
}

export default function DuplicateProjectModal({ isOpen, onClose, onConfirm, clients, currentClientId }: DuplicateProjectModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState(currentClientId || '');

    if (!isOpen) return null;

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                    <h2 className="font-bold text-gray-900">Projekt kopieren</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500">
                        Wähle den Ziel-Kunden aus, für den das Projekt kopiert werden soll. Alle Kalkulationen (Sektionen & Positionen) werden übernommen.
                    </p>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Kunden suchen..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                        {filteredClients.map(client => (
                            <button
                                key={client.id}
                                onClick={() => setSelectedId(client.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedId === client.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'} border text-left`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selectedId === client.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    <User size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-bold truncate ${selectedId === client.id ? 'text-blue-700' : 'text-gray-900'}`}>{client.name}</div>
                                </div>
                                {selectedId === client.id && (
                                    <div className="w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition">
                        Abbrechen
                    </button>
                    <button
                        onClick={() => selectedId && onConfirm(selectedId)}
                        disabled={!selectedId}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 transition"
                    >
                        Kopie erstellen
                    </button>
                </div>
            </div>
        </div>
    );
}
