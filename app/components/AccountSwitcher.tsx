'use client';

import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, Loader2, Building2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StoredAccount } from '../utils/accountVault';

interface AccountSwitcherProps {
    open: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement>;
}

export default function AccountSwitcher({ open, onClose, anchorRef }: AccountSwitcherProps) {
    const { accounts, activeAccountId, switchAccount, startAddAccount, switchingAccount } = useApp();
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const [mounted, setMounted] = useState(false);

    useLayoutEffect(() => { setMounted(true); }, []);

    useLayoutEffect(() => {
        if (!open || !anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const width = 280;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        setPos({ top: rect.bottom + 8, left });
    }, [open, anchorRef]);

    if (!mounted || !open || !pos) return null;

    const handleSwitch = (acc: StoredAccount) => {
        if (acc.id === activeAccountId) { onClose(); return; }
        onClose();
        switchAccount(acc.id);
    };

    const panel = (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[140]" onClick={onClose} />

            {/* Panel */}
            <div
                className="fixed z-[141] rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
                style={{
                    top: pos.top, left: pos.left, width: 280,
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                }}
            >
                <div className="px-3 pt-3 pb-1.5">
                    <span className="ds-caption">Agenturen</span>
                </div>

                <div className="px-1.5 pb-1.5 max-h-[320px] overflow-y-auto">
                    {accounts.length === 0 ? (
                        <div className="text-xs text-text-muted italic px-2.5 py-3">Keine gespeicherten Accounts.</div>
                    ) : (
                        accounts.map(acc => {
                            const active = acc.id === activeAccountId;
                            const title = acc.agencyName || acc.email;
                            const subtitle = acc.agencyName ? acc.email : (acc.userName || '');
                            const baseBg = active ? 'var(--accent-subtle)' : 'transparent';
                            const hoverBg = active ? 'var(--accent-subtle-hover)' : 'var(--bg-hover)';
                            return (
                                <div
                                    key={acc.id}
                                    onClick={() => handleSwitch(acc)}
                                    className="group flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer transition"
                                    style={{ background: baseBg }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = baseBg; }}
                                >
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                                        style={{
                                            background: 'var(--bg-subtle)',
                                            border: active ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                                        }}>
                                        {acc.logoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={acc.logoUrl} alt="" className="w-full h-full object-contain p-1.5" />
                                        ) : (
                                            <span className="text-[13px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                                                {(acc.agencyName || acc.email || '?').slice(0, 1).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                            {title}
                                        </span>
                                        {subtitle && (
                                            <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                {subtitle}
                                            </span>
                                        )}
                                    </div>

                                    {active && (
                                        switchingAccount
                                            ? <Loader2 size={15} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />
                                            : <Check size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="h-px mx-1.5" style={{ background: 'var(--border-subtle)' }} />

                <div className="p-1.5">
                    <button
                        onClick={() => { onClose(); startAddAccount(); }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-xl transition"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)' }}>
                            <Plus size={16} />
                        </div>
                        <span className="text-[13px] font-semibold">Agentur hinzufügen</span>
                        <Building2 size={13} className="ml-auto shrink-0" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
            </div>
        </>
    );

    return createPortal(panel, document.body);
}
