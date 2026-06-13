'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { useApp } from '../../context/AppContext';
import { Client, ClientContact, ClientLog, Project, ProjectInvoice, ProjectLink, TimeEntry } from '../../types';
import { ArrowLeft, Phone, Mail, Globe, MapPin, Building, Trash, Edit2, Plus, User, Save, X, Briefcase, FileText, Send, Calendar, MoreHorizontal, TrendingUp, Receipt, Activity, Folder, Users as UsersIcon, ExternalLink, ArrowRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import ContactModal from '../../components/Modals/ContactModal';
import { usePageTitle } from '../../hooks/usePageTitle';
import { getStatusStyle, getStatusDot } from '../../utils';
import RichTextEditor from '../../components/UI/RichTextEditor';
import RichTextDisplay from '../../components/UI/RichTextDisplay';
import { toast } from 'sonner';

type TabId = 'overview' | 'projects' | 'finances' | 'activity' | 'documents' | 'team';

const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'overview', label: 'Übersicht', icon: Building },
    { id: 'projects', label: 'Projekte', icon: Briefcase },
    { id: 'finances', label: 'Finanzen', icon: Receipt },
    { id: 'activity', label: 'Aktivität', icon: Activity },
    { id: 'documents', label: 'Dokumente', icon: Folder },
    { id: 'team', label: 'Team', icon: UsersIcon }
];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'gerade eben';
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `vor ${diffH} Std.`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `vor ${diffD} Tagen`;
    return new Date(iso).toLocaleDateString('de-DE');
}

