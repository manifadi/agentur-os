'use client';
import React from 'react';
import { useApp } from '../context/AppContext';
import ReportingPage from '../components/Reporting/ReportingPage';
import { usePageTitle } from '../hooks/usePageTitle';

export default function ReportingRoute() {
    const { currentUser } = useApp();
    usePageTitle('Reporting');
    if (!currentUser) return (
        <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>Lade…</div>
    );
    return <ReportingPage currentUser={currentUser} />;
}
