import React, { useState, useEffect } from 'react';
import { Project, AgencySettings, OrganizationTemplate, ClientContact, Client } from '../../types';
import { supabase } from '../../supabaseClient';
import { FileText, Eye, X, Plus, User } from 'lucide-react';
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

    useEffect(() => {
        if (project.client_id) {
            fetchContacts();
        }
    }, [project.client_id]);

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

    const handleSaveContractText = async () => {
        await onUpdateProject(project.id, {
            contract_intro: contractIntro,
            contract_outro: contractOutro,
            invoice_contact_id: selectedContactId || null
        });
        alert('Vertragsdaten gespeichert.');
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

            {/* 1. CONTACT SELECTION */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={18} className="text-gray-400" /> Ansprechpartner für Angebot</h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Wähle einen Kontakt</label>
                        <select
                            className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50/50 text-sm font-medium focus:bg-white transition outline-none focus:ring-2 focus:ring-blue-100"
                            value={selectedContactId}
                            onChange={(e) => handleContactChange(e.target.value)}
                        >
                            <option value="">-- Kein spezifischer Kontakt (Verwende Kundendaten) --</option>
                            {contacts.map(c => (
                                <option key={c.id} value={c.id}>{c.name} {c.role ? `(${c.role})` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setIsAddingContact(true)}
                        className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
                        title="Neuen Kontakt erstellen"
                    >
                        <Plus size={20} />
                    </button>
                </div>
                {selectedContact && (
                    <div className="mt-3 text-xs text-gray-500 bg-blue-50/50 p-3 rounded-lg border border-blue-50">
                        <span className="font-bold text-blue-800">Gewählt:</span> {selectedContact.name}
                        {selectedContact.email && <span> • {selectedContact.email}</span>}
                        {selectedContact.phone && <span> • {selectedContact.phone}</span>}
                    </div>
                )}
            </div>

            {/* 2. TEXT EDITORS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* INTRO */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-900">Einleitungstext</h3>
                        <div className="relative group">
                            <button className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 font-medium text-gray-600">Vorlage wählen ▾</button>
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 shadow-xl rounded-lg w-48 hidden group-hover:block z-20 overflow-hidden">
                                <div className="max-h-60 overflow-y-auto">
                                    {templates.filter(t => t.type === 'intro').map(t => (
                                        <button key={t.id} onClick={() => applyTemplate('intro', t.content)} className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 border-b border-gray-50 last:border-0">{t.name}</button>
                                    ))}
                                    {templates.filter(t => t.type === 'intro').length === 0 && <div className="p-3 text-xs text-gray-400 text-center">Keine Vorlagen</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <textarea
                        className="w-full h-64 p-4 border border-gray-200 rounded-xl text-sm bg-gray-50/30 focus:bg-white resize-none font-sans leading-relaxed outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                        placeholder="Hier Einleitungstext eingeben..."
                        value={contractIntro}
                        onChange={e => setContractIntro(e.target.value)}
                    />
                </div>

                {/* OUTRO */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-900">Schlusstext / AGB Hinweis</h3>
                        <div className="relative group">
                            <button className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 font-medium text-gray-600">Vorlage wählen ▾</button>
                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 shadow-xl rounded-lg w-48 hidden group-hover:block z-20 overflow-hidden">
                                <div className="max-h-60 overflow-y-auto">
                                    {templates.filter(t => t.type === 'outro').map(t => (
                                        <button key={t.id} onClick={() => applyTemplate('outro', t.content)} className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 border-b border-gray-50 last:border-0">{t.name}</button>
                                    ))}
                                    {templates.filter(t => t.type === 'outro').length === 0 && <div className="p-3 text-xs text-gray-400 text-center">Keine Vorlagen</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <textarea
                        className="w-full h-64 p-4 border border-gray-200 rounded-xl text-sm bg-gray-50/30 focus:bg-white resize-none font-sans leading-relaxed outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm"
                        placeholder="Hier Schlusstext eingeben..."
                        value={contractOutro}
                        onChange={e => setContractOutro(e.target.value)}
                    />
                </div>
            </div>

            {/* ACTION BAR */}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
                <button onClick={handleSaveContractText} className="text-gray-600 hover:text-gray-900 text-sm font-bold px-4 py-2 hover:bg-gray-50 rounded-lg transition">
                    Speichern
                </button>
                <button onClick={() => setShowPDFPreview(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform">
                    <Eye size={16} /> Vorschau & Export
                </button>
            </div>

            {/* PDF MODAL */}
            {showPDFPreview && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col p-4 animate-in fade-in duration-200 backdrop-blur-sm">
                    <div className="flex justify-between items-center text-white mb-4 px-2">
                        <h2 className="text-xl font-bold flex items-center gap-2"><FileText /> PDF Vorschau</h2>
                        <button onClick={() => setShowPDFPreview(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><X size={24} /></button>
                    </div>
                    <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-2xl relative">
                        <PDFViewer width="100%" height="100%" className="w-full h-full border-none">
                            <ContractPDF
                                project={pdfProject}
                                agency={agencySettings}
                                client={project.clients || null}
                                intro={contractIntro}
                                outro={contractOutro}
                            />
                        </PDFViewer>
                    </div>
                    <div className="mt-4 flex justify-center gap-4">
                        <button onClick={handleSaveContractText} className="text-white/60 hover:text-white text-sm font-bold px-4 py-3">Einstellungen speichern</button>
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
                            className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition shadow-xl"
                        >
                            {({ blob, url, loading, error }) => loading ? 'PDF wird generiert...' : 'PDF Herunterladen'}
                        </PDFDownloadLink>
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
