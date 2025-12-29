import React from 'react';
import Link from 'next/link';
import { LayoutGrid, Globe, FolderKanban, Users, LogOut, Settings as SettingsIcon, Clock, Timer } from 'lucide-react';
import { ViewState } from '../types';

interface MainSidebarProps {
    currentView: 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'time_tracking' | 'settings';
    setCurrentView: (view: any) => void;
    handleLogout: () => void;
}

export default function MainSidebar({ currentView, setCurrentView, handleLogout }: MainSidebarProps) {

    const NavItem = ({ view, icon: Icon, tooltip, href }: { view: string, icon: any, tooltip: string, href: string }) => {
        const isActive = currentView === view;
        return (
            <Link href={href} className="relative group">
                <div className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 ${isActive
                    ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20 scale-100'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                    }`}>
                    <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
                </div>

                {/* Tooltip */}
                <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <div className="bg-gray-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg whitespace-nowrap shadow-xl">
                        {tooltip}
                        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                    </div>
                </div>
            </Link>
        );
    };

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-20 bg-white border-r border-gray-100 flex flex-col items-center py-8 z-50">
            {/* Logo */}
            <div className="mb-12">
                <div className="w-12 h-12 flex items-center justify-center">
                    <img src="/assets/Agency-OS.png" alt="Agentur OS" className="w-full h-full object-contain" />
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 flex flex-col gap-4 w-full px-4 items-center">
                <NavItem view="dashboard" href="/dashboard" icon={LayoutGrid} tooltip="Mein Bereich" />
                <NavItem view="projects_overview" href="/uebersicht" icon={FolderKanban} tooltip="Projekte" />
                <NavItem view="global_tasks" href="/aufgaben" icon={Globe} tooltip="Alle Aufgaben" />
                <NavItem view="resource_planning" href="/ressourcen" icon={Clock} tooltip="Ressourcen" />
                <NavItem view="time_tracking" href="/zeiterfassung" icon={Timer} tooltip="Zeiterfassung" />
            </nav>

            {/* Footer */}
            <div className="flex flex-col gap-4 w-full px-4 items-center">
                <NavItem view="settings" href="/einstellungen" icon={SettingsIcon} tooltip="Einstellungen" />

                <button
                    onClick={handleLogout}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all group relative"
                >
                    <LogOut size={20} />
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        <div className="bg-gray-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg whitespace-nowrap shadow-xl">
                            Logout
                            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                        </div>
                    </div>
                </button>
            </div>
        </aside>
    );
}
