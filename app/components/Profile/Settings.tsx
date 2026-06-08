'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    User, Palette, Building2, Users, Banknote, Image as ImageIcon,
    FileText, Lock, Camera, CalendarDays, SidebarOpen, Network, Languages
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Employee, Department } from '../../types';
import { supabase } from '../../supabaseClient';
import { setStoredLocale } from '../../i18n/I18nProvider';
import { Locale } from '../../i18n/config';
import AdminUserManagement from './AdminUserManagement';
import AdminDepartmentManagement from './AdminDepartmentManagement';
import AdminRateManagement from './AdminRateManagement';
import AdminAgencySettings from './AdminAgencySettings';
import AppearanceSettings from './AppearanceSettings';
import CalendarConnectionsSettings from './CalendarConnectionsSettings';
import NavigationSettings from './NavigationSettings';
import UserAvatar from '../UI/UserAvatar';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';

type Section = 'profil' | 'design' | 'kalender' | 'navigation' | 'unternehmen' | 'team' | 'abteilungen' | 'stundensaetze' | 'branding' | 'vorlagen';

const INPUT = 'input-field';

// labelKey → i18n-Schlüssel (settings.*); via t(...) gerendert.
const NAV: { groupKey: string; adminOnly: boolean; items: { id: Section; labelKey: string; icon: React.ElementType }[] }[] = [
    {
        groupKey: 'settings.groupMe',
        adminOnly: false,
        items: [
            { id: 'profil', labelKey: 'settings.profile', icon: User },
            { id: 'design', labelKey: 'settings.appearance', icon: Palette },
            { id: 'navigation', labelKey: 'settings.navigation', icon: SidebarOpen },
            { id: 'kalender', labelKey: 'settings.calendar', icon: CalendarDays },
        ],
    },
    {
        groupKey: 'settings.groupAgency',
        adminOnly: true,
        items: [
            { id: 'unternehmen', labelKey: 'settings.company', icon: Building2 },
            { id: 'team', labelKey: 'settings.team', icon: Users },
            { id: 'abteilungen', labelKey: 'settings.departments', icon: Network },
            { id: 'stundensaetze', labelKey: 'settings.rates', icon: Banknote },
            { id: 'branding', labelKey: 'settings.branding', icon: ImageIcon },
            { id: 'vorlagen', labelKey: 'settings.templates', icon: FileText },
        ],
    },
];

interface Props {
    session: any;
    employees: Employee[];
    departments: Department[];
    onUpdate: () => void;
}

const VALID_SECTIONS: Section[] = ['profil', 'design', 'kalender', 'navigation', 'unternehmen', 'team', 'abteilungen', 'stundensaetze', 'branding', 'vorlagen'];

export default function Settings({ session, employees, departments, onUpdate }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t, i18n } = useTranslation();

    // Section aus URL-Param lesen — erlaubt Deep-Linking wie /einstellungen?section=navigation
    const paramSection = searchParams?.get('section') as Section | null;
    const initialSection: Section = paramSection && VALID_SECTIONS.includes(paramSection) ? paramSection : 'profil';

    const [section, setSectionState] = useState<Section>(initialSection);
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    const currentUser = employees.find(e => e.email === session?.user?.email) ?? null;
    const isAdmin = currentUser?.role === 'admin';

    // URL → State (z.B. wenn der User über einen externen Link mit ?section=… kommt)
    useEffect(() => {
        if (paramSection && VALID_SECTIONS.includes(paramSection) && paramSection !== section) {
            setSectionState(paramSection);
        }
    }, [paramSection]);

    // State → URL (Sidebar-Klick aktualisiert URL ohne Page-Reload)
    const setSection = (next: Section) => {
        setSectionState(next);
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('section', next);
        router.replace(`/einstellungen?${params.toString()}`, { scroll: false });
    };

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

    const currentLocale: Locale = i18n.language?.startsWith('en') ? 'en' : 'de';
    const handleSetLocale = async (loc: Locale) => {
        if (loc === currentLocale) return;
        setStoredLocale(loc);                 // i18n + localStorage sofort
        if (currentUser) {
            await supabase.from('employees').update({ locale: loc }).eq('id', currentUser.id);
        }
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
                {NAV.map(({ groupKey, adminOnly, items }) => {
                    if (adminOnly && !isAdmin) return null;
                    return (
                        <div key={groupKey}>
                            <p
                                className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {t(groupKey)}
                            </p>
                            <div className="space-y-0.5">
                                {items.map(({ id, labelKey, icon: Icon }) => {
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
                                            {t(labelKey)}
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
                                title={t('settings.profile')}
                                subtitle={t('settings.profileSubtitle')}
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
                                            {isAdmin ? t('settings.admin') : t('settings.employee')}
                                        </span>
                                    </div>
                                </div>
                            </Card>

                            {/* Form */}
                            <Card>
                                <Label>{t('settings.personalData')}</Label>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <Field label={t('settings.name')}>
                                        <input className={INPUT} value={name} onChange={e => setName(e.target.value)} />
                                    </Field>
                                    <Field label={t('settings.initials')}>
                                        <input className={INPUT + ' uppercase'} value={initials} onChange={e => setInitials(e.target.value)} maxLength={2} />
                                    </Field>
                                    <Field label={t('settings.phone')}>
                                        <input className={INPUT} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+43 660 ..." />
                                    </Field>
                                    <Field label={t('settings.department')}>
                                        <select className={INPUT} value={deptId} onChange={e => setDeptId(e.target.value)}>
                                            <option value="">{t('settings.noDepartment')}</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </Field>
                                </div>
                                <div className="flex justify-end pt-5">
                                    <SaveButton onClick={handleSaveProfile} loading={loading} saved={saved} />
                                </div>
                            </Card>

                            {/* Sprache / Language */}
                            <Card>
                                <p className="text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1.5 text-text-muted">
                                    <Languages size={12} /> {t('settings.language')}
                                </p>
                                <p className="text-xs mb-3 text-text-muted">{t('settings.languageSubtitle')}</p>
                                <div className="inline-flex p-1 rounded-xl gap-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                    {([['de', t('settings.languageGerman')], ['en', t('settings.languageEnglish')]] as [Locale, string][]).map(([loc, label]) => {
                                        const active = currentLocale === loc;
                                        return (
                                            <button
                                                key={loc}
                                                onClick={() => handleSetLocale(loc)}
                                                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                                                style={active
                                                    ? { background: 'var(--accent)', color: 'var(--accent-text)' }
                                                    : { color: 'var(--text-secondary)' }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Card>

                            {/* Account Status */}
                            <Card>
                                <p className="text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5 text-text-muted">
                                    <Lock size={12} /> {t('settings.account')}
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

                    {/* ── ABTEILUNGEN ── */}
                    {section === 'abteilungen' && isAdmin && currentUser && (
                        <div className="max-w-2xl space-y-5">
                            <SectionHeader
                                title="Abteilungen"
                                subtitle="Lege Abteilungen an, denen du Mitarbeiter im Team-Bereich zuordnen kannst."
                            />
                            <AdminDepartmentManagement
                                departments={departments}
                                organizationId={currentUser.organization_id || ''}
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
    const { t } = useTranslation();
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="btn-primary"
            style={saved ? { background: '#22c55e', color: '#fff', boxShadow: 'none' } : undefined}
        >
            {saved ? t('common.saved') : t('common.save')}
        </button>
    );
}
