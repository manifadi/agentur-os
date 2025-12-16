'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import ResourcePlanner from '../components/ResourcePlanner/ResourcePlanner';

export default function RessourcenPage() {
    const { employees, projects, currentUser } = useApp();

    return (
        <div className="p-4 md:p-8 h-full">
            <ResourcePlanner
                employees={employees}
                projects={projects}
                currentUser={currentUser}
            />
        </div>
    );
}
