import React from 'react';
import { AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    type?: 'danger' | 'info' | 'warning' | 'success';
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    isLoading = false,
    confirmText = 'Bestätigen',
    cancelText = 'Abbrechen',
    showCancel = true,
    type = 'danger'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const iconMap = {
        danger: <AlertTriangle size={20} />,
        info: <Info size={20} />,
        warning: <AlertCircle size={20} />,
        success: <CheckCircle size={20} />,
    };
    const iconColorMap = {
        danger: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger-text)]',
        info: 'bg-[var(--color-info-subtle)] text-[var(--color-info-text)]',
        warning: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning-text)]',
        success: 'bg-[var(--color-success-subtle)] text-[var(--color-success-text)]',
    };
    const confirmColorMap = {
        danger: 'bg-[var(--color-danger)] hover:brightness-110',
        info: 'bg-[var(--color-info)] hover:brightness-110',
        warning: 'bg-[var(--color-warning)] hover:brightness-110',
        success: 'bg-[var(--color-success)] hover:brightness-110',
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface rounded-2xl shadow-lg max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-border-subtle">
                <div className="flex items-start gap-4 mb-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColorMap[type]}`}>
                        {iconMap[type]}
                    </div>
                    <div className="pt-0.5">
                        <h3 className="ds-title leading-tight mb-1">{title}</h3>
                        <p className="ds-callout leading-relaxed">{message}</p>
                    </div>
                </div>

                <div className="flex gap-2 justify-end">
                    {showCancel && (
                        <button
                            onClick={onCancel}
                            className="btn-ghost px-4 py-2 rounded-xl text-[13px]"
                            disabled={isLoading}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-150 active:scale-[0.98] shadow-sm ${confirmColorMap[type]} ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {isLoading && (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
