'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { useApp } from '../../context/AppContext';
import { Client, ClientContact, ClientLog, Project } from '../../types';
import { ArrowLeft, Phone, Mail, Globe, MapPin, Building, Trash, Edit2, Plus, User, Save, X, Briefcase, FileText, Send, Calendar, MoreHorizontal } from 'lucide-react';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import ContactModal from '../../components/Modals/ContactModal';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function ClientDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { session, currentUser } = useApp();
    const clientId = params.id as string;

    const [client, setClient] = useState<Client | null>(null);
    usePageTitle(client?.name || 'Kunde');
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [logs, setLogs] = useState<ClientLog[]>([]); // New Log State
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Client>>({});

    // Contact Management State
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [newContact, setNewContact] = useState<Partial<ClientContact>>({});

    // Logbook State
    const [newLog, setNewLog] = useState({ title: '', content: '' });
    const [isPostingLog, setIsPostingLog] = useState(false);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editLogData, setEditLogData] = useState({ title: '', content: '' });
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Confirmation Modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => void | Promise<void>;
        type: 'danger' | 'info' | 'warning' | 'success';
        confirmText?: string;
        cancelText?: string;
        showCancel?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        action: async () => { },
        type: 'danger',
        showCancel: true
    });

    useEffect(() => {
        if (currentUser) {
            setIsAdmin(currentUser.role === 'admin');
        }
    }, [currentUser]);

    useEffect(() => {
        if (clientId && session) {
            fetchClientData();
        }
    }, [clientId, session]);

    const fetchClientData = async () => {
        setLoading(true);
        // 1. Fetch Client
        const { data: clientData, error: clientError } = await supabase.from('clients').select('*').eq('id', clientId).single();
        if (clientData) {
            setClient(clientData);
            setEditForm(clientData);
        }

        // 2. Fetch Contacts
        const { data: contactsData } = await supabase.from('client_contacts').select('*').eq('client_id', clientId);
        if (contactsData) setContacts(contactsData);

        // 3. Fetch Projects
        const { data: projectsData } = await supabase.from('projects').select('*, clients(*)').eq('client_id', clientId).order('created_at', { ascending: false });
        if (projectsData) setProjects(projectsData as any);

        // 4. Fetch Logs (Logbook)
        const { data: logsData } = await supabase
            .from('client_logs')
            .select(`*, employees:author_id(id, name, initials)`)
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (logsData) {
            // Transform data if necessary, or rely on automatic mapping if shapes match
            setLogs(logsData as any);
        }

        setLoading(false);
    };

    const handleSaveClient = async () => {
        if (!client) return;
        const { error } = await supabase
            .from('clients')
            .update({
                name: editForm.name,
                description: editForm.description,
                address: editForm.address,
                general_email: editForm.general_email,
                general_phone: editForm.general_phone,
                website: editForm.website,
                logo_url: editForm.logo_url,
            })
            .eq('id', client.id);

        if (error) {
            setConfirmModal({
                isOpen: true,
                title: 'Speichervorgang fehlgeschlagen',
                message: 'Die Änderungen am Kunden konnten nicht gespeichert werden: ' + error.message,
                type: 'danger',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
        } else {
            setClient({ ...client, ...editForm } as Client);
            setIsEditing(false);
        }
    };

    const handleDeleteClient = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Kunden löschen',
            message: 'Möchten Sie diesen Kunden wirklich löschen?',
            confirmText: 'Löschen',
            type: 'danger',
            action: async () => {
                setTimeout(() => {
                    setConfirmModal({
                        isOpen: true,
                        title: 'WIRKLICH löschen?',
                        message: 'ACHTUNG: Alle Daten werden unwiderruflich gelöscht!',
                        confirmText: 'Endgültig löschen',
                        type: 'danger',
                        action: async () => {
                            await supabase.from('clients').delete().eq('id', clientId);
                            router.push('/dashboard');
                        }
                    });
                }, 200);
            }
        });
    };

    // --- LOGBOOK HANDLERS ---
    const handlePostLog = async () => {
        if (!client || !currentUser) {
            setConfirmModal({
                isOpen: true,
                title: 'Sitzung abgelaufen',
                message: 'Deine Sitzung ist ungültig. Bitte lade die Seite neu.',
                type: 'warning',
                action: async () => window.location.reload(),
                confirmText: 'Neu laden',
                showCancel: false
            });
            return;
        }
        if (!newLog.title || !newLog.content) return;
        setIsPostingLog(true);

        const { data, error } = await supabase.from('client_logs').insert([{
            client_id: client.id,
            author_id: currentUser.id,
            organization_id: currentUser.organization_id || client.organization_id, // Fallback if user org is missing? 
            title: newLog.title,
            content: newLog.content
        }]).select('*, employees:author_id(id, name, initials)').single();

        if (error) {
            console.error(error);
            setConfirmModal({
                isOpen: true,
                title: 'Übertragungsfehler',
                message: `Der Logbuch-Eintrag konnte nicht gespeichert werden: ${error.message}`,
                type: 'danger',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
        } else if (data) {
            setLogs([data as any, ...logs]);
            setNewLog({ title: '', content: '' });
        }
        setIsPostingLog(false);
    };

    const handleDeleteLog = async (logId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eintrag löschen?',
            message: 'Möchtest du diesen Logbuch-Eintrag wirklich löschen?',
            type: 'danger',
            confirmText: 'Löschen',
            showCancel: true,
            action: async () => {
                await supabase.from('client_logs').delete().eq('id', logId);
                setLogs(logs.filter((l: ClientLog) => l.id !== logId));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleUpdateLog = async () => {
        if (!editingLogId) return;

        await supabase.from('client_logs').update({
            title: editLogData.title,
            content: editLogData.content
        }).eq('id', editingLogId);

        setLogs(logs.map((l: ClientLog) => l.id === editingLogId ? { ...l, title: editLogData.title, content: editLogData.content } : l));
        setEditingLogId(null);
    };


    // --- CONTACT HANDLERS ---
    const handleSaveContact = async (contactData: Partial<ClientContact>) => {
        if (!client) return;

        // Debugging RLS
        console.log("Saving Contact. User Org:", currentUser?.organization_id, "Client Org:", client.organization_id);

        const orgId = currentUser?.organization_id || client.organization_id;

        if (!orgId) {
            setConfirmModal({
                isOpen: true,
                title: 'Konfigurationsfehler',
                message: 'Keine Organisations-ID gefunden. Bitte melde dich ab und erneut an.',
                type: 'danger',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
            return;
        }

        const { data, error } = await supabase.from('client_contacts').insert([{
            ...contactData,
            client_id: client.id,
            organization_id: orgId
        }]).select().single();

        if (error) {
            console.error("Add Contact Error:", error);
            setConfirmModal({
                isOpen: true,
                title: 'Fehler beim Kontakt',
                message: `Der Kontakt konnte nicht gespeichert werden: ${error.message}`,
                type: 'danger',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
        } else if (data) {
            setContacts([...contacts, data]);
            setIsAddingContact(false); // Close modal
        }
    };

    const handleDeleteContact = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Kontakt löschen?',
            message: 'Möchtest du diesen Ansprechpartner wirklich entfernen?',
            type: 'danger',
            confirmText: 'Löschen',
            showCancel: true,
            action: async () => {
                await supabase.from('client_contacts').delete().eq('id', id);
                setContacts(contacts.filter((c: ClientContact) => c.id !== id));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !client) return;

        // Validierung
        if (!file.type.startsWith('image/')) {
            setConfirmModal({
                isOpen: true,
                title: 'Falsches Format',
                message: 'Bitte lade nur Bildformate hoch (PNG, JPG, WebP).',
                type: 'warning',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
            return;
        }

        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${client.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = fileName;

        try {
            console.log('Attempting upload to bucket: client-logos, path:', filePath);
            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('client-logos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase Upload Error:', uploadError);
                throw uploadError;
            }

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('client-logos')
                .getPublicUrl(filePath);

            // 3. Update Database (This step is no longer strictly necessary if upsert: true handles overwriting,
            // but we need to update the client record with the new URL if it's a new upload or changed)
            const { error: updateError } = await supabase
                .from('clients')
                .update({ logo_url: publicUrl })
                .eq('id', client.id);

            if (updateError) {
                console.error('Supabase Database Update Error:', updateError);
                throw updateError;
            }

            // 4. Update State
            if (client) {
                setClient({ ...client, logo_url: publicUrl });
                setEditForm({ ...editForm, logo_url: publicUrl });
            }

        } catch (error: any) {
            console.error('Full catch error:', error);
            setConfirmModal({
                isOpen: true,
                title: 'Upload fehlgeschlagen',
                message: `Fehler beim Upload: ${error.message || 'Unbekannter Fehler'}.`,
                type: 'danger',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = async () => {
        if (!client || !client.logo_url) return;
        setConfirmModal({
            isOpen: true,
            title: 'Logo entfernen?',
            message: 'Möchtest du das aktuelle Firmenlogo wirklich entfernen?',
            type: 'warning',
            confirmText: 'Entfernen',
            showCancel: true,
            action: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                await executeRemoveImage();
            }
        });
    };

    const executeRemoveImage = async () => {
        try {
            // Extract path from URL if possible, or just nullify in DB
            // Assuming we just want to clear it from the client record
            const { error } = await supabase
                .from('clients')
                .update({ logo_url: null })
                .eq('id', client.id);

            if (error) throw error;

            if (client) {
                setClient({ ...client, logo_url: null });
                setEditForm({ ...editForm, logo_url: null });
            }
        } catch (error: any) {
            setConfirmModal({
                isOpen: true,
                title: 'Fehler',
                message: 'Das Logo konnte nicht entfernt werden.',
                type: 'danger',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
        } finally {
            setIsUploading(false);
        }
    };


    if (loading) return <div className="p-8 text-text-placeholder">Lade Kundendaten...</div>;
    if (!client) return <div className="p-8 text-text-placeholder">Kunde nicht gefunden.</div>;

    // Helper Styles
    const inputStyle = "bg-surface border border-default text-text-primary rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-black placeholder-gray-400 transition shadow-sm w-full font-medium";
    const labelStyle = "text-[10px] font-bold text-text-placeholder uppercase tracking-widest mb-1.5 block";

    return (
        <div className="min-h-screen bg-subtle/50 p-6 lg:p-12 animate-in fade-in duration-500">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* HEADER NAV */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <button onClick={() => router.back()} className="text-text-placeholder hover:text-text-primary flex items-center gap-2 transition font-medium text-sm w-fit">
                        <ArrowLeft size={18} /> Zurück
                    </button>
                    {isAdmin && !isEditing && (
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-surface border border-default text-text-secondary rounded-xl font-bold text-sm hover:bg-subtle transition shadow-sm">
                                <Edit2 size={16} /> <span className="hidden md:inline">Bearbeiten</span>
                            </button>
                            <button onClick={handleDeleteClient} className="flex items-center gap-2 px-4 py-2 bg-surface border border-red-100 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition shadow-sm">
                                <Trash size={16} /> <span className="hidden md:inline">Löschen</span>
                            </button>
                        </div>
                    )}
                    {isAdmin && isEditing && (
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-4 py-2 text-text-muted font-bold text-sm hover:text-text-primary transition">
                                <X size={18} /> Abbrechen
                            </button>
                            <button onClick={handleSaveClient} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition shadow-lg">
                                <Save size={16} /> Speichern
                            </button>
                        </div>
                    )}
                </div>

                {/* HEADER CARD */}
                <div className="bg-surface rounded-2xl shadow-sm border border-default overflow-hidden">
                    <div className="bg-gray-900 text-white p-8 md:p-12 relative overflow-hidden">
                        {/* decorative glowing blob */}
                        <div className="absolute -top-20 -right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="relative z-10">
                            {/* LOGO & TITLE ROW */}
                            <div className="flex items-start gap-6 mb-8">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                {/* Logo with Upload Overlay */}
                                <div
                                    className={`relative w-20 h-20 md:w-24 md:h-24 bg-surface rounded-2xl flex items-center justify-center p-2 shadow-lg shrink-0 group/logo overflow-hidden ${isAdmin ? 'cursor-pointer' : ''}`}
                                    onClick={() => isAdmin && fileInputRef.current?.click()}
                                >
                                    {client?.logo_url ? (
                                        <img src={client.logo_url} className="w-full h-full object-contain" alt="Logo" />
                                    ) : (
                                        <span className="text-2xl font-bold text-text-placeholder">{client?.name.substring(0, 2).toUpperCase()}</span>
                                    )}

                                    {/* Upload Overlay */}
                                    {isAdmin && (
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                            {isUploading ? (
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    <div
                                                        className="flex flex-col items-center justify-center gap-1 hover:scale-110 transition-transform"
                                                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                                    >
                                                        <Edit2 size={16} className="text-white" />
                                                        <span className="text-[10px] text-white font-bold uppercase tracking-tight">Ändern</span>
                                                    </div>
                                                    {client.logo_url && (
                                                        <div
                                                            className="mt-2 text-[8px] text-red-300 hover:text-red-100 font-bold uppercase tracking-tighter"
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                                                        >
                                                            Entfernen
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 pt-2">
                                    {isEditing ? (
                                        <div className="space-y-4 max-w-lg">
                                            <div>
                                                <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1.5 block">Firmenname</label>
                                                <input
                                                    className="bg-surface/10 border border-white/20 text-white rounded-xl p-3 text-2xl font-bold w-full outline-none focus:bg-surface/20 transition placeholder-white/30"
                                                    value={editForm.name}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 leading-tight">{client.name}</h1>
                                            <p className="text-white/60 font-medium">Kundenprofil</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contact Details Grid - Refined */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-white/10">
                                {isEditing ? (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Website</label>
                                            <input className="bg-surface/10 border border-white/20 text-white rounded-lg p-2.5 text-sm w-full outline-none focus:bg-surface/20 transition placeholder-white/30" value={editForm.website || ''} onChange={e => setEditForm({ ...editForm, website: e.target.value })} placeholder="https://..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Email</label>
                                            <input className="bg-surface/10 border border-white/20 text-white rounded-lg p-2.5 text-sm w-full outline-none focus:bg-surface/20 transition placeholder-white/30" value={editForm.general_email || ''} onChange={e => setEditForm({ ...editForm, general_email: e.target.value })} placeholder="info@company.com" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Telefon</label>
                                            <input className="bg-surface/10 border border-white/20 text-white rounded-lg p-2.5 text-sm w-full outline-none focus:bg-surface/20 transition placeholder-white/30" value={editForm.general_phone || ''} onChange={e => setEditForm({ ...editForm, general_phone: e.target.value })} placeholder="+43 ..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Adresse</label>
                                            <input className="bg-surface/10 border border-white/20 text-white rounded-lg p-2.5 text-sm w-full outline-none focus:bg-surface/20 transition placeholder-white/30" value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} placeholder="Straße, PLZ Ort" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <a href={client.website} target="_blank" className="flex items-center gap-4 p-3 rounded-xl bg-surface/5 hover:bg-surface/10 transition group border border-white/5 hover:border-white/20">
                                            <div className="w-10 h-10 rounded-full bg-surface/10 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition"><Globe size={18} /></div>
                                            <div className="overflow-hidden">
                                                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5">Website</div>
                                                <div className="text-sm font-medium text-white truncate">{client.website ? client.website.replace('https://', '') : '-'}</div>
                                            </div>
                                        </a>
                                        <a href={`mailto:${client.general_email}`} className="flex items-center gap-4 p-3 rounded-xl bg-surface/5 hover:bg-surface/10 transition group border border-white/5 hover:border-white/20">
                                            <div className="w-10 h-10 rounded-full bg-surface/10 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition"><Mail size={18} /></div>
                                            <div className="overflow-hidden">
                                                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5">Email</div>
                                                <div className="text-sm font-medium text-white truncate">{client.general_email || '-'}</div>
                                            </div>
                                        </a>
                                        <a href={`tel:${client.general_phone}`} className="flex items-center gap-4 p-3 rounded-xl bg-surface/5 hover:bg-surface/10 transition group border border-white/5 hover:border-white/20">
                                            <div className="w-10 h-10 rounded-full bg-surface/10 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition"><Phone size={18} /></div>
                                            <div className="overflow-hidden">
                                                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5">Telefon</div>
                                                <div className="text-sm font-medium text-white truncate">{client.general_phone || '-'}</div>
                                            </div>
                                        </a>
                                        <div className="flex items-center gap-4 p-3 rounded-xl bg-surface/5 border border-white/5">
                                            <div className="w-10 h-10 rounded-full bg-surface/10 flex items-center justify-center text-white shrink-0"><MapPin size={18} /></div>
                                            <div className="overflow-hidden">
                                                <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5">Adresse</div>
                                                <div className="text-sm font-medium text-white truncate">{client.address || '-'}</div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN (2/3) */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* ABOUT SECTION */}
                        <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Building size={16} className="text-text-placeholder" /> Über das Unternehmen
                            </h3>
                            {isEditing ? (
                                <textarea
                                    className={inputStyle + " h-32 resize-none"}
                                    placeholder="Beschreibung des Unternehmens..."
                                    value={editForm.description || ''}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                />
                            ) : (
                                <p className="text-text-secondary leading-relaxed text-lg">
                                    {client.description || <span className="text-text-placeholder italic">Keine Beschreibung hinterlegt.</span>}
                                </p>
                            )}
                        </div>

                        {/* LOGBOOK (Internal Notes replacement) */}
                        <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                <FileText size={16} className="text-text-placeholder" /> Logbuch & Notizen
                            </h3>

                            {/* Create Log */}
                            <div className="bg-subtle/50 p-4 rounded-xl border border-default mb-8">
                                <input
                                    className="w-full bg-surface border border-default rounded-lg px-4 py-2 text-sm font-bold text-text-primary placeholder-gray-400 focus:ring-2 focus:ring-accent outline-none mb-2"
                                    placeholder="Titel des Eintrags (z.B. Meeting Notiz)"
                                    value={newLog.title}
                                    onChange={e => setNewLog({ ...newLog, title: e.target.value })}
                                />
                                <textarea
                                    className="w-full h-24 bg-surface border border-default rounded-lg px-4 py-3 text-sm text-text-secondary placeholder-gray-400 focus:ring-2 focus:ring-accent outline-none resize-none mb-3"
                                    placeholder="Was gibt es Neues?"
                                    value={newLog.content}
                                    onChange={e => setNewLog({ ...newLog, content: e.target.value })}
                                />
                                <div className="flex justify-end">
                                    <button
                                        onClick={handlePostLog}
                                        disabled={!newLog.title || !newLog.content || isPostingLog}
                                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition disabled:opacity-50"
                                    >
                                        <Send size={14} /> Eintrag speichern
                                    </button>
                                </div>
                            </div>

                            {/* Logs Feed */}
                            <div className="space-y-6">
                                {logs.length === 0 ? (
                                    <div className="text-center text-text-placeholder text-sm py-4">Noch keine Einträge.</div>
                                ) : (
                                    logs.map(log => (
                                        <div key={log.id} className="relative pl-6 border-l-2 border-default pb-2 group">
                                            <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-300 ring-4 ring-white group-hover:bg-accent transition-colors"></div>

                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h4 className="font-bold text-text-primary text-base">{editingLogId === log.id ? "Eintrag bearbeiten" : log.title}</h4>
                                                    <div className="text-xs text-text-placeholder flex items-center gap-2 mt-1">
                                                        <span className="font-medium text-text-muted">{log.employees?.name || 'Unbekannt'}</span>
                                                        <span>•</span>
                                                        <span>{new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>

                                                {/* Actions (Edit/Delete) - Allow for Author or Admin */}
                                                {(isAdmin || currentUser?.id === log.author_id) && !editingLogId && (
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                        <button onClick={() => { setEditingLogId(log.id); setEditLogData({ title: log.title, content: log.content }) }} className="p-1 text-text-placeholder hover:text-black"><Edit2 size={12} /></button>
                                                        <button onClick={() => handleDeleteLog(log.id)} className="p-1 text-text-placeholder hover:text-red-500"><Trash size={12} /></button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            {editingLogId === log.id ? (
                                                <div className="bg-surface p-4 rounded-xl border border-accent-subtle mt-2 shadow-sm">
                                                    <input
                                                        className="w-full border-b border-default py-2 mb-2 font-bold text-sm outline-none"
                                                        value={editLogData.title}
                                                        onChange={e => setEditLogData({ ...editLogData, title: e.target.value })}
                                                    />
                                                    <textarea
                                                        className="w-full h-24 outline-none text-sm text-text-secondary resize-none"
                                                        value={editLogData.content}
                                                        onChange={e => setEditLogData({ ...editLogData, content: e.target.value })}
                                                    />
                                                    <div className="flex justify-end gap-2 mt-2">
                                                        <button onClick={() => setEditingLogId(null)} className="text-xs text-text-placeholder font-bold px-2 py-1 hover:bg-hover rounded">Abbrechen</button>
                                                        <button onClick={handleUpdateLog} className="text-xs bg-black text-white px-3 py-1 rounded font-bold">Update</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap bg-subtle p-4 rounded-xl border border-default/50">
                                                    {log.content}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* PROJECTS */}
                        <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Briefcase size={16} className="text-text-placeholder" /> Aktive Projekte ({projects.length})
                            </h3>
                            {projects.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {projects.map(p => (
                                        <div key={p.id} className="p-5 rounded-xl border border-default hover:border-default hover:shadow-md transition cursor-pointer bg-subtle/30 group" onClick={() => router.push(`/uebersicht?projectId=${p.id}`)}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="font-bold text-text-primary group-hover:text-accent transition">{p.title}</div>
                                                <div className={`w-2 h-2 rounded-full mt-1.5 ${p.status === 'Fertig' ? 'bg-green-500' : 'bg-accent'}`}></div>
                                            </div>
                                            <div className="text-xs text-text-muted font-medium tracking-wide">{p.job_number} • {p.status}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="text-text-placeholder text-sm">Keine aktiven Projekte.</div>}
                        </div>
                    </div>

                    {/* RIGHT COLUMN (1/3) - CONTACTS */}
                    <div className="space-y-8">
                        <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm sticky top-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Ansprechpartner</h3>
                                {(!isAddingContact) && (
                                    <button onClick={() => setIsAddingContact(true)} className="p-2 bg-subtle hover:bg-hover rounded-lg transition text-text-muted hover:text-black">
                                        <Plus size={18} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {contacts.map(contact => (
                                    <div key={contact.id} className="group bg-subtle/50 p-4 rounded-xl border border-default hover:border-default transition relative">
                                        {(isAdmin || currentUser?.role === 'admin') && (
                                            <button onClick={() => handleDeleteContact(contact.id)} className="absolute top-2 right-2 p-1.5 text-text-placeholder hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                                <Trash size={14} />
                                            </button>
                                        )}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-surface border border-default flex items-center justify-center text-text-placeholder font-bold shadow-sm">
                                                {contact.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-text-primary text-sm">{contact.name}</div>
                                                <div className="text-xs text-text-muted">{contact.role || 'Mitarbeiter'}</div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {contact.email && (
                                                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition group/link">
                                                    <Mail size={12} className="text-text-placeholder group-hover/link:text-accent" />
                                                    <span className="truncate">{contact.email}</span>
                                                </a>
                                            )}
                                            {contact.phone && (
                                                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-text-secondary hover:text-green-600 transition group/link">
                                                    <Phone size={12} className="text-text-placeholder group-hover/link:text-green-500" />
                                                    <span className="truncate">{contact.phone}</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {contacts.length === 0 && (
                                    <div className="text-center py-12 px-4 rounded-xl border-2 border-dashed border-default text-text-placeholder text-sm">
                                        Keine Ansprechpartner.
                                        <br />
                                        <button onClick={() => setIsAddingContact(true)} className="text-accent font-bold hover:underline mt-2">Jetzt hinzufügen</button>
                                    </div>
                                )}
                            </div>
                        </div>
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

                <ContactModal
                    isOpen={isAddingContact}
                    onClose={() => setIsAddingContact(false)}
                    onSave={handleSaveContact}
                />
            </div>
        </div>
    );
}
