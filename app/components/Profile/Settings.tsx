'use client';

import React, { useState, useEffect } from 'react';
import {
    User, Palette, Building2, Users, Banknote, Image as ImageIcon,
    FileText, Lock, Camera, CalendarDays, SidebarOpen
} from 'lucide-react';
import { Employee, Department } from '../../types';
import { supabase } from '../../supabaseClient';
import AdminUserManagement from './AdminUserManagement';
import AdminRateManagement from './AdminRateManagement';
import AdminAgencySettings from './AdminAgencySettings';
import AppearanceSettings from './AppearanceSettings';
import CalendarConnectionsSettings from './CalendarConnectionsSettings';
import NavigationSettings from './NavigationSettings';
import UserAvatar from '../UI/UserAvatar';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';

type Section = 'profil' | 'design' | 'kalender' | 'navigation' | 'unternehmen' | 'team' | 'stundensaetze' | 'branding' | 'vorlagen';

const INPUT = 'w-full px-3 py-2.5 border border-border-strong rounded-xl bg-subtle text-text-primary placeholder:text-text-placeholder focus:bg-surface focus:ring-2 focus:ring-accent outline-none text-sm transition';

const NAV: { group: string; adminOnly: boolean; items: { id: Section; label: string; icon: React.ElementType }[] }[] = [
    {
        group: 'Ich',
        adminOnly: false,
        items: [
            { id: 'profil', label: 'Profil', icon: User },
            { id: 'design', label: 'Design & Thema', icon: Palette },
            { id: 'navigation', label: 'Navigation', icon: SidebarOpen },
            { id: 'kalender', label: 'Kalender', icon: CalendarDays },
        ],
    },
    {
        group: 'Agentur',
        adminOnly: true,
        items: [
            { id: 'unternehmen', label: 'Unternehmen', icon: Building2 },
            { id: 'team', label: 'Team', icon: Users },
            { id: 'stundensaetze', label: 'Stundensätze', icon: Banknote },
            { id: 'branding', label: 'Branding', icon: ImageIcon },
            { id: 'vorlagen', label: 'Vorlagen', icon: FileText },
        ],
    },
];

interface Props {
    session: any;
    employees: Employee[];
    departments: Department[];
    onUpdate: () => void;
}

