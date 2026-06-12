'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, ChevronDown, Check } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// TemplateSelect — Corporate-Dropdown für die Vorlagen-Auswahl
// (Einleitung / Schlusstexte). Ersetzt native <select>-Elemente
// in Angebot- & Rechnungs-Tab. Nutzt die Vela-DS-Tokens und ein
// Apple-like Menü mit Vorschau-Text statt OS-Default-Optionen.
// ─────────────────────────────────────────────────────────────

export interface TemplateOption {
    id: string;
    name: string;
    content: string;
}

interface TemplateSelectProps {
    templates: TemplateOption[];
    onSelect: (content: string) => void;
    label?: string;
    emptyHint?: string;
    align?: 'left' | 'right';
}

export default function TemplateSelect({
    templates,
    onSelect,
    label = 'Vorlage wählen',
    emptyHint = 'Noch keine Vorlagen angelegt',
    align = 'right',
}: TemplateSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                style={{
                    background: open ? 'var(--bg-surface)' : 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                    border: `1px solid ${open ? 'var(--accent)' : 'var(--border-default)'}`,
                    boxShadow: open ? 'var(--shadow-sm)' : 'none',
                }}
                onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
                <FileText size={12} />
                {label}
                <ChevronDown size={12} className="transition-transform duration-150" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>

            {open && (
                <div
                    role="listbox"
                    className="absolute z-30 mt-1.5 w-72 max-h-72 overflow-y-auto rounded-xl p-1 animate-in"
                    style={{
                        [align === 'right' ? 'right' : 'left']: 0,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        boxShadow: 'var(--shadow-lg)',
                    } as React.CSSProperties}
                >
                    {templates.length === 0 ? (
                        <div className="px-3 py-4 text-center text-[11px] text-text-muted">{emptyHint}</div>
                    ) : (
                        templates.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                role="option"
                                onClick={() => { onSelect(t.content); setOpen(false); }}
                                className="group w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2 transition-colors hover:bg-subtle"
                            >
                                <Check size={13} className="mt-0.5 shrink-0 opacity-0 text-accent" />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-[12px] font-bold text-text-primary truncate">{t.name}</span>
                                    <span
                                        className="block text-[11px] text-text-muted leading-snug overflow-hidden"
                                        style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}
                                    >
                                        {t.content}
                                    </span>
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
