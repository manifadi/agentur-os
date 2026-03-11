import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Phone, Briefcase } from 'lucide-react';
import { ClientContact } from '../../types';

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (contact: Partial<ClientContact>) => Promise<void>;
    contact?: Partial<ClientContact> | null;
}

export default function ContactModal({ isOpen, onClose, onSave, contact }: ContactModalProps) {
    const [formData, setFormData] = useState<Partial<ClientContact>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (contact) {
            setFormData(contact);
        } else {
            setFormData({});
        }
    }, [contact, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!formData.name) return;
        setLoading(true);
        await onSave(formData);
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface border border-default rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-default">
                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                        <User size={20} className="text-text-muted" />
                        {contact?.id ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
                    </h3>
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Name *</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                autoFocus
                                className="w-full bg-subtle border border-default text-text-primary rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition font-medium"
                                placeholder="Vorname Nachname"
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Rolle / Position</label>
                        <div className="relative">
                            <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                className="w-full bg-subtle border border-default text-text-primary rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition"
                                placeholder="z.B. Projektleiter"
                                value={formData.role || ''}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    className="w-full bg-subtle border border-default text-text-primary rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition text-sm"
                                    placeholder="mail@..."
                                    value={formData.email || ''}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Telefon</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    className="w-full bg-subtle border border-default text-text-primary rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-accent-subtle focus:border-accent transition text-sm"
                                    placeholder="+43..."
                                    value={formData.phone || ''}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-subtle/50 border-t border-default flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-hover rounded-xl transition">
                        Abbrechen
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !formData.name}
                        className="px-6 py-2 bg-accent text-accent-text rounded-xl text-sm font-bold hover:brightness-110 transition shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={16} /> Speichern
                    </button>
                </div>
            </div>
        </div>
    );
}
