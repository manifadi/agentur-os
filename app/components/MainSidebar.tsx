import React from 'react';
import { Home, LayoutList, CheckSquare, Briefcase, Settings, LogOut } from 'lucide-react';
import { ViewState } from '../types';

interface MainSidebarProps {
    currentView: ViewState;
    setCurrentView: (view: ViewState) => void;
    handleLogout: () => void;
}

export default function MainSidebar({ currentView, setCurrentView, handleLogout }: MainSidebarProps) {
    const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
        <button
            onClick={() => setCurrentView(view)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 group relative ${currentView === view ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-900'}`}
        >
            <Icon size={20} strokeWidth={currentView === view ? 2.5 : 2} />
            {/* Tooltip */}
            <div className="absolute left-14 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {label}
            </div>
        </button>
    );

    return (
        <aside className="fixed inset-y-0 left-0 z-50 w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            {/* Logo Placeholder */}
            <div className="w-10 h-10 flex items-center justify-center mb-auto">
                <img src="/assets/Agency-OS.png" alt="Logo" className="w-full h-full object-contain" />
            </div>

            {/* Centered Navigation */}
            <nav className="flex flex-col gap-4 items-center justify-center">
                <NavItem view="dashboard" icon={Home} label="Dashboard" />
                <NavItem view="projects_overview" icon={LayoutList} label="Übersicht" />
                <NavItem view="global_tasks" icon={CheckSquare} label="Aufgaben" />
                <NavItem view="resource_planning" icon={Briefcase} label="Ressourcen" />
                <NavItem view="settings" icon={Settings} label="Einstellungen" />
            </nav>

            <div className="mt-auto">
                <button
                    onClick={handleLogout}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
}
