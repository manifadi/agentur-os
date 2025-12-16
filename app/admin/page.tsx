'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import LoginScreen from '../components/LoginScreen';
import SuperAdminDashboard from '../components/SuperAdmin/SuperAdminDashboard';

export default function AdminPage() {
    const { session, employees } = useApp();

    if (!session) return <LoginScreen />;

    // Security Check: Is this the Super Admin?
    // For now, we can hardcode an email or check a role.
    // Let's assume the user with email 'admin@agentur-os.com' (or similar) is super admin.
    // OR we check existing employee role.

    // TEMPORARY: Allow all for dev testing if NO super admin exists? 
    // Or just check if user is 'admin'.

    const currentUser = employees.find(e => e.email === session.user.email);
    const isSuperAdmin = currentUser?.role === 'admin'; // Or a specific permissions table

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Kein Zugriff</h1>
                    <p className="text-gray-500">Du hast keine Berechtigung für diesen Bereich.</p>
                </div>
            </div>
        );
    }

    return <SuperAdminDashboard />;
}
