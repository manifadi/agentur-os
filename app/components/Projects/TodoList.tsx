import React, { useState } from 'react';
import { CheckCircle2, Pencil, Trash2, X, Plus, Calendar, Check } from 'lucide-react';
import { Todo, Employee } from '../../types';
import UserAvatar from '../UI/UserAvatar';

interface TodoListProps {
    todos: Todo[];
    employees: Employee[];
    onAdd: (title: string, assigneeId: string | null, deadline: string | null) => Promise<void>;
    onToggle: (id: string, currentStatus: boolean) => Promise<void>;
    onUpdate: (id: string, title: string, assigneeId: string | null, deadline: string | null) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onTaskClick?: (task: Todo) => void;
}

export default function TodoList({ todos, employees, onAdd, onToggle, onUpdate, onDelete, onTaskClick }: TodoListProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newDeadline, setNewDeadline] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editAssignee, setEditAssignee] = useState('');
    const [editDeadline, setEditDeadline] = useState('');


    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        await onAdd(newTitle, newAssignee || null, newDeadline || null);
        setNewTitle('');
        setNewDeadline('');
        setIsAdding(false);
    };

    const startEditing = (todo: Todo) => {
        setEditingId(todo.id);
        setEditTitle(todo.title);
        setEditAssignee(todo.assigned_to || '');
        setEditDeadline(todo.deadline || '');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editTitle.trim()) return;
        await onUpdate(id, editTitle, editAssignee || null, editDeadline || null);
        setEditingId(null);
    };

    // [FIX] Use Ref for timeouts
    const pendingTimeouts = React.useRef<Record<string, NodeJS.Timeout>>({});
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

    // [FIX] Cleanup: Execute pending on unmount
    React.useEffect(() => {
        return () => {
            Object.entries(pendingTimeouts.current).forEach(([id, timeout]) => {
                clearTimeout(timeout);
                onToggle(id, false); // Force complete (assuming false = currently not done)
            });
            pendingTimeouts.current = {};
        };
    }, []);

    const handleToggleWithDelay = async (todoId: string, currentIsDone: boolean) => {
        if (!currentIsDone) {
            if (pendingTimeouts.current[todoId]) return;

            // Optimistic UI
            setPendingIds(prev => {
                const newSet = new Set(prev);
                newSet.add(todoId);
                return newSet;
            });

            const timeout = setTimeout(async () => {
                await onToggle(todoId, false); // Toggle to done

                delete pendingTimeouts.current[todoId];
                setPendingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(todoId);
                    return newSet;
                });
            }, 3000);

            pendingTimeouts.current[todoId] = timeout;
        } else {
            if (pendingTimeouts.current[todoId]) {
                clearTimeout(pendingTimeouts.current[todoId]);
                delete pendingTimeouts.current[todoId];

                setPendingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(todoId);
                    return newSet;
                });
            } else {
                await onToggle(todoId, true); // Toggle back to active
            }
        }
    };

    return (
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[300px]">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><CheckCircle2 size={20} className="text-gray-400" /> Aufgaben</h2>
            <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                {todos.filter(t => !t.parent_id || pendingIds.has(t.id)).map((todo) => {
                    const isPending = pendingIds.has(todo.id);
                    const isDoneEffective = todo.is_done || isPending;
                    const subtaskCount = todos.filter(t => t.parent_id === todo.id).length;

                    return (
                        <div key={todo.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 group transition">
                            {editingId === todo.id ? (
                                <div className="flex flex-1 items-center gap-2 flex-wrap">
                                    <input autoFocus type="text" className="flex-1 min-w-[120px] bg-gray-50 rounded-xl border-none text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                    <input type="date" className="bg-gray-50 rounded-xl border-none text-xs px-2 py-1 focus:ring-1 focus:ring-blue-500 w-auto" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                                    <select className="w-24 bg-gray-50 rounded-xl border-none text-xs px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}>
                                        <option value="">Niemand</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleSaveEdit(todo.id)} className="p-1 text-green-600 hover:bg-green-50 rounded-xl"><CheckCircle2 size={16} /></button>
                                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={16} /></button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div
                                        className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer group/item"
                                        onClick={() => onTaskClick?.(todo)}
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleWithDelay(todo.id, todo.is_done || pendingIds.has(todo.id)); }}
                                            className={`w-6 h-6 rounded-full border-2 transform active:scale-95 transition-all duration-200 flex items-center justify-center flex-shrink-0 group/check ${isDoneEffective ? 'bg-blue-500 border-blue-500' : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50/10'}`}
                                        >
                                            <Check size={12} className={`text-white transition-opacity ${isDoneEffective ? 'opacity-100' : 'opacity-0 stroke-[3px]'}`} />
                                        </button>
                                        <div className="flex flex-col truncate">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className={`text-sm transition-all truncate ${isDoneEffective ? 'text-gray-400 line-through' : 'text-gray-700 group-hover/item:text-blue-600'}`}>
                                                    {todo.title}
                                                </span>
                                                {subtaskCount > 0 && (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-gray-500 min-w-[18px] text-center">
                                                        {subtaskCount}
                                                    </span>
                                                )}
                                            </div>
                                            {todo.deadline && (
                                                <div className={`flex items-center gap-1 text-[10px] ${new Date(todo.deadline) < new Date() && !todo.is_done ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                                    <Calendar size={10} />
                                                    <span>{new Date(todo.deadline).toLocaleDateString('de-DE')}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {todo.employees && (
                                            <UserAvatar
                                                src={todo.employees.avatar_url}
                                                name={todo.employees.name}
                                                initials={todo.employees.initials}
                                                size="xs"
                                            />
                                        )}
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
                {isAdding ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl animate-in fade-in slide-in-from-top-1 flex-wrap">
                        <input autoFocus type="text" placeholder="Aufgabe..." className="flex-1 min-w-[120px] bg-transparent border-none text-sm focus:ring-0 p-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                        <input type="date" className="bg-transparent border-none text-xs text-gray-500 focus:ring-0 p-1 w-auto" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
                        <select className="w-24 bg-transparent border-none text-xs text-gray-500 focus:ring-0 cursor-pointer" value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
                            <option value="">Niemand</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <div className="flex gap-1">
                            <button onClick={handleCreate} className="text-blue-600 hover:bg-blue-100 p-1 rounded-xl"><Plus size={16} /></button>
                            <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:bg-gray-200 p-1 rounded-xl"><X size={16} /></button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 mt-4 pl-1 transition"><Plus size={14} /> Neue Aufgabe</button>
                )}
            </div>
        </div>
    );
}
