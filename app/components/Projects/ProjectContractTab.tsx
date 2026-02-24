import React, { useState, useEffect } from 'react';
import { Project, AgencySettings, OrganizationTemplate, ClientContact, Client } from '../../types';
import { supabase } from '../../supabaseClient';
import { FileText, Eye, X, Plus, User, ChevronDown, CheckCircle, Clock, History, Edit3, Trash2 } from 'lucide-react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import ContractPDF from '../Contracts/ContractPDF';
import ContactModal from '../Modals/ContactModal';

interface ProjectContractTabProps {
    project: Project;
    agencySettings: AgencySettings | null;
    templates: OrganizationTemplate[];
    onUpdateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export default function ProjectContractTab({ project, agencySettings, templates, onUpdateProject }: ProjectContractTabProps) {
    const [contractIntro, setContractIntro] = useState(project.contract_intro || '');
    const [contractOutro, setContractOutro] = useState(project.contract_outro || '');
    const [showPDFPreview, setShowPDFPreview] = useState(false);

    // Contact Logic
    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [selectedContactId, setSelectedContactId] = useState<string>(project.invoice_contact_id || '');
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [offerHistory, setOfferHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (project.client_id) {
            fetchContacts();
            fetchHistory();
        }
    }, [project.client_id, project.id]);

    useEffect(() => {
        // Update local state if project updates from outside (or initial load)
        setContractIntro(project.contract_intro || '');
        setContractOutro(project.contract_outro || '');
        setSelectedContactId(project.invoice_contact_id || '');
    }, [project]);

    const fetchContacts = async () => {
        setLoadingContacts(true);
        const { data } = await supabase.from('client_contacts').select('*').eq('client_id', project.client_id);
        if (data) setContacts(data);
        setLoadingContacts(false);
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        const { data } = await supabase.from('project_offers').select('*').eq('project_id', project.id).order('created_at', { ascending: false });
        if (data) setOfferHistory(data);
        setLoadingHistory(false);
    };

    const handleSaveContractText = async () => {
        // 1. Update project main fields
        await onUpdateProject(project.id, {
            contract_intro: contractIntro,
            contract_outro: contractOutro,
            invoice_contact_id: selectedContactId || null
        });

        // 2. Create history entry in project_offers
        const nextVersion = (offerHistory[0]?.version || 0) + 1;
        const { error } = await supabase.from('project_offers').insert([{
            project_id: project.id,
            organization_id: project.organization_id,
            offer_number: `${project.job_number}-${nextVersion}`,
            intro_text: contractIntro,
            outro_text: contractOutro,
            invoice_contact_id: selectedContactId || null,
            version: nextVersion
        }]);

        if (error) {
            console.error('Error saving history:', error);
        } else {
            fetchHistory();
            alert('Vertragsdaten gespeichert und in Historie erfasst.');
        }
    };

    const applyTemplate = (type: 'intro' | 'outro', content: string) => {
        if (type === 'intro') setContractIntro(content);
        else setContractOutro(content);
    };

    const handleContactChange = async (contactId: string) => {
        setSelectedContactId(contactId);
        // Auto-save on selection? Or wait for save button? 
        // User might expect auto-save or at least explicit save.
        // Let's stick to explicit save for now to avoid accidental DB writes, match Save button logic.
        // BUT: For PDF preview to work immediately, we need this in state.
    };

    const handleSaveNewContact = async (contactData: Partial<ClientContact>) => {
        if (!project.clients) return;

        const { data, error } = await supabase.from('client_contacts').insert([{
            ...contactData,
            client_id: project.client_id,
            organization_id: project.organization_id
        }]).select().single();

        if (error) {
            alert('Fehler beim Erstellen des Kontakts: ' + error.message);
        } else if (data) {
            setContacts([...contacts, data]);
            setSelectedContactId(data.id);
            setIsAddingContact(false);
            // Optionally auto-save project link
            await onUpdateProject(project.id, { invoice_contact_id: data.id });
        }
    };

    const handleDeleteOffer = async (id: string) => {
        if (!confirm('Angebot-Entwurf wirklich löschen?')) return;
        const { error } = await supabase.from('project_offers').delete().eq('id', id);
        if (error) alert('Fehler beim Löschen: ' + error.message);
        else fetchHistory();
    };

    // Prepare Invoice Contact Object for PDF
    // If selectedContactId is set, find it in contacts.
    // If not, it falls back to null, and ContractPDF handles fallback to Client data.
    const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

