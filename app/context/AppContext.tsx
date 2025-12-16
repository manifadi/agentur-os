import React, { createContext, useContext } from 'react';
import { Project, Client, Employee, Department } from '../types';

interface AppContextType {
    session: any;
    projects: Project[];
    clients: Client[];
    employees: Employee[];
    departments: any[];
    allocations: any[];
    members: any[]; // Project Members
    currentUser?: Employee;
    loading: boolean;

    // Setters / Refreshers
    setProjects: (projects: any[]) => void;
    setClients: (clients: Client[]) => void;
    setEmployees: (employees: Employee[]) => void;
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
    loading: true,
    setProjects: () => { },
    setClients: () => { },
    setEmployees: () => { },
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
