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
        if (emps) setEmployees(emps);
    };

    const handleCreateOrg = async () => {
        if (!newOrgName) return;
        const { error } = await supabase.from('organizations').insert([{ name: newOrgName }]);
        if (!error) {
            setNewOrgName('');
            fetchData();
        }
    };

    const currentOrgEmployees = selectedOrg
        ? employees.filter(e => e.organization_id === selectedOrg.id)
        : [];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3 text-text-primary">
                <Shield size={32} className="text-accent" />
                Super Admin Dashboard
            </h1>

            {selectedOrg ? (
                /* === AGENCY DETAIL VIEW === */
                <div className="space-y-6">
                    <button
                        onClick={() => setSelectedOrg(null)}
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors font-medium"
                    >
                        <ArrowLeft size={20} /> Zurück zur Übersicht
                    </button>

                    <div className="bg-surface rounded-2xl shadow-sm border border-default p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-3 mb-2 text-text-primary">
                                    <Building size={28} className="text-text-muted" />
                                    {selectedOrg.name}
                                </h2>
                                <p className="text-text-secondary">Organisations-ID: <code className="bg-subtle border border-default p-1 rounded text-xs select-all text-text-primary">{selectedOrg.id}</code></p>
                            </div>
                            <div className="bg-accent-subtle/30 text-accent font-bold px-4 py-2 rounded-xl text-sm">
                                {currentOrgEmployees.length} Mitarbeiter
                            </div>
                        </div>

                        {/* EMPLOYEES LIST & ROLE MANAGEMENT */}
                        <div className="border-t border-default pt-8">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-text-primary">
                                <Users size={20} className="text-text-muted" />
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
                                    <p className="text-text-muted italic text-center py-8 bg-subtle rounded-xl border border-dashed border-default">
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
                    <section className="bg-surface p-6 rounded-2xl shadow-sm border border-default">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-text-primary">
                            <Building size={20} className="text-text-muted" />
                            Organisationen ({organizations.length})
                        </h2>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                placeholder="Neue Organisation..."
                                className="flex-1 p-2.5 bg-input border border-default rounded-xl text-text-primary focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition-all"
                                value={newOrgName}
                                onChange={e => setNewOrgName(e.target.value)}
                            />
                            <button onClick={handleCreateOrg} className="bg-text-primary text-surface px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition shadow-sm">
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
                                        className="flex justify-between items-center p-4 bg-surface border border-default hover:border-accent hover:bg-hover rounded-xl cursor-pointer transition-all group"
                                    >
                                        <span className="font-bold text-text-primary group-hover:text-accent">{org.name}</span>
                                        <span className="text-xs font-medium text-text-secondary bg-subtle px-2 py-1 rounded-lg border border-transparent group-hover:border-default">{memberCount} Mitarbeiter</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* APPROVALS */}
                    <section className="bg-surface p-6 rounded-2xl shadow-sm border border-default">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-text-primary">
                            <UserPlus size={20} className="text-text-muted" />
                            Offene Anfragen ({requests.length})
                        </h2>

                        <div className="space-y-4">
                            {requests.length === 0 ? <p className="text-text-muted italic text-center py-8">Keine offenen Anfragen.</p> : null}
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
        <div className="flex items-center justify-between p-4 bg-surface border border-default rounded-xl hover:shadow-sm transition-all">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center font-bold text-text-secondary text-sm border border-default shadow-sm">
                    {employee.initials}
                </div>
                <div>
                    <div className="font-bold text-text-primary">{employee.name}</div>
                    <div className="text-xs text-text-secondary">{employee.email}</div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <select
                        value={employee.role || 'user'}
                        onChange={handleRoleChange}
                        disabled={loading}
                        className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold border cursor-pointer outline-none transition-all ${employee.role === 'admin'
                            ? 'bg-accent-subtle/30 text-accent border-accent/20 hover:bg-accent-subtle/50'
                            : 'bg-subtle text-text-secondary border-default hover:bg-hover'
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
        <div className="p-4 border border-default rounded-xl bg-subtle flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div>
                    <div className="font-bold text-lg text-text-primary">{request.name}</div>
                    <div className="text-sm text-text-secondary">{request.email}</div>
                    {request.company_name && <div className="text-xs text-text-muted mt-1">Anfrage für: {request.company_name}</div>}
                </div>
                <div className="w-48">
                    <select
                        className={`w-full text-xs font-bold p-2 rounded-lg border outline-none ${selectedOrgId ? 'bg-accent-subtle/30 border-accent/20 text-accent' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}
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
                    className="flex-1 bg-green-500 text-surface py-2 rounded-lg font-bold hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                >
                    <Check size={16} /> Bestätigen
                </button>
                <button
                    onClick={handleReject}
                    disabled={loading}
                    className="flex-1 bg-surface border border-default text-text-secondary py-2 rounded-lg font-bold hover:bg-hover flex items-center justify-center gap-2 shadow-sm transition-all"
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
