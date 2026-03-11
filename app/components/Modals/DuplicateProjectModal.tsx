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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-default rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-default flex justify-between items-center bg-surface">
                    <h2 className="font-bold text-text-primary">Projekt kopieren</h2>
                    <button onClick={onClose} className="p-2 hover:bg-hover rounded-full transition">
                        <X size={20} className="text-text-muted hover:text-text-primary" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-text-secondary">
                        Wähle den Ziel-Kunden aus, für den das Projekt kopiert werden soll. Alle Kalkulationen (Sektionen & Positionen) werden übernommen.
                    </p>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input
                            type="text"
                            placeholder="Kunden suchen..."
                            className="w-full pl-10 pr-4 py-2 bg-subtle border border-default rounded-xl text-sm focus:ring-2 focus:ring-accent-subtle focus:border-accent text-text-primary transition-all outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                        {filteredClients.map(client => (
                            <button
                                key={client.id}
                                onClick={() => setSelectedId(client.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedId === client.id ? 'bg-accent-subtle border-accent' : 'hover:bg-hover border-transparent'} border text-left`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selectedId === client.id ? 'bg-accent text-accent-text' : 'bg-subtle border border-default text-text-muted'}`}>
                                    <User size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-bold truncate ${selectedId === client.id ? 'text-text-primary' : 'text-text-primary'}`}>{client.name}</div>
                                </div>
                                {selectedId === client.id && (
                                    <div className="w-2 h-2 bg-accent rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-default flex justify-end gap-3 bg-subtle/50">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-hover transition">
                        Abbrechen
                    </button>
                    <button
                        onClick={() => selectedId && onConfirm(selectedId)}
                        disabled={!selectedId}
                        className="px-6 py-2 bg-accent text-accent-text rounded-xl text-sm font-bold hover:brightness-110 shadow-default disabled:opacity-50 transition"
                    >
                        Kopie erstellen
                    </button>
                </div>
            </div>
        </div>
    );
}
