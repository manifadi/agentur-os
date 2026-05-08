import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Euro, Timer } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import UserAvatar from '../UI/UserAvatar';

interface ProjectReportingTabProps {
    projectId: string;
    timeEntries: any[];
    sections: any[];
    onOpenRatesSidebar: () => void;
}

type AmpelStatus = 'green' | 'amber' | 'red';

function getAmpel(usagePct: number): AmpelStatus {
    if (usagePct >= 100) return 'red';
    if (usagePct >= 80) return 'amber';
    return 'green';
}

const AMPEL_STYLES: Record<AmpelStatus, { bar: string; bg: string; border: string; text: string; badge: string; label: string; icon: React.ElementType }> = {
    green: {
        bar: 'bg-green-500',
        bg: 'bg-green-500/8',
        border: 'border-green-500/20',
        text: 'text-green-600 dark:text-green-400',
        badge: 'bg-green-500/10 text-green-700 dark:text-green-300',
        label: 'Im Budget',
        icon: CheckCircle,
    },
    amber: {
        bar: 'bg-amber-500',
        bg: 'bg-amber-500/8',
        border: 'border-amber-500/20',
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
        label: 'Aufmerksamkeit',
        icon: AlertTriangle,
    },
    red: {
        bar: 'bg-red-500',
        bg: 'bg-red-500/8',
        border: 'border-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        badge: 'bg-red-500/10 text-red-700 dark:text-red-300',
        label: 'Budget überschritten',
        icon: AlertTriangle,
    },
};

