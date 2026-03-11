import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Trash2, Calendar, GripVertical } from 'lucide-react';
import { Todo, Employee } from '../../types';
import UserAvatar from '../UI/UserAvatar';

interface SortableTodoItemProps {
    todo: Todo;
    employees: Employee[];
    isDoneEffective: boolean;
    subtaskCount: number;
    isHighlighted: boolean;
    onToggle: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onTaskClick: () => void;
}

export function SortableTodoItem({
    todo,
    employees,
    isDoneEffective,
    subtaskCount,
    isHighlighted,
    onToggle,
    onDelete,
    onTaskClick
}: SortableTodoItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: todo.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between p-3 rounded-xl hover:bg-hover group transition ${isHighlighted ? 'animate-highlight bg-accent/30' : ''} ${isDragging ? 'shadow-lg bg-surface rotate-1' : ''}`}
        >
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="p-1 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <GripVertical size={14} />
                </div>

                <div
                    className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer group/item"
                    onClick={onTaskClick}
                >
                    <button
                        onClick={onToggle}
                        className={`w-6 h-6 rounded-full border-2 transform active:scale-95 transition-all duration-200 flex items-center justify-center flex-shrink-0 group/check ${isDoneEffective ? 'bg-accent border-accent' : 'border-default hover:border-accent hover:bg-accent/10'}`}
                    >
                        <Check size={12} className={`text-surface transition-opacity ${isDoneEffective ? 'opacity-100' : 'opacity-0 stroke-[3px]'}`} />
                    </button>
                    <div className="flex flex-col truncate">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <span className={`text-sm transition-all truncate ${isDoneEffective ? 'text-text-muted line-through' : 'text-text-primary group-hover/item:text-accent'}`}>
                                {todo.title}
                            </span>
                            {subtaskCount > 0 && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-subtle text-[10px] font-bold text-text-secondary min-w-[18px] text-center">
                                    {subtaskCount}
                                </span>
                            )}
                        </div>
                        {todo.deadline && (
                            <div className={`flex items-center gap-1 text-[10px] ${new Date(todo.deadline) < new Date() && !todo.is_done ? 'text-red-500 font-medium' : 'text-text-muted'}`}>
                                <Calendar size={10} />
                                <span>{new Date(todo.deadline).toLocaleDateString('de-DE')}</span>
                            </div>
                        )}
                    </div>
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
                    <button onClick={onDelete} className="p-1 text-text-muted hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
