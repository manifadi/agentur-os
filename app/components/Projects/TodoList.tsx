import React, { useState } from 'react';
import { CheckCircle2, Pencil, Trash2, X, Plus } from 'lucide-react';
import { Todo, Employee } from '../../types';

interface TodoListProps {
    todos: Todo[];
    employees: Employee[];
    onAdd: (title: string, assigneeId: string | null) => Promise<void>;
    onToggle: (id: string, currentStatus: boolean) => Promise<void>;
    onUpdate: (id: string, title: string, assigneeId: string | null) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export default function TodoList({ todos, employees, onAdd, onToggle, onUpdate, onDelete }: TodoListProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newAssignee, setNewAssignee] = useState('');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editAssignee, setEditAssignee] = useState('');

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        await onAdd(newTitle, newAssignee || null);
        setNewTitle('');
        setIsAdding(false);
    };

    const startEditing = (todo: Todo) => {
        setEditingId(todo.id);
        setEditTitle(todo.title);
        setEditAssignee(todo.assigned_to || '');
    };

    const handleSaveEdit = async (id: string) => {
        if (!editTitle.trim()) return;
        await onUpdate(id, editTitle, editAssignee || null);
        setEditingId(null);
    };

    return (
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[300px]">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><CheckCircle2 size={20} className="text-gray-400" /> Aufgaben</h2>
            <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                {todos.map((todo) => (
                    <div key={todo.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 group transition">
                        {editingId === todo.id ? (
                            <div className="flex flex-1 items-center gap-2 flex-wrap">
                                <input autoFocus type="text" className="flex-1 min-w-[120px] bg-gray-50 rounded border-none text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                <select className="w-24 bg-gray-50 rounded border-none text-xs px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}>
                                    <option value="">Niemand</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                                <div className="flex gap-1">
                                    <button onClick={() => handleSaveEdit(todo.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><CheckCircle2 size={16} /></button>
                                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={16} /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => onToggle(todo.id, todo.is_done)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${todo.is_done ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}>
                                        {todo.is_done && <CheckCircle2 size={12} className="text-white" />}
                                    </button>
                                    <span className={`text-sm transition-all ${todo.is_done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{todo.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {todo.employees && <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold shrink-0" title={todo.employees.name}>{todo.employees.initials}</div>}
                                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                        <button onClick={() => startEditing(todo)} className="p-1 text-gray-300 hover:text-blue-500"><Pencil size={12} /></button>
                                        <button onClick={() => onDelete(todo.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {isAdding ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg animate-in fade-in slide-in-from-top-1 flex-wrap">
                        <input autoFocus type="text" placeholder="Aufgabe..." className="flex-1 min-w-[120px] bg-transparent border-none text-sm focus:ring-0 p-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                        <select className="w-24 bg-transparent border-none text-xs text-gray-500 focus:ring-0 cursor-pointer" value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
                            <option value="">Niemand</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <div className="flex gap-1">
                            <button onClick={handleCreate} className="text-blue-600 hover:bg-blue-100 p-1 rounded"><Plus size={16} /></button>
                            <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:bg-gray-200 p-1 rounded"><X size={16} /></button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 mt-4 pl-1 transition"><Plus size={14} /> Neue Aufgabe</button>
                )}
            </div>
        </div>
    );
}
