import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, Calendar, User, Image as ImageIcon, Plus, Globe, Lock, Trash2, Layout, Edit2, Check } from 'lucide-react';
import { Todo, Employee, Project } from '../../types';
import { supabase } from '../../supabaseClient';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import ConfirmModal from '../Modals/ConfirmModal';

interface TaskDetailSidebarProps {
    task: Todo;
    employees: Employee[];
    projects: Project[];
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<Todo>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onTaskClick?: (task: Todo) => void;
}

export default function TaskDetailSidebar({ task, employees, projects, onClose, onUpdate, onDelete, onTaskClick }: TaskDetailSidebarProps) {
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [deadline, setDeadline] = useState(task.deadline || '');
    const [assigneeId, setAssigneeId] = useState(task.assigned_to || '');
    const [projectId, setProjectId] = useState(task.project_id);
    const [imageUrls, setImageUrls] = useState<string[]>(task.image_urls || []);
    const [subtasks, setSubtasks] = useState<Todo[]>([]);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string, title: string }[]>([]);
    const [loadingSubtasks, setLoadingSubtasks] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [pendingCompletions, setPendingCompletions] = useState<Record<string, NodeJS.Timeout>>({});
    const [subtaskToDelete, setSubtaskToDelete] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            Object.values(pendingCompletions).forEach(clearTimeout);
        };
    }, [pendingCompletions]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTitle(task.title);
        setDescription(task.description || '');
        setDeadline(task.deadline || '');
        setAssigneeId(task.assigned_to || '');
        setProjectId(task.project_id);
        setImageUrls(task.image_urls || []);
        fetchSubtasks();
        fetchBreadcrumbs();
    }, [task]);

    const fetchBreadcrumbs = async () => {
        let currentParentId = task.parent_id;
        const crumbs: { id: string, title: string }[] = [];

        while (currentParentId) {
            const { data } = await supabase
                .from('todos')
                .select('id, title, parent_id')
                .eq('id', currentParentId)
                .single();

            if (data) {
                crumbs.unshift({ id: data.id, title: data.title });
                currentParentId = data.parent_id;
            } else {
                break;
            }
        }
        setBreadcrumbs(crumbs);
    };

    const fetchSubtasks = async () => {
        setLoadingSubtasks(true);
        const { data, error } = await supabase
            .from('todos')
            .select(`*, employees(id, initials, name)`)
            .eq('parent_id', task.id)
            .order('created_at', { ascending: true });

        if (data) setSubtasks(data as any);
        setLoadingSubtasks(false);
    };

    const handleUpdate = async (updates: Partial<Todo>) => {
        setIsSaving(true);
        await onUpdate(task.id, updates);
        setIsSaving(false);
    };

    const handleUpload = async (files: FileList) => {
        setUploading(true);
        const newUrls = [...imageUrls];
        for (let i = 0; i < files.length; i++) {
            try {
                const url = await uploadFileToSupabase(files[i], 'documents');
                newUrls.push(url);
            } catch (e) {
                console.error(e);
            }
        }
        setImageUrls(newUrls);
        await handleUpdate({ image_urls: newUrls });
        setUploading(false);
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length > 0) {
            setUploading(true);
            const newUrls = [...imageUrls];
            for (const file of files) {
                try {
                    const url = await uploadFileToSupabase(file, 'documents');
                    newUrls.push(url);
                } catch (err) {
                    console.error(err);
                }
            }
            setImageUrls(newUrls);
            await handleUpdate({ image_urls: newUrls });
            setUploading(false);
        }
    };

    const handleAddSubtask = async () => {
        const { data, error } = await supabase.from('todos').insert([{
            project_id: task.project_id || null,
            organization_id: task.organization_id,
            parent_id: task.id,
            title: 'Neue Unteraufgabe',
            is_done: false
        }]).select(`*, employees(id, initials, name)`);

        if (data) {
            setSubtasks([...subtasks, data[0] as any]);
        }
    };

    const handleDeleteSubtask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSubtaskToDelete(id);
    };

    const confirmDeleteSubtask = async () => {
        if (!subtaskToDelete) return;
        await supabase.from('todos').delete().eq('id', subtaskToDelete);
        setSubtasks(prev => prev.filter(t => t.id !== subtaskToDelete));
        setSubtaskToDelete(null);
    };

    const handleToggleSubtaskWithDelay = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentStatus) {
            if (pendingCompletions[id]) return;
            setSubtasks(prev => prev.map(t => t.id === id ? { ...t, is_done: true } : t));
            const timeout = setTimeout(async () => {
                await supabase.from('todos').update({ is_done: true }).eq('id', id);
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            }, 3000);
            setPendingCompletions(prev => ({ ...prev, [id]: timeout }));
        } else {
            if (pendingCompletions[id]) {
                clearTimeout(pendingCompletions[id]);
                setSubtasks(prev => prev.map(t => t.id === id ? { ...t, is_done: false } : t));
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            } else {
                setSubtasks(prev => prev.map(t => t.id === id ? { ...t, is_done: false } : t));
                await supabase.from('todos').update({ is_done: false }).eq('id', id);
            }
        }
    };

    const handleToggleMainTaskWithDelay = async () => {
        const currentIsDone = task.is_done || !!pendingCompletions[task.id];
        if (!currentIsDone) {
            if (pendingCompletions[task.id]) return;
            // Optimistically show done in UI
            const timeout = setTimeout(async () => {
                await onUpdate(task.id, { is_done: true });
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[task.id];
                    return next;
                });
            }, 3000);
            setPendingCompletions(prev => ({ ...prev, [task.id]: timeout }));
        } else {
            if (pendingCompletions[task.id]) {
                clearTimeout(pendingCompletions[task.id]);
                setPendingCompletions(prev => {
                    const next = { ...prev };
                    delete next[task.id];
                    return next;
                });
            } else {
                await onUpdate(task.id, { is_done: false });
            }
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/5 z-[55] animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-50">
                    <button
                        onClick={handleToggleMainTaskWithDelay}
                        className={`group/check flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition duration-200 ${task.is_done || pendingCompletions[task.id] ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'}`}
                    >
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${task.is_done || pendingCompletions[task.id] ? 'bg-white/20 border-white/40' : 'border-gray-200 group-hover/check:border-blue-400'}`}>
                            <Check size={12} className={`transition-opacity ${task.is_done || pendingCompletions[task.id] ? 'opacity-100' : 'opacity-0'}`} />
                        </div>
                        {task.is_done || pendingCompletions[task.id] ? 'Erledigt' : 'Als erledigt markieren'}
                    </button>
                    <div className="flex items-center gap-2">
                        <button onClick={() => onDelete(task.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
                    {/* Breadcrumbs & Title */}
                    <div className="space-y-2">
                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider overflow-hidden">
                            <span className="truncate max-w-[150px]">
                                {projectId ? (projects.find(p => p.id === projectId)?.title || 'Unbekanntes Projekt') : 'Persönliche Aufgaben'}
                            </span>
                            {breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={crumb.id}>
                                    <span>/</span>
                                    <button
                                        onClick={async () => {
                                            const { data } = await supabase.from('todos').select(`*, employees(id, initials, name)`).eq('id', crumb.id).single();
                                            if (data) onTaskClick?.(data as any);
                                        }}
                                        className="truncate max-w-[120px] hover:text-blue-600 transition"
                                    >
                                        {crumb.title}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        <textarea
                            className="w-full text-2xl font-bold border-none focus:ring-0 p-0 placeholder-gray-300 bg-transparent resize-none leading-tight"
                            placeholder="Aufgabentitel..."
                            rows={1}
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            onBlur={() => title !== task.title && handleUpdate({ title })}
                            onFocus={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            ref={(el) => {
                                if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = el.scrollHeight + 'px';
                                }
                            }}
                        />
                    </div>

                    {/* Metadata */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 items-center">
                            <div className="text-sm text-gray-500 flex items-center gap-2"><User size={16} /> Verantwortlich</div>
                            <div className="col-span-2">
                                <select
                                    className="w-full p-2 border-none rounded-xl text-sm hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                                    value={assigneeId}
                                    onChange={(e) => {
                                        setAssigneeId(e.target.value);
                                        handleUpdate({ assigned_to: e.target.value || null });
                                    }}
                                >
                                    <option value="">Niemand</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 items-center">
                            <div className="text-sm text-gray-500 flex items-center gap-2"><Calendar size={16} /> Fälligkeit</div>
                            <div className="col-span-2">
                                <input
                                    type="date"
                                    className="w-full p-2 border-none rounded-xl text-sm hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                                    value={deadline}
                                    onChange={(e) => {
                                        setDeadline(e.target.value);
                                        handleUpdate({ deadline: e.target.value || null });
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 items-center">
                            <div className="text-sm text-gray-500 flex items-center gap-2"><Layout size={16} /> Projekt</div>
                            <div className="col-span-2 px-2 py-1.5 text-sm font-medium text-gray-700">
                                {projectId ? (projects.find(p => p.id === projectId)?.title || 'Unbekanntes Projekt') : 'Persönlich'}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Beschreibung</label>
                        <div
                            className="relative group p-4 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-gray-50/50 transition duration-200"
                            onPaste={handlePaste}
                        >
                            <textarea
                                className="w-full min-h-[120px] bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-700 placeholder-gray-400 resize-none"
                                placeholder="Hier klicken, um Details hinzuzufügen..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onBlur={() => description !== task.description && handleUpdate({ description })}
                            />

                            <div className="mt-4 flex flex-wrap gap-2">
                                {imageUrls.map((url, i) => (
                                    <div key={i} className="relative w-20 h-20 group/img">
                                        <img src={url} className="w-full h-full object-cover rounded-xl border border-gray-200" />
                                        <button
                                            onClick={() => {
                                                const updated = imageUrls.filter((_, idx) => idx !== i);
                                                setImageUrls(updated);
                                                handleUpdate({ image_urls: updated });
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-xl p-0.5 opacity-0 group-hover/img:opacity-100 transition shadow-sm"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                {uploading && (
                                    <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-xl animate-pulse">
                                        <ImageIcon size={20} className="text-gray-400" />
                                    </div>
                                )}
                            </div>

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 text-gray-400 hover:text-gray-900 bg-white rounded-xl shadow-sm border border-gray-100 transition"
                                    title="Bilder anhängen"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={(e) => e.target.files && handleUpload(e.target.files)} />
                        <p className="text-[10px] text-gray-400 italic">Tipp: Bilder können auch direkt mit Strg+V eingefügt werden.</p>
                    </div>

                    {/* Subtasks */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Unteraufgaben</label>
                            <button onClick={handleAddSubtask} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                                <Plus size={12} /> Hinzufügen
                            </button>
                        </div>

                        <div className="space-y-2">
                            {subtasks.map(subtask => (
                                <div
                                    key={subtask.id}
                                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl group/sub transition cursor-pointer"
                                    onClick={() => onTaskClick?.(subtask)}
                                >
                                    <button
                                        onClick={(e) => handleToggleSubtaskWithDelay(subtask.id, subtask.is_done || !!pendingCompletions[subtask.id], e)}
                                        className={`w-5 h-5 rounded-full border-2 transform active:scale-95 transition-all duration-200 flex items-center justify-center flex-shrink-0 group/check_sub ${subtask.is_done || pendingCompletions[subtask.id] ? 'bg-blue-500 border-blue-500' : 'border-gray-200 hover:border-blue-500'}`}
                                    >
                                        <Check size={10} className={`text-white transition-opacity ${subtask.is_done || pendingCompletions[subtask.id] ? 'opacity-100' : 'opacity-0 stroke-[3px]'}`} />
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        {editingSubtaskId === subtask.id ? (
                                            <input
                                                type="text"
                                                className={`w-full bg-white border border-blue-200 rounded px-1 text-sm focus:ring-1 focus:ring-blue-500 p-0 ${subtask.is_done ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                                                value={subtask.title}
                                                autoFocus
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    const newSub = [...subtasks];
                                                    const idx = newSub.findIndex(t => t.id === subtask.id);
                                                    newSub[idx].title = e.target.value;
                                                    setSubtasks(newSub);
                                                }}
                                                onBlur={async () => {
                                                    await supabase.from('todos').update({ title: subtask.title }).eq('id', subtask.id);
                                                    setEditingSubtaskId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') e.currentTarget.blur();
                                                }}
                                            />
                                        ) : (
                                            <span className={`text-sm truncate block ${subtask.is_done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                {subtask.title}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSubtaskId(subtask.id);
                                            }}
                                            className="p-1 text-gray-400 hover:text-blue-500 transition"
                                            title="Bearbeiten"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteSubtask(subtask.id, e)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition"
                                            title="Löschen"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        {subtask.employees && (
                                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold ml-1">
                                                {subtask.employees.initials}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {subtasks.length === 0 && !loadingSubtasks && (
                                <div className="text-sm text-gray-400 italic pl-2">Noch keine Unteraufgaben vorhanden.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer / Status indication */}
                <div className="p-4 border-t border-gray-50 bg-gray-50/30 flex justify-between items-center">
                    <span className="text-[10px] text-gray-400">Automatische Speicherung erfolgt beim Verlassen der Felder.</span>
                    {isSaving && <div className="text-[10px] text-blue-500 font-bold animate-pulse">Wird gespeichert...</div>}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!subtaskToDelete}
                title="Unteraufgabe löschen?"
                message="Möchtest du diese Unteraufgabe wirklich dauerhaft löschen?"
                onConfirm={confirmDeleteSubtask}
                onCancel={() => setSubtaskToDelete(null)}
                type="danger"
                confirmText="Löschen"
                cancelText="Abbrechen"
            />
        </>
    );
}
