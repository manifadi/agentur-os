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
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all shadow-sm hover:shadow-md ${isOpen || activeCount > 0 ? 'border-accent hidden bg-subtle text-text-primary' : 'border-default bg-surface text-text-secondary hover:bg-hover'}`}
            >
                <Filter size={18} strokeWidth={2.5} />
                <span>Filter</span>
                {activeCount > 0 && (
                    <span className="bg-text-primary text-surface text-[10px] w-5 h-5 flex items-center justify-center rounded-full ml-1">{activeCount}</span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface rounded-2xl shadow-xl border border-default p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-default">
                        <h3 className="font-bold text-text-primary text-sm">Ansicht anpassen</h3>
                        <button onClick={() => { setActiveStatus([]); setActivePmId(null); setSortOrder('created_desc'); }} className="text-xs text-text-muted hover:text-red-500 font-medium transition-colors">
                            Reset
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* SORTIERUNG */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase mb-2">
                                <ArrowUpDown size={12} /> Sortierung
                            </label>
                            <select
                                className="w-full text-sm border-default rounded-lg p-2 bg-input focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-subtle transition-all text-text-primary"
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
                            <label className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase mb-2">
                                <Tag size={12} /> Status
                            </label>
                            <div className="space-y-1">
                                {STATUS_OPTIONS.map(status => (
                                    <button
                                        key={status}
                                        onClick={() => toggleStatus(status)}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${activeStatus.includes(status) ? 'bg-hover text-text-primary font-medium' : 'text-text-secondary hover:bg-hover'}`}
                                    >
                                        <span>{status}</span>
                                        {activeStatus.includes(status) && <Check size={14} className="text-accent" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* PROJEKTMANAGER */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase mb-2">
                                <User size={12} /> Projektmanager
                            </label>
                            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-none pr-1">
                                <button
                                    onClick={() => setActivePmId(null)}
                                    className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors ${!activePmId ? 'bg-hover text-text-primary font-medium' : 'text-text-secondary hover:bg-hover'}`}
                                >
                                    <span>Alle Manager</span>
                                    {!activePmId && <Check size={14} className="text-accent" />}
                                </button>
                                {employees.map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => setActivePmId(emp.id)}
                                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors ${activePmId === emp.id ? 'bg-accent-subtle/30 text-accent font-medium border border-accent/20' : 'text-text-secondary hover:bg-hover'}`}
                                    >
                                        <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                        <span className="flex-1 text-left truncate">{emp.name}</span>
                                        {activePmId === emp.id && <Check size={14} className="text-accent shrink-0" />}
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
