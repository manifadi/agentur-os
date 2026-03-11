import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Employee } from '../../types';

interface EmployeeModalProps {
    isOpen: boolean;
    employee: Employee | null;
    onClose: () => void;
    onSave: (name: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export default function EmployeeModal({ isOpen, employee, onClose, onSave, onDelete }: EmployeeModalProps) {
    const [name, setName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(employee ? employee.name : '');
        }
    }, [isOpen, employee]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-surface border border-default rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-text-primary">{employee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</h2><button onClick={onClose}><X size={20} className="text-text-muted hover:text-text-primary" /></button></div>
                <div className="space-y-4">
                    <div><label className="text-xs font-semibold text-text-secondary uppercase">Name</label><input autoFocus type="text" className="w-full rounded-xl border border-default text-sm py-2 px-3 bg-subtle text-text-primary mt-1 focus:border-accent outline-none" value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div className="pt-2 flex gap-3">{employee && <button onClick={() => onDelete(employee.id)} className="p-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"><Trash2 size={16} /></button>}<button onClick={() => onSave(name)} className="flex-1 py-2.5 rounded-xl bg-accent text-accent-text text-sm font-medium hover:brightness-110 shadow-lg">Speichern</button></div>
                </div>
            </div>
        </div>
    );
}
