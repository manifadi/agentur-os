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
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">😴</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Noch keine Zeit erfasst</h3>
                <p className="text-gray-500 text-sm">Starte den Tag und erfasse deine erste Aufgabe.</p>
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
                    <div key={projectId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Project Header */}
                        <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-900">{project?.title || 'Unbekanntes Projekt'}</h3>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">{project?.job_number} • {project?.clients?.name}</p>
                            </div>
                            <div className="text-sm font-bold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">
                                {totalProjectHours.toLocaleString('de-DE')} h
                            </div>
                        </div>

                        {/* Entries List */}
                        <div className="divide-y divide-gray-50">
                            {projectEntries.map(entry => (
                                <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors group flex items-start gap-4">
                                    <div className="flex-1">
                                        <p className="text-gray-900 text-sm">{entry.description || 'Keine Beschreibung'}</p>
                                        <div className="flex gap-2 mt-1">
                                            {entry.positions && (
                                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                                                    {entry.positions.title}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono font-medium text-gray-600">{Number(entry.hours).toLocaleString('de-DE')} h</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onEdit(entry)} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-400 hover:text-blue-600 transition-all"><Edit2 size={14} /></button>
                                            <button onClick={() => onDelete(entry.id)} className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-400 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
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
