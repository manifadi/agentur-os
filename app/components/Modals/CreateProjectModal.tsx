import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Client, Employee } from '../../types';

interface CreateProjectModalProps {
    isOpen: boolean;
    clients: Client[];
    employees: Employee[];
    onClose: () => void;
    onCreate: (data: { title: string; jobNr: string; clientId: string; pmId: string }) => Promise<void>;
}

export default function CreateProjectModal({ isOpen, clients, employees, onClose, onCreate }: CreateProjectModalProps) {
    const [data, setData] = useState({ title: '', jobNr: '', clientId: '', pmId: '' });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Neues Projekt anlegen</h2><button onClick={onClose}><X size={20} className="text-gray-400" /></button></div>
                <div className="space-y-4">
                    <div><label className="text-xs font-semibold text-gray-500 uppercase">Kunde</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.clientId} onChange={(e) => setData({ ...data, clientId: e.target.value })}><option value="">Bitte wählen...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="grid grid-cols-3 gap-4"><div className="col-span-1"><label className="text-xs font-semibold text-gray-500 uppercase">Job Nr.</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.jobNr} onChange={(e) => setData({ ...data, jobNr: e.target.value })} /></div><div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Projekt Titel</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} /></div></div>
                    <div><label className="text-xs font-semibold text-gray-500 uppercase">Projektmanager</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={data.pmId} onChange={(e) => setData({ ...data, pmId: e.target.value })}><option value="">Kein PM zugewiesen</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                    <div className="pt-4 flex gap-3"><button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600">Abbrechen</button><button onClick={() => onCreate(data)} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">Projekt anlegen</button></div>
                </div>
            </div>
        </div>
    );
}
