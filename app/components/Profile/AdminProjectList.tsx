import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Project, Client } from '../../types';
import ProjectList from '../Projects/ProjectList';

interface AdminProjectListProps {
    projects: Project[];
    clients: Client[];
}

export default function AdminProjectList({ projects, clients }: AdminProjectListProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [clientFilter, setClientFilter] = useState('');

    const filteredProjects = projects.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.job_number.toLowerCase().includes(search.toLowerCase());
        const matchesClient = clientFilter ? p.client_id === clientFilter : true;
        return matchesSearch && matchesClient;
    });

    return (
        <div>
            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Suchen nach Titel oder Job Nr..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl text-sm transition"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="w-48">
                    <select
                        className="w-full px-3 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl text-sm transition"
                        value={clientFilter}
                        onChange={e => setClientFilter(e.target.value)}
                    >
                        <option value="">Alle Kunden</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            <ProjectList
                projects={filteredProjects}
                selectedClient={null}
                onSelectProject={(p) => router.push(`/uebersicht?projectId=${p.id}`)}
                showOpenTodos={false}
            />
        </div>
    );
}
