'use client';
import React from 'react';
import { Info, AlertTriangle, CheckCircle2, LucideIcon } from 'lucide-react';

export type NoticeType = 'info' | 'warning' | 'danger' | 'success';

// Single Source of Truth für Hinweis-/Warn-Boxen. Nutzt ausschließlich
// semantische Status-Tokens (NIE accent — das ist theme-abhängig und kann
// rot/rose werden) damit Farbe + Bedeutung immer zusammenpassen:
//   info    → blau  · Info-Icon          (neutraler Hinweis)
//   warning → orange · Dreieck mit "!"    (Vorsicht / Nebenwirkung)
//   danger  → rot   · Dreieck mit "!"     (destruktiv / irreversibel)
//   success → grün  · Haken               (Bestätigung)
const STYLES: Record<NoticeType, { bg: string; text: string; border: string; icon: LucideIcon }> = {
    info:    { bg: 'var(--color-info-subtle)',    text: 'var(--color-info-text)',    border: 'var(--color-info-border)',    icon: Info },
    warning: { bg: 'var(--color-warning-subtle)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)', icon: AlertTriangle },
    danger:  { bg: 'var(--color-danger-subtle)',  text: 'var(--color-danger-text)',  border: 'var(--color-danger-border)',  icon: AlertTriangle },
    success: { bg: 'var(--color-success-subtle)', text: 'var(--color-success-text)', border: 'var(--color-success-border)', icon: CheckCircle2 },
};

interface Props {
    type?: NoticeType;
    title?: React.ReactNode;
    children?: React.ReactNode;
    /** Icon überschreiben — sonst das semantisch passende Default-Icon. */
    icon?: LucideIcon;
    className?: string;
}

export default function InlineNotice({ type = 'info', title, children, icon, className }: Props) {
    const s = STYLES[type];
    const Icon = icon || s.icon;
    return (
        <div
            className={`flex items-start gap-2.5 p-3 rounded-xl ${className || ''}`}
            style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
        >
            <Icon size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs leading-relaxed">
                {title && <div className="font-bold mb-0.5">{title}</div>}
                {children}
            </div>
        </div>
    );
}
