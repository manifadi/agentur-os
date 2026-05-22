import React, { useState, useEffect } from 'react';
import { Employee, Department } from '../../types';
import { supabase } from '../../supabaseClient';
import { Pencil, X, Plus, Shield, ShieldAlert, User, UserPlus, Trash, Building2, Mail, Camera, Send, Clock } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';
import UserAvatar from '../UI/UserAvatar';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import { toast } from 'sonner';

interface AdminUserManagementProps {
    employees: Employee[];
    departments: Department[];
    currentEmployee: Employee;
    onUpdate: () => void;
}

interface UserModalProps {
    isOpen: boolean;
    mode: 'create' | 'edit';
    user: Partial<Employee>;
    departments: Department[];
    agencyPositions: any[]; // Added prop
    onClose: () => void;
    onSave: (user: Partial<Employee>) => Promise<void>;
    isLoading: boolean;
}

function UserModal({ isOpen, mode, user, departments, agencyPositions, onClose, onSave, isLoading }: UserModalProps) {
    const [formData, setFormData] = useState<Partial<Employee>>(user);

    useEffect(() => {
        setFormData(user);
    }, [user, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200 border border-default">
                {/* ... header ... */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-text-primary">{mode === 'create' ? 'Neuen Mitarbeiter anlegen' : 'Mitarbeiter bearbeiten'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-hover text-text-muted"><X size={20} /></button>
                </div>

                <div className="flex flex-col items-center mb-8">
                    <div className="relative group">
                        <UserAvatar
                            src={formData.avatar_url}
                            name={formData.name}
                            initials={formData.initials}
                            size="xl"
                            className="shadow-lg border-4 border-surface ring-1 ring-default"
                        />
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera className="text-white" size={24} />
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        try {
                                            const url = await uploadFileToSupabase(file, 'avatars');
                                            setFormData({ ...formData, avatar_url: url });
                                        } catch (err) {
                                            console.error(err);
                                            toast.error('Upload fehlgeschlagen');
                                        }
                                    }
                                }}
                            />
                        </label>
                    </div>
                    <p className="text-xs text-text-muted mt-2">Klicke zum Ändern</p>
                </div>

                <div className="space-y-4">
                    {/* ... name/initials ... */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Name</label>
                            <input
                                className="w-full p-2.5 bg-input border border-default rounded-xl text-sm text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Max Mustermann"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Kürzel</label>
                            <input
                                className="w-full p-2.5 bg-input border border-default rounded-xl text-sm text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition uppercase"
                                value={formData.initials || ''}
                                onChange={e => setFormData({ ...formData, initials: e.target.value })}
                                placeholder="MM"
                                maxLength={3}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Email (Login)</label>
                            <div className="relative">
                                <input
                                    className="w-full pl-9 p-2.5 bg-input border border-default rounded-xl text-sm text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="name@agentur.com"
                                    type="email"
                                />
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Telefon</label>
                            <input
                                className="w-full p-2.5 bg-input border border-default rounded-xl text-sm text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                value={formData.phone || ''}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+43 123 45678"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Rolle</label>
                            <select
                                className="w-full p-2.5 bg-input border border-default rounded-xl text-sm text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                value={formData.role || 'user'}
                                onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Abteilung</label>
                            <select
                                className="w-full p-2.5 bg-input border border-default rounded-xl text-sm text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                value={formData.department_id || ''}
                                onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                            >
                                <option value="">Keine Abteilung</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Job Titel (Position)</label>
                        <select
                            className="w-full p-2.5 bg-input border border-default rounded-xl text-sm text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                            value={formData.job_title || ''}
                            onChange={e => setFormData({ ...formData, job_title: e.target.value })}
                        >
                            <option value="">Bitte wählen...</option>
                            {agencyPositions.map((p, idx) => (
                                <option key={idx} value={p.title}>
                                    {p.title} ({p.hourly_rate} €)
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-text-muted mt-1">Definiert den Stundensatz für diesen Mitarbeiter.</p>
                    </div>

                    <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                            <label className="block text-xs font-bold text-text-muted uppercase">Wochenplan (Soll-Stunden)</label>
                            <span className="text-xs font-bold text-text-primary tabular-nums">
                                Summe: {(formData.weekly_schedule || [8, 8, 8, 8, 8, 0, 0]).reduce((s: number, h: number) => s + (h || 0), 0)}h
                            </span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day, idx) => {
                                const schedule = formData.weekly_schedule || [8, 8, 8, 8, 8, 0, 0];
                                const val = schedule[idx] ?? 0;
                                return (
                                    <div key={day} className="flex flex-col items-center">
                                        <label className="text-[10px] font-bold uppercase mb-0.5 text-text-muted">{day}</label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={24}
                                            step={0.5}
                                            className="w-full p-1.5 bg-input border border-default rounded-lg text-xs text-center tabular-nums text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition"
                                            value={val}
                                            onChange={e => {
                                                const newSched = [...schedule];
                                                newSched[idx] = parseFloat(e.target.value) || 0;
                                                const sum = newSched.reduce((s, h) => s + h, 0);
                                                setFormData({ ...formData, weekly_schedule: newSched, weekly_hours: sum });
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-xs text-text-muted mt-1.5">
                            Pro Wochentag Soll-Stunden setzen. Z.B. Teilzeit 4-Tage-Woche: 8/8/8/8/0/0/0.
                            <button type="button"
                                onClick={() => setFormData({ ...formData, weekly_schedule: [8, 8, 8, 8, 8, 0, 0], weekly_hours: 40 })}
                                className="ml-2 underline font-semibold text-accent"
                            >Vollzeit (40h)</button>
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-8">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-hover rounded-xl transition">Abbrechen</button>
                    <button
                        onClick={() => onSave(formData)}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-bold text-surface bg-accent hover:opacity-90 rounded-xl transition shadow-sm flex items-center gap-2"
                    >
                        {isLoading && <div className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />}
                        {mode === 'create' ? 'Anlegen' : 'Speichern'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function InviteModal({ isOpen, onClose, organizationId }: { isOpen: boolean; onClose: () => void; organizationId: string }) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !name) return;
        setLoading(true);
        try {
            const res = await fetch('/api/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, organizationId }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Einladung fehlgeschlagen.');
            } else {
                toast.success(`Einladung an ${email} gesendet.`);
                setEmail('');
                setName('');
                onClose();
            }
        } catch {
            toast.error('Netzwerkfehler. Bitte versuche es erneut.');
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    const INPUT = 'w-full px-3 py-2.5 border border-border-strong rounded-xl bg-subtle text-text-primary placeholder:text-text-placeholder focus:bg-surface focus:ring-2 focus:ring-accent outline-none text-sm transition';

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-default">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-text-primary">Mitarbeiter einladen</h3>
                        <p className="text-xs text-text-muted mt-0.5">Sendet eine Einladungs-E-Mail mit Magic Link.</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-hover text-text-muted"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Name</label>
                        <input className={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="Max Mustermann" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">E-Mail</label>
                        <input className={INPUT} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="max@agentur.com" required />
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:bg-hover rounded-xl transition">Abbrechen</button>
                        <button
                            type="submit"
                            disabled={loading || !email || !name}
                            className="px-4 py-2 text-sm font-bold text-surface bg-accent hover:opacity-90 rounded-xl transition shadow-sm flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" /> : <Send size={14} />}
                            Einladung senden
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AdminUserManagement({ employees, departments, currentEmployee, onUpdate }: AdminUserManagementProps) {
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);
    const [agencyPositions, setAgencyPositions] = useState<any[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);

    useEffect(() => {
        const fetchPositions = async () => {
            const { data } = await supabase.from('agency_positions').select('title, hourly_rate').order('title');
            if (data) setAgencyPositions(data);
        };
        fetchPositions();
    }, []);

    // Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit';
        user: Partial<Employee>;
    }>({
        isOpen: false,
        mode: 'create',
        user: { role: 'user' }
    });

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        action: () => void | Promise<void>;
        type: 'danger' | 'info' | 'warning' | 'success';
        showCancel?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Bestätigen',
        cancelText: 'Abbrechen',
        action: async () => { },
        type: 'danger',
        showCancel: true
    });

    useEffect(() => {
        if (currentEmployee.organization_id) {
            fetchRequests();
            onUpdate();
        }
    }, [currentEmployee.organization_id]);

    const fetchRequests = async () => {
        const { data, error } = await supabase.from('registration_requests')
            .select('*')
            .eq('organization_id', currentEmployee.organization_id)
            .eq('status', 'pending');
        if (data) setRequests(data);
    };

    const handleOpenCreate = () => {
        setModalState({ isOpen: true, mode: 'create', user: { role: 'user', organization_id: currentEmployee.organization_id } });
    };

    const handleOpenEdit = (emp: Employee) => {
        setModalState({ isOpen: true, mode: 'edit', user: emp });
    };

    const handleModalSave = async (userData: Partial<Employee>) => {
        setLoading(true);
        if (modalState.mode === 'create') {
            const { error } = await supabase.from('employees').insert([{
                ...userData,
                organization_id: currentEmployee.organization_id
            }]);
            if (error) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Fehler',
                    message: 'Mitarbeiter konnte nicht angelegt werden: ' + error.message,
                    action: async () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); },
                    type: 'danger',
                    showCancel: false,
                    confirmText: 'OK'
                });
            }
        } else {
            // Edit
            const { error } = await supabase.from('employees').update(userData).eq('id', userData.id);
            if (error) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Fehler',
                    message: 'Mitarbeiter konnte nicht aktualisiert werden: ' + error.message,
                    action: async () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); },
                    type: 'danger',
                    showCancel: false,
                    confirmText: 'OK'
                });
            }
        }

        if (!loading) {
            onUpdate();
            setModalState(prev => ({ ...prev, isOpen: false }));
        }
        setLoading(false);
    };

    const handleDeleteEmployee = (id: string, name: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Mitarbeiter löschen',
            message: `Möchten Sie ${name} wirklich löschen? Dies kann nicht rückgängig gemacht werden.`,
            confirmText: 'Löschen',
            action: async () => {
                setLoading(true);
                const { error } = await supabase.from('employees').delete().eq('id', id);
                if (error) {
                    setConfirmModal({
                        isOpen: true,
                        title: 'Fehler beim Löschen',
                        message: error.message,
                        action: async () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); },
                        type: 'danger',
                        showCancel: false,
                        confirmText: 'OK'
                    });
                } else {
                    onUpdate();
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setLoading(false);
            },
            type: 'danger'
        });
    };

    const handleRejectRequest = (req: any) => {
        setConfirmModal({
            isOpen: true,
            title: 'Anfrage ablehnen',
            message: `Möchten Sie die Anfrage von ${req.name} wirklich ablehnen?`,
            confirmText: 'Ja, ablehnen',
            action: async () => {
                setLoading(true);
                const { error } = await supabase.from('registration_requests')
                    .update({ status: 'rejected' })
                    .eq('id', req.id);

                if (error) {
                    setConfirmModal({
                        isOpen: true,
                        title: 'Fehler',
                        message: error.message,
                        action: async () => { setConfirmModal(prev => ({ ...prev, isOpen: false })); },
                        type: 'danger',
                        showCancel: false,
                        confirmText: 'OK'
                    });
                } else {
                    setRequests(prev => prev.filter(r => r.id !== req.id));
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setLoading(false);
            },
            type: 'danger'
        });
    };

    const handleApproveRequest = async (req: any) => {
        setLoading(true);
        const initials = req.name.substring(0, 2).toUpperCase();
        await supabase.from('employees').insert([{
            name: req.name, email: req.email, initials, role: 'user', organization_id: currentEmployee.organization_id
        }]);
        await supabase.from('registration_requests').update({ status: 'approved' }).eq('id', req.id);
        onUpdate();
        setRequests(prev => prev.filter(r => r.id !== req.id));
        setLoading(false);
    };

    // Invited employees = those without a user_id (pre-created but not yet accepted)
    const invitedEmployees = employees.filter(e => !e.user_id && e.email);

    return (
        <div className="space-y-8">
            <InviteModal
                isOpen={showInviteModal}
                onClose={() => { setShowInviteModal(false); onUpdate(); }}
                organizationId={currentEmployee.organization_id || ''}
            />
            <UserModal
                isOpen={modalState.isOpen}
                mode={modalState.mode}
                user={modalState.user}
                departments={departments}
                agencyPositions={agencyPositions}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                onSave={handleModalSave}
                isLoading={loading}
            />

            {/* Registration Requests */}
            {requests.length > 0 && (
                <div className="bg-accent-subtle/30 border border-accent/20 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-accent mb-4 flex items-center gap-2"><ShieldAlert size={20} /> Ausstehende Beitrittsanfragen</h3>
                    <div className="space-y-2">
                        {requests.map(req => (
                            <div key={req.id} className="bg-surface p-3 rounded-lg border border-accent/20 flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-text-primary">{req.name}</div>
                                    <div className="text-sm text-text-secondary">{req.email}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleRejectRequest(req)} className="bg-surface border border-default text-text-secondary px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition">Ablehnen</button>
                                    <button onClick={() => handleApproveRequest(req)} className="bg-accent text-surface px-3 py-1.5 rounded-xl text-xs font-bold hover:opacity-90 transition">Bestätigen</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending invites */}
            {invitedEmployees.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                        <Clock size={15} /> Ausstehende Einladungen ({invitedEmployees.length})
                    </h3>
                    <div className="space-y-2">
                        {invitedEmployees.map(emp => (
                            <div key={emp.id} className="bg-surface p-3 rounded-lg border border-amber-500/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <UserAvatar name={emp.name} initials={emp.initials} size="sm" />
                                    <div>
                                        <div className="text-sm font-semibold text-text-primary">{emp.name}</div>
                                        <div className="text-xs text-text-muted">{emp.email}</div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">Eingeladen</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Employee Management */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-text-primary">Mitarbeiter & Rollen</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-accent text-surface rounded-xl text-sm font-bold hover:opacity-90 transition shadow-sm">
                            <Send size={14} /> Einladen
                        </button>
                        <button onClick={handleOpenCreate} className="flex items-center gap-2 px-3 py-1.5 bg-subtle border border-default text-text-primary rounded-xl text-sm font-bold hover:bg-hover transition">
                            <UserPlus size={16} /> Manuell anlegen
                        </button>
                    </div>
                </div>

                <div className="bg-surface rounded-xl shadow-sm border border-default overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-subtle text-xs uppercase text-text-muted font-bold">
                            <tr>
                                <th className="p-4">Mitarbeiter</th>
                                <th className="p-4">Rolle</th>
                                <th className="p-4">Abteilung</th>
                                <th className="p-4">Email</th>
                                <th className="p-4 text-right">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-default">
                            {employees.map(emp => {
                                const isMe = currentEmployee.id === emp.id;
                                return (
                                <tr key={emp.id} className="hover:bg-hover/50 transition">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar
                                                    src={emp.avatar_url}
                                                    name={emp.name}
                                                    initials={emp.initials}
                                                    size="sm"
                                                />
                                                <div>
                                                    <div className="font-medium text-text-primary">{emp.name}</div>
                                                    {emp.job_title && <div className="text-xs text-text-muted">{emp.job_title}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.role === 'admin' ? 'bg-accent-subtle/30 text-accent' : 'bg-subtle text-text-secondary'}`}>
                                                {emp.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                                                {emp.role === 'admin' ? 'Admin' : 'User'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-text-secondary">{departments.find(d => d.id === emp.department_id)?.name || '-'}</span>
                                        </td>
                                        <td className="p-4 w-64">
                                            <span className="text-text-muted truncate block w-48">{emp.email || '-'}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleOpenEdit(emp)} className="p-1.5 text-text-muted hover:text-accent hover:bg-surface border border-transparent hover:border-default hover:shadow-sm rounded transition" title="Bearbeiten">
                                                    <Pencil size={16} />
                                                </button>
                                                {!isMe && (
                                                    <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="p-1.5 text-text-muted hover:text-red-500 hover:bg-surface border border-transparent hover:border-default hover:shadow-sm rounded transition" title="Mitarbeiter entfernen">
                                                        <Trash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.action}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                cancelText={confirmModal.cancelText}
                showCancel={confirmModal.showCancel}
            />
        </div>
    );
}
