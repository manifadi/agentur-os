import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Briefcase, Users, User, FileText, X, Layout, CheckSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project, Client, Employee, Todo } from '../types';
import { supabase } from '../supabaseClient';

export default function GlobalSearch() {
    const router = useRouter();
    const { projects, clients, employees, timeEntries } = useApp();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{
        projects: Project[];
        clients: Client[];
        employees: Employee[];
        todos: Todo[];
        logs: any[];
    }>({ projects: [], clients: [], employees: [], todos: [], logs: [] });

    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Search Logic (Debounced for async parts, instant for local)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query.trim()) {
                setResults({ projects: [], clients: [], employees: [], todos: [], logs: [] });
                return;
            }

            const q = query.toLowerCase();
            setLoading(true);

            // 1. MATCH CLIENTS FIRST
            const matchedClients = clients.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.full_name && c.full_name.toLowerCase().includes(q))
            ).slice(0, 5);

            // 2. MATCH PROJECTS (General Search)
            let matchedProjects = projects.filter(p =>
                p.title.toLowerCase().includes(q) ||
                p.job_number.toLowerCase().includes(q)
            ).slice(0, 5);

            // 3. MATCH EMPLOYEES
            const matchedEmployees = employees.filter(e =>
                e.name.toLowerCase().includes(q) ||
                (e.email && e.email.toLowerCase().includes(q))
            ).slice(0, 5);

            // 4. REMOTE SEARCH (Logs) - Standard Query
            let { data: generalLogs } = await supabase
                .from('project_logs')
                .select('*, projects!inner(id, title, job_number, client_id)')
                .ilike('content', `%${query}%`)
                .limit(5);

            // === HIERARCHY LOGIC ===
            // If we found specific clients, we want to Enrich the results with THEIR projects and THEIR logs
            // regardless of whether the project title matches the query string.

            let finalProjects = [...matchedProjects];
            let finalLogs = [...(generalLogs || [])];

            if (matchedClients.length > 0) {
                const clientIds = matchedClients.map(c => c.id);

                // Add ALL projects for these clients (deduplicated)
                const clientProjects = projects.filter(p => clientIds.includes(p.client_id));

                // Merge and dedupe projects
                // We prioritize Client Projects at the top if distinct, or just mix them? 
                // User requirement: "Kundendetailseite, dann alle Projekte, die unter dem Kunden laufen"
                // So if I search "Hartlauer", I want ALL Hartlauer projects in the list.
                // We will append them.
                clientProjects.forEach(cp => {
                    if (!finalProjects.find(fp => fp.id === cp.id)) {
                        finalProjects.push(cp);
                    }
                });

                // Fetch Logs for these clients specifically (even if content doesn't match query, maybe? 
                // User said "und dann die Logbucheinträge". Probably implies "Logs OF that client".
                // But usually search filters by text. If I search "Hartlauer", logs matching "Hartlauer" OR logs belonging to Hartlauer projects?
                // Let's assume logs belonging to Hartlauer projects.

                const { data: clientContextLogs } = await supabase
                    .from('project_logs')
                    .select('*, projects!inner(id, title, job_number, client_id)')
                    .in('projects.client_id', clientIds)
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (clientContextLogs) {
                    clientContextLogs.forEach(cl => {
                        if (!finalLogs.find(fl => fl.id === cl.id)) {
                            finalLogs.push(cl);
                        }
                    });
                }
            }

            setResults({
                projects: finalProjects,
                clients: matchedClients,
                employees: matchedEmployees,
                todos: [],
                logs: finalLogs
            });

            setLoading(false);
            setIsOpen(true);
        }, 300);

        return () => clearTimeout(timer);
    }, [query, projects, clients, employees]);

    const handleSelect = (path: string) => {
        setIsOpen(false);
        setQuery('');
        router.push(path);
    };

    // Helper to group projects/logs by client if a client was matched
    const isClientSearch = results.clients.length > 0;

    return (
        <div className="relative w-full max-w-2xl" ref={wrapperRef}>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition" size={20} />
                <input
                    type="text"
                    className="w-full pl-12 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-base shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition placeholder:text-gray-400"
                    placeholder="Suche nach Projekten, Kunden, Aufgaben..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => query && setIsOpen(true)}
                />

                {/* Loader or Clear Button */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {loading && <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}
                    {query && !loading && (
                        <button
                            onClick={() => { setQuery(''); setIsOpen(false); }}
                            className="text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-0.5"
                        >
                            <X size={14} />
                        </button>
                    )}
                    {!query && <span className="text-xs text-gray-300 font-mono border border-gray-100 rounded px-1.5 py-0.5">⌘K</span>}
                </div>
            </div>

            {/* Results Dropdown */}
            {isOpen && (
                <div className="absolute top-full mt-3 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[80vh] overflow-y-auto z-[100] animate-in fade-in slide-in-from-top-2 duration-200 scrollbar-thin scrollbar-thumb-gray-200">

                    {/* HIERARCHICAL VIEW (If Client Matched) */}
                    {isClientSearch ? (
                        <>
                            {/* 1. KUNDEN */}
                            <div className="p-2">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                                    <Briefcase size={12} /> Kunden
                                </div>
                                {results.clients.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleSelect(`/clients/${c.id}`)}
                                        className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded-xl flex items-center gap-3 group transition bg-white border border-gray-100 mb-1"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0 shadow-sm border border-gray-200 group-hover:bg-blue-50 group-hover:text-blue-600 transition overflow-hidden">
                                            {c.logo_url ? (
                                                <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                                            ) : (
                                                c.name.substring(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition">{c.name}</div>
                                            {c.address && <div className="text-xs text-gray-500 truncate max-w-[300px]">{c.address}</div>}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* 2. PROJEKTE (Filtered by these clients + others) */}
                            {results.projects.length > 0 && (
                                <>
                                    <div className="h-px bg-gray-100 mx-4 my-2" />
                                    <div className="p-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                                            <Layout size={12} /> Projekte
                                        </div>
                                        {results.projects.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSelect(`/uebersicht?project_id=${p.id}`)}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-xl flex items-center justify-between group transition"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="text-xs text-blue-500 font-mono bg-blue-50 px-1.5 py-0.5 rounded">{p.job_number}</div>
                                                    <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition">{p.title}</div>
                                                </div>
                                                <div className="text-xs text-gray-400">{p.clients?.name}</div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* 3. LOGS (Contextual) */}
                            {results.logs.length > 0 && (
                                <>
                                    <div className="h-px bg-gray-100 mx-4 my-2" />
                                    <div className="p-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                                            <CheckSquare size={12} /> Logbucheinträge
                                        </div>
                                        {results.logs.map((log: any) => (
                                            <button
                                                key={log.id}
                                                onClick={() => handleSelect(`/uebersicht?project_id=${log.project_id}`)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl block group transition"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{log.projects?.job_number}</span>
                                                    <span className="text-xs font-bold text-gray-700">{log.projects?.title}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 line-clamp-2 pl-2 border-l-2 border-gray-200 group-hover:border-blue-400 transition-colors">
                                                    {log.content}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        /* STANDARD VIEW (Existing logic for non-client search) */
                        <>
                            {/* PROJECTS */}
                            {results.projects.length > 0 && (
                                <div className="p-2">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                                        <FileText size={12} /> Projekte
                                    </div>
                                    {results.projects.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelect(`/uebersicht?project_id=${p.id}`)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl flex items-center justify-between group transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                                    <Layout size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition">{p.title}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{p.job_number}</div>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-500`}>{p.status}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* CLIENTS (Standard) */}
                            {results.clients.length > 0 && (
                                <>
                                    {results.projects.length > 0 && <div className="h-px bg-gray-50 mx-4" />}
                                    <div className="p-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                                            <Briefcase size={12} /> Kunden
                                        </div>
                                        {results.clients.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleSelect(`/clients/${c.id}`)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl flex items-center gap-3 group transition"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 border border-gray-100 group-hover:bg-blue-50 group-hover:text-blue-600 overflow-hidden">
                                                    {c.logo_url ? (
                                                        <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        c.name.substring(0, 2).toUpperCase()
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition">{c.name}</div>
                                                    {c.address && <div className="text-xs text-gray-500 truncate max-w-[200px]">{c.address}</div>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* EMPLOYEES */}
                            {results.employees.length > 0 && (
                                <>
                                    {(results.projects.length > 0 || results.clients.length > 0) && <div className="h-px bg-gray-50 mx-4" />}
                                    <div className="p-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                                            <Users size={12} /> Team
                                        </div>
                                        {results.employees.map(e => (
                                            <button
                                                key={e.id}
                                                onClick={() => handleSelect(`/einstellungen?tab=admin`)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl flex items-center gap-3 group transition"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">
                                                    {e.initials}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900 group-hover:text-purple-600 transition">{e.name}</div>
                                                    <div className="text-xs text-gray-500">{e.email}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* LOGS */}
                            {results.logs.length > 0 && (
                                <>
                                    <div className="h-px bg-gray-50 mx-4" />
                                    <div className="p-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex items-center gap-2">
                                            <CheckSquare size={12} /> Logbucheinträge
                                        </div>
                                        {results.logs.map((log: any) => (
                                            <button
                                                key={log.id}
                                                onClick={() => handleSelect(`/uebersicht?project_id=${log.project_id}`)}
                                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-xl block group transition"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono group-hover:bg-blue-50 group-hover:text-blue-600 transition">{log.projects?.job_number}</span>
                                                    <span className="text-xs font-bold text-gray-700 truncate max-w-[200px]">{log.projects?.title}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 line-clamp-2 italic pl-1 border-l-2 border-gray-100 group-hover:border-blue-200">"{log.content}"</div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* EMPTY STATE */}
                    {!query && (
                        <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                                <Search size={20} />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900">Globale Suche</h3>
                            <p className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">Suche nach Projekten, Kunden, Mitarbeitern und mehr.</p>
                        </div>
                    )}

                    {query && results.projects.length === 0 && results.clients.length === 0 && results.employees.length === 0 && results.logs.length === 0 && !loading && (
                        <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                                <X size={20} />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900">Keine Treffer</h3>
                            <p className="text-xs text-gray-500 mt-1">Wir konnten nichts finden für "{query}".</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
