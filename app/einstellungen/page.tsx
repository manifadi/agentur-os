'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import Settings from '../components/Profile/Settings';

export default function EinstellungenPage() {
    const { session, employees, departments, fetchData } = useApp();

    return (
        <div className="h-full">
            <Settings
                session={session}
                employees={employees}
                departments={departments}
                onUpdate={fetchData}
            />
        </div>
    );
}
