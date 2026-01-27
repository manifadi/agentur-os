import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Project, Client, Todo } from '../../types';
import { getStatusStyle, getDeadlineColorClass } from '../../utils';

interface ProjectListProps {
    projects: Project[];
    selectedClient: Client | null;
    onSelectProject: (project: Project) => void;
    showOpenTodos: boolean;
    onTaskClick?: (task: Todo) => void;
}

export default function ProjectList({ projects, selectedClient, onSelectProject, showOpenTodos, onTaskClick }: ProjectListProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Job Nr</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Projekt Titel</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PM</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Deadline</th>
                        <th className="py-3 px-4 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {projects.map((project, index) => (
                        <React.Fragment key={project.id}>
                            <tr onClick={() => onSelectProject(project)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'} hover:bg-gray-100 transition group cursor-pointer`}>
                                <td className="py-3 px-4 text-sm text-gray-500 font-mono align-top">{project.job_number}</td>
                                <td className="py-3 px-4 text-sm font-medium text-gray-900 align-top">
                                    <div className="flex items-center gap-3">
                                        {!selectedClient && project.clients?.logo_url ? <div className="w-8 h-8 rounded-md bg-white border border-gray-100 flex items-center justify-center p-0.5 shrink-0 shadow-sm"><img src={project.clients.logo_url} className="w-full h-full object-contain" /></div> : !selectedClient && <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 shrink-0 font-bold">{project.clients?.name.substring(0, 2).toUpperCase()}</div>}
                                        <span>{project.title}</span>
                                    </div>
                                    {/* SHOW OPEN TODOS IF FILTER ACTIVE */}
                                    {showOpenTodos && project.openTodosPreview && project.openTodosPreview.length > 0 && (
                                        <div className="mt-3 ml-11 space-y-1">
                                            {project.openTodosPreview.map(t => (
                                                <div
                                                    key={t.id}
                                                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 transition"
                                                    onClick={(e) => { e.stopPropagation(); onTaskClick?.(t); }}
                                                >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                                    {t.title} <span className="text-gray-300">({t.employees?.initials || 'Unassigned'})</span>
                                                </div>
                                            ))}
                                            {project.totalTodos && project.doneTodos !== undefined && (project.totalTodos - project.doneTodos > 3) && <div className="text-[10px] text-gray-400 pl-3.5">...und {project.totalTodos - project.doneTodos - 3} weitere</div>}
                                        </div>
                                    )}
                                </td>
                                <td className="py-3 px-4 align-top"><div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold shrink-0" title={project.employees?.name}>{project.employees?.initials || '-'}</div></td>
                                <td className="py-3 px-4 align-top"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusStyle(project.status)}`}>{project.status}</span></td>
                                <td className={`py-3 px-4 text-sm text-right align-top ${getDeadlineColorClass(project.deadline)}`}>{project.deadline}</td>
                                <td className="py-3 px-4 text-gray-400 group-hover:text-gray-600 align-top"><ChevronRight size={16} /></td>
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
            {projects.length === 0 && <div className="p-12 text-center text-gray-400 text-sm">Keine Projekte gefunden.</div>}
        </div>
    );
}
