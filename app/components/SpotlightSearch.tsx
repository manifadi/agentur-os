import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight, Command, Hash, Calendar, CheckSquare, Users, FileText } from 'lucide-react';
import { Project, Todo } from '../types';

interface SpotlightSearchProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    todos: Todo[]; // Assuming we can pass todos or fetch them
    onNavigate: (type: 'project' | 'todo' | 'page', id?: string) => void;
}

export default function SpotlightSearch({ isOpen, onClose, projects, todos, onNavigate }: SpotlightSearchProps) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!isOpen) return null;

    // Simple filtering logic
    const filteredProjects = query ? projects.filter(p => p.title.toLowerCase().includes(query.toLowerCase())).slice(0, 3) : [];
    // Flatten todos from projects if passed differently, but let's assume simple list for now
    // Actually in Dashboard we have `assignedTasks` which are todos.
    // For now mocking or using passed props. 

    const sections = [
        {
            title: 'Vorschläge',
            items: [
                { id: 'create_project', title: 'Neues Projekt erstellen', icon: FileText, type: 'action' },
                { id: 'time_tracking', title: 'Zeit erfassen', icon: Calendar, type: 'action' },
            ]
        },
        // Only show if query exists
        ...(query ? [
            {
                title: 'Projekte',
                items: filteredProjects.map(p => ({ id: p.id, title: p.title, icon: Hash, type: 'project' }))
            }
        ] : [])
    ];

    return (
        <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh] px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                {/* Search Header */}
                <div className="flex items-center gap-4 p-4 border-b border-gray-100">
                    <Search className="text-gray-400 w-6 h-6" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Suchen nach Projekten, Aufgaben..."
                        className="flex-1 text-xl font-medium placeholder:text-gray-300 outline-none text-gray-900 bg-transparent h-12"
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">ESC</span>
                    </div>
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {sections.map((section, idx) => (
                        <div key={idx} className="mb-4 last:mb-0">
                            {section.items.length > 0 && (
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 py-2 mb-1">{section.title}</h3>
                            )}
                            <div className="space-y-0.5">
                                {section.items.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (item.type === 'action') {
                                                console.log('Action:', item.id);
                                                // Handle action
                                            } else {
                                                onNavigate(item.type, item.id);
                                            }
                                            onClose();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 transition-colors text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 group-hover:border-blue-200 group-hover:text-blue-500 transition-colors">
                                            <item.icon size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{item.title}</span>
                                        </div>
                                        {query && <ArrowRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity -ml-4 group-hover:ml-0" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}

                    {query && filteredProjects.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                            <p>Keine Ergebnisse gefunden.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
