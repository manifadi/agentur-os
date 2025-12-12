import React, { useState, useRef, useEffect } from 'react';
import { X, ImageIcon, Trash2 } from 'lucide-react';
import { Client } from '../../types';

interface ClientModalProps {
    isOpen: boolean;
    client: Client | null;
    onClose: () => void;
    onSave: (name: string, logo: File | null) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export default function ClientModal({ isOpen, client, onClose, onSave, onDelete }: ClientModalProps) {
    const [name, setName] = useState('');
    const [logo, setLogo] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(client ? client.name : '');
            setLogo(null);
        }
    }, [isOpen, client]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setUploading(true);
        await onSave(name, logo);
        setUploading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">{client ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h2><button onClick={onClose}><X size={20} className="text-gray-400" /></button></div>
                <div className="space-y-4">
                    <div><label className="text-xs font-semibold text-gray-500 uppercase">Firmenname</label><input autoFocus type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50 mt-1" value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Logo (Optional)</label><div className="flex items-center gap-2"><button onClick={() => logoInputRef.current?.click()} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg flex items-center gap-2 text-gray-600"><ImageIcon size={14} /> {logo ? 'Datei gewählt' : 'Logo wählen'}</button>{client?.logo_url && !logo && <span className="text-xs text-green-600">Aktuelles Logo vorhanden</span>}</div><input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={(e) => e.target.files && setLogo(e.target.files[0])} /></div>
                    <div className="pt-2 flex gap-3">{client && <button onClick={() => onDelete(client.id)} className="p-2.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>}<button onClick={handleSave} disabled={uploading} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg disabled:opacity-50">{uploading ? 'Speichert...' : 'Speichern'}</button></div>
                </div>
            </div>
        </div>
    );
}
