'use client';

import React, { useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
    UserFeedback, FeedbackStatus, FeedbackCategory,
    FEEDBACK_CATEGORY_LABEL, FEEDBACK_STATUS_LABEL,
} from '../../types';
import { toast } from 'sonner';
import { MessageSquare, Bug, Lightbulb, MessageCircle, Trash2, ExternalLink, Save, Loader2 } from 'lucide-react';
import { SectionHeader, Card, EmptyState, INPUT_CLS } from '../../components/SuperAdmin/AdminUI';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import { useSuperAdmin } from '../../components/SuperAdmin/SuperAdminContext';

const STATUS_FILTERS: { key: FeedbackStatus | 'all'; label: string }[] = [
    { key: 'all',         label: 'Alle' },
    { key: 'new',         label: 'Neu' },
    { key: 'in_progress', label: 'In Arbeit' },
    { key: 'done',        label: 'Erledigt' },
    { key: 'dismissed',   label: 'Verworfen' },
];

const CATEGORY_FILTERS: { key: FeedbackCategory | 'all'; label: string }[] = [
    { key: 'all',   label: 'Alle Typen' },
    { key: 'bug',   label: 'Fehler' },
    { key: 'wish',  label: 'Wünsche' },
    { key: 'other', label: 'Sonstiges' },
];

export default function ReportsPage() {
    const { feedback, loading } = useSuperAdmin();
    const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | 'all'>('all');

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: feedback.length };
        for (const f of feedback) c[f.status] = (c[f.status] || 0) + 1;
        return c;
    }, [feedback]);

    const filtered = useMemo(() => {
        return feedback.filter(f =>
            (statusFilter === 'all' || f.status === statusFilter) &&
            (categoryFilter === 'all' || f.category === categoryFilter)
        );
    }, [feedback, statusFilter, categoryFilter]);

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Reports & Feedback"
                subtitle="Fehler-Meldungen und Wünsche aus allen Agenturen."
            />

            {/* Filter */}
            <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map(s => {
                    const active = statusFilter === s.key;
                    const n = counts[s.key] || 0;
                    return (
                        <button
                            key={s.key}
                            onClick={() => setStatusFilter(s.key)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition"
                            style={active ? {
                                background: 'var(--accent)', color: 'var(--accent-text)',
                            } : {
                                background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)',
                            }}
                        >
                            {s.label}
                            <span className="text-[10px] opacity-70">{n}</span>
                        </button>
                    );
                })}
                <div className="w-px h-5 mx-1" style={{ background: 'var(--border-default)' }} />
                <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value as FeedbackCategory | 'all')}
                    className="px-2.5 py-1.5 rounded-xl text-[12px] font-semibold cursor-pointer outline-none"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    {CATEGORY_FILTERS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="text-sm text-text-muted italic py-12 text-center">Lade…</div>
            ) : filtered.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={MessageSquare}
                        title="Keine Reports"
                        subtitle={feedback.length === 0
                            ? 'Noch hat keine Agentur Feedback gesendet.'
                            : 'Keine Einträge für diese Filter.'}
                    />
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map(f => <FeedbackRow key={f.id} item={f} />)}
                </div>
            )}
        </div>
    );
}

const CATEGORY_META: Record<FeedbackCategory, { icon: any; badge: string }> = {
    bug:   { icon: Bug,           badge: 'badge-danger' },
    wish:  { icon: Lightbulb,     badge: 'badge-info' },
    other: { icon: MessageCircle, badge: 'badge-default' },
};

const STATUS_BADGE: Record<FeedbackStatus, string> = {
    new:         'badge-warning',
    in_progress: 'badge-info',
    done:        'badge-success',
    dismissed:   'badge-default',
};

