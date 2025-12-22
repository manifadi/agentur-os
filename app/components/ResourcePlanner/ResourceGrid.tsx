import React, { useState } from 'react';
import { Trash2, Search } from 'lucide-react';
import { Employee, Project, ResourceAllocation, AllocationRow } from '../../types';
import { getStatusStyle, STATUS_OPTIONS } from '../../utils';

interface ResourceGridProps {
    rows: AllocationRow[];
    projects: Project[];
    employees: Employee[];
    weekNumber: number;
    year: number;
    onUpdateAllocation: (id: string, field: string, value: any) => Promise<void>;
    onCreateAllocation: (employeeId: string, data: { type: 'existing', projectId: string } | { type: 'new', clientName: string, projectTitle: string, jobNr: string }) => Promise<void>;
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

    return (
        <div className="bg-white border border-gray-300 overflow-x-auto shadow-sm max-h-[calc(100vh-140px)]">
            <table className="w-full text-left border-collapse min-w-[1400px] text-xs">
                <thead className="bg-gray-100 text-gray-900 border-b border-gray-300 sticky top-0 z-10 shadow-sm font-bold">
                    <tr className="h-10">
                        {/* 6 Columns */}
                        <th className="px-3 border text-center border-gray-300 w-32 bg-gray-100">Kunde</th>
                        <th className="px-3 border text-center border-gray-300 w-24 bg-gray-100">Job Nr.</th>
                        <th className="px-3 border text-left border-gray-300 w-48 bg-gray-100">Projekt</th>
                        <th className="px-3 border text-left border-gray-300 w-32 bg-gray-100">Position</th>
                        <th className="px-3 border text-left border-gray-300 w-48 bg-gray-100">Aufgabe</th>
                        <th className="px-3 border text-center border-gray-300 w-24 bg-gray-100">Status</th>
                        <th className="px-3 border text-center border-gray-300 w-16 bg-gray-100">PM</th>

                        {/* Days */}
                        <th className="px-1 border border-gray-300 w-12 text-center bg-gray-50">Mo</th>
                        <th className="px-1 border border-gray-300 w-12 text-center bg-gray-50">Di</th>
                        <th className="px-1 border border-gray-300 w-12 text-center bg-gray-50">Mi</th>
                        <th className="px-1 border border-gray-300 w-12 text-center bg-gray-50">Do</th>
                        <th className="px-1 border border-gray-300 w-12 text-center bg-gray-50">Fr</th>

                        <th className="px-2 border border-gray-300 w-32 bg-gray-100 text-center">Kommentar</th>
                        <th className="w-8 border border-gray-300 bg-gray-100"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
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
                                <tr className="bg-white border-b border-gray-300">
                                    <td colSpan={14} className="px-3 py-2 border border-gray-300 border-l-4 border-l-gray-900 sticky left-0 z-0 bg-gray-50">
                                        <div className="font-black text-sm text-gray-900">{row.employee.name}</div>
                                        {row.employee.job_title && <div className="text-[10px] text-gray-500 font-normal">{row.employee.job_title}</div>}
                                    </td>
                                </tr>

                                {row.allocations.map(alloc => (
                                    <tr key={alloc.id} className="border-b border-gray-200 hover:bg-blue-50/20 h-9 group">
                                        <td className="px-0 border border-gray-200 h-9 p-0 relative bg-white">
                                            <div className="px-2 text-gray-600 truncate select-none text-[11px] py-1 font-medium">{alloc.projects?.clients?.name || '-'}</div>
                                        </td>
                                        <td className="px-0 border border-gray-200 h-9 p-0 relative bg-white">
                                            <input
                                                type="text"
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-blue-50 focus:outline-none text-center font-mono text-gray-900 text-[11px] placeholder:text-gray-300 block"
                                                value={alloc.projects?.job_number || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'job_number', e.target.value); }}
                                            />
                                        </td>
                                        <td className="px-0 border border-gray-200 h-full p-0 relative bg-white">
                                            <input
                                                type="text"
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-blue-50 focus:outline-none font-bold text-gray-900 text-[11px] placeholder:text-gray-300 block"
                                                value={alloc.projects?.title || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'title', e.target.value); }}
                                            />
                                        </td>

