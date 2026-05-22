'use client';

import React from 'react';

// ─────────────────────────────────────────────────────────────
// Source of Truth fürs Super-Admin-Panel
// Spiegelt Settings.tsx-Patterns wider:
//   - Inputs sind bg-subtle (leicht dunkler als Card), fokussiert weiß
//   - Header sind text-xl, nicht text-3xl
//   - Cards sind bg-card mit border-default, 2xl-rundung
// ─────────────────────────────────────────────────────────────

export const INPUT_CLS =
    'w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition ' +
    'bg-subtle border border-border-strong text-text-primary ' +
    'placeholder:text-text-placeholder ' +
    'focus:bg-surface focus:ring-2 focus:ring-accent';

export function SectionHeader({ title, subtitle, action }: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 flex-wrap pb-2">
            <div>
                <h1 className="text-xl font-bold text-text-primary">{title}</h1>
                {subtitle && <p className="text-sm mt-1 text-text-muted">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

export function Card({ children, className = '', padded = true }: {
    children: React.ReactNode;
    className?: string;
    padded?: boolean;
}) {
    return (
        <div
            className={`rounded-2xl ${padded ? 'p-6' : ''} ${className}`}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
            {children}
        </div>
    );
}

export function Field({ label, hint, children }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-text-muted">
                {label}
            </label>
            {children}
            {hint && <div className="text-[11px] mt-1.5 text-text-muted">{hint}</div>}
        </div>
    );
}

export function Label({ children }: { children: React.ReactNode }) {
    return <p className="text-sm font-bold text-text-primary">{children}</p>;
}

// ─────────────────────────────────────────────────────────────
// Buttons — folgen DS (text-[13px] font-semibold, rounded-xl)
// ─────────────────────────────────────────────────────────────

export function PrimaryButton({ children, onClick, disabled, type = 'button', className = '' }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit';
    className?: string;
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
            {children}
        </button>
    );
}

export function SecondaryButton({ children, onClick, disabled, className = '' }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            style={{
                background: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
            }}
        >
            {children}
        </button>
    );
}

export function DangerButton({ children, onClick, disabled, className = '' }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            style={{
                background: 'var(--color-danger-subtle)',
                color: 'var(--color-danger-text)',
                border: '1px solid var(--color-danger-border)',
            }}
        >
            {children}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────
// Badges — Semantic Tokens
// ─────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<string, string> = { trial: 'Trial', pro: 'Pro', agency: 'Agency', internal: 'Intern' };

export function PlanBadge({ plan }: { plan: string }) {
    return (
        <span className="badge badge-default">{PLAN_LABEL[plan] || plan}</span>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const variant = ({
        active:    'badge-success',
        read_only: 'badge-warning',
        suspended: 'badge-danger',
    } as Record<string, string>)[status] || 'badge-default';

    const label = ({
        active:    'Aktiv',
        read_only: 'Read-Only',
        suspended: 'Gesperrt',
    } as Record<string, string>)[status] || status;

    return <span className={`badge ${variant}`}>{label}</span>;
}

// ─────────────────────────────────────────────────────────────
// Empty-State (.empty-state aus globals.css)
// ─────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, subtitle, action }: {
    icon: any;
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">
                <Icon size={22} />
            </div>
            <h3 className="empty-state-title">{title}</h3>
            {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
            {action}
        </div>
    );
}