export default function Settings({ session, employees, departments, onUpdate }: Props) {
    const [section, setSection] = useState<Section>('profil');
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    const currentUser = employees.find(e => e.email === session?.user?.email) ?? null;
    const isAdmin = currentUser?.role === 'admin';

    const [name, setName] = useState('');
    const [initials, setInitials] = useState('');
    const [phone, setPhone] = useState('');
    const [deptId, setDeptId] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (currentUser) {
            setName(currentUser.name);
            setInitials(currentUser.initials);
            setPhone(currentUser.phone || '');
            setDeptId(currentUser.department_id || '');
            setAvatarUrl(currentUser.avatar_url || null);
        }
    }, [currentUser?.id]);

    const handleSaveProfile = async () => {
        if (!currentUser) return;
        setLoading(true);
        await supabase.from('employees').update({
            name,
            initials: initials.toUpperCase(),
            phone: phone || null,
            department_id: deptId || null,
        }).eq('id', currentUser.id);
        onUpdate();
        setLoading(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser) return;
        setLoading(true);
        try {
            const url = await uploadFileToSupabase(file, 'avatars');
            setAvatarUrl(url);
            await supabase.from('employees').update({ avatar_url: url }).eq('id', currentUser.id);
            onUpdate();
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="flex" style={{ minHeight: '100%' }}>

            {/* ── Sidebar ─────────────────────────────────── */}
            <aside
                className="w-52 shrink-0 py-8 px-3 space-y-6"
                style={{ borderRight: '1px solid var(--border-default)' }}
            >
                {NAV.map(({ group, adminOnly, items }) => {
                    if (adminOnly && !isAdmin) return null;
                    return (
                        <div key={group}>
                            <p
                                className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {group}
                            </p>
                            <div className="space-y-0.5">
                                {items.map(({ id, label, icon: Icon }) => {
                                    const active = section === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => setSection(id)}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${!active ? 'hover:bg-hover' : ''}`}
                                            style={{
                                                background: active ? 'var(--accent)' : 'transparent',
                                                color: active ? '#fff' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <Icon size={15} />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </aside>

            {/* ── Content ─────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto px-8 py-8">

                    {/* ── PROFIL ── */}
                    {section === 'profil' && (
                        <div className="max-w-xl space-y-5">
                            <SectionHeader
                                title="Profil"
                                subtitle="Deine persönlichen Daten und Account-Einstellungen."
                            />

                            {/* Avatar */}
                            <Card>
                                <div className="flex items-center gap-5">
                                    <div className="relative group shrink-0">
                                        <UserAvatar
                                            src={avatarUrl}
                                            name={name}
                                            initials={initials}
                                            size="xl"
                                            className="shadow-sm"
                                        />
                                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer">
                                            <Camera size={20} className="text-white" />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                        </label>
                                    </div>
                                    <div>
                                        <p className="font-bold text-text-primary">{name || '—'}</p>
                                        <p className="text-sm text-text-muted">{session?.user?.email}</p>
                                        {currentUser?.job_title && (
                                            <p className="text-xs text-text-muted mt-0.5">{currentUser.job_title}</p>
                                        )}
                                        <span
                                            className="inline-block mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                                            style={{
                                                background: isAdmin ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                                color: isAdmin ? 'var(--accent)' : 'var(--text-muted)',
                                            }}
                                        >
                                            {isAdmin ? 'Admin' : 'Mitarbeiter'}
                                        </span>
                                    </div>
                                </div>
                            </Card>

                            {/* Form */}
                            <Card>
                                <Label>Persönliche Daten</Label>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <Field label="Name">
                                        <input className={INPUT} value={name} onChange={e => setName(e.target.value)} />
                                    </Field>
                                    <Field label="Kürzel (2 Zeichen)">
                                        <input className={INPUT + ' uppercase'} value={initials} onChange={e => setInitials(e.target.value)} maxLength={2} />
                                    </Field>
                                    <Field label="Telefon">
                                        <input className={INPUT} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+43 660 ..." />
                                    </Field>
                                    <Field label="Abteilung">
                                        <select className={INPUT} value={deptId} onChange={e => setDeptId(e.target.value)}>
                                            <option value="">Keine Abteilung</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </Field>
                                </div>
                                <div className="flex justify-end pt-5">
                                    <SaveButton onClick={handleSaveProfile} loading={loading} saved={saved} />
                                </div>
                            </Card>

                            {/* Account Status */}
                            <Card>
                                <p className="text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5 text-text-muted">
                                    <Lock size={12} /> Account
                                </p>
                                <div
                                    className={`p-3 rounded-xl text-sm font-medium ${currentUser?.email === session?.user?.email
                                        ? 'bg-green-500/10 text-green-600'
                                        : 'bg-orange-500/10 text-orange-600'
                                        }`}
                                >
                                    {currentUser?.email === session?.user?.email
                                        ? `Eingeloggt als ${currentUser?.name} · ${session?.user?.email}`
                                        : `Login (${session?.user?.email}) stimmt nicht mit Profil-E-Mail überein.`}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* ── KALENDER ── */}
                    {section === 'kalender' && currentUser && (
                        <div className="max-w-2xl space-y-5">
                            <SectionHeader
                                title="Kalender-Verbindungen"
                                subtitle="Verbinde Google Kalender, Outlook, Troi oder Apple iCloud — jeder Nutzer verwaltet seine eigenen Verbindungen."
                            />
                            <Card>
                                <CalendarConnectionsSettings
                                    currentUser={currentUser}
                                    organizationId={(currentUser as any).organization_id}
                                />
                            </Card>
                        </div>
                    )}

                    {/* ── NAVIGATION ── */}
                    {section === 'navigation' && currentUser && (
                        <div className="max-w-2xl space-y-5">
                            <SectionHeader
                                title="Navigation"
                                subtitle="Welche Einträge in der Sidebar erscheinen und in welcher Reihenfolge."
                            />
                            <Card>
                                <NavigationSettings currentUser={currentUser} onUpdate={onUpdate} />
                            </Card>
                        </div>
                    )}

                    {/* ── DESIGN ── */}
                    {section === 'design' && (
                        <div className="max-w-xl space-y-5">
                            <SectionHeader
                                title="Design & Thema"
                                subtitle="Dark Mode, Schriftart und Akzentfarben — auf allen Geräten synchronisiert."
                            />
                            <AppearanceSettings />
                        </div>
                    )}

                    {/* ── UNTERNEHMEN ── */}
                    {section === 'unternehmen' && isAdmin && (
                        <div className="max-w-2xl space-y-5">
                            <SectionHeader
                                title="Unternehmen"
                                subtitle="Firmendaten für Angebote, Rechnungen und Verträge."
                            />
                            <AdminAgencySettings section="company" />
                        </div>
                    )}

                    {/* ── TEAM — volle Breite, da Tabelle ── */}
                    {section === 'team' && isAdmin && currentUser && (
                        <div className="space-y-5">
                            <SectionHeader
                                title="Team"
                                subtitle="Mitarbeiter verwalten, Rollen und Abteilungen zuweisen."
                            />
                            <AdminUserManagement
                                employees={employees}
                                departments={departments}
                                currentEmployee={currentUser}
                                onUpdate={onUpdate}
                            />
                        </div>
                    )}

                    {/* ── STUNDENSÄTZE — volle Breite ── */}
                    {section === 'stundensaetze' && isAdmin && (
                        <div className="space-y-5">
                            <SectionHeader
                                title="Stundensätze"
                                subtitle="Positionen und Stundensätze, die agenturweit für Kalkulation und Zeiterfassung verwendet werden."
                            />
                            <AdminRateManagement />
                        </div>
                    )}

                    {/* ── BRANDING ── */}
                    {section === 'branding' && isAdmin && (
                        <div className="max-w-xl space-y-5">
                            <SectionHeader
                                title="Branding"
                                subtitle="App-Logo und Dokumenten-Header für PDFs."
                            />
                            <AdminAgencySettings section="branding" />
                        </div>
                    )}

                    {/* ── VORLAGEN ── */}
                    {section === 'vorlagen' && isAdmin && (
                        <div className="max-w-3xl space-y-5">
                            <SectionHeader
                                title="Vorlagen"
                                subtitle="Textbausteine für Einleitung und Schluss von Angeboten und Verträgen."
                            />
                            <AdminAgencySettings section="templates" />
                        </div>
                    )}

            </main>
        </div>
    );
}

// ── Kleine Helper-Komponenten ─────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="pb-2">
            <h1 className="text-xl font-bold text-text-primary">{title}</h1>
            <p className="text-sm mt-1 text-text-muted">{subtitle}</p>
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
            {children}
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <p className="text-sm font-bold text-text-primary">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-text-muted">
                {label}
            </label>
            {children}
        </div>
    );
}

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-50"
            style={{
                background: saved ? '#22c55e' : 'var(--text-primary)',
                color: 'var(--bg-surface)',
            }}
        >
            {saved ? 'Gespeichert ✓' : 'Speichern'}
        </button>
    );
}
