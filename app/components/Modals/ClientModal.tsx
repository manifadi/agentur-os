import React, { useState, useEffect } from 'react';
import { X, Save, Building2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import { Client } from '../../types';
import ConfirmModal from './ConfirmModal';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (clientData: any) => Promise<void>;
    client?: Client | null;
}

export default function ClientModal({ isOpen, onClose, onSave, client }: ClientModalProps) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [fullName, setFullName] = useState('');
    const [address, setAddress] = useState('');
    const [uid, setUid] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'info' | 'warning' | 'success';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'danger'
    });

    useEffect(() => {
        if (client) {
            setName(client.name);
            setFullName(client.full_name || '');
            setAddress(client.address || ''); // DB field is 'address'
            setUid(client.uid_number || '');
            setEmail(client.general_email || '');
            setPhone(client.general_phone || '');
            setWebsite(client.website || '');
            setLogoUrl(client.logo_url || null);
        } else {
            setName('');
            setFullName('');
            setAddress('');
            setUid('');
            setEmail('');
            setPhone('');
            setWebsite('');
            setLogoUrl(null);
        }
    }, [client, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({
                name,
                full_name: fullName,
                address,
                uid_number: uid,
                general_email: email,
                general_phone: phone,
                website,
                logo_url: logoUrl
            });
            onClose();
        } catch (e: any) {
            setConfirmConfig({
                isOpen: true,
                title: 'Fehler beim Speichern',
                message: e.message,
                type: 'danger'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setConfirmConfig({
                isOpen: true,
                title: 'Dateiformat Fehler',
                message: 'Bitte lade nur Bilddateien (JPG, PNG, WebP) hoch.',
                type: 'warning'
            });
            return;
        }

        setIsUploading(true);
        try {
            // Org-namespaced Upload (siehe supabaseUtils) → mandantensaubere Storage-Pfade.
            const publicUrl = await uploadFileToSupabase(file, 'client-logos');
            setLogoUrl(publicUrl);
        } catch (error: any) {
            console.error('Full catch error:', error);
            setConfirmConfig({
                isOpen: true,
                title: 'Upload Fehler',
                message: `Es gab ein Problem beim Hochladen des Logos: ${error.message || 'Unbekannter Fehler'}.`,
                type: 'danger'
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-surface border border-default rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-text-primary"><Building2 size={24} /> {client ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h2>
                    <button onClick={onClose}><X size={24} className="text-text-muted hover:text-text-primary" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center gap-4 mb-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageUpload}
                        />
                        <div
                            className="w-16 h-16 border-2 border-dashed border-default rounded-xl flex items-center justify-center cursor-pointer hover:border-text-muted transition relative overflow-hidden group"
                            style={{ background: logoUrl ? '#ffffff' : 'var(--bg-subtle)' }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {logoUrl ? (
                                <img src={logoUrl} className="w-full h-full object-contain p-1" />
                            ) : (
                                <Building2 size={24} className="text-text-muted" />
                            )}

                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {isUploading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <span className="text-[8px] text-white font-bold uppercase">Upload</span>
                                )}
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Kurzname (Anzeige)*</label>
                            <input required className="w-full p-2 border border-default rounded-xl bg-subtle text-text-primary focus:border-accent outline-none" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. ACME" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Vollständiger Name (Vertrag)</label>
                        <input className="w-full p-2 border border-default rounded-xl bg-subtle text-text-primary focus:border-accent outline-none" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="z.B. ACME GmbH & Co KG" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Anschrift</label>
                        <textarea className="w-full p-2 border border-default rounded-xl bg-subtle text-text-primary focus:border-accent outline-none resize-none h-20" value={address} onChange={e => setAddress(e.target.value)} placeholder="Straße, PLZ, Ort" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">UID-Nummer</label>
                            <input className="w-full p-2 border border-default rounded-xl bg-subtle text-text-primary focus:border-accent outline-none" value={uid} onChange={e => setUid(e.target.value)} placeholder="ATU..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Email (Allgemein)</label>
                            <input className="w-full p-2 border border-default rounded-xl bg-subtle text-text-primary focus:border-accent outline-none" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@..." />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Telefon (Allgemein)</label>
                            <input className="w-full p-2 border border-default rounded-xl bg-subtle text-text-primary focus:border-accent outline-none" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+43..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Webseite</label>
                            <input className="w-full p-2 border border-default rounded-xl bg-subtle text-text-primary focus:border-accent outline-none" value={website} onChange={e => setWebsite(e.target.value)} placeholder="www..." />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-hover rounded-xl">Abbrechen</button>
                        <button type="submit" disabled={loading} className="bg-accent text-accent-text px-6 py-2 rounded-xl font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
                            <Save size={16} /> Speichern
                        </button>
                    </div>
                </form>
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                showCancel={false}
                type={confirmConfig.type}
                confirmText="OK"
            />
        </div>
    );
}
