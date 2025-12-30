import React, { useState, useMemo } from 'react';
import { Trash2, Search, Lock, Plus } from 'lucide-react';
import { Employee, Project, Client, ResourceAllocation, AllocationRow } from '../../types';
import { getStatusStyle, STATUS_OPTIONS } from '../../utils';

interface DebouncedInputProps {
    id: string;
    initialValue: string;
    onSave: (val: string) => void;
    placeholder?: string;
    className?: string;
}

function DebouncedInput({ id, initialValue, onSave, placeholder, className, isTextarea }: DebouncedInputProps & { isTextarea?: boolean }) {
    const [localValue, setLocalValue] = React.useState(initialValue);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    React.useEffect(() => {
        setLocalValue(initialValue);
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setLocalValue(newVal);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            if (newVal !== initialValue) onSave(newVal);
        }, 5000);
    };

    const handleBlur = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (localValue !== initialValue) onSave(localValue);
    };

    if (isTextarea) {
        return (
            <textarea
                className={`${className} resize-none overflow-hidden py-1.5 leading-tight whitespace-normal`}
                value={localValue || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                rows={1}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                }}
            />
        );
    }

    return (
        <input
            type="text"
            className={className}
            value={localValue || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
        />
    );
}

interface ResourceGridProps {
    rows: AllocationRow[];
    projects: Project[];
    employees: Employee[];
    weekNumber: number;
    year: number;
    onUpdateAllocation: (id: string, field: string, value: any) => Promise<void>;
    onCreateAllocation: (employeeId: string, data: { type: 'existing', projectId: string } | { type: 'new', clientName: string, projectTitle: string, jobNr: string }) => Promise<void>;
    onDeleteAllocation: (id: string) => void;
    onUpdateProject: (projectId: string, field: string, value: any) => Promise<void>;
    getStatusStyle: (s: string) => string;
    allClients: Client[];
}

