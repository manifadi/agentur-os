import React, { useState, useEffect } from 'react';
import { Employee, Department } from '../../types';
import { supabase } from '../../supabaseClient';
import { Pencil, X, Plus, Shield, ShieldAlert, User, UserPlus, Trash, Building2, Mail } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';

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
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
                {/* ... header ... */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">{mode === 'create' ? 'Neuen Mitarbeiter anlegen' : 'Mitarbeiter bearbeiten'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 text-gray-500"><X size={20} /></button>
                </div>

                <div className="space-y-4">
                    {/* ... name/initials ... */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Name</label>
                            <input
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Max Mustermann"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Kürzel</label>
                            <input
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition uppercase"
                                value={formData.initials || ''}
                                onChange={e => setFormData({ ...formData, initials: e.target.value })}
                                placeholder="MM"
                                maxLength={3}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Email (Login)</label>
                            <div className="relative">
                                <input
                                    className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="name@agentur.com"
                                    type="email"
                                />
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Telefon</label>
                            <input
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={formData.phone || ''}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+43 123 45678"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Rolle</label>
                            <select
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={formData.role || 'user'}
                                onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Abteilung</label>
                            <select
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                                value={formData.department_id || ''}
                                onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                            >
                                <option value="">Keine Abteilung</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Job Titel (Position)</label>
                        <select
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
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
                        <p className="text-xs text-gray-400 mt-1">Definiert den Stundensatz für diesen Mitarbeiter.</p>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-8">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Abbrechen</button>
                    <button
                        onClick={() => onSave(formData)}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm flex items-center gap-2"
                    >
                        {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {mode === 'create' ? 'Anlegen' : 'Speichern'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUserManagement({ employees, departments, currentEmployee, onUpdate }: AdminUserManagementProps) {
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);
    const [agencyPositions, setAgencyPositions] = useState<any[]>([]);

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
        }
    }, [currentEmployee, currentEmployee.organization_id]);

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

    return (
        <div className="space-y-8">
            <UserModal
                isOpen={modalState.isOpen}
                mode={modalState.mode}
                user={modalState.user}
                departments={departments}
                agencyPositions={agencyPositions} // Passed prop
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                onSave={handleModalSave}
                isLoading={loading}
            />

            {/* Registration Requests */}
            {requests.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2"><ShieldAlert size={20} /> Ausstehende Registrierungen</h3>
                    <div className="space-y-2">
                        {requests.map(req => (
                            <div key={req.id} className="bg-white p-3 rounded-lg border border-blue-100 flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-gray-900">{req.name}</div>
                                    <div className="text-sm text-gray-500">{req.email}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleRejectRequest(req)} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition">Ablehnen</button>
                                    <button onClick={() => handleApproveRequest(req)} className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition">Bestätigen</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Employee Management */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Mitarbeiter & Rollen</h2>
                    <button onClick={handleOpenCreate} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition shadow-sm">
                        <UserPlus size={16} /> Mitarbeiter anlegen
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
                            <tr>
                                <th className="p-4">Mitarbeiter</th>
                                <th className="p-4">Rolle</th>
                                <th className="p-4">Abteilung</th>
                                <th className="p-4">Email</th>
                                <th className="p-4 text-right">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {employees.map(emp => {
                                const isMe = currentEmployee.id === emp.id;
                                return (
                                    <tr key={emp.id} className="hover:bg-gray-50/50 transition">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{emp.initials}</div>
                                                <div>
                                                    <div className="font-medium text-gray-900">{emp.name}</div>
                                                    {emp.job_title && <div className="text-xs text-gray-400">{emp.job_title}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {emp.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                                                {emp.role === 'admin' ? 'Admin' : 'User'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-gray-500">{departments.find(d => d.id === emp.department_id)?.name || '-'}</span>
                                        </td>
                                        <td className="p-4 w-64">
                                            <span className="text-gray-400 truncate block w-48">{emp.email || '-'}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleOpenEdit(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Bearbeiten">
                                                    <Pencil size={16} />
                                                </button>
                                                {!isMe && (
                                                    <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Mitarbeiter entfernen">
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
