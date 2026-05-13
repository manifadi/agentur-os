'use client';
import React, { useState } from 'react';
import { X, Link, Chrome, Monitor, Apple, Building2, Eye, EyeOff, AlertCircle, Loader, Shield, Info } from 'lucide-react';
import { Employee, CalendarProviderType } from '../../types';
import { supabase } from '../../supabaseClient';

const COLORS = ['#3B82F6', '#7C3AED', '#F43F5E', '#10B981', '#F59E0B', '#06B6D4', '#64748B', '#0078D4', '#5059C9', '#7C3AED'];

const PROVIDER_DEFAULTS: Record<string, { color: string; placeholder: string; helpServer: string; helpPath: string; helpUser: string; helpPass: string }> = {
    troi: {
        color: '#7C3AED',
        placeholder: 'Troi',
        helpServer: 'https://app.troi.software',
        helpPath: 'Troi → Einstellungen → Konto → CalDAV-URL kopieren (z.B. /remote.php/dav/calendars/email/default/)',
        helpUser: 'Deine Troi E-Mail-Adresse',
        helpPass: 'Dein Troi-Passwort',
    },
    apple: {
        color: '#64748B',
        placeholder: 'iCloud Kalender',
        helpServer: 'https://caldav.icloud.com',
        helpPath: 'Wird automatisch ermittelt (leer lassen oder /)',
        helpUser: 'Deine Apple-ID (E-Mail)',
        helpPass: 'App-spezifisches Passwort von appleid.apple.com → Sicherheit → App-spezifische Passwörter',
    },
    custom: {
        color: '#06B6D4',
        placeholder: 'Mein Kalender',
        helpServer: 'https://dein-server.com',
        helpPath: '/remote.php/dav/calendars/username/calendar/',
        helpUser: 'Benutzername',
        helpPass: 'Passwort',
    },
};

type Tab = 'caldav' | 'google' | 'outlook' | 'ical';
type CalDavPreset = 'troi' | 'apple' | 'custom';

interface Props {
    currentUser: Employee;
    organizationId: string;
    onClose: () => void;
    onAdded: () => void;
}

