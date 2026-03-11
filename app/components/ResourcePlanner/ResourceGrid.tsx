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
        <div className="bg-surface overflow-x-auto max-h-[calc(100vh-140px)]">
            <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-subtle text-text-muted sticky top-0 z-10 font-bold">
                    <tr className="h-10">
                        {/* 6 Columns */}
                        <th className="px-3 border-b border-r border-default text-center w-32 font-bold uppercase tracking-wider text-[10px]">Kunde</th>
                        <th className="px-3 border-b border-r border-default text-center w-24 font-bold uppercase tracking-wider text-[10px]">Job Nr.</th>
                        <th className="px-3 border-b border-r border-default text-left w-48 font-bold uppercase tracking-wider text-[10px]">Projekt</th>
                        <th className="px-3 border-b border-r border-default text-left w-48 font-bold uppercase tracking-wider text-[10px]">Aufgabe</th>
                        <th className="px-3 border-b border-r border-default text-center w-24 font-bold uppercase tracking-wider text-[10px]">Status</th>
                        <th className="px-3 border-b border-r border-default text-center w-16 font-bold uppercase tracking-wider text-[10px]">PM</th>

                        {/* Days */}
                        <th className="px-1 border-b border-r border-default w-12 text-center bg-accent-subtle/30 text-accent">Mo</th>
                        <th className="px-1 border-b border-r border-default w-12 text-center bg-accent-subtle/30 text-accent">Di</th>
                        <th className="px-1 border-b border-r border-default w-12 text-center bg-accent-subtle/30 text-accent">Mi</th>
                        <th className="px-1 border-b border-r border-default w-12 text-center bg-accent-subtle/30 text-accent">Do</th>
                        <th className="px-1 border-b border-r border-default w-12 text-center bg-accent-subtle/30 text-accent">Fr</th>

                        <th className="px-2 border-b border-r border-default w-32 text-center">Kommentar</th>
                        <th className="w-8 border-b border-default bg-subtle"></th>
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
                                <tr className="bg-subtle/50">
                                    <td colSpan={14} className="px-3 py-2 border-b border-default sticky left-0 z-0">
                                        <div className="font-bold text-sm text-text-primary tracking-tight">{row.employee.name}</div>
                                        {row.employee.job_title && <div className="text-[10px] text-text-muted font-medium uppercase mt-0.5">{row.employee.job_title}</div>}
                                    </td>
                                </tr>

                                {row.allocations.map(alloc => (
                                    <tr key={alloc.id} className="border-b border-default hover:bg-hover h-9 group">
                                        <td className="px-0 border-b border-r border-default h-9 p-0 relative bg-surface">
                                            <div className="px-2 text-text-secondary truncate select-none text-[11px] py-1 font-medium">{alloc.projects?.clients?.name || '-'}</div>
                                        </td>
                                        <td className="px-0 border-b border-r border-default h-9 p-0 relative bg-surface group/cell">
                                            {alloc.projects?.job_number ? (
                                                <div className="flex items-center px-2 h-full gap-1.5">
                                                    <Lock size={10} className="text-text-placeholder flex-shrink-0" />
                                                    <div className="text-text-primary font-mono text-[10px] truncate select-none">{alloc.projects.job_number}</div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center px-2 h-full italic text-text-muted text-[10px] select-none">
                                                    Pitch
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-0 border-b border-r border-default h-full p-0 relative bg-surface group/cell">
                                            {alloc.projects?.job_number ? (
                                                <div className="flex items-center px-2 h-full">
                                                    <div className="text-text-primary font-semibold text-[11px] truncate select-none">{alloc.projects.title}</div>
                                                </div>
                                            ) : (
                                                <div className="px-2 text-text-muted font-bold text-[11px] truncate select-none italic">
                                                    {alloc.projects?.title || 'Pitch'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-0 border-b border-r border-default h-auto min-h-[36px] p-0 relative bg-surface">
                                            <DebouncedInput
                                                id={`${alloc.id}-task`}
                                                isTextarea
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-surface focus:outline-none text-text-primary text-[11px] placeholder:text-text-placeholder block"
                                                initialValue={alloc.task_description || ''}
                                                onSave={(val) => onUpdateAllocation(alloc.id, 'task_description', val)}
                                                placeholder="..."
                                            />
                                        </td>
                                        <td className="px-0 border-b border-r border-default h-9 p-0 relative bg-surface">
                                            <select
                                                className={`appearance-none w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer block font-bold ${getStatusStyle(alloc.projects?.status || '')}`}
                                                value={alloc.projects?.status || ''}
                                                onChange={(e) => { if (alloc.project_id) onUpdateProject(alloc.project_id, 'status', e.target.value); }}
                                            >
                                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-0 border-b border-r border-default h-9 p-0 relative bg-surface">
                                            <select
                                                className="appearance-none w-full h-full px-1 bg-transparent text-[10px] focus:outline-none cursor-pointer text-text-muted text-center block hover:text-text-primary"
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
                                                    <td key={day} className={`px-0 border-b border-r border-default text-center h-9 p-0 relative bg-surface`}>
                                                        <input
                                                            type="number"
                                                            step="0.25"
                                                            className={`appearance-none w-full h-full text-center bg-transparent focus:bg-accent-subtle/50 focus:outline-none font-bold block ${(alloc as any)[field] > 0 ? 'text-text-primary border-b-2 border-b-accent/30' : 'text-text-muted/50'}`}
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


                                        <td className="px-0 border-b border-r border-default h-auto min-h-[36px] p-0 relative bg-surface">
                                            <DebouncedInput
                                                id={`${alloc.id}-comment`}
                                                isTextarea
                                                className="appearance-none w-full h-full px-2 bg-transparent focus:bg-surface focus:outline-none text-[10px] text-text-muted placeholder:text-text-placeholder block"
                                                initialValue={alloc.comment || ''}
                                                onSave={(val) => onUpdateAllocation(alloc.id, 'comment', val)}
                                                placeholder="..."
                                            />
                                        </td>
                                        <td className="text-center border-b border-default bg-surface">
                                            <button onClick={() => onDeleteAllocation(alloc.id)} className="text-text-muted hover:text-red-500 transition-colors p-1"><Trash2 size={13} /></button>
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
                    <tr className="bg-text-primary text-surface font-bold sticky bottom-0 z-10">
                        <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-[0.2em] text-[10px] font-black">Gesamt Stunden</td>
                        <td className="text-center py-3 border-l border-surface/20 bg-text-primary">{globalTotals.mo}</td>
                        <td className="text-center py-3 border-l border-surface/20 bg-text-primary">{globalTotals.di}</td>
                        <td className="text-center py-3 border-l border-surface/20 bg-text-primary">{globalTotals.mi}</td>
                        <td className="text-center py-3 border-l border-surface/20 bg-text-primary">{globalTotals.do}</td>
                        <td className="text-center py-3 border-l border-surface/20 bg-text-primary">{globalTotals.fr}</td>
                        <td colSpan={2} className="border-l border-surface/20 bg-text-primary"></td>
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
            <tr className="border-b border-default hover:bg-hover h-10 group transition-colors">
                <td className="border-r border-default px-0 h-10 p-0 relative bg-surface">
                    <input
                        className="appearance-none w-full h-full px-2 bg-transparent text-[11px] placeholder:text-text-placeholder text-text-primary focus:outline-none transition-colors block"
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
                        <div className="absolute top-full left-0 w-full bg-surface shadow-xl border border-default rounded-xl mt-1 z-50 overflow-hidden">
                            {filteredClients.map(c => (
                                <button
                                    key={c.id}
                                    className="w-full text-left px-4 py-2 hover:bg-hover transition-colors border-b border-default last:border-none text-xs text-text-primary font-medium"
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
                <td className="px-0 border-r border-default h-10 p-0 relative bg-surface">
                    <div className="absolute inset-0 w-full h-full">
                        <input
                            type="text"
                            placeholder="Nr..."
                            className="appearance-none w-full h-full px-2 bg-transparent focus:outline-none text-[11px] font-mono text-text-primary placeholder:text-text-placeholder transition-colors"
                            value={jobNr}
                            onChange={e => setJobNr(e.target.value)}
                            onBlur={handleJobNrBlur}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsSearching(false)}
                        />
                        {!jobNr && <Search size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                </td>
                <td className="border-r border-default px-0 h-10 p-0 relative flex items-center bg-surface">
                    <input
                        className="appearance-none w-full h-full px-2 bg-transparent text-[11px] font-bold placeholder:text-text-placeholder text-text-primary focus:outline-none transition-colors block italic"
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
                        <div className="absolute top-full left-0 w-full bg-surface shadow-xl border border-default rounded-b-md z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                            {filteredProjects.map(proj => (
                                <button
                                    key={proj.id}
                                    className="w-full text-left px-3 py-2 hover:bg-hover transition-colors border-b border-default last:border-none flex flex-col"
                                    onClick={() => handleSelectProject(proj)}
                                >
                                    <span className="text-[10px] font-bold text-text-primary truncate">{proj.title}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-text-muted font-mono">{proj.job_number}</span>
                                        <span className="text-[9px] text-text-muted truncate">{proj.clients?.name}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </td>
                <td className="border-r border-default"></td>
                <td className="border-r border-default"></td>
                <td className="border-r border-default"></td>
                <td className="border-r border-default"></td>
                <td className="border-r border-default"></td>
                <td className="border-r border-default"></td>
                <td className="border-r border-default"></td>
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
            <div className="bg-surface rounded-2xl shadow-2xl border border-default p-8 w-full max-w-sm m-4 transform animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold mb-2 text-text-primary">Daten vervollständigen</h3>
                <p className="text-sm text-text-secondary mb-6 leading-relaxed">Bitte gib einen Kunden oder eine Jobnummer an, um das Projekt zu erstellen.</p>

                <div className="space-y-5">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Kunde</label>
                        <input
                            autoFocus
                            className="appearance-none w-full border border-default rounded-xl px-4 py-2.5 text-sm text-text-primary bg-input focus:ring-2 focus:ring-accent-subtle focus:border-accent outline-none transition-all"
                            placeholder="Kunden suchen oder neu..."
                            value={localClient}
                            onChange={e => {
                                setLocalClient(e.target.value);
                                setIsSearchingClient(true);
                            }}
                            onFocus={() => setIsSearchingClient(true)}
                        />
                        {isSearchingClient && filteredClients.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-surface shadow-xl border border-default rounded-xl mt-1 z-50 overflow-hidden">
                                {filteredClients.map(c => (
                                    <button
                                        key={c.id}
                                        className="w-full text-left px-4 py-2 hover:bg-hover transition-colors border-b border-default last:border-none text-sm text-text-primary font-medium"
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
                        <div className="h-px bg-default flex-1 border-b border-default"></div>
                        <span className="text-[10px] font-bold text-text-placeholder uppercase italic">oder</span>
                        <div className="h-px bg-default flex-1 border-b border-default"></div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Job Nr. (optional)</label>
                        <input
                            className="appearance-none w-full border border-default bg-input rounded-xl px-4 py-2.5 text-sm font-mono text-text-primary focus:ring-2 focus:ring-accent-subtle focus:border-accent outline-none transition-all"
                            placeholder="z.B. 23-456"
                            value={localJobNr}
                            onChange={e => setLocalJobNr(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 text-sm font-bold text-text-secondary hover:bg-hover rounded-xl transition-colors"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={() => onSave(localClient, localJobNr)}
                        disabled={!localClient && !localJobNr}
                        className="px-6 py-2.5 text-sm font-bold text-accent-text bg-accent hover:bg-accent-hover rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-default"
                    >
                        Speichern
                    </button>
                </div>
            </div>
        </div>
    );
}
