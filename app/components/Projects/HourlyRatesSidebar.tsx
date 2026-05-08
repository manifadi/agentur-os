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

            <div className="fixed inset-y-0 right-0 w-80 bg-surface shadow-2xl z-[60] flex flex-col animate-in slide-in-from-right duration-300 border-l border-default">
                <div className="flex items-center justify-between p-4 border-b border-default shrink-0">
                    <h2 className="text-base font-bold text-text-primary">Stundensätze</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-sm text-text-placeholder animate-pulse">Lädt...</div>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-subtle text-xs text-text-muted uppercase font-semibold border-b border-default sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left">Position</th>
                                    <th className="px-4 py-3 text-left">Kategorie</th>
                                    <th className="px-4 py-3 text-right">€/h</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-default">
                                {positions.map((p) => (
                                    <tr key={p.id} className="hover:bg-subtle/50 transition">
                                        <td className="px-4 py-3 font-bold text-text-primary">{p.title}</td>
                                        <td className="px-4 py-3 text-text-muted text-xs">{p.category || '-'}</td>
                                        <td className="px-4 py-3 text-right font-mono text-text-primary">
                                            {Number(p.hourly_rate).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                    </tr>
                                ))}
                                {positions.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-10 text-center text-text-placeholder text-xs">
                                            Keine Stundensätze gefunden.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}
