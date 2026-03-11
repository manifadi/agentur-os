import React from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { TimeEntry } from '../../types';

interface TimeStreamProps {
    entries: TimeEntry[];
    onEdit: (entry: TimeEntry) => void;
    onDelete: (id: string) => void;
}

export default function TimeStream({ entries, onEdit, onDelete }: TimeStreamProps) {
    if (entries.length === 0) {
        return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-subtle rounded-full flex items-center justify-center mb-4 text-text-muted">
                <span className="text-2xl">😴</span>
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-1">Noch keine Zeit erfasst</h3>
            <p className="text-text-secondary text-sm">Starte den Tag und erfasse deine erste Aufgabe.</p>
        </div>
        );
    }

    // Group by Project
    const grouped = entries.reduce((acc, entry) => {
        const pId = entry.project_id;
        if (!acc[pId]) acc[pId] = [];
        acc[pId].push(entry);
        return acc;
    }, {} as Record<string, TimeEntry[]>);

    return (
        <div className="space-y-6">
            {Object.entries(grouped).map(([projectId, projectEntries]) => {
                const project = projectEntries[0].projects;
                const totalProjectHours = projectEntries.reduce((sum, e) => sum + Number(e.hours), 0);

                return (
                    <div key={projectId} className="bg-surface rounded-2xl border border-default shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Project Header */}
                        <div className="px-6 py-4 bg-subtle border-b border-default flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-text-primary">{project?.title || 'Unbekanntes Projekt'}</h3>
                                <p className="text-xs text-text-muted uppercase tracking-wider">{project?.job_number} • {project?.clients?.name}</p>
                            </div>
                            <div className="text-sm font-bold text-text-primary bg-surface px-3 py-1 rounded-lg border border-default shadow-sm">
                                {totalProjectHours.toLocaleString('de-DE')} h
                            </div>
                        </div>

                        {/* Entries List */}
                        <div className="divide-y divide-default">
                            {projectEntries.map(entry => (
                                <div key={entry.id} className="p-4 hover:bg-hover transition-colors group flex items-start gap-4">
                                    <div className="flex-1">
                                        <p className="text-text-primary text-sm">{entry.description || 'Keine Beschreibung'}</p>
                                        <div className="flex gap-2 mt-1">
                                            {entry.positions && (
                                                <span className="text-xs bg-accent-subtle/30 text-accent px-2 py-0.5 rounded border border-accent/20">
                                                    {entry.positions.title}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono font-medium text-text-secondary">{Number(entry.hours).toLocaleString('de-DE')} h</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEdit(entry)} className="p-1.5 hover:bg-surface hover:shadow-sm rounded text-text-muted hover:text-accent transition-all"><Edit2 size={14} /></button>
                                            <button onClick={() => onDelete(entry.id)} className="p-1.5 hover:bg-surface hover:shadow-sm rounded text-text-muted hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
