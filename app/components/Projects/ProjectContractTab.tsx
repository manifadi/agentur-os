import React, { useState, useEffect } from 'react';
import { Project, AgencySettings, OrganizationTemplate, ClientContact, Client } from '../../types';
import { supabase } from '../../supabaseClient';
import { FileText, Eye, X, Plus, User, ChevronDown, CheckCircle, Clock, History, Edit3, Trash2, Send, Download } from 'lucide-react';
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
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (project.client_id) {
            fetchContacts();
            fetchHistory();
        }
    }, [project.client_id, project.id]);

    useEffect(() => {
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
        setIsSaving(true);
        await onUpdateProject(project.id, {
            contract_intro: contractIntro,
            contract_outro: contractOutro,
            invoice_contact_id: selectedContactId || null
        });
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
        if (!error) fetchHistory();
        setIsSaving(false);
    };

    const applyTemplate = (type: 'intro' | 'outro', content: string) => {
        if (type === 'intro') setContractIntro(content);
        else setContractOutro(content);
    };

    const handleContactChange = async (contactId: string) => {
        setSelectedContactId(contactId);
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
            await onUpdateProject(project.id, { invoice_contact_id: data.id });
        }
    };

    const handleDeleteOffer = async (id: string) => {
        if (!confirm('Angebot-Entwurf wirklich löschen?')) return;
        const { error } = await supabase.from('project_offers').delete().eq('id', id);
        if (error) alert('Fehler beim Löschen: ' + error.message);
        else fetchHistory();
    };

    const selectedContact = contacts.find(c => c.id === selectedContactId) || null;
    const pdfProject = {
        ...project,
        invoice_contact: selectedContact || undefined
    };

    const hasChanges = contractIntro !== (project.contract_intro || '') ||
        contractOutro !== (project.contract_outro || '') ||
        selectedContactId !== (project.invoice_contact_id || '');

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6 pb-16">

            {/* ─ Step 1: Empfänger ───────────────────────────────── */}
            <div className="bg-surface rounded-2xl border border-default shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-default bg-subtle flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-surface flex items-center justify-center text-xs font-black shrink-0">1</div>
                    <h3 className="text-sm font-bold text-text-primary">Empfänger / Ansprechpartner</h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Existing contact selector */}
                    <label className="relative group bg-subtle p-4 rounded-xl border border-default flex items-center gap-4 hover:border-accent transition-all cursor-pointer overflow-hidden">
                        <select
                            value={selectedContactId}
                            onChange={(e) => handleContactChange(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        >
                            <option value="">Standard (Kundendaten)</option>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                            <User size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Ansprechpartner</div>
                            <div className="text-sm font-bold text-text-primary truncate">
                                {selectedContactId ? (contacts.find(c => c.id === selectedContactId)?.name || 'Gelöschter Kontakt') : 'Standard (Kundendaten)'}
                            </div>
                        </div>
                        <ChevronDown size={15} className="text-text-muted shrink-0" />
                    </label>

                    {/* Add contact */}
                    <button
                        onClick={() => setIsAddingContact(true)}
                        className="bg-subtle p-4 rounded-xl border border-dashed border-default flex items-center gap-4 hover:border-accent hover:bg-accent/5 transition-all group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-surface border border-default group-hover:bg-accent/10 group-hover:border-accent/30 flex items-center justify-center text-text-muted group-hover:text-accent transition-colors">
                            <Plus size={18} />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="text-sm font-bold text-text-primary">Empfänger hinzufügen</div>
                            <div className="text-xs text-text-muted">Neuen Kontakt anlegen</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* ─ Step 2: Texte ───────────────────────────────────── */}
            <div className="bg-surface rounded-2xl border border-default shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-default bg-subtle flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-surface flex items-center justify-center text-xs font-black shrink-0">2</div>
                    <h3 className="text-sm font-bold text-text-primary">Angebots-Texte</h3>
                </div>
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Intro */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Einleitungstext</label>
                            <select
                                className="text-xs border border-default rounded-lg py-1 px-2 bg-subtle text-text-primary focus:ring-1 focus:ring-accent"
                                onChange={(e) => applyTemplate('intro', e.target.value)}
                                value=""
                            >
                                <option value="" disabled>Vorlage wählen…</option>
                                {templates.filter(t => t.type === 'intro').map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                            </select>
                        </div>
                        <textarea
                            value={contractIntro}
                            onChange={(e) => setContractIntro(e.target.value)}
                            placeholder="Z.B. Sehr geehrter Herr Muster, anbei sende ich Ihnen unser Angebot…"
                            className="w-full h-48 p-4 border border-default rounded-xl text-sm focus:ring-2 focus:ring-accent outline-none resize-none bg-subtle text-text-primary placeholder:text-text-placeholder transition-colors focus:border-accent"
                        />
                        <div className="text-[10px] text-text-muted mt-1.5">{contractIntro.length} Zeichen</div>
                    </div>
                    {/* Outro */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Schlusstext / AGB</label>
                            <select
                                className="text-xs border border-default rounded-lg py-1 px-2 bg-subtle text-text-primary focus:ring-1 focus:ring-accent"
                                onChange={(e) => applyTemplate('outro', e.target.value)}
                                value=""
                            >
                                <option value="" disabled>Vorlage wählen…</option>
                                {templates.filter(t => t.type === 'outro').map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                            </select>
                        </div>
                        <textarea
                            value={contractOutro}
                            onChange={(e) => setContractOutro(e.target.value)}
                            placeholder="Z.B. Wir freuen uns auf eine gute Zusammenarbeit…"
                            className="w-full h-48 p-4 border border-default rounded-xl text-sm focus:ring-2 focus:ring-accent outline-none resize-none bg-subtle text-text-primary placeholder:text-text-placeholder transition-colors focus:border-accent"
                        />
                        <div className="text-[10px] text-text-muted mt-1.5">{contractOutro.length} Zeichen</div>
                    </div>
                </div>
            </div>

            {/* ─ Step 3: Actions ─────────────────────────────────── */}
            <div className="bg-subtle rounded-2xl border border-default p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <div>
                        <div className="text-sm font-bold text-text-primary">Bereit zum Export</div>
                        {hasChanges && <div className="text-xs text-amber-500 font-medium">Ungespeicherte Änderungen</div>}
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowPDFPreview(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-surface border border-default text-text-primary px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-hover transition shadow-sm"
                    >
                        <Eye size={15} /> Vorschau
                    </button>
                    <button
                        onClick={handleSaveContractText}
                        disabled={isSaving}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent text-surface px-5 py-2.5 rounded-xl text-sm font-bold hover:brightness-110 transition shadow-lg shadow-accent/20 disabled:opacity-60"
                    >
                        <Send size={14} />
                        {isSaving ? 'Speichert…' : 'Angebot speichern'}
                    </button>
                </div>
            </div>

            {/* ─ Angebots-Historie ─────────────────────────────────── */}
            <div className="bg-surface rounded-2xl border border-default shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-default bg-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History size={16} className="text-text-muted" />
                        <h3 className="text-sm font-bold text-text-primary">Bisherige Entwürfe</h3>
                    </div>
                    {offerHistory.length > 0 && (
                        <span className="text-xs font-bold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                            {offerHistory.length}
                        </span>
                    )}
                </div>

                {offerHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                        <div className="w-12 h-12 rounded-2xl bg-subtle border border-default flex items-center justify-center mb-3">
                            <FileText size={20} className="text-text-placeholder" />
                        </div>
                        <p className="text-sm font-semibold text-text-primary mb-1">Noch keine Entwürfe</p>
                        <p className="text-xs text-text-secondary">Wenn du ein Angebot speicherst, erscheint es hier mit Versionsverlauf.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-default">
                        {offerHistory.map((h, idx) => {
                            const contact = contacts.find(c => c.id === h.invoice_contact_id);
                            const isLatest = idx === 0;
                            return (
                                <div key={h.id} className="flex items-center justify-between px-5 py-4 hover:bg-hover transition-colors group">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isLatest ? 'bg-accent/10 text-accent' : 'bg-subtle text-text-muted'}`}>
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-bold text-sm text-text-primary">{h.offer_number}</span>
                                                {isLatest && (
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">Aktuell</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-text-secondary">
                                                {new Date(h.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                {' · '}Version {h.version}
                                                {contact && <> · {contact.name}</>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setContractIntro(h.intro_text || '');
                                                setContractOutro(h.outro_text || '');
                                                setSelectedContactId(h.invoice_contact_id || '');
                                            }}
                                            className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                            title="Laden & bearbeiten"
                                        >
                                            <Edit3 size={15} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setContractIntro(h.intro_text || '');
                                                setContractOutro(h.outro_text || '');
                                                setSelectedContactId(h.invoice_contact_id || '');
                                                setShowPDFPreview(true);
                                            }}
                                            className="p-2 text-text-muted hover:text-text-primary hover:bg-hover rounded-lg transition-colors"
                                            title="Vorschau"
                                        >
                                            <Eye size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteOffer(h.id)}
                                            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Löschen"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* PDF Preview Modal */}
            {showPDFPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-200 !mt-0">
                    <div className="bg-surface lg:rounded-2xl w-full max-w-6xl h-full lg:h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-default">
                        <div className="p-4 border-b border-default flex justify-between items-center bg-surface">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-accent" />
                                <h2 className="font-bold text-text-primary">Vorschau – Vertrag & Angebot</h2>
                            </div>
                            <button onClick={() => setShowPDFPreview(false)} className="p-2 hover:bg-hover rounded-xl transition">
                                <X size={18} className="text-text-muted" />
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
                        <div className="p-4 border-t border-default flex justify-end gap-3 bg-surface">
                            <button onClick={() => setShowPDFPreview(false)} className="px-5 py-2 border border-default rounded-xl text-sm font-bold text-text-primary hover:bg-hover transition">
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
                                fileName={`Angebot_${project.job_number || 'Entwurf'}.pdf`}
                                className="px-5 py-2 bg-accent text-surface rounded-xl text-sm font-bold hover:brightness-110 shadow-lg shadow-accent/20 flex items-center gap-2"
                            >
                                {({ loading }) => (
                                    <>
                                        <Download size={14} />
                                        {loading ? 'Generiert...' : 'PDF Herunterladen'}
                                    </>
                                )}
                            </PDFDownloadLink>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Contact Modal */}
            <ContactModal
                isOpen={isAddingContact}
                onClose={() => setIsAddingContact(false)}
                onSave={handleSaveNewContact}
            />
        </div>
    );
}
