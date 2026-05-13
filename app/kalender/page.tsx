'use client';
import React from 'react';
import { useApp } from '../context/AppContext';
import CalendarPage from '../components/Calendar/CalendarPage';
import { usePageTitle } from '../hooks/usePageTitle';

export default function KalenderPage() {
    const { employees, currentUser, session } = useApp();
    usePageTitle('Kalender');
    return <CalendarPage employees={employees} currentUser={currentUser} />;
}
