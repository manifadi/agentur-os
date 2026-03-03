import React, { useState, useEffect } from 'react';
import { X, Save, AlignLeft, Type, Hash, Euro } from 'lucide-react';

interface Position {
    id: string;
    title: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
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
        if (position) {
            setFormData({ ...position });
        }
    }, [position]);

    if (!isOpen || !formData) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <AlignLeft size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900">Position bearbeiten</h2>
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Leistungsdetails</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <Type size={14} /> Bezeichnung
                            </label>
                            <input
                                type="text"
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Titel der Leistung..."
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <AlignLeft size={14} /> Ausführliche Beschreibung / Spezifikation
                            </label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all min-h-[200px]"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Detaillierte Erläuterung der Leistung – dieser Text erscheint im Angebot..."
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <Hash size={14} /> Menge
                                </label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    Einheit
                                </label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all h-[50px]"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                >
                                    <option>Stunden</option>
                                    <option>Tage</option>
                                    <option>Pauschal</option>
                                    <option>Stk.</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <Euro size={14} /> Einzelpreis
                                </label>
                                <input
                                    type="number"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-right"
                                    value={formData.unitPrice}
                                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div className="text-sm">
                        <span className="text-gray-400 uppercase font-bold tracking-widest text-[10px]">Positionssumme</span>
                        <div className="text-2xl font-bold text-gray-900">
                            {(formData.quantity * formData.unitPrice).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition">
                            Abbrechen
                        </button>
                        <button
                            onClick={() => onSave(formData)}
                            className="px-8 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black shadow-lg shadow-gray-200 flex items-center gap-2 transition"
                        >
                            <Save size={18} /> Speichern
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
