'use client';
import React from 'react';
import { Building2 } from 'lucide-react';

interface Props {
    src?: string | null;
    name?: string | null;
    /** Kantenlänge in px. */
    size?: number;
    /** Tailwind-Radius-Klasse, z.B. 'rounded-lg', 'rounded-xl', 'rounded-full'. */
    rounded?: string;
    /** Fallback ohne Logo: Initialen (Default) oder Building-Icon. */
    fallback?: 'initials' | 'icon';
    className?: string;
}

/**
 * Einheitliche Kundenlogo-Darstellung: rundes Kästchen mit IMMER weißem
 * Hintergrund (auch im Dark Mode — bewusst nicht umschaltend), damit dunkle/
 * farbige Logos sichtbar bleiben. Das Logo liegt via object-contain im
 * Vordergrund. Ohne Logo: Initialen/Icon auf subtilem Grund.
 */
export default function ClientLogo({ src, name, size = 28, rounded = 'rounded-lg', fallback = 'initials', className = '' }: Props) {
    const pad = Math.max(2, Math.round(size * 0.08));
    return (
        <div
            className={`${rounded} flex items-center justify-center overflow-hidden shrink-0 ${className}`}
            style={{
                width: size,
                height: size,
                background: src ? '#ffffff' : 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
            }}
        >
            {src ? (
                <img src={src} alt={name || ''} className="w-full h-full object-contain" style={{ padding: pad }} />
            ) : fallback === 'icon' ? (
                <Building2 size={Math.round(size * 0.5)} style={{ color: 'var(--text-muted)' }} />
            ) : (
                <span className="font-bold leading-none" style={{ fontSize: Math.max(8, Math.round(size * 0.33)), color: 'var(--text-muted)' }}>
                    {(name || '').slice(0, 2).toUpperCase()}
                </span>
            )}
        </div>
    );
}
