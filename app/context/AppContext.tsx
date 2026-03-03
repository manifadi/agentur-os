import React, { createContext, useContext } from 'react';
import { Project, Client, Employee, Department, TimeEntry, Todo, AgencySettings } from '../types';
import { ThemePreferences } from '../hooks/useTheme';

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
    personalTodos: Todo[];
    setPersonalTodos: (todos: Todo[]) => void;
    agencySettings: AgencySettings | null;
    loading: boolean;

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
}

const defaultTheme: ThemePreferences = {
    themeMode: 'light',
    accentColor: 'default',
    fontFamily: 'inter',
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
    personalTodos: [],
    agencySettings: null,
    loading: true,
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
});

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
