import React, { useState, useEffect } from 'react';
import { X, Save, Building2 } from 'lucide-react';
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

    useEffect(() => {
        if (client) {
            setName(client.name);
            setFullName(client.full_name || '');
            setAddress(client.address || ''); // DB field is 'address'
            setUid(client.uid_number || '');
            setEmail(client.general_email || '');
            setPhone(client.general_phone || '');
            setWebsite(client.website || '');
        } else {
            setName('');
            setFullName('');
            setAddress('');
            setUid('');
            setEmail('');
            setPhone('');
            setWebsite('');
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
                website
            });
            onClose();
        } catch (e: any) {
            alert('Fehler: ' + e.message);
        } finally {
            setLoading(false);
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
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kurzname (Anzeige)*</label>
                        <input required className="w-full p-2 border rounded-lg" value={name} onChange={e => setName(e.target.value)} placeholder="z.B. ACME" />
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
