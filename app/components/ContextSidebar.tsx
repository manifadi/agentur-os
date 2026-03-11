import React, { useState } from 'react';
import { Briefcase, Plus, Users, Settings, Pencil, Search, X, ArrowRight } from 'lucide-react';
import { Client, Employee } from '../types';

interface ContextSidebarProps {
    clients: Client[];
    employees: Employee[];
    selectedClient: Client | null;
    setSelectedClient: (client: Client | null) => void;
    openClientModal: (client: Client | null) => void;
    openEmployeeModal: (employee: Employee | null) => void;
    onResetSelection: () => void;
}

export default function ContextSidebar({
    clients,
    employees,
    selectedClient,
    setSelectedClient,
    openClientModal,
    openEmployeeModal,
    onResetSelection
}: ContextSidebarProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <aside className="w-64 bg-subtle border-r border-default flex flex-col h-full overflow-y-auto flex-shrink-0 animate-in slide-in-from-left-4 duration-300">
            <div className="p-4 flex-1 flex flex-col min-h-min">

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-text-primary">Übersicht</h2>
                    <button onClick={onResetSelection} className="text-xs text-text-muted hover:text-text-primary">Reset</button>
                </div>

                {/* Clients Section */}
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">Kunden</h2>
                    <button onClick={() => openClientModal(null)} className="text-text-muted hover:text-text-primary transition bg-surface border border-default rounded-xl p-1 hover:bg-hover"><Plus size={12} /></button>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <input
                        type="text"
                        placeholder="Kunden suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-input border border-default rounded-xl text-xs py-2 pl-8 pr-6 focus:ring-1 focus:ring-accent outline-none transition text-text-primary"
                    />
                    <Search size={12} className="absolute left-2.5 top-2.5 text-text-muted" />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-text-muted hover:text-text-primary">
                            <X size={12} />
                        </button>
                    )}
                </div>

                <nav className="space-y-1 mb-8 flex-1 overflow-y-auto pr-1">
                    <button onClick={onResetSelection} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${!selectedClient ? 'bg-surface border border-default text-text-primary shadow-sm' : 'text-text-secondary hover:bg-hover border border-transparent'}`}>
                        <Briefcase size={14} /> Alle Kunden
                    </button>
                    {filteredClients.map(client => (
                        <div key={client.id} className="group flex items-center rounded-lg transition hover:bg-hover hover:shadow-sm border border-transparent hover:border-default">
                            <button onClick={() => setSelectedClient(client)} className={`flex-1 text-left px-2 py-2 text-xs font-medium flex items-center gap-3 ${selectedClient?.id === client.id ? 'bg-surface text-text-primary rounded-lg shadow-sm border border-default' : 'text-text-secondary border border-transparent'}`}>
                                {client.logo_url ? <div className="w-6 h-6 bg-surface rounded border border-default flex items-center justify-center p-0.5 shrink-0"><img src={client.logo_url} className="w-full h-full object-contain" /></div> : <div className="w-6 h-6 rounded bg-subtle border border-default flex items-center justify-center text-[8px] text-text-muted shrink-0 font-bold">{client.name.substring(0, 2).toUpperCase()}</div>}
                                <span className="truncate">{client.name}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); window.location.href = `/clients/${client.id}`; }} className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-accent"><ArrowRight size={12} /></button>
                        </div>
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="text-center text-text-muted text-xs py-4">Keine Kunden gefunden.</div>
                    )}
                </nav>

                {/* Team Section */}
                <div className="flex justify-between items-center mb-3 mt-4 pt-4 border-t border-default">
                    <h2 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">Team</h2>
                    <button onClick={() => openEmployeeModal(null)} className="text-text-muted hover:text-text-primary transition bg-surface border border-default rounded-xl p-1 hover:bg-hover"><Plus size={12} /></button>
                </div>
                <div className="space-y-1">
                    {employees.map(emp => (
                        <div key={emp.id} className="group flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-hover hover:shadow-sm border border-transparent hover:border-default transition">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-5 h-5 rounded-full bg-subtle border border-default flex items-center justify-center text-[9px] text-text-secondary font-medium shrink-0">{emp.initials}</div>
                                <span className="text-xs text-text-secondary truncate group-hover:text-text-primary">{emp.name}</span>
                            </div>
                            <button onClick={() => openEmployeeModal(emp)} className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text-primary"><Pencil size={10} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
