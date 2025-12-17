'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import GlobalTasks from '../components/Tasks/GlobalTasks';

export default function AufgabenPage() {
    const { projects, employees, fetchData, currentUser } = useApp();
    const router = useRouter();

    return (
        <div className="p-4 md:p-8 h-full">
            <GlobalTasks
                projects={projects}
                employees={employees}
                onSelectProject={(p) => router.push(`/uebersicht?projectId=${p.id}`)}
                onUpdate={fetchData}
                currentUser={currentUser}
            />
        </div>
    );
}
