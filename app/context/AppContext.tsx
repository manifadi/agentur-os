import React, { createContext, useContext } from 'react';
import { Project, Client, Employee, Department, TimeEntry } from '../types';

interface AppContextType {
    session: any;
    projects: Project[];
    clients: Client[];
    employees: Employee[];
    departments: any[];
    allocations: any[];
    members: any[]; // Project Members
    timeEntries: TimeEntry[]; // [NEW]
    currentUser?: Employee;
    agencySettings: AgencySettings | null;
    loading: boolean;

    // Setters / Refreshers
    setProjects: (projects: any[]) => void;
    setClients: (clients: Client[]) => void;
    setEmployees: (employees: Employee[]) => void;
    setTimeEntries: (entries: TimeEntry[]) => void; // [NEW]
    fetchData: () => Promise<void>;

    // Actions that might be global
    handleLogout: () => Promise<void>;
}

export const AppContext = createContext<AppContextType>({
    session: null,
    projects: [],
    clients: [],
    employees: [],
    departments: [],
    allocations: [],
    members: [],
    timeEntries: [],
    agencySettings: null,
    loading: true,
    setProjects: () => { },
    setClients: () => { },
    setEmployees: () => { },
    setTimeEntries: () => { },
    fetchData: async () => { },
    handleLogout: async () => { },
});

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
