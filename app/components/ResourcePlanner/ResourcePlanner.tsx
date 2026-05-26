import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarRange, Trash2, LayoutGrid, Table2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Employee, Project, ResourceAllocation, AllocationRow, Client, Absence } from '../../types';
import { useApp } from '../../context/AppContext';
import ResourceGrid from './ResourceGrid';
import ResourceCards from './ResourceCards';
import ViewSwitcher from '../UI/ViewSwitcher';
import PeriodNavigator from '../UI/PeriodNavigator';
import { toast } from 'sonner';

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
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
        if (typeof window === 'undefined') return 'cards';
        return (localStorage.getItem('resourcePlanner.viewMode') as 'cards' | 'table') || 'cards';
    });

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

    // Wochen-Bereich für Absences (Montag → Sonntag)
    const weekRange = useMemo(() => {
        const monday = new Date(currentDate);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        return { from: iso(monday), to: iso(sunday) };
    }, [currentDate]);

    const fetchAbsences = async () => {
        const { data } = await supabase
            .from('absences')
            .select('*')
            .eq('status', 'approved')
            .lte('start_date', weekRange.to)
            .gte('end_date',   weekRange.from);
        if (data) setAbsences(data as Absence[]);
    };

    // Quick-Toggle für Homeoffice direkt im Ressourcenplan.
    // Ohne bestehenden Eintrag → request_absence (sofort approved da home_office).
    // Mit bestehendem → cancel_absence.
    const handleToggleHomeoffice = async (employeeId: string, isoDate: string, existing: Absence | null) => {
        if (existing) {
            const { error } = await supabase.rpc('cancel_absence', { p_absence_id: existing.id });
            if (error) toast.error('Fehler: ' + error.message);
            else toast.success('Homeoffice entfernt.');
        } else {
            const { error } = await supabase.rpc('request_absence', {
                p_employee_id: employeeId,
                p_type:        'home_office',
                p_start_date:  isoDate,
                p_end_date:    isoDate,
                p_half_day:    'none',
                p_reason:      null,
            });
            if (error) toast.error('Fehler: ' + error.message);
            else toast.success('Homeoffice eingetragen.');
        }
    };

    useEffect(() => {
        fetchAllocations();
        fetchAbsences();
        const channel = supabase
            .channel('resource-allocations-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_allocations' }, () => {
                fetchAllocations();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, () => {
                fetchAbsences();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentWeek, currentYear, weekRange.from, weekRange.to]);

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
            const { clientName, projectTitle } = data;

            // Auto-generate job number: YY-NNN (e.g. 26-007)
            const year2d = new Date().getFullYear().toString().slice(2);
            const { data: existingJobNrs } = await supabase
                .from('projects')
                .select('job_number')
                .eq('organization_id', currentUser?.organization_id)
                .like('job_number', `${year2d}-%`);

            let nextNum = 1;
            if (existingJobNrs && existingJobNrs.length > 0) {
                const nums = existingJobNrs
                    .map((p: any) => {
                        const parts = (p.job_number || '').split('-');
                        return parseInt(parts[parts.length - 1] || '0', 10);
                    })
                    .filter((n: number) => !isNaN(n) && n > 0);
                if (nums.length > 0) nextNum = Math.max(...nums) + 1;
            }
            const autoJobNr = `${year2d}-${String(nextNum).padStart(3, '0')}`;

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
                job_number: autoJobNr,
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
            <header className="flex flex-wrap justify-between items-center mb-6 gap-3 px-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight mb-0.5 flex items-center gap-2 text-text-primary"><CalendarRange size={24} /> Wochenplan</h1>
                    <p className="text-text-secondary text-sm">Stunden pro Mitarbeiter & Projekt planen</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Week navigation */}
                    <PeriodNavigator
                        onPrev={() => changeWeek(-1)}
                        onNext={() => changeWeek(1)}
                        centerLabel={`KW ${currentWeek} · ${currentYear}`}
                        onCenterClick={() => setCurrentDate(new Date())}
                        centerMinWidth={112}
                        centerTitle="Zur aktuellen Woche springen"
                    />

                    {/* Department filter */}
                    <div className="relative group">
                        <select
                            className="appearance-none bg-surface border border-default text-text-primary text-sm font-bold rounded-xl pl-4 pr-8 py-2.5 min-w-[140px] focus:ring-2 focus:ring-accent outline-none shadow-sm cursor-pointer"
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                        >
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                            <ChevronRight size={13} className="rotate-90" />
                        </div>
                    </div>

                    {/* View toggle */}
                    <ViewSwitcher<'cards' | 'table'>
                        options={[
                            { value: 'cards', label: 'Karten',  icon: LayoutGrid },
                            { value: 'table', label: 'Tabelle', icon: Table2 },
                        ]}
                        value={viewMode}
                        onChange={v => { setViewMode(v); localStorage.setItem('resourcePlanner.viewMode', v); }}
                    />
                </div>
            </header>

            <div className={`flex-1 overflow-auto rounded-xl shadow-sm border border-default ${viewMode === 'cards' ? 'bg-subtle/30' : 'bg-surface'}`}>
                {loading && allocations.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-text-muted text-sm">Lade Plan...</div>
                ) : viewMode === 'cards' ? (
                    <ResourceCards
                        rows={gridData}
                        projects={projects}
                        allClients={clients}
                        absences={absences}
                        weekStart={weekRange.from}
                        onToggleHomeoffice={handleToggleHomeoffice}
                        onUpdateAllocation={handleUpdateAllocation}
                        onCreateAllocation={handleCreateAllocation}
                        onDeleteAllocation={(id) => setDeleteConfirm({ id, open: true })}
                    />
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
                    />
                )}
            </div>

            {deleteConfirm.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface rounded-2xl shadow-2xl border border-default p-8 w-full max-w-sm m-4 transform animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <Trash2 size={28} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-center text-text-primary mb-2">Eintrag löschen?</h3>
                        <p className="text-text-secondary text-center text-sm mb-8 leading-relaxed">Dieser Vorgang kann nicht rückgängig gemacht werden. Möchtest du diesen Ressourceneintrag wirklich entfernen?</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setDeleteConfirm({ id: null, open: false })}
                                className="px-5 py-3 text-sm font-bold text-text-secondary hover:bg-hover rounded-xl transition-colors"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleDeleteAllocation}
                                className="px-5 py-3 text-sm font-bold text-surface bg-red-500 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-red-500/20"
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
