import React, { useState, useEffect } from 'react';
import { Employee, Department } from '../../types';
import { supabase } from '../../supabaseClient';
import { Pencil, Save, X, Plus, Shield, ShieldAlert, User, UserPlus, Trash } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';

interface AdminUserManagementProps {
    employees: Employee[];
    departments: Department[];
    currentEmployee: Employee;
    onUpdate: () => void;
}



// ... (in imports)

export default function AdminUserManagement({ employees, departments, currentEmployee, onUpdate }: AdminUserManagementProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Employee>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ role: 'user' });
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        action: () => Promise<void>;
        type: 'danger' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Bestätigen',
        cancelText: 'Abbrechen',
        action: async () => { },
        type: 'danger'
    });

    useEffect(() => {
        if (currentEmployee.organization_id) {
            fetchRequests();
        }
    }, [currentEmployee]);

    const fetchRequests = async () => {
        console.log('AdminUserManagement: Fetching requests for org', currentEmployee.organization_id);
        const { data, error } = await supabase.from('registration_requests')
            .select('*')
            .eq('organization_id', currentEmployee.organization_id)
            .eq('status', 'pending');

        if (error) {
            console.error('Error fetching requests:', error);
        } else {
            console.log('Requests found:', data?.length);
            if (data) setRequests(data);
        }
    };

    const handleApproveRequest = async (req: any) => {
        // Optimistic UI Update
        setRequests(prev => prev.filter(r => r.id !== req.id));
        setLoading(true);

        console.warn('[APPROVE] Starting approval for:', req);

        // 0. Check if employee already exists (Idempotency)
        const { data: existing } = await supabase.from('employees')
            .select('id')
            .eq('email', req.email)
            .eq('organization_id', currentEmployee.organization_id)
            .single();

        if (existing) {
            console.warn('[APPROVE] Employee already exists, skipping creation.');
        } else {
            const initials = req.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

            // 1. Create Employee
            console.log('Creating employee...');
            const { data: newEmp, error: empError } = await supabase.from('employees').insert([{
                name: req.name,
                email: req.email,
                initials: initials,
                organization_id: currentEmployee.organization_id,
                role: 'user'
            }]).select();

            if (empError) {
                console.error('[APPROVE] Error creating employee:', empError);
                alert('Fehler beim Erstellen des Mitarbeiters: ' + empError.message);
                fetchRequests(); // Rollback
                setLoading(false);
                return;
            }
            console.log('Employee created:', newEmp);
        }

        // 2. Update Request Status
        console.warn('[APPROVE] PRE-UPDATE Status:', req.status, 'for ID:', req.id);

        const { error: reqError, data: updatedReq } = await supabase.from('registration_requests')
            .update({ status: 'approved' })
            .eq('id', req.id)
            .select();

        if (reqError) {
            console.error('[APPROVE] Error updating request:', reqError);
            alert('Mitarbeiter angelegt, aber Status konnte nicht aktualisiert werden. Bitte RLS prüfen.');
        } else {
            console.warn('[APPROVE] POST-UPDATE Result:', updatedReq);
        }

        onUpdate();
        setLoading(false);
        console.log('Approve sequence complete.');
    };

    const handleCreate = async () => {
        setLoading(true);
        const { error } = await supabase.from('employees').insert([{
            ...newEmployee,
            organization_id: currentEmployee.organization_id
        }]);

        if (error) {
            alert('Fehler beim Erstellen: ' + error.message);
        } else {
            setIsCreating(false);
            setNewEmployee({ role: 'user' });
            onUpdate();
        }
        setLoading(false);
    };

    const startEdit = (emp: Employee) => {
        setEditingId(emp.id);
        setEditForm({
            name: emp.name,
            initials: emp.initials,
            email: emp.email,
            role: emp.role,
            department_id: emp.department_id,
            job_title: emp.job_title
        });
    };

    const handleSave = async () => {
        if (!editingId) return;
        setLoading(true);
        const { error } = await supabase.from('employees').update(editForm).eq('id', editingId);
        if (error) {
            alert('Fehler beim Speichern: ' + error.message);
        } else {
            setEditingId(null);
            setEditForm({});
            onUpdate();
        }
        setLoading(false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleDeleteEmployee = async (id: string, name: string) => {
        if (!confirm(`Möchten Sie ${name} wirklich löschen?`)) return;
        setLoading(true);
        await supabase.from('employees').delete().eq('id', id);
        onUpdate();
        setLoading(false);
    };

    return (
        <div className="space-y-8">
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
                                    <button onClick={() => handleApproveRequest(req)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition">Bestätigen</button>
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
                    <button onClick={() => setIsCreating(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition ${isCreating ? 'bg-gray-100 text-gray-500' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                        <UserPlus size={16} /> Mitarbeiter anlegen
                    </button>
                </div>

                {isCreating && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 animate-in slide-in-from-top-2">
                        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Neuen Mitarbeiter anlegen</h3>
                        <div className="flex gap-3 items-start">
                            <div className="flex-1 space-y-2">
                                <input placeholder="Name" className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={newEmployee.name || ''} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} />
                            </div>
                            <div className="w-48 space-y-2">
                                <input placeholder="Job Titel" className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={newEmployee.job_title || ''} onChange={e => setNewEmployee({ ...newEmployee, job_title: e.target.value })} />
                            </div>
                            <div className="w-32 space-y-2">
                                <input placeholder="Kürzel (z.B. MF)" maxLength={2} className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" value={newEmployee.initials || ''} onChange={e => setNewEmployee({ ...newEmployee, initials: e.target.value })} />
                            </div>
                            <div className="w-64 space-y-2">
                                <input placeholder="Email (für Login)" className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={newEmployee.email || ''} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} />
                            </div>
                            <button onClick={handleCreate} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition" title="Speichern"><Plus size={20} /></button>
                            <button onClick={() => setIsCreating(false)} className="bg-gray-200 text-gray-500 p-2 rounded-lg hover:bg-gray-300 transition" title="Abbrechen"><X size={20} /></button>
                        </div>
                    </div>
                )}

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
                                const isEditing = editingId === emp.id;
                                const isMe = currentEmployee.id === emp.id;
                                return (
                                    <tr key={emp.id} className="hover:bg-gray-50/50 transition">
                                        <td className="p-4">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex gap-2">
                                                        <input className="border rounded px-2 py-1 w-full text-sm" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                                        <input className="border rounded px-2 py-1 w-20 text-sm" value={editForm.initials || ''} onChange={e => setEditForm({ ...editForm, initials: e.target.value })} />
                                                    </div>
                                                    <input placeholder="Job Titel" className="border rounded px-2 py-1 w-full text-xs text-gray-500" value={editForm.job_title || ''} onChange={e => setEditForm({ ...editForm, job_title: e.target.value })} />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{emp.initials}</div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{emp.name}</div>
                                                        {emp.job_title && <div className="text-xs text-gray-400">{emp.job_title}</div>}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {isEditing ? (
                                                <select className="border rounded px-2 py-1 text-sm bg-white" value={editForm.role || 'user'} onChange={e => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'user' })}>
                                                    <option value="user">User</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {emp.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                                                    {emp.role === 'admin' ? 'Admin' : 'User'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {isEditing ? (
                                                <select className="border rounded px-2 py-1 text-sm bg-white" value={editForm.department_id || ''} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}>
                                                    <option value="">Keine</option>
                                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                </select>
                                            ) : (
                                                <span className="text-gray-500">{departments.find(d => d.id === emp.department_id)?.name || '-'}</span>
                                            )}
                                        </td>
                                        <td className="p-4 w-64">
                                            {isEditing ? (
                                                <input className="border rounded px-2 py-1 w-full text-sm" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                            ) : (
                                                <span className="text-gray-400 truncate block w-48">{emp.email || '-'}</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={handleSave} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save size={16} /></button>
                                                    <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={16} /></button>
                                                </div>
                                            ) : (
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => startEdit(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition">
                                                        <Pencil size={16} />
                                                    </button>
                                                    {!isMe && (
                                                        <button
                                                            onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                            title="Mitarbeiter entfernen"
                                                        >
                                                            <Trash size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
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
            />
        </div>
    );
}
