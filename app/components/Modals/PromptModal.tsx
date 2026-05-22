'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link as LinkIcon } from 'lucide-react';

interface PromptModalProps {
    isOpen: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: (value: string) => void;
    onCancel: () => void;
    icon?: React.ComponentType<any>;
}

// Ersatz für window.prompt() — folgt dem ConfirmModal-Pattern (Portal, Backdrop, Animation).
export default function PromptModal({
    isOpen, title, message, placeholder, defaultValue = '',
    confirmText = 'Übernehmen', cancelText = 'Abbrechen',
    onConfirm, onCancel, icon: Icon = LinkIcon,
}: PromptModalProps) {
    const [mounted, setMounted] = useState(false);
    const [value, setValue] = useState(defaultValue);

    useEffect(() => { setMounted(true); }, []);
    useEffect(() => { if (isOpen) setValue(defaultValue); }, [isOpen, defaultValue]);

    if (!isOpen || !mounted) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        onConfirm(value);
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200"
             onClick={onCancel}>
            <form
                onSubmit={handleSubmit}
                onClick={e => e.stopPropagation()}
                className="bg-surface rounded-2xl shadow-lg max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-border-subtle"
            >
                <div className="flex items-start gap-4 mb-5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                         style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                        <Icon size={18} />
                    </div>
                    <div className="pt-0.5">
                        <h3 className="ds-title leading-tight mb-1">{title}</h3>
                        {message && <p className="ds-callout leading-relaxed">{message}</p>}
                    </div>
                </div>

                <input
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={placeholder}
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition mb-4"
                    style={{
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-strong)',
                        color: 'var(--text-primary)',
                    }}
                />

                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="btn-ghost px-4 py-2 rounded-xl text-[13px]"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center px-5 py-2 rounded-xl text-[13px] font-semibold transition shadow-sm active:scale-[0.98]"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                    >
                        {confirmText}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
