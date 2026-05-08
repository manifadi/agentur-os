import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import { AgencySettings, OrganizationTemplate } from '../../types';
import { Plus, Trash2, Save, Upload } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';
import { SettingsFormSkeleton } from '../UI/Skeleton';

interface Props {
    section?: 'company' | 'branding' | 'templates';
}

const INPUT = 'w-full px-3 py-2.5 border border-border-strong rounded-xl bg-subtle text-text-primary placeholder:text-text-placeholder focus:bg-surface focus:ring-2 focus:ring-accent outline-none transition text-sm';
const CARD = 'bg-surface p-6 rounded-2xl border border-default shadow-sm';

export default function AdminAgencySettings({ section }: Props) {
    const [settings, setSettings] = useState<AgencySettings | null>(null);
    const [templates, setTemplates] = useState<OrganizationTemplate[]>([]);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [tLoading, setTLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const [newTemplate, setNewTemplate] = useState<{ name: string; content: string; type: 'intro' | 'outro' }>({
        name: '', content: '', type: 'intro'
    });

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean; title: string; message: string;
        onConfirm: () => void; type: 'danger' | 'info' | 'warning' | 'success';
        confirmText?: string; showCancel?: boolean;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info' });

    const showCompany = !section || section === 'company';
    const showBranding = !section || section === 'branding';
    const showTemplates = !section || section === 'templates';

    useEffect(() => { fetchSettings(); }, []);

    const fetchSettings = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) { setErrorMsg('Authentifizierungs-Fehler'); setLoading(false); return; }

            const { data: emp, error: empError } = await supabase
                .from('employees').select('organization_id').eq('user_id', user.id).maybeSingle();

            if (empError || !emp) {
                setErrorMsg('Kein Mitarbeiter-Profil gefunden.');
                setLoading(false);
                return;
            }

            const { data, error: settingsError } = await supabase
                .from('agency_settings').select('*').eq('organization_id', emp.organization_id).maybeSingle();

            if (settingsError) {
                setErrorMsg('Fehler beim Laden der Einstellungen: ' + settingsError.message);
            } else if (data) {
                setSettings(data);
                fetchTemplates(data.organization_id);
                fetchDepartments(data.organization_id);
            } else {
                const defaults: AgencySettings = {
                    id: '', organization_id: emp.organization_id,
                    company_name: '', address: '', tax_id: '', bank_name: '',
                    iban: '', bic: '', commercial_register: '', footer_text: '',
                    logo_url: '', resource_planner_departments: [],
                    default_tax_rate: 20, invoice_number_prefix: 'RE'
                };
                setSettings(defaults);
                fetchTemplates(emp.organization_id);
                fetchDepartments(emp.organization_id);
            }
        } catch (e: any) {
            setErrorMsg('Unerwarteter Fehler: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async (orgId: string) => {
        const { data } = await supabase.from('organization_templates')
            .select('*').eq('organization_id', orgId).order('created_at', { ascending: true });
        if (data) setTemplates(data as any);
    };

    const fetchDepartments = async (orgId: string) => {
        const { data } = await supabase.from('departments').select('*').eq('organization_id', orgId).order('name');
        if (data) setAllDepartments(data);
    };

    const handleSave = async () => {
        if (!settings) return;
        setLoading(true);
        const { error } = await supabase.from('agency_settings').upsert({
            organization_id: settings.organization_id,
            company_name: settings.company_name,
            address: settings.address,
            tax_id: settings.tax_id,
            bank_name: settings.bank_name,
            iban: settings.iban,
            bic: settings.bic,
            commercial_register: settings.commercial_register,
            general_email: settings.general_email,
            general_phone: settings.general_phone,
            website: settings.website,
            footer_text: settings.footer_text,
            logo_url: settings.logo_url,
            document_header_url: settings.document_header_url,
            resource_planner_departments: settings.resource_planner_departments || [],
            default_tax_rate: settings.default_tax_rate ?? 20,
            invoice_number_prefix: settings.invoice_number_prefix || 'RE'
        }, { onConflict: 'organization_id' });

        setLoading(false);
        if (error) {
            setConfirmConfig({
                isOpen: true, title: 'Fehler', message: error.message, type: 'danger',
                onConfirm: () => setConfirmConfig(p => ({ ...p, isOpen: false })),
                confirmText: 'OK', showCancel: false
            });
        } else {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    const set = (field: keyof AgencySettings, value: string | number) =>
        setSettings(prev => prev ? { ...prev, [field]: value } : prev);

    const handleAddTemplate = async () => {
        if (!newTemplate.name || !newTemplate.content || !settings?.organization_id) return;
        setTLoading(true);
        const { error } = await supabase.from('organization_templates').insert([{
            organization_id: settings.organization_id,
            name: newTemplate.name, content: newTemplate.content, type: newTemplate.type
        }]);
        if (!error) {
            setNewTemplate({ name: '', content: '', type: 'intro' });
            fetchTemplates(settings.organization_id);
        }
        setTLoading(false);
    };

    const handleDeleteTemplate = (id: string) => {
        setConfirmConfig({
            isOpen: true, title: 'Vorlage löschen?',
            message: 'Möchtest du diese Vorlage wirklich löschen?',
            onConfirm: async () => {
                await supabase.from('organization_templates').delete().eq('id', id);
                if (settings?.organization_id) fetchTemplates(settings.organization_id);
                setConfirmConfig(p => ({ ...p, isOpen: false }));
            },
            type: 'danger', confirmText: 'Löschen'
        });
    };

    const uploadImage = async (file: File, field: 'logo_url' | 'document_header_url') => {
        if (!settings) return;
        setLoading(true);
        try {
            const url = await uploadFileToSupabase(file, 'documents');
            const updated = { ...settings, [field]: url };
            setSettings(updated);
            await supabase.from('agency_settings').upsert(
                { ...updated, resource_planner_departments: updated.resource_planner_departments || [] },
                { onConflict: 'organization_id' }
            );
        } catch (err: any) {
            alert('Upload fehlgeschlagen: ' + err.message);
        }
        setLoading(false);
    };

    if (loading && !settings) return <SettingsFormSkeleton />;

    if (errorMsg) return (
        <div className="p-6 text-center rounded-2xl border border-red-500/20 bg-red-500/10">
            <p className="text-red-500 font-bold mb-2">Einstellungen konnten nicht geladen werden</p>
            <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
            <button onClick={fetchSettings} className="bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-500/30 transition">
                Erneut versuchen
            </button>
        </div>
    );

    return (
        <div className="space-y-6">

            {/* ── COMPANY SECTION ── */}
            {showCompany && (
                <>
                    {/* Firmendaten */}
                    <div className={CARD}>
                        <SectionTitle>Firmendaten</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                            <Field label="Firmenname">
                                <input className={INPUT} value={settings?.company_name || ''} onChange={e => set('company_name', e.target.value)} placeholder="Muster Agentur GmbH" />
                            </Field>
                            <Field label="Adresse">
                                <textarea className={INPUT + ' h-10 resize-none'} value={settings?.address || ''} onChange={e => set('address', e.target.value)} placeholder="Musterstraße 1, 1010 Wien" />
                            </Field>
                            <Field label="UID-Nummer / Steuernummer">
                                <input className={INPUT} value={settings?.tax_id || ''} onChange={e => set('tax_id', e.target.value)} placeholder="ATU12345678" />
                            </Field>
                            <Field label="Firmenbuchnummer">
                                <input className={INPUT} value={settings?.commercial_register || ''} onChange={e => set('commercial_register', e.target.value)} placeholder="FN 123456 x" />
                            </Field>
                        </div>
                    </div>

                    {/* Kontakt */}
                    <div className={CARD}>
                        <SectionTitle>Kontakt & Web</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
                            <Field label="E-Mail">
                                <input className={INPUT} value={settings?.general_email || ''} onChange={e => set('general_email', e.target.value)} placeholder="office@agentur.com" />
                            </Field>
                            <Field label="Telefon">
                                <input className={INPUT} value={settings?.general_phone || ''} onChange={e => set('general_phone', e.target.value)} placeholder="+43 1 234 56 78" />
                            </Field>
                            <Field label="Webseite">
                                <input className={INPUT} value={settings?.website || ''} onChange={e => set('website', e.target.value)} placeholder="www.agentur.com" />
                            </Field>
                        </div>
                    </div>

                    {/* Bankverbindung */}
                    <div className={CARD}>
                        <SectionTitle>Bankverbindung</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
                            <Field label="Bank">
                                <input className={INPUT} value={settings?.bank_name || ''} onChange={e => set('bank_name', e.target.value)} />
                            </Field>
                            <Field label="IBAN">
                                <input className={INPUT} value={settings?.iban || ''} onChange={e => set('iban', e.target.value)} />
                            </Field>
                            <Field label="BIC">
                                <input className={INPUT} value={settings?.bic || ''} onChange={e => set('bic', e.target.value)} />
                            </Field>
                        </div>
                    </div>

                    {/* Rechnungen */}
                    <div className={CARD}>
                        <SectionTitle>Rechnungen</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                            <Field label="Standard-Mehrwertsteuer (%)">
                                <input className={INPUT} type="number" min="0" max="100"
                                    value={settings?.default_tax_rate ?? 20}
                                    onChange={e => set('default_tax_rate', parseFloat(e.target.value) || 0)}
                                    placeholder="20" />
                                <p className="text-xs text-text-muted mt-1">z.B. 20 für Österreich, 19 für Deutschland</p>
                            </Field>
                            <Field label="Rechnungsnummer-Präfix">
                                <input className={INPUT} value={settings?.invoice_number_prefix || 'RE'}
                                    onChange={e => set('invoice_number_prefix', e.target.value)} placeholder="RE" />
                                <p className="text-xs text-text-muted mt-1">z.B. "RE" → RE-2025-001</p>
                            </Field>
                        </div>
                        <div className="mt-5">
                            <Field label="Footer Text (erscheint auf allen Dokumenten)">
                                <textarea className={INPUT + ' h-20 mt-1'} value={settings?.footer_text || ''}
                                    onChange={e => set('footer_text', e.target.value)}
                                    placeholder="z.B. Geschäftsführung: Max Mustermann | Gerichtsstand: Wien" />
                            </Field>
                        </div>
                    </div>

                    {/* Ressourcenplan */}
                    {allDepartments.length > 0 && (
                        <div className={CARD}>
                            <SectionTitle>Ressourcenplan</SectionTitle>
                            <p className="text-sm text-text-muted mt-1 mb-4">Wähle die Abteilungen aus, die im Ressourcenplan als Filter angezeigt werden.</p>
                            <div className="flex flex-wrap gap-2">
                                {allDepartments.map(dept => {
                                    const selected = settings?.resource_planner_departments?.includes(dept.id);
                                    return (
                                        <button
                                            key={dept.id}
                                            onClick={() => {
                                                if (!settings) return;
                                                const current = settings.resource_planner_departments || [];
                                                setSettings({
                                                    ...settings,
                                                    resource_planner_departments: selected
                                                        ? current.filter(id => id !== dept.id)
                                                        : [...current, dept.id]
                                                });
                                            }}
                                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${selected
                                                ? 'bg-accent text-white border-accent shadow-sm'
                                                : 'border-default text-text-secondary hover:border-accent hover:bg-hover'
                                            }`}
                                        >
                                            {dept.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <SaveButton onClick={handleSave} loading={loading} saved={saved} />
                    </div>
                </>
            )}

            {/* ── BRANDING SECTION ── */}
            {showBranding && (
                <>
                    {/* App Logo */}
                    <div className={CARD}>
                        <SectionTitle>App Logo</SectionTitle>
                        <p className="text-sm text-text-muted mt-1 mb-5">Wird in der Seitenleiste angezeigt. Quadratisches Format empfohlen.</p>
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 bg-subtle border border-default rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
                                {settings?.logo_url
                                    ? <img src={settings.logo_url} className="w-full h-full object-contain p-2" alt="Logo" />
                                    : <span className="text-xs text-text-muted text-center font-bold uppercase">Kein Logo</span>
                                }
                            </div>
                            <div>
                                <label className="relative inline-flex items-center gap-2 cursor-pointer bg-surface border border-default text-text-secondary px-4 py-2 rounded-xl text-sm font-bold hover:bg-hover transition">
                                    <Upload size={15} /> Logo hochladen
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'logo_url'); }} />
                                </label>
                                {settings?.logo_url && (
                                    <button onClick={() => set('logo_url', '')} className="ml-3 text-xs text-text-muted hover:text-red-500 transition">Entfernen</button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Dokumenten-Header */}
                    <div className={CARD}>
                        <SectionTitle>Dokumenten-Header</SectionTitle>
                        <p className="text-sm text-text-muted mt-1 mb-5">Erscheint im Kopfbereich aller PDFs. Empfohlen: 1050 × 150 px.</p>
                        <div className="w-full h-16 bg-subtle border border-default rounded-xl overflow-hidden mb-5 flex items-center justify-center">
                            {settings?.document_header_url
                                ? <img src={settings.document_header_url} className="w-full h-full object-cover" alt="Header" />
                                : <span className="text-xs text-text-muted font-bold uppercase">Kein Header</span>
                            }
                        </div>
                        <label className="relative inline-flex items-center gap-2 cursor-pointer bg-surface border border-default text-text-secondary px-4 py-2 rounded-xl text-sm font-bold hover:bg-hover transition">
                            <Upload size={15} /> Header hochladen
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, 'document_header_url'); }} />
                        </label>
                        {settings?.document_header_url && (
                            <button onClick={() => set('document_header_url', '')} className="ml-3 text-xs text-text-muted hover:text-red-500 transition">Entfernen</button>
                        )}
                    </div>
                </>
            )}

            {/* ── TEMPLATES SECTION ── */}
            {showTemplates && (
                <div className={CARD}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Liste */}
                        <div className="space-y-3">
                            {templates.length === 0 && (
                                <div className="text-center text-text-muted py-8 border border-default border-dashed rounded-xl text-sm">
                                    Noch keine Vorlagen angelegt.
                                </div>
                            )}
                            {templates.map(t => (
                                <div key={t.id} className="p-4 rounded-xl border border-default bg-subtle flex justify-between items-start group hover:bg-surface hover:shadow-sm transition">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${t.type === 'intro' ? 'bg-accent-subtle/30 text-accent' : 'bg-orange-500/10 text-orange-500'}`}>
                                                {t.type === 'intro' ? 'Einleitung' : 'Schluss'}
                                            </span>
                                            <span className="font-bold text-sm text-text-primary truncate">{t.name}</span>
                                        </div>
                                        <p className="text-xs text-text-muted line-clamp-2">{t.content}</p>
                                    </div>
                                    <button onClick={() => handleDeleteTemplate(t.id)}
                                        className="text-text-placeholder hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Neue Vorlage */}
                        <div className="bg-subtle p-5 rounded-xl border border-default space-y-4">
                            <p className="text-sm font-bold text-text-primary">Neue Vorlage</p>
                            <div className="flex gap-2">
                                {(['intro', 'outro'] as const).map(type => (
                                    <button key={type} onClick={() => setNewTemplate({ ...newTemplate, type })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${newTemplate.type === type
                                            ? type === 'intro' ? 'bg-accent-subtle/30 border-accent/20 text-accent' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'
                                            : 'bg-surface border-default text-text-secondary hover:bg-hover'
                                        }`}>
                                        {type === 'intro' ? 'Einleitung' : 'Schluss / AGB'}
                                    </button>
                                ))}
                            </div>
                            <input
                                className={INPUT}
                                placeholder="Bezeichnung (z.B. Standard Einleitung)"
                                value={newTemplate.name}
                                onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                            />
                            <textarea
                                className={INPUT + ' h-28 resize-none'}
                                placeholder="Textinhalt…"
                                value={newTemplate.content}
                                onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })}
                            />
                            <button
                                onClick={handleAddTemplate}
                                disabled={tLoading || !newTemplate.name || !newTemplate.content}
                                className="w-full py-2 bg-text-primary text-surface rounded-xl text-sm font-bold hover:opacity-90 transition flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                <Plus size={15} /> Vorlage hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
                type={confirmConfig.type}
                confirmText={confirmConfig.confirmText}
                showCancel={confirmConfig.showCancel}
            />
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <p className="text-sm font-bold text-text-primary">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-text-muted">{label}</label>
            {children}
        </div>
    );
}

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50"
            style={{ background: saved ? '#22c55e' : 'var(--text-primary)', color: 'var(--bg-surface)' }}
        >
            {!saved && <Save size={15} />}
            {saved ? 'Gespeichert ✓' : 'Speichern'}
        </button>
    );
}
