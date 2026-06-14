import React, { createContext, useContext } from 'react';
import { Project, Client, Employee, Department, TimeEntry, Todo, AgencySettings, AttendanceEntry } from '../types';
import { ThemePreferences } from '../hooks/useTheme';
import { StoredAccount } from '../utils/accountVault';

interface AppContextType {
    session: any;
    projects: Project[];
    clients: Client[];
    employees: Employee[];
    departments: any[];
    allocations: any[];
    members: any[]; // Project Members
    timeEntries: TimeEntry[];
    currentUser?: Employee;

    // Stempeluhr / Anwesenheitszeit (aktueller Nutzer, heute)
    attendanceToday: AttendanceEntry[];
    openAttendance: AttendanceEntry | null; // laufende Session (clock_out === null)
    clockIn: () => Promise<void>;
    clockOut: () => Promise<void>;

    personalTodos: Todo[];
    setPersonalTodos: (todos: Todo[]) => void;
    agencySettings: AgencySettings | null;
    loading: boolean;

    // Feature-Flags (pro Organisation, vom Super-Admin gesteuert)
    isFeatureEnabled: (key: string) => boolean;

    // Multi-Account / Agentur-Switcher
    accounts: StoredAccount[];
    activeAccountId?: string;
    switchAccount: (id: string) => Promise<void>;
    startAddAccount: () => void;
    switchingAccount: boolean;

    // Setters / Refreshers
    setProjects: (projects: any[]) => void;
    setClients: (clients: Client[]) => void;
    setEmployees: (employees: Employee[]) => void;
    setTimeEntries: (entries: TimeEntry[]) => void;
    fetchData: () => Promise<void>;

    // Actions that might be global
    handleLogout: () => Promise<void>;

    // Theme
    themePrefs: ThemePreferences;
    updateThemePrefs: (patch: Partial<ThemePreferences>) => void;
    isSidebarExpanded: boolean;
    setSidebarExpanded: (expanded: boolean) => void;

    // Navigations-Kontext: das zuletzt besuchte Modul vor einer Detail-Route
    // (z.B. Projekt-Detail). Treibt den kontextsensitiven Zurück-Button.
    previousModule: { path: string; label: string };
}

const defaultTheme: ThemePreferences = {
    themeMode: 'light',
    accentColor: 'default',
    fontFamily: 'vela-sans',
    backgroundStyle: 'clean',
    isSidebarExpanded: false,
};

export const AppContext = createContext<AppContextType>({
    session: null,
    projects: [],
    clients: [],
    employees: [],
    departments: [],
    allocations: [],
    members: [],
    timeEntries: [],
    attendanceToday: [],
    openAttendance: null,
    clockIn: async () => { },
    clockOut: async () => { },
    personalTodos: [],
    agencySettings: null,
    loading: true,
    isFeatureEnabled: () => false,
    accounts: [],
    activeAccountId: undefined,
    switchAccount: async () => { },
    startAddAccount: () => { },
    switchingAccount: false,
    setProjects: () => { },
    setClients: () => { },
    setEmployees: () => { },
    setTimeEntries: () => { },
    setPersonalTodos: () => { },
    fetchData: async () => { },
    handleLogout: async () => { },
    themePrefs: defaultTheme,
    updateThemePrefs: () => { },
    isSidebarExpanded: false,
    setSidebarExpanded: () => { },
    previousModule: { path: '/uebersicht', label: 'Zurück zur Projektliste' },
});

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
