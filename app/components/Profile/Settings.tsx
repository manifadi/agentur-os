import React, { useState, useEffect } from 'react';
import { User, Bell, Moon, Smartphone, Mail, Lock, Settings as SettingsIconLucide, Shield, Building2 } from 'lucide-react';
import { Employee, Department } from '../../types';
import { supabase } from '../../supabaseClient';
import AdminUserManagement from './AdminUserManagement';
import AdminProjectList from './AdminProjectList';
import AdminClientManagement from './AdminClientManagement';
import AdminRateManagement from './AdminRateManagement';
import AdminAgencySettings from './AdminAgencySettings';
import { useApp } from '../../context/AppContext';

interface SettingsProps {
    session: any;
    employees: Employee[];
    departments: Department[];
    onUpdate: () => void;
}

export default function Settings({ session, employees, departments, onUpdate }: SettingsProps) {
    const { projects, clients } = useApp(); // Get global projects and clients
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'admin' | 'projects' | 'clients' | 'rates' | 'agency'>('profile');

    // Form State
    const [name, setName] = useState('');
    const [initials, setInitials] = useState('');
    const [deptId, setDeptId] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Effect to auto-select if session matches
    useEffect(() => {
        if (session?.user?.email && employees.length > 0) {
            const found = employees.find(e => e.email === session.user.email);
            if (found) {
                setCurrentUser(found);
                setName(found.name);
                setInitials(found.initials);
                setDeptId(found.department_id || '');
                setJobTitle(found.job_title || '');
                setEmail(found.email || '');
                setPhone(found.phone || '');
            }
        }
    }, [employees, session]);

    const handleSave = async () => {
        if (!currentUser) return;
        setLoading(true);
        await supabase.from('employees').update({
            name,
            initials: initials.toUpperCase(),
            department_id: deptId || null,
            job_title: jobTitle,
            email: email || null,
            phone: phone || null
        }).eq('id', currentUser.id);
        onUpdate();
        setLoading(false);
        alert("Einstellungen gespeichert!");
    };

    const handleLinkAccount = async () => {
        if (!currentUser || !session?.user?.email) return;
        if (confirm(`Möchtest du dieses Profil (${currentUser.name}) mit deinem Login (${session.user.email}) verknüpfen?`)) {
            setEmail(session.user.email);
            await supabase.from('employees').update({ email: session.user.email }).eq('id', currentUser.id);
            onUpdate();
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-10 p-6">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-3"><SettingsHeaderIcon size={32} /> Einstellungen</h1>

            <div className="flex gap-4 mb-8 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`pb-3 px-1 text-sm font-medium transition relative ${activeTab === 'profile' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    Mein Profil
                </button>

                {currentUser && currentUser.role === 'admin' && (
                    <>
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`pb-3 px-1 text-sm font-medium transition relative flex items-center gap-2 ${activeTab === 'admin' ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-purple-600'}`}
                        >
                            <Shield size={14} /> Team Verwaltung
                        </button>
                        <button
                            onClick={() => setActiveTab('projects')}
                            className={`pb-3 px-1 text-sm font-medium transition relative flex items-center gap-2 ${activeTab === 'projects' ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-purple-600'}`}
                        >
                            <SettingsIconLucide size={14} /> Alle Projekte
                        </button>
                        <button
                            onClick={() => setActiveTab('clients')}
                            className={`pb-3 px-1 text-sm font-medium transition relative flex items-center gap-2 ${activeTab === 'clients' ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-purple-600'}`}
                        >
                            <Building2 size={14} /> Kunden
                        </button>
                        <button
                            onClick={() => setActiveTab('rates')}
                            className={`pb-3 px-1 text-sm font-medium transition relative flex items-center gap-2 ${activeTab === 'rates' ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-purple-600'}`}
                        >
                            <SettingsIconLucide size={14} /> Stundensätze
                        </button>
                        <button
                            onClick={() => setActiveTab('agency')}
                            className={`pb-3 px-1 text-sm font-medium transition relative flex items-center gap-2 ${activeTab === 'agency' ? 'text-purple-700 border-b-2 border-purple-600' : 'text-gray-500 hover:text-purple-600'}`}
                        >
                            <Building2 size={14} /> Unternehmen
                        </button>
                    </>
                )}
            </div>

            {activeTab === 'profile' ? (
                // ... content ... 

                <>
                    <p className="text-gray-500 mb-8">Verwalte dein Profil und deine App-Einstellungen.</p>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* LEFT COLUMN: IDENTITY */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* PROFILE CARD */}
                            <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><User size={20} className="text-gray-400" /> Profil Details</h2>

                                {/* Identity Selector */}
                                <div className="mb-6 bg-gray-50 p-4 rounded-xl">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Wer bist du?</label>
                                    <select
                                        className="w-full p-2 border border-gray-200 rounded-xl bg-white"
                                        onChange={(e) => {
                                            const emp = employees.find(ep => ep.id === e.target.value);
                                            if (emp) {
                                                setCurrentUser(emp);
                                                setName(emp.name);
                                                setInitials(emp.initials);
                                                setDeptId(emp.department_id || '');
                                                setJobTitle(emp.job_title || '');
                                                setEmail(emp.email || '');
                                                setPhone(emp.phone || '');
                                            }
                                        }}
                                        value={currentUser?.id || ''}
                                    >
                                        {employees?.length > 0 ? (
                                            employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.email ? '✅' : ''}</option>)
                                        ) : (
                                            <option disabled>Keine Mitarbeiter gefunden</option>
                                        )}
                                    </select>
                                    <p className="text-xs text-gray-400 mt-2">Wähle deinen Namen aus der Liste, um deine Daten zu bearbeiten.</p>
                                </div>

                                {currentUser && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Anzeigename</label>
                                                <input type="text" className="w-full p-2 border border-gray-200 rounded-xl font-medium" value={name} onChange={(e) => setName(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Kürzel (2 Zeichen)</label>
                                                <input type="text" maxLength={2} className="w-full p-2 border border-gray-200 rounded-xl font-medium uppercase" value={initials} onChange={(e) => setInitials(e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Telefon (für Verträge)</label>
                                            <input type="text" className="w-full p-2 border border-gray-200 rounded-xl font-medium" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+43 660 ..." />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Job Titel (Position)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className="w-full p-2 border border-blue-100 bg-blue-50/50 text-gray-700 rounded-xl font-medium cursor-not-allowed"
                                                    value={jobTitle || 'Keine Position zugewiesen'}
                                                    disabled
                                                />
                                                <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300" />
                                            </div>
                                            <p className="text-xs text-blue-400 mt-1 italic">
                                                Die Position kann nur durch die Team-Verwaltung geändert werden.
                                            </p>
                                            <div className="text-xs text-gray-400 mt-1">Wird aus den Agentur-Positionen geladen.</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Abteilung / Rolle</label>
                                            <select className="w-full p-2 border border-gray-200 rounded-xl" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                                                <option value="">Keine Abteilung</option>
                                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="pt-4 flex justify-end">
                                            <button onClick={handleSave} disabled={loading} className="bg-gray-900 text-white px-6 py-2 rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition">Speichern</button>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* ACCOUNT LINKING */}
                            {currentUser && (
                                <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Lock size={20} className="text-gray-400" /> Account Verknüpfung</h2>
                                    <div className={`p-4 rounded-xl flex items-center justify-between ${currentUser.email === session?.user?.email ? 'bg-green-50 text-green-900 border border-green-100' : 'bg-orange-50 text-orange-900 border border-orange-100'}`}>
                                        <div className="text-sm">
                                            {currentUser.email === session?.user?.email ? (
                                                <span><span className="font-bold">Verknüpft:</span> Du bist als <u>{currentUser.name}</u> eingeloggt.</span>
                                            ) : (
                                                <span>
                                                    <span className="font-bold">Nicht verknüpft.</span><br />
                                                    Dein Login: {session?.user?.email}<br />
                                                    Profil Email: {currentUser.email || 'Keine'}
                                                </span>
                                            )}
                                        </div>
                                        {currentUser.email !== session?.user?.email && (
                                            <button onClick={handleLinkAccount} className="text-xs bg-white border border-gray-300 px-3 py-2 rounded-xl shadow-sm hover:bg-gray-50 font-bold">
                                                Jetzt verknüpfen
                                            </button>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* RIGHT COLUMN: PREFERENCES */}
                        <div className="space-y-6">
                            {/* APPEARANCE */}
                            <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm opacity-60 pointer-events-none relative overflow-hidden">
                                <div className="absolute inset-0 bg-gray-50/50 z-10 flex items-center justify-center font-bold text-gray-400 text-xs rotate-12 transform border-gray-200 border-2 rounded-xl m-4 bg-white/80 uppercase tracking-widest">Coming Soon</div>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Moon size={20} className="text-gray-400" /> Darstellung</h2>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Dark Mode</span>
                                        <div className="w-10 h-6 bg-gray-200 rounded-full"></div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Kompakte Ansicht</span>
                                        <div className="w-10 h-6 bg-gray-200 rounded-full"></div>
                                    </div>
                                </div>
                            </section>

                            {/* NOTIFICATIONS */}
                            <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm opacity-60 pointer-events-none relative overflow-hidden">
                                <div className="absolute inset-0 bg-gray-50/50 z-10 flex items-center justify-center font-bold text-gray-400 text-xs rotate-12 transform border-gray-200 border-2 rounded-xl m-4 bg-white/80 uppercase tracking-widest">Coming Soon</div>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Bell size={20} className="text-gray-400" /> Benachrichtigungen</h2>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Mail size={16} className="text-gray-400" />
                                        <span className="text-sm text-gray-600 flex-1">Email Zusammenfassung</span>
                                        <input type="checkbox" disabled checked className="rounded text-gray-900 focus:ring-gray-900 border-gray-300" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Smartphone size={16} className="text-gray-400" />
                                        <span className="text-sm text-gray-600 flex-1">Push Nachrichten</span>
                                        <input type="checkbox" disabled className="rounded text-gray-900 focus:ring-gray-900 border-gray-300" />
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </>
            ) : activeTab === 'projects' && currentUser?.role === 'admin' ? (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h2 className="text-lg font-bold mb-4">Alle Projekte (Admin Übersicht)</h2>
                    {/* We can reuse DashboardView here, but we need to mock/pass props. 
                        DashboardView needs: projects, clients, employees, stats, onSelectProject, etc. 
                        We don't have all stats computed here easily unless we computed them.
                        Maybe just a simple table is better? Or simplified DashboardView?
                        Let's try to import DashboardView components or ProjectList.
                        Actually, let's keep it simple: A list of all projects with filter.
                    */}
                    <AdminProjectList projects={projects} clients={clients} />
                    {/* <p>Projekte werden geladen...</p> REMOVED */}
                </div>
            ) : activeTab === 'clients' && currentUser?.role === 'admin' ? (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <AdminClientManagement clients={clients} onUpdate={onUpdate} />
                </div>
            ) : activeTab === 'rates' && currentUser?.role === 'admin' ? (
                <AdminRateManagement />
            ) : activeTab === 'agency' && currentUser?.role === 'admin' ? (
                <AdminAgencySettings />
            ) : currentUser ? (
                <AdminUserManagement
                    employees={employees}
                    departments={departments}
                    currentEmployee={currentUser}
                    onUpdate={onUpdate}
                />
            ) : null}
        </div>
    );
}

// Icon wrapper for header
const SettingsHeaderIcon = ({ size }: { size: number }) => <SettingsIconLucide size={size} />;
