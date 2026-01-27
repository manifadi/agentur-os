import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import { AgencySettings, OrganizationTemplate } from '../../types';
import { Building2, FileText, Plus, Trash2, Save, File, Upload } from 'lucide-react';
import ConfirmModal from '../Modals/ConfirmModal';

export default function AdminAgencySettings() {
    const [settings, setSettings] = useState<AgencySettings | null>(null);
    const [templates, setTemplates] = useState<OrganizationTemplate[]>([]);
    const [allDepartments, setAllDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [tLoading, setTLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Template Form State
    const [newTemplate, setNewTemplate] = useState<{ name: string, content: string, type: 'intro' | 'outro' }>({ name: '', content: '', type: 'intro' });

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

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                setErrorMsg("Authentifizierungs-Fehler: " + (authError?.message || 'Kein Benutzer'));
                setLoading(false);
                return;
            }

            // Use maybeSingle to avoid 406/Throws if no employee found
            const { data: emp, error: empError } = await supabase.from('employees').select('organization_id').eq('id', user.id).maybeSingle();

            if (empError) {
                console.error("Employee Fetch Error:", empError);
                setErrorMsg("Fehler beim Laden des Mitarbeiter-Profils: " + empError.message + " (" + empError.code + ")");
                setLoading(false);
                return;
            }

            if (!emp) {
                setErrorMsg(`Kein Mitarbeiter-Profil gefunden. (User ID: ${user.id}). Bitte stelle sicher, dass du in der 'employees' Tabelle existierst.`);
                setLoading(false);
                return;
            }

            const { data, error: settingsError } = await supabase.from('agency_settings').select('*').eq('organization_id', emp.organization_id).maybeSingle();

            if (settingsError) {
                console.error("Settings Fetch Error:", settingsError);
                setErrorMsg("Fehler beim Laden der Einstellungen: " + settingsError.message + " (" + settingsError.code + ")");
            } else if (data) {
                setSettings(data);
                fetchTemplates(data.organization_id);
                fetchDepartments(data.organization_id);
            } else {
                // Initialize defaults if no record exists yet
                const initialSettings = {
                    id: '',
                    organization_id: emp.organization_id,
                    company_name: '',
                    address: '',
                    tax_id: '',
                    bank_name: '',
                    iban: '',
                    bic: '',
                    commercial_register: '',
                    footer_text: '',
                    logo_url: '',
                    resource_planner_departments: []
                };
                setSettings(initialSettings);
                fetchTemplates(emp.organization_id);
                fetchDepartments(emp.organization_id);
            }
        } catch (e: any) {
            console.error("Unexpected Error:", e);
            setErrorMsg("Unerwarteter Fehler: " + (e.message || JSON.stringify(e)));
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async (orgId: string) => {
        const { data } = await supabase.from('organization_templates')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: true });
        if (data) setTemplates(data as any);
    };

    const fetchDepartments = async (orgId: string) => {
        const { data } = await supabase.from('departments').select('*').eq('organization_id', orgId).order('name');
        if (data) setAllDepartments(data);
    };

    const handleSaveSettings = async () => {
        if (!settings) return;
        setLoading(true);

        const { id, ...updates } = settings;
        // Upsert based on organization_id
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
            resource_planner_departments: settings.resource_planner_departments || []
        }, { onConflict: 'organization_id' });

        if (error) {
            setConfirmConfig({
                isOpen: true,
                title: 'Fehler',
                message: error.message,
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'danger',
                confirmText: 'OK',
                showCancel: false
            });
        } else {
            setConfirmConfig({
                isOpen: true,
                title: 'Gespeichert',
                message: 'Die Einstellungen wurden erfolgreich aktualisiert.',
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'success',
                confirmText: 'Super',
                showCancel: false
            });
            fetchSettings();
        }
        setLoading(false);
    };

    const handleAddTemplate = async () => {
        if (!newTemplate.name || !newTemplate.content) {
            setConfirmConfig({
                isOpen: true,
                title: 'Hinweis',
                message: 'Bitte Name und Inhalt für die Vorlage angeben.',
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'warning',
                confirmText: 'OK',
                showCancel: false
            });
            return;
        }
        if (!settings?.organization_id) return;

        setTLoading(true);
        const { error } = await supabase.from('organization_templates').insert([{
            organization_id: settings.organization_id,
            name: newTemplate.name,
            content: newTemplate.content,
            type: newTemplate.type
        }]);

        if (error) {
            setConfirmConfig({
                isOpen: true,
                title: 'Fehler',
                message: error.message,
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'danger',
                confirmText: 'OK',
                showCancel: false
            });
        }
        else {
            setNewTemplate({ name: '', content: '', type: 'intro' });
            fetchTemplates(settings.organization_id);
        }
        setTLoading(false);
    };

    const handleDeleteTemplate = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Vorlage löschen?',
            message: 'Möchtest du diese Vorlage wirklich löschen?',
            onConfirm: async () => {
                await supabase.from('organization_templates').delete().eq('id', id);
                if (settings?.organization_id) fetchTemplates(settings.organization_id);
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            },
            type: 'danger',
            confirmText: 'Löschen'
        });
    };

    const safeUpdate = (field: keyof AgencySettings, value: string) => {
        setSettings(prev => prev ? { ...prev, [field]: value } : prev);
    };

    if (loading && !settings) return <div>Lade Einstellungen...</div>;

    // Check for explicit error message OR missing settings
    if (errorMsg || (!settings && !loading)) return (
        <div className="p-6 text-center max-w-lg mx-auto mt-10 border border-red-200 bg-red-50 rounded-xl">
            <h3 className="text-red-700 font-bold text-lg mb-2">Einstellungen konnten nicht geladen werden</h3>
            <p className="text-sm text-red-600 mb-4">{errorMsg || "Unbekannter Fehler: Daten sind leer."}</p>
            <p className="text-xs text-gray-500 mb-6">Bitte überprüfe deine Internetverbindung oder kontaktiere den Support.</p>
            <button onClick={fetchSettings} className="bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-200 transition">
                Erneut versuchen
            </button>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* AGENCY DATA */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Building2 size={20} className="text-gray-400" /> Unternehmensdaten (für Verträge/Rechnungen)</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="company_name">Firmenname</label>
                        <input id="company_name" name="company_name" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.company_name || ''} onChange={e => safeUpdate('company_name', e.target.value)} placeholder="z.B. Muster Agentur GmbH" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="address">Adresse (Straße, PLZ, Ort)</label>
                        <textarea id="address" name="address" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white h-[42px] resize-none" value={settings?.address || ''} onChange={e => safeUpdate('address', e.target.value)} placeholder="Musterstraße 1, 1010 Wien" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="tax_id">UID-Nummer / Steuernummer</label>
                        <input id="tax_id" name="tax_id" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.tax_id || ''} onChange={e => safeUpdate('tax_id', e.target.value)} placeholder="ATU12345678" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="commercial_register">Firmenbuchnummer</label>
                        <input id="commercial_register" name="commercial_register" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.commercial_register || ''} onChange={e => safeUpdate('commercial_register', e.target.value)} placeholder="FN 123456 x" />
                    </div>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Kontakt & Web</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="general_email">Email (Allgemein)</label>
                            <input id="general_email" name="general_email" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.general_email || ''} onChange={e => safeUpdate('general_email', e.target.value)} placeholder="office@agentur.com" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="general_phone">Telefon (Allgemein)</label>
                            <input id="general_phone" name="general_phone" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.general_phone || ''} onChange={e => safeUpdate('general_phone', e.target.value)} placeholder="+43 1 234 56 78" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="website">Webseite</label>
                            <input id="website" name="website" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.website || ''} onChange={e => safeUpdate('website', e.target.value)} placeholder="www.agentur.com" />
                        </div>
                    </div>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Bankverbindung</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="bank_name">Bank Name</label>
                            <input id="bank_name" name="bank_name" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.bank_name || ''} onChange={e => safeUpdate('bank_name', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="iban">IBAN</label>
                            <input id="iban" name="iban" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.iban || ''} onChange={e => safeUpdate('iban', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="bic">BIC</label>
                            <input id="bic" name="bic" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white" value={settings?.bic || ''} onChange={e => safeUpdate('bic', e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="mt-6 border-t border-gray-100 pt-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2" htmlFor="footer_text">Footer Text (für alle Dokumente)</label>
                    <textarea id="footer_text" name="footer_text" className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white h-20" value={settings?.footer_text || ''} onChange={e => safeUpdate('footer_text', e.target.value)} placeholder="z.B. Geschäftsführung: Max Mustermann | Gerichtsstand: Wien" />
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSaveSettings} disabled={loading} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition shadow-lg shadow-gray-900/10">
                        <Save size={16} /> Speichern
                    </button>
                </div>
            </div>

            {/* RESOURCE PLANNER SETTINGS */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Building2 size={20} className="text-gray-400" /> Ressourcenplan Filter-Einstellungen
                </h2>
                <p className="text-sm text-gray-500 mb-6">Wähle die Abteilungen aus, die im Ressourcenplan als Filter angezeigt werden sollen.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {allDepartments.map(dept => {
                        const isSelected = settings?.resource_planner_departments?.includes(dept.id);

                        return (
                            <button
                                key={dept.id}
                                onClick={() => {
                                    if (!settings) return;
                                    const current = settings.resource_planner_departments || [];
                                    if (isSelected) {
                                        setSettings({ ...settings, resource_planner_departments: current.filter(id => id !== dept.id) });
                                    } else {
                                        setSettings({ ...settings, resource_planner_departments: [...current, dept.id] });
                                    }
                                }}
                                className={`p-4 rounded-xl border text-left transition ${isSelected
                                    ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                                    }`}
                            >
                                <div className="font-bold text-sm">{dept.name}</div>
                                <div className={`text-[10px] uppercase mt-1 ${isSelected ? 'text-gray-400' : 'text-gray-400'}`}>
                                    {isSelected ? 'Ausgewählt' : 'Verfügbar'}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {allDepartments.length === 0 && (
                    <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl">
                        Keine Abteilungen gefunden. Bitte erst Abteilungen anlegen.
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button onClick={handleSaveSettings} disabled={loading} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition shadow-lg shadow-gray-900/10">
                        <Save size={16} /> Speichern
                    </button>
                </div>
            </div>

            {/* BRANDING */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><File size={20} className="text-gray-400" /> Branding & Design</h2>

                <div className="space-y-8">
                    {/* 1. APP LOGO */}
                    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 items-start">
                        <div className="w-40 h-40 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden relative">
                            {settings?.logo_url ? (
                                <img src={settings.logo_url} className="w-full h-full object-contain p-4" alt="App Logo" />
                            ) : (
                                <span className="text-xs text-center text-gray-400 font-bold uppercase p-4">Kein Logo<br />(Quadratisch)</span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 mb-1">App Logo (Quadratisch)</h3>
                            <p className="text-sm text-gray-500 mb-4">Dieses Logo wird in der Seitenleiste der App angezeigt.</p>
                            <div className="relative inline-block">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setLoading(true);
                                        try {
                                            const url = await uploadFileToSupabase(file, 'documents');
                                            console.log("Uploaded Logo URL:", url);
                                            setSettings(s => s ? ({ ...s, logo_url: url }) : null);

                                            if (settings) {
                                                const { error } = await supabase.from('agency_settings').upsert({
                                                    ...settings,
                                                    logo_url: url
                                                }, { onConflict: 'organization_id' });

                                                if (error) {
                                                    console.error("DB Save Error:", error);
                                                    alert("Fehler beim Speichern: " + error.message);
                                                }
                                            }
                                        } catch (err: any) {
                                            console.error(err);
                                            alert('Upload fehlgeschlagen. Stelle sicher, dass du eingeloggt bist.');
                                        }
                                        setLoading(false);
                                    }}
                                />
                                <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition">
                                    <Upload size={16} /> Logo hochladen
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    {/* 2. DOCUMENT BANNER */}
                    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 items-start">
                        <div className="w-full md:w-[400px] h-[60px] bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden relative col-span-2 md:col-span-1 md:col-start-2">
                            {/* Preview box mostly for verifying presence, actual preview might need to be wider */}
                            {settings?.document_header_url ? (
                                <img src={settings.document_header_url} className="w-full h-full object-cover" alt="Banner" />
                            ) : (
                                <span className="text-xs text-gray-400 font-bold uppercase">Kein Banner</span>
                            )}
                        </div>

                        <div className="md:col-start-2">
                            <h3 className="font-bold text-gray-900 mb-1">Dokumenten Header (1050x150px)</h3>
                            <p className="text-sm text-gray-500 mb-4">Dieser Banner erscheint im Kopfbereich aller PDF-Dokumente (Angebote, Verträge).</p>
                            <div className="relative inline-block">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setLoading(true);
                                        try {
                                            const url = await uploadFileToSupabase(file, 'documents');
                                            console.log("Uploaded Banner URL:", url);
                                            setSettings(s => s ? ({ ...s, document_header_url: url }) : null);

                                            if (settings) {
                                                const { error } = await supabase.from('agency_settings').upsert({
                                                    ...settings,
                                                    document_header_url: url
                                                }, { onConflict: 'organization_id' });

                                                if (error) {
                                                    console.error("DB Save Error:", error);
                                                    alert("Fehler beim Speichern (DB Spalte fehlt?): " + error.message);
                                                }
                                            }
                                        } catch (err: any) {
                                            console.error(err);
                                            alert('Upload fehlgeschlagen: ' + err.message);
                                        }
                                        setLoading(false);
                                    }}
                                />
                                <button className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition">
                                    <Upload size={16} /> Banner hochladen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TEMPLATES */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={20} className="text-gray-400" /> Vertragsvorlagen</h2>
                <p className="text-sm text-gray-500 mb-6">Erstelle Textbausteine für Einleitung und Schluss von Verträgen.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* List */}
                    <div className="space-y-3">
                        {templates.length === 0 && <div className="text-center text-gray-400 py-4 border border-dashed rounded-xl">Keine Vorlagen.</div>}
                        {templates.map(t => (
                            <div key={t.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-start group hover:bg-white hover:shadow-sm transition">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${t.type === 'intro' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{t.type}</span>
                                        <span className="font-bold text-sm text-gray-900">{t.name}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-2">{t.content}</p>
                                </div>
                                <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16} /></button>
                            </div>
                        ))}
                    </div>

                    {/* Add New */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Neue Vorlage erstellen</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Typ</label>
                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => setNewTemplate({ ...newTemplate, type: 'intro' })} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${newTemplate.type === 'intro' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Einleitung</button>
                                    <button onClick={() => setNewTemplate({ ...newTemplate, type: 'outro' })} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${newTemplate.type === 'outro' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Schluss / AGB</button>
                                </div>
                            </div>
                            <div>
                                <input className="w-full p-2 border rounded-xl text-sm" placeholder="Bezeichnung (z.B. Standard Einleitung)" value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} />
                            </div>
                            <div>
                                <textarea className="w-full p-2 border rounded-xl text-sm h-32 resize-none" placeholder="Textinhalt..." value={newTemplate.content} onChange={e => setNewTemplate({ ...newTemplate, content: e.target.value })} />
                            </div>
                            <button onClick={handleAddTemplate} disabled={tLoading} className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition flex justify-center items-center gap-2">
                                <Plus size={16} /> Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
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
