import React from 'react';
import Link from 'next/link';
import {
    LayoutGrid,
    Globe,
    FolderKanban,
    Users,
    LogOut,
    Settings as SettingsIcon,
    Clock,
    Timer,
    ChevronsLeft,
    ChevronsRight,
    Search,
    ChevronsUpDown,
    CalendarDays
} from 'lucide-react';
import { AgencySettings, Employee } from '../types';
import UserAvatar from './UI/UserAvatar';

interface MainSidebarProps {
    currentView: 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'time_tracking' | 'settings' | 'kalender';
    isSidebarExpanded: boolean;
    setIsSidebarExpanded: (expanded: boolean) => void;
    agencySettings: AgencySettings | null;
    session: any;
    onLogout: () => void;
    activeUser?: Employee;
}

export default function MainSidebar({
    currentView,
    isSidebarExpanded,
    setIsSidebarExpanded,
    agencySettings,
    session,
    onLogout,
    activeUser
}: MainSidebarProps) {

    const NavItem = ({ view, icon: Icon, label, href }: { view: string, icon: any, label: string, href: string }) => {
        const isActive = currentView === view;
        return (
            <Link href={href} className="w-full relative group flex items-center">
                <div
                    className={`flex items-center rounded-xl transition-all duration-200 w-full ${isSidebarExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}`}
                    style={isActive ? {
                        background: 'var(--sidebar-active-bg)',
                        color: 'var(--sidebar-active-text)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    } : {
                        color: 'var(--sidebar-text)',
                    }}
                    onMouseEnter={e => {
                        if (!isActive) {
                            (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-hover)';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!isActive) {
                            (e.currentTarget as HTMLElement).style.background = '';
                            (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text)';
                        }
                    }}
                >
                    <div className="shrink-0">
                        <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                    </div>
                    {isSidebarExpanded && (
                        <span className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300">
                            {label}
                        </span>
                    )}
                </div>

                {/* Tooltip (only when collapsed) */}
                {!isSidebarExpanded && (
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[60] translate-x-1 group-hover:translate-x-0">
                        <div
                            className="text-[10px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10"
                            style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
                        >
                            {label}
                        </div>
                    </div>
                )}
            </Link>
        );
    };

    return (
        <aside
            className={`fixed left-0 top-0 bottom-0 flex flex-col z-50 transition-all duration-300 ease-in-out scrollbar-none ${isSidebarExpanded ? 'w-72 overflow-x-hidden' : 'w-20 overflow-x-visible'}`}
            style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' }}
        >
            {/* Header / Profile Switcher */}
            <div className="p-4 mb-2 shrink-0" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
                <div className={`flex items-center ${isSidebarExpanded ? 'gap-3 px-2' : 'justify-center'}`}>
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group cursor-pointer"
                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
                    >
                        {agencySettings?.logo_url ? (
                            <img src={agencySettings.logo_url} alt="Logo" className="w-full h-full object-contain p-1.5" />
                        ) : (
                            <div className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                                {agencySettings?.company_name?.[0] || 'A'}
                            </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 rounded-full" style={{ borderColor: 'var(--sidebar-bg)' }}></div>
                    </div>

                    {isSidebarExpanded && (
                        <div className="flex items-center justify-between flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                    {agencySettings?.company_name || 'Agentur OS'}
                                </span>
                                <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                    {session?.user?.email}
                                </span>
                            </div>
                            <ChevronsUpDown size={14} className="shrink-0 ml-2" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    )}
                </div>

                {/* Sidebar Toggle Button */}
                <button
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                    className={`mt-4 w-full flex items-center transition-all duration-200 group relative ${isSidebarExpanded ? 'justify-start px-3 h-10 rounded-lg' : 'justify-center h-12 rounded-xl'}`}
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
                    <div className="shrink-0">
                        {isSidebarExpanded ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
                    </div>
                    {isSidebarExpanded && (
                        <span className="ml-3 text-[11px] font-bold uppercase tracking-wider animate-in fade-in duration-300">
                            Sidebar einklappen
                        </span>
                    )}
                    {!isSidebarExpanded && (
                        <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[60] translate-x-1 group-hover:translate-x-0">
                            <div
                                className="text-[10px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10"
                                style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
                            >
                                Sidebar ausklappen
                            </div>
                        </div>
                    )}
                </button>
            </div>

            {/* Nav Section */}
            <div className={`flex-1 flex flex-col gap-2 px-3 scrollbar-none ${isSidebarExpanded ? 'overflow-y-auto overflow-x-hidden' : 'overflow-y-visible overflow-x-visible'}`}>
                {/* Search Item */}
                <button
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('agentur-os-open-search'));
                    }}
                    className="w-full relative group mb-2"
                >
                    <div
                        className={`flex items-center rounded-xl border transition-all duration-200 ${isSidebarExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}`}
                        style={{
                            background: isSidebarExpanded ? 'var(--bg-subtle)' : 'transparent',
                            borderColor: isSidebarExpanded ? 'var(--border-default)' : 'transparent',
                            color: 'var(--text-muted)'
                        }}
                        onMouseEnter={e => {
                            if (isSidebarExpanded) {
                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
                            } else {
                                (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (isSidebarExpanded) {
                                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                            } else {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }
                        }}
                    >
                        <div className="shrink-0">
                            <Search size={22} strokeWidth={2} />
                        </div>
                        {isSidebarExpanded && (
                            <div className="flex items-center justify-between flex-1 truncate animate-in fade-in duration-300">
                                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Suche...</span>
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded shadow-sm"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                                >
                                    ⌘K
                                </span>
                            </div>
                        )}
                    </div>
                    {!isSidebarExpanded && (
                        <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[60] translate-x-1 group-hover:translate-x-0">
                            <div
                                className="text-[10px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10"
                                style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
                            >
                                Suche (⌘K)
                            </div>
                        </div>
                    )}
                </button>

                <NavItem view="dashboard" href="/dashboard" icon={LayoutGrid} label="Mein Bereich" />
                <NavItem view="projects_overview" href="/uebersicht" icon={FolderKanban} label="Projekte" />
                <NavItem view="global_tasks" href="/aufgaben" icon={Globe} label="Alle Aufgaben" />
                <NavItem view="resource_planning" href="/ressourcen" icon={Clock} label="Ressourcen" />
                <NavItem view="time_tracking" href="/zeiterfassung" icon={Timer} label="Zeiterfassung" />
                <NavItem view="kalender" href="/kalender" icon={CalendarDays} label="Kalender" />
            </div>

            {/* Footer */}
            <div
                className={`p-3 flex flex-col gap-2 shrink-0 ${isSidebarExpanded ? 'overflow-x-hidden' : 'overflow-x-visible'}`}
                style={{ borderTop: '1px solid var(--sidebar-border)' }}
            >
                {/* USER PROFILE INFO */}
                <div
                    className={`flex items-center gap-2 mb-1 ${isSidebarExpanded ? 'rounded-xl p-2' : 'justify-center'}`}
                    style={isSidebarExpanded ? { background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' } : {}}
                >
                    <UserAvatar
                        src={activeUser?.avatar_url}
                        name={activeUser?.name}
                        initials={activeUser?.initials}
                        size={isSidebarExpanded ? "sm" : "xs"}
                    />
                    {isSidebarExpanded && (
                        <div className="flex flex-col truncate min-w-0">
                            <span className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{activeUser?.name || 'Benutzer'}</span>
                            <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{session?.user?.email}</span>
                        </div>
                    )}
                </div>

                <NavItem view="settings" href="/einstellungen" icon={SettingsIcon} label="Einstellungen" />

                <button
                    onClick={onLogout}
                    className="w-full relative group flex items-center"
                >
                    <div
                        className={`flex items-center rounded-xl transition-all duration-200 w-full ${isSidebarExpanded ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}`}
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
                        <div className="shrink-0"><LogOut size={22} /></div>
                        {isSidebarExpanded && <span className="text-sm font-medium animate-in fade-in duration-300">Abmelden</span>}
                    </div>
                    {!isSidebarExpanded && (
                        <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[60] translate-x-1 group-hover:translate-x-0">
                            <div
                                className="text-[10px] font-bold py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-xl border border-white/10"
                                style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
                            >
                                Abmelden
                            </div>
                        </div>
                    )}
                </button>
            </div>
        </aside>
    );
}
