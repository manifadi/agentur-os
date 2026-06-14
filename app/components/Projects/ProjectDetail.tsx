import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Trash2, Settings, FileText, Upload, Eye, X, Star, Layout, Clock, Copy, Plus, Calculator, Edit3, CheckSquare, Folder, BarChart3, ExternalLink, ListChecks, Receipt, ChevronDown, Check } from 'lucide-react';
import ViewSwitcher from '../UI/ViewSwitcher';
import { Project, Employee, Todo, ProjectLog, AgencySettings, OrganizationTemplate, ProjectLink } from '../../types';
import { getStatusStyle, getStatusDot, getDeadlineColorClass, STATUS_OPTIONS } from '../../utils';
import { toast } from 'sonner';
import UserAvatar from '../UI/UserAvatar';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import { supabase } from '../../supabaseClient';
import TodoList from './TodoList';
import Logbook from './Logbook';
import { useApp } from '../../context/AppContext';
import TimeEntryModal from '../Modals/TimeEntryModal';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import ContractPDF from '../Contracts/ContractPDF';
import ProjectContractTab from './ProjectContractTab';
import ProjectInvoiceTab from './ProjectInvoiceTab';
import ProjectDocumentsTab from './ProjectDocumentsTab';
import ProjectLeistungenTab from './ProjectLeistungenTab';
import ProjectReportingTab from './ProjectReportingTab';
import HourlyRatesSidebar from './HourlyRatesSidebar';
import CalculationImportModal from '../Modals/CalculationImportModal';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import TaskDetailSidebar from '../Tasks/TaskDetailSidebar';
import ConfirmModal from '../Modals/ConfirmModal';
import DuplicateProjectModal from '../Modals/DuplicateProjectModal';

interface ProjectDetailProps {
    project: Project;
    employees: Employee[];
    onClose: () => void;
    onUpdateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    onDeleteProject: () => void;
    currentEmployee?: Employee;
    /** Kontextsensitiver Zurück-Button-Text (z.B. "Zurück zum Dashboard"). */
    backLabel?: string;
}

