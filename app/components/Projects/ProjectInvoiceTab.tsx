import React, { useState, useEffect } from 'react';
import { Project, AgencySettings, OrganizationTemplate, ClientContact, ProjectInvoice, ProjectPosition } from '../../types';
import { supabase } from '../../supabaseClient';
import { FileText, Eye, X, Plus, User, Calculator, History, Download, Trash2, CheckCircle, AlertCircle, Receipt, Edit3, ChevronDown } from 'lucide-react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import InvoicePDF from '../Contracts/InvoicePDF';
import ContactModal from '../Modals/ContactModal';
import ConfirmModal from '../Modals/ConfirmModal';
import { toast } from 'sonner';

interface ProjectInvoiceTabProps {
    project: Project;
    agencySettings: AgencySettings | null;
    templates: OrganizationTemplate[];
    onUpdateProject: (id: string, updates: Partial<Project>) => Promise<void>;
}

export default function ProjectInvoiceTab({ project, agencySettings, templates, onUpdateProject }: ProjectInvoiceTabProps) {
    const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPDFPreview, setShowPDFPreview] = useState(false);
    const [activeInvoice, setActiveInvoice] = useState<Partial<ProjectInvoice> | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    // Draft State
    const [billingType, setBillingType] = useState<'full' | 'fraction' | 'positions'>('full');
    const [billingFraction, setBillingFraction] = useState<number>(1);
    const [customPercentage, setCustomPercentage] = useState<string>('');
    const [selectedPositions, setSelectedPositions] = useState<{ position_id: string, percentage: number }[]>([]);
    const [introText, setIntroText] = useState('');
    const [outroText, setOutroText] = useState('');
    const [invoiceContactId, setInvoiceContactId] = useState(project.invoice_contact_id || '');

    const [contacts, setContacts] = useState<ClientContact[]>([]);
    const [isAddingContact, setIsAddingContact] = useState(false);

    // Edit tracking
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [currentVersion, setCurrentVersion] = useState(1);

    useEffect(() => {
        fetchInvoices();
        if (project.client_id) {
            fetchContacts();
        }
    }, [project.id, project.client_id]);

    const fetchInvoices = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('project_invoices')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false });

        if (data) setInvoices(data);
        setLoading(false);
    };

    const fetchContacts = async () => {
        const { data } = await supabase.from('client_contacts').select('*').eq('client_id', project.client_id);
        if (data) setContacts(data);
    };

    const getAlreadyBilledPercentage = (positionId: string) => {
        return invoices.reduce((acc, inv) => {
            if (inv.billing_type === 'full') return acc + 100;
            if (inv.billing_type === 'fraction') return acc + ((inv.billing_fraction || 0) * 100);
            if (inv.billing_type === 'positions') {
                const item = inv.billed_data.items?.find(i => i.position_id === positionId);
                return acc + (item?.percentage || 0);
            }
            return acc;
        }, 0);
    };

    const calculateProjectStats = () => {
        const allPositions = project.sections?.flatMap(s => s.positions || []) || project.positions || [];
        const totalNet = allPositions.reduce((sum, p) => sum + (p.unit_price * p.quantity), 0);

        const billedNet = allPositions.reduce((sum, p) => {
            const alreadyBilled = getAlreadyBilledPercentage(p.id);
            return sum + (p.unit_price * p.quantity * (alreadyBilled / 100));
        }, 0);

        const remainingNet = Math.max(0, totalNet - billedNet);
        const taxRate = 0.20;

        return {
            totalNet,
            totalGross: totalNet * (1 + taxRate),
            billedNet,
            billedGross: billedNet * (1 + taxRate),
            remainingNet,
            remainingGross: remainingNet * (1 + taxRate)
        };
    };

    const calculateTotals = () => {
        let net = 0;
        const allPositions = project.sections?.flatMap(s => s.positions || []) || project.positions || [];

        if (billingType === 'full') {
            net = allPositions.reduce((sum, p) => {
                const alreadyBilled = getAlreadyBilledPercentage(p.id);
                const remainingPercent = Math.max(0, 100 - alreadyBilled);
                return sum + (p.unit_price * p.quantity * (remainingPercent / 100));
            }, 0);
        } else if (billingType === 'fraction') {
            const fraction = customPercentage ? (parseFloat(customPercentage) / 100) : billingFraction;
            net = allPositions.reduce((sum, p) => {
                const alreadyBilled = getAlreadyBilledPercentage(p.id);
                const remainingPercent = Math.max(0, 100 - alreadyBilled);
                // The fraction now applies to the REMAINING percent
                const toBillPercent = remainingPercent * fraction;
                return sum + (p.unit_price * p.quantity * (toBillPercent / 100));
            }, 0);
        } else if (billingType === 'positions') {
            net = selectedPositions.reduce((sum, sp) => {
                const pos = allPositions.find(p => p.id === sp.position_id);
                if (!pos) return sum;
                return sum + (pos.unit_price * pos.quantity * (sp.percentage / 100));
            }, 0);
        }

        const tax = net * 0.20;
        return { net, tax, gross: net + tax };
    };

    const handleSaveInvoice = async (status: 'draft' | 'final' = 'draft') => {
        const totals = calculateTotals();
        const fraction = customPercentage ? (parseFloat(customPercentage) / 100) : billingFraction;
        const invoiceData: any = {
            project_id: project.id,
            organization_id: project.organization_id,
            invoice_number: project.job_number,
            billing_type: billingType,
            billing_fraction: billingType === 'fraction' ? fraction : undefined,
            billed_data: {
                items: billingType === 'positions' ? selectedPositions.map(sp => {
                    const allPositions = project.sections?.flatMap(s => s.positions || []) || project.positions || [];
                    const pos = allPositions.find(p => p.id === sp.position_id);
                    return { ...sp, amount: pos ? (pos.unit_price * pos.quantity * (sp.percentage / 100)) : 0 };
                }) : undefined,
                title: billingType === 'full' ? 'Gesamtabrechnung' : (billingType === 'fraction' ? `Teilabrechnung (${Math.round(fraction * 100)}% vom Rest)` : 'Einzelaufstellung')
            },
            total_net: totals.net,
            total_tax: totals.tax,
            total_gross: totals.gross,
            intro_text: introText,
            outro_text: outroText,
            invoice_contact_id: invoiceContactId || null,
            status,
            version: currentVersion
        };

        let result;
        if (editingInvoiceId && status === 'draft') {
            // Update existing draft if specifically editing a draft
            result = await supabase.from('project_invoices').update(invoiceData).eq('id', editingInvoiceId);
        } else {
            // Create new record (new version or first time)
            if (status === 'final' || status === 'draft') {
                result = await supabase.from('project_invoices').insert([invoiceData]);
            }
        }

        if (result?.error) {
            toast.error('Fehler beim Speichern: ' + result.error.message);
        } else {
            fetchInvoices();
            resetDraft();
            toast.success(status === 'final' ? 'Rechnung finalisiert.' : 'Rechnung gespeichert.', {
                description: 'Die Rechnung wurde erfolgreich in der Datenbank hinterlegt.'
            });
        }
    };

    const resetDraft = () => {
        setBillingType('full');
        setBillingFraction(1);
        setCustomPercentage('');
        setSelectedPositions([]);
        setIntroText('');
        setOutroText('');
        setEditingInvoiceId(null);
        setCurrentVersion(1);
    };

    const handleEditInvoice = (inv: ProjectInvoice) => {
        setBillingType(inv.billing_type);
        if (inv.billing_fraction) {
            const standardFractions = [1, 0.5, 0.33, 0.25];
            if (standardFractions.includes(inv.billing_fraction)) {
                setBillingFraction(inv.billing_fraction);
                setCustomPercentage('');
            } else {
                setBillingFraction(0);
                setCustomPercentage((inv.billing_fraction * 100).toString());
            }
        }
        setSelectedPositions(inv.billed_data.items?.map(i => ({ position_id: i.position_id, percentage: i.percentage })) || []);
        setIntroText(inv.intro_text || '');
        setOutroText(inv.outro_text || '');
        setInvoiceContactId(inv.invoice_contact_id || '');

        if (inv.status === 'draft') {
            setEditingInvoiceId(inv.id);
            setCurrentVersion(inv.version);
        } else {
            // For final invoices, we create a new version
            setEditingInvoiceId(null);
            setCurrentVersion(inv.version + 1);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteInvoice = async (id: string) => {
        setInvoiceToDelete(id);
        setIsConfirmingDelete(true);
    };

    const confirmDeleteInvoice = async () => {
        if (!invoiceToDelete) return;

        const { error } = await supabase.from('project_invoices').delete().eq('id', invoiceToDelete);
        if (error) {
            toast.error('Fehler beim Löschen: ' + error.message);
        } else {
            toast.success('Rechnung gelöscht.');
            fetchInvoices();
        }
        setIsConfirmingDelete(false);
        setInvoiceToDelete(null);
    };

    return (
        <div className="space-y-8 h-[calc(100vh-250px)] overflow-y-auto pr-2 pb-20">
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Calculator size={20} className="text-blue-500" /> Neue Rechnung erstellen
                </h3>

                {/* Project Statistics Header */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Gesamtvolumen Auftrag</span>
                        <div className="text-xl font-black text-gray-900">
                            {calculateProjectStats().totalGross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € <span className="text-xs font-normal text-gray-400">inkl. USt.</span>
                        </div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Noch abzurechnen</span>
                        <div className="text-xl font-black text-blue-600">
                            {calculateProjectStats().remainingGross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € <span className="text-xs font-normal text-blue-400">inkl. USt.</span>
                        </div>
                    </div>
                </div>

                {/* Billing Type Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <button
                        onClick={() => { setBillingType('full'); setBillingFraction(1); setSelectedPositions([]); }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${billingType === 'full' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                    >
                        <span className="font-bold">Gesamtes Projekt</span>
                        <span className="text-xs text-gray-500 text-center">100% des Auftragsvolumens abrechnen</span>
                    </button>
                    <button
                        onClick={() => { setBillingType('fraction'); setSelectedPositions([]); }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${billingType === 'fraction' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                    >
                        <span className="font-bold">Teilbetrag</span>
                        <span className="text-xs text-gray-500 text-center">Einen Bruchteil (z.B. 1/2, 1/3) abrechnen</span>
                    </button>
                    <button
                        onClick={() => { setBillingType('positions'); setBillingFraction(0); }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${billingType === 'positions' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                    >
                        <span className="font-bold">Einzelne Positionen</span>
                        <span className="text-xs text-gray-500 text-center">Spezifische Leistungen aus der Kalkulation wählen</span>
                    </button>
                </div>

                {/* Specific Options based on Type */}
                {billingType === 'fraction' && (
                    <div className="mb-8 animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            {[1, 0.5, 0.33, 0.25].map(f => (
                                <button
                                    key={f}
                                    onClick={() => { setBillingFraction(f); setCustomPercentage(''); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${billingFraction === f && !customPercentage ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    {f === 1 ? '1/1 Rest' : (f === 0.5 ? '1/2 Rest' : (f === 0.33 ? '1/3 Rest' : '1/4 Rest'))}
                                </button>
                            ))}
                            <div className="h-8 w-px bg-gray-200 mx-1" />
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="Eigener"
                                        value={customPercentage}
                                        onChange={(e) => {
                                            setCustomPercentage(e.target.value);
                                            setBillingFraction(0);
                                        }}
                                        className={`w-24 pl-3 pr-8 py-2 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none transition-all ${customPercentage ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200'}`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                                </div>
                                <span className="text-xs text-gray-400 font-medium">Restbetrag</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-blue-500 font-medium bg-blue-50/50 p-2 rounded-lg inline-flex items-center gap-1.5">
                            <AlertCircle size={14} /> Alle Anteile beziehen sich auf den aktuell noch verbleibenden Restbetrag des Projekts.
                        </p>
                    </div>
                )}

                {billingType === 'positions' && (
                    <div className="mb-8 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="text-sm font-bold text-gray-700 mb-2">Positionen auswählen</div>
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Position</th>
                                        <th className="px-4 py-3 font-bold">Gesamt</th>
                                        <th className="px-4 py-3 font-bold">Bereits abgerechnet</th>
                                        <th className="px-4 py-3 font-bold w-32">Diese Rechnung %</th>
                                        <th className="px-4 py-3 font-bold text-right">Betrag</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(project.sections?.flatMap(s => s.positions || []) || project.positions || []).map(pos => {
                                        const alreadyBilledPercent = getAlreadyBilledPercentage(pos.id);

                                        const selection = selectedPositions.find(sp => sp.position_id === pos.id);
                                        const currentPercent = selection?.percentage || 0;
                                        const totalAmount = pos.unit_price * pos.quantity;
                                        const currentAmount = totalAmount * (currentPercent / 100);

                                        return (
                                            <tr key={pos.id} className="hover:bg-gray-50/50 transition">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{pos.title}</div>
                                                    <div className="text-xs text-gray-400">{pos.quantity} {pos.unit} × {pos.unit_price.toLocaleString('de-DE')} €</div>
                                                </td>
                                                <td className="px-4 py-3 font-medium">{totalAmount.toLocaleString('de-DE')} €</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, alreadyBilledPercent)}%` }}></div>
                                                        </div>
                                                        <span className="text-xs text-gray-500 font-bold">{alreadyBilledPercent}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={100 - alreadyBilledPercent}
                                                            value={currentPercent}
                                                            onChange={(e) => {
                                                                const val = Math.min(100 - alreadyBilledPercent, Math.max(0, parseInt(e.target.value) || 0));
                                                                setSelectedPositions(prev => {
                                                                    const existing = prev.find(p => p.position_id === pos.id);
                                                                    if (existing) {
                                                                        return prev.map(p => p.position_id === pos.id ? { ...p, percentage: val } : p);
                                                                    }
                                                                    return [...prev, { position_id: pos.id, percentage: val }];
                                                                });
                                                            }}
                                                            className="w-16 p-1.5 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-blue-100 outline-none"
                                                        />
                                                        <span className="text-gray-400">%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                    {currentAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Text Editors */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Einleitungstext</label>
                            <select
                                className="text-xs border-gray-200 rounded-lg py-1 px-2"
                                onChange={(e) => setIntroText(e.target.value)}
                                value=""
                            >
                                <option value="" disabled>Vorlage wählen...</option>
                                {templates.map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                            </select>
                        </div>
                        <textarea
                            value={introText}
                            onChange={(e) => setIntroText(e.target.value)}
                            placeholder="Z.B. Sehr geehrte Damen und Herren, anbei erhalten Sie die Rechnung für..."
                            className="w-full h-32 p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Schlusstext</label>
                            <select
                                className="text-xs border-gray-200 rounded-lg py-1 px-2"
                                onChange={(e) => setOutroText(e.target.value)}
                                value=""
                            >
                                <option value="" disabled>Vorlage wählen...</option>
                                {templates.map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                            </select>
                        </div>
                        <textarea
                            value={outroText}
                            onChange={(e) => setOutroText(e.target.value)}
                            placeholder="Z.B. Wir bitten um Überweisung innerhalb von 14 Tagen..."
                            className="w-full h-32 p-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Contact Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {/* Left side: Dropdown Select Box */}
                    <label className="relative group bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all cursor-pointer overflow-hidden">
                        {/* Native Select Overlay */}
                        <select
                            value={invoiceContactId}
                            onChange={(e) => setInvoiceContactId(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        >
                            <option value="">Standard (Client Address)</option>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        {/* Visual UI Layer (Underneath) */}
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                            <User size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-gray-400 uppercase block mb-1 tracking-wider">Rechnungsempfänger</div>
                            <div className="text-sm font-bold text-gray-900 truncate">
                                {invoiceContactId ? (contacts.find(c => c.id === invoiceContactId)?.name || 'Gelöschter Kontakt') : 'Standard (Client Address)'}
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

                {/* Totals Preview */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col sm:flex-row gap-6 justify-between items-center">
                    <div className="flex flex-col sm:flex-row gap-8">
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Rechnungsbetrag</span>
                            <div className="text-2xl font-black text-gray-900">
                                {calculateTotals().gross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € <span className="text-sm font-normal text-gray-500">inkl. USt.</span>
                            </div>
                        </div>
                        <div className="sm:border-l sm:border-gray-200 sm:pl-8">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Danach verbleibend</span>
                            <div className="text-xl font-bold text-gray-600">
                                {Math.max(0, calculateProjectStats().remainingGross - calculateTotals().gross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button onClick={() => setShowPDFPreview(true)} className="flex-1 sm:flex-none justify-center bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition shadow-sm flex items-center gap-2">
                            <Eye size={16} /> Vorschau
                        </button>
                        <button onClick={() => handleSaveInvoice('draft')} className="flex-1 sm:flex-none justify-center bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20">
                            Rechnung erstellen
                        </button>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <History size={20} className="text-gray-400" /> Bisherige Rechnungen
                </h3>
                {invoices.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">Noch keine Rechnungen erstellt.</div>
                ) : (
                    <div className="space-y-3">
                        {invoices.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-900">{inv.invoice_number} - {inv.billed_data.title}</div>
                                        <div className="text-xs text-gray-500">{new Date(inv.invoice_date).toLocaleDateString('de-DE')} • v{inv.version} • {inv.total_gross.toLocaleString('de-DE')} €</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {inv.status === 'draft' && (
                                        <button
                                            onClick={() => handleEditInvoice(inv)}
                                            className="p-2 text-blue-400 hover:text-blue-600 transition"
                                            title="Bearbeiten"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                    )}
                                    <button
                                        className="p-2 text-gray-400 hover:text-gray-600 transition"
                                        title="Vorschau"
                                        onClick={() => {
                                            setBillingType(inv.billing_type);
                                            setBillingFraction(inv.billing_fraction || 1);
                                            setSelectedPositions(inv.billed_data.items?.map(i => ({ position_id: i.position_id, percentage: i.percentage })) || []);
                                            setIntroText(inv.intro_text || '');
                                            setOutroText(inv.outro_text || '');
                                            setInvoiceContactId(inv.invoice_contact_id || '');
                                            setShowPDFPreview(true);
                                        }}
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteInvoice(inv.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition"
                                        title="Löschen"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ContactModal
                isOpen={isAddingContact}
                onClose={() => setIsAddingContact(false)}
                onSave={async (data) => {
                    const { error } = await supabase.from('client_contacts').insert([{ ...data, client_id: project.client_id, organization_id: project.organization_id }]);
                    if (!error) {
                        toast.success('Kontakt erfolgreich hinzugefügt.');
                        fetchContacts();
                        setIsAddingContact(false);
                    } else {
                        toast.error('Fehler beim Hinzufügen des Kontakts: ' + error.message);
                    }
                }}
            />

            {showPDFPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-200 !mt-0">
                    <div className="bg-white lg:rounded-2xl w-full max-w-6xl h-full lg:h-[94vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2">
                                <Receipt size={20} className="text-blue-500" />
                                <h2 className="font-bold text-gray-900">Rechnungs-Vorschau</h2>
                            </div>
                            <button onClick={() => setShowPDFPreview(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-500 overflow-hidden">
                            <PDFViewer width="100%" height="100%" className="border-none">
                                <InvoicePDF
                                    project={project}
                                    invoice={{
                                        invoice_number: project.job_number,
                                        billing_type: billingType,
                                        billing_fraction: billingFraction,
                                        billed_data: {
                                            items: billingType === 'positions' ? selectedPositions.map(sp => {
                                                const allPositions = project.sections?.flatMap(s => s.positions || []) || project.positions || [];
                                                const pos = allPositions.find(p => p.id === sp.position_id);
                                                return { ...sp, amount: pos ? (pos.unit_price * pos.quantity * (sp.percentage / 100)) : 0 };
                                            }) : undefined,
                                            title: billingType === 'full' ? 'Gesamtabrechnung' : (billingType === 'fraction' ? `Teilabrechnung (${Math.round(billingFraction * 100)}%)` : 'Einzelaufstellung')
                                        },
                                        total_net: calculateTotals().net,
                                        total_tax: calculateTotals().tax,
                                        total_gross: calculateTotals().gross,
                                        intro_text: introText,
                                        outro_text: outroText,
                                        invoice_date: new Date().toISOString()
                                    }}
                                    agency={agencySettings}
                                    client={project.clients || null}
                                />
                            </PDFViewer>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                            <button onClick={() => setShowPDFPreview(false)} className="px-6 py-2 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 transition">
                                Schließen
                            </button>
                            <button
                                onClick={() => { setShowPDFPreview(false); handleSaveInvoice('draft'); }}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                            >
                                Entwurf speichern
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={isConfirmingDelete}
                title="Rechnung löschen"
                message="Möchtest du diese Rechnung wirklich dauerhaft löschen? Dieser Vorgang kann nicht rückgängig gemacht werden."
                confirmText="Löschen"
                onConfirm={confirmDeleteInvoice}
                onCancel={() => { setIsConfirmingDelete(false); setInvoiceToDelete(null); }}
                type="danger"
            />
        </div>
    );
}