export default function ClientDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { session, currentUser, employees } = useApp();
    const clientId = params.id as string;

    const [client, setClient] = useState<Client | null>(null);
    usePageTitle(client?.name || 'Kunde');
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [logs, setLogs] = useState<ClientLog[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Client>>({});

    // Contact Management State
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
    const [newContact, setNewContact] = useState<Partial<ClientContact>>({});

    // Logbook State
    const [newLog, setNewLog] = useState({ title: '', content: '' });
    const [logTitleError, setLogTitleError] = useState(false);
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

        // 3. Fetch Projects (with project_links for documents tab)
        const { data: projectsData } = await supabase.from('projects').select('*, clients(*)').eq('client_id', clientId).order('created_at', { ascending: false });
        const projectList = (projectsData || []) as any as Project[];
        setProjects(projectList);

        const projectIds = projectList.map(p => p.id);

        // 4. Fetch Logs (Logbook)
        const { data: logsData } = await supabase
            .from('client_logs')
            .select(`*, employees:author_id(id, name, initials)`)
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });
        if (logsData) setLogs(logsData as any);

        // 5. Fetch Invoices for all projects of this client
        if (projectIds.length > 0) {
            const { data: invoiceData } = await supabase
                .from('project_invoices')
                .select('*')
                .in('project_id', projectIds)
                .order('invoice_date', { ascending: false });
            if (invoiceData) setInvoices(invoiceData as any);

            // 6. Fetch Time Entries
            const { data: timeData } = await supabase
                .from('time_entries')
                .select('*')
                .in('project_id', projectIds);
            if (timeData) setTimeEntries(timeData as any);
        } else {
            setInvoices([]);
            setTimeEntries([]);
        }

        setLoading(false);
    };

    // ─── Derived Data / KPIs ─────────────────────────────────────────
    const activeProjects = useMemo(
        () => projects.filter(p => p.status !== 'Erledigt' && p.status !== 'Abgebrochen'),
        [projects]
    );
    const completedProjects = useMemo(
        () => projects.filter(p => p.status === 'Erledigt'),
        [projects]
    );

    const finalInvoices = useMemo(() => invoices.filter(i => i.status === 'final'), [invoices]);
    const openInvoices = useMemo(() => invoices.filter(i => i.status === 'draft'), [invoices]);

    const totalRevenue = useMemo(
        () => finalInvoices.reduce((sum, i) => sum + (Number(i.total_gross) || 0), 0),
        [finalInvoices]
    );
    const openInvoicesAmount = useMemo(
        () => openInvoices.reduce((sum, i) => sum + (Number(i.total_gross) || 0), 0),
        [openInvoices]
    );

    // Project value lookup (revenue per project from final invoices)
    const projectRevenueMap = useMemo(() => {
        const map: Record<string, number> = {};
        for (const inv of finalInvoices) {
            map[inv.project_id] = (map[inv.project_id] || 0) + (Number(inv.total_gross) || 0);
        }
        return map;
    }, [finalInvoices]);

    // Aggregated documents from all project_links
    const allDocuments = useMemo(() => {
        const docs: (ProjectLink & { project_id: string; project_title: string })[] = [];
        for (const p of projects) {
            for (const link of (p.project_links || [])) {
                docs.push({ ...link, project_id: p.id, project_title: p.title });
            }
        }
        return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [projects]);

    // Team aggregation: hours per employee
    const teamStats = useMemo(() => {
        const totals: Record<string, { hours: number; lastEntry: string }> = {};
        for (const t of timeEntries) {
            if (!t.employee_id) continue;
            const existing = totals[t.employee_id] || { hours: 0, lastEntry: '' };
            existing.hours += Number(t.hours) || 0;
            if (!existing.lastEntry || (t.date > existing.lastEntry)) existing.lastEntry = t.date;
            totals[t.employee_id] = existing;
        }
        return Object.entries(totals)
            .map(([empId, { hours, lastEntry }]) => {
                const emp = employees.find(e => e.id === empId);
                return { employee: emp, hours, lastEntry };
            })
            .filter(t => t.employee)
            .sort((a, b) => b.hours - a.hours);
    }, [timeEntries, employees]);

    const totalHours = useMemo(
        () => timeEntries.reduce((sum, t) => sum + (Number(t.hours) || 0), 0),
        [timeEntries]
    );

    // Upcoming deadlines (active projects with future deadlines)
    const upcomingDeadlines = useMemo(() => {
        const now = Date.now();
        return activeProjects
            .filter(p => p.deadline && new Date(p.deadline).getTime() >= now - 1000 * 60 * 60 * 24 * 3)
            .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
            .slice(0, 5);
    }, [activeProjects]);

    // Activity timeline: logs + derived events
    const activityTimeline = useMemo(() => {
        type ActivityEvent = {
            id: string;
            type: 'log' | 'project_created' | 'invoice_created' | 'invoice_finalized';
            date: string;
            title: string;
            description?: string;
            author?: string;
            meta?: any;
        };
        const events: ActivityEvent[] = [];

        for (const log of logs) {
            events.push({
                id: `log-${log.id}`,
                type: 'log',
                date: log.created_at,
                title: log.title,
                description: log.content,
                author: log.employees?.name
            });
        }

        for (const p of projects) {
            if (p.created_at) {
                events.push({
                    id: `proj-${p.id}`,
                    type: 'project_created',
                    date: p.created_at,
                    title: `Projekt angelegt: ${p.title}`,
                    description: p.job_number,
                    meta: { projectId: p.id }
                });
            }
        }

        for (const inv of invoices) {
            const projTitle = projects.find(p => p.id === inv.project_id)?.title || 'Unbekanntes Projekt';
            events.push({
                id: `inv-${inv.id}`,
                type: inv.status === 'final' ? 'invoice_finalized' : 'invoice_created',
                date: inv.created_at || inv.invoice_date,
                title: inv.status === 'final' ? `Rechnung finalisiert: ${inv.invoice_number}` : `Rechnung erstellt: ${inv.invoice_number}`,
                description: `${projTitle} • ${formatCurrency(Number(inv.total_gross) || 0)}`,
                meta: { projectId: inv.project_id }
            });
        }

        return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [logs, projects, invoices]);

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
        if (!newLog.title.trim()) { setLogTitleError(true); toast.error('Bitte gib einen Titel für den Eintrag ein.'); return; }
        if (!newLog.content || !newLog.content.replace(/<[^>]*>/g, '').trim()) { toast.error('Bitte gib einen Text für den Eintrag ein.'); return; }
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
            toast.error(`Eintrag konnte nicht gespeichert werden: ${error.message}`);
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

        const showContactError = (error: { message: string }) => {
            console.error("Save Contact Error:", error);
            setConfirmModal({
                isOpen: true,
                title: 'Fehler beim Kontakt',
                message: `Der Kontakt konnte nicht gespeichert werden: ${error.message}`,
                type: 'danger',
                action: async () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
                confirmText: 'OK',
                showCancel: false
            });
        };

        // Bearbeiten (vorhandener Kontakt) vs. Neu anlegen
        if (contactData.id) {
            const { data, error } = await supabase.from('client_contacts').update({
                name: contactData.name,
                salutation: contactData.salutation ?? null,
                role: contactData.role ?? null,
                email: contactData.email ?? null,
                phone: contactData.phone ?? null,
            }).eq('id', contactData.id).select().single();

            if (error) showContactError(error);
            else if (data) {
                setContacts(contacts.map(c => c.id === data.id ? data : c));
                setEditingContact(null);
            }
            return;
        }

        const { data, error } = await supabase.from('client_contacts').insert([{
            ...contactData,
            client_id: client.id,
            organization_id: orgId
        }]).select().single();

        if (error) {
            showContactError(error);
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
        if (!client) return;
        try {
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
            <div className="max-w-7xl mx-auto space-y-6">

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
                                    className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center p-2 shadow-lg shrink-0 group/logo overflow-hidden ${isAdmin ? 'cursor-pointer' : ''}`}
                                    style={{ background: client?.logo_url ? '#ffffff' : 'var(--bg-subtle)' }}
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

                {/* KPI COCKPIT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Revenue */}
                    <div className="bg-surface rounded-2xl border border-default shadow-sm p-6 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success-text)' }}>
                            <TrendingUp size={22} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Gesamt-Umsatz</div>
                            <div className="text-2xl font-black text-text-primary tracking-tight mt-1">{formatCurrency(totalRevenue)}</div>
                            <div className="text-[11px] text-text-muted mt-0.5">{finalInvoices.length} {finalInvoices.length === 1 ? 'Rechnung' : 'Rechnungen'} final</div>
                        </div>
                    </div>

                    {/* Open Invoices */}
                    <div className="bg-surface rounded-2xl border border-default shadow-sm p-6 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={openInvoices.length > 0
                                ? { background: 'var(--color-warning-subtle)', color: 'var(--color-warning-text)' }
                                : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
                            <Receipt size={22} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Offene Rechnungen</div>
                            <div className="text-2xl font-black text-text-primary tracking-tight mt-1">{formatCurrency(openInvoicesAmount)}</div>
                            <div className="text-[11px] text-text-muted mt-0.5">{openInvoices.length} im Entwurf</div>
                        </div>
                    </div>

                    {/* Projects */}
                    <div className="bg-surface rounded-2xl border border-default shadow-sm p-6 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent-subtle/30 text-accent flex items-center justify-center flex-shrink-0">
                            <Briefcase size={22} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Projekte</div>
                            <div className="flex items-baseline gap-3 mt-1">
                                <span className="text-2xl font-black text-text-primary tracking-tight">{activeProjects.length}</span>
                                <span className="text-xs font-bold text-text-muted">aktiv</span>
                                <span className="text-text-placeholder">/</span>
                                <span className="text-lg font-bold text-text-muted">{completedProjects.length}</span>
                                <span className="text-xs font-bold text-text-muted">erledigt</span>
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5">{projects.length} gesamt</div>
                        </div>
                    </div>
                </div>

                {/* CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN (2/3) - TABS */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* TAB NAVIGATION */}
                        <div className="bg-surface rounded-2xl border border-default shadow-sm p-2 flex items-center gap-1 overflow-x-auto custom-scrollbar">
                            {TABS.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${isActive
                                            ? 'bg-text-primary text-surface shadow-sm'
                                            : 'text-text-muted hover:text-text-primary hover:bg-hover'
                                            }`}
                                    >
                                        <Icon size={14} strokeWidth={2.5} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* TAB CONTENT */}
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                            {/* ── OVERVIEW TAB ── */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* About */}
                                    <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                            <Building size={16} className="text-text-placeholder" /> Über das Unternehmen
                                        </h3>
                                        {isEditing ? (
                                            <RichTextEditor
                                                value={editForm.description || ''}
                                                onChange={(html) => setEditForm({ ...editForm, description: html })}
                                                placeholder="Beschreibung des Unternehmens…"
                                                minHeight={120}
                                            />
                                        ) : (
                                            <RichTextDisplay
                                                html={client.description}
                                                className="leading-relaxed"
                                                fallback={<span className="text-text-placeholder italic">Keine Beschreibung hinterlegt.</span>}
                                            />
                                        )}
                                    </div>

                                    {/* Upcoming Deadlines */}
                                    <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                            <Calendar size={16} className="text-text-placeholder" /> Anstehende Deadlines
                                        </h3>
                                        {upcomingDeadlines.length === 0 ? (
                                            <p className="text-text-placeholder text-sm italic">Keine anstehenden Deadlines.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {upcomingDeadlines.map(p => {
                                                    const isOverdue = new Date(p.deadline!) < new Date();
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => router.push(`/uebersicht?projectId=${p.id}`)}
                                                            className="group w-full flex items-center gap-3 p-3 rounded-xl bg-subtle hover:bg-hover hover:shadow-sm border border-default hover:border-accent transition-all text-left"
                                                        >
                                                            <div className={`w-2 h-2 rounded-full ${getStatusDot(p.status)}`} />
                                                            <span className="text-sm font-bold text-text-primary flex-1 truncate group-hover:text-accent transition-colors">{p.title}</span>
                                                            <span className="text-[10px] font-bold text-text-muted">{p.job_number}</span>
                                                            <span className="text-xs font-bold" style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--text-muted)' }}>{new Date(p.deadline!).toLocaleDateString('de-DE')}</span>
                                                            <ArrowRight size={14} className="text-text-placeholder opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Latest Logs Preview */}
                                    <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                                                <FileText size={16} className="text-text-placeholder" /> Letzte Notizen
                                            </h3>
                                            {logs.length > 3 && (
                                                <button onClick={() => setActiveTab('activity')} className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">Alle anzeigen →</button>
                                            )}
                                        </div>
                                        {logs.length === 0 ? (
                                            <p className="text-text-placeholder text-sm italic">Noch keine Notizen. Wechsle zu "Aktivität" um den ersten Eintrag zu erstellen.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                {logs.slice(0, 3).map(log => (
                                                    <div key={log.id} className="p-4 rounded-xl bg-subtle border border-default">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <h4 className="font-bold text-text-primary text-sm">{log.title}</h4>
                                                            <span className="text-[10px] text-text-placeholder">{relativeTime(log.created_at)}</span>
                                                        </div>
                                                        <RichTextDisplay html={log.content} lineClamp={2} className="text-xs" />
                                                        <div className="text-[10px] text-text-muted mt-2 font-medium">{log.employees?.name || 'Unbekannt'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── PROJECTS TAB ── */}
                            {activeTab === 'projects' && (
                                <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                        <Briefcase size={16} className="text-text-placeholder" /> Alle Projekte ({projects.length})
                                    </h3>
                                    {projects.length === 0 ? (
                                        <div className="text-center py-12 text-text-placeholder">
                                            <Briefcase size={32} className="mx-auto mb-3 opacity-40" />
                                            <p className="text-sm">Noch keine Projekte für diesen Kunden.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {projects.map(p => {
                                                const revenue = projectRevenueMap[p.id] || 0;
                                                const todos = (p as any).todos as { is_done?: boolean }[] | undefined;
                                                const todoCount = todos?.length || 0;
                                                const doneCount = todos?.filter(t => t.is_done).length || 0;
                                                return (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => router.push(`/uebersicht?projectId=${p.id}`)}
                                                        className="group w-full flex items-center gap-4 p-4 rounded-xl bg-subtle hover:bg-hover hover:shadow-sm border border-default hover:border-accent transition-all text-left"
                                                    >
                                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(p.status)}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">{p.title}</span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(p.status)}`}>{p.status}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[10px] text-text-muted font-medium">
                                                                <span className="font-mono">{p.job_number}</span>
                                                                {p.deadline && (
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar size={10} />
                                                                        {new Date(p.deadline).toLocaleDateString('de-DE')}
                                                                    </span>
                                                                )}
                                                                {todoCount > 0 && (
                                                                    <span className="flex items-center gap-1">
                                                                        <CheckCircle2 size={10} />
                                                                        {doneCount}/{todoCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {revenue > 0 && (
                                                            <div className="text-right shrink-0">
                                                                <div className="text-xs font-black text-text-primary">{formatCurrency(revenue)}</div>
                                                                <div className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Umsatz</div>
                                                            </div>
                                                        )}
                                                        <ArrowRight size={14} className="text-text-placeholder opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── FINANCES TAB ── */}
                            {activeTab === 'finances' && (
                                <div className="space-y-6">
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-surface p-5 rounded-2xl border border-default shadow-sm">
                                            <div className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest mb-1">Anzahl Rechnungen</div>
                                            <div className="text-2xl font-black text-text-primary">{invoices.length}</div>
                                            <div className="text-[11px] text-text-muted mt-0.5">{finalInvoices.length} final · {openInvoices.length} Entwurf</div>
                                        </div>
                                        <div className="bg-surface p-5 rounded-2xl border border-default shadow-sm">
                                            <div className="text-[10px] font-bold text-text-placeholder uppercase tracking-widest mb-1">Ø Rechnungswert</div>
                                            <div className="text-2xl font-black text-text-primary">{formatCurrency(finalInvoices.length > 0 ? totalRevenue / finalInvoices.length : 0)}</div>
                                            <div className="text-[11px] text-text-muted mt-0.5">über finalisierte Rechnungen</div>
                                        </div>
                                    </div>

                                    {/* Invoice List */}
                                    <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                            <Receipt size={16} className="text-text-placeholder" /> Rechnungs-Historie
                                        </h3>
                                        {invoices.length === 0 ? (
                                            <div className="text-center py-12 text-text-placeholder">
                                                <Receipt size={32} className="mx-auto mb-3 opacity-40" />
                                                <p className="text-sm">Noch keine Rechnungen.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {invoices.map(inv => {
                                                    const proj = projects.find(p => p.id === inv.project_id);
                                                    const isFinal = inv.status === 'final';
                                                    return (
                                                        <button
                                                            key={inv.id}
                                                            onClick={() => router.push(`/uebersicht?projectId=${inv.project_id}`)}
                                                            className="group w-full flex items-center gap-4 p-4 rounded-xl bg-subtle hover:bg-hover hover:shadow-sm border border-default hover:border-accent transition-all text-left"
                                                        >
                                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                                style={isFinal
                                                                    ? { background: 'var(--color-success-subtle)', color: 'var(--color-success-text)' }
                                                                    : { background: 'var(--color-warning-subtle)', color: 'var(--color-warning-text)' }}>
                                                                {isFinal ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">{inv.invoice_number}</span>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFinal ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                        {isFinal ? 'Final' : 'Entwurf'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] text-text-muted font-medium">
                                                                    <span className="truncate">{proj?.title || 'Unbekanntes Projekt'}</span>
                                                                    <span>·</span>
                                                                    <span>{new Date(inv.invoice_date).toLocaleDateString('de-DE')}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="text-sm font-black text-text-primary">{formatCurrency(Number(inv.total_gross) || 0)}</div>
                                                                <div className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Brutto</div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── ACTIVITY TAB ── */}
                            {activeTab === 'activity' && (
                                <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                        <Activity size={16} className="text-text-placeholder" /> Aktivitäten & Logbuch
                                    </h3>

                                    {/* Create Log */}
                                    <div className="bg-subtle/50 p-4 rounded-xl border border-default mb-8">
                                        <input
                                            className="w-full bg-surface border rounded-lg px-4 py-2 text-sm font-bold text-text-primary placeholder-gray-400 focus:ring-2 focus:ring-accent outline-none mb-2"
                                            style={{ borderColor: logTitleError ? 'var(--color-danger)' : 'var(--border-default)' }}
                                            placeholder="Titel des Eintrags (z.B. Meeting Notiz)"
                                            value={newLog.title}
                                            onChange={e => { setNewLog({ ...newLog, title: e.target.value }); setLogTitleError(false); }}
                                        />
                                        <div className="mb-3">
                                            <RichTextEditor
                                                value={newLog.content}
                                                onChange={(html) => setNewLog({ ...newLog, content: html })}
                                                placeholder="Was gibt es Neues?"
                                                minHeight={90}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handlePostLog}
                                                disabled={isPostingLog}
                                                className="bg-text-primary text-surface px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:brightness-110 transition disabled:opacity-50"
                                            >
                                                <Send size={14} /> Eintrag speichern
                                            </button>
                                        </div>
                                    </div>

                                    {/* Timeline */}
                                    {activityTimeline.length === 0 ? (
                                        <div className="text-center py-12 text-text-placeholder">
                                            <Activity size={32} className="mx-auto mb-3 opacity-40" />
                                            <p className="text-sm">Noch keine Aktivität.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {activityTimeline.map(event => {
                                                const eventIcon = event.type === 'log' ? FileText : event.type === 'project_created' ? Briefcase : event.type === 'invoice_finalized' ? CheckCircle2 : Receipt;
                                                const Icon = eventIcon;
                                                const iconStyle: React.CSSProperties = event.type === 'log'
                                                    ? { background: 'var(--color-info-subtle)', color: 'var(--color-info-text)' }
                                                    : event.type === 'project_created'
                                                        ? { background: 'var(--accent-subtle)', color: 'var(--accent)' }
                                                        : event.type === 'invoice_finalized'
                                                            ? { background: 'var(--color-success-subtle)', color: 'var(--color-success-text)' }
                                                            : { background: 'var(--color-warning-subtle)', color: 'var(--color-warning-text)' };
                                                const isLog = event.type === 'log';
                                                const logRef = isLog ? logs.find(l => `log-${l.id}` === event.id) : null;
                                                const isEditingThis = logRef && editingLogId === logRef.id;

                                                return (
                                                    <div key={event.id} className="group relative pl-12">
                                                        <div className="absolute left-0 top-0 w-8 h-8 rounded-xl flex items-center justify-center" style={iconStyle}>
                                                            <Icon size={14} />
                                                        </div>
                                                        <div className="flex items-start justify-between mb-1">
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-bold text-text-primary text-sm">{isEditingThis ? 'Eintrag bearbeiten' : event.title}</h4>
                                                                <div className="text-[11px] text-text-placeholder flex items-center gap-2 mt-0.5">
                                                                    {event.author && <span className="font-medium text-text-muted">{event.author}</span>}
                                                                    {event.author && <span>·</span>}
                                                                    <span>{relativeTime(event.date)}</span>
                                                                </div>
                                                            </div>
                                                            {isLog && logRef && (isAdmin || currentUser?.id === logRef.author_id) && !editingLogId && (
                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                                    <button onClick={() => { setEditingLogId(logRef.id); setEditLogData({ title: logRef.title, content: logRef.content }) }} className="p-1 text-text-placeholder hover:text-text-primary"><Edit2 size={12} /></button>
                                                                    <button onClick={() => handleDeleteLog(logRef.id)} className="p-1 text-text-placeholder hover:text-[color:var(--color-danger)]"><Trash size={12} /></button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isEditingThis && logRef ? (
                                                            <div className="mt-2 space-y-2">
                                                                <input
                                                                    className="w-full border-b border-default py-2 font-bold text-sm outline-none bg-transparent"
                                                                    value={editLogData.title}
                                                                    onChange={e => setEditLogData({ ...editLogData, title: e.target.value })}
                                                                />
                                                                <RichTextEditor
                                                                    value={editLogData.content}
                                                                    onChange={(html) => setEditLogData({ ...editLogData, content: html })}
                                                                    placeholder="Inhalt"
                                                                    minHeight={90}
                                                                />
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={() => setEditingLogId(null)} className="text-xs text-text-placeholder font-bold px-2 py-1 hover:bg-hover rounded">Abbrechen</button>
                                                                    <button onClick={handleUpdateLog} className="text-xs bg-text-primary text-surface px-3 py-1 rounded font-bold">Update</button>
                                                                </div>
                                                            </div>
                                                        ) : event.description ? (
                                                            <div className={`mt-2 ${isLog ? 'bg-subtle p-3 rounded-xl border border-default/50' : 'text-text-muted text-sm'}`}>
                                                                {isLog ? (
                                                                    <RichTextDisplay html={event.description} />
                                                                ) : (
                                                                    <button
                                                                        onClick={() => event.meta?.projectId && router.push(`/uebersicht?projectId=${event.meta.projectId}`)}
                                                                        className="hover:text-accent transition-colors"
                                                                    >
                                                                        {event.description}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── DOCUMENTS TAB ── */}
                            {activeTab === 'documents' && (
                                <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-6 flex items-center gap-2">
                                        <Folder size={16} className="text-text-placeholder" /> Dokumente & Links ({allDocuments.length})
                                    </h3>
                                    {allDocuments.length === 0 ? (
                                        <div className="text-center py-12 text-text-placeholder">
                                            <Folder size={32} className="mx-auto mb-3 opacity-40" />
                                            <p className="text-sm">Keine Dokumente in den Projekten dieses Kunden.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {allDocuments.map(doc => (
                                                <a
                                                    key={doc.id}
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="group flex items-start gap-3 p-4 rounded-xl bg-subtle hover:bg-hover hover:shadow-sm border border-default hover:border-accent transition-all"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-surface border border-default flex items-center justify-center text-text-muted flex-shrink-0 group-hover:text-accent group-hover:border-accent transition-colors">
                                                        <FileText size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">{doc.name}</div>
                                                        <div className="text-[10px] text-text-muted truncate uppercase tracking-widest font-bold mt-0.5">{doc.type} · {doc.project_title}</div>
                                                    </div>
                                                    <ExternalLink size={12} className="text-text-placeholder opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── TEAM TAB ── */}
                            {activeTab === 'team' && (
                                <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                                            <UsersIcon size={16} className="text-text-placeholder" /> Team-Beteiligung
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
                                            <Clock size={11} />
                                            {totalHours.toFixed(1)}h gesamt
                                        </div>
                                    </div>
                                    {teamStats.length === 0 ? (
                                        <div className="text-center py-12 text-text-placeholder">
                                            <UsersIcon size={32} className="mx-auto mb-3 opacity-40" />
                                            <p className="text-sm">Noch keine Zeit auf Projekten dieses Kunden erfasst.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {teamStats.map(({ employee, hours, lastEntry }) => {
                                                if (!employee) return null;
                                                const percentage = totalHours > 0 ? (hours / totalHours) * 100 : 0;
                                                return (
                                                    <div key={employee.id} className="p-4 rounded-xl bg-subtle border border-default">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            {employee.avatar_url ? (
                                                                <img src={employee.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt={employee.name} />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-full bg-surface border border-default flex items-center justify-center text-xs font-bold text-text-primary flex-shrink-0">
                                                                    {employee.initials || employee.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-bold text-text-primary truncate">{employee.name}</div>
                                                                <div className="text-[10px] text-text-muted">
                                                                    {employee.job_title || 'Mitarbeiter'} · Zuletzt erfasst {lastEntry ? new Date(lastEntry).toLocaleDateString('de-DE') : '—'}
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="text-sm font-black text-text-primary">{hours.toFixed(1)}h</div>
                                                                <div className="text-[9px] text-text-muted uppercase tracking-widest font-bold">{percentage.toFixed(0)}%</div>
                                                            </div>
                                                        </div>
                                                        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                                                            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${percentage}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN (1/3) - CONTACTS */}
                    <div className="space-y-8">
                        <div className="bg-surface p-8 rounded-2xl border border-default shadow-sm sticky top-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Ansprechpartner ({contacts.length})</h3>
                                {(!isAddingContact) && (
                                    <button onClick={() => setIsAddingContact(true)} className="p-2 bg-subtle hover:bg-hover rounded-lg transition text-text-muted hover:text-text-primary" title="Kontakt hinzufügen">
                                        <Plus size={18} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {contacts.map(contact => (
                                    <div key={contact.id} className="group bg-subtle/50 p-4 rounded-xl border border-default hover:border-accent/40 hover:shadow-sm transition relative">
                                        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                            <button onClick={() => setEditingContact(contact)} className="p-1.5 text-text-placeholder hover:text-accent transition" title="Kontakt bearbeiten">
                                                <Edit2 size={14} />
                                            </button>
                                            {(isAdmin || currentUser?.role === 'admin') && (
                                                <button onClick={() => handleDeleteContact(contact.id)} className="p-1.5 text-text-placeholder hover:text-[color:var(--color-danger)] transition" title="Kontakt löschen">
                                                    <Trash size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-full bg-surface border border-default flex items-center justify-center text-text-placeholder font-bold shadow-sm">
                                                {contact.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-text-primary text-sm truncate">
                                                    {contact.salutation === 'herr' ? 'Herr ' : contact.salutation === 'frau' ? 'Frau ' : ''}{contact.name}
                                                </div>
                                                <div className="text-xs text-text-muted truncate">{contact.role || 'Mitarbeiter'}</div>
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
                                                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-text-secondary hover:text-[color:var(--color-success)] transition group/link">
                                                    <Phone size={12} className="text-text-placeholder group-hover/link:text-[color:var(--color-success)]" />
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
                    isOpen={isAddingContact || !!editingContact}
                    contact={editingContact}
                    onClose={() => { setIsAddingContact(false); setEditingContact(null); }}
                    onSave={handleSaveContact}
                />
            </div>
        </div>
    );
}
