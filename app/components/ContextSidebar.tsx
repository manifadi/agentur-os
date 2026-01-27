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
        <aside className="w-64 bg-gray-50/50 border-r border-gray-200 flex flex-col h-full overflow-y-auto flex-shrink-0 animate-in slide-in-from-left-4 duration-300">
            <div className="p-4 flex-1 flex flex-col min-h-min">

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-900">Übersicht</h2>
                    <button onClick={onResetSelection} className="text-xs text-gray-400 hover:text-gray-900">Reset</button>
                </div>

                {/* Clients Section */}
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">Kunden</h2>
                    <button onClick={() => openClientModal(null)} className="text-gray-400 hover:text-gray-900 transition bg-white border border-gray-200 rounded-xl p-1 hover:bg-gray-50"><Plus size={12} /></button>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <input
                        type="text"
                        placeholder="Kunden suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl text-xs py-2 pl-8 pr-6 focus:ring-1 focus:ring-gray-300 outline-none transition"
                    />
                    <Search size={12} className="absolute left-2.5 top-2.5 text-gray-400" />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                            <X size={12} />
                        </button>
                    )}
                </div>

                <nav className="space-y-1 mb-8 flex-1 overflow-y-auto pr-1">
                    <button onClick={onResetSelection} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${!selectedClient ? 'bg-white border border-gray-200 text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                        <Briefcase size={14} /> Alle Kunden
                    </button>
                    {filteredClients.map(client => (
                        <div key={client.id} className="group flex items-center rounded-lg transition hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100">
                            <button onClick={() => setSelectedClient(client)} className={`flex-1 text-left px-2 py-2 text-xs font-medium flex items-center gap-3 ${selectedClient?.id === client.id ? 'bg-white text-gray-900 rounded-lg shadow-sm border-gray-200' : 'text-gray-600'}`}>
                                {client.logo_url ? <div className="w-6 h-6 bg-white rounded border border-gray-100 flex items-center justify-center p-0.5 shrink-0"><img src={client.logo_url} className="w-full h-full object-contain" /></div> : <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-[8px] text-gray-400 shrink-0 font-bold">{client.name.substring(0, 2).toUpperCase()}</div>}
                                <span className="truncate">{client.name}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); window.location.href = `/clients/${client.id}`; }} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-blue-600"><ArrowRight size={12} /></button>
                        </div>
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="text-center text-gray-400 text-xs py-4">Keine Kunden gefunden.</div>
                    )}
                </nav>

                {/* Team Section */}
                <div className="flex justify-between items-center mb-3 mt-4 pt-4 border-t border-gray-200">
                    <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">Team</h2>
                    <button onClick={() => openEmployeeModal(null)} className="text-gray-400 hover:text-gray-900 transition bg-white border border-gray-200 rounded-xl p-1 hover:bg-gray-50"><Plus size={12} /></button>
                </div>
                <div className="space-y-1">
                    {employees.map(emp => (
                        <div key={emp.id} className="group flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[9px] text-gray-500 font-medium shrink-0">{emp.initials}</div>
                                <span className="text-xs text-gray-500 truncate group-hover:text-gray-900">{emp.name}</span>
                            </div>
                            <button onClick={() => openEmployeeModal(emp)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-600"><Pencil size={10} /></button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
