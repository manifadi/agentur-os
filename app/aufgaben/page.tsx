"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import GlobalTasks from '../components/Tasks/GlobalTasks';
import TaskDetailSidebar from '../components/Tasks/TaskDetailSidebar';
import { supabase } from '../supabaseClient';
import ConfirmModal from '../components/Modals/ConfirmModal';
import { Todo } from '../types';

export default function AufgabenPage() {
    const { projects, personalTodos, employees, fetchData, currentUser } = useApp();
    const router = useRouter();
    const [selectedTask, setSelectedTask] = useState<Todo | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

    const handleAddPersonal = async (title: string) => {
        if (!currentUser) return;
        await supabase.from('todos').insert({
            title,
            assigned_to: currentUser.id,
            organization_id: currentUser.organization_id,
            is_done: false
        });
        fetchData();
    };

    return (
        <div className="p-4 md:p-8 h-full relative">
            <GlobalTasks
                projects={projects}
                personalTodos={personalTodos}
                employees={employees}
                onSelectProject={(p) => router.push(`/uebersicht?projectId=${p.id}`)}
                onUpdate={fetchData}
                onAddPersonal={handleAddPersonal}
                currentUser={currentUser}
                onTaskClick={(t) => setSelectedTask(t)}
            />

            {selectedTask && (
                <TaskDetailSidebar
                    task={selectedTask}
                    employees={employees}
                    projects={projects}
                    onClose={() => setSelectedTask(null)}
                    onTaskClick={(t) => setSelectedTask(t)}
                    onUpdate={async (id, updates) => {
                        const { data } = await supabase.from('todos').update(updates).eq('id', id).select(`*, employees(id, initials, name)`);
                        if (data) {
                            setSelectedTask(data[0] as any);
                            fetchData();
                        }
                    }}
                    onDelete={async (id) => {
                        setTaskToDelete(id);
                    }}
                />
            )}

            <ConfirmModal
                isOpen={!!taskToDelete}
                title="Aufgabe löschen?"
                message="Möchtest du diese Aufgabe wirklich löschen?"
                onConfirm={async () => {
                    if (taskToDelete) {
                        await supabase.from('todos').delete().eq('id', taskToDelete);
                        fetchData();
                        setSelectedTask(null);
                        setTaskToDelete(null);
                    }
                }}
                onCancel={() => setTaskToDelete(null)}
                type="danger"
                confirmText="Löschen"
                cancelText="Abbrechen"
            />
        </div>
    );
}
