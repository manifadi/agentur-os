import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface ProjectReportingTabProps {
    projectId: string;
    timeEntries: any[];
    sections: any[];
    onOpenRatesSidebar: () => void;
}

export default function ProjectReportingTab({ projectId, timeEntries: timeEntriesProp, sections, onOpenRatesSidebar }: ProjectReportingTabProps) {
    const [timeEntries, setTimeEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (projectId) {
            fetchTimeEntries();
        }
    }, [projectId]);

    const fetchTimeEntries = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('time_entries')
            .select(`*, employees(id, name, initials, hourly_rate), agency_positions(id, title, hourly_rate)`)
            .eq('project_id', projectId);
        if (data) setTimeEntries(data);
        setLoading(false);
    };

    const totalRevenue = sections.reduce((sum, s) => {
        const positions = s.positions || [];
        return sum + positions.reduce((ps: number, p: any) => ps + (p.quantity || 0) * (p.unit_price || 0), 0);
    }, 0);

    const positionGroups = timeEntries.reduce((acc: any[], t: any) => {
        const positionTitle = t.agency_positions?.title || t.employees?.job_title || 'Ohne Position';

        let group = acc.find((g) => g.title === positionTitle);
        if (!group) {
            group = { title: positionTitle, entries: [], totalHours: 0, totalCost: 0 };
            acc.push(group);
        }

        const h = Number(t.hours) || 0;
        const rate = t.employees?.hourly_rate || t.agency_positions?.hourly_rate || 0;
        const cost = h * rate;

        group.entries.push({ ...t, cost, rate });
        group.totalHours += h;
        group.totalCost += cost;
        return acc;
    }, []);

    const totalCost = positionGroups.reduce((acc: number, g: any) => acc + g.totalCost, 0);
    const margin = totalRevenue - totalCost;

    const toggleGroup = (title: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }
            return next;
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-end">
                <button
                    onClick={onOpenRatesSidebar}
                    className="flex items-center gap-2 px-4 py-2 bg-subtle border border-default rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-hover transition"
                >
                    <Clock size={14} />
                    Stundensätze
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-subtle rounded-2xl p-6 border border-default flex flex-col justify-center items-center text-center">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-bold mb-2">Umsatz (Geplant)</span>
                    <div className="text-3xl font-bold text-text-primary">
                        {totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                </div>
                <div className="bg-subtle rounded-2xl p-6 border border-default flex flex-col justify-center items-center text-center">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-bold mb-2">Kosten (Ist)</span>
                    <div className="text-3xl font-bold text-text-primary">
                        {totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                </div>
                <div className={`rounded-2xl p-6 border flex flex-col justify-center items-center text-center ${margin >= 0 ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                    <span className="text-xs opacity-70 uppercase tracking-wider font-bold mb-2">Marge / Gewinn</span>
                    <div className="text-3xl font-bold">
                        {margin.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center text-text-placeholder py-10 bg-subtle rounded-2xl border border-dashed border-default animate-pulse text-sm">
                        Lädt...
                    </div>
                ) : positionGroups.length === 0 ? (
                    <div className="text-center text-text-placeholder py-10 bg-subtle rounded-2xl border border-dashed border-default text-sm">
                        Noch keine Zeiten erfasst.
                    </div>
                ) : (
                    positionGroups.map((group: any) => {
                        const isExpanded = expandedGroups.has(group.title);
                        return (
                            <div key={group.title} className="bg-surface rounded-2xl border border-default overflow-hidden shadow-sm">
                                <button
                                    className="w-full bg-subtle/50 p-4 border-b border-default flex justify-between items-center hover:bg-subtle/80 transition"
                                    onClick={() => toggleGroup(group.title)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-1 bg-text-primary rounded-full shrink-0" />
                                        <div className="text-left">
                                            <h3 className="font-bold text-text-primary">{group.title}</h3>
                                            <div className="text-xs text-text-muted">
                                                {group.entries?.[0]?.rate
                                                    ? `${Number(group.entries[0].rate).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €/h`
                                                    : 'Kein Satz'}{' '}
                                                ({group.entries.length} {group.entries.length === 1 ? 'Eintrag' : 'Einträge'})
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-text-primary">
                                            {group.totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                        </div>
                                        <div className="text-xs text-text-muted">{group.totalHours.toFixed(2)} Std. gesamt</div>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-surface text-xs text-text-placeholder uppercase font-medium border-b border-default">
                                                <tr>
                                                    <th className="px-6 py-3 font-normal w-32">Datum</th>
                                                    <th className="px-6 py-3 font-normal">Mitarbeiter</th>
                                                    <th className="px-6 py-3 font-normal">Beschreibung</th>
                                                    <th className="px-6 py-3 text-right font-normal">Zeit</th>
                                                    <th className="px-6 py-3 text-right font-normal">Kosten (Intern)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {group.entries.map((entry: any) => (
                                                    <tr key={entry.id} className="hover:bg-subtle/30 transition">
                                                        <td className="px-6 py-3 whitespace-nowrap text-text-muted font-mono text-xs">
                                                            {new Date(entry.date).toLocaleDateString('de-DE')}
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-hover text-[9px] font-bold flex items-center justify-center text-text-secondary shrink-0">
                                                                    {entry.employees?.initials}
                                                                </div>
                                                                <span className="text-text-primary text-xs font-medium">{entry.employees?.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-text-secondary max-w-[300px] truncate" title={entry.description}>
                                                            {entry.description || '-'}
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono text-text-secondary">
                                                            {Number(entry.hours).toFixed(2)} h
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-mono text-text-placeholder text-xs">
                                                            {entry.cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
