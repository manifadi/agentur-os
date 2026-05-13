import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Download, PackageOpen } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import UserAvatar from '../UI/UserAvatar';

interface ProjectReportingTabProps {
    projectId: string;
    timeEntries: any[];
    sections: any[];
    deadline?: string | null;
    onOpenRatesSidebar: () => void;
}

function fmt(v: number) {
    return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default function ProjectReportingTab({ projectId, sections, onOpenRatesSidebar }: ProjectReportingTabProps) {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (projectId) load(); }, [projectId]);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('time_entries')
            .select(`*, employees(id, name, initials, avatar_url, hourly_rate), agency_positions(id, title, hourly_rate)`)
            .eq('project_id', projectId)
            .order('date', { ascending: false });
        if (data) setEntries(data);
        setLoading(false);
    };

    const rate = (t: any) => Number(t.agency_positions?.hourly_rate) || Number(t.employees?.hourly_rate) || 0;

    const totalBudget = useMemo(() =>
        sections.reduce((s: number, sec: any) =>
            s + (sec.positions || []).reduce((ps: number, p: any) =>
                ps + (p.quantity || 0) * (p.unit_price || 0), 0), 0),
    [sections]);

    const totalCost = useMemo(() => entries.reduce((s, t) => s + (Number(t.hours) || 0) * rate(t), 0), [entries]);
    const totalH    = useMemo(() => entries.reduce((s, t) => s + (Number(t.hours) || 0), 0), [entries]);

    const margin    = totalBudget - totalCost;
    const budgetPct = totalBudget > 0 ? Math.min((totalCost / totalBudget) * 100, 100) : 0;

    const externalPositions = useMemo(() =>
        sections.flatMap((sec: any) =>
            (sec.positions || []).filter((p: any) => p.is_external).map((p: any) => ({
                title: p.title || '—',
                qty: p.quantity || 0,
                unit: p.unit || '',
                ek: (p.quantity || 0) * (p.purchase_price || 0),
                vk: (p.quantity || 0) * (p.unit_price || 0),
            }))
        ),
    [sections]);

    const totalEK = useMemo(() => externalPositions.reduce((s, p) => s + p.ek, 0), [externalPositions]);
    const totalVK = useMemo(() => externalPositions.reduce((s, p) => s + p.vk, 0), [externalPositions]);
    const externalMargin = totalVK - totalEK;

    const barColor = budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
    const marginColor = margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500';

    const exportCSV = () => {
        const rows = [
            ['Datum', 'Mitarbeiter', 'Position', 'Beschreibung', 'Stunden', 'Stundensatz', 'Kosten'],
            ...entries.map(t => {
                const h = Number(t.hours) || 0;
                const r = rate(t);
                return [
                    new Date(t.date).toLocaleDateString('de-DE'),
                    t.employees?.name || '',
                    t.agency_positions?.title || '',
                    t.description || '',
                    h.toFixed(2).replace('.', ','),
                    r.toFixed(2).replace('.', ','),
                    (h * r).toFixed(2).replace('.', ','),
                ];
            }),
        ];
        const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `reporting-${projectId}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 pb-12">

            {/* ── Soll / Ist ── */}
            {totalBudget > 0 && (
                <div className="bg-surface border border-default rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">Soll / Ist</h3>
                        <button
                            onClick={onOpenRatesSidebar}
                            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition px-3 py-1.5 rounded-lg border border-default bg-subtle"
                        >
                            <Clock size={12} /> Stundensätze
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-5">
                        <div>
                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Soll (Budget)</div>
                            <div className="text-2xl font-black text-text-primary tabular-nums">{fmt(totalBudget)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Ist (Kosten)</div>
                            <div className="text-2xl font-black text-text-primary tabular-nums">{fmt(totalCost)}</div>
                            <div className="text-xs text-text-placeholder mt-0.5">{totalH % 1 === 0 ? totalH.toFixed(0) : totalH.toFixed(1)} h gebucht</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Differenz</div>
                            <div className={`text-2xl font-black tabular-nums ${marginColor}`}>
                                {margin >= 0 ? '+' : ''}{fmt(margin)}
                            </div>
                            <div className="text-xs text-text-placeholder mt-0.5">{Math.round(budgetPct)} % verbraucht</div>
                        </div>
                    </div>

                    <div className="w-full h-2 bg-hover rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${budgetPct}%` }} />
                    </div>
                </div>
            )}

            {/* ── Fremdleistungen ── */}
            {externalPositions.length > 0 && (
                <div className="bg-surface border border-orange-200 dark:border-orange-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <PackageOpen size={13} />
                        </div>
                        <h3 className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest">Fremdleistungen</h3>
                    </div>

                    <div className="rounded-xl border border-orange-100 dark:border-orange-900 overflow-hidden mb-5">
                        <table className="w-full text-sm">
                            <thead className="bg-orange-50 dark:bg-orange-950/30 text-[10px] text-orange-600 dark:text-orange-400 uppercase tracking-widest font-semibold border-b border-orange-100 dark:border-orange-900">
                                <tr>
                                    <th className="px-4 py-3 text-left">Position</th>
                                    <th className="px-4 py-3 text-right w-32 hidden sm:table-cell">Menge</th>
                                    <th className="px-4 py-3 text-right w-32">EK gesamt</th>
                                    <th className="px-4 py-3 text-right w-32">VK gesamt</th>
                                    <th className="px-4 py-3 text-right w-28 hidden sm:table-cell">Marge</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-orange-50 dark:divide-orange-900/40">
                                {externalPositions.map((p, i) => {
                                    const m = p.vk - p.ek;
                                    return (
                                        <tr key={i} className="hover:bg-orange-50/40 dark:hover:bg-orange-950/10 transition">
                                            <td className="px-4 py-3 font-medium text-text-primary">{p.title}</td>
                                            <td className="px-4 py-3 text-right text-text-muted font-mono text-xs hidden sm:table-cell">
                                                {p.qty % 1 === 0 ? p.qty.toFixed(0) : p.qty.toFixed(2)} {p.unit}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-text-muted">{fmt(p.ek)}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-text-primary">{fmt(p.vk)}</td>
                                            <td className={`px-4 py-3 text-right font-mono text-sm hidden sm:table-cell ${m >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                                {m >= 0 ? '+' : ''}{fmt(m)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="border-t-2 border-orange-100 dark:border-orange-900 bg-orange-50/60 dark:bg-orange-950/20">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-xs font-bold text-orange-700 dark:text-orange-400 hidden sm:table-cell">Gesamt</td>
                                    <td colSpan={2} className="px-4 py-3 text-xs font-bold text-orange-700 dark:text-orange-400 sm:hidden">Gesamt</td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-text-muted text-sm">{fmt(totalEK)}</td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-text-primary text-sm">{fmt(totalVK)}</td>
                                    <td className={`px-4 py-3 text-right font-mono font-black text-sm hidden sm:table-cell ${externalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                        {externalMargin >= 0 ? '+' : ''}{fmt(externalMargin)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Zeiteinträge ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest">
                        Zeiteinträge {entries.length > 0 && <span className="font-normal normal-case text-text-placeholder ml-1">({entries.length})</span>}
                    </h3>
                    {entries.length > 0 && (
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition"
                        >
                            <Download size={12} /> CSV exportieren
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-subtle rounded-xl animate-pulse" />)}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center py-16 gap-3 text-text-muted">
                        <Clock size={28} strokeWidth={1.5} className="opacity-30" />
                        <p className="text-sm">Noch keine Zeiten erfasst.</p>
                    </div>
                ) : (
                    <div className="rounded-xl border border-default overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-subtle text-[10px] text-text-placeholder uppercase tracking-widest font-semibold border-b border-default">
                                <tr>
                                    <th className="px-4 py-3 text-left w-28">Datum</th>
                                    <th className="px-4 py-3 text-left">Mitarbeiter</th>
                                    <th className="px-4 py-3 text-left hidden md:table-cell">Position</th>
                                    <th className="px-4 py-3 text-left hidden lg:table-cell">Beschreibung</th>
                                    <th className="px-4 py-3 text-right w-20">Stunden</th>
                                    <th className="px-4 py-3 text-right w-28 hidden sm:table-cell">Kosten</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-default">
                                {entries.map((t: any) => {
                                    const h = Number(t.hours) || 0;
                                    const r = rate(t);
                                    return (
                                        <tr key={t.id} className="hover:bg-subtle/40 transition">
                                            <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">
                                                {new Date(t.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <UserAvatar src={t.employees?.avatar_url} name={t.employees?.name} initials={t.employees?.initials} size="xs" />
                                                    <span className="text-sm font-medium text-text-primary">{t.employees?.name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-text-muted hidden md:table-cell">
                                                {t.agency_positions?.title || <span className="opacity-40">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-text-muted max-w-[240px] truncate hidden lg:table-cell">
                                                {t.description || <span className="italic opacity-40">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-text-primary text-sm">
                                                {h % 1 === 0 ? h.toFixed(0) : h.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-sm text-text-muted hidden sm:table-cell">
                                                {r > 0 ? fmt(h * r) : <span className="opacity-40">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="border-t-2 border-default bg-subtle/60">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-text-muted hidden lg:table-cell">Gesamt</td>
                                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-text-muted lg:hidden">Gesamt</td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-text-primary text-sm">
                                        {totalH % 1 === 0 ? totalH.toFixed(0) : totalH.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-black text-text-primary text-sm hidden sm:table-cell">
                                        {totalCost > 0 ? fmt(totalCost) : ''}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