export default function ResourceGrid({ rows, projects, employees, weekNumber, year, onUpdateAllocation, onCreateAllocation, onDeleteAllocation, onUpdateProject, getStatusStyle, allClients }: ResourceGridProps) {
    // Calculate global daily totals (Footer)
    const globalTotals = { mo: 0, di: 0, mi: 0, do: 0, fr: 0 };
    rows.forEach(r => r.allocations.forEach(a => {
        globalTotals.mo += a.monday || 0;
        globalTotals.di += a.tuesday || 0;
        globalTotals.mi += a.wednesday || 0;
        globalTotals.do += a.thursday || 0;
        globalTotals.fr += a.friday || 0;
    }));

    // This useMemo is intended to enrich allocations with project data if it's not already there.
    // However, the current `rows` structure already seems to have `alloc.projects`.
    // If `ResourceAllocation` type does not include `projects`, this would be needed.
    // Assuming `ResourceAllocation` already includes `projects` for now, as per existing usage.
    // If not, `rows` would need to be mapped to include `projects` for each allocation.

    return (
        <div className="bg-white overflow-x-auto max-h-[calc(100vh-140px)]">
            <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50/50 text-gray-500 sticky top-0 z-10 font-bold">
                    <tr className="h-10">
                        {/* 6 Columns */}
                        <th className="px-3 border-b border-r border-gray-100 text-center w-32 font-bold uppercase tracking-wider text-[10px]">Kunde</th>
                        <th className="px-3 border-b border-r border-gray-100 text-center w-24 font-bold uppercase tracking-wider text-[10px]">Job Nr.</th>
                        <th className="px-3 border-b border-r border-gray-100 text-left w-48 font-bold uppercase tracking-wider text-[10px]">Projekt</th>
                        <th className="px-3 border-b border-r border-gray-100 text-left w-48 font-bold uppercase tracking-wider text-[10px]">Aufgabe</th>
                        <th className="px-3 border-b border-r border-gray-100 text-center w-24 font-bold uppercase tracking-wider text-[10px]">Status</th>
                        <th className="px-3 border-b border-r border-gray-100 text-center w-16 font-bold uppercase tracking-wider text-[10px]">PM</th>

                        {/* Days */}
                        <th className="px-1 border-b border-r border-gray-100 w-12 text-center bg-blue-50/30 text-blue-600">Mo</th>
                        <th className="px-1 border-b border-r border-gray-100 w-12 text-center bg-blue-50/30 text-blue-600">Di</th>
                        <th className="px-1 border-b border-r border-gray-100 w-12 text-center bg-blue-50/30 text-blue-600">Mi</th>
                        <th className="px-1 border-b border-r border-gray-100 w-12 text-center bg-blue-50/30 text-blue-600">Do</th>
                        <th className="px-1 border-b border-r border-gray-100 w-12 text-center bg-blue-50/30 text-blue-600">Fr</th>

                        <th className="px-2 border-b border-r border-gray-100 w-32 text-center">Kommentar</th>
                        <th className="w-8 border-b border-gray-100 bg-gray-50/50"></th>
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
                                <tr className="bg-gray-50/30">
                                    <td colSpan={14} className="px-3 py-2 border-b border-gray-100 sticky left-0 z-0">
                                        <div className="font-bold text-sm text-gray-900 tracking-tight">{row.employee.name}</div>
                                        {row.employee.job_title && <div className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{row.employee.job_title}</div>}
                                    </td>
                                </tr>

                                {row.allocations.map(alloc => (
                                    <tr key={alloc.id} className="border-b border-gray-100 hover:bg-gray-50/40 h-9 group">
                                        <td className="px-0 border-b border-r border-gray-100 h-9 p-0 relative bg-white">
                                            <div className="px-2 text-gray-600 truncate select-none text-[11px] py-1 font-medium">{alloc.projects?.clients?.name || '-'}</div>
                                        </td>
                                        <td className="px-0 border-b border-r border-gray-100 h-9 p-0 relative bg-white group/cell">
                                            {alloc.projects?.job_number ? (
                                                <div className="flex items-center px-2 h-full gap-1.5">
                                                    <Lock size={10} className="text-gray-300 flex-shrink-0" />
                                                    <div className="text-gray-900 font-mono text-[10px] truncate select-none">{alloc.projects.job_number}</div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center px-2 h-full italic text-gray-400 text-[10px] select-none">
                                                    Pitch
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-0 border-b border-r border-gray-100 h-full p-0 relative bg-white group/cell">
                                            {alloc.projects?.job_number ? (
                                                <div className="flex items-center px-2 h-full">
                                                    <div className="text-gray-900 font-semibold text-[11px] truncate select-none">{alloc.projects.title}</div>
                                                </div>
                                            ) : (
                                                <div className="px-2 text-gray-500 font-bold text-[11px] truncate select-none italic">
                                                    {alloc.projects?.title || 'Pitch'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-0 border-b border-r border-gray-100 h-auto min-h-[36px] p-0 relative bg-white">
                                            <DebouncedInput
                                                id={`${alloc.id}-task`}
                                                isTextarea
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-white focus:outline-none text-gray-900 text-[11px] placeholder:text-gray-400 block"
                                                initialValue={alloc.task_description || ''}
                                                onSave={(val) => onUpdateAllocation(alloc.id, 'task_description', val)}
                                                placeholder="..."
                                            />
                                        </td>
                                        <td className="px-0 border-b border-r border-gray-100 h-9 p-0 relative bg-white">
                                            <select
                                                className={`appearance-none w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer block font-bold ${getStatusStyle(alloc.projects?.status || '')}`}
                                                value={alloc.projects?.status || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'status', e.target.value); }}
                                            >
                                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-0 border-b border-r border-gray-100 h-9 p-0 relative bg-white">
                                            <select
                                                className="appearance-none w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer text-gray-400 text-center block hover:text-gray-700"
                                                value={alloc.projects?.project_manager_id || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'project_manager_id', e.target.value || null); }}
                                            >
                                                <option value="">-</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.initials}</option>)}
                                            </select>
                                        </td>

                                        {
                                            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => {
                                                const field = day; // day is already the field name
                                                return (
                                                    <td key={day} className={`px-0 border-b border-r border-gray-100 text-center h-9 p-0 relative bg-white`}>
                                                        <input
                                                            type="number"
                                                            step="0.25"
                                                            className={`appearance-none w-full h-full text-center bg-transparent focus:bg-blue-50/30 focus:outline-none font-bold block ${(alloc as any)[field] > 0 ? 'text-gray-900 border-b-2 border-b-blue-600/30' : 'text-gray-200'}`}
                                                            defaultValue={(alloc as any)[field] || ''}
                                                            onBlur={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                if (val !== (alloc as any)[field]) {
                                                                    onUpdateAllocation(alloc.id, field, val);
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                );
                                            })
                                        }


                                        <td className="px-0 border-b border-r border-gray-100 h-auto min-h-[36px] p-0 relative bg-white">
                                            <DebouncedInput
                                                id={`${alloc.id}-comment`}
                                                isTextarea
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-white focus:outline-none text-[10px] text-gray-400 placeholder:text-gray-200 block"
                                                initialValue={alloc.comment || ''}
                                                onSave={(val) => onUpdateAllocation(alloc.id, 'comment', val)}
                                                placeholder="..."
                                            />
                                        </td>
                                        <td className="text-center border-b border-gray-100 bg-white">
                                            <button onClick={() => onDeleteAllocation(alloc.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1"><Trash2 size={13} /></button>
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
                                            allClients={allClients}
                                            onCreate={onCreateAllocation}
                                        />
                                    ))
                                }



                            </React.Fragment >
                        );
                    })}

                    {/* GLOBAL TOTALS */}
                    <tr className="bg-gray-900 text-white font-bold sticky bottom-0 z-10">
                        <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-[0.2em] text-[10px] font-black">Gesamt Stunden</td>
                        <td className="text-center py-3 border-l border-gray-800 bg-gray-900">{globalTotals.mo}</td>
                        <td className="text-center py-3 border-l border-gray-800 bg-gray-900">{globalTotals.di}</td>
                        <td className="text-center py-3 border-l border-gray-800 bg-gray-900">{globalTotals.mi}</td>
                        <td className="text-center py-3 border-l border-gray-800 bg-gray-900">{globalTotals.do}</td>
                        <td className="text-center py-3 border-l border-gray-800 bg-gray-900">{globalTotals.fr}</td>
                        <td colSpan={2} className="border-l border-gray-800 bg-gray-900"></td>
                    </tr>
                </tbody >
            </table >
        </div >
    );
}

