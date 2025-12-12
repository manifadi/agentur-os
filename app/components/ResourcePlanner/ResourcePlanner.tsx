import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Employee, Project, Department, AllocationRow, ResourceAllocation } from '../../types';
import { getStatusStyle } from '../../utils';
import ResourceGrid from './ResourceGrid';

interface ResourcePlannerProps {
    employees: Employee[];
    projects: Project[];
}

export default function ResourcePlanner({ employees, projects }: ResourcePlannerProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDeptId, setSelectedDeptId] = useState<string>('Alle');
    const [departments, setDepartments] = useState<Department[]>([]);
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
        fetchDepartments();
    }, []);

    useEffect(() => {
        fetchAllocations();
    }, [currentWeek, currentYear]);

    const fetchDepartments = async () => {
        const { data } = await supabase.from('departments').select('*').order('name');
        if (data) setDepartments(data);
    };

    const fetchAllocations = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('resource_allocations')
            .select(`*, projects (*)`) // Join project to get details
            .eq('year', currentYear)
            .eq('week_number', currentWeek);

        // We also need project details nested. 
        // Supabase join syntax: `projects ( *, clients (name), employees (initials) )` might be needed for display
        // Let's refine:
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

        if (deepData) setAllocations(deepData as any);
        setLoading(false);
    };

    // Construct Grid Data
    const gridData = useMemo(() => {
        let filteredEmployees = employees;
        if (selectedDeptId !== 'Alle') {
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
        // Optimistic update
        setAllocations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
        await supabase.from('resource_allocations').update({ [field]: value }).eq('id', id);
    };

    const handleCreateAllocation = async (employeeId: string, projectId: string) => {
        const { data } = await supabase.from('resource_allocations').insert([{
            employee_id: employeeId,
            project_id: projectId,
            year: currentYear,
            week_number: currentWeek,
            monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0
        }]).select(`*, projects ( *, clients(name), employees(initials) )`); // Need to fetch joined data back!

        if (data) {
            setAllocations(prev => [...prev, data[0] as any]);
        }
    };

    const handleDeleteAllocation = async (id: string) => {
        if (!confirm("Eintrag entfernen?")) return;
        setAllocations(prev => prev.filter(a => a.id !== id));
        await supabase.from('resource_allocations').delete().eq('id', id);
    };

    const handleUpdateProject = async (projectId: string, field: string, value: any) => {
        // Optimistic update for local visual (less critical here since allocs update on re-fetch mostly, but good for UX)
        // However, allocations don't store project data directly, they reference it.
        // We'd need to update the `projects` state in `ResourcePlanner` parent or just trigger a refetch.
        // Simplest: Call Supabase, then trigger generic refresh.
        await supabase.from('projects').update({ [field]: value }).eq('id', projectId);
        // We might want to notify parent to refresh projects list?
        // Or we just fetchAllocations again? FetchAllocations fetches JOINED project data, so yes.
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
                        <option value="Alle">Alle Abteilungen</option>
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
