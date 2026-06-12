'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// PeriodNavigator — einheitliche Datums-Navigation für
// Kalender, Reporting, Ressourcenplan und Zeiterfassung.
//
// Pill-Container nach Vela-DS-Pattern: bg-surface + border-default
// + shadow-sm, Buttons innen rounded-lg mit hover.
//
// Center kann klickbar (Action) oder nur Label (Info) sein.
// ─────────────────────────────────────────────────────────────

interface PeriodNavigatorProps {
    onPrev: () => void;
    onNext: () => void;
    centerLabel: string;
    /** Beim Hovern über das (klickbare) Center gezeigter Text, z.B.
     *  "Aktuelle Woche" / "Aktueller Monat" / "Heute" — signalisiert,
     *  dass ein Klick zur aktuellen Periode zurückspringt. */
    hoverLabel?: string;
    onCenterClick?: () => void;
    /** "auto" wählt die Breite automatisch, sonst feste min-width für Stabilität */
    centerMinWidth?: number;
    size?: 'sm' | 'md';
    prevTitle?: string;
    nextTitle?: string;
    centerTitle?: string;
    className?: string;
}

export default function PeriodNavigator({
    onPrev, onNext, centerLabel, hoverLabel, onCenterClick,
    centerMinWidth = 88,
    size = 'md',
    prevTitle = 'Vorheriger Zeitraum',
    nextTitle = 'Nächster Zeitraum',
    centerTitle,
    className = '',
}: PeriodNavigatorProps) {
    const arrowSize = size === 'sm' ? 14 : 16;
    const padding   = size === 'sm' ? 'p-1.5' : 'p-2';
    const centerPad = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';
    const fontSize  = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

    const interactive = !!onCenterClick;
    const [hovered, setHovered] = useState(false);
    const showHover = interactive && !!hoverLabel && hovered;

    return (
        <div
            className={`inline-flex items-center gap-0.5 p-1 rounded-xl ${className}`}
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-sm)',
            }}
        >
            <button
                type="button"
                onClick={onPrev}
                title={prevTitle}
                className={`${padding} rounded-lg transition-colors`}
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
                <ChevronLeft size={arrowSize} />
            </button>

            <button
                type="button"
                onClick={onCenterClick}
                disabled={!interactive}
                title={centerTitle}
                className={`${centerPad} rounded-lg ${fontSize} font-semibold whitespace-nowrap transition-colors text-center`}
                style={{
                    color: showHover ? 'var(--accent)' : 'var(--text-primary)',
                    minWidth: centerMinWidth,
                    cursor: interactive ? 'pointer' : 'default',
                }}
                onMouseEnter={e => { if (interactive) { setHovered(true); e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                onMouseLeave={e => { if (interactive) { setHovered(false); e.currentTarget.style.background = ''; } }}
            >
                {showHover ? hoverLabel : centerLabel}
            </button>

            <button
                type="button"
                onClick={onNext}
                title={nextTitle}
                className={`${padding} rounded-lg transition-colors`}
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
                <ChevronRight size={arrowSize} />
            </button>
        </div>
    );
}
