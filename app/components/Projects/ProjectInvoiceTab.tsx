import React, { useState, useEffect } from 'react';
import { Project, AgencySettings, OrganizationTemplate, ClientContact, ProjectInvoice, ProjectPosition } from '../../types';
import { supabase } from '../../supabaseClient';
import { FileText, Eye, X, Plus, User, Calculator, History, Download, Trash2, CheckCircle, AlertCircle, Info, Receipt, Edit3, ChevronDown, TrendingUp, Layers, Circle } from 'lucide-react';
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
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    const [currentVersion, setCurrentVersion] = useState(1);

    useEffect(() => {
        fetchInvoices();
        if (project.client_id) fetchContacts();
    }, [project.id, project.client_id]);

    const fetchInvoices = async () => {
        setLoading(true);
        const { data } = await supabase
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
            totalNet, totalGross: totalNet * (1 + taxRate),
            billedNet, billedGross: billedNet * (1 + taxRate),
            remainingNet, remainingGross: remainingNet * (1 + taxRate)
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
            result = await supabase.from('project_invoices').update(invoiceData).eq('id', editingInvoiceId);
        } else {
            result = await supabase.from('project_invoices').insert([invoiceData]);
        }

        if (result?.error) {
            toast.error('Fehler beim Speichern: ' + result.error.message);
        } else {
            fetchInvoices();
            resetDraft();
            toast.success(status === 'final' ? 'Rechnung finalisiert.' : 'Rechnung gespeichert.');
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
        if (error) toast.error('Fehler beim Löschen: ' + error.message);
        else { toast.success('Rechnung gelöscht.'); fetchInvoices(); }
        setIsConfirmingDelete(false);
        setInvoiceToDelete(null);
    };

    const stats = calculateProjectStats();
    const totals = calculateTotals();
    const billedPct = stats.totalGross > 0 ? Math.round((stats.billedGross / stats.totalGross) * 100) : 0;

    return (
        <div className="space-y-6 pb-16 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* ─ Finanzkennzahlen ──────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface border border-default rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Gesamtvolumen</div>
                    <div className="text-2xl font-black text-text-primary leading-none mb-1">
                        {stats.totalGross.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                    </div>
                    <div className="text-xs text-text-muted">{stats.totalNet.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} € netto</div>
                </div>
                <div className="bg-surface border border-default rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Bereits abgerechnet</div>
                    <div className="text-2xl font-black text-green-500 leading-none mb-1">
                        {stats.billedGross.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-subtle rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all duration-700" style={{ width: `${billedPct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-text-muted">{billedPct}%</span>
                    </div>
                </div>
                <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-accent mb-2">Noch ausstehend</div>
                    <div className="text-2xl font-black text-accent leading-none mb-1">
                        {stats.remainingGross.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                    </div>
                    <div className="text-xs text-accent/70">{stats.remainingNet.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} € netto</div>
                </div>
            </div>

            {/* ─ Neue Rechnung ─────────────────────────────────────── */}
            <div className="bg-surface rounded-2xl border border-default shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-default bg-subtle flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent text-surface flex items-center justify-center text-xs font-black shrink-0">+</div>
                    <h3 className="text-sm font-bold text-text-primary">
                        {editingInvoiceId ? 'Entwurf bearbeiten' : 'Neue Rechnung erstellen'}
                    </h3>
                    {editingInvoiceId && (
                        <button onClick={resetDraft} className="ml-auto text-xs text-text-muted hover:text-text-primary transition">
                            Abbrechen
                        </button>
                    )}
                </div>

                <div className="p-5 space-y-6">
                    {/* Step 1: Abrechnungstyp */}
                    <div>
                        <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Abrechnungstyp</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { id: 'full', label: 'Gesamtabrechnung', sub: '100% des verbleibenden Volumens', icon: CheckCircle },
                                { id: 'fraction', label: 'Teilbetrag', sub: 'Einen Bruchteil abrechnen', icon: Layers },
                                { id: 'positions', label: 'Einzelne Positionen', sub: 'Spezifische Leistungen wählen', icon: TrendingUp },
                            ].map(({ id, label, sub, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => {
                                        setBillingType(id as any);
                                        if (id !== 'fraction') setBillingFraction(1);
                                        if (id !== 'positions') setSelectedPositions([]);
                                    }}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${billingType === id
                                        ? 'border-accent bg-accent/10 text-accent'
                                        : 'border-default hover:border-accent/50 text-text-primary bg-subtle'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon size={15} className={billingType === id ? 'text-accent' : 'text-text-muted'} />
                                        <span className="font-bold text-sm">{label}</span>
                                    </div>
                                    <span className="text-xs text-text-muted">{sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fraction options */}
                    {billingType === 'fraction' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Anteil wählen</div>
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {[1, 0.5, 0.33, 0.25].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => { setBillingFraction(f); setCustomPercentage(''); }}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${billingFraction === f && !customPercentage
                                            ? 'bg-accent text-surface border-accent shadow-lg shadow-accent/20'
                                            : 'bg-subtle text-text-secondary border-default hover:bg-hover'
                                            }`}
                                    >
                                        {f === 1 ? '100%' : (f === 0.5 ? '50%' : (f === 0.33 ? '33%' : '25%'))} Rest
                                    </button>
                                ))}
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="Eigener"
                                        value={customPercentage}
                                        onChange={(e) => { setCustomPercentage(e.target.value); setBillingFraction(0); }}
                                        className={`w-28 pl-3 pr-8 py-2 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-accent/20 outline-none transition-all ${customPercentage ? 'border-accent bg-accent/5' : 'border-default bg-subtle text-text-primary'}`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs font-bold">%</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-2 rounded-xl w-fit" style={{ color: 'var(--color-info-text)', background: 'var(--color-info-subtle)', border: '1px solid var(--color-info-border)' }}>
                                <Info size={13} />
                                Prozentsatz bezieht sich auf den verbleibenden Restbetrag.
                            </div>
                        </div>
                    )}

                    {/* Positions table */}
                    {billingType === 'positions' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Positionen wählen</div>
                            <div className="border border-default rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-subtle">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Position</th>
                                            <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Gesamt</th>
                                            <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">Abgerechnet</th>
                                            <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider w-32">Anteil %</th>
                                            <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider text-right">Betrag</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-default bg-surface">
                                        {(project.sections?.flatMap(s => s.positions || []) || project.positions || []).map(pos => {
                                            const alreadyBilledPercent = getAlreadyBilledPercentage(pos.id);
                                            const selection = selectedPositions.find(sp => sp.position_id === pos.id);
                                            const currentPercent = selection?.percentage || 0;
                                            const totalAmount = pos.unit_price * pos.quantity;
                                            const currentAmount = totalAmount * (currentPercent / 100);
                                            return (
                                                <tr key={pos.id} className="hover:bg-hover transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-text-primary">{pos.title}</div>
                                                        <div className="text-xs text-text-muted mt-0.5">{pos.quantity} {pos.unit} × {pos.unit_price.toLocaleString('de-DE')} €</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-text-primary">{totalAmount.toLocaleString('de-DE')} €</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 bg-subtle rounded-full overflow-hidden">
                                                                <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, alreadyBilledPercent)}%` }} />
                                                            </div>
                                                            <span className="text-xs font-bold text-text-muted w-8">{alreadyBilledPercent}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                type="number" min="0" max={100 - alreadyBilledPercent}
                                                                value={currentPercent}
                                                                onChange={(e) => {
                                                                    const val = Math.min(100 - alreadyBilledPercent, Math.max(0, parseInt(e.target.value) || 0));
                                                                    setSelectedPositions(prev => {
                                                                        const existing = prev.find(p => p.position_id === pos.id);
                                                                        if (existing) return prev.map(p => p.position_id === pos.id ? { ...p, percentage: val } : p);
                                                                        return [...prev, { position_id: pos.id, percentage: val }];
                                                                    });
                                                                }}
                                                                className="w-14 p-1.5 border border-default bg-subtle text-text-primary rounded-lg text-center font-bold focus:ring-2 focus:ring-accent/20 outline-none"
                                                            />
                                                            <span className="text-text-muted text-xs">%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-text-primary">
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

                    {/* Texts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Einleitungstext</label>
                                <select className="text-xs border border-default bg-subtle text-text-primary rounded-lg py-1 px-2 focus:ring-1 focus:ring-accent" onChange={(e) => setIntroText(e.target.value)} value="">
                                    <option value="" disabled>Vorlage…</option>
                                    {templates.map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                                </select>
                            </div>
                            <textarea
                                value={introText}
                                onChange={(e) => setIntroText(e.target.value)}
                                placeholder="Z.B. Sehr geehrte Damen und Herren, anbei erhalten Sie die Rechnung…"
                                className="w-full h-28 p-4 border border-default bg-subtle text-text-primary rounded-xl text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none resize-none placeholder:text-text-placeholder"
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Schlusstext</label>
                                <select className="text-xs border border-default bg-subtle text-text-primary rounded-lg py-1 px-2 focus:ring-1 focus:ring-accent" onChange={(e) => setOutroText(e.target.value)} value="">
                                    <option value="" disabled>Vorlage…</option>
                                    {templates.map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                                </select>
                            </div>
                            <textarea
                                value={outroText}
                                onChange={(e) => setOutroText(e.target.value)}
                                placeholder="Z.B. Wir bitten um Überweisung innerhalb von 14 Tagen…"
                                className="w-full h-28 p-4 border border-default bg-subtle text-text-primary rounded-xl text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none resize-none placeholder:text-text-placeholder"
                            />
                        </div>
                    </div>

                    {/* Contact */}
                    <div>
                        <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Rechnungsempfänger</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="relative group bg-subtle p-4 rounded-xl border border-default flex items-center gap-4 hover:border-accent transition-all cursor-pointer overflow-hidden">
                                <select
                                    value={invoiceContactId}
                                    onChange={(e) => setInvoiceContactId(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                >
                                    <option value="">Standard (Kundendaten)</option>
                                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                                    <User size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">Empfänger</div>
                                    <div className="text-sm font-bold text-text-primary truncate">
                                        {invoiceContactId ? (contacts.find(c => c.id === invoiceContactId)?.name || 'Gelöschter Kontakt') : 'Standard (Kundendaten)'}
                                    </div>
                                </div>
                                <ChevronDown size={14} className="text-text-muted shrink-0" />
                            </label>
                            <button
                                onClick={() => setIsAddingContact(true)}
                                className="bg-subtle p-4 rounded-xl border border-dashed border-default flex items-center gap-4 hover:border-accent hover:bg-accent/5 transition-all group"
                            >
                                <div className="w-9 h-9 rounded-xl bg-surface border border-default group-hover:bg-accent/10 group-hover:border-accent/30 flex items-center justify-center text-text-muted group-hover:text-accent transition-colors">
                                    <Plus size={16} />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-text-primary">Empfänger hinzufügen</div>
                                    <div className="text-xs text-text-muted">Neuen Kontakt anlegen</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer / Action bar */}
                <div className="px-5 py-4 border-t border-default bg-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <div className="text-xs text-text-muted mb-0.5">Rechnungsbetrag diese Rechnung</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-text-primary">{totals.gross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                            <span className="text-xs text-text-muted">inkl. 20% USt.</span>
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5">Danach noch ausstehend: {Math.max(0, stats.remainingGross - totals.gross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => setShowPDFPreview(true)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-surface border border-default text-text-primary px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-hover transition shadow-sm"
                        >
                            <Eye size={15} /> Vorschau
                        </button>
                        <button
                            onClick={() => handleSaveInvoice('draft')}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-accent text-surface px-5 py-2.5 rounded-xl text-sm font-bold hover:brightness-110 transition shadow-lg shadow-accent/20"
                        >
                            <Receipt size={14} /> Rechnung erstellen
                        </button>
                    </div>
                </div>
            </div>

            {/* ─ Rechnungs-Historie ─────────────────────────────────── */}
            <div className="bg-surface rounded-2xl border border-default shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-default bg-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History size={15} className="text-text-muted" />
                        <h3 className="text-sm font-bold text-text-primary">Bisherige Rechnungen</h3>
                    </div>
                    {invoices.length > 0 && (
                        <span className="text-xs font-bold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                            {invoices.length}
                        </span>
                    )}
                </div>

                {invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                        <div className="w-12 h-12 rounded-2xl bg-subtle border border-default flex items-center justify-center mb-3">
                            <Receipt size={20} className="text-text-placeholder" />
                        </div>
                        <p className="text-sm font-semibold text-text-primary mb-1">Noch keine Rechnungen</p>
                        <p className="text-xs text-text-secondary">Erstelle deine erste Rechnung für dieses Projekt.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-default">
                        {invoices.map((inv, idx) => {
                            const isLatest = idx === 0;
                            const isDraft = inv.status === 'draft';
                            return (
                                <div key={inv.id} className="flex items-center justify-between px-5 py-4 hover:bg-hover transition-colors group">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDraft ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <span className="font-bold text-sm text-text-primary">{inv.invoice_number} – {inv.billed_data.title}</span>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isDraft ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                                                    {isDraft ? 'Entwurf' : 'Final'}
                                                </span>
                                                {isLatest && (
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-accent bg-accent/10 px-1.5 py-0.5 rounded">Aktuell</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-text-secondary">
                                                {new Date(inv.invoice_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                {' · '}v{inv.version}
                                                {' · '}<span className="font-bold">{inv.total_gross.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isDraft && (
                                            <button
                                                onClick={() => handleEditInvoice(inv)}
                                                className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                                title="Bearbeiten"
                                            >
                                                <Edit3 size={15} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setBillingType(inv.billing_type);
                                                setBillingFraction(inv.billing_fraction || 1);
                                                setSelectedPositions(inv.billed_data.items?.map(i => ({ position_id: i.position_id, percentage: i.percentage })) || []);
                                                setIntroText(inv.intro_text || '');
                                                setOutroText(inv.outro_text || '');
                                                setInvoiceContactId(inv.invoice_contact_id || '');
                                                setShowPDFPreview(true);
                                            }}
                                            className="p-2 text-text-muted hover:text-text-primary hover:bg-hover rounded-lg transition-colors"
                                            title="Vorschau"
                                        >
                                            <Eye size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteInvoice(inv.id)}
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

            {/* Contact Modal */}
            <ContactModal
                isOpen={isAddingContact}
                onClose={() => setIsAddingContact(false)}
                onSave={async (data) => {
                    const { error } = await supabase.from('client_contacts').insert([{ ...data, client_id: project.client_id, organization_id: project.organization_id }]);
                    if (!error) { toast.success('Kontakt hinzugefügt.'); fetchContacts(); setIsAddingContact(false); }
                    else toast.error('Fehler: ' + error.message);
                }}
            />

            {/* PDF Preview Modal */}
            {showPDFPreview && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 lg:p-4 animate-in fade-in duration-200 !mt-0">
                    <div className="bg-surface lg:rounded-2xl w-full max-w-6xl h-full lg:h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-default">
                        <div className="p-4 border-b border-default flex justify-between items-center bg-surface">
                            <div className="flex items-center gap-2">
                                <Receipt size={18} className="text-accent" />
                                <h2 className="font-bold text-text-primary">Rechnungs-Vorschau</h2>
                            </div>
                            <button onClick={() => setShowPDFPreview(false)} className="p-2 hover:bg-hover rounded-xl transition">
                                <X size={18} className="text-text-muted" />
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
                        <div className="p-4 border-t border-default flex justify-end gap-3 bg-surface">
                            <button onClick={() => setShowPDFPreview(false)} className="px-5 py-2 border border-default rounded-xl text-sm font-bold text-text-primary hover:bg-hover transition">
                                Schließen
                            </button>
                            <button onClick={() => { setShowPDFPreview(false); handleSaveInvoice('draft'); }} className="px-5 py-2 bg-accent text-surface rounded-xl text-sm font-bold hover:brightness-110 shadow-lg shadow-accent/20">
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
