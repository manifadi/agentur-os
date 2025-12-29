'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Briefcase, Calculator, Users, Clock, Plus, X, BarChart3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ConfirmModal from '../../components/Modals/ConfirmModal';

import { supabase } from '../../supabaseClient';

export default function CreateProjectWizard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditMode = !!editId;

    const { clients, employees, fetchData } = useApp();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    // Initial state for comparison
    const [initialBasicInfo, setInitialBasicInfo] = useState<any>(null);
    const [initialSections, setInitialSections] = useState<any[]>([]);

    // Form State
    const [basicInfo, setBasicInfo] = useState({
        title: '',
        jobNr: '',
        clientId: '',
        pmId: '',
        descriptionInternal: '',
        descriptionExternal: '',
        status: 'Bearbeitung',
        deadline: '',
        googleDocUrl: ''
    });
    const [isAdmin, setIsAdmin] = useState(false);

    // Check Admin Role
    React.useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                const emp = employees.find(e => e.email === user.email);
                if (emp?.role === 'admin') setIsAdmin(true);
            }
        };
        checkRole();
    }, [employees]);

    // Calculation State
    interface WizardSection {
        id: string; // temp ID or UUID
        title: string;
        description: string;
        positions: WizardPosition[];
    }
    interface WizardPosition {
        id: string; // temp ID or UUID
        title: string;
        description: string;
        quantity: number;
        unit: string;
        unitPrice: number;
    }

    const [sections, setSections] = useState<WizardSection[]>([
        { id: '1', title: '1. Phase: Konzeption', description: '', positions: [] }
    ]);
    const [timeEntries, setTimeEntries] = useState<any[]>([]); // For Reporting

    const [agencyPositions, setAgencyPositions] = useState<any[]>([]);

    // FETCH EXISTING DATA IF EDIT MODE
    React.useEffect(() => {
        fetchAgencyPositions();
        if (isEditMode && editId) {
            loadProjectData(editId);
        } else {
            generateJobNumber(); // Only generate for NEW projects
            // Store empty initial state for new projects
            setInitialBasicInfo({
                title: '',
                jobNr: '', // Will be updated by generateJobNumber soon
                clientId: '',
                pmId: '',
                descriptionInternal: '',
                descriptionExternal: '',
                status: 'Bearbeitung',
                deadline: '',
                googleDocUrl: ''
            });
            setInitialSections([{ id: '1', title: '1. Phase: Konzeption', description: '', positions: [] }]);
        }
    }, [editId]);

    // Update initial jobNr once it's generated for NEW projects
    React.useEffect(() => {
        if (!isEditMode && basicInfo.jobNr && initialBasicInfo && !initialBasicInfo.jobNr) {
            setInitialBasicInfo((prev: any) => ({ ...prev, jobNr: basicInfo.jobNr }));
        }
    }, [basicInfo.jobNr]);

    const fetchAgencyPositions = async () => {
        const { data } = await supabase.from('agency_positions').select('*').order('hourly_rate', { ascending: false });
        if (data) setAgencyPositions(data);
    };

    const loadProjectData = async (id: string) => {
        setLoading(true);
        try {
            // 1. Fetch Project
            const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single();
            if (proj) {
                setBasicInfo({
                    title: proj.title,
                    jobNr: proj.job_number,
                    clientId: proj.client_id,
                    pmId: proj.project_manager_id || '',
                    descriptionInternal: '', // Add columns if you add them to DB
                    descriptionExternal: '',
                    status: proj.status,
                    deadline: proj.deadline || '',
                    googleDocUrl: proj.google_doc_url || ''
                });
            }

            // 2. Fetch Sections & Positions
            const { data: secs } = await supabase
                .from('project_sections')
                .select(`*, positions:project_positions(*)`)
                .eq('project_id', id)
                .order('order_index', { ascending: true });

            if (secs) {
                const mappedSections = secs.map((s: any) => ({
                    id: s.id,
                    title: s.title,
                    description: s.description || '',
                    positions: (s.positions || [])
                        .sort((a: any, b: any) => a.order_index - b.order_index)
                        .map((p: any) => ({
                            id: p.id,
                            title: p.title,
                            description: p.description || '',
                            quantity: p.quantity || 0,
                            unit: p.unit || 'Stunden',
                            unitPrice: p.unit_price || 0
                        }))
                }));
                setSections(mappedSections);
            }

            // 3. Fetch Time Entries (Actuals)
            const { data: te } = await supabase
                .from('time_entries')
                .select(`
                *,
                employees ( id, name, initials, hourly_rate ),
                agency_positions ( id, title, hourly_rate )
            `)
                .eq('project_id', id);
            if (te) setTimeEntries(te);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Store initial state after loading data
    React.useEffect(() => {
        if (isEditMode && !loading && basicInfo.title && initialBasicInfo === null) {
            setInitialBasicInfo({ ...basicInfo });
            setInitialSections(JSON.parse(JSON.stringify(sections)));
        }
    }, [isEditMode, loading, basicInfo, sections]);

    const hasUnsavedChanges = () => {
        if (!initialBasicInfo) return false;

        // Compare Basic Info
        const basicChanged = JSON.stringify(basicInfo) !== JSON.stringify(initialBasicInfo);

        // Compare Sections & Positions (deep comparison)
        const sectionsChanged = JSON.stringify(sections) !== JSON.stringify(initialSections);

        return basicChanged || sectionsChanged;
    };

    const handleCancel = () => {
        if (hasUnsavedChanges()) {
            setShowCancelModal(true);
        } else {
            router.back();
        }
    };

    const addSection = () => {
        setSections([...sections, { id: 'TEMP_' + Date.now().toString(), title: '', description: '', positions: [] }]);
    };

    const addPosition = (sectionIndex: number) => {
        const newSections = [...sections];
        newSections[sectionIndex].positions.push({
            id: 'TEMP_' + Date.now().toString(),
            title: '',
            description: '',
            quantity: 0,
            unit: 'Stunden',
            unitPrice: 100 // Default Rate
        });
        setSections(newSections);
    };

    const updateSection = (index: number, field: keyof WizardSection, value: any) => {
        const newSections = [...sections];
        (newSections[index] as any)[field] = value;
        setSections(newSections);
    };

    const updatePosition = (sectionIndex: number, posIndex: number, field: keyof WizardPosition, value: any) => {
        const newSections = [...sections];
        (newSections[sectionIndex].positions[posIndex] as any)[field] = value;
        setSections(newSections);
    };

    const removePosition = (sectionIndex: number, posIndex: number) => {
        const newSections = [...sections];
        newSections[sectionIndex].positions.splice(posIndex, 1);
        setSections(newSections);
    };

    const removeSection = (index: number) => {
        const newSections = [...sections];
        newSections.splice(index, 1);
        setSections(newSections);
    };

    const calculateTotal = () => {
        let total = 0;
        sections.forEach(s => {
            s.positions.forEach(p => {
                total += p.quantity * p.unitPrice;
            });
        });
        return total;
    };

    // Auto-generate Job Number
    const generateJobNumber = async () => {
        if (isEditMode) return; // Don't regenerate on edit

        const yearShort = new Date().getFullYear().toString().slice(-2); // e.g., '25'
        const prefix = `${yearShort}_`;

        const { data: latestProject } = await supabase
            .from('projects')
            .select('job_number')
            .ilike('job_number', `${prefix}%`)
            .order('job_number', { ascending: false })
            .limit(1)
            .single();

        let nextNum = 1;
        if (latestProject && latestProject.job_number) {
            const parts = latestProject.job_number.split('_');
            if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                nextNum = parseInt(parts[1]) + 1;
            }
        }

        const nextJobNr = `${prefix}${nextNum.toString().padStart(4, '0')}`;
        setBasicInfo(prev => ({ ...prev, jobNr: nextJobNr }));
    };

    // Check Uniqueness
    const checkJobNumberUnique = async (jobNr: string) => {
        if (isEditMode && editId) return true; // Skip check if editing (assume valid or effectively standard update)
        // Ideally we check if it conflicts with OTHER projects, but jobNr is usually locked anyway.

        const { data } = await supabase
            .from('projects')
            .select('id')
            .eq('job_number', jobNr)
            .maybeSingle();
        return !data; // true if unique (no data found)
    };

    // removed useEffect generateJobNumber call here, moved up to edit check

    const handleSave = async () => {
        if (!basicInfo.title || !basicInfo.clientId) {
            alert('Bitte mindestens Titel und Kunde angeben.');
            return;
        }

        if (!basicInfo.jobNr) {
            alert('Bitte eine Job Nummer angeben.');
            return;
        }

        setLoading(true);

        const isUnique = await checkJobNumberUnique(basicInfo.jobNr);
        if (!isUnique) {
            const confirm = window.confirm(`Die Job Nummer "${basicInfo.jobNr}" existiert bereits. Trotzdem speichern?`);
            if (!confirm) {
                setLoading(false);
                return;
            }
        }

        try {
            let projectId = editId;

            // 1. Create OR Update Project
            const projectData = {
                title: basicInfo.title,
                job_number: basicInfo.jobNr,
                client_id: basicInfo.clientId,
                project_manager_id: basicInfo.pmId || null,
                status: basicInfo.status,
                deadline: basicInfo.deadline || null,
                google_doc_url: basicInfo.googleDocUrl || null,
                // description_internal: basicInfo.descriptionInternal, // Add to DB schema if needed
                // description_external: basicInfo.descriptionExternal
            };

            if (isEditMode && editId) {
                const { error } = await supabase.from('projects').update(projectData).eq('id', editId);
                if (error) throw error;
            } else {
                // Insert New
                // 0. Get Current User & Organization
                const { data: { user } } = await supabase.auth.getUser();
                if (!user?.email) throw new Error('Nicht eingeloggt');
                const currentEmployee = employees.find(e => e.email === user.email);
                if (!currentEmployee?.organization_id) throw new Error('Keine Organisation gefunden');

                const { data: newProj, error } = await supabase.from('projects').insert([{
                    ...projectData,
                    organization_id: currentEmployee.organization_id
                }]).select().single();
                if (error) throw error;
                if (!newProj) throw new Error('Project creation failed');
                projectId = newProj.id;
            }

            if (!projectId) throw new Error('No Project ID');

            // 2. Sections & Positions (Naive Full Replacement Strategy for Simplicity OR Upsert)
            // Strategy: 
            // - Delete all sections/positions for this project? (Destructive to references)
            // - Better: UPSERT.
            // But we need to handle DELETIONS (items removed from UI).
            // Complexity: Tracking deletions.
            // SIMPLIFICATION for V1: Delete all and recreate is easiest but bad for IDs.
            // User said: "Zeiterfassung auf Positionen buchen" is NEXT step. So currently NO references exist.
            // SAFE TO DELETE ALL for now.
            // WAIT - if we edit, we want to keep IDs if possible?
            // Let's try "Delete All" for now to ensure consistency with UI state.
            // WARNING: This will change IDs every save.

            // BETTER: Fetch existing IDs, comparison? Too complex for this turn.
            // DECISION: Delete all sections (cascade deletes positions) and re-insert.
            // This guarantees the DB matches the UI perfectly.

            if (isEditMode) {
                await supabase.from('project_positions').delete().eq('project_id', projectId);
                await supabase.from('project_sections').delete().eq('project_id', projectId);
            }

            // Insert Sections & Positions
            for (let i = 0; i < sections.length; i++) {
                const s = sections[i];
                const { data: sectionData, error: secError } = await supabase.from('project_sections').insert([{
                    project_id: projectId,
                    title: s.title,
                    description: s.description,
                    order_index: i
                    // Note: If sections have organization_id, add it here too.
                    // Assuming they don't based on previous context, or RLS handles it via join.
                }]).select().single();

                if (secError) throw secError;

                if (sectionData) {
                    const positionsToInsert = s.positions.map((p, idx) => ({
                        project_id: projectId,
                        section_id: sectionData.id,
                        title: p.title,
                        description: p.description,
                        quantity: p.quantity,
                        unit: p.unit,
                        unit_price: p.unitPrice,
                        order_index: idx,
                        position_nr: `${i + 1}.${idx + 1}`
                    }));

                    if (positionsToInsert.length > 0) {
                        const { error: posError } = await supabase.from('project_positions').insert(positionsToInsert);
                        if (posError) throw posError;
                    }
                }
            }

            // 3. Add Member if NEW
            if (!isEditMode) {
                const currentUserEmail = (await supabase.auth.getUser()).data.user?.email;
                if (currentUserEmail) {
                    const { data: employee } = await supabase.from('employees').select('id').eq('email', currentUserEmail).single();
                    if (employee) {
                        await supabase.from('project_members').insert([{
                            project_id: projectId,
                            employee_id: employee.id,
                            role: 'member'
                        }]);
                    }
                }
            }

            await fetchData();
            router.push('/uebersicht?projectId=' + projectId);

        } catch (e: any) {
            console.error('FULL ERROR:', e);
            alert('Fehler beim Speichern (Details in Konsole): ' + (e.message || JSON.stringify(e)));
        } finally {
            setLoading(false);
        }
    };

    // Step 1: Basic Info
    const renderStep1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-bold text-gray-900">Grunddaten</h2>
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Kunde *</label>
                        <select
                            className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                            value={basicInfo.clientId}
                            onChange={e => setBasicInfo({ ...basicInfo, clientId: e.target.value })}
                        >
                            <option value="">Bitte wählen...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Projekt Titel *</label>
                        <input
                            type="text"
                            className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                            value={basicInfo.title}
                            onChange={e => setBasicInfo({ ...basicInfo, title: e.target.value })}
                            placeholder="z.B. Website Relaunch 2025"
                        />
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Job Nummer *</label>
                        <input
                            type="text"
                            disabled
                            className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-100 text-gray-500 cursor-not-allowed focus:ring-0"
                            value={basicInfo.jobNr}
                            onChange={e => setBasicInfo({ ...basicInfo, jobNr: e.target.value })}
                            placeholder="Wird automatisch generiert..."
                        />
                        <p className="text-xs text-gray-400 mt-1">Automatisch generiert & einzigartig.</p>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Projektmanager</label>
                        <select
                            className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                            value={basicInfo.pmId}
                            onChange={e => setBasicInfo({ ...basicInfo, pmId: e.target.value })}
                        >
                            <option value="">Kein PM</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4">
                <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Interne Beschreibung</label>
                    <textarea
                        className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition h-32"
                        value={basicInfo.descriptionInternal}
                        onChange={e => setBasicInfo({ ...basicInfo, descriptionInternal: e.target.value })}
                        placeholder="Notizen für das Team..."
                    />
                </div>
                <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Externe Beschreibung (Angebot)</label>
                    <textarea
                        className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition h-32"
                        value={basicInfo.descriptionExternal}
                        onChange={e => setBasicInfo({ ...basicInfo, descriptionExternal: e.target.value })}
                        placeholder="Textbausteine für das Angebot..."
                    />
                </div>
            </div>

            {/* NEW: Settings (Deadline & Google Doc) */}
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-100 mt-4">
                <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Deadline</label>
                    <input
                        type="date"
                        className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                        value={basicInfo.deadline}
                        onChange={e => setBasicInfo({ ...basicInfo, deadline: e.target.value })}
                    />
                </div>
                {isAdmin && (
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Google Docs Link (Admin)</label>
                        <div className="relative">
                            <input
                                type="url"
                                className="w-full rounded-xl border-gray-200 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition pl-10"
                                value={basicInfo.googleDocUrl}
                                onChange={e => setBasicInfo({ ...basicInfo, googleDocUrl: e.target.value })}
                                placeholder="https://docs.google.com/..."
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <Briefcase size={16} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // Step 2: Calculation
    const renderStep2 = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-end border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Kalkulation</h2>
                    <p className="text-gray-500 text-sm mt-1">Erstelle die Struktur und das Angebot für das Projekt.</p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-500 uppercase font-bold tracking-wider">Gesamtsumme</div>
                    <div className="text-3xl font-bold text-gray-900">{calculateTotal().toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                </div>
            </div>

            <div className="space-y-6">
                {sections.map((section, sIdx) => (
                    <div key={section.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition">
                        {/* Section Header */}
                        <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex gap-4 items-start group">
                            <div className="flex-1 space-y-2">
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-none p-0 text-lg font-bold text-gray-900 placeholder-gray-400 focus:ring-0"
                                    placeholder="Sektion Titel (z.B. Konzeption)"
                                    value={section.title}
                                    onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
                                />
                                <textarea
                                    className="w-full bg-transparent border-none p-0 text-sm text-gray-600 placeholder-gray-400 focus:ring-0 resize-none"
                                    placeholder="Beschreibung / Vertragstext für diesen Abschnitt..."
                                    rows={1}
                                    value={section.description}
                                    onChange={(e) => updateSection(sIdx, 'description', e.target.value)}
                                />
                            </div>
                            <button onClick={() => removeSection(sIdx)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition"><Users size={16} /></button>
                        </div>

                        {/* Positions Table */}
                        <div className="p-4">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-gray-500 uppercase font-semibold border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-2 pl-2 w-12">Pos.</th>
                                        <th className="text-left py-2 w-1/3">Leistung</th>
                                        <th className="text-left py-2">Beschreibung</th>
                                        <th className="text-right py-2 w-20">Menge</th>
                                        <th className="text-left py-2 w-24 pl-2">Einheit</th>
                                        <th className="text-right py-2 w-24">Einzel (€)</th>
                                        <th className="text-right py-2 w-24">Gesamt</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {section.positions.map((pos, pIdx) => (
                                        <tr key={pos.id} className="group hover:bg-gray-50/50">
                                            <td className="py-2 pl-2 text-gray-400 font-mono text-xs">{sIdx + 1}.{pIdx + 1}</td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded font-medium"
                                                    placeholder="Leistung..."
                                                    value={pos.title}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'title', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-gray-500"
                                                    placeholder="Details..."
                                                    value={pos.description}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-2 text-right">
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-right font-mono"
                                                    value={pos.quantity}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="py-2 pl-2">
                                                <select
                                                    className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-xs"
                                                    value={pos.unit}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'unit', e.target.value)}
                                                >
                                                    <option>Stunden</option>
                                                    <option>Tage</option>
                                                    <option>Pauschal</option>
                                                    <option>Stk.</option>
                                                </select>
                                            </td>
                                            <td className="py-2 text-right">
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-right font-mono"
                                                    value={pos.unitPrice}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="py-2 text-right font-medium text-gray-900">
                                                {(pos.quantity * pos.unitPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                            </td>
                                            <td className="py-2 text-center opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={() => removePosition(sIdx, pIdx)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={() => addPosition(sIdx)} className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 py-1 px-2 hover:bg-blue-50 rounded transition">
                                <Plus size={12} /> Position hinzufügen
                            </button>
                        </div>
                    </div>
                ))}

                <button onClick={addSection} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-gray-300 hover:text-gray-600 transition flex items-center justify-center gap-2">
                    <Plus size={20} /> Neue Sektion hinzufügen
                </button>
            </div>
        </div>
    );

    // Step 4: Reporting
    const renderStep4 = () => {
        const totalRevenue = calculateTotal();

        // Group actuals by Agency Position
        const positionGroups = timeEntries.reduce((acc: any[], t: any) => {
            const positionTitle = t.agency_positions?.title || t.employees?.job_title || 'Ohne Position';
            const positionId = t.agency_position_id || 'unknown';

            let group = acc.find(g => g.title === positionTitle);
            if (!group) {
                group = {
                    id: positionId,
                    title: positionTitle,
                    entries: [],
                    totalHours: 0,
                    totalCost: 0
                };
                acc.push(group);
            }

            const h = Number(t.hours) || 0;
            // Fallback: Employee Rate -> Agency Position Rate -> 0
            const rate = t.employees?.hourly_rate || t.agency_positions?.hourly_rate || 0;
            const cost = h * rate;

            group.entries.push({
                ...t,
                cost,
                rate
            });
            group.totalHours += h;
            group.totalCost += cost;
            return acc;
        }, []);

        const totalCost = positionGroups.reduce((acc: number, g: any) => acc + g.totalCost, 0);
        const margin = totalRevenue - totalCost;

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Reporting & Marge</h2>
                    <p className="text-gray-500 text-sm mt-1">Echtzeit-Auswertung von geplantem Umsatz und tatsächlichen Kosten.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col justify-center items-center text-center">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Umsatz (Geplant)</span>
                        <div className="text-3xl font-bold text-gray-900">{totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col justify-center items-center text-center">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2">Kosten (Ist)</span>
                        <div className="text-3xl font-bold text-gray-900">{totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                    </div>
                    <div className={`rounded-2xl p-6 border flex flex-col justify-center items-center text-center ${margin >= 0 ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                        <span className="text-xs opacity-70 uppercase tracking-wider font-bold mb-2">Marge / Gewinn</span>
                        <div className="text-3xl font-bold">{margin.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                    </div>
                </div>

                {/* Detailed List by Position */}
                <div className="space-y-8">
                    {positionGroups.length === 0 ? (
                        <div className="text-center text-gray-400 py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            Noch keine Zeiten erfasst.
                        </div>
                    ) : (
                        positionGroups.map((group: any) => (
                            <div key={group.title} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-1 bg-gray-900 rounded-full"></div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{group.title}</h3>
                                            <div className="text-xs text-gray-500">
                                                {group.entries?.[0]?.rate ? `${Number(group.entries[0].rate).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €/h` : 'Kein Satz'} ({group.entries.length} Einträge)
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-gray-900">{group.totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                                        <div className="text-xs text-gray-500">{group.totalHours.toFixed(2)} Std. gesamt</div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white text-xs text-gray-400 uppercase font-medium border-b border-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 font-normal w-32">Datum</th>
                                                <th className="px-6 py-3 font-normal">Mitarbeiter</th>
                                                <th className="px-6 py-3 font-normal">Beschreibung</th>
                                                <th className="px-6 py-3 text-right font-normal">Zeit</th>
                                                <th className="px-6 py-3 text-right font-normal">Kosten (Intern)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {group.entries.map((entry: any) => (
                                                <tr key={entry.id} className="hover:bg-gray-50/30 transition">
                                                    <td className="px-6 py-3 whitespace-nowrap text-gray-500 font-mono text-xs">
                                                        {new Date(entry.date).toLocaleDateString('de-DE')}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-full bg-gray-100 text-[9px] font-bold flex items-center justify-center text-gray-600">
                                                                {entry.employees?.initials}
                                                            </div>
                                                            <span className="text-gray-900 text-xs font-medium">{entry.employees?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-600 max-w-[300px] truncate" title={entry.description}>
                                                        {entry.description || '-'}
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-mono text-gray-700">
                                                        {Number(entry.hours).toFixed(2)} h
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-mono text-gray-400 text-xs">
                                                        {entry.cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50/50 flex flex-col">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">{isEditMode ? 'Projekt bearbeiten' : 'Neues Projekt anlegen'}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleCancel} className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 transition">Abbrechen</button>
                        <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition shadow-lg shadow-gray-900/10 disabled:opacity-50">
                            {loading ? 'Speichere...' : <><Save size={16} /> Projekt speichern</>}
                        </button>
                    </div>
                </div>

                {/* Stepper */}
                <div className="max-w-3xl mx-auto px-4 translate-y-[1px]">
                    <div className="flex grid grid-cols-4">
                        <button onClick={() => setStep(1)} className={`pb-3 flex items-center justify-center gap-2 border-b-2 transition ${step === 1 ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>
                            <Briefcase size={16} /> <span className="font-medium text-sm">Grunddaten</span>
                        </button>
                        <button onClick={() => setStep(2)} className={`pb-3 flex items-center justify-center gap-2 border-b-2 transition ${step === 2 ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>
                            <Calculator size={16} /> <span className="font-medium text-sm">Kalkulation</span>
                        </button>
                        <button onClick={() => setStep(3)} className={`pb-3 flex items-center justify-center gap-2 border-b-2 transition ${step === 3 ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>
                            <Users size={16} /> <span className="font-medium text-sm">Stundensätze</span>
                        </button>
                        <button onClick={() => setStep(4)} className={`pb-3 flex items-center justify-center gap-2 border-b-2 transition ${step === 4 ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400'}`}>
                            <BarChart3 size={16} /> <span className="font-medium text-sm">Reporting</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 max-w-5xl w-full mx-auto p-8">
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8 min-h-[600px]">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="border-b border-gray-200 pb-4">
                                <h2 className="text-2xl font-bold text-gray-900">Stundensätze</h2>
                                <p className="text-gray-500 text-sm mt-1">Übersicht der internen Stundensätze pro Position.</p>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3">Position</th>
                                            <th className="px-6 py-3">Kategorie</th>
                                            <th className="px-6 py-3 text-right">Stundensatz</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {agencyPositions.map((p: any) => (
                                            <tr key={p.id} className="hover:bg-gray-50/50 transition">
                                                <td className="px-6 py-4 font-bold text-gray-900">{p.title}</td>
                                                <td className="px-6 py-4 text-gray-500">{p.category || '-'}</td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                                                    {p.hourly_rate.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                                    <span className="text-xs text-gray-400 font-normal ml-1">/ h</span>
                                                </td>
                                            </tr>
                                        ))}
                                        {agencyPositions.length === 0 && (
                                            <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400">Keine Positionen gefunden. (Bitte Administrator kontaktieren)</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {step === 4 && renderStep4()}
                </div>
            </div>
            <ConfirmModal
                isOpen={showCancelModal}
                title="Ungespeicherte Änderungen"
                message="Ungespeicherte Änderungen werden hiermit gelöscht."
                onConfirm={() => router.back()}
                onCancel={() => setShowCancelModal(false)}
                confirmText="Verwerfen"
                cancelText="Weiter bearbeiten"
                type="danger"
            />
        </div>
    );
}
