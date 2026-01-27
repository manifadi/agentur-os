import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Organization, RegistrationRequest, Employee } from '../../types';
import { Trash, Check, X, Building, UserPlus, Shield } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';

export default function SuperAdminDashboard() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [requests, setRequests] = useState<RegistrationRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [newOrgName, setNewOrgName] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: orgs } = await supabase.from('organizations').select('*').order('name');
        if (orgs) setOrganizations(orgs);

        const { data: reqs } = await supabase.from('registration_requests').select('*').eq('status', 'pending');
        if (reqs) setRequests(reqs);

        const { data: emps } = await supabase.from('employees').select('*');
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



    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-3"><Shield size={32} /> Super Admin Dashboard</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ORGANIZATIONS */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Building size={20} /> Organisationen ({organizations.length})</h2>

                    <div className="flex gap-2 mb-6">
                        <input
                            type="text"
                            placeholder="Neue Organisation..."
                            className="flex-1 p-2 border border-gray-200 rounded-lg"
                            value={newOrgName}
                            onChange={e => setNewOrgName(e.target.value)}
                        />
                        <button onClick={handleCreateOrg} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800">
                            Erstellen
                        </button>
                    </div>

                    <div className="space-y-2">
                        {organizations.map(org => {
                            const memberCount = employees.filter(e => e.organization_id === org.id).length;
                            return (
                                <div key={org.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span className="font-medium">{org.name}</span>
                                    <span className="text-sm text-gray-500">{memberCount} Mitarbeiter</span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* APPROVALS */}
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><UserPlus size={20} /> Offene Anfragen ({requests.length})</h2>

                    <div className="space-y-4">
                        {requests.length === 0 ? <p className="text-gray-400 italic">Keine offenen Anfragen.</p> : null}
                        {requests.map(req => {
                            // Local state handling for changing org would be complex in a map without sub-component or robust state.
                            // We'll trust the admin to pick from a dropdown right here. 
                            // Since we need to track state for EACH item, and I can't easily hook into loop, 
                            // I will use a simple approach: The Approve button will read from a local variable? No.
                            // Better: Update the DB immediately when Admin changes the dropdown.

                            return (
                                <RequestItem
                                    key={req.id}
                                    request={req}
                                    organizations={organizations}
                                    onUpdate={fetchData}
                                />
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
}

function RequestItem({ request, organizations, onUpdate }: { request: RegistrationRequest, organizations: Organization[], onUpdate: () => void }) {
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
        // Persist immediately so it's "manually assigned"
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

        const { error: empError } = await supabase.from('employees').insert([{
            name: request.name,
            email: request.email,
            initials: initials,
            organization_id: selectedOrgId,
            role: 'user'
        }]);

        if (empError) {
            console.error(empError);
            setConfirmConfig({
                isOpen: true,
                title: 'Systemfehler',
                message: 'Mitarbeiter konnte nicht angelegt werden. Bitte prüfe die Konsole für Details.',
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'danger',
                confirmText: 'OK',
                showCancel: false
            });
            setLoading(false);
            return;
        }

        await supabase.from('registration_requests').update({ status: 'approved' }).eq('id', request.id);
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
                {/* Org Selector */}
                <div className="w-48">
                    <select
                        className={`w-full text-xs font-bold p-2 rounded border ${selectedOrgId ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'}`}
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
                    className="flex-1 bg-green-500 text-white py-2 rounded-lg font-bold hover:bg-green-600 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Check size={16} /> Bestätigen
                </button>
                <button
                    onClick={handleReject}
                    disabled={loading}
                    className="flex-1 bg-gray-200 text-gray-600 py-2 rounded-lg font-bold hover:bg-gray-300 flex items-center justify-center gap-2"
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

