import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface HourlyRatesSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    organizationId: string;
}

export default function HourlyRatesSidebar({ isOpen, onClose, organizationId }: HourlyRatesSidebarProps) {
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && organizationId) {
            fetchPositions();
        }
    }, [isOpen, organizationId]);

    const fetchPositions = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('agency_positions')
            .select('*')
            .eq('organization_id', organizationId)
            .order('hourly_rate', { ascending: false });
        if (data) setPositions(data);
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/30 z-[55]"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 w-[480px] bg-surface shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300 border-l border-default">
                <div className="flex items-center justify-between px-6 py-4 border-b border-default shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-text-primary">Stundensätze</h2>
                        <p className="text-xs text-text-muted mt-0.5">Agenturpositionen &amp; interne Verrechnungssätze</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-sm text-text-placeholder animate-pulse">Lädt...</div>
                        </div>
                    ) : positions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-8 gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-subtle border border-default flex items-center justify-center text-text-placeholder">
                                <X size={20} />
                            </div>
                            <p className="text-sm font-medium text-text-muted">Keine Stundensätze hinterlegt.</p>
                            <p className="text-xs text-text-placeholder">
                                Stundensätze können in den{' '}
                                <a
                                    href="/einstellungen?section=stundensaetze"
                                    className="font-semibold underline-offset-2 hover:underline"
                                    style={{ color: 'var(--accent)' }}
                                >
                                    Einstellungen unter „Stundensätze"
                                </a>{' '}
                                angelegt werden.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-2">
                            {positions.map((p) => (
                                <div key={p.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-subtle border border-default hover:border-accent/30 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-text-primary truncate">{p.title}</div>
                                        {p.category && (
                                            <div className="text-xs text-text-muted mt-0.5">{p.category}</div>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-black font-mono text-text-primary">
                                            {Number(p.hourly_rate).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                                        </div>
                                        <div className="text-[10px] text-text-placeholder font-medium">pro Stunde</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {positions.length > 0 && (
                    <div className="px-6 py-4 border-t border-default bg-subtle/50 shrink-0">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                            <span>{positions.length} {positions.length === 1 ? 'Position' : 'Positionen'}</span>
                            <span className="font-medium">
                                Ø {(positions.reduce((s, p) => s + Number(p.hourly_rate), 0) / positions.length).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €/h
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
