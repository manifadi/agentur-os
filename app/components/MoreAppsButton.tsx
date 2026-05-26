'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Grid3x3 } from 'lucide-react';
import { SidebarItemId } from '../types';

interface HiddenItem {
    id: SidebarItemId;
    label: string;
    href: string;
    icon: React.ComponentType<any>;
}

interface Props {
    hidden: HiddenItem[];
    isSidebarExpanded: boolean;
}

// "Mehr"-Button am Sidebar-Ende: öffnet ein Popover-Grid mit Bereichen,
// die der User aus der Sidebar entfernt hat, aber weiterhin nutzen kann.
//
// UX: Klick toggled das Popover, Hover des Buttons zeigt Tooltip (kollabierte Sidebar).
// Klick auf ein Item → navigiert + schließt Popover.
// Klick außerhalb / Esc → schließt.
export default function MoreAppsButton({ hidden, isSidebarExpanded }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (hidden.length === 0) return null;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full relative group flex items-center"
                title="Weitere Bereiche"
            >
                <div
                    className={`flex items-center rounded-xl transition-all duration-200 w-full ${isSidebarExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}`}
                    style={open ? {
                        background: 'var(--bg-hover)',
                        color: 'var(--sidebar-text-hover)',
                    } : {
                        color: 'var(--sidebar-text)',
                    }}
                    onMouseEnter={e => {
                        if (!open) {
                            (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-hover)';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!open) {
                            (e.currentTarget as HTMLElement).style.background = '';
                            (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)';
                        }
                    }}
                >
                    <div className="shrink-0">
                        <Grid3x3 size={22} strokeWidth={1.5} />
                    </div>
                    {isSidebarExpanded && (
                        <>
                            <span className="text-sm font-medium whitespace-nowrap overflow-hidden flex-1 text-left">
                                Weitere
                            </span>
                            <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                            >
                                {hidden.length}
                            </span>
                        </>
                    )}
                </div>

                {/* Tooltip wenn collapsed */}
                {!isSidebarExpanded && !open && (
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[60]">
                        <div
                            className="text-[10px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10"
                            style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
                        >
                            Weitere ({hidden.length})
                        </div>
                    </div>
                )}
            </button>

            {/* Popover */}
            {open && (
                <div
                    className="absolute z-[70] rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        left: isSidebarExpanded ? '100%' : 'calc(100% + 12px)',
                        marginLeft: isSidebarExpanded ? '8px' : '0',
                        bottom: 0,
                        width: 260,
                    }}
                >
                    <div className="px-2 py-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                            Weitere Bereiche
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {hidden.map(item => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className="flex flex-col items-center gap-2 p-3 rounded-xl transition"
                                    style={{
                                        color: 'var(--text-secondary)',
                                        background: 'transparent',
                                    }}
                                    onMouseEnter={e => {
                                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                                    }}
                                    onMouseLeave={e => {
                                        (e.currentTarget as HTMLElement).style.background = '';
                                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                                    }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
                                    >
                                        <Icon size={18} strokeWidth={1.75} />
                                    </div>
                                    <span className="text-[11px] font-semibold text-center leading-tight">
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                    <div className="px-2 pt-2 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <Link
                            href="/einstellungen?section=navigation"
                            onClick={() => setOpen(false)}
                            className="block text-[11px] py-1.5 px-1 transition"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                        >
                            Sidebar anpassen →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
