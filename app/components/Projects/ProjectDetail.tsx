import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Trash2, Settings, FileText, Upload, Eye, X } from 'lucide-react';
import { Project, Employee, Todo, ProjectLog, AgencySettings, OrganizationTemplate } from '../../types';
import { getStatusStyle, getDeadlineColorClass, STATUS_OPTIONS } from '../../utils';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import { supabase } from '../../supabaseClient';
import TodoList from './TodoList';
import Logbook from './Logbook';
import { useApp } from '../../context/AppContext';
import TimeEntryModal from '../Modals/TimeEntryModal';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import ContractPDF from '../Contracts/ContractPDF';
import ProjectContractTab from './ProjectContractTab';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import TaskDetailSidebar from '../Tasks/TaskDetailSidebar';
import ConfirmModal from '../Modals/ConfirmModal';

interface ProjectDetailProps {
    project: Project;
    employees: Employee[];
    onClose: () => void;
    onUpdateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    onDeleteProject: () => void;
    currentEmployee?: Employee;
}

export default function ProjectDetail({ project, employees, onClose, onUpdateProject, onDeleteProject, currentEmployee }: ProjectDetailProps) {
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

    const pdfInputRef = useRef<HTMLInputElement>(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    // Contract Logic
    const [activeTab, setActiveTab] = useState<'details' | 'contract'>('details');
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

    // Sync Tab with URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'contract' || tab === 'details') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (tab: 'details' | 'contract') => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`);
    };

    // Outside click for status dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                setIsStatusDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleStatusUpdate = async (newStatus: string) => {
        await onUpdateProject(project.id, { status: newStatus });
        setIsStatusDropdownOpen(false);
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
            setConfirmConfig({
                isOpen: true,
                title: 'Fehler beim Speichern',
                message: 'Es gab ein Problem beim Speichern der Vertragsdaten: ' + error.message,
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'danger',
                confirmText: 'Verstanden',
                showCancel: false
            });
        } else {
            setConfirmConfig({
                isOpen: true,
                title: 'Gespeichert',
                message: 'Die Vertragsdaten wurden erfolgreich aktualisiert.',
                onConfirm: () => setConfirmConfig(prev => ({ ...prev, isOpen: false })),
                type: 'success',
                confirmText: 'Super',
                showCancel: false
            });
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
            .channel(`project-details-${project.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'todos', filter: `project_id=eq.${project.id}` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_logs', filter: `project_id=eq.${project.id}` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'time_entries', filter: `project_id=eq.${project.id}` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_sections', filter: `project_id=eq.${project.id}` },
                () => fetchDetails()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_positions', filter: `project_id=eq.${project.id}` },
                () => fetchDetails()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project.id]);

    const fetchDetails = async () => {
        setLoading(true);
        // Add email and phone to employee selection
        const { data: t } = await supabase.from('todos').select(`*, employees(id, initials, name, email, phone)`).eq('project_id', project.id).order('created_at', { ascending: true });
        if (t) setTodos(t as any);

        const { data: l } = await supabase
            .from('project_logs')
            .select('*')
            .eq('project_id', project.id)
            .or(`is_public.eq.true${currentEmployee?.id ? `,employee_id.eq.${currentEmployee.id}` : ''}`)
            .order('entry_date', { ascending: false });
        if (l) setLogs(l as any);

        const { data: s } = await supabase.from('project_sections').select(`*, positions: project_positions(*)`).eq('project_id', project.id).order('order_index');
        if (s) setSections(s);

        const { data: te } = await supabase.from('time_entries').select(`
id, project_id, employee_id, position_id, agency_position_id, date, hours, description, created_at,
    employees(id, name, initials, hourly_rate, job_title)
        `).eq('project_id', project.id);
        if (te) setTimeEntries(te as any);

        setLoading(false);
    };

    const handleAddTodo = async (title: string, assigneeId: string | null, deadline: string | null) => {
        const { data, error } = await supabase.from('todos').insert([{
            project_id: project.id,
            organization_id: project.organization_id,
            title,
            assigned_to: assigneeId || null,
            deadline: deadline || null,
            is_done: false
        }]).select(`*, employees(id, initials, name)`);

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
        const { data } = await supabase.from('todos').update({ title, assigned_to: assigneeId || null, deadline: deadline || null }).eq('id', id).select(`*, employees(id, initials, name)`);
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
            console.error("Error adding log:", error);
            setConfirmConfig({
                isOpen: true,
                title: 'Fehler',
                message: "Fehler beim Erstellen des Logbucheintrags: " + error.message,
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
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <button onClick={onClose} className="flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"><ArrowLeft size={16} className="mr-1" /> Zurück zur Übersicht</button>
                <div className="flex gap-2 self-end">
                    <button onClick={() => setShowTimeModal(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-black shadow-sm transition"><Upload size={16} /> Zeit erfassen</button>
                    <button onClick={() => window.location.href = `/projekte/erstellen?edit=${project.id}`} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition"><Settings size={16} /> Bearbeiten</button>
                    <button onClick={onDeleteProject} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{project.job_number}</div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 break-words">{project.title}</h1>
                    <div className="relative" ref={statusDropdownRef}>
                        <button
                            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all hover:brightness-95 flex items-center gap-1 ${getStatusStyle(project.status)}`}
                        >
                            {project.status}
                        </button>

                        {isStatusDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                                {STATUS_OPTIONS.map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusUpdate(status)}
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between group transition-colors ${project.status === status ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${getStatusStyle(status).split(' ')[0]}`}></div>
                                            {status}
                                        </span>
                                        {project.status === status && <div className="w-1 h-1 bg-blue-600 rounded-full" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-left md:text-right w-full md:w-auto">
                    <div className="text-sm text-gray-500 mb-1">Projektmanager</div>
                    <div className="flex items-center justify-start md:justify-end gap-2">
                        <span className="text-sm font-medium">{project.employees?.name || 'Nicht zugewiesen'}</span>
                        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-xs text-white shrink-0">{project.employees?.initials || '--'}</div>
                    </div>
                    <div className={`mt-2 text-xs font-medium ${getDeadlineColorClass(project.deadline)}`}>Deadline: {project.deadline || '-'}</div>
                </div>
            </div>

            {/* TABS HEADER */}
            <div className="flex gap-6 border-b border-gray-100 mb-6">
                <button
                    onClick={() => handleTabChange('details')}
                    className={`pb-3 text-sm font-bold transition ${activeTab === 'details' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
                >
                    Projekt Details
                </button>
                <button
                    onClick={() => handleTabChange('contract')}
                    className={`pb-3 text-sm font-bold transition flex items-center gap-2 ${activeTab === 'contract' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-700'}`}
                >
                    <FileText size={16} /> Vertrag & Angebot
                </button>
            </div>

            {activeTab === 'details' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-200px)]">
                    {/* LEFT COLUMN: Logbook & Details */}
                    <div className="flex flex-col gap-6 h-full overflow-y-auto">
                        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[200px]">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText size={20} className="text-gray-400" /> Projektdetails</h2>
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group">
                                {uploadingPdf ? <div className="animate-pulse text-sm">Lade Datei hoch...</div> : project.offer_pdf_url ? (
                                    <div className="flex items-center gap-4 w-full justify-center">
                                        <a href={project.offer_pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 hover:bg-gray-100 transition"><FileText size={16} /> Angebot ansehen</a>
                                        <button onClick={() => pdfInputRef.current?.click()} className="text-xs text-gray-400 hover:text-gray-600">Ändern</button>
                                    </div>
                                ) : (
                                    <button onClick={() => pdfInputRef.current?.click()} className="flex items-center gap-2 text-sm text-blue-600 hover:underline"><Upload size={16} /> PDF hochladen</button>
                                )}
                                <input type="file" accept="application/pdf" ref={pdfInputRef} className="hidden" onChange={handlePdfUpload} />
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                {project.google_doc_url ? (<a href={project.google_doc_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full text-blue-600 bg-blue-50 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition">Google Doc öffnen ↗</a>) : (<div className="text-center text-sm text-gray-400">Kein Google Doc verknüpft</div>)}
                            </div>
                        </div>

                        <Logbook
                            logs={logs}
                            onAdd={handleAddLog}
                            onUpdate={handleUpdateLog}
                            onDelete={handleDeleteLog}
                            onUploadImage={(f) => uploadFileToSupabase(f, 'documents')}
                            currentEmployeeId={currentEmployee?.id}
                        />
                    </div>

                    {/* RIGHT COLUMN: Tasks */}
                    <div className="flex flex-col gap-6 h-full overflow-y-auto">
                        <TodoList
                            todos={todos}
                            employees={employees}
                            onAdd={handleAddTodo}
                            onToggle={handleToggleTodo}
                            onUpdate={handleUpdateTodo}
                            onDelete={handleDeleteTodo}
                            onTaskClick={(t) => setSelectedTask(t)}
                        />
                    </div>
                </div>
            )}



            {activeTab === 'contract' && (
                <ProjectContractTab
                    project={{ ...project, sections: sections, positions: sections.flatMap(s => s.positions || []) }}
                    agencySettings={agencySettings}
                    templates={templates}
                    onUpdateProject={onUpdateProject}
                />
            )}

            {isEditing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Einstellungen</h2><button onClick={() => setIsEditing(false)}><ArrowLeft size={20} className="text-gray-400 rotate-180" /></button></div>
                        <div className="space-y-4">
                            <div><label className="text-xs font-semibold text-gray-500 uppercase">Kunde</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editData.clientId} onChange={(e) => setEditData({ ...editData, clientId: e.target.value })}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div><label className="text-xs font-semibold text-gray-500 uppercase">Status</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                            <div className="grid grid-cols-3 gap-4"><div className="col-span-1"><label className="text-xs font-semibold text-gray-500 uppercase">Job Nr.</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editData.jobNr} onChange={(e) => setEditData({ ...editData, jobNr: e.target.value })} /></div><div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Projekt Titel</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editData.title} onChange={(e) => setEditData({ ...editData, title: e.target.value })} /></div></div>
                            <div><label className="text-xs font-semibold text-gray-500 uppercase">Google Doc Link</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editData.google_doc_url} onChange={(e) => setEditData({ ...editData, google_doc_url: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-semibold text-gray-500 uppercase">Deadline</label><input type="date" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editData.deadline} onChange={(e) => setEditData({ ...editData, deadline: e.target.value })} /></div><div><label className="text-xs font-semibold text-gray-500 uppercase">PM</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editData.pmId} onChange={(e) => setEditData({ ...editData, pmId: e.target.value })}><option value="">Kein PM</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div></div>
                            <div className="pt-4 flex gap-3"><button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600">Abbrechen</button><button onClick={saveProjectSettings} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">Speichern</button></div>
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
                        const { data } = await supabase.from('todos').update(updates).eq('id', id).select(`*, employees(id, initials, name)`);
                        if (data) {
                            setTodos(prev => prev.map(t => t.id === id ? { ...t, ...data[0] } : t));
                            setSelectedTask(data[0] as any);
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
        </>
    );
}
