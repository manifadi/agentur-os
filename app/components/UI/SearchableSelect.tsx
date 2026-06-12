'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// SearchableSelect — durchsuchbares Combobox-Feld nach Vela DS.
// Tippen filtert (Multi-Token-Suche über `searchText`), Ergebnis-
// Liste zeigt zweizeilig Label + Sublabel (+ optionales Leading).
// Tastatur: ↑/↓ navigieren, Enter wählt, Esc schließt.
// ─────────────────────────────────────────────────────────────

export interface SearchableOption {
    value: string;
    label: string;            // obere Zeile
    sublabel?: string;        // untere Zeile (z.B. "Nr | Kunde")
    searchText: string;       // lowercased Haystack (Titel + Nr + Kunde …)
    leading?: React.ReactNode; // Avatar / Icon-Badge
}

interface SearchableSelectProps {
    value: string;
    onChange: (v: string) => void;
    options: SearchableOption[];
    placeholder?: string;
    emptyText?: string;
    minWidth?: number;
    maxResults?: number;
}

export default function SearchableSelect({
    value, onChange, options,
    placeholder = 'Suchen…',
    emptyText = 'Keine Treffer',
    minWidth = 260,
    maxResults = 60,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIdx, setActiveIdx] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selected = useMemo(() => options.find(o => o.value === value) || null, [options, value]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options.slice(0, maxResults);
        const tokens = q.split(/\s+/);
        return options.filter(o => tokens.every(t => o.searchText.includes(t))).slice(0, maxResults);
    }, [options, query, maxResults]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    useEffect(() => { setActiveIdx(0); }, [query, open]);

    // aktive Zeile in den sichtbaren Bereich scrollen
    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIdx, open]);

    const openMenu = () => { setOpen(true); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0); };
    const choose = (o: SearchableOption) => { onChange(o.value); setOpen(false); setQuery(''); };
    const clear = (e: React.MouseEvent) => { e.stopPropagation(); onChange(''); setQuery(''); setOpen(false); };

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (results[activeIdx]) choose(results[activeIdx]); }
        else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };

    return (
        <div className="relative" ref={ref} style={{ minWidth }}>
            {/* Trigger (zusammengeklappt) oder Such-Input (offen) */}
            {!open ? (
                <button
                    type="button"
                    onClick={openMenu}
                    className="w-full flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-lg text-xs font-semibold bg-subtle border border-default text-text-primary hover:border-accent/40 transition"
                >
                    <span className="shrink-0 flex items-center">
                        {selected?.leading ?? <Search size={14} style={{ color: 'var(--text-muted)' }} />}
                    </span>
                    <span className={`flex-1 text-left truncate ${selected ? '' : 'text-text-muted font-medium'}`}>
                        {selected ? selected.label : placeholder}
                    </span>
                    {selected ? (
                        <span onClick={clear} title="Auswahl löschen"
                            className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary">
                            <X size={13} />
                        </span>
                    ) : (
                        <ChevronDown size={14} className="text-text-muted shrink-0" />
                    )}
                </button>
            ) : (
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={onKey}
                        placeholder={placeholder}
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs font-semibold bg-surface border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-subtle"
                        style={{ borderColor: 'var(--accent)' }}
                    />
                </div>
            )}

            {/* Ergebnis-Liste */}
            {open && (
                <div
                    ref={listRef}
                    className="absolute z-40 mt-1.5 w-full max-h-80 overflow-y-auto rounded-xl p-1"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)' }}
                >
                    {results.length === 0 ? (
                        <div className="px-3 py-4 text-center text-[11px] text-text-muted">{emptyText}</div>
                    ) : results.map((o, idx) => (
                        <button
                            key={o.value}
                            type="button"
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => choose(o)}
                            className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 transition-colors"
                            style={{ background: idx === activeIdx ? 'var(--bg-subtle)' : 'transparent' }}
                        >
                            {o.leading && <span className="shrink-0 flex items-center">{o.leading}</span>}
                            <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-bold text-text-primary truncate">{o.label}</span>
                                {o.sublabel && <span className="block text-[11px] text-text-muted truncate">{o.sublabel}</span>}
                            </span>
                            {o.value === value && <Check size={14} className="text-accent shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
