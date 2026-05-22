'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import LoginScreen from '../components/LoginScreen';
import AdminSidebar from '../components/SuperAdmin/AdminSidebar';
import { SuperAdminProvider, useSuperAdmin } from '../components/SuperAdmin/SuperAdminContext';
import { AlertTriangle } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { session, currentUser, handleLogout, loading } = useApp();

    if (!session) return <LoginScreen />;

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-sm font-medium"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-app)' }}>
                Lade Super Admin…
            </div>
        );
    }

    if (!currentUser?.is_super_admin) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6"
                style={{ background: 'var(--bg-app)' }}>
                <div className="max-w-md w-full rounded-2xl p-6 text-center"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}>
                    <div className="w-12 h-12 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--color-danger-subtle)', color: 'var(--color-danger-text)' }}>
                        <AlertTriangle size={20} />
                    </div>
                    <h1 className="ds-title mb-1">Kein Zugriff</h1>
                    <p className="ds-callout mb-5">
                        Du hast keine Super-Admin-Berechtigung. Dieser Bereich ist ausschließlich für die System-Verwaltung.
                    </p>
                    <a href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm active:scale-[0.98]"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                        Zurück zur App
                    </a>
                </div>
            </div>
        );
    }

    return (
        <SuperAdminProvider enabled={true}>
            <AdminShell onLogout={handleLogout} userEmail={session?.user?.email}>
                {children}
            </AdminShell>
        </SuperAdminProvider>
    );
}

function AdminShell({ onLogout, userEmail, children }: {
    onLogout: () => void;
    userEmail?: string;
    children: React.ReactNode;
}) {
    const { requests } = useSuperAdmin();

    return (
        <div className="flex min-h-screen w-full" style={{ background: 'var(--bg-app)' }}>
            <AdminSidebar
                pendingRequests={requests.length}
                onLogout={onLogout}
                userEmail={userEmail}
            />
            <main className="flex-1 pl-64 min-w-0">
                <div className="max-w-7xl mx-auto p-8">{children}</div>
            </main>
        </div>
    );
}