                                        {/* POSITION DROPDOWN */}
                                        <td className="px-0 border border-gray-200 h-9 p-0 relative bg-white">
                                            {alloc.projects?.positions && alloc.projects.positions.length > 0 ? (
                                                <select
                                                    className="appearance-none w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer text-gray-700 block"
                                                    value={alloc.position_id || ''}
                                                    onChange={(e) => onUpdateAllocation(alloc.id, 'position_id', e.target.value || null)}
                                                >
                                                    <option value="">- Position -</option>
                                                    {alloc.projects.positions
                                                        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                                                        .map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.position_nr ? `${p.position_nr} ` : ''}{p.title}
                                                            </option>
                                                        ))}
                                                </select>
                                            ) : (
                                                <div className="w-full h-full flex items-center px-2 text-[10px] text-gray-300 select-none">-</div>
                                            )}
                                        </td>


                                        <td className="px-0 border border-gray-200 h-9 p-0 relative bg-white">
                                            <input
                                                type="text"
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-blue-50 focus:outline-none text-gray-900 text-[11px] placeholder:text-gray-400 block"
                                                value={alloc.task_description || ''}
                                                onChange={(e) => onUpdateAllocation(alloc.id, 'task_description', e.target.value)}
                                                placeholder="..."
                                            />
                                        </td>

                                        <td className="px-0 border border-gray-200 h-9 p-0 relative">
                                            <select
                                                className={`appearance-none w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer block ${getStatusStyle(alloc.projects?.status || '')}`}
                                                value={alloc.projects?.status || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'status', e.target.value); }}
                                            >
                                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>


                                        <td className="px-0 border border-gray-200 h-9 p-0 relative bg-white">
                                            <select
                                                className="appearance-none w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer text-gray-500 text-center block"
                                                value={alloc.projects?.project_manager_id || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'project_manager_id', e.target.value || null); }}
                                            >
                                                <option value="">-</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.initials}</option>)}
                                            </select>
                                        </td>

                                        {
                                            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => (
                                                <td key={day} className={`px-0 border border-gray-200 text-center h-9 p-0 relative bg-white`}>
                                                    <input
                                                        type="number"
                                                        step="0.25"
                                                        className={`appearance-none w-full h-full text-center bg-transparent focus:bg-blue-50 focus:outline-none font-medium block ${(alloc as any)[day] > 0 ? 'text-gray-900' : 'text-gray-300'}`}
                                                        value={(alloc as any)[day] || ''}
                                                        onChange={(e) => onUpdateAllocation(alloc.id, day, parseFloat(e.target.value) || 0)}
                                                    />
                                                </td>
                                            ))
                                        }


                                        <td className="px-0 border border-gray-200 h-9 p-0 relative bg-white">
                                            <input
                                                type="text"
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-blue-50 focus:outline-none text-[10px] text-gray-500 placeholder:text-gray-300 block"
                                                value={alloc.comment || ''}
                                                onChange={(e) => onUpdateAllocation(alloc.id, 'comment', e.target.value)}
                                            />
                                        </td>

                                        <td className="text-center border border-gray-200">
                                            <button onClick={() => onDeleteAllocation(alloc.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={12} /></button>
                                        </td>
                                    </tr >
                                ))
                                }

                                {/* GHOST ROWS */}
                                {
                                    [1, 2].map((i) => (
                                        <GhostRow
                                            key={`ghost-${row.employee.id}-${i}`}
                                            employeeId={row.employee.id}
                                            projects={projects}
                                            onCreate={onCreateAllocation}
                                        />
                                    ))
                                }



                            </React.Fragment >
                        );
                    })}

                    {/* GLOBAL TOTALS */}
                    <tr className="bg-gray-900 text-white font-bold border-t-2 border-gray-900 sticky bottom-0 z-10">
                        <td colSpan={7} className="px-2 py-2 text-right uppercase tracking-wider text-xs">Gesamt Stunden</td>
                        <td className="text-center py-2 border-l border-gray-700">{globalTotals.mo}</td>
                        <td className="text-center py-2 border-l border-gray-700">{globalTotals.di}</td>
                        <td className="text-center py-2 border-l border-gray-700">{globalTotals.mi}</td>
                        <td className="text-center py-2 border-l border-gray-700">{globalTotals.do}</td>
                        <td className="text-center py-2 border-l border-gray-700">{globalTotals.fr}</td>
                        <td colSpan={2} className="border-l border-gray-700"></td>
                    </tr>
                </tbody >
            </table >
        </div >
    );
}

