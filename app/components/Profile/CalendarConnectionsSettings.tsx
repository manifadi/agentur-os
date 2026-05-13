'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RefreshCw, Chrome, Monitor, Apple, Building2, Link, Shield, Check, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Employee, ExternalCalendar, CalendarProviderType } from '../../types';
import { supabase } from '../../supabaseClient';
import CalendarProviderModal from '../Calendar/CalendarProviderModal';

function ProviderIcon({ type, size = 14 }: { type: CalendarProviderType; size?: number }) {
    switch (type) {
        case 'google': return <Chrome size={size} style={{ color: '#3B82F6' }} />;
        case 'outlook':
        case 'teams': return <Monitor size={size} style={{ color: '#0078D4' }} />;
        case 'apple': return <Apple size={size} style={{ color: '#64748B' }} />;
        case 'troi': return <Building2 size={size} style={{ color: '#7C3AED' }} />;
        case 'ical': return <Link size={size} style={{ color: '#06B6D4' }} />;
        default: return <Shield size={size} style={{ color: 'var(--text-muted)' }} />;
    }
}

const PROVIDER_LABELS: Record<CalendarProviderType, string> = {
    google: 'Google Kalender',
    outlook: 'Outlook / Teams',
    teams: 'Microsoft Teams',
    apple: 'Apple / iCloud',
    troi: 'Troi',
    ical: 'iCal-Abonnement',
};

interface Props {
    currentUser: Employee;
    organizationId: string;
}

export default function CalendarConnectionsSettings({ currentUser, organizationId }: Props) {
    const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchCalendars = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('external_calendars')
            .select('*')
            .eq('employee_id', currentUser.id)
            .order('created_at');
        setCalendars((data || []) as ExternalCalendar[]);
        setLoading(false);
    }, [currentUser.id]);

    useEffect(() => { fetchCalendars(); }, [fetchCalendars]);

    const handleToggleVisible = async (cal: ExternalCalendar) => {
        await supabase.from('external_calendars').update({ is_visible: !cal.is_visible }).eq('id', cal.id);
        fetchCalendars();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Diese Kalenderverbindung wirklich entfernen?')) return;
        setDeleting(id);
        await supabase.from('external_calendars').delete().eq('id', id);
        await fetchCalendars();
        setDeleting(null);
    };

    const hasCalDavIssue = (cal: ExternalCalendar) =>
        (cal.provider_type === 'troi' || cal.provider_type === 'apple') && !cal.caldav_username;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Verbundene Kalender</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Jeder Nutzer verwaltet hier seine eigenen Kalender-Verbindungen.</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                    style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                    <Plus size={13} /> Kalender hinzufügen
                </button>
            </div>

            {/* OAuth info box */}
            <div className="p-4 rounded-xl text-xs space-y-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Wie funktioniert das?</p>
                <div className="space-y-1" style={{ color: 'var(--text-muted)' }}>
                    <p><strong style={{ color: 'var(--text-secondary)' }}>CalDAV (Troi, Apple):</strong> Du gibst deine Zugangsdaten direkt ein. Die Verbindung gehört nur dir.</p>
                    <p><strong style={{ color: 'var(--text-secondary)' }}>Google / Outlook:</strong> Du klickst auf „Verbinden" und gibst Zugriff über OAuth. Jeder Nutzer verbindet sein eigenes Konto — du brauchst kein gemeinsames Login.</p>
                    <p><strong style={{ color: 'var(--text-secondary)' }}>iCal URL:</strong> Öffentliche Kalender (z.B. Feiertage) per Link abonnieren.</p>
                </div>
            </div>

            {/* Calendar list */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2].map(i => (
                        <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--bg-subtle)' }} />
                    ))}
                </div>
            ) : calendars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-2xl" style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)' }}>
                    <Shield size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                    <p className="text-sm font-medium mt-3" style={{ color: 'var(--text-muted)' }}>Noch keine Kalender verbunden</p>
                    <button onClick={() => setShowModal(true)} className="mt-3 text-xs font-bold px-4 py-2 rounded-xl" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                        Ersten Kalender hinzufügen
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {calendars.map(cal => (
                        <div key={cal.id} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                            {/* Color dot */}
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cal.color }} />

                            {/* Icon + Info */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <ProviderIcon type={cal.provider_type} />
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{cal.name}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                            {PROVIDER_LABELS[cal.provider_type] || cal.provider_type}
                                        </span>
                                        {cal.is_writable && (
                                            <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: '#10B981' }}>
                                                <Check size={9} /> Bidirektional
                                            </span>
                                        )}
                                        {hasCalDavIssue(cal) && (
                                            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: '#F59E0B' }}>
                                                <AlertCircle size={9} /> Zugangsdaten fehlen
                                            </span>
                                        )}
                                        {cal.caldav_username && (
                                            <span className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>
                                                {cal.caldav_username}
                                            </span>
                                        )}
                                        {cal.last_synced_at && (
                                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                Sync: {new Date(cal.last_synced_at).toLocaleDateString('de-AT')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => handleToggleVisible(cal)} className="p-2 rounded-lg transition-colors"
                                    style={{ color: cal.is_visible ? 'var(--accent)' : 'var(--text-muted)' }}
                                    title={cal.is_visible ? 'Im Kalender sichtbar' : 'Im Kalender ausgeblendet'}>
                                    {cal.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button onClick={() => handleDelete(cal.id)} disabled={deleting === cal.id}
                                    className="p-2 rounded-lg transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                    {deleting === cal.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <CalendarProviderModal
                    currentUser={currentUser}
                    organizationId={organizationId}
                    onClose={() => setShowModal(false)}
                    onAdded={() => { fetchCalendars(); setShowModal(false); }}
                />
            )}
        </div>
    );
}
