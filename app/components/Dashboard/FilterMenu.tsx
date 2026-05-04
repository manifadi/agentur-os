import React, { useState, useRef, useEffect } from 'react';
import { Filter, Check, User, ArrowUpDown, Tag } from 'lucide-react';
import { Employee } from '../../types';
import UserAvatar from '../UI/UserAvatar';
import { STATUS_OPTIONS, getStatusDot } from '../../utils';

type SortOrder = 'deadline_asc' | 'deadline_desc' | 'created_desc' | 'title_asc';

interface FilterMenuProps {
    employees: Employee[];
    activeStatus: string[];
    setActiveStatus: (status: string[]) => void;
    activePmId: string | null;
    setActivePmId: (id: string | null) => void;
    sortOrder: SortOrder;
    setSortOrder: (order: SortOrder) => void;
}

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
    { value: 'created_desc', label: 'Neueste zuerst' },
    { value: 'deadline_asc', label: 'Deadline ↑' },
    { value: 'deadline_desc', label: 'Deadline ↓' },
    { value: 'title_asc', label: 'Alphabetisch (A–Z)' },
];

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleStatus = (status: string) => {
        setActiveStatus(
            activeStatus.includes(status)
                ? activeStatus.filter(s => s !== status)
                : [...activeStatus, status]
        );
    };

    const activeCount = (activeStatus.length > 0 ? 1 : 0) + (activePmId ? 1 : 0);
    const activeSortLabel = SORT_OPTIONS.find(o => o.value === sortOrder)?.label ?? '';

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all duration-150 active:scale-[0.98] shadow-sm ${
                    isOpen
                        ? 'bg-accent text-accent-text border-accent'
                        : activeCount > 0
                            ? 'bg-accent-subtle text-accent border-accent/30'
                            : 'bg-surface text-text-secondary border-border-default hover:bg-hover hover:border-border-strong'
                }`}
            >
                <Filter size={15} strokeWidth={2.5} />
                <span>Filter</span>
                {activeCount > 0 && (
                    <span className={`text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold ${isOpen ? 'bg-white/20 text-white' : 'bg-accent text-accent-text'}`}>
                        {activeCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface rounded-2xl shadow-xl border border-border-subtle p-4 z-50 animate-in fade-in zoom-in-95 duration-200">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-border-subtle">
                        <h3 className="ds-title text-[14px]">Ansicht</h3>
                        <button
                            onClick={() => { setActiveStatus([]); setActivePmId(null); setSortOrder('created_desc'); }}
                            className="text-[12px] text-text-muted hover:text-[var(--color-danger-text)] font-semibold transition-colors"
                        >
                            Zurücksetzen
                        </button>
                    </div>

                    <div className="space-y-5">

                        {/* SORTIERUNG — Custom select */}
                        <div>
                            <label className="ds-caption flex items-center gap-1.5 mb-2">
                                <ArrowUpDown size={11} /> Sortierung
                            </label>
                            <div className="space-y-0.5">
                                {SORT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSortOrder(opt.value)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-colors ${
                                            sortOrder === opt.value
                                                ? 'bg-hover text-text-primary font-semibold'
                                                : 'text-text-secondary hover:bg-hover'
                                        }`}
                                    >
                                        <span>{opt.label}</span>
                                        {sortOrder === opt.value && (
                                            <Check size={13} className="text-accent shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* STATUS */}
                        <div>
                            <label className="ds-caption flex items-center gap-1.5 mb-2">
                                <Tag size={11} /> Status
                            </label>
                            <div className="space-y-0.5">
                                {STATUS_OPTIONS.map(status => (
                                    <button
                                        key={status}
                                        onClick={() => toggleStatus(status)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                                            activeStatus.includes(status)
                                                ? 'bg-hover text-text-primary font-semibold'
                                                : 'text-text-secondary hover:bg-hover'
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(status)}`} />
                                        <span className="flex-1 text-left">{status}</span>
                                        {activeStatus.includes(status) && (
                                            <Check size={13} className="text-accent shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* PROJEKTMANAGER */}
                        {employees.length > 0 && (
                            <div>
                                <label className="ds-caption flex items-center gap-1.5 mb-2">
                                    <User size={11} /> Projektmanager
                                </label>
                                <div className="space-y-0.5 max-h-44 overflow-y-auto scrollbar-none">
                                    <button
                                        onClick={() => setActivePmId(null)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] transition-colors ${
                                            !activePmId ? 'bg-hover text-text-primary font-semibold' : 'text-text-secondary hover:bg-hover'
                                        }`}
                                    >
                                        <span>Alle</span>
                                        {!activePmId && <Check size={13} className="text-accent" />}
                                    </button>
                                    {employees.map(emp => (
                                        <button
                                            key={emp.id}
                                            onClick={() => setActivePmId(emp.id)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                                                activePmId === emp.id
                                                    ? 'bg-hover text-text-primary font-semibold'
                                                    : 'text-text-secondary hover:bg-hover'
                                            }`}
                                        >
                                            <UserAvatar src={emp.avatar_url} name={emp.name} initials={emp.initials} size="xs" />
                                            <span className="flex-1 text-left truncate">{emp.name}</span>
                                            {activePmId === emp.id && <Check size={13} className="text-accent shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
