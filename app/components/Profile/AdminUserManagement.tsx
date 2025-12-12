import React, { useState } from 'react';
import { Employee, Department } from '../../types';
import { supabase } from '../../supabaseClient';
import { Pencil, Save, X, Plus, Shield, ShieldAlert, User } from 'lucide-react';

interface AdminUserManagementProps {
    employees: Employee[];
    departments: Department[];
    currentEmployee: Employee;
    onUpdate: () => void;
}

export default function AdminUserManagement({ employees, departments, currentEmployee, onUpdate }: AdminUserManagementProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Employee>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({ role: 'user' });
    const [loading, setLoading] = useState(false);

    // Initial edit state setup
    const startEdit = (emp: Employee) => {
        setEditingId(emp.id);
        setEditForm({ ...emp });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleSave = async () => {
        if (!editingId) return;
        setLoading(true);
        const { error } = await supabase.from('employees').update(editForm).eq('id', editingId);
        setLoading(false);
        if (!error) {
            setEditingId(null);
            onUpdate();
        } else {
            alert('Fehler beim Speichern: ' + error.message);
        }
    };

    const handleCreate = async () => {
        if (!newEmployee.name || !newEmployee.initials) return alert('Name und Kürzel sind Pflichtfelder.');
        setLoading(true);
        const { error } = await supabase.from('employees').insert([newEmployee]);
        setLoading(false);
        if (!error) {
            setIsCreating(false);
            setNewEmployee({ role: 'user' });
            onUpdate();
        } else {
            alert('Fehler beim Erstellen: ' + error.message);
        }
    };

    if (currentEmployee.role !== 'admin') {
        return (
            <div className="p-8 text-center text-gray-500 bg-red-50 rounded-xl border border-red-100">
                <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
                <h2 className="text-lg font-bold text-red-900">Zugriff verweigert</h2>
                <p className="text-sm">Du hast keine Berechtigung, diesen Bereich zu sehen.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Team Verwaltung</h2>
                    <p className="text-sm text-gray-500">Mitarbeiter, Rollen und Abteilungen verwalten.</p>
                </div>
                <button onClick={() => setIsCreating(true)} className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition">
                    <Plus size={16} /> Mitarbeiter hinzufügen
                </button>
            </div>

            {isCreating && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Neuen Mitarbeiter anlegen</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <input placeholder="Name" className="p-2 text-sm border rounded-lg" value={newEmployee.name || ''} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} />
                        <input placeholder="Kürzel (z.B. MF)" className="p-2 text-sm border rounded-lg" value={newEmployee.initials || ''} onChange={e => setNewEmployee({ ...newEmployee, initials: e.target.value })} />
                        <input placeholder="E-Mail" className="p-2 text-sm border rounded-lg" value={newEmployee.email || ''} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} />
                        <select className="p-2 text-sm border rounded-lg" value={newEmployee.department_id || ''} onChange={e => setNewEmployee({ ...newEmployee, department_id: e.target.value })}>
                            <option value="">Keine Abteilung</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select className="p-2 text-sm border rounded-lg" value={newEmployee.role || 'user'} onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value as 'admin' | 'user' })}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setIsCreating(false)} className="text-gray-500 text-sm hover:text-gray-900 px-3 py-2">Abbrechen</button>
                        <button onClick={handleCreate} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">{loading ? 'Speichern...' : 'Anlegen'}</button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Rolle</th>
                            <th className="p-4">Abteilung</th>
                            <th className="p-4">E-Mail</th>
                            <th className="p-4 text-right">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {employees.map(emp => {
                            const isEditing = editingId === emp.id;
                            return (
                                <tr key={emp.id} className="hover:bg-gray-50/50 transition">
                                    <td className="p-4">
                                        {isEditing ? (
                                            <div className="flex gap-2">
                                                <input className="border rounded px-2 py-1 w-full text-sm" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                                <input className="border rounded px-2 py-1 w-20 text-sm" value={editForm.initials || ''} onChange={e => setEditForm({ ...editForm, initials: e.target.value })} />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{emp.initials}</div>
                                                <span className="font-medium text-gray-900">{emp.name}</span>
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
                                            <button onClick={() => startEdit(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Pencil size={16} /></button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
