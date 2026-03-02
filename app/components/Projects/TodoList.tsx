import React, { useState, useMemo } from 'react';
import { CheckCircle2, Pencil, Trash2, X, Plus, Calendar, Check, GripVertical } from 'lucide-react';
import { Todo, Employee } from '../../types';
import UserAvatar from '../UI/UserAvatar';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableTodoItem } from './SortableTodoItem';
import { supabase } from '../../supabaseClient';

interface TodoListProps {
    todos: Todo[];
    employees: Employee[];
    onAdd: (title: string, assigneeId: string | null, deadline: string | null, orderIndex: number) => Promise<void>;
    onToggle: (id: string, currentStatus: boolean) => Promise<void>;
    onUpdate: (id: string, title: string, assigneeId: string | null, deadline: string | null) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onTaskClick?: (task: Todo) => void;
    highlightId?: string | null;
}

export default function TodoList({ todos, employees, onAdd, onToggle, onUpdate, onDelete, onTaskClick, highlightId }: TodoListProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newAssignee, setNewAssignee] = useState('');
    const [newDeadline, setNewDeadline] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editAssignee, setEditAssignee] = useState('');
    const [editDeadline, setEditDeadline] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const sortedTodos = useMemo(() => {
        return [...todos].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }, [todos]);

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        const maxOrder = Math.max(0, ...todos.map(t => t.order_index || 0));
        await onAdd(newTitle, newAssignee || null, newDeadline || null, maxOrder + 1);
        setNewTitle('');
        setNewDeadline('');
        setIsAdding(false);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = sortedTodos.findIndex((t) => t.id === active.id);
        const newIndex = sortedTodos.findIndex((t) => t.id === over.id);

        const newSorted = arrayMove(sortedTodos, oldIndex, newIndex);

        // Update order_index in database for all affected tasks
        // For simplicity and robustness, we update all visible tasks' indices
        const updates = newSorted.map((t, index) => ({
            id: t.id,
            order_index: index + 1
        }));

        for (const update of updates) {
            await supabase.from('todos').update({ order_index: update.order_index }).eq('id', update.id);
        }
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

    const pendingTimeouts = React.useRef<Record<string, NodeJS.Timeout>>({});
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

    React.useEffect(() => {
        return () => {
            Object.entries(pendingTimeouts.current).forEach(([id, timeout]) => {
                clearTimeout(timeout);
                onToggle(id, false);
            });
            pendingTimeouts.current = {};
        };
    }, []);

    const handleToggleWithDelay = async (todoId: string, currentIsDone: boolean) => {
        if (!currentIsDone) {
            if (pendingTimeouts.current[todoId]) return;
            setPendingIds(prev => {
                const newSet = new Set(prev);
                newSet.add(todoId);
                return newSet;
            });
            const timeout = setTimeout(async () => {
                await onToggle(todoId, false);
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
                await onToggle(todoId, true);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreate();
        }
    };

    return (
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[300px]">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><CheckCircle2 size={20} className="text-gray-400" /> Aufgaben</h2>
            <div className="overflow-y-auto pr-2 px-2 py-1 space-y-3 flex-1 custom-scrollbar">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sortedTodos.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {sortedTodos.filter(t => !t.parent_id || pendingIds.has(t.id)).map((todo) => {
                            const isPending = pendingIds.has(todo.id);
                            const isDoneEffective = todo.is_done || isPending;
                            const subtaskCount = todos.filter(t => t.parent_id === todo.id).length;
                            const isHighlighted = highlightId === todo.id;

                            if (editingId === todo.id) {
                                return (
                                    <div key={todo.id} className="flex flex-1 items-center gap-2 flex-wrap p-3 bg-blue-50/30 rounded-xl">
                                        <input autoFocus type="text" className="flex-1 min-w-[120px] bg-white rounded-xl border-none text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(todo.id)} />
                                        <input type="date" className="bg-white rounded-xl border-none text-xs px-2 py-1 focus:ring-1 focus:ring-blue-500 w-auto" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(todo.id)} />
                                        <select className="w-24 bg-white rounded-xl border-none text-xs px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(todo.id)}>
                                            <option value="">Niemand</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleSaveEdit(todo.id)} className="p-1 text-green-600 hover:bg-green-50 rounded-xl"><Check size={16} /></button>
                                            <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={16} /></button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <SortableTodoItem
                                    key={todo.id}
                                    todo={todo}
                                    employees={employees}
                                    isDoneEffective={isDoneEffective}
                                    subtaskCount={subtaskCount}
                                    isHighlighted={isHighlighted}
                                    onToggle={(e) => { e.stopPropagation(); handleToggleWithDelay(todo.id, todo.is_done || pendingIds.has(todo.id)); }}
                                    onDelete={(e) => { e.stopPropagation(); onDelete(todo.id); }}
                                    onTaskClick={() => onTaskClick?.(todo)}
                                />
                            );
                        })}
                    </SortableContext>
                </DndContext>

                {isAdding ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl animate-in fade-in slide-in-from-top-1 flex-wrap">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Aufgabe..."
                            className="flex-1 min-w-[120px] bg-transparent border-none text-sm focus:ring-0 p-1"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <input
                            type="date"
                            className="bg-transparent border-none text-xs text-gray-500 focus:ring-0 p-1 w-auto"
                            value={newDeadline}
                            onChange={(e) => setNewDeadline(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <select
                            className="w-24 bg-transparent border-none text-xs text-gray-500 focus:ring-0 cursor-pointer"
                            value={newAssignee}
                            onChange={(e) => setNewAssignee(e.target.value)}
                            onKeyDown={handleKeyDown}
                        >
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
