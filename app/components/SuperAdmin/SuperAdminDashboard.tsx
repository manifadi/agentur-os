import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Organization, RegistrationRequest, Employee } from '../../types';
import { Trash, Check, X, Building, UserPlus, Shield, ArrowLeft, Users, Settings } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';

export default function SuperAdminDashboard() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [requests, setRequests] = useState<RegistrationRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [newOrgName, setNewOrgName] = useState('');

    // View State
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: orgs } = await supabase.from('organizations').select('*').order('name');
        if (orgs) setOrganizations(orgs);

        const { data: reqs } = await supabase.from('registration_requests').select('*').eq('status', 'pending');
        if (reqs) setRequests(reqs);

        // Fetch ALL employees for Super Admin using RPC to bypass RLS
        const { data: emps, error } = await supabase.rpc('get_all_employees_super_admin');
        if (error) console.error('Error fetching employees:', error);
        if (emps) {
            console.log('Fetched Employees:', emps);
            setEmployees(emps);
        }
    };

    const handleCreateOrg = async () => {
        if (!newOrgName) return;
        const { error } = await supabase.from('organizations').insert([{ name: newOrgName }]);
        if (!error) {
            setNewOrgName('');
            fetchData();
        }
    };

    // Derived state
    console.log('Selected Org ID:', selectedOrg?.id);
    const currentOrgEmployees = selectedOrg ? employees.filter(e => {
        const match = e.organization_id === selectedOrg.id;
        if (!match && e.organization_id === selectedOrg.id) console.log('Mismatch check:', e.organization_id, selectedOrg.id); // Sanity check
        return match;
    }) : [];
    console.log('Filtered Employees for Org:', currentOrgEmployees);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 text-gray-900">
                <Shield size={32} className="text-blue-600" />
                Super Admin Dashboard
            </h1>

            {selectedOrg ? (
                /* === AGENCY DETAIL VIEW === */
                <div className="space-y-6">
                    <button
                        onClick={() => setSelectedOrg(null)}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium"
                    >
                        <ArrowLeft size={20} /> Zurück zur Übersicht
                    </button>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
                                    <Building size={28} className="text-gray-400" />
                                    {selectedOrg.name}
                                </h2>
                                <p className="text-gray-500">Organisations-ID: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs select-all text-gray-900">{selectedOrg.id}</code></p>
                            </div>
                            <div className="bg-blue-50 text-blue-700 font-bold px-4 py-2 rounded-xl text-sm">
                                {currentOrgEmployees.length} Mitarbeiter
                            </div>
                        </div>

                        {/* EMPLOYEES LIST & ROLE MANAGEMENT */}
                        <div className="border-t border-gray-100 pt-8">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Users size={20} className="text-gray-500" />
                                Mitarbeiter & Rollen
                            </h3>

                            <div className="grid gap-4">
                                {currentOrgEmployees.map(emp => (
                                    <EmployeeRow
                                        key={emp.id}
                                        employee={emp}
                                        onUpdate={fetchData}
                                    />
                                ))}
                                {currentOrgEmployees.length === 0 && (
                                    <p className="text-gray-400 italic text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        Noch keine Mitarbeiter in dieser Organisation.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* === OVERVIEW === */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* ORGANIZATIONS LIST */}
                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Building size={20} className="text-gray-500" />
                            Organisationen ({organizations.length})
                        </h2>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                placeholder="Neue Organisation..."
                                className="flex-1 p-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                value={newOrgName}
                                onChange={e => setNewOrgName(e.target.value)}
                            />
                            <button onClick={handleCreateOrg} className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black transition shadow-sm">
                                Erstellen
                            </button>
                        </div>

                        <div className="space-y-3">
                            {organizations.map(org => {
                                const memberCount = employees.filter(e => e.organization_id === org.id).length;
                                return (
                                    <div
                                        key={org.id}
                                        onClick={() => setSelectedOrg(org)}
                                        className="flex justify-between items-center p-4 bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 rounded-xl cursor-pointer transition-all group"
                                    >
                                        <span className="font-bold text-gray-700 group-hover:text-gray-900">{org.name}</span>
                                        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-lg group-hover:bg-white">{memberCount} Mitarbeiter</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* APPROVALS */}
                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <UserPlus size={20} className="text-gray-500" />
                            Offene Anfragen ({requests.length})
                        </h2>

                        <div className="space-y-4">
                            {requests.length === 0 ? <p className="text-gray-400 italic text-center py-8">Keine offenen Anfragen.</p> : null}
                            {requests.map(req => (
                                <RequestItem
                                    key={req.id}
                                    request={req}
                                    organizations={organizations}
                                    onUpdate={fetchData}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

// === SUB-COMPONENTS ===

function EmployeeRow({ employee, onUpdate }: { employee: Employee, onUpdate: () => void }) {
    const [loading, setLoading] = useState(false);

    const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRole = e.target.value;
        setLoading(true);

        // Use RPC to bypass RLS for role updates across organizations
        const { error } = await supabase.rpc('update_employee_role_super_admin', {
            target_employee_id: employee.id,
            new_role: newRole
        });

        if (error) {
            console.error('Error updating role:', error);
            alert('Fehler beim Aktualisieren der Rolle: ' + error.message);
        } else {
            onUpdate();
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-all">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-bold text-gray-500 text-sm border border-white shadow-sm">
                    {employee.initials}
                </div>
                <div>
                    <div className="font-bold text-gray-900">{employee.name}</div>
                    <div className="text-xs text-gray-500">{employee.email}</div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <select
                        value={employee.role || 'user'}
                        onChange={handleRoleChange}
                        disabled={loading}
                        className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold border cursor-pointer outline-none transition-all ${employee.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            } ${loading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                    {/* Small arrow icon overlay could go here */}
                </div>
            </div>
        </div>
    );
}

function RequestItem({ request, organizations, onUpdate }: { request: RegistrationRequest, organizations: Organization[], onUpdate: () => void }) {
    // ... [EXISTING REQUEST ITEM CODE - KEPT IDENTICAL] ...
    // Since I'm rewriting the whole file, I need to include this code again.
    // I will copy the previous logic exactly to maintain functionality.

    const [selectedOrgId, setSelectedOrgId] = useState(request.organization_id || '');
    const [loading, setLoading] = useState(false);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type: 'danger' | 'info' | 'warning' | 'success';
        confirmText?: string;
        showCancel?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'info'
    });

    const handleOrgChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedOrgId(newId);
        await supabase.from('registration_requests').update({ organization_id: newId }).eq('id', request.id);
        onUpdate();
    };

    const handleApprove = async () => {
        if (!selectedOrgId) {
            setConfirmConfig({
                isOpen: true,
                title: 'Organisation fehlt',
                message: 'Bitte weise dem Benutzer zuerst eine Organisation zu, bevor du ihn bestätigst.',
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'warning',
                confirmText: 'Verstanden',
                showCancel: false
            });
            return;
        }
        setLoading(true);

        const initials = request.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        const { error: rpcError } = await supabase.rpc('approve_registration_request', {
            request_id: request.id,
            target_org_id: selectedOrgId,
            emp_name: request.name,
            emp_email: request.email,
            emp_initials: initials
        });

        if (rpcError) {
            console.error('RPC Error:', rpcError);
            setConfirmConfig({
                isOpen: true,
                title: 'Systemfehler',
                message: 'Fehler beim Bestätigen: ' + rpcError.message,
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'danger',
                confirmText: 'OK',
                showCancel: false
            });
            setLoading(false);
            return;
        }

        onUpdate();
    };

    const handleReject = async () => {
        setConfirmConfig({
            isOpen: true,
            title: 'Anfrage ablehnen?',
            message: `Möchtest du die Anfrage von ${request.name} wirklich ablehnen?`,
            onConfirm: async () => {
                setLoading(true);
                await supabase.from('registration_requests').update({ status: 'rejected' }).eq('id', request.id);
                onUpdate();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            },
            type: 'danger',
            confirmText: 'Ablehnen'
        });
    };

    return (
        <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div>
                    <div className="font-bold text-lg">{request.name}</div>
                    <div className="text-sm text-gray-500">{request.email}</div>
                    {request.company_name && <div className="text-xs text-gray-400 mt-1">Anfrage für: {request.company_name}</div>}
                </div>
                <div className="w-48">
                    <select
                        className={`w-full text-xs font-bold p-2 rounded-lg border outline-none ${selectedOrgId ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'}`}
                        value={selectedOrgId}
                        onChange={handleOrgChange}
                    >
                        <option value="">-- Nicht zugewiesen --</option>
                        {organizations.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleApprove}
                    disabled={loading || !selectedOrgId}
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg font-bold hover:bg-green-600 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                    <Check size={16} /> Bestätigen
                </button>
                <button
                    onClick={handleReject}
                    disabled={loading}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                    <X size={16} /> Ablehnen
                </button>
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                type={confirmConfig.type}
                confirmText={confirmConfig.confirmText}
                showCancel={confirmConfig.showCancel}
            />
        </div>
    );
}
