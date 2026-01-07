import React, { useState, useEffect } from 'react';
import { X, Save, Building2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Client } from '../../types';

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
            alert('Fehler: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Bitte lade nur Bildformate hoch.');
            return;
        }

        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = fileName;

        try {
            console.log('Attempting upload to bucket: client-logos, path:', filePath);
            const { error: uploadError } = await supabase.storage
                .from('client-logos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error('Supabase Upload Error:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('client-logos')
                .getPublicUrl(filePath);

            setLogoUrl(publicUrl);
        } catch (error: any) {
            console.error('Full catch error:', error);
            alert(`Fehler beim Upload: ${error.message || 'Unbekannter Fehler'}. Siehe Konsole für Details.`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Building2 size={24} /> {client ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h2>
                    <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-900" /></button>
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
                            className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-gray-400 transition relative overflow-hidden group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {logoUrl ? (
                                <img src={logoUrl} className="w-full h-full object-contain" />
                            ) : (
                                <Building2 size={24} className="text-gray-300" />
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
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kurzname (Anzeige)*</label>
                            <input required className="w-full p-2 border rounded-lg" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. ACME" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vollständiger Name (Vertrag)</label>
                        <input className="w-full p-2 border rounded-lg" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="z.B. ACME GmbH & Co KG" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Anschrift</label>
                        <textarea className="w-full p-2 border rounded-lg resize-none h-20" value={address} onChange={e => setAddress(e.target.value)} placeholder="Straße, PLZ, Ort" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">UID-Nummer</label>
                            <input className="w-full p-2 border rounded-lg" value={uid} onChange={e => setUid(e.target.value)} placeholder="ATU..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (Allgemein)</label>
                            <input className="w-full p-2 border rounded-lg" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@..." />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefon (Allgemein)</label>
                            <input className="w-full p-2 border rounded-lg" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+43..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Webseite</label>
                            <input className="w-full p-2 border rounded-lg" value={website} onChange={e => setWebsite(e.target.value)} placeholder="www..." />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg">Abbrechen</button>
                        <button type="submit" disabled={loading} className="bg-gray-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
                            <Save size={16} /> Speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