export default function ProjectDetail({ project, employees, onClose, onUpdateProject, onDeleteProject, currentEmployee, backLabel = 'Zurück zur Übersicht' }: ProjectDetailProps) {
    const { clients, projects } = useApp();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [todos, setTodos] = useState<Todo[]>([]);
    const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
    const [logs, setLogs] = useState<ProjectLog[]>([]);
    const [timeEntries, setTimeEntries] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showTimeModal, setShowTimeModal] = useState(false);

    // Edit Modal State
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        title: project.title,
        jobNr: project.job_number,
        status: project.status,
        deadline: project.deadline || '',
        google_doc_url: project.google_doc_url || '',
        pmId: project.project_manager_id || '',
        clientId: project.client_id
    });

    const highlightId = searchParams.get('highlight_task_id');

    const pdfInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    // Tab navigation
    const [activeTab, setActiveTab] = useState<'uebersicht' | 'aufgaben' | 'kalkulation' | 'reporting' | 'dokumente'>('uebersicht');
    const [kalkulationView, setKalkulationView] = useState<'leistungen' | 'angebot' | 'rechnung'>('leistungen');
    const [showRatesSidebar, setShowRatesSidebar] = useState(false);
    const [agencySettings, setAgencySettings] = useState<AgencySettings | null>(null);
    const [templates, setTemplates] = useState<OrganizationTemplate[]>([]);
    const [contractIntro, setContractIntro] = useState('');
    const [contractOutro, setContractOutro] = useState('');
    const [showPDFPreview, setShowPDFPreview] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
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
        type: 'danger'
    });
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // Sync Tab with URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        const map: Record<string, 'uebersicht' | 'aufgaben' | 'kalkulation' | 'reporting' | 'dokumente'> = {
            uebersicht: 'uebersicht', aufgaben: 'aufgaben', kalkulation: 'kalkulation',
            reporting: 'reporting', dokumente: 'dokumente',
            details: 'uebersicht', contract: 'kalkulation', invoice: 'kalkulation', documents: 'dokumente',
        };
        if (tab && map[tab]) setActiveTab(map[tab]);
    }, [searchParams]);

    const handleTabChange = (tab: 'uebersicht' | 'aufgaben' | 'kalkulation' | 'reporting' | 'dokumente') => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        // replace statt push: Tab-Wechsel sollen die Browser-Historie nicht
        // zumüllen (sonst springt "Zurück" durch alte Tabs statt zum Modul).
        router.replace(`${pathname}?${params.toString()}`);
    };

    // Outside click for status dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setShowActionsMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleStatusUpdate = async (newStatus: string) => {
        await onUpdateProject(project.id, { status: newStatus });
        setIsStatusDropdownOpen(false);
        toast.success(`Status → ${newStatus}`);
    };

    const isFavorite = currentEmployee?.dashboard_config?.favoriteProjectIds?.includes(project.id);

    const handleToggleFavorite = async () => {
        if (!currentEmployee) return;

        const currentFavorites = currentEmployee.dashboard_config?.favoriteProjectIds || [];
        const newFavorites = isFavorite
            ? currentFavorites.filter(id => id !== project.id)
            : [...currentFavorites, project.id];

        const newConfig = {
            ...currentEmployee.dashboard_config,
            widgets: currentEmployee.dashboard_config?.widgets || [],
            favoriteProjectIds: newFavorites
        };

        const { error } = await supabase
            .from('employees')
            .update({ dashboard_config: newConfig })
            .eq('id', currentEmployee.id);

        if (!error) {
            // fetchData logic is in AppContext, but we might just rely on realtime
        }
    };

    useEffect(() => {
        if (project) {
            setContractIntro(project.contract_intro || '');
            setContractOutro(project.contract_outro || '');
            fetchContractData();
        }
    }, [project.id]);

    const fetchContractData = async () => {
        // 1. Get Agency Settings (based on Org)
        const { data: settings } = await supabase.from('agency_settings').select('*').eq('organization_id', project.organization_id).maybeSingle();
        if (settings) setAgencySettings(settings);

        // 2. Get Templates
        const { data: tmps } = await supabase.from('organization_templates').select('*').eq('organization_id', project.organization_id);
        if (tmps) setTemplates(tmps as any);
    };

    const handleSaveContractText = async () => {
        const { error } = await supabase.from('projects').update({
            contract_intro: contractIntro,
            contract_outro: contractOutro
        }).eq('id', project.id);

        if (error) {
            toast.error('Vertragsdaten konnten nicht gespeichert werden.');
        } else {
            toast.success('Vertragsdaten gespeichert.');
        }
    };

    const applyTemplate = (type: 'intro' | 'outro', content: string) => {
        if (type === 'intro') setContractIntro(content);
        else setContractOutro(content);
    };

    useEffect(() => {
        fetchDetails();

        // Project-specific Realtime listener
        const channel = supabase
            .channel(`project - details - ${project.id} `)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'todos', filter: `project_id = eq.${project.id} ` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_logs', filter: `project_id=eq.${project.id}` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'time_entries', filter: `project_id = eq.${project.id} ` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_sections', filter: `project_id = eq.${project.id} ` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_positions', filter: `project_id = eq.${project.id} ` },
                () => fetchDetails()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project.id]);

    const fetchDetails = async () => {
        setLoading(true);
        // [FIX] Try ordering by order_index first, fallback to created_at if it fails (e.g. column not added yet)
        let { data: t, error: tError } = await supabase
            .from('todos')
            .select(`*, employees(id, initials, name, email, phone, avatar_url)`)
            .eq('project_id', project.id)
            .order('order_index', { ascending: true });

        if (tError) {
            console.error("Error fetching with order_index, falling back to created_at:", tError);
            const { data: fallbackT } = await supabase
                .from('todos')
                .select(`*, employees(id, initials, name, email, phone, avatar_url)`)
                .eq('project_id', project.id)
                .order('created_at', { ascending: true });
            t = fallbackT;
        }

        if (t) setTodos(t as any);

        const { data: l, error: lError } = await supabase
            .from('project_logs')
            .select('*, employees(id, name, initials, avatar_url)')
            .eq('project_id', project.id)
            .or(`is_public.eq.true${currentEmployee?.id ? `,employee_id.eq.${currentEmployee.id}` : ''}`)
            .order('entry_date', { ascending: false });

        if (lError) console.error("Error fetching logs:", lError);
        if (l) setLogs(l as any);

        const { data: s } = await supabase.from('project_sections').select(`*, positions: project_positions(*)`).eq('project_id', project.id).order('order_index');
        if (s) setSections(s);

        const { data: te } = await supabase.from('time_entries').select(`
id, project_id, employee_id, position_id, agency_position_id, date, hours, description, created_at,
    employees(id, name, initials, hourly_rate, job_title, avatar_url)
        `).eq('project_id', project.id);
        if (te) setTimeEntries(te as any);

        setLoading(false);
    };

    const handleAddTodo = async (title: string, assigneeId: string | null, deadline: string | null, orderIndex: number) => {
        const todoData = {
            project_id: project.id,
            organization_id: project.organization_id,
            title,
            assigned_to: assigneeId || null,
            deadline: deadline || null,
            is_done: false,
            order_index: orderIndex
        };

        let { data, error } = await supabase.from('todos').insert([todoData]).select(`*, employees(id, initials, name, avatar_url)`);

        // [FIX] If order_index column doesn't exist yet, retry without it
        if (error && error.message.includes("order_index")) {
            console.warn("Retrying task creation without order_index:", error.message);
            const { order_index, ...fallbackData } = todoData;
            const fallbackResult = await supabase.from('todos').insert([fallbackData]).select(`*, employees(id, initials, name, avatar_url)`);
            data = fallbackResult.data;
            error = fallbackResult.error;
        }

        if (error) {
            console.error('Error adding todo:', error);
            setConfirmConfig({
                isOpen: true,
                title: 'Fehler',
                message: 'Fehler beim Hinzufügen der Aufgabe: ' + error.message,
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'danger',
                confirmText: 'Verstanden',
                showCancel: false
            });
            return;
        }

        if (data) {
            setTodos([...todos, data[0] as any]);
        }
    };
    const handleToggleTodo = async (id: string, currentStatus: boolean) => {
        setTodos(prev => prev.map(t => t.id === id ? { ...t, is_done: !currentStatus } : t));
        await supabase.from('todos').update({ is_done: !currentStatus }).eq('id', id);
    };
    const handleUpdateTodo = async (id: string, title: string, assigneeId: string | null, deadline: string | null) => {
        const { data } = await supabase.from('todos').update({ title, assigned_to: assigneeId || null, deadline: deadline || null }).eq('id', id).select(`*, employees(id, initials, name, avatar_url)`);
        if (data) setTodos(prev => prev.map(t => t.id === id ? data[0] as any : t));
    };
    const handleDeleteTodo = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Aufgabe löschen?',
            message: 'Möchtest du diese Aufgabe wirklich löschen?',
            onConfirm: async () => {
                await supabase.from('todos').delete().eq('id', id);
                setTodos(prev => prev.filter(t => t.id !== id));
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            },
            type: 'danger',
            confirmText: 'Löschen'
        });
    };

    const handleReorderTodos = async (newSorted: Todo[]) => {
        // Optimistic update
        const updatedTodosWithIndices = newSorted.map((t, index) => ({
            ...t,
            order_index: index + 1
        }));

        setTodos(updatedTodosWithIndices);

        // Update in database using individual update calls to avoid upsert constraints
        try {
            await Promise.all(
                updatedTodosWithIndices.map(t =>
                    supabase.from('todos')
                        .update({ order_index: t.order_index })
                        .eq('id', t.id)
                )
            );
        } catch (error: any) {
            console.error('Error saving reorder:', error);
            if (error.message.includes("order_index")) {
                setConfirmConfig({
                    isOpen: true,
                    title: 'Sortieren fehlgeschlagen',
                    message: "Die neue Reihenfolge konnte nicht gespeichert werden, da die Tabellenspalte 'order_index' in der Datenbank fehlt. Bitte führe das SQL-Skript aus.",
                    onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                    type: 'warning',
                    confirmText: 'Verstanden',
                    showCancel: false
                });
            }
            // Optional: Revert on error? 
            // Better to let fetchDetails fix it if Realtime is working, 
            // or just leave it for now as the user will see the error.
        }
    };

    const handleDuplicateProject = async (targetClientId: string) => {
        setLoading(true);
        try {
            // 1. Fetch source details (sections and positions)
            const { data: sourceSections, error: secErr } = await supabase
                .from('project_sections')
                .select('*, project_positions(*)')
                .eq('project_id', project.id);

            if (secErr) throw secErr;

            // 2. Generate new job number
            const yearShort = new Date().getFullYear().toString().slice(-2);
            const prefix = `${yearShort}_`;

            const { data: latestProjectData } = await supabase
                .from('projects')
                .select('job_number')
                .ilike('job_number', `${prefix}%`)
                .order('job_number', { ascending: false })
                .limit(1)
                .maybeSingle();

            let nextNum = 1;
            if (latestProjectData && latestProjectData.job_number) {
                const parts = latestProjectData.job_number.split('_');
                if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                    nextNum = parseInt(parts[1]) + 1;
                }
            }

            const nextJobNumber = `${prefix}${nextNum.toString().padStart(4, '0')}`;

            // 3. Create new project
            const { data: newProject, error: projErr } = await supabase
                .from('projects')
                .insert([{
                    title: `${project.title} (Kopie)`,
                    job_number: nextJobNumber,
                    client_id: targetClientId,
                    organization_id: project.organization_id,
                    project_manager_id: project.project_manager_id,
                    status: 'Bearbeitung',
                    deadline: project.deadline,
                    google_doc_url: project.google_doc_url,
                    contract_intro: project.contract_intro,
                    contract_outro: project.contract_outro,
                    invoice_contact_id: project.invoice_contact_id
                }])
                .select()
                .single();

            if (projErr) throw projErr;

            // 3. Duplicate sections and positions
            for (const section of (sourceSections || [])) {
                const { data: newSection, error: newSecErr } = await supabase
                    .from('project_sections')
                    .insert([{
                        project_id: newProject.id,
                        organization_id: project.organization_id,
                        title: section.title,
                        description: section.description,
                        order_index: section.order_index
                    }])
                    .select()
                    .single();

                if (newSecErr) throw newSecErr;

                if (section.project_positions && section.project_positions.length > 0) {
                    const newPositions = section.project_positions.map((p: any) => ({
                        project_id: newProject.id,
                        organization_id: project.organization_id,
                        section_id: newSection.id,
                        title: p.title,
                        description: p.description,
                        quantity: p.quantity,
                        unit: p.unit,
                        unit_price: p.unit_price,
                        order_index: p.order_index,
                        position_nr: p.position_nr
                    }));

                    const { error: newPosErr } = await supabase
                        .from('project_positions')
                        .insert(newPositions);

                    if (newPosErr) throw newPosErr;
                }
            }

            toast.success(`„${project.title}" wurde dupliziert.`);
            router.push(`/uebersicht?project_id=${newProject.id}`);
            setShowDuplicateModal(false);

        } catch (err: any) {
            console.error('Duplication error:', err);
            toast.error('Fehler beim Duplizieren: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLog = async (title: string, content: string, date: string, images: string[], isPublic: boolean) => {
        const p = {
            project_id: project.id,
            title,
            content,
            image_url: images.length > 0 ? images[0] : null,
            image_urls: images,
            entry_date: date,
            employee_id: currentEmployee?.id || null,
            is_public: isPublic
        } as any;

        if (project.organization_id) {
            p.organization_id = project.organization_id;
        }

        const { error } = await supabase.from('project_logs').insert([p]);

        if (error) {
            console.error("Error adding log:", error, JSON.stringify(error, null, 2));
            setConfirmConfig({
                isOpen: true,
                title: 'Fehler',
                message: `Fehler beim Erstellen des Logbucheintrags:\n${error.message}\n${error.details}\n${error.hint}\nCode: ${error.code}`,
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'danger',
                confirmText: 'OK',
                showCancel: false
            });
            return;
        }

        fetchDetails();
    };
    const handleUpdateLog = async (id: string, title: string, content: string, date: string, images: string[], isPublic: boolean) => {
        await supabase.from('project_logs').update({
            title,
            content,
            entry_date: date,
            image_url: images.length > 0 ? images[0] : null,
            image_urls: images,
            is_public: isPublic
        }).eq('id', id);
        fetchDetails();
    };
    const handleDeleteLog = async (id: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Eintrag löschen?',
            message: 'Möchtest du diesen Logbuch-Eintrag wirklich löschen?',
            onConfirm: async () => {
                await supabase.from('project_logs').delete().eq('id', id);
                fetchDetails();
                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            },
            type: 'danger',
            confirmText: 'Löschen'
        });
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingPdf(true);
        try {
            const url = await uploadFileToSupabase(file, 'documents');
            await onUpdateProject(project.id, { offer_pdf_url: url });
        } catch (e) { console.error(e); }
        setUploadingPdf(false);
    };

    const saveProjectSettings = async () => {
        await onUpdateProject(project.id, {
            title: editData.title,
            job_number: editData.jobNr,
            status: editData.status,
            deadline: editData.deadline || null,
            google_doc_url: editData.google_doc_url,
            project_manager_id: editData.pmId || null,
            client_id: editData.clientId
        });
        setIsEditing(false);
        toast.success('Projekteinstellungen gespeichert.');
    };

    return (
        <>
            {/* ── Top navigation bar ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6 gap-4">
                <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    {backLabel}
                </button>

                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setShowTimeModal(true)}
                        className="flex items-center gap-2 bg-accent text-surface px-3 py-2 rounded-xl hover:brightness-110 transition-all shadow-sm text-sm font-bold"
                        title="Zeiterfassung"
                    >
                        <div className="relative flex items-center justify-center">
                            <Clock size={15} />
                        </div>
                        <span className="hidden sm:inline">Zeit erfassen</span>
                    </button>

                    <div className="relative" ref={actionsMenuRef}>
                        <button
                            onClick={() => setShowActionsMenu(!showActionsMenu)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all shadow-sm text-sm font-bold ${showActionsMenu ? 'bg-accent border-accent text-surface' : 'bg-surface border-default text-text-primary hover:bg-hover'}`}
                        >
                            <Settings size={16} />
                            <span className="hidden sm:inline">Optionen</span>
                        </button>

                        {showActionsMenu && (
                            <div className="absolute top-full right-0 mt-2 w-60 bg-surface rounded-2xl shadow-xl border border-default py-2 z-[100] animate-in fade-in slide-in-from-top-1">
                                <button
                                    onClick={() => { setIsEditing(true); setShowActionsMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-xs font-semibold text-text-primary hover:bg-hover transition-colors flex items-center gap-3"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-accent-subtle text-accent flex items-center justify-center shrink-0">
                                        <Edit3 size={13} />
                                    </div>
                                    Grunddaten bearbeiten
                                </button>
                                <button
                                    onClick={() => { handleTabChange('kalkulation'); setKalkulationView('leistungen'); setShowActionsMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-xs font-semibold text-text-primary hover:bg-hover transition-colors flex items-center gap-3"
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info-text)' }}>
                                        <Calculator size={13} />
                                    </div>
                                    Positionen bearbeiten
                                </button>
                                <div className="h-px bg-default my-1 mx-4" />
                                <button
                                    onClick={() => { setShowDuplicateModal(true); setShowActionsMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-xs font-semibold text-text-primary hover:bg-hover transition-colors flex items-center gap-3"
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success-text)' }}>
                                        <Copy size={13} />
                                    </div>
                                    Projekt kopieren
                                </button>
                                <div className="h-px bg-default my-1 mx-4" />
                                <button
                                    onClick={() => { onDeleteProject(); setShowActionsMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-xs font-semibold hover:bg-[var(--color-danger-subtle)] transition-colors flex items-center gap-3"
                                    style={{ color: 'var(--color-danger)' }}
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger)' }}>
                                        <Trash2 size={13} />
                                    </div>
                                    Projekt löschen
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Hero Header ──────────────────────────────────────────────────── */}
            <div className="mb-6">
                {/* Client + Job Number breadcrumb */}
                <div className="flex items-center gap-2 mb-2">
                    {project.clients?.logo_url ? (
                        <span className="inline-flex items-center rounded-md px-1.5 py-1" style={{ background: '#ffffff', border: '1px solid var(--border-subtle)' }}>
                            <img src={project.clients.logo_url} alt={project.clients.name} className="h-4 w-auto max-w-[60px] object-contain" />
                        </span>
                    ) : (
                        <span className="text-xs font-bold uppercase tracking-widest text-text-muted">{project.clients?.name || 'Kein Kunde'}</span>
                    )}
                    <span className="text-text-muted/40 text-xs">·</span>
                    <span className="text-xs font-mono text-text-muted">{project.job_number}</span>
                </div>

                {/* Title Row */}
                <div className="flex items-start gap-3 mb-4">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary leading-tight flex-1 break-words">{project.title}</h1>
                    <button
                        onClick={handleToggleFavorite}
                        className={`p-1.5 rounded-lg transition-all shrink-0 mt-1 ${isFavorite ? 'text-yellow-400 fill-yellow-400 bg-yellow-400/10' : 'text-text-placeholder hover:text-yellow-400 hover:bg-yellow-400/10'}`}
                        title={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                    >
                        <Star size={19} strokeWidth={2} />
                    </button>
                </div>

                {/* Meta badges row */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Status pill (clickable) */}
                    <div className="relative" ref={statusDropdownRef}>
                        <button
                            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] font-semibold bg-subtle border border-border-default hover:bg-hover transition-all duration-150 text-text-primary"
                        >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(project.status)}`} />
                            {project.status}
                            <ChevronDown size={12} className="text-text-muted ml-0.5" />
                        </button>
                        {isStatusDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1.5 w-56 bg-surface rounded-xl shadow-lg border border-border-subtle py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                                {STATUS_OPTIONS.map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusUpdate(status)}
                                        className={`w-full text-left px-3 py-2 text-[13px] hover:bg-hover flex items-center gap-2.5 transition-colors ${project.status === status ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
                                    >
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(status)}`} />
                                        {status}
                                        {project.status === status && (
                                            <Check size={13} className="ml-auto text-accent shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* PM badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-subtle border border-default rounded-full">
                        <UserAvatar
                            src={project.employees?.avatar_url}
                            name={project.employees?.name}
                            initials={project.employees?.initials}
                            size="xs"
                        />
                        <span className="text-xs font-medium text-text-secondary">{project.employees?.name || 'Kein PM'}</span>
                    </div>

                    {/* Deadline badge */}
                    {project.deadline && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-full text-xs font-semibold ${getDeadlineColorClass(project.deadline)}`}>
                            <Clock size={11} />
                            {new Date(project.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                    )}

                    {/* Task progress badge */}
                    {todos.length > 0 && (() => {
                        const done = todos.filter(t => t.is_done).length;
                        const pct = Math.round((done / todos.length) * 100);
                        return (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-subtle border border-default rounded-full">
                                <div className="w-16 h-1.5 bg-hover rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-accent rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-text-muted">{done}/{todos.length}</span>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────────────── */}
            <div className="flex gap-0.5 border-b border-border-subtle mb-7">
                {([
                    { id: 'uebersicht', label: 'Übersicht', icon: Layout },
                    { id: 'aufgaben', label: 'Aufgaben', icon: CheckSquare },
                    { id: 'kalkulation', label: 'Kalkulation', icon: Calculator },
                    { id: 'reporting', label: 'Reporting', icon: BarChart3 },
                    { id: 'dokumente', label: 'Dokumente', icon: Folder },
                ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => handleTabChange(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-all duration-150 border-b-2 -mb-px rounded-t-lg ${
                            activeTab === id
                                ? 'text-accent border-accent bg-accent-subtle/40'
                                : 'text-text-muted hover:text-text-primary hover:bg-hover border-transparent'
                        }`}
                    >
                        <Icon size={14} strokeWidth={activeTab === id ? 2.5 : 1.75} />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* ── Übersicht Tab ────────────────────────────────────────────────── */}
            {activeTab === 'uebersicht' && (() => {
                const projectLinks: ProjectLink[] = (project as any).project_links || [];
                const quickLinks = projectLinks.slice(0, 4);
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* LEFT: Quick resources (2/5) */}
                        <div className="col-span-2 flex flex-col gap-4">
                            <div className="bg-surface rounded-2xl border border-default shadow-sm p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                                        <FileText size={13} /> Ressourcen
                                    </h2>
                                    <button
                                        onClick={() => handleTabChange('dokumente')}
                                        className="text-[10px] text-text-placeholder hover:text-accent transition font-medium"
                                    >
                                        Alle verwalten →
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {project.offer_pdf_url ? (
                                        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-subtle border border-default group hover:border-accent/30 transition-colors">
                                            <a href={project.offer_pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-semibold text-text-primary hover:text-accent transition truncate flex-1">
                                                <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 text-[9px] font-black">PDF</div>
                                                Angebot.pdf
                                            </a>
                                            <button onClick={() => pdfInputRef.current?.click()} className="text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition p-1 rounded" title="Ersetzen">
                                                <Edit3 size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => pdfInputRef.current?.click()}
                                            className="w-full border-2 border-dashed border-default hover:border-accent hover:bg-accent/5 rounded-xl p-3 flex items-center justify-center gap-2 transition-all group"
                                        >
                                            {uploadingPdf ? (
                                                <span className="text-xs text-text-muted animate-pulse">Lädt hoch...</span>
                                            ) : (
                                                <>
                                                    <Upload size={14} className="text-text-placeholder group-hover:text-accent transition-colors" />
                                                    <span className="text-xs font-medium text-text-muted group-hover:text-accent transition-colors">PDF Angebot hochladen</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <input type="file" accept="application/pdf" ref={pdfInputRef} className="hidden" onChange={handlePdfUpload} />

                                    {quickLinks.map(link => (
                                        <a
                                            key={link.id}
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-subtle border border-default hover:border-accent/30 hover:text-accent text-xs font-semibold text-text-primary transition"
                                        >
                                            <ExternalLink size={12} className="text-text-placeholder shrink-0" />
                                            <span className="truncate flex-1">{link.name}</span>
                                        </a>
                                    ))}

                                    {quickLinks.length === 0 && !project.offer_pdf_url && (
                                        <button
                                            onClick={() => handleTabChange('dokumente')}
                                            className="w-full border-2 border-dashed border-default hover:border-accent hover:bg-accent/5 rounded-xl p-3 flex items-center justify-center gap-2 transition-all group"
                                        >
                                            <Plus size={13} className="text-text-placeholder group-hover:text-accent transition-colors" />
                                            <span className="text-xs font-medium text-text-muted group-hover:text-accent transition-colors">Dokumente & Links hinzufügen</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Logbook (3/5) */}
                        <div className="col-span-3">
                            <Logbook
                                logs={logs}
                                onAdd={handleAddLog}
                                onUpdate={handleUpdateLog}
                                onDelete={handleDeleteLog}
                                onUploadImage={(f) => uploadFileToSupabase(f, 'documents')}
                                currentEmployeeId={currentEmployee?.id}
                            />
                        </div>
                    </div>
                );
            })()}

            {/* ── Aufgaben Tab ─────────────────────────────────────────────────── */}
            {activeTab === 'aufgaben' && (
                <div className="flex flex-col gap-4">
                    {todos.length > 0 && (() => {
                        const done = todos.filter(t => t.is_done).length;
                        const pct = Math.round((done / todos.length) * 100);
                        return (
                            <div className="bg-surface rounded-2xl border border-default shadow-sm p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-text-primary">Fortschritt</span>
                                    <span className="text-xs font-bold text-accent">{pct}%</span>
                                </div>
                                <div className="w-full h-2 bg-subtle rounded-full overflow-hidden">
                                    <div className="h-full bg-accent rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-[10px] text-text-muted">{done} von {todos.length} erledigt</span>
                                    <span className="text-[10px] text-text-muted">{todos.length - done} offen</span>
                                </div>
                            </div>
                        );
                    })()}
                    <TodoList
                        todos={todos}
                        employees={employees}
                        onAdd={handleAddTodo}
                        onToggle={handleToggleTodo}
                        onUpdate={handleUpdateTodo}
                        onDelete={handleDeleteTodo}
                        onReorder={handleReorderTodos}
                        onTaskClick={(t) => setSelectedTask(t)}
                        highlightId={highlightId}
                    />
                </div>
            )}

            {/* ── Kalkulation Tab ──────────────────────────────────────────────── */}
            {activeTab === 'kalkulation' && (
                <div>
                    {/* Sub-navigation pills + Stundensätze trigger */}
                    <div className="flex items-center justify-between mb-6">
                        <ViewSwitcher
                            options={[
                                { value: 'leistungen', label: 'Leistungen', icon: ListChecks },
                                { value: 'angebot', label: 'Angebot', icon: FileText },
                                { value: 'rechnung', label: 'Rechnung', icon: Receipt },
                            ]}
                            value={kalkulationView}
                            onChange={setKalkulationView}
                        />
                        <button
                            onClick={() => setShowRatesSidebar(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-default bg-surface text-xs font-bold text-text-secondary hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all shadow-sm"
                        >
                            <Calculator size={13} />
                            Stundensätze
                        </button>
                    </div>

                    {kalkulationView === 'leistungen' && (
                        <ProjectLeistungenTab
                            projectId={project.id}
                            organizationId={project.organization_id}
                            initialSections={sections}
                            onSaved={fetchDetails}
                        />
                    )}
                    {kalkulationView === 'angebot' && (
                        <ProjectContractTab
                            project={{ ...project, sections: sections, positions: sections.flatMap(s => s.positions || []) }}
                            agencySettings={agencySettings}
                            templates={templates}
                            onUpdateProject={onUpdateProject}
                        />
                    )}
                    {kalkulationView === 'rechnung' && (
                        <ProjectInvoiceTab
                            project={{ ...project, sections: sections, positions: sections.flatMap(s => s.positions || []) }}
                            agencySettings={agencySettings}
                            templates={templates}
                            employees={employees}
                            onUpdateProject={onUpdateProject}
                        />
                    )}
                </div>
            )}

            {/* ── Reporting Tab ────────────────────────────────────────────────── */}
            {activeTab === 'reporting' && (
                <ProjectReportingTab
                    projectId={project.id}
                    timeEntries={timeEntries}
                    sections={sections}
                    deadline={project.deadline}
                    onOpenRatesSidebar={() => setShowRatesSidebar(true)}
                />
            )}

            {/* ── Dokumente Tab ────────────────────────────────────────────────── */}
            {activeTab === 'dokumente' && (
                <ProjectDocumentsTab
                    project={project}
                    onUpdateProject={async (projectId, updates) => {
                        await onUpdateProject(projectId, updates);
                    }}
                />
            )}

            {isEditing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 border border-default">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-text-primary">Einstellungen</h2><button onClick={() => setIsEditing(false)}><ArrowLeft size={20} className="text-text-secondary rotate-180" /></button></div>
                        <div className="space-y-4">
                            <div><label className="text-xs font-semibold text-text-secondary uppercase">Kunde</label><select className="w-full rounded-lg border-default text-sm py-2 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent" value={editData.clientId} onChange={(e) => setEditData({ ...editData, clientId: e.target.value })}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div><label className="text-xs font-semibold text-text-secondary uppercase">Status</label><select className="w-full rounded-lg border-default text-sm py-2 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent" value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div className="grid grid-cols-3 gap-4"><div className="col-span-1"><label className="text-xs font-semibold text-text-secondary uppercase">Job Nr.</label><input type="text" className="w-full rounded-lg border-default text-sm py-2 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent" value={editData.jobNr} onChange={(e) => setEditData({ ...editData, jobNr: e.target.value })} /></div><div className="col-span-2"><label className="text-xs font-semibold text-text-secondary uppercase">Projekt Titel</label><input type="text" className="w-full rounded-lg border-default text-sm py-2 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} /></div></div>
                            <div><label className="text-xs font-semibold text-text-secondary uppercase">Google Doc Link</label><input type="text" className="w-full rounded-lg border-default text-sm py-2 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent" value={editData.google_doc_url} onChange={(e) => setEditData({ ...editData, google_doc_url: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-semibold text-text-secondary uppercase">Deadline</label><input type="date" className="w-full rounded-lg border-default text-sm py-2 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent" value={editData.deadline} onChange={(e) => setEditData({ ...editData, deadline: e.target.value })} /></div><div><label className="text-xs font-semibold text-text-secondary uppercase">PM</label><select className="w-full rounded-lg border-default text-sm py-2 px-3 bg-subtle text-text-primary focus:ring-1 focus:ring-accent" value={editData.pmId} onChange={(e) => setEditData({ ...editData, pmId: e.target.value })}><option value="">Kein PM</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div></div>
                            <div className="pt-4 flex gap-3"><button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-lg border border-default text-sm text-text-primary hover:bg-hover transition">Abbrechen</button><button onClick={saveProjectSettings} className="flex-1 py-2.5 rounded-lg bg-text-primary text-surface text-sm transition">Speichern</button></div>
                        </div>
                    </div>
                </div>
            )}

            {currentEmployee && (
                <TimeEntryModal
                    isOpen={showTimeModal}
                    onClose={() => setShowTimeModal(false)}
                    currentUser={currentEmployee}
                    projects={[project]}
                    preselectedProject={project}
                    onEntryCreated={() => {
                        fetchDetails();
                        setShowTimeModal(false);
                    }}
                />
            )}

            {selectedTask && (
                <TaskDetailSidebar
                    task={selectedTask}
                    employees={employees}
                    projects={projects}
                    onClose={() => setSelectedTask(null)}
                    onTaskClick={(t) => setSelectedTask(t)}
                    onUpdate={async (id, updates) => {
                        const { data } = await supabase.from('todos').update(updates).eq('id', id).select(`*, employees(id, initials, name, avatar_url)`);
                        if (data) {
                            setTodos(prev => prev.map(t => t.id === id ? { ...t, ...data[0] } : t));
                            setSelectedTask(prev => prev ? data[0] as any : null);
                        }
                    }}
                    onDelete={async (id) => {
                        setConfirmConfig({
                            isOpen: true,
                            title: 'Aufgabe löschen?',
                            message: 'Möchtest du diese Aufgabe wirklich löschen?',
                            onConfirm: async () => {
                                await supabase.from('todos').delete().eq('id', id);
                                setTodos(prev => prev.filter(t => t.id !== id));
                                setSelectedTask(null);
                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                            },
                            type: 'danger',
                            confirmText: 'Löschen'
                        });
                    }}
                    onRefresh={fetchDetails}
                />
            )}

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
            <DuplicateProjectModal
                isOpen={showDuplicateModal}
                onClose={() => setShowDuplicateModal(false)}
                onConfirm={handleDuplicateProject}
                clients={clients}
                currentClientId={project.client_id}
            />
            <HourlyRatesSidebar
                isOpen={showRatesSidebar}
                onClose={() => setShowRatesSidebar(false)}
                organizationId={project.organization_id}
            />
        </>
    );
}
