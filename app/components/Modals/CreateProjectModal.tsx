import React, { useState, useMemo } from 'react';
import { X, Search, Filter, Plus, Check } from 'lucide-react';
import { Client, Employee, Project } from '../../types';

interface CreateProjectModalProps {
    isOpen: boolean;
    clients: Client[];
    employees: Employee[];
    projects: Project[]; // All available projects to join
    joinedProjectIds: string[]; // IDs of projects the user is already a member of
    currentUserId: string;
    onClose: () => void;
    onCreate: (data: { title: string; jobNr: string; clientId: string; pmId: string }) => Promise<void>;
    onJoin: (projectId: string) => Promise<void>;
}

export default function CreateProjectModal({ isOpen, clients, employees, projects, joinedProjectIds, currentUserId, onClose, onCreate, onJoin }: CreateProjectModalProps) {
    const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');

    // Create Mode State
    const [data, setData] = useState({ title: '', jobNr: '', clientId: '', pmId: '' });

    // Join Mode State
    const [search, setSearch] = useState('');
    const [clientFilter, setClientFilter] = useState('');

    if (!isOpen) return null;

    // Filter projects for Join List
    // - Exclude projects where user is already PM (already matches) ?? 
    // - Actually, we should check against "project_members" which is not passed here directly, 
    //   BUT the `projects` list might be the GLOBAL list? 
    //   Wait, AppContext passes `projects`. Is it ALL projects or just user projects?
    //   In ClientAppShell, `projects` state contains ALL projects (fetch `select *`).
    //   So we can filter.
    //   However, we need to know if I am ALREADY a member.
    //   For now, show all projects matching filter. The UserDashboard logic hides them if not joined.
    //   Better: Hide projects I am already a member of? 
    //   I don't have the "members" list here easily unless I pass it or derive it.
    //   Let's just show all projects for now, maybe mark joined ones?

    //   The UserDashboard logic: `isPM || hasTasks`. 
    //   We want to ADD to that list.

    const filteredProjects = projects.filter(p => {
        // We now want to SHOW joined projects to display the checkmark
        // if (joinedProjectIds.includes(p.id)) return false; 
        // if (p.project_manager_id === currentUserId) return false;

        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.job_number.toLowerCase().includes(search.toLowerCase());
        const matchesClient = clientFilter ? p.client_id === clientFilter : true;
        return matchesSearch && matchesClient;
    });

    const isJoined = (project: Project) => {
        return joinedProjectIds.includes(project.id) || project.project_manager_id === currentUserId;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('existing')}
                            className={`pb-2 text-sm font-bold transition relative ${activeTab === 'existing' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Bestehendes Projekt
                        </button>
                        <button
                            onClick={() => setActiveTab('new')}
                            className={`pb-2 text-sm font-bold transition relative ${activeTab === 'new' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Neues Projekt erstellen
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition"><X size={24} className="text-gray-400" /></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {activeTab === 'existing' ? (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1 relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Suchen nach Titel oder Job Nr..."
                                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-lg text-sm transition"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="w-48">
                                    <select
                                        className="w-full px-3 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-lg text-sm transition"
                                        value={clientFilter}
                                        onChange={e => setClientFilter(e.target.value)}
                                    >
                                        <option value="">Alle Kunden</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* List */}
                            <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Projekt</th>
                                            <th className="px-4 py-3 w-32">Status</th>
                                            <th className="px-4 py-3 w-24 text-right">Aktion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredProjects.map(p => {
                                            const joined = isJoined(p);
                                            return (
                                                <tr key={p.id} className="hover:bg-gray-50 transition group">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-900">{p.title}</div>
                                                        <div className="text-xs text-gray-500">{p.job_number} • {p.clients?.name}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{p.status}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => !joined && onJoin(p.id)}
                                                            disabled={joined}
                                                            title={joined ? "Bereits hinzugefügt" : "Hinzufügen"}
                                                            className={`p-1.5 rounded-lg transition inline-flex items-center justify-center ${joined
                                                                ? 'bg-green-100 text-green-700 cursor-default'
                                                                : 'bg-gray-900 text-white hover:bg-gray-800'
                                                                }`}
                                                        >
                                                            {joined ? <Check size={16} /> : <Plus size={16} />}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredProjects.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Keine Projekte gefunden.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div><label className="text-xs font-semibold text-gray-500 uppercase">Kunde</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.clientId} onChange={(e) => setData({ ...data, clientId: e.target.value })}><option value="">Bitte wählen...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div className="grid grid-cols-3 gap-4"><div className="col-span-1"><label className="text-xs font-semibold text-gray-500 uppercase">Job Nr.</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.jobNr} onChange={(e) => setData({ ...data, jobNr: e.target.value })} /></div><div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Projekt Titel</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></div></div>
                            <div><label className="text-xs font-semibold text-gray-500 uppercase">Projektmanager</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.pmId} onChange={(e) => setData({ ...data, pmId: e.target.value })}><option value="">Kein PM zugewiesen</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                            <div className="pt-4 flex gap-3"><button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600">Abbrechen</button><button onClick={() => onCreate(data)} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">Projekt erstellen</button></div>
                        </div>
                    )}
                </div>
            </div>
        </div>

    );
}
