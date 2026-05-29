'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { Employee, FeedbackCategory } from '../../types';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';
import { toast } from 'sonner';
import {
    MessageSquarePlus, X, Bug, Lightbulb, MessageCircle,
    ImagePlus, Trash2, Loader2, Send,
} from 'lucide-react';

interface FeedbackWidgetProps {
    currentUser: Employee;
    organizationId: string;
}

const CATEGORIES: { key: FeedbackCategory; label: string; icon: any }[] = [
    { key: 'bug',   label: 'Fehler',    icon: Bug },
    { key: 'wish',  label: 'Wunsch',    icon: Lightbulb },
    { key: 'other', label: 'Sonstiges', icon: MessageCircle },
];

export default function FeedbackWidget({ currentUser, organizationId }: FeedbackWidgetProps) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    const [category, setCategory] = useState<FeedbackCategory>('bug');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Object-URL für Vorschau wieder freigeben
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    const reset = () => {
        setCategory('bug');
        setTitle('');
        setMessage('');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setImageFile(null);
        setPreviewUrl(null);
    };

    const close = () => {
        if (submitting) return;
        setOpen(false);
        reset();
    };

    const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Bitte ein Bild auswählen.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Bild ist zu groß (max. 5 MB).');
            return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const removeImage = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setImageFile(null);
        setPreviewUrl(null);
    };

    const submit = async () => {
        if (!message.trim()) {
            toast.error('Bitte beschreibe dein Anliegen.');
            return;
        }
        setSubmitting(true);
        try {
            let imageUrl: string | null = null;
            if (imageFile) {
                imageUrl = await uploadFileToSupabase(imageFile, 'feedback');
            }

            const { error } = await supabase.from('user_feedback').insert({
                organization_id: organizationId,
                employee_id: currentUser.id,
                category,
                title: title.trim() || null,
                message: message.trim(),
                page_url: pathname || null,
                image_url: imageUrl,
            });

            if (error) throw error;

            toast.success('Danke! Dein Feedback wurde übermittelt.');
            setOpen(false);
            reset();
        } catch (err: any) {
            toast.error('Konnte nicht gesendet werden: ' + (err?.message || 'unbekannter Fehler'));
        } finally {
            setSubmitting(false);
        }
    };

    if (!mounted) return null;

    const modal = open ? (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={close}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="bg-surface rounded-2xl shadow-lg w-full max-w-md animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                style={{ border: '1px solid var(--border-subtle)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                            <MessageSquarePlus size={18} />
                        </div>
                        <div>
                            <h3 className="ds-title leading-tight">Feedback senden</h3>
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                Fehler melden oder Wunsch äußern
                            </p>
                        </div>
                    </div>
                    <button onClick={close} className="btn-ghost p-1.5" disabled={submitting}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 overflow-y-auto">
                    {/* Kategorie */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Worum geht's?
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {CATEGORIES.map(c => {
                                const Icon = c.icon;
                                const active = category === c.key;
                                return (
                                    <button
                                        key={c.key}
                                        type="button"
                                        onClick={() => setCategory(c.key)}
                                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition"
                                        style={active ? {
                                            background: 'var(--accent)',
                                            color: 'var(--accent-text)',
                                            border: '1px solid var(--accent)',
                                        } : {
                                            background: 'var(--bg-subtle)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-default)',
                                        }}
                                    >
                                        <Icon size={18} />
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Titel */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Titel <span style={{ color: 'var(--text-placeholder)' }}>(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Kurz zusammengefasst"
                            className="input-field"
                            maxLength={120}
                        />
                    </div>

                    {/* Beschreibung */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Beschreibung
                        </label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder={category === 'bug'
                                ? 'Was ist passiert? Was hast du erwartet?'
                                : category === 'wish'
                                ? 'Was würdest du dir wünschen?'
                                : 'Erzähl uns mehr…'}
                            rows={4}
                            className="input-field resize-none"
                            autoFocus
                        />
                    </div>

                    {/* Bild */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Screenshot <span style={{ color: 'var(--text-placeholder)' }}>(optional)</span>
                        </label>
                        {previewUrl ? (
                            <div className="relative inline-block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={previewUrl}
                                    alt="Vorschau"
                                    className="max-h-40 rounded-xl"
                                    style={{ border: '1px solid var(--border-default)' }}
                                />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                                    style={{ background: 'var(--color-danger)', color: '#fff' }}
                                    title="Bild entfernen"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ) : (
                            <label
                                className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold cursor-pointer transition"
                                style={{
                                    background: 'var(--bg-subtle)',
                                    color: 'var(--text-secondary)',
                                    border: '1px dashed var(--border-strong)',
                                }}
                            >
                                <ImagePlus size={16} />
                                Bild anhängen
                                <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
                            </label>
                        )}
                    </div>

                    {/* Seiten-Hinweis */}
                    {pathname && (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Bezieht sich auf: <code className="font-mono">{pathname}</code>
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4" style={{ borderTop: '1px solid var(--border-default)' }}>
                    <button onClick={close} className="btn-ghost px-4 py-2 rounded-xl text-[13px]" disabled={submitting}>
                        Abbrechen
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting || !message.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                    >
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {submitting ? 'Sende…' : 'Senden'}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setOpen(true)}
                className="group fixed bottom-6 right-6 z-40 flex items-center gap-0 hover:gap-2 h-12 rounded-full shadow-lg transition-all duration-300 active:scale-95 px-3.5"
                style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                aria-label="Fehler melden oder Wunsch äußern"
            >
                <MessageSquarePlus size={20} className="shrink-0" />
                <span className="max-w-0 group-hover:max-w-[220px] overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-300 group-hover:pr-1">
                    Fehler melden oder Wunsch äußern
                </span>
            </button>

            {createPortal(modal, document.body)}
        </>
    );
}