function GhostRow({ employeeId, projects, onCreate }: { employeeId: string, projects: Project[], onCreate: (uid: string, data: any) => void }) {
    const [client, setClient] = useState('');
    const [jobNr, setJobNr] = useState('');
    const [title, setTitle] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Auto-fill and try submit
    const trySubmit = () => {
        // Validation: Need at least Title OR (JobNr+Client)
        // If we have JobNr, we might be linking to existing.
        // If we have Title, we are creating new.

        let shouldSubmit = false;

        if (jobNr) {
            const proj = projects.find(p => p.job_number === jobNr);
            if (proj) {
                shouldSubmit = true;
            }
        }

        // Change: Only submit if we have title AND (Client OR JobNr)
        // If we have Title but NO Client and NO JobNr -> Show Modal
        if (title && title.trim().length > 0) {
            if (!client && !jobNr) {
                setShowModal(true);
                return;
            }
            shouldSubmit = true;
        }

        if (!shouldSubmit) return;

        // Dispatch
        if (jobNr) {
            const proj = projects.find(p => p.job_number === jobNr);
            if (proj) {
                onCreate(employeeId, { type: 'existing', projectId: proj.id });
                reset();
                return;
            }
        }

        // Default create
        onCreate(employeeId, { type: 'new', clientName: client, projectTitle: title || 'Neues Projekt', jobNr: jobNr });
        reset();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') trySubmit();
    };

    const reset = () => {
        setClient('');
        setJobNr('');
        setTitle('');
    };

    const handleJobNrBlur = () => {
        if (jobNr) {
            const proj = projects.find(p => p.job_number === jobNr);
            if (proj) {
                if (proj.clients?.name) setClient(proj.clients.name);
                setTitle(proj.title);
                // Create immediately if we found a match? 
                // Let's NOT auto-create on JobNr blur unless guaranteed. 
                // Better wait for user to confirm or simply move to next field?
                // Actually, if they type JobNr and Tab away, they expect it to lock in.
                // We'll call trySubmit here too.
                onCreate(employeeId, { type: 'existing', projectId: proj.id });
                reset();
            }
        }
    };

    return (
        <>
            <tr className="border-b border-gray-200 hover:bg-gray-50 h-10 group transition-colors">
                <td className="border-r border-gray-300 px-0 h-10 p-0 relative">
                    <input
                        className="appearance-none w-full h-full px-2 bg-transparent text-[10px] placeholder:text-gray-400 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors block"
                        placeholder="Neuer Kunde..."
                        value={client}
                        onChange={e => setClient(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => { if (title) trySubmit(); }}
                    />
                </td>
                <td className="px-0 border-r border-gray-300 h-10 p-0 relative">
                    <div className="absolute inset-0 w-full h-full">
                        <input
                            type="text"
                            placeholder="Nr..."
                            className="appearance-none w-full h-full px-2 bg-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono text-gray-900 placeholder:text-gray-300 transition-colors"
                            value={jobNr}
                            onChange={e => setJobNr(e.target.value)}
                            onBlur={handleJobNrBlur}
                            onKeyDown={handleKeyDown}
                        />
                        {!jobNr && <Search size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                </td>
                <td className="border-r border-gray-300 px-0 h-10 p-0 relative">
                    <input
                        className="appearance-none w-full h-full px-2 bg-transparent text-xs font-bold placeholder:text-gray-400 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors block"
                        placeholder="Neues Projekt..."
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={trySubmit}
                    />
                </td>
                <td className="border-r border-gray-300"></td>
                <td className="border-r border-gray-300"></td>
                <td className="border-r border-gray-300 bg-red-50/10"></td>
                <td className="border-r border-gray-300 bg-red-50/10"></td>
                <td className="border-r border-gray-300"></td>
                <td className="border-r border-gray-300"></td>
                <td className="border-r border-gray-300 bg-blue-50/10"></td>
                <td className="border-r border-gray-300"></td>
                <td></td>
            </tr>
            {showModal && (
                <tr>
                    <td colSpan={14} className="p-0 border-none relative">
                        <MissingInfoModal
                            onSave={(c, j) => {
                                setShowModal(false);
                                setClient(c);
                                setJobNr(j);
                                // Immediate create after modal save
                                onCreate(employeeId, { type: 'new', clientName: c, projectTitle: title, jobNr: j });
                                reset();
                            }}
                            onCancel={() => setShowModal(false)}
                        />
                    </td>
                </tr>
            )}
        </>
    );
}

function MissingInfoModal({ onSave, onCancel }: { onSave: (client: string, jobNr: string) => void, onCancel: () => void }) {
    const [localClient, setLocalClient] = useState('');
    const [localJobNr, setLocalJobNr] = useState('');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-6 w-96 transform scale-100 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold mb-2 text-gray-800">Daten vervollständigen</h3>
                <p className="text-sm text-gray-500 mb-4">Bitte gib einen Kunden oder eine Jobnummer an, um das Projekt zu erstellen.</p>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Kunde</label>
                        <input
                            autoFocus
                            className="appearance-none w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Kundenname..."
                            value={localClient}
                            onChange={e => setLocalClient(e.target.value)}
                        />
                    </div>
                    <div className="text-center text-xs text-gray-400 font-medium">- oder -</div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Job Nr.</label>
                        <input
                            className="appearance-none w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Job Nr..."
                            value={localJobNr}
                            onChange={e => setLocalJobNr(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded">Abbrechen</button>
                    <button
                        onClick={() => onSave(localClient, localJobNr)}
                        disabled={!localClient && !localJobNr}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Speichern
                    </button>
                </div>
            </div>
        </div>
    );
}