function FeedbackRow({ item }: { item: UserFeedback }) {
    const { refreshFeedback } = useSuperAdmin();
    const [notes, setNotes] = useState(item.admin_notes || '');
    const [savingStatus, setSavingStatus] = useState(false);
    const [savingNotes, setSavingNotes] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const meta = CATEGORY_META[item.category];
    const Icon = meta.icon;
    const notesDirty = notes !== (item.admin_notes || '');

    const changeStatus = async (status: FeedbackStatus) => {
        setSavingStatus(true);
        const { error } = await supabase.rpc('set_feedback_status', {
            p_feedback_id: item.id, p_status: status,
        });
        setSavingStatus(false);
        if (error) toast.error('Fehler: ' + error.message);
        else { toast.success('Status: ' + FEEDBACK_STATUS_LABEL[status]); refreshFeedback(); }
    };

    const saveNotes = async () => {
        setSavingNotes(true);
        const { error } = await supabase.rpc('set_feedback_status', {
            p_feedback_id: item.id, p_status: item.status, p_admin_notes: notes.trim() || null,
        });
        setSavingNotes(false);
        if (error) toast.error('Fehler: ' + error.message);
        else { toast.success('Notiz gespeichert.'); refreshFeedback(); }
    };

    const handleDelete = async () => {
        setConfirmDelete(false);
        const { error } = await supabase.rpc('delete_feedback_super_admin', { p_feedback_id: item.id });
        if (error) toast.error('Fehler: ' + error.message);
        else { toast.success('Report gelöscht.'); refreshFeedback(); }
    };

    return (
        <>
            <Card>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                            <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`badge ${meta.badge}`}>{FEEDBACK_CATEGORY_LABEL[item.category]}</span>
                                <span className={`badge ${STATUS_BADGE[item.status]}`}>{FEEDBACK_STATUS_LABEL[item.status]}</span>
                                {item.title && <span className="text-sm font-bold text-text-primary">{item.title}</span>}
                            </div>
                            <p className="text-sm text-text-primary mt-2 whitespace-pre-wrap break-words">{item.message}</p>

                            <div className="text-[11px] text-text-muted mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span><strong className="text-text-secondary">{item.org_name || 'Unbekannte Agentur'}</strong></span>
                                <span>·</span>
                                <span>{item.reporter_name || 'Unbekannt'}{item.reporter_email ? ` (${item.reporter_email})` : ''}</span>
                                <span>·</span>
                                <span>{new Date(item.created_at).toLocaleString('de-DE')}</span>
                                {item.page_url && (
                                    <>
                                        <span>·</span>
                                        <code className="font-mono" style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: '4px' }}>{item.page_url}</code>
                                    </>
                                )}
                            </div>

                            {item.image_url && (
                                <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 group relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={item.image_url} alt="Screenshot" className="max-h-32 rounded-xl"
                                        style={{ border: '1px solid var(--border-default)' }} />
                                    <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                                        <ExternalLink size={12} />
                                    </span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Aktionen */}
                    <div className="flex items-center gap-2 shrink-0">
                        <select
                            value={item.status}
                            onChange={e => changeStatus(e.target.value as FeedbackStatus)}
                            disabled={savingStatus}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer outline-none"
                            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                            {(['new', 'in_progress', 'done', 'dismissed'] as FeedbackStatus[]).map(s => (
                                <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s]}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="btn-ghost p-1.5"
                            style={{ color: 'var(--text-muted)' }}
                            title="Report löschen"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Admin-Notiz */}
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1.5">
                        Interne Notiz
                    </label>
                    <div className="flex items-start gap-2">
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Notiz für dich / dein Team…"
                            className={INPUT_CLS + ' resize-none flex-1'}
                        />
                        <button
                            onClick={saveNotes}
                            disabled={!notesDirty || savingNotes}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                        >
                            {savingNotes ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            Speichern
                        </button>
                    </div>
                </div>
            </Card>

            {confirmDelete && (
                <ConfirmModal
                    isOpen={true}
                    title="Report löschen?"
                    message="Dieser Report wird unwiderruflich entfernt."
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmDelete(false)}
                    type="danger"
                    confirmText="Löschen"
                />
            )}
        </>
    );
}