    // We construct a "hydrated" project object for the PDF to ensure it has the latest local state
    const pdfProject = {
        ...project,
        invoice_contact: selectedContact || undefined // Pass the full contact object
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 h-[calc(100vh-250px)] overflow-y-auto pr-2 pb-20">

            {/* Contact Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left side: Dropdown Select Box */}
                <label className="relative group bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all cursor-pointer overflow-hidden">
                    {/* Native Select Overlay */}
                    <select
                        value={selectedContactId}
                        onChange={(e) => handleContactChange(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                    >
                        <option value="">Standard (Kundendaten)</option>
                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    {/* Visual UI Layer (Underneath) */}
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                        <User size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-gray-400 uppercase block mb-1 tracking-wider">Ansprechpartner / Empfänger</div>
                        <div className="text-sm font-bold text-gray-900 truncate">
                            {selectedContactId ? (contacts.find(c => c.id === selectedContactId)?.name || 'Gelöschter Kontakt') : 'Standard (Kundendaten)'}
                        </div>
                    </div>
                    <div className="text-gray-400 shrink-0">
                        <ChevronDown size={16} />
                    </div>
                </label>

                {/* Right side: Add Button */}
                <button
                    onClick={() => setIsAddingContact(true)}
                    className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:bg-gray-50 hover:border-blue-200 transition-all group"
                >
                    <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                        <Plus size={20} />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="text-sm font-bold text-gray-900">Empfänger hinzufügen</div>
                        <div className="text-[10px] text-gray-400 font-medium tracking-tight">Neuen Kontakt für diesen Kunden anlegen</div>
                    </div>
                </button>
            </div>

            {/* Text Editors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Einleitungstext</label>
                        <select
                            className="text-xs border-gray-200 rounded-lg py-1 px-2"
                            onChange={(e) => applyTemplate('intro', e.target.value)}
                            value=""
                        >
                            <option value="" disabled>Vorlage wählen...</option>
                            {templates.filter(t => t.type === 'intro').map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                        </select>
                    </div>
                    <textarea
                        value={contractIntro}
                        onChange={(e) => setContractIntro(e.target.value)}
                        placeholder="Hier Einleitungstext eingeben..."
                        className="w-full h-64 p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none bg-white"
                    />
                </div>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Schlusstext / AGB</label>
                        <select
                            className="text-xs border-gray-200 rounded-lg py-1 px-2"
                            onChange={(e) => applyTemplate('outro', e.target.value)}
                            value=""
                        >
                            <option value="" disabled>Vorlage wählen...</option>
                            {templates.filter(t => t.type === 'outro').map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                        </select>
                    </div>
                    <textarea
                        value={contractOutro}
                        onChange={(e) => setContractOutro(e.target.value)}
                        placeholder="Hier Schlusstext eingeben..."
                        className="w-full h-64 p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none bg-white"
                    />
                </div>
            </div>

            {/* ACTION BAR / TOTALS PREVIEW MOCKUP STYLE */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex justify-between items-center">
                <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Status</span>
                    <div className="flex items-center gap-2 text-gray-900">
                        <CheckCircle size={16} className="text-green-500" />
                        <span className="font-bold text-sm">Bereit zum Export</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowPDFPreview(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition shadow-sm flex items-center gap-2">
                        <Eye size={16} /> Vorschau
                    </button>
                    <button onClick={handleSaveContractText} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                        Angebot speichern
                    </button>
                </div>
            </div>

            {/* HISTORY LIST */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <History size={20} className="text-gray-400" /> Bisherige Entwürfe
                </h3>
                {offerHistory.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Noch keine Entwürfe gespeichert.</div>
                ) : (
                    <div className="space-y-3">
                        {offerHistory.map(h => {
                            const contact = contacts.find(c => c.id === h.invoice_contact_id);
                            return (
                                <div key={h.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900">{h.offer_number}</div>
                                            <div className="text-xs text-gray-500">
                                                {new Date(h.created_at).toLocaleDateString('de-DE')} • v{h.version} • {contact?.name || 'Standard'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setContractIntro(h.intro_text || '');
                                                setContractOutro(h.outro_text || '');
                                                setSelectedContactId(h.invoice_contact_id || '');
                                                alert(`Version v${h.version} geladen. Bitte 'Angebot speichern' klicken, um sie als aktuellen Stand zu setzen.`);
                                            }}
                                            className="p-2 text-blue-400 hover:text-blue-600 transition"
                                            title="Wiederherstellen / Bearbeiten"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                        <button
                                            className="p-2 text-gray-400 hover:text-gray-600 transition"
                                            title="Vorschau"
                                            onClick={() => {
                                                setContractIntro(h.intro_text || '');
                                                setContractOutro(h.outro_text || '');
                                                setSelectedContactId(h.invoice_contact_id || '');
                                                setShowPDFPreview(true);
                                            }}
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteOffer(h.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 transition"
                                            title="Löschen"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showPDFPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-200 !mt-0">
                    <div className="bg-white lg:rounded-2xl w-full max-w-6xl h-full lg:h-[94vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2">
                                <FileText size={20} className="text-blue-500" />
                                <h2 className="font-bold text-gray-900">Vorschau Vertrag & Angebot</h2>
                            </div>
                            <button onClick={() => setShowPDFPreview(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-500 overflow-hidden">
                            <PDFViewer width="100%" height="100%" className="border-none">
                                <ContractPDF
                                    project={pdfProject}
                                    agency={agencySettings}
                                    client={project.clients || null}
                                    intro={contractIntro}
                                    outro={contractOutro}
                                />
                            </PDFViewer>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                            <button onClick={() => setShowPDFPreview(false)} className="px-6 py-2 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 transition">
                                Schließen
                            </button>
                            <PDFDownloadLink
                                document={
                                    <ContractPDF
                                        project={pdfProject}
                                        agency={agencySettings}
                                        client={project.clients || null}
                                        intro={contractIntro}
                                        outro={contractOutro}
                                    />
                                }
                                fileName={`Vertrag_${project.job_number || 'Entwurf'}.pdf`}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                            >
                                {({ blob, url, loading, error }) => loading ? 'Wird generiert...' : 'PDF Herunterladen'}
                            </PDFDownloadLink>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD CONTACT MODAL */}
            <ContactModal
                isOpen={isAddingContact}
                onClose={() => setIsAddingContact(false)}
                onSave={handleSaveNewContact}
            />
        </div>
    );
}