export default function CalendarProviderModal({ currentUser, organizationId, onClose, onAdded }: Props) {
    const [tab, setTab] = useState<Tab>('caldav');
    const [preset, setPreset] = useState<CalDavPreset>('troi');

    // CalDAV fields
    const [name, setName] = useState('Troi');
    const [color, setColor] = useState('#7C3AED');
    const [serverUrl, setServerUrl] = useState('https://app.troi.software');
    const [calPath, setCalPath] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [useSSL, setUseSSL] = useState(true);

    // iCal URL fields
    const [icalName, setIcalName] = useState('');
    const [icalUrl, setIcalUrl] = useState('');
    const [icalColor, setIcalColor] = useState('#06B6D4');

    // OAuth fields
    const [oauthName, setOauthName] = useState('');
    const [oauthColor, setOauthColor] = useState('#3B82F6');

    // State
    const [connecting, setConnecting] = useState(false); // covers test + save together
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handlePresetChange = (p: CalDavPreset) => {
        setPreset(p);
        const d = PROVIDER_DEFAULTS[p];
        setColor(d.color);
        setServerUrl(d.helpServer);
        setCalPath('');
        setName(d.placeholder);
        setError('');
    };

    const buildCalDavUrl = () => {
        const base = serverUrl.replace(/\/$/, '');
        const path = calPath.startsWith('/') ? calPath : (calPath ? '/' + calPath : '');
        return base + path;
    };

    // Single action: test connection first, then save only if successful
    const handleTestAndConnect = async () => {
        if (!name.trim() || !serverUrl.trim() || !username.trim() || !password.trim()) {
            setError('Bitte alle Pflichtfelder ausfüllen');
            return;
        }
        setConnecting(true);
        setError('');

        let discoveredUrl = buildCalDavUrl() || serverUrl;

        try {
            const res = await fetch('/api/caldav/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: discoveredUrl, username, password }),
            });
            const data = await res.json();

            if (!data.success) {
                setError(data.error || 'Verbindung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
                setConnecting(false);
                return;
            }

            // Use server-discovered URL if returned (e.g. after .well-known redirect)
            if (data.discoveredUrl) discoveredUrl = data.discoveredUrl;
            if (data.calendarName && !name.trim()) setName(data.calendarName);
        } catch {
            setError('Netzwerkfehler — Server nicht erreichbar.');
            setConnecting(false);
            return;
        }

        // Connection verified — now save
        const providerType: CalendarProviderType = preset === 'troi' ? 'troi' : preset === 'apple' ? 'apple' : 'ical';

        const { error: dbErr } = await supabase.from('external_calendars').insert({
            organization_id: organizationId,
            employee_id: currentUser.id,
            name: name.trim(),
            url: discoveredUrl,
            color,
            is_visible: true,
            provider_type: providerType,
            is_writable: false,
            caldav_username: username.trim(),
            oauth_access_token: password,
        });

        setConnecting(false);
        if (dbErr) { setError(dbErr.message); return; }
        onAdded();
        onClose();
    };

    const handleSaveIcal = async () => {
        if (!icalName.trim() || !icalUrl.trim()) {
            setError('Name und URL sind erforderlich');
            return;
        }
        setSaving(true);
        await supabase.from('external_calendars').insert({
            organization_id: organizationId,
            employee_id: currentUser.id,
            name: icalName.trim(),
            url: icalUrl.trim(),
            color: icalColor,
            is_visible: true,
            provider_type: 'ical',
            is_writable: false,
        });
        setSaving(false);
        onAdded();
        onClose();
    };

    const handleConnectGoogle = () => {
        const params = new URLSearchParams({
            employeeId: currentUser.id,
            organizationId,
            name: oauthName || 'Google Kalender',
            color: oauthColor,
            returnUrl: '/kalender',
        });
        window.location.href = `/api/auth/google-calendar?${params}`;
    };

    const handleConnectMicrosoft = () => {
        const params = new URLSearchParams({
            employeeId: currentUser.id,
            organizationId,
            name: oauthName || 'Outlook',
            color: oauthColor,
            returnUrl: '/kalender',
        });
        window.location.href = `/api/auth/microsoft?${params}`;
    };

    const def = PROVIDER_DEFAULTS[preset];

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col relative" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', maxHeight: '92vh' }}>

                {/* Loading overlay — shown while testing+saving CalDAV connection */}
                {connecting && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl gap-3" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}>
                        <Loader size={28} className="animate-spin" style={{ color: '#fff' }} />
                        <p className="text-sm font-semibold text-white">Verbindung wird geprüft…</p>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Kalender verbinden</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    {([
                        { id: 'caldav', label: 'CalDAV', icon: <Shield size={13} />, sub: 'Troi, Apple, …' },
                        { id: 'google', label: 'Google', icon: <Chrome size={13} />, sub: 'OAuth' },
                        { id: 'outlook', label: 'Outlook', icon: <Monitor size={13} />, sub: 'Teams' },
                        { id: 'ical', label: 'iCal URL', icon: <Link size={13} />, sub: 'Lesezugriff' },
                    ] as { id: Tab; label: string; icon: React.ReactNode; sub: string }[]).map(t => (
                        <button key={t.id} onClick={() => { setTab(t.id); setError(''); }}
                            className="flex-1 flex flex-col items-center py-3 text-xs transition-all"
                            style={tab === t.id
                                ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)', background: 'var(--accent-subtle)' }
                                : { color: 'var(--text-muted)', borderBottom: '2px solid transparent' }
                            }
                        >
                            <span className="flex items-center gap-1 font-semibold">{t.icon}{t.label}</span>
                            <span className="text-[9px] opacity-70 mt-0.5">{t.sub}</span>
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* ── CalDAV Tab ── */}
                    {tab === 'caldav' && (
                        <>
                            {/* Preset selector */}
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { id: 'troi', label: 'Troi', icon: <Building2 size={16} /> },
                                    { id: 'apple', label: 'Apple / iCloud', icon: <Apple size={16} /> },
                                    { id: 'custom', label: 'Eigener Server', icon: <Shield size={16} /> },
                                ] as { id: CalDavPreset; label: string; icon: React.ReactNode }[]).map(p => (
                                    <button key={p.id} onClick={() => handlePresetChange(p.id)}
                                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all"
                                        style={preset === p.id
                                            ? { background: 'var(--accent-subtle)', borderColor: 'var(--accent)', color: 'var(--accent)' }
                                            : { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }
                                        }
                                    >
                                        {p.icon}
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Form */}
                            <FormRow label="Anzeigename *">
                                <input value={name} onChange={e => setName(e.target.value)} placeholder={def.placeholder}
                                    className="w-full p-2.5 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            </FormRow>

                            <FormRow label="Server-Adresse *">
                                <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder={def.helpServer}
                                    className="w-full p-2.5 rounded-xl text-xs outline-none font-mono"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            </FormRow>

                            <FormRow label="Kalenderpfad (optional)">
                                <input value={calPath} onChange={e => setCalPath(e.target.value)} placeholder="/remote.php/dav/calendars/user/default/"
                                    className="w-full p-2.5 rounded-xl text-xs outline-none font-mono"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{def.helpPath}</p>
                            </FormRow>

                            <div className="grid grid-cols-2 gap-3">
                                <FormRow label="Benutzername *">
                                    <input value={username} onChange={e => setUsername(e.target.value)} placeholder={def.helpUser}
                                        className="w-full p-2.5 rounded-xl text-xs outline-none"
                                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                </FormRow>
                                <FormRow label="Passwort *">
                                    <div className="relative">
                                        <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                                            className="w-full p-2.5 pr-8 rounded-xl text-xs outline-none"
                                            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                                        <button type="button" onClick={() => setShowPass(x => !x)} className="absolute right-2 top-2" style={{ color: 'var(--text-muted)' }}>
                                            {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                        </button>
                                    </div>
                                    {preset === 'apple' && (
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>App-spezifisches Passwort von <strong>appleid.apple.com</strong></p>
                                    )}
                                </FormRow>
                            </div>

                            {/* SSL + Color */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={useSSL} onChange={e => setUseSSL(e.target.checked)} />
                                        <div className="w-8 h-4 rounded-full transition-colors" style={{ background: useSSL ? 'var(--accent)' : 'var(--border-strong)' }} />
                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${useSSL ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>SSL verwenden</span>
                                </label>
                                <div className="flex gap-1.5">
                                    {COLORS.slice(0, 7).map(c => (
                                        <button key={c} onClick={() => setColor(c)} className="w-5 h-5 rounded-full transition-all"
                                            style={{ background: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Google Tab ── */}
                    {tab === 'google' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                <div className="flex items-center gap-2">
                                    <Info size={14} style={{ color: 'var(--accent)' }} />
                                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Wie funktioniert Google OAuth?</span>
                                </div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Jeder Nutzer klickt auf „Mit Google verbinden" und gibt Google-Berechtigungen für sein eigenes Konto. Die App benötigt einmalig eine Google OAuth-App-Registrierung (durch den Agentur OS Admin).
                                </p>
                            </div>

                            <FormRow label="Anzeigename">
                                <input value={oauthName} onChange={e => setOauthName(e.target.value)} placeholder="Google Kalender"
                                    className="w-full p-2.5 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            </FormRow>

                            <div className="flex gap-2">
                                {COLORS.map(c => (
                                    <button key={c} onClick={() => setOauthColor(c)} className="w-5 h-5 rounded-full"
                                        style={{ background: c, outline: oauthColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                                ))}
                            </div>

                            {!process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED && (
                                <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E' }}>
                                    <p className="font-bold">Setup erforderlich</p>
                                    <p>GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET müssen in .env.local gesetzt werden. Einmalig in der Google Cloud Console registrieren.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Outlook/Teams Tab ── */}
                    {tab === 'outlook' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                <div className="flex items-center gap-2">
                                    <Info size={14} style={{ color: '#0078D4' }} />
                                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Microsoft 365 / Teams</span>
                                </div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Jeder Nutzer verbindet sein eigenes Microsoft-Konto. Teams-Meeting-Links werden automatisch erkannt und als „Beitreten"-Button angezeigt. Erfordert einmalige App-Registrierung im Azure Portal durch den Admin.
                                </p>
                            </div>

                            <FormRow label="Anzeigename">
                                <input value={oauthName} onChange={e => setOauthName(e.target.value)} placeholder="Outlook"
                                    className="w-full p-2.5 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            </FormRow>

                            <div className="flex gap-2">
                                {['#0078D4', '#5059C9', '#3B82F6', '#7C3AED', '#06B6D4', '#10B981', '#64748B'].map(c => (
                                    <button key={c} onClick={() => setOauthColor(c)} className="w-5 h-5 rounded-full"
                                        style={{ background: c, outline: oauthColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                                ))}
                            </div>

                            {!process.env.NEXT_PUBLIC_MICROSOFT_CONFIGURED && (
                                <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E' }}>
                                    <p className="font-bold">Setup erforderlich</p>
                                    <p>MICROSOFT_CLIENT_ID und MICROSOFT_CLIENT_SECRET müssen in .env.local gesetzt werden. App-Registrierung im Azure Portal unter portal.azure.com.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── iCal URL Tab ── */}
                    {tab === 'ical' && (
                        <div className="space-y-4">
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Importiere einen beliebigen Kalender per iCal-Link (Lesezugriff). Funktioniert mit öffentlichen Kalendern, Feiertagen, etc.
                            </p>
                            <FormRow label="Anzeigename *">
                                <input value={icalName} onChange={e => setIcalName(e.target.value)} placeholder="Mein Kalender"
                                    className="w-full p-2.5 rounded-xl text-xs outline-none"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            </FormRow>
                            <FormRow label="iCal-URL *">
                                <input value={icalUrl} onChange={e => setIcalUrl(e.target.value)} placeholder="webcal:// oder https://"
                                    className="w-full p-2.5 rounded-xl text-xs outline-none font-mono"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
                            </FormRow>
                            <div className="flex gap-2">
                                {COLORS.slice(0, 7).map(c => (
                                    <button key={c} onClick={() => setIcalColor(c)} className="w-5 h-5 rounded-full"
                                        style={{ background: c, outline: icalColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                                ))}
                            </div>
                            {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium"
                        style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                        Abbrechen
                    </button>

                    <div className="flex gap-2">
                        {tab === 'caldav' && (
                            <button onClick={handleTestAndConnect} disabled={connecting || !name || !serverUrl || !username || !password}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                                style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                                {connecting ? <><Loader size={12} className="animate-spin" /> Prüfen…</> : 'Verbinden'}
                            </button>
                        )}
                        {tab === 'google' && (
                            <button onClick={handleConnectGoogle} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                                style={{ background: '#3B82F6', color: '#fff' }}>
                                <Chrome size={13} /> Mit Google verbinden
                            </button>
                        )}
                        {tab === 'outlook' && (
                            <button onClick={handleConnectMicrosoft} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                                style={{ background: '#0078D4', color: '#fff' }}>
                                <Monitor size={13} /> Mit Microsoft verbinden
                            </button>
                        )}
                        {tab === 'ical' && (
                            <button onClick={handleSaveIcal} disabled={saving || !icalName || !icalUrl}
                                className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                                style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                                {saving ? '...' : 'Importieren'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
            {children}
        </div>
    );
}
