import React from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { Project, Client, Todo } from '../../types';
import { getStatusDot, getDeadlineColorClass } from '../../utils';
import ClientLogo from '../UI/ClientLogo';
import UserAvatar from '../UI/UserAvatar';

interface ProjectListProps {
    projects: Project[];
    selectedClient: Client | null;
    onSelectProject: (project: Project) => void;
    showOpenTodos: boolean;
    onTaskClick?: (task: Todo) => void;
    onCreateProject?: () => void;
}

export default function ProjectList({ projects, selectedClient, onSelectProject, showOpenTodos, onTaskClick, onCreateProject }: ProjectListProps) {
    return (
        <div className="bg-card rounded-2xl shadow-sm border border-border-subtle overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                    <tr className="border-b border-border-subtle">
                        <th className="py-3 px-5 ds-caption w-28">Job Nr</th>
                        <th className="py-3 px-5 ds-caption">Projekt</th>
                        <th className="py-3 px-5 ds-caption">PM</th>
                        <th className="py-3 px-5 ds-caption">Status</th>
                        <th className="py-3 px-5 ds-caption text-right">Deadline</th>
                        <th className="w-12"></th>
                    </tr>
                </thead>
                <tbody>
                    {projects.map((project) => (
                        <React.Fragment key={project.id}>
                            <tr
                                onClick={() => onSelectProject(project)}
                                className="ds-table-row group"
                            >
                                <td className="py-4 px-5 text-[13px] text-text-muted font-mono align-top">
                                    {project.job_number}
                                </td>

                                <td className="py-4 px-5 align-top">
                                    <div className="flex items-center gap-3">
                                        {!selectedClient && (
                                            <ClientLogo src={project.clients?.logo_url} name={project.clients?.name} size={28} />
                                        )}
                                        <span className="text-[14px] font-semibold text-text-primary leading-snug">{project.title}</span>
                                    </div>

                                    {showOpenTodos && project.openTodosPreview && project.openTodosPreview.length > 0 && (
                                        <div className="mt-2.5 space-y-1" style={{ marginLeft: selectedClient ? '0' : '40px' }}>
                                            {project.openTodosPreview.map(t => (
                                                <div
                                                    key={t.id}
                                                    className="flex items-center gap-2 text-[12px] text-text-muted hover:text-accent transition-colors cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); onTaskClick?.(t); }}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                                    {t.title}
                                                    <span className="text-text-placeholder">({t.employees?.initials || '—'})</span>
                                                </div>
                                            ))}
                                            {project.totalTodos && project.doneTodos !== undefined && (project.totalTodos - project.doneTodos > 3) && (
                                                <div className="text-[11px] text-text-placeholder pl-3.5">
                                                    +{project.totalTodos - project.doneTodos - 3} weitere
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>

                                <td className="py-4 px-5 align-top">
                                    <UserAvatar
                                        src={project.employees?.avatar_url}
                                        name={project.employees?.name}
                                        initials={project.employees?.initials}
                                        size="sm"
                                    />
                                </td>

                                <td className="py-4 px-5 align-top">
                                    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-text-secondary">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(project.status)}`} />
                                        {project.status}
                                    </span>
                                </td>

                                <td className={`py-4 px-5 text-[13px] font-medium text-right align-top tabular-nums ${getDeadlineColorClass(project.deadline)}`}>
                                    {project.deadline}
                                </td>

                                <td className="py-4 pr-4 align-top">
                                    <ChevronRight
                                        size={15}
                                        className="text-text-placeholder opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-auto"
                                    />
                                </td>
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>

            {projects.length === 0 && (
                <div className="py-16 flex flex-col items-center gap-4 text-center px-6">
                    <div className="w-16 h-16 rounded-2xl bg-subtle border border-default flex items-center justify-center">
                        <FolderOpen size={24} className="text-text-placeholder" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-text-primary mb-1">Keine Projekte</p>
                        <p className="text-xs text-text-muted max-w-xs">
                            {selectedClient ? `Noch keine Projekte für diesen Kunden.` : 'Lege dein erstes Projekt an, um loszulegen.'}
                        </p>
                    </div>
                    {onCreateProject && (
                        <button
                            onClick={onCreateProject}
                            className="px-4 py-2 bg-accent text-surface text-xs font-bold rounded-xl hover:opacity-90 transition shadow-sm"
                        >
                            Erstes Projekt anlegen
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
