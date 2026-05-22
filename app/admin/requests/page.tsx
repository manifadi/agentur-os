'use client';

import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { RegistrationRequest, Organization } from '../../types';
import { Inbox, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import {
    SectionHeader, Card, EmptyState, INPUT_CLS,
} from '../../components/SuperAdmin/AdminUI';
import { useSuperAdmin } from '../../components/SuperAdmin/SuperAdminContext';

export default function RequestsPage() {
    const { requests, orgs, loading } = useSuperAdmin();

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Registrierungs-Anfragen"
                subtitle="User, die sich selbst registriert haben und auf Freigabe warten."
            />

            {loading ? (
                <div className="text-sm text-text-muted italic py-12 text-center">Lade…</div>
            ) : requests.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Inbox}
                        title="Alles erledigt"
                        subtitle="Keine offenen Anfragen."
                    />
                </Card>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => (
                        <RequestRow key={req.id} request={req} organizations={orgs as unknown as Organization[]} />
                    ))}
                </div>
            )}
        </div>
    );
}

function RequestRow({ request, organizations }: { request: RegistrationRequest; organizations: Organization[] }) {
    const [selectedOrgId, setSelectedOrgId] = useState(request.organization_id || '');
    const [loading, setLoading] = useState(false);
    const [confirmReject, setConfirmReject] = useState(false);

    const sortedOrgs = [...organizations].sort((a, b) => a.name.localeCompare(b.name));

    const handleOrgChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedOrgId(newId);
        await supabase.from('registration_requests').update({ organization_id: newId }).eq('id', request.id);
    };

    const handleApprove = async () => {
        if (!selectedOrgId) {
            toast.warning('Bitte zuerst eine Agentur zuweisen.');
            return;
        }
        setLoading(true);

        const initials = request.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        const { error } = await supabase.rpc('approve_registration_request', {
            request_id:     request.id,
            target_org_id:  selectedOrgId,
            emp_name:       request.name,
            emp_email:      request.email,
            emp_initials:   initials,
        });

        setLoading(false);
        if (error) toast.error('Fehler: ' + error.message);
        else toast.success(`${request.name} bestätigt.`);
    };

    const handleReject = async () => {
        setConfirmReject(false);
        const { error } = await supabase.rpc('delete_registration_request_super_admin', {
            p_request_id: request.id,
        });
        if (error) toast.error('Fehler: ' + error.message);
        else toast.success(`Anfrage von ${request.name} gelöscht.`);
    };

    const orgAssigned = !!selectedOrgId;

    return (
        <>
            <Card>
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-text-primary">{request.name}</div>
                        <div className="text-xs text-text-secondary mt-0.5">{request.email}</div>
                        {request.company_name && (
                            <div className="text-[11px] text-text-muted mt-1.5">
                                Wunsch-Agentur: <strong>{request.company_name}</strong>
                            </div>
                        )}
                        <div className="text-[11px] text-text-muted mt-2">
                            Angefragt: {new Date(request.created_at).toLocaleString('de-DE')}
                        </div>
                    </div>

                    <div className="w-56">
                        <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1.5">
                            Agentur zuweisen
                        </label>
                        <select
                            value={selectedOrgId}
                            onChange={handleOrgChange}
                            className={INPUT_CLS}
                            style={orgAssigned ? {} : {
                                background: 'var(--color-danger-subtle)',
                                borderColor: 'var(--color-danger-border)',
                                color: 'var(--color-danger-text)',
                            }}
                        >
                            <option value="">-- Nicht zugewiesen --</option>
                            {sortedOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleApprove}
                        disabled={loading || !selectedOrgId}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                        style={{ background: 'var(--color-success)', color: '#ffffff' }}
                    >
                        <Check size={14} /> Bestätigen
                    </button>
                    <button
                        onClick={() => setConfirmReject(true)}
                        disabled={loading}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-semibold transition active:scale-[0.98]"
                        style={{
                            background: 'var(--color-danger-subtle)',
                            color: 'var(--color-danger-text)',
                            border: '1px solid var(--color-danger-border)',
                        }}
                    >
                        <X size={14} /> Anfrage löschen
                    </button>
                </div>
            </Card>

            {confirmReject && (
                <ConfirmModal
                    isOpen={true}
                    title="Anfrage löschen?"
                    message={`Die Anfrage von ${request.name} (${request.email}) wird unwiderruflich aus dem System entfernt. Der User kann sich neu registrieren, wenn nötig.`}
                    onConfirm={handleReject}
                    onCancel={() => setConfirmReject(false)}
                    type="danger"
                    confirmText="Endgültig löschen"
                />
            )}
        </>
    );
}
