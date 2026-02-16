import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown, Check, User, ArrowUpDown, Tag } from 'lucide-react';
import { Employee } from '../../types';
import UserAvatar from '../UI/UserAvatar';

interface FilterMenuProps {
    employees: Employee[];
    activeStatus: string[];
    setActiveStatus: (status: string[]) => void;
    activePmId: string | null;
    setActivePmId: (id: string | null) => void;
    sortOrder: 'deadline_asc' | 'deadline_desc' | 'created_desc' | 'title_asc';
    setSortOrder: (order: 'deadline_asc' | 'deadline_desc' | 'created_desc' | 'title_asc') => void;
}

export default function FilterMenu({
    employees,
    activeStatus,
    setActiveStatus,
    activePmId,
    setActivePmId,
    sortOrder,
    setSortOrder
}: FilterMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const STATUS_OPTIONS = ['Bearbeitung', 'Warten auf Kundenfeedback', 'Warten auf Mitarbeiter', 'Erledigt', 'Abgebrochen'];

    const toggleStatus = (status: string) => {
        if (activeStatus.includes(status)) {
            setActiveStatus(activeStatus.filter(s => s !== status));
        } else {
            setActiveStatus([...activeStatus, status]);
        }
    };

    const activeCount = (activeStatus.length > 0 ? 1 : 0) + (activePmId ? 1 : 0);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all shadow-sm hover:shadow-md ${isOpen || activeCount > 0 ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
                <Filter size={18} strokeWidth={2.5} />
                <span>Filter</span>
                {activeCount > 0 && (
                    <span className="bg-gray-900 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full ml-1">{activeCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900 text-sm">Ansicht anpassen</h3>
                        <button onClick={() => { setActiveStatus([]); setActivePmId(null); setSortOrder('created_desc'); }} className="text-xs text-gray-400 hover:text-red-500 font-medium">
                            Reset
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* SORTIERUNG */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                                <ArrowUpDown size={12} /> Sortierung
                            </label>
                            <select
                                className="w-full text-sm border-gray-200 rounded-lg p-2 bg-gray-50 focus:bg-white transition-colors"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value as any)}
                            >
                                <option value="deadline_asc">Deadline (Aufsteigend)</option>
                                <option value="deadline_desc">Deadline (Absteigend)</option>
                                <option value="created_desc">Erstellt (Neueste zuerst)</option>
                                <option value="title_asc">Alphabetisch (A-Z)</option>
                            </select>
                        </div>

                        {/* STATUS */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                                <Tag size={12} /> Status
                            </label>
                            <div className="space-y-1">
                                {STATUS_OPTIONS.map(status => (
                                    <button
                                        key={status}
                                        onClick={() => toggleStatus(status)}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${activeStatus.includes(status) ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        <span>{status}</span>
                                        {activeStatus.includes(status) && <Check size={14} className="text-green-600" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* PROJEKTMANAGER */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                                <User size={12} /> Projektmanager
                            </label>
                            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-none pr-1">
                                <button
                                    onClick={() => setActivePmId(null)}
                                    className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors ${!activePmId ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <span>Alle Manager</span>
                                    {!activePmId && <Check size={14} className="text-blue-600" />}
                                </button>
                                {employees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => setActivePmId(emp.id)}
                                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${activePmId === emp.id ? 'bg-blue-50 text-blue-700 font-medium border border-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                        <span className="flex-1 text-left truncate">{emp.name}</span>
                                        {activePmId === emp.id && <Check size={14} className="text-blue-600 shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
