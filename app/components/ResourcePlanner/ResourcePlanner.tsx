import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Employee, Project, ResourceAllocation, AllocationRow, Client } from '../../types';
import { getStatusStyle } from '../../utils';
import { useApp } from '../../context/AppContext';
import ResourceGrid from './ResourceGrid';

interface ResourcePlannerProps {
    employees: Employee[];
    projects: Project[];
    currentUser?: Employee;
}

export default function ResourcePlanner({ employees: propsEmployees, projects, currentUser }: ResourcePlannerProps) {
    const { fetchData, departments: contextDepartments, agencySettings, clients } = useApp();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDeptId, setSelectedDeptId] = useState<string>(currentUser?.department_id || '');
    const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
    const [loading, setLoading] = useState(false);

    // Custom Modal State
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });

    // Helper: AppContext might have fuller employee data
    const employees = propsEmployees || [];

    // Get ISO Week
    const getWeekNumber = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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

    // Filter departments based on agency settings
    const departments = useMemo(() => {
        if (!contextDepartments) return [];
        if (agencySettings?.resource_planner_departments && agencySettings.resource_planner_departments.length > 0) {
            return contextDepartments.filter(d => agencySettings.resource_planner_departments?.includes(d.id));
        }
        return contextDepartments;
    }, [contextDepartments, agencySettings]);

    // Ensure selectedDeptId is set
    useEffect(() => {
        if (departments.length > 0) {
            const currentIsValid = departments.some(d => d.id === selectedDeptId);
            if (!selectedDeptId || !currentIsValid) {
                const preferred = departments.find(d => d.id === currentUser?.department_id);
                setSelectedDeptId(preferred ? preferred.id : departments[0].id);
            }
        }
    }, [currentUser, departments, selectedDeptId]);

    const fetchAllocations = async () => {
        setLoading(true);
        const { data: rawData, error } = await supabase
            .from('resource_allocations')
            .select(`*`)
            .eq('year', currentYear)
            .eq('week_number', currentWeek);

        if (error) {
            console.error('Error fetching allocations:', error);
        }

        if (rawData) {
            setAllocations(rawData);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAllocations();
        const channel = supabase
            .channel('resource-allocations-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_allocations' }, () => {
                fetchAllocations();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentWeek, currentYear]);

    // REACTIVE JOINING
    const joinedAllocations = useMemo(() => {
        return allocations.map(alloc => {
            const project = projects.find(p => p.id === alloc.project_id);
            return {
                ...alloc,
                projects: project || undefined
            } as ResourceAllocation;
        });
    }, [allocations, projects]);

    const gridData = useMemo(() => {
        const rows: AllocationRow[] = [];
        const deptEmployees = employees.filter(e => e.department_id === selectedDeptId);

        deptEmployees.forEach(emp => {
            const empAllocations = joinedAllocations.filter(a => a.employee_id === emp.id);
            rows.push({
                employee: emp,
                allocations: empAllocations
            });
        });

        return rows;
    }, [employees, selectedDeptId, joinedAllocations]);

    const handleUpdateAllocation = async (id: string, field: string, value: any) => {
        // Optimistic update
        setAllocations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
        await supabase.from('resource_allocations').update({ [field]: value }).eq('id', id);
        fetchData();
    };

    const handleCreateAllocation = async (employeeId: string, data: any) => {
        let projectId = '';
        if (data.type === 'existing') {
            projectId = data.projectId;
        } else {
            const { clientName, projectTitle, jobNr } = data;
            let clientId = null;
            if (clientName) {
                const { data: existingClient } = await supabase.from('clients').select('id').ilike('name', clientName).single();
                if (existingClient) {
                    clientId = existingClient.id;
                } else {
                    const { data: newClient } = await supabase.from('clients').insert([{
                        name: clientName,
                        organization_id: currentUser?.organization_id
                    }]).select().single();
                    if (newClient) clientId = newClient.id;
                }
            }
            const { data: newProj, error: projError } = await supabase.from('projects').insert([{
                title: projectTitle || 'Neues Projekt',
                job_number: jobNr || '',
                client_id: clientId,
                organization_id: currentUser?.organization_id,
                status: 'Bearbeitung'
            }]).select().single();

            if (projError || !newProj) {
                console.error('Error creating project:', projError);
                return;
            }
            projectId = newProj.id;
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

        if (newAlloc) {
            // AUTO-SUBSCRIPTION LOGIC
            await supabase.from('project_members').upsert({
                project_id: projectId,
                employee_id: employeeId,
                organization_id: currentUser?.organization_id,
                role: 'member'
            }, { onConflict: 'project_id, employee_id' });

            await fetchAllocations();
            fetchData();
        }
    };

    const handleDeleteAllocation = async () => {
        if (!deleteConfirm.id) return;
        const id = deleteConfirm.id;
        setDeleteConfirm({ id: null, open: false });
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
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 px-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2"><Calendar size={24} /> Ressourcenplanung</h1>
                    <p className="text-gray-500 text-sm">Kapazitäten verwalten</p>
                </div>

                <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ChevronLeft size={18} /></button>
                    <div className="text-sm font-bold w-32 text-center select-none text-gray-900 leading-none">KW {currentWeek} <span className="text-gray-400 font-normal ml-1">| {currentYear}</span></div>
                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ChevronRight size={18} /></button>
                </div>

                <div className="relative group">
                    <select
                        className="appearance-none bg-white border border-gray-200 text-sm font-bold rounded-xl pl-4 pr-10 py-2.5 min-w-[160px] focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none shadow-sm cursor-pointer transition-all hover:border-gray-300"
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                    >
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-gray-600 transition-colors">
                        <ChevronRight size={14} className="rotate-90" />
                    </div>
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
                        allClients={clients}
                        weekNumber={currentWeek}
                        year={currentYear}
                        onUpdateAllocation={handleUpdateAllocation}
                        onCreateAllocation={handleCreateAllocation}
                        onDeleteAllocation={(id) => setDeleteConfirm({ id, open: true })}
                        onUpdateProject={handleUpdateProject}
                        getStatusStyle={getStatusStyle}
                    />
                )}
            </div>

            {deleteConfirm.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 w-full max-w-sm m-4 transform animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <Trash2 size={28} className="text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Eintrag löschen?</h3>
                        <p className="text-gray-500 text-center text-sm mb-8 leading-relaxed">Dieser Vorgang kann nicht rückgängig gemacht werden. Möchtest du diesen Ressourceneintrag wirklich entfernen?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setDeleteConfirm({ id: null, open: false })}
                                className="px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleDeleteAllocation}
                                className="px-5 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-200"
                            >
                                Ja, löschen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
