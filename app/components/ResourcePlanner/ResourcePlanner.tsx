import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Employee, Project, Department, AllocationRow, ResourceAllocation } from '../../types';
import { getStatusStyle } from '../../utils';
import { useApp } from '../../context/AppContext';
import ResourceGrid from './ResourceGrid';

interface ResourcePlannerProps {
    employees: Employee[];
    projects: Project[];
    currentUser?: Employee;
}

export default function ResourcePlanner({ employees, projects, currentUser }: ResourcePlannerProps) {
    const { fetchData } = useApp();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>(currentUser?.department_id || '');
    const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
    const [loading, setLoading] = useState(false);

    // Get ISO Week
    const getWeekNumber = (d: Date) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return weekNo;
    };

    // Derived state
    const currentYear = currentDate.getFullYear();
    const currentWeek = getWeekNumber(currentDate);

    // Helpers to switch weeks
    const changeWeek = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (delta * 7));
        setCurrentDate(newDate);
    };

    useEffect(() => {
        const init = async () => {
            const { data } = await supabase.from('departments').select('*').order('name');
            if (data) {
                setDepartments(data);
                // If no selection yet (or 'Alle' legacy), try to set to user dept -> first dept
                if (!selectedDeptId || selectedDeptId === 'Alle') {
                    if (currentUser?.department_id) {
                        setSelectedDeptId(currentUser.department_id);
                    } else if (data.length > 0) {
                        setSelectedDeptId(data[0].id);
                    }
                }
            }
        };
        init();
    }, [currentUser]);

    useEffect(() => {
        fetchAllocations();
    }, [currentWeek, currentYear]);

    const fetchAllocations = async () => {
        setLoading(true);
        // Supabase select with joins
        const { data: deepData } = await supabase
            .from('resource_allocations')
            .select(`
                *,
                projects (
                    *,
                    clients ( name ),
                    employees ( initials )
                )
            `)
            .eq('year', currentYear)
            .eq('week_number', currentWeek);

        if (deepData) {
            const sorted = (deepData as any[]).sort((a, b) => {
                const dateA = a.projects?.created_at || '';
                const dateB = b.projects?.created_at || '';
                return dateA.localeCompare(dateB);
            });
            setAllocations(sorted);
        }
        setLoading(false);
    };

    // Construct Grid Data
    const gridData = useMemo(() => {
        let filteredEmployees = employees;
        if (selectedDeptId && selectedDeptId !== 'Alle') {
            filteredEmployees = employees.filter(e => e.department_id === selectedDeptId);
        }

        return filteredEmployees.map(emp => {
            const empAllocations = allocations.filter(a => a.employee_id === emp.id);
            return {
                employee: emp,
                allocations: empAllocations
            } as AllocationRow;
        });
    }, [employees, allocations, selectedDeptId]);

    // Handlers
    const handleUpdateAllocation = async (id: string, field: string, value: any) => {
        setAllocations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
        await supabase.from('resource_allocations').update({ [field]: value }).eq('id', id);
    };

    const handleCreateAllocation = async (employeeId: string, data: any) => {
        let projectId = data.projectId;

        if (data.type === 'new') {
            const { clientName, projectTitle, jobNr } = data;

            // 0. Resolve Client
            let clientId;
            if (clientName) {
                // Try find existing
                const { data: existingClient } = await supabase.from('clients').select('id').ilike('name', clientName).single();
                if (existingClient) {
                    clientId = existingClient.id;
                } else {
                    // Create Client
                    const { data: newClient } = await supabase.from('clients').insert([{
                        name: clientName,
                        organization_id: currentUser?.organization_id // Assuming context
                    }]).select().single();
                    if (newClient) clientId = newClient.id;
                }
            }

            // 1. Create Project
            // If no jobNr, generic one? Or allow empty? Database might require it. 
            // Types say job_number is string.
            const { data: newProj, error: projError } = await supabase.from('projects').insert([{
                title: projectTitle || 'Neues Projekt',
                job_number: jobNr || '',
                client_id: clientId, // Might be undefined if no client entered, check DB constraints?
                organization_id: currentUser?.organization_id,
                status: 'Bearbeitung'
            }]).select().single();

            if (projError) {
                console.error('Error creating project:', projError);
                alert('Fehler beim Erstellen des Projekts: ' + projError.message);
                return;
            }

            if (newProj) projectId = newProj.id;
        }

        if (!projectId) return;

        const { data: newAlloc, error } = await supabase.from('resource_allocations').insert([{
            employee_id: employeeId,
            project_id: projectId,
            year: currentYear,
            week_number: currentWeek,
            organization_id: currentUser?.organization_id,
            monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0
        }]).select();

        if (error) {
            console.error('Error creating allocation:', error);
            alert('Fehler beim Erstellen des Eintrags: ' + error.message);
            return;
        }

        if (newAlloc) {
            // We refresh the whole grid to ensure relations are loaded correctly
            await fetchAllocations();

            // Also refresh global context so Dashboard sees it
            fetchData();
        }
    };

    const handleDeleteAllocation = async (id: string) => {
        if (!confirm("Eintrag entfernen?")) return;
        setAllocations(prev => prev.filter(a => a.id !== id));
        await supabase.from('resource_allocations').delete().eq('id', id);
        fetchData();
    };

    const handleUpdateProject = async (projectId: string, field: string, value: any) => {
        await supabase.from('projects').update({ [field]: value }).eq('id', projectId);
        fetchAllocations();
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2"><Calendar size={24} /> Ressourcenplanung</h1>
                    <p className="text-gray-500 text-sm">Kapazitäten verwalten</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-gray-100 rounded-md"><ChevronLeft size={18} /></button>
                    <div className="text-sm font-bold w-32 text-center select-none">KW {currentWeek} <span className="text-gray-400 font-normal">| {currentYear}</span></div>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-gray-100 rounded-md"><ChevronRight size={18} /></button>
                </div>
                <div>
                    <select
                        className="bg-white border border-gray-200 text-sm font-medium rounded-lg px-3 py-2 w-48 focus:ring-2 focus:ring-gray-900 outline-none"
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                    >
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-gray-200">
                {loading && allocations.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-gray-400">Lade Plan...</div>
                ) : (
                    <ResourceGrid
                        rows={gridData}
                        projects={projects}
                        employees={employees}
                        weekNumber={currentWeek}
                        year={currentYear}
                        onUpdateAllocation={handleUpdateAllocation}
                        onCreateAllocation={handleCreateAllocation}
                        onDeleteAllocation={handleDeleteAllocation}
                        onUpdateProject={handleUpdateProject}
                        getStatusStyle={getStatusStyle}
                    />
                )}
            </div>
        </div>
    );
}
