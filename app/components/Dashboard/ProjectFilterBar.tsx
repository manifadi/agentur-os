'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Tag, User, Building2, ArrowUpDown, RotateCcw, Check, ChevronDown } from 'lucide-react';
import { Client, Employee } from '../../types';
import { STATUS_OPTIONS, getStatusDot } from '../../utils';
import MultiSelectDropdown, { MultiSelectItem } from './MultiSelectDropdown';
import UserAvatar from '../UI/UserAvatar';
import ClientLogo from '../UI/ClientLogo';

export type SortOrder = 'deadline_asc' | 'deadline_desc' | 'created_desc' | 'title_asc';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
    { value: 'created_desc', label: 'Neueste zuerst' },
    { value: 'deadline_asc', label: 'Deadline ↑' },
    { value: 'deadline_desc', label: 'Deadline ↓' },
    { value: 'title_asc', label: 'A–Z' },
];

interface ProjectFilterBarProps {
    clients: Client[];
    employees: Employee[];

    searchQuery: string;
    setSearchQuery: (q: string) => void;

    selectedClientIds: string[];
    setSelectedClientIds: (ids: string[]) => void;

    selectedStatuses: string[];
    setSelectedStatuses: (s: string[]) => void;

    selectedPmIds: string[];
    setSelectedPmIds: (ids: string[]) => void;

    sortOrder: SortOrder;
    setSortOrder: (o: SortOrder) => void;

    totalCount: number;
    filteredCount: number;
}