function fmt(val: number) {
    return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default function ProjectReportingTab({ projectId, sections, onOpenRatesSidebar }: ProjectReportingTabProps) {
    const [timeEntries, setTimeEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (projectId) fetchTimeEntries();
    }, [projectId]);

    const fetchTimeEntries = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('time_entries')
            .select(`*, employees(id, name, initials, avatar_url, hourly_rate), agency_positions(id, title, hourly_rate)`)
            .eq('project_id', projectId)
            .order('date', { ascending: false });
        if (data) setTimeEntries(data);
        setLoading(false);
    };

    // ── Calculations ─────────────────────────────────────────────
    const totalRevenue = sections.reduce((sum: number, s: any) =>
        sum + (s.positions || []).reduce((ps: number, p: any) =>
            ps + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0), 0);

    const totalPlannedHours = sections.reduce((sum: number, s: any) =>
        sum + (s.positions || []).reduce((ps: number, p: any) =>
            ps + (Number(p.hours_sold) || 0), 0), 0);

    const positionGroups = timeEntries.reduce((acc: any[], t: any) => {
        const key = t.agency_positions?.title || t.employees?.job_title || 'Ohne Position';
        let g = acc.find(x => x.title === key);
        if (!g) {
            g = { title: key, entries: [], totalHours: 0, totalCost: 0, rate: 0 };
            acc.push(g);
        }
        const h = Number(t.hours) || 0;
        const rate = Number(t.agency_positions?.hourly_rate) || Number(t.employees?.hourly_rate) || 0;
        g.entries.push({ ...t, cost: h * rate, rate });
        g.totalHours += h;
        g.totalCost += h * rate;
        g.rate = rate;
        return acc;
    }, []);

    const totalActualHours = timeEntries.reduce((s: number, t: any) => s + (Number(t.hours) || 0), 0);
    const totalCost = positionGroups.reduce((s: number, g: any) => s + g.totalCost, 0);
    const margin = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
    const budgetUsagePct = totalRevenue > 0 ? Math.min((totalCost / totalRevenue) * 100, 150) : 0;
    const hoursUsagePct = totalPlannedHours > 0 ? (totalActualHours / totalPlannedHours) * 100 : 0;

    const ampel = getAmpel(totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0);
    const styles = AMPEL_STYLES[ampel];
    const AmpelIcon = styles.icon;

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });
    };

    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="space-y-6 pb-8">

            {/* ── Budget-Ampel Hero ─────────────────────────── */}
            <div className={`rounded-2xl border p-6 ${styles.bg} ${styles.border}`}>
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <AmpelIcon size={16} className={styles.text} />
                            <span className={`text-xs font-bold uppercase tracking-widest ${styles.text}`}>
                                {styles.label}
                            </span>
                        </div>
                        <div className="text-2xl font-black text-text-primary">
                            {totalRevenue > 0
                                ? `${Math.round((totalCost / totalRevenue) * 100)} % Budget verbraucht`
                                : 'Noch kein Budget kalkuliert'}
                        </div>
                        {totalRevenue > 0 && (
                            <p className="text-sm text-text-secondary mt-1">
                                {fmt(totalCost)} von {fmt(totalRevenue)} · {fmt(Math.abs(margin))} {margin >= 0 ? 'Puffer verbleibend' : 'Überzug'}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onOpenRatesSidebar}
                        className="flex items-center gap-2 px-3 py-2 bg-surface border border-default rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:border-accent/40 transition shrink-0 shadow-sm"
                    >
                        <Clock size={13} />
                        Stundensätze
                    </button>
                </div>

                {/* Progress bar */}
                {totalRevenue > 0 && (
                    <div className="w-full h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${styles.bar}`}
                            style={{ width: `${Math.min(budgetUsagePct, 100)}%` }}
                        />
                    </div>
                )}
            </div>

            {/* ── 4 KPI Cards ──────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Geplant */}
                <div className="bg-surface rounded-2xl border border-default p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Euro size={14} />
                        </div>
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Geplant</span>
                    </div>
                    <div className="text-xl font-black text-text-primary">{fmt(totalRevenue)}</div>
                    {totalPlannedHours > 0 && (
                        <div className="text-xs text-text-placeholder mt-1">{totalPlannedHours.toFixed(0)} h geplant</div>
                    )}
                </div>

                {/* Kosten Ist */}
                <div className="bg-surface rounded-2xl border border-default p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                            <Timer size={14} />
                        </div>
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Kosten Ist</span>
                    </div>
                    <div className="text-xl font-black text-text-primary">{fmt(totalCost)}</div>
                    <div className="text-xs text-text-placeholder mt-1">{totalActualHours.toFixed(1)} h gebucht</div>
                </div>

                {/* Marge */}
                <div className="bg-surface rounded-2xl border border-default p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${margin >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {margin >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        </div>
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Marge</span>
                    </div>
                    <div className={`text-xl font-black ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {margin >= 0 ? '+' : ''}{fmt(margin)}
                    </div>
                    {totalRevenue > 0 && (
                        <div className="text-xs text-text-placeholder mt-1">{marginPct.toFixed(1)} % Marge</div>
                    )}
                </div>

                {/* Stunden */}
                <div className="bg-surface rounded-2xl border border-default p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                            <Clock size={14} />
                        </div>
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Stunden</span>
                    </div>
                    <div className="text-xl font-black text-text-primary">
                        {totalActualHours.toFixed(1)} h
                    </div>
                    {totalPlannedHours > 0 && (
                        <>
                            <div className="text-xs text-text-placeholder mt-1">von {totalPlannedHours.toFixed(0)} h geplant</div>
                            <div className="w-full h-1.5 bg-hover rounded-full overflow-hidden mt-2">
                                <div
                                    className={`h-full rounded-full ${getAmpel(hoursUsagePct) === 'green' ? 'bg-green-500' : getAmpel(hoursUsagePct) === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(hoursUsagePct, 100)}%` }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Position Groups ───────────────────────────── */}
            <div>
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Zeiterfassung nach Position</h3>
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 bg-subtle rounded-2xl border border-default animate-pulse" />
                            ))}
                        </div>
                    ) : positionGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 bg-subtle rounded-2xl border border-dashed border-default gap-3">
                            <Clock size={28} strokeWidth={1.5} className="text-text-placeholder opacity-50" />
                            <p className="text-sm font-medium text-text-muted">Noch keine Zeiten erfasst.</p>
                        </div>
                    ) : (
                        positionGroups.map((group: any) => {
                            const isExpanded = expandedGroups.has(group.title);
                            const groupBudgetUsage = totalRevenue > 0
                                ? Math.round((group.totalCost / totalRevenue) * 100)
                                : 0;

                            return (
                                <div key={group.title} className="bg-surface rounded-2xl border border-default overflow-hidden shadow-sm">
                                    <button
                                        className="w-full p-4 flex items-center gap-4 hover:bg-subtle/50 transition text-left"
                                        onClick={() => toggleGroup(group.title)}
                                    >
                                        <div className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                            <ChevronRight size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-text-primary text-sm">{group.title}</span>
                                                {group.rate > 0 && (
                                                    <span className="text-[10px] text-text-placeholder font-mono bg-subtle border border-default rounded px-1.5 py-0.5">
                                                        {Number(group.rate).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €/h
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-text-muted">
                                                {group.totalHours.toFixed(1)} h · {group.entries.length} {group.entries.length === 1 ? 'Eintrag' : 'Einträge'}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-black font-mono text-text-primary text-sm">{fmt(group.totalCost)}</div>
                                            {totalRevenue > 0 && (
                                                <div className="text-[10px] text-text-placeholder mt-0.5">{groupBudgetUsage} % des Budgets</div>
                                            )}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-default overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-subtle/60 text-[10px] text-text-placeholder uppercase tracking-widest font-semibold">
                                                    <tr>
                                                        <th className="px-5 py-2.5 text-left font-semibold w-28">Datum</th>
                                                        <th className="px-5 py-2.5 text-left font-semibold">Mitarbeiter</th>
                                                        <th className="px-5 py-2.5 text-left font-semibold">Beschreibung</th>
                                                        <th className="px-5 py-2.5 text-right font-semibold w-20">Stunden</th>
                                                        <th className="px-5 py-2.5 text-right font-semibold w-28">Kosten</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-default">
                                                    {group.entries.map((entry: any) => (
                                                        <tr key={entry.id} className="hover:bg-subtle/30 transition">
                                                            <td className="px-5 py-3 text-xs font-mono text-text-muted whitespace-nowrap">
                                                                {new Date(entry.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                            </td>
                                                            <td className="px-5 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <UserAvatar
                                                                        src={entry.employees?.avatar_url}
                                                                        name={entry.employees?.name}
                                                                        initials={entry.employees?.initials}
                                                                        size="xs"
                                                                    />
                                                                    <span className="text-xs font-medium text-text-secondary whitespace-nowrap">{entry.employees?.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-3 text-xs text-text-secondary max-w-xs truncate" title={entry.description}>
                                                                {entry.description || <span className="text-text-placeholder italic">–</span>}
                                                            </td>
                                                            <td className="px-5 py-3 text-right font-mono text-xs text-text-primary font-bold">
                                                                {Number(entry.hours).toFixed(2)} h
                                                            </td>
                                                            <td className="px-5 py-3 text-right font-mono text-xs text-text-muted">
                                                                {fmt(entry.cost)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-subtle/40 border-t border-default">
                                                    <tr>
                                                        <td colSpan={3} className="px-5 py-2.5 text-[10px] font-bold text-text-placeholder uppercase tracking-widest">Gesamt</td>
                                                        <td className="px-5 py-2.5 text-right font-mono text-xs font-bold text-text-primary">{group.totalHours.toFixed(2)} h</td>
                                                        <td className="px-5 py-2.5 text-right font-mono text-xs font-bold text-text-primary">{fmt(group.totalCost)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Kalkulations-Positionen ───────────────────── */}
            {sections.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Kalkulation (Angebot)</h3>
                    <div className="bg-surface rounded-2xl border border-default overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-subtle/60 text-[10px] text-text-placeholder uppercase tracking-widest font-semibold">
                                <tr>
                                    <th className="px-5 py-2.5 text-left font-semibold">Sektion / Position</th>
                                    <th className="px-5 py-2.5 text-right font-semibold w-24">Menge</th>
                                    <th className="px-5 py-2.5 text-right font-semibold w-28">Einzelpreis</th>
                                    <th className="px-5 py-2.5 text-right font-semibold w-28">Gesamt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sections.map((section: any) => (
                                    <React.Fragment key={section.id}>
                                        <tr className="bg-subtle/40">
                                            <td colSpan={4} className="px-5 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">
                                                {section.title}
                                            </td>
                                        </tr>
                                        {(section.positions || []).map((pos: any) => (
                                            <tr key={pos.id} className="hover:bg-subtle/20 transition divide-y divide-default border-t border-default/50">
                                                <td className="px-5 py-3 text-text-primary">{pos.title}</td>
                                                <td className="px-5 py-3 text-right font-mono text-xs text-text-muted">{pos.quantity} {pos.unit}</td>
                                                <td className="px-5 py-3 text-right font-mono text-xs text-text-muted">{fmt(pos.unit_price)}</td>
                                                <td className="px-5 py-3 text-right font-mono text-sm font-bold text-text-primary">
                                                    {fmt((pos.quantity || 0) * (pos.unit_price || 0))}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-default bg-subtle/60">
                                <tr>
                                    <td colSpan={3} className="px-5 py-3 font-bold text-text-primary text-sm">Angebotssumme</td>
                                    <td className="px-5 py-3 text-right font-black font-mono text-text-primary">{fmt(totalRevenue)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
