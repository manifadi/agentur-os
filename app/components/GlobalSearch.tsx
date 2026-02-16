import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Briefcase, Users, User, FileText, X, Layout, CheckSquare, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project, Client, Employee, Todo } from '../types';
import { supabase } from '../supabaseClient';

export default function GlobalSearch() {
    const router = useRouter();
    const { projects, clients, employees, currentUser } = useApp();
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

    // Close on click outside or escape
    useEffect(() => {
        function handleKeydown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        }

        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        const handleOpenSearch = () => setIsOpen(true);

        document.addEventListener("keydown", handleKeydown);
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("agentur-os-open-search", handleOpenSearch);
        return () => {
            document.removeEventListener("keydown", handleKeydown);
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("agentur-os-open-search", handleOpenSearch);
        };
    }, []);

    // Focus input when modal opens
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery('');
        }
    }, [isOpen]);

    // Search Logic
    useEffect(() => {
        if (!query.trim()) {
            setResults({ projects: [], clients: [], employees: [], todos: [], logs: [] });
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            const lowerQuery = query.toLowerCase();

            // 1. Filter Clients
            const matchedClients = clients.filter(c =>
                c.name.toLowerCase().includes(lowerQuery)
            );

            // 2. Filter Projects (Title, JobNr, or Client name match)
            const matchedProjects = projects.filter(p =>
                p.title.toLowerCase().includes(lowerQuery) ||
                p.job_number.toLowerCase().includes(lowerQuery) ||
                matchedClients.some(c => c.id === p.client_id)
            );

            // 3. Fetch Logs from Supabase
            let matchedLogs: any[] = [];
            if (currentUser?.organization_id) {
                const { data: logsData } = await supabase
                    .from('project_logs')
                    .select('*, projects(title)')
                    .eq('organization_id', currentUser.organization_id)
                    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
                    .limit(10);

                if (logsData) matchedLogs = logsData;
            }

            setResults({
                projects: matchedProjects,
                clients: matchedClients,
                employees: [],
                todos: [],
                logs: matchedLogs
            });
            setLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [query, projects, clients, currentUser]);

    const handleSelect = (path: string) => {
        setIsOpen(false);
        setQuery('');
        router.push(path);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-gray-900/20 animate-in fade-in duration-200">
            <div
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200"
                ref={wrapperRef}
            >
                {/* Search Input Area */}
                <div className="relative border-b border-gray-50 p-4 flex items-center gap-4">
                    <Search className="text-gray-400" size={24} strokeWidth={2.5} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent border-none text-xl outline-none placeholder:text-gray-300 font-medium py-2"
                        placeholder="Suche nach Projekten, Kunden, Aufgaben..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        {loading && <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}
                        <div className="bg-gray-50 border border-gray-200 text-[10px] font-bold text-gray-400 px-2 py-1 rounded-lg shadow-sm tracking-widest uppercase">ESC</div>
                    </div>
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-none">
                    {query ? (
                        <div className="space-y-4 pb-4">
                            {/* CLIENTS */}
                            {results.clients.length > 0 && (
                                <section>
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Briefcase size={12} /> Kunden
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        {results.clients.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleSelect(`/uebersicht?client_id=${c.id}`)}
                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl group transition-all text-left"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold border border-gray-100 group-hover:bg-blue-50 group-hover:text-blue-600 overflow-hidden shadow-sm">
                                                    {c.logo_url ? <img src={c.logo_url} className="w-full h-full object-cover" /> : c.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition truncate">{c.name}</div>
                                                    <div className="text-[10px] text-gray-400 truncate tracking-wide">KUNDE • {c.address || 'Keine Adresse'}</div>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* PROJECTS */}
                            {results.projects.length > 0 && (
                                <section>
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <Layout size={12} /> Projekte
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        {results.projects.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleSelect(`/uebersicht?project_id=${p.id}`)}
                                                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl group transition-all text-left"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-blue-50/50 flex items-center justify-center text-blue-600 border border-blue-50 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                    <Layout size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition truncate">{p.title}</div>
                                                    <div className="text-[10px] text-gray-400 truncate tracking-widest font-mono">{p.job_number} • {p.status}</div>
                                                </div>
                                                <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* LOGS */}
                            {results.logs.length > 0 && (
                                <section>
                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={12} /> Logbucheinträge
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                        {results.logs.map(l => (
                                            <button
                                                key={l.id}
                                                onClick={() => handleSelect(`/uebersicht?project_id=${l.project_id}`)}
                                                className="flex flex-col gap-1 p-3 hover:bg-gray-50 rounded-2xl group transition-all text-left"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition truncate">{l.title}</div>
                                                    <div className="text-[10px] text-gray-400 tracking-wider uppercase font-bold">{new Date(l.entry_date).toLocaleDateString()}</div>
                                                </div>
                                                <div className="text-xs text-gray-500 line-clamp-2">{l.content}</div>
                                                <div className="text-[10px] text-blue-500/60 font-bold uppercase tracking-widest mt-1">PROJEKT • {l.projects?.title}</div>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Fallback Empty */}
                            {results.projects.length === 0 && results.clients.length === 0 && results.logs.length === 0 && !loading && (
                                <div className="py-12 text-center">
                                    <div className="text-gray-300 mb-2"><Search size={40} className="mx-auto" /></div>
                                    <p className="text-gray-500 font-medium">Keine Ergebnisse für "{query}"</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                                <Search size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Globale Suche</h3>
                            <p className="text-sm text-gray-400 mt-1 max-w-[280px] mx-auto">Suche nach Projekten, Kunden oder Logbucheinträgen.</p>
                            <div className="mt-8 flex items-center justify-center gap-6">
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    <span className="bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">Enter</span> zum Auswählen
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    <span className="bg-gray-100 px-2 py-1 rounded-lg border border-gray-200">ESC</span> zum Schließen
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="bg-gray-50/50 p-4 border-t border-gray-50 flex justify-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Agentur OS • Spotlight Search</p>
                </div>
            </div>
        </div>
    );
}
