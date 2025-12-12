import React, { createContext, useContext } from 'react';
import { Project, Client, Employee, Department } from '../types';

interface AppContextType {
    session: any;
    projects: Project[];
    clients: Client[];
    employees: Employee[];
    departments: Department[];
    allocations: any[];
    loading: boolean;

    // Setters / Refreshers
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    fetchData: () => Promise<void>;

    // Actions that might be global
    handleLogout: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
