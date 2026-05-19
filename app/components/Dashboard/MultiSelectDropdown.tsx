'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface MultiSelectItem {
    id: string;
    label: string;
    /** Optional small visual indicator (color dot, avatar etc.) */
    leading?: React.ReactNode;
    /** Optional inline subtitle / hint shown right of label */
    sublabel?: string;
}

interface MultiSelectDropdownProps {
    /** Button label when nothing selected */
    label: string;
    /** Lucide icon for the button */
    icon?: React.ReactNode;
    items: MultiSelectItem[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    /** Show internal search input (recommended for >8 items) */
    searchable?: boolean;
    /** Placeholder for the internal search */
    searchPlaceholder?: string;
    /** Dropdown width in px */
    width?: number;
    /** Align dropdown to the right of the trigger button */
    alignRight?: boolean;
}

export default function MultiSelectDropdown({
    label, icon, items, selectedIds, onChange,
    searchable, searchPlaceholder, width = 280, alignRight,
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!open) setQuery('');
    }, [open]);

    const filtered = query
        ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
        : items;

    const toggle = (id: string) => {
        onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    };

    const hasSelection = selectedIds.length > 0;
    const buttonLabel = hasSelection
        ? `${label} · ${selectedIds.length}`
        : label;

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all shadow-sm"
                style={{
                    background: hasSelection ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${hasSelection ? 'var(--accent)' : 'var(--border-default)'}`,
                    color: hasSelection ? 'var(--accent)' : 'var(--text-secondary)',
                }}
            >
                {icon}
                <span>{buttonLabel}</span>
                <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div
                    className="absolute top-full mt-2 z-50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        width,
                        [alignRight ? 'right' : 'left']: 0,
                    } as React.CSSProperties}
                >
                    {searchable && (
                        <div className="p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-2.5" style={{ color: 'var(--text-muted)' }} />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder={searchPlaceholder || 'Suchen…'}
                                    className="w-full pl-8 pr-7 py-1.5 text-[13px] rounded-lg outline-none"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                />
                                {query && (
                                    <button onClick={() => setQuery('')} className="absolute right-2 top-2" style={{ color: 'var(--text-muted)' }}>
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Toolbar */}
                    {hasSelection && (
                        <div className="px-3 py-1.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                {selectedIds.length} ausgewählt
                            </span>
                            <button onClick={() => onChange([])} className="text-[11px] font-bold transition-colors" style={{ color: 'var(--accent)' }}>
                                Alle abwählen
                            </button>
                        </div>
                    )}

                    <div className="max-h-72 overflow-y-auto p-1 space-y-0.5">
                        {filtered.length === 0 && (
                            <div className="px-3 py-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                {query ? 'Keine Treffer.' : 'Keine Einträge.'}
                            </div>
                        )}
                        {filtered.map(item => {
                            const checked = selectedIds.includes(item.id);
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => toggle(item.id)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors text-left"
                                    style={{
                                        background: checked ? 'var(--accent-subtle)' : 'transparent',
                                        color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    }}
                                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div
                                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: checked ? 'var(--accent)' : 'transparent',
                                            border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
                                        }}
                                    >
                                        {checked && <Check size={10} style={{ color: 'var(--accent-text)' }} strokeWidth={3} />}
                                    </div>
                                    {item.leading && <span className="flex-shrink-0">{item.leading}</span>}
                                    <span className="flex-1 truncate font-medium">{item.label}</span>
                                    {item.sublabel && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{item.sublabel}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
