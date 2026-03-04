'use client';
import React from 'react';
import { useApp } from '../context/AppContext';
import CalendarPage from '../components/Calendar/CalendarPage';

export default function KalenderPage() {
    const { employees, currentUser, session } = useApp();
    return <CalendarPage employees={employees} currentUser={currentUser} />;
}