export default function ProjectFilterBar({
    clients, employees,
    searchQuery, setSearchQuery,
    selectedClientIds, setSelectedClientIds,
    selectedStatuses, setSelectedStatuses,
    selectedPmIds, setSelectedPmIds,
    sortOrder, setSortOrder,
    totalCount, filteredCount,
}: ProjectFilterBarProps) {
    // Debounce visible search input → applied to parent state with delay
    const [localSearch, setLocalSearch] = useState(searchQuery);
    useEffect(() => {
        const t = setTimeout(() => setSearchQuery(localSearch), 200);
        return () => clearTimeout(t);
    }, [localSearch, setSearchQuery]);
    useEffect(() => { if (searchQuery !== localSearch) setLocalSearch(searchQuery); /* eslint-disable-next-line */ }, [searchQuery]);

    const clientItems: MultiSelectItem[] = useMemo(() =>
        clients.map(c => ({
            id: c.id,
            label: c.name,
            leading: <ClientLogo src={c.logo_url} name={c.name} size={20} rounded="rounded" />,
        }))
        , [clients]);

    const statusItems: MultiSelectItem[] = useMemo(() =>
        STATUS_OPTIONS.map(s => ({
            id: s,
            label: s,
            leading: <span className={`w-2 h-2 rounded-full ${getStatusDot(s)}`} />,
        }))
        , []);

    const pmItems: MultiSelectItem[] = useMemo(() =>
        employees.map(e => ({
            id: e.id,
            label: e.name,
            leading: <UserAvatar src={e.avatar_url} name={e.name} initials={e.initials} size="xs" />,
        }))
        , [employees]);

    const hasAnyFilter = !!searchQuery || selectedClientIds.length > 0 || selectedStatuses.length > 0 || selectedPmIds.length > 0;

    const resetAll = () => {
        setLocalSearch('');
        setSearchQuery('');
        setSelectedClientIds([]);
        setSelectedStatuses([]);
        setSelectedPmIds([]);
    };

    const selectedClientsResolved = selectedClientIds.map(id => clients.find(c => c.id === id)).filter(Boolean) as Client[];
    const selectedPmsResolved = selectedPmIds.map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];

    return (
        <div className="space-y-3">
            {/* Search row */}
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                    placeholder="Suchen nach Projekt, Kunde oder Jobnummer…"
                    className="w-full pl-11 pr-12 py-3 text-[14px] rounded-2xl outline-none transition-all"
                    style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                    }}
                />
                {localSearch && (
                    <button onClick={() => setLocalSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
                <MultiSelectDropdown
                    label="Kunden"
                    icon={<Building2 size={14} />}
                    items={clientItems}
                    selectedIds={selectedClientIds}
                    onChange={setSelectedClientIds}
                    searchable={clients.length > 6}
                    searchPlaceholder="Kunden filtern…"
                    width={300}
                />
                <MultiSelectDropdown
                    label="Status"
                    icon={<Tag size={14} />}
                    items={statusItems}
                    selectedIds={selectedStatuses}
                    onChange={setSelectedStatuses}
                />
                <MultiSelectDropdown
                    label="Manager"
                    icon={<User size={14} />}
                    items={pmItems}
                    selectedIds={selectedPmIds}
                    onChange={setSelectedPmIds}
                    searchable={employees.length > 6}
                    searchPlaceholder="Mitarbeiter filtern…"
                />
                <SortDropdown value={sortOrder} onChange={setSortOrder} />

                <div className="flex-1" />

                {/* Count + reset */}
                <div className="flex items-center gap-3 text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {hasAnyFilter ? (
                        <>
                            <span><span className="font-bold" style={{ color: 'var(--text-primary)' }}>{filteredCount}</span> von {totalCount} Projekten</span>
                            <button onClick={resetAll} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors font-semibold"
                                style={{ color: 'var(--text-secondary)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <RotateCcw size={11} /> Zurücksetzen
                            </button>
                        </>
                    ) : (
                        <span><span className="font-bold" style={{ color: 'var(--text-primary)' }}>{totalCount}</span> Projekte</span>
                    )}
                </div>
            </div>

            {/* Active filter chips */}
            {hasAnyFilter && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {searchQuery && (
                        <FilterChip onRemove={() => { setLocalSearch(''); setSearchQuery(''); }}>
                            <Search size={11} /> „{searchQuery}"
                        </FilterChip>
                    )}
                    {selectedClientsResolved.map(c => (
                        <FilterChip key={c.id} onRemove={() => setSelectedClientIds(selectedClientIds.filter(id => id !== c.id))}>
                            <ClientLogo src={c.logo_url} name={c.name} size={16} rounded="rounded" fallback="icon" />
                            {c.name}
                        </FilterChip>
                    ))}
                    {selectedStatuses.map(s => (
                        <FilterChip key={s} onRemove={() => setSelectedStatuses(selectedStatuses.filter(x => x !== s))}>
                            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(s)}`} />
                            {s}
                        </FilterChip>
                    ))}
                    {selectedPmsResolved.map(pm => (
                        <FilterChip key={pm.id} onRemove={() => setSelectedPmIds(selectedPmIds.filter(id => id !== pm.id))}>
                            <UserAvatar src={pm.avatar_url} name={pm.name} initials={pm.initials} size="xs" />
                            {pm.name}
                        </FilterChip>
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
    return (
        <span
            className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[11px] font-semibold shadow-sm"
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
            }}
        >
            {children}
            <button onClick={onRemove} className="p-0.5 rounded transition-colors hover:bg-hover" style={{ color: 'var(--text-muted)' }}>
                <X size={10} />
            </button>
        </span>
    );
}

function SortDropdown({ value, onChange }: { value: SortOrder; onChange: (v: SortOrder) => void }) {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const current = SORT_OPTIONS.find(s => s.value === value);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all shadow-sm"
                style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                }}
            >
                <ArrowUpDown size={14} />
                <span>{current?.label}</span>
                <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full mt-2 right-0 z-50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', width: 200 }}>
                    <div className="p-1 space-y-0.5">
                        {SORT_OPTIONS.map(opt => {
                            const active = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setOpen(false); }}
                                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left"
                                    style={{
                                        background: active ? 'var(--accent-subtle)' : 'transparent',
                                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                        fontWeight: active ? 600 : 500,
                                    }}
                                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <span>{opt.label}</span>
                                    {active && <Check size={12} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
