'use client';

import React from 'react';

// ─────────────────────────────────────────────────────────────
// ViewSwitcher — einheitliches Segmented-Control nach Vela DS.
// Nutzt das .segmented-control / .segmented-control-item Pattern
// aus globals.css. Wird überall verwendet wo zwischen Modi
// gewechselt wird (Tag/Woche/Monat, Karten/Tabelle, etc.).
// ─────────────────────────────────────────────────────────────

export interface ViewSwitcherOption<T extends string> {
    value: T;
    label: string;
    icon?: React.ComponentType<any>;
    title?: string; // Tooltip
}

interface ViewSwitcherProps<T extends string> {
    options: ViewSwitcherOption<T>[];
    value: T;
    onChange: (value: T) => void;
    size?: 'sm' | 'md';
    className?: string;
}

export default function ViewSwitcher<T extends string>({
    options, value, onChange, size = 'md', className = '',
}: ViewSwitcherProps<T>) {
    const padding = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';
    const fontSize = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

    return (
        <div
            className={`inline-flex p-1 gap-0.5 rounded-xl ${className}`}
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
            role="tablist"
        >
            {options.map(opt => {
                const active = opt.value === value;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        title={opt.title}
                        onClick={() => onChange(opt.value)}
                        className={`inline-flex items-center gap-1.5 ${padding} rounded-lg ${fontSize} font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap`}
                        style={active ? {
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)',
                            boxShadow: 'var(--shadow-sm)',
                        } : {
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: '1px solid transparent',
                        }}
                        onMouseEnter={e => {
                            if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                        }}
                    >
                        {Icon && <Icon size={size === 'sm' ? 12 : 13} />}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
