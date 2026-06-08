import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Plus, Check, Edit3 } from 'lucide-react';
import { Client, Employee, Project } from '../../types';
import { toast } from 'sonner';

interface CreateProjectModalProps {
    isOpen: boolean;
    clients: Client[];
    employees: Employee[];
    projects: Project[];
    joinedProjectIds: string[];
    currentUserId: string;
    onClose: () => void;
    onCreate: (data: { title: string; jobNr: string; clientId: string; pmId: string; deadline?: string }) => Promise<void>;
    onJoin: (projectId: string) => Promise<void>;
}

function generateJobNumber(existingProjects: Project[]): string {
    const yearShort = new Date().getFullYear().toString().slice(-2);
    const prefix = `${yearShort}_`;
    const maxNum = existingProjects
        .filter(p => p.job_number?.startsWith(prefix))
        .reduce((max, p) => {
            const parts = p.job_number.split('_');
            const n = parts.length === 2 ? parseInt(parts[1]) || 0 : 0;
            return n > max ? n : max;
        }, 0);
    return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
}

export default function CreateProjectModal({ isOpen, clients, employees, projects, joinedProjectIds, currentUserId, onClose, onCreate, onJoin }: CreateProjectModalProps) {
    const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
    const [data, setData] = useState({ title: '', jobNr: '', clientId: '', pmId: '', deadline: '' });
    const [errors, setErrors] = useState<{ title?: boolean; clientId?: boolean }>({});
    const [editingJobNr, setEditingJobNr] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [clientFilter, setClientFilter] = useState('');

    useEffect(() => {
        if (isOpen && activeTab === 'new') {
            setData(prev => ({ ...prev, jobNr: generateJobNumber(projects) }));
        }
    }, [isOpen, activeTab, projects]);

    if (!isOpen) return null;

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.job_number.toLowerCase().includes(search.toLowerCase());
        const matchesClient = clientFilter ? p.client_id === clientFilter : true;
        return matchesSearch && matchesClient;
    });

    const isJoined = (project: Project) =>
        joinedProjectIds.includes(project.id) || project.project_manager_id === currentUserId;

    const handleCreate = async () => {
        if (!data.title.trim()) { setErrors(e => ({ ...e, title: true })); toast.error('Bitte gib einen Projekt-Titel ein.'); return; }
        if (!data.clientId) { setErrors(e => ({ ...e, clientId: true })); toast.error('Bitte wähle einen Kunden aus.'); return; }
        setSaving(true);
        await onCreate(data);
        setSaving(false);
        setData({ title: '', jobNr: '', clientId: '', pmId: '', deadline: '' });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-default rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-default flex justify-between items-center bg-subtle/50">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('existing')}
                            className={`pb-2 text-sm font-bold transition relative ${activeTab === 'existing' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                        >
                            Bestehendes Projekt
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('new');
                                setData(prev => ({ ...prev, jobNr: generateJobNumber(projects) }));
                            }}
                            className={`pb-2 text-sm font-bold transition relative ${activeTab === 'new' ? 'text-text-primary border-b-2 border-text-primary' : 'text-text-muted hover:text-text-primary'}`}
                        >
                            Neues Projekt
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-hover rounded-full transition">
                        <X size={24} className="text-text-muted hover:text-text-primary" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {activeTab === 'existing' ? (
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Titel oder Job-Nr..."
                                        className="w-full pl-9 pr-4 py-2 bg-subtle border border-transparent focus:border-default text-text-primary rounded-xl text-sm focus:outline-none"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <select
                                    className="w-44 px-3 py-2 bg-subtle border border-transparent focus:border-default text-text-primary rounded-xl text-sm focus:outline-none"
                                    value={clientFilter}
                                    onChange={e => setClientFilter(e.target.value)}
                                >
                                    <option value="">Alle Kunden</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="border border-default rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-subtle text-xs uppercase text-text-secondary font-semibold sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Projekt</th>
                                            <th className="px-4 py-3 w-32">Status</th>
                                            <th className="px-4 py-3 w-24 text-right">Aktion</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {filteredProjects.map(p => {
                                            const joined = isJoined(p);
                                            return (
                                                <tr key={p.id} className="hover:bg-hover transition">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-text-primary">{p.title}</div>
                                                        <div className="text-xs text-text-secondary">{p.job_number} · {p.clients?.name}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 bg-subtle border border-default rounded text-xs text-text-secondary">{p.status}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => !joined && onJoin(p.id)}
                                                            disabled={joined}
                                                            className={`p-1.5 rounded-xl transition inline-flex items-center justify-center ${joined ? 'bg-green-500/10 text-green-600 cursor-default' : 'bg-accent text-accent-text hover:brightness-110'}`}
                                                        >
                                                            {joined ? <Check size={16} /> : <Plus size={16} />}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredProjects.length === 0 && (
                                            <tr><td colSpan={3} className="px-4 py-8 text-center text-text-muted text-sm">Keine Projekte gefunden.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">Kunde *</label>
                                <select
                                    className="w-full rounded-xl border text-sm py-2.5 px-3 bg-subtle text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                                    style={{ borderColor: errors.clientId ? 'var(--color-danger)' : 'var(--border-default)' }}
                                    value={data.clientId}
                                    onChange={e => { setData({ ...data, clientId: e.target.value }); setErrors(er => ({ ...er, clientId: false })); }}
                                    autoFocus
                                >
                                    <option value="">Bitte wählen...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">Projekt Titel *</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border text-sm py-2.5 px-3 bg-subtle text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                                    style={{ borderColor: errors.title ? 'var(--color-danger)' : 'var(--border-default)' }}
                                    value={data.title}
                                    onChange={e => { setData({ ...data, title: e.target.value }); setErrors(er => ({ ...er, title: false })); }}
                                    placeholder="z.B. Website Relaunch 2025"
                                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">Projektmanager</label>
                                    <select
                                        className="w-full rounded-xl border border-default text-sm py-2.5 px-3 bg-subtle text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                                        value={data.pmId}
                                        onChange={e => setData({ ...data, pmId: e.target.value })}
                                    >
                                        <option value="">Kein PM</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">Deadline</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-default text-sm py-2.5 px-3 bg-subtle text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                                        value={data.deadline}
                                        onChange={e => setData({ ...data, deadline: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">Projektnummer</label>
                                <div className="flex items-center gap-2">
                                    {editingJobNr ? (
                                        <input
                                            type="text"
                                            className="flex-1 rounded-xl border border-accent text-sm py-2.5 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent outline-none font-mono"
                                            value={data.jobNr}
                                            onChange={e => setData({ ...data, jobNr: e.target.value })}
                                            autoFocus
                                            onBlur={() => setEditingJobNr(false)}
                                            onKeyDown={e => e.key === 'Enter' && setEditingJobNr(false)}
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-subtle border border-default flex-1">
                                            <span className="font-mono text-sm text-text-primary font-bold flex-1">{data.jobNr}</span>
                                            <button
                                                onClick={() => setEditingJobNr(true)}
                                                className="p-1 text-text-placeholder hover:text-accent rounded transition"
                                                title="Nummer anpassen"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[11px] text-text-placeholder mt-1">Automatisch generiert · zum Ändern auf ✎ klicken</p>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-default text-sm text-text-secondary hover:bg-hover transition">
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={saving}
                                    className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text text-sm font-bold hover:brightness-110 transition disabled:opacity-50"
                                >
                                    {saving ? 'Erstelle...' : 'Projekt anlegen'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