function GhostRow({ employeeId, projects, allClients, onCreate }: { employeeId: string, projects: Project[], allClients: Client[], onCreate: (uid: string, data: any) => void }) {
    const [client, setClient] = useState('');
    const [jobNr, setJobNr] = useState('');
    const [title, setTitle] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isSearchingClient, setIsSearchingClient] = useState(false);
    const selectionRef = React.useRef(false);

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

        // Default create (Pitch/Draft)
        onCreate(employeeId, { type: 'new', clientName: client, projectTitle: title || 'Neuer Pitch', jobNr: jobNr || '' });
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

    const [isSearching, setIsSearching] = useState(false);

    // Filtered projects for search
    const filteredProjects = useMemo(() => {
        if (!title || title.length < 2) return [];
        return projects.filter(p =>
            p.title.toLowerCase().includes(title.toLowerCase()) ||
            p.job_number.toLowerCase().includes(title.toLowerCase()) ||
            p.clients?.name?.toLowerCase().includes(title.toLowerCase())
        ).slice(0, 5);
    }, [title, projects]);

    const handleSelectProject = (proj: Project) => {
        selectionRef.current = true;
        onCreate(employeeId, { type: 'existing', projectId: proj.id });
        reset();
        setIsSearching(false);
        setTimeout(() => { selectionRef.current = false; }, 500);
    };

    const filteredClients = useMemo(() => {
        if (!client) return [];
        return allClients.filter(c => c.name.toLowerCase().includes(client.toLowerCase())).slice(0, 5);
    }, [client, allClients]);

    return (
        <>
            <tr className="border-b border-gray-100 hover:bg-gray-50/40 h-10 group transition-colors">
                <td className="border-r border-gray-100 px-0 h-10 p-0 relative bg-white">
                    <input
                        className="appearance-none w-full h-full px-2 bg-transparent text-[11px] placeholder:text-gray-400 text-gray-900 focus:outline-none transition-colors block"
                        placeholder="Kunden..."
                        value={client}
                        onChange={e => {
                            setClient(e.target.value);
                            setIsSearchingClient(true);
                            setIsSearching(false);
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            setIsSearchingClient(true);
                            setIsSearching(false);
                        }}
                        onBlur={() => setTimeout(() => setIsSearchingClient(false), 200)}
                    />
                    {isSearchingClient && filteredClients.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-gray-100 rounded-xl mt-1 z-50 overflow-hidden">
                            {filteredClients.map(c => (
                                <button
                                    key={c.id}
                                    className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-none text-xs text-gray-700 font-medium"
                                    onClick={() => {
                                        setClient(c.name);
                                        setIsSearchingClient(false);
                                    }}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    )}
                </td>
                <td className="px-0 border-r border-gray-100 h-10 p-0 relative bg-white">
                    <div className="absolute inset-0 w-full h-full">
                        <input
                            type="text"
                            placeholder="Nr..."
                            className="appearance-none w-full h-full px-2 bg-transparent focus:outline-none text-[11px] font-mono text-gray-900 placeholder:text-gray-400 transition-colors"
                            value={jobNr}
                            onChange={e => setJobNr(e.target.value)}
                            onBlur={handleJobNrBlur}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsSearching(false)}
                        />
                        {!jobNr && <Search size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                </td>
                <td className="border-r border-gray-100 px-0 h-10 p-0 relative flex items-center bg-white">
                    <input
                        className="appearance-none w-full h-full px-2 bg-transparent text-[11px] font-bold placeholder:text-gray-400 text-gray-900 focus:outline-none transition-colors block italic"
                        placeholder="Projektsuche / Neuer Pitch..."
                        value={title}
                        onChange={e => {
                            setTitle(e.target.value);
                            setIsSearching(true);
                        }}
                        onKeyDown={handleKeyDown}
                        onBlur={() => {
                            setTimeout(() => {
                                setIsSearching(false);
                                if (selectionRef.current) return;

                                // Trigger modal only if:
                                // 1. Title is not empty
                                // 2. NO exact title match exists in ALL projects
                                // 3. we don't already have Client/JobNr (Pitch mode)
                                if (title && title.trim().length > 0) {
                                    const exactMatch = projects.find(p => p.title.toLowerCase() === title.trim().toLowerCase());
                                    if (exactMatch) {
                                        onCreate(employeeId, { type: 'existing', projectId: exactMatch.id });
                                        reset();
                                    } else if (!client && !jobNr) {
                                        trySubmit();
                                    }
                                }
                            }, 300);
                        }}
                    />

                    {/* SEARCH RESULTS DROPDOWN */}
                    {isSearching && filteredProjects.length > 0 && (
                        <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-gray-100 rounded-b-md z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                            {filteredProjects.map(proj => (
                                <button
                                    key={proj.id}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-none flex flex-col"
                                    onClick={() => handleSelectProject(proj)}
                                >
                                    <span className="text-[10px] font-bold text-gray-900 truncate">{proj.title}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-gray-400 font-mono">{proj.job_number}</span>
                                        <span className="text-[9px] text-gray-400 truncate">{proj.clients?.name}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </td>
                <td className="border-r border-gray-50"></td>
                <td className="border-r border-gray-50"></td>
                <td className="border-r border-gray-50"></td>
                <td className="border-r border-gray-50"></td>
                <td className="border-r border-gray-50"></td>
                <td className="border-r border-gray-50"></td>
                <td className="border-r border-gray-50"></td>
                <td></td>
            </tr>
            {showModal && (
                <tr>
                    <td colSpan={14} className="p-0 border-none relative">
                        <MissingInfoModal
                            allClients={allClients}
                            onSave={(c, j) => {
                                setShowModal(false);
                                setClient(c);
                                setJobNr(j);
                                // Immediate create after modal save
                                onCreate(employeeId, { type: 'new', clientName: c, projectTitle: title, jobNr: j });
                                reset();
                            }}
                            onCancel={() => {
                                setShowModal(false);
                                reset(); // Key change: reset row on cancel
                            }}
                        />
                    </td>
                </tr>
            )}
        </>
    );
}

function MissingInfoModal({ allClients, onSave, onCancel }: { allClients: Client[], onSave: (client: string, jobNr: string) => void, onCancel: () => void }) {
    const [localClient, setLocalClient] = useState('');
    const [localJobNr, setLocalJobNr] = useState('');
    const [isSearchingClient, setIsSearchingClient] = useState(false);

    const filteredClients = useMemo(() => {
        if (!localClient) return [];
        return allClients.filter(c => c.name.toLowerCase().includes(localClient.toLowerCase())).slice(0, 5);
    }, [localClient, allClients]);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 w-full max-w-sm m-4 transform animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold mb-2 text-gray-900">Daten vervollständigen</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">Bitte gib einen Kunden oder eine Jobnummer an, um das Projekt zu erstellen.</p>

                <div className="space-y-5">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Kunde</label>
                        <input
                            autoFocus
                            className="appearance-none w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                            placeholder="Kunden suchen oder neu..."
                            value={localClient}
                            onChange={e => {
                                setLocalClient(e.target.value);
                                setIsSearchingClient(true);
                            }}
                            onFocus={() => setIsSearchingClient(true)}
                        />
                        {isSearchingClient && filteredClients.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white shadow-xl border border-gray-100 rounded-xl mt-1 z-50 overflow-hidden">
                                {filteredClients.map(c => (
                                    <button
                                        key={c.id}
                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-none text-sm text-gray-700 font-medium"
                                        onClick={() => {
                                            setLocalClient(c.name);
                                            setIsSearchingClient(false);
                                        }}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="h-px bg-gray-100 flex-1"></div>
                        <span className="text-[10px] font-bold text-gray-300 uppercase italic">oder</span>
                        <div className="h-px bg-gray-100 flex-1"></div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Job Nr. (optional)</label>
                        <input
                            className="appearance-none w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                            placeholder="z.B. 23-456"
                            value={localJobNr}
                            onChange={e => setLocalJobNr(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={() => onSave(localClient, localJobNr)}
                        disabled={!localClient && !localJobNr}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
                    >
                        Speichern
                    </button>
                </div>
            </div>
        </div>
    );
}
