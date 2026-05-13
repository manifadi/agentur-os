import React, { useState, useEffect } from 'react';
import { X, Save, AlignLeft, Type, Hash, Euro, PackageOpen } from 'lucide-react';

interface Position {
    id: string;
    title: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    isExternal: boolean;
    purchasePrice: number;
}

interface PositionEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedPos: Position) => void;
    position: Position | null;
}

export default function PositionEditModal({ isOpen, onClose, onSave, position }: PositionEditModalProps) {
    const [formData, setFormData] = useState<Position | null>(null);

    useEffect(() => {
        if (position) setFormData({ ...position });
    }, [position]);

    if (!isOpen || !formData) return null;

    const totalSell  = formData.quantity * formData.unitPrice;
    const totalBuy   = formData.quantity * formData.purchasePrice;
    const margin     = totalSell - totalBuy;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-default rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-default flex justify-between items-center bg-surface sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-subtle text-accent flex items-center justify-center">
                            <AlignLeft size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-text-primary">Position bearbeiten</h2>
                            <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Leistungsdetails</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-hover rounded-full transition">
                        <X size={20} className="text-text-muted hover:text-text-primary" />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Fremdleistung toggle */}
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isExternal: !formData.isExternal, purchasePrice: formData.isExternal ? 0 : formData.purchasePrice })}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                            formData.isExternal
                                ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20'
                                : 'border-default bg-subtle hover:border-accent/40'
                        }`}
                    >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${formData.isExternal ? 'bg-orange-500 text-white' : 'bg-hover text-text-muted'}`}>
                            <PackageOpen size={16} />
                        </div>
                        <div>
                            <div className={`text-sm font-bold ${formData.isExternal ? 'text-orange-700 dark:text-orange-400' : 'text-text-primary'}`}>
                                Fremdleistung
                            </div>
                            <div className="text-xs text-text-muted">Eingekaufte Leistung mit separatem Einkaufswert</div>
                        </div>
                        <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.isExternal ? 'border-orange-500 bg-orange-500' : 'border-default'}`}>
                            {formData.isExternal && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                    </button>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Type size={14} /> Bezeichnung
                            </label>
                            <input
                                type="text"
                                className="w-full bg-subtle border border-default rounded-2xl px-4 py-3 text-lg font-bold text-text-primary focus:ring-2 focus:ring-accent-subtle focus:border-accent focus:bg-surface outline-none transition-all"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Titel der Leistung..."
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-2">
                                <AlignLeft size={14} /> Ausführliche Beschreibung / Spezifikation
                            </label>
                            <textarea
                                className="w-full bg-subtle border border-default rounded-2xl px-4 py-3 text-text-primary focus:ring-2 focus:ring-accent-subtle focus:border-accent focus:bg-surface outline-none transition-all min-h-[160px]"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detaillierte Erläuterung der Leistung – dieser Text erscheint im Angebot..."
                            />
                        </div>

                        <div className={`grid gap-4 border-t border-default pt-6 ${formData.isExternal ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            <div>
                                <label className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <Hash size={14} /> Menge
                                </label>
                                <input
                                    type="number"
                                    className="w-full bg-subtle border border-default rounded-xl px-4 py-3 text-lg font-mono font-bold text-text-primary focus:ring-2 focus:ring-accent-subtle focus:border-accent focus:bg-surface outline-none transition-all"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-2">
                                    Einheit
                                </label>
                                <select
                                    className="w-full bg-subtle border border-default rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:ring-2 focus:ring-accent-subtle focus:border-accent focus:bg-surface outline-none transition-all h-[50px]"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                >
                                    <option>Stunden</option>
                                    <option>Tage</option>
                                    <option>Pauschal</option>
                                    <option>Stk.</option>
                                </select>
                            </div>

                            {!formData.isExternal && (
                                <div>
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Euro size={14} /> Einzelpreis
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-subtle border border-default rounded-xl px-4 py-3 text-lg font-mono font-bold text-text-primary focus:ring-2 focus:ring-accent-subtle focus:border-accent focus:bg-surface outline-none transition-all text-right"
                                        value={formData.unitPrice}
                                        onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Fremdleistung: EK / VK */}
                        {formData.isExternal && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-200 dark:border-orange-800">
                                <div>
                                    <label className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Euro size={14} /> Einkaufswert (EK)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-white dark:bg-surface border border-orange-200 dark:border-orange-700 rounded-xl px-4 py-3 text-lg font-mono font-bold text-text-primary focus:ring-2 focus:ring-orange-400 outline-none transition-all text-right"
                                        value={formData.purchasePrice}
                                        onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                    <div className="text-[10px] text-orange-500 mt-1">Gesamt: {(formData.quantity * formData.purchasePrice).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                        <Euro size={14} /> Verkaufswert (VK)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full bg-white dark:bg-surface border border-orange-200 dark:border-orange-700 rounded-xl px-4 py-3 text-lg font-mono font-bold text-text-primary focus:ring-2 focus:ring-orange-400 outline-none transition-all text-right"
                                        value={formData.unitPrice}
                                        onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                                        placeholder="0"
                                    />
                                    <div className="text-[10px] text-orange-500 mt-1">Gesamt: {(formData.quantity * formData.unitPrice).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-default flex justify-between items-center bg-subtle/50">
                    <div className="text-sm">
                        <span className="text-text-muted uppercase font-bold tracking-widest text-[10px]">
                            {formData.isExternal ? 'Verkaufssumme' : 'Positionssumme'}
                        </span>
                        <div className="text-2xl font-bold text-text-primary">
                            {totalSell.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </div>
                        {formData.isExternal && totalBuy > 0 && (
                            <div className={`text-xs font-semibold mt-0.5 ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                EK {totalBuy.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} · Marge {margin.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-hover transition">
                            Abbrechen
                        </button>
                        <button
                            onClick={() => onSave(formData)}
                            className="px-8 py-2.5 bg-accent text-accent-text rounded-xl text-sm font-bold hover:brightness-110 shadow-sm flex items-center gap-2 transition"
                        >
                            <Save size={18} /> Speichern
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
