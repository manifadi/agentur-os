import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Briefcase, Users, FileText, ArrowRight, Loader } from 'lucide-react';
import { Project, Client, ProjectLog } from '../types';
import { supabase } from '../supabaseClient';

interface GlobalSearchProps {
    projects: Project[];
    clients: Client[];
    onSelectProject: (p: Project) => void;
    onSelectClient: (c: Client) => void;
}

interface SearchResults {
    projects: Project[];
    clients: Client[];
    logs: (ProjectLog & { projects?: Project })[];
}

export default function GlobalSearch({ projects, clients, onSelectProject, onSelectClient }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResults>({ projects: [], clients: [], logs: [] });

    // Debounce Logic for Remote Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length > 0) {
                setLoading(true);

                // 1. Local Search (Instant-ish)
                const localProjects = projects.filter(p =>
                    p.title.toLowerCase().includes(query.toLowerCase()) ||
                    p.job_number.toLowerCase().includes(query.toLowerCase())
                );

                const localClients = clients.filter(c =>
                    c.name.toLowerCase().includes(query.toLowerCase())
                );

                // 2. Remote Search (Logs)
                const { data: logs } = await supabase
                    .from('project_logs')
                    .select('*, projects(*)')
                    .ilike('content', `%${query}%`)
                    .limit(5); // Limit to prevent massive loads

                setResults({
                    projects: localProjects,
                    clients: localClients,
                    logs: (logs as any) || []
                });

                setLoading(false);
                setIsOpen(true);
            } else {
                setIsOpen(false);
                setResults({ projects: [], clients: [], logs: [] });
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [query, projects, clients]);

    // Click Outside Handling
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const hasResults = results.projects.length > 0 || results.clients.length > 0 || results.logs.length > 0;

    return (
        <div className="relative flex-1 md:flex-none" ref={containerRef}>
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Suchen..."
                    className="w-full md:w-64 pl-9 pr-8 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => query && setIsOpen(true)}
                />
                {query && (
                    <button onClick={() => { setQuery(''); setIsOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* RESULTS OVERLAY */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 md:w-96 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">

                    {loading ? (
                        <div className="p-4 text-center text-gray-400 flex items-center justify-center gap-2">
                            <Loader size={16} className="animate-spin" /> Sucht...
                        </div>
                    ) : !hasResults ? (
                        <div className="p-4 text-center text-gray-500 text-sm">Keine Ergebnisse gefunden.</div>
                    ) : (
                        <div className="max-h-[70vh] overflow-y-auto">

                            {/* PROJECTS */}
                            {results.projects.length > 0 && (
                                <div className="border-b border-gray-100">
                                    <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                        <Briefcase size={10} /> Projekte
                                    </div>
                                    <div>
                                        {results.projects.slice(0, 5).map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => { onSelectProject(p); setIsOpen(false); setQuery(''); }}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-center justify-between group"
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-gray-900">{p.title}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{p.job_number}</div>
                                                </div>
                                                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-gray-400 -translate-x-2 group-hover:translate-x-0 transition" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CLIENTS */}
                            {results.clients.length > 0 && (
                                <div className="border-b border-gray-100">
                                    <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                        <Users size={10} /> Kunden
                                    </div>
                                    <div>
                                        {results.clients.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => { onSelectClient(c); setIsOpen(false); setQuery(''); }}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {c.logo_url ? <img src={c.logo_url} className="w-5 h-5 object-contain" /> : <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-[8px] font-bold">{c.name.substring(0, 2)}</div>}
                                                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                                                </div>
                                                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-gray-400 -translate-x-2 group-hover:translate-x-0 transition" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* LOGS */}
                            {results.logs.length > 0 && (
                                <div>
                                    <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                        <FileText size={10} /> Logbuch
                                    </div>
                                    <div>
                                        {results.logs.map((log: any) => (
                                            <button
                                                key={log.id}
                                                onClick={() => {
                                                    if (log.projects) onSelectProject(log.projects);
                                                    setIsOpen(false);
                                                    setQuery('');
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition block"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{log.projects?.job_number}</span>
                                                    <span className="text-xs font-bold text-gray-700 truncate max-w-[150px]">{log.projects?.title}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 line-clamp-2 italic">"{log.content}"</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
