import React, { useState } from 'react';
import { ChevronDown, Plus, Trash2, Save, X, Search } from 'lucide-react';
import { Employee, Project, ResourceAllocation, AllocationRow } from '../../types';

interface ResourceGridProps {
    rows: AllocationRow[];
    projects: Project[];
    employees: Employee[];
    weekNumber: number;
    year: number;
    onUpdateAllocation: (id: string, field: string, value: any) => Promise<void>;
    onCreateAllocation: (employeeId: string, projectId: string) => Promise<void>;
    onDeleteAllocation: (id: string) => Promise<void>;
    onUpdateProject: (projectId: string, field: string, value: any) => Promise<void>;
    getStatusStyle: (s: string) => string;
}

export default function ResourceGrid({ rows, projects, employees, weekNumber, year, onUpdateAllocation, onCreateAllocation, onDeleteAllocation, onUpdateProject, getStatusStyle }: ResourceGridProps) {

    // Calculate global daily totals (Footer)
    const globalTotals = { mo: 0, di: 0, mi: 0, do: 0, fr: 0 };
    rows.forEach(r => r.allocations.forEach(a => {
        globalTotals.mo += a.monday || 0;
        globalTotals.di += a.tuesday || 0;
        globalTotals.mi += a.wednesday || 0;
        globalTotals.do += a.thursday || 0;
        globalTotals.fr += a.friday || 0;
    }));

    const handleJobNrLookup = async (employeeId: string, jobNr: string, inputElement: HTMLInputElement) => {
        // Find project
        const proj = projects.find(p => p.job_number === jobNr);
        if (proj) {
            // Create allocation
            await onCreateAllocation(employeeId, proj.id);
            // CLEAR INPUT MANUALLY
            inputElement.value = '';
        }
    };

    return (
        <div className="bg-white border border-gray-300 overflow-x-auto shadow-sm max-h-[calc(100vh-140px)]">
            <table className="w-full text-left border-collapse min-w-[1400px] text-xs">
                <thead className="bg-gray-100 border-b border-gray-300 sticky top-0 z-10 shadow-sm">
                    <tr className="h-10">
                        {/* 6 Columns */}
                        <th className="px-2 border-r border-gray-300 w-32 font-bold text-gray-400 bg-gray-100">Kunde</th>
                        <th className="px-2 border-r border-gray-300 w-24 font-bold text-gray-700 bg-gray-100">Job Nr.</th>
                        <th className="px-2 border-r border-gray-300 w-48 font-bold text-gray-400 bg-gray-100">Projekt</th>
                        <th className="px-2 border-r border-gray-300 w-48 font-bold text-gray-700 bg-gray-100">Aufgabe</th>
                        <th className="px-2 border-r border-gray-300 w-24 font-bold text-gray-700 bg-gray-100">Status</th>
                        <th className="px-2 border-r border-gray-300 w-24 font-bold text-gray-700 bg-gray-100">PM</th>

                        {/* Days */}
                        <th className="px-1 border-r border-gray-300 w-12 text-center font-bold bg-red-50 text-red-900 border-red-100">Mo</th>
                        <th className="px-1 border-r border-gray-300 w-12 text-center font-bold bg-red-50 text-red-900 border-red-100">Di</th>
                        <th className="px-1 border-r border-gray-300 w-12 text-center font-bold bg-gray-100">Mi</th>
                        <th className="px-1 border-r border-gray-300 w-12 text-center font-bold bg-gray-100">Do</th>
                        <th className="px-1 border-r border-gray-300 w-12 text-center font-bold bg-blue-50 text-blue-900 border-blue-100">Fr</th>

                        {/* REMOVED ROW SUM COLUMN AS REQUESTED */}

                        <th className="px-2 font-bold w-32 bg-gray-100">Kommentar</th>
                        <th className="w-8 bg-gray-100"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
                        // Calculate Employee Totals
                        const empTotals = { mo: 0, di: 0, mi: 0, do: 0, fr: 0 };
                        row.allocations.forEach(a => {
                            empTotals.mo += a.monday || 0;
                            empTotals.di += a.tuesday || 0;
                            empTotals.mi += a.wednesday || 0;
                            empTotals.do += a.thursday || 0;
                            empTotals.fr += a.friday || 0;
                        });

                        return (
                            <React.Fragment key={row.employee.id}>
                                {/* EMPLOYEE HEADER */}
                                <tr className="bg-gray-50 border-b border-gray-300">
                                    <td colSpan={13} className="px-2 py-2 font-black text-sm text-gray-900 border-l-4 border-l-gray-900 sticky left-0 z-0">
                                        {row.employee.name}
                                    </td>
                                </tr>

                                {/* EXISTING ALLOCATIONS */}
                                {row.allocations.map(alloc => (
                                    <tr key={alloc.id} className="border-b border-gray-200 hover:bg-gray-50 h-8 group">
                                        <td className="px-2 border-r border-gray-300 text-gray-400 truncate select-none bg-gray-50/50">{alloc.projects?.clients?.name || '-'}</td>
                                        <td className="px-2 border-r border-gray-300 font-mono text-gray-600">{alloc.projects?.job_number}</td>
                                        <td className="px-2 border-r border-gray-300 text-gray-400 truncate bg-gray-50/50">{alloc.projects?.title || '-'}</td>

                                        <td className="px-0 border-r border-gray-300">
                                            <input
                                                type="text"
                                                className="w-full h-full px-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs placeholder:text-gray-300"
                                                value={alloc.task_description || ''}
                                                onChange={(e) => onUpdateAllocation(alloc.id, 'task_description', e.target.value)}
                                                placeholder="Aufgabe..."
                                            />
                                        </td>

                                        <td className="px-0 border-r border-gray-300">
                                            <select
                                                className={`w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer ${getStatusStyle(alloc.projects?.status || '')}`}
                                                value={alloc.projects?.status || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'status', e.target.value); }}
                                            >
                                                {['Anfrage', 'Angebot', 'Bearbeitung', 'In Umsetzung', 'Abnahme', 'Abgeschlossen', 'Archiviert'].map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>

                                        <td className="px-0 border-r border-gray-300">
                                            <select
                                                className="w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer text-gray-600"
                                                value={alloc.projects?.project_manager_id || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'project_manager_id', e.target.value || null); }}
                                            >
                                                <option value="">--</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.initials}</option>)}
                                            </select>
                                        </td>

                                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
                                            <td key={day} className={`px-0 border-r border-gray-300 text-center ${['monday', 'tuesday'].includes(day) ? 'bg-red-50/30' : day === 'friday' ? 'bg-blue-50/30' : ''}`}>
                                                <input
                                                    type="number"
                                                    step="0.25"
                                                    className="w-full h-full text-center bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium placeholder:text-gray-300"
                                                    value={alloc[day as keyof ResourceAllocation] || ''}
                                                    onChange={(e) => onUpdateAllocation(alloc.id, day, parseFloat(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                            </td>
                                        ))}

                                        <td className="px-0 border-r border-gray-300">
                                            <input
                                                type="text"
                                                className="w-full h-full px-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs placeholder:text-gray-300"
                                                value={alloc.comment || ''}
                                                onChange={(e) => onUpdateAllocation(alloc.id, 'comment', e.target.value)}
                                                placeholder="..."
                                            />
                                        </td>

                                        <td className="text-center">
                                            <button onClick={() => onDeleteAllocation(alloc.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={12} /></button>
                                        </td>
                                    </tr>
                                ))}

                                {/* GHOST ROWS */}
                                {[1, 2].map((i) => (
                                    <tr key={`ghost-${row.employee.id}-${i}`} className="border-b border-gray-100 h-8 opacity-70">
                                        <td className="bg-gray-50/20 border-r border-gray-200 px-2 text-gray-300 italic text-[10px]">{/* Kunde Placeholder */}</td>
                                        <td className="px-0 border-r border-gray-200">
                                            <div className="relative w-full h-full">
                                                <input
                                                    type="text"
                                                    placeholder="Job Nr..."
                                                    className="w-full h-full px-2 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono placeholder:text-gray-300"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleJobNrLookup(row.employee.id, (e.target as HTMLInputElement).value, e.target as HTMLInputElement);
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        if (e.target.value.length > 3) handleJobNrLookup(row.employee.id, e.target.value, e.target as HTMLInputElement);
                                                    }}
                                                />
                                                <Search size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
                                            </div>
                                        </td>
                                        <td className="bg-gray-50/20 border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200 bg-red-50/10"></td>
                                        <td className="border-r border-gray-200 bg-red-50/10"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td className="border-r border-gray-200 bg-blue-50/10"></td>
                                        <td className="border-r border-gray-200"></td>
                                        <td></td>
                                    </tr>
                                ))}

                                {/* EMPLOYEE SUMMARY ROW (MOVED BELOW GHOST ROWS) */}
                                <tr className="bg-orange-50/50 border-b border-orange-100 font-bold text-gray-700 h-8">
                                    <td colSpan={6} className="px-2 text-right text-[10px] uppercase tracking-wider text-orange-400">Summe {row.employee.initials}</td>
                                    <td className="text-center text-xs">{empTotals.mo || '-'}</td>
                                    <td className="text-center text-xs">{empTotals.di || '-'}</td>
                                    <td className="text-center text-xs">{empTotals.mi || '-'}</td>
                                    <td className="text-center text-xs">{empTotals.do || '-'}</td>
                                    <td className="text-center text-xs">{empTotals.fr || '-'}</td>
                                    <td colSpan={2}></td>
                                </tr>

                            </React.Fragment>
                        );
                    })}

                    {/* GLOBAL TOTALS */}
                    <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-900 sticky bottom-0 z-10">
                        <td colSpan={6} className="px-2 py-2 text-right uppercase tracking-wider text-xs">Gesamt Stunden</td>
                        <td className="text-center py-2">{globalTotals.mo}</td>
                        <td className="text-center py-2">{globalTotals.di}</td>
                        <td className="text-center py-2">{globalTotals.mi}</td>
                        <td className="text-center py-2">{globalTotals.do}</td>
                        <td className="text-center py-2">{globalTotals.fr}</td>
                        <td colSpan={2}></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
