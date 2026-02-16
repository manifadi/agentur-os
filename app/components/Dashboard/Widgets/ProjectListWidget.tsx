import React from 'react';
import ProjectList from '../../Projects/ProjectList';
import { Project, Client, Todo } from '../../../types';
import { Briefcase } from 'lucide-react';

interface ProjectListWidgetProps {
    projects: Project[];
    selectedClient: Client | null;
    onSelectProject: (project: Project) => void;
    onTaskClick?: (task: Todo) => void;
}

export default function ProjectListWidget({ projects, selectedClient, onSelectProject, onTaskClick }: ProjectListWidgetProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <Briefcase size={18} />
                    </div>
                    <h3 className="font-black text-gray-900 text-sm tracking-tight uppercase">Aktive Projekte</h3>
                </div>
                <span className="bg-gray-900 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-sm">
                    {projects.length}
                </span>
            </div>
            <ProjectList
                projects={projects}
                selectedClient={selectedClient}
                onSelectProject={onSelectProject}
                showOpenTodos={projects.length <= 5} // Show todos if only few projects
                onTaskClick={onTaskClick}
            />
        </div>
    );
}
