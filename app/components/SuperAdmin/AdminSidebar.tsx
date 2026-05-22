'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Building2,
    Inbox,
    ScrollText,
    ArrowLeft,
    Shield,
    LogOut,
    Archive,
} from 'lucide-react';

interface NavLink {
    href: string;
    label: string;
    icon: any;
    match: (pathname: string) => boolean;
}

const NAV: NavLink[] = [
    { href: '/admin',           label: 'Übersicht',   icon: LayoutDashboard, match: p => p === '/admin' },
    { href: '/admin/agencies',  label: 'Agenturen',   icon: Building2,       match: p => p.startsWith('/admin/agencies') },
    { href: '/admin/backups',   label: 'Backups',     icon: Archive,         match: p => p.startsWith('/admin/backups') },
    { href: '/admin/requests',  label: 'Anfragen',    icon: Inbox,           match: p => p.startsWith('/admin/requests') },
    { href: '/admin/audit',     label: 'Audit-Log',   icon: ScrollText,      match: p => p.startsWith('/admin/audit') },
];

interface AdminSidebarProps {
    pendingRequests?: number;
    onLogout: () => void;
    userEmail?: string;
}

export default function AdminSidebar({ pendingRequests = 0, onLogout, userEmail }: AdminSidebarProps) {
    const pathname = usePathname() || '';

    return (
        <aside
            className="fixed left-0 top-0 bottom-0 w-64 flex flex-col z-50"
            style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
        >
            {/* Header */}
            <div className="p-5 shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--accent)', color: 'white' }}>
                        <Shield size={18} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Super Admin</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Vela · System</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {NAV.map(item => {
                    const Icon = item.icon;
                    const active = item.match(pathname);
                    const badge = item.href === '/admin/requests' && pendingRequests > 0 ? pendingRequests : null;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                            style={active ? {
                                background: 'var(--sidebar-active-bg)',
                                color: 'var(--sidebar-active-text)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            } : { color: 'var(--sidebar-text)' }}
                            onMouseEnter={e => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)';
                                    (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-hover)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.background = '';
                                    (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)';
                                }
                            }}
                        >
                            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                            <span className="text-sm font-medium flex-1">{item.label}</span>
                            {badge !== null && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: 'rgb(239,68,68)', color: 'white' }}>
                                    {badge}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-3 shrink-0 space-y-1" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
                <Link
                    href="/dashboard"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                    style={{ color: 'var(--sidebar-text)' }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-hover)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = '';
                        (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)';
                    }}
                >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-medium">Zurück zur App</span>
                </Link>

                {userEmail && (
                    <div className="px-3 py-2 text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {userEmail}
                    </div>
                )}

                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)';
                        (e.currentTarget as HTMLElement).style.color = 'rgb(239,68,68)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = '';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    }}
                >
                    <LogOut size={18} />
                    <span className="text-sm font-medium">Abmelden</span>
                </button>
            </div>
        </aside>
    );
}
