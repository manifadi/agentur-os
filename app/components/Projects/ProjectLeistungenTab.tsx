import React, { useState, useEffect } from 'react';
import { Plus, X, Copy, Save, Edit2, Download, PackageOpen } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import PositionEditModal from '../Modals/PositionEditModal';
import CalculationImportModal from '../Modals/CalculationImportModal';

interface WizardSection {
    id: string;
    title: string;
    description: string;
    positions: WizardPosition[];
}

interface WizardPosition {
    id: string;
    title: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    isExternal: boolean;
    purchasePrice: number;
}

interface ProjectLeistungenTabProps {
    projectId: string;
    organizationId: string;
    initialSections: any[];
    onSaved: () => void;
}

export default function ProjectLeistungenTab({ projectId, organizationId, initialSections, onSaved }: ProjectLeistungenTabProps) {
    const [sections, setSections] = useState<WizardSection[]>([]);
    const [saving, setSaving] = useState(false);
    const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<{ sIdx: number; pIdx: number; data: WizardPosition } | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    useEffect(() => {
        setSections(mapSections(initialSections));
    }, [initialSections]);

    const mapSections = (raw: any[]): WizardSection[] =>
        (raw || []).map((s: any) => ({
            id: s.id,
            title: s.title || '',
            description: s.description || '',
            positions: (s.positions || [])
                .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((p: any) => ({
                    id: p.id,
                    title: p.title || '',
                    description: p.description || '',
                    quantity: p.quantity || 0,
                    unit: p.unit || 'Stunden',
                    unitPrice: p.unit_price || 0,
                    isExternal: p.is_external || false,
                    purchasePrice: p.purchase_price || 0,
                })),
        }));

    const calculateTotal = () =>
        sections.reduce((sum, s) => sum + s.positions.reduce((ps, p) => ps + p.quantity * p.unitPrice, 0), 0);

    const addSection = () => {
        setSections([...sections, { id: 'TEMP_' + Date.now(), title: '', description: '', positions: [] }]);
    };

    const removeSection = (index: number) => {
        const next = [...sections];
        next.splice(index, 1);
        setSections(next);
    };

    const duplicateSection = (index: number) => {
        const copy: WizardSection = {
            ...JSON.parse(JSON.stringify(sections[index])),
            id: 'TEMP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: `${sections[index].title} (Kopie)`,
            positions: sections[index].positions.map((p) => ({
                ...JSON.parse(JSON.stringify(p)),
                id: 'TEMP_POS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            })),
        };
        const next = [...sections];
        next.splice(index + 1, 0, copy);
        setSections(next);
    };

    const updateSection = (index: number, field: keyof WizardSection, value: any) => {
        const next = [...sections];
        (next[index] as any)[field] = value;
        setSections(next);
    };

    const addPosition = (sectionIndex: number) => {
        const next = [...sections];
        next[sectionIndex].positions.push({
            id: 'TEMP_POS_' + Date.now(),
            title: '',
            description: '',
            quantity: 0,
            unit: 'Stunden',
            unitPrice: 100,
            isExternal: false,
            purchasePrice: 0,
        });
        setSections(next);
    };

    const removePosition = (sectionIndex: number, posIndex: number) => {
        const next = [...sections];
        next[sectionIndex].positions.splice(posIndex, 1);
        setSections(next);
    };

    const duplicatePosition = (sectionIndex: number, posIndex: number) => {
        const copy: WizardPosition = {
            ...JSON.parse(JSON.stringify(sections[sectionIndex].positions[posIndex])),
            id: 'TEMP_POS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: `${sections[sectionIndex].positions[posIndex].title} (Kopie)`,
        };
        const next = [...sections];
        next[sectionIndex].positions.splice(posIndex + 1, 0, copy);
        setSections(next);
    };

    const updatePosition = (sectionIndex: number, posIndex: number, field: keyof WizardPosition, value: any) => {
        const next = [...sections];
        (next[sectionIndex].positions[posIndex] as any)[field] = value;
        setSections(next);
    };

    const handleSavePosition = (updatedPos: WizardPosition) => {
        if (!editingPosition) return;
        const next = [...sections];
        next[editingPosition.sIdx].positions[editingPosition.pIdx] = updatedPos;
        setSections(next);
        setIsPositionModalOpen(false);
        setEditingPosition(null);
    };

    const handleImportCalculation = (importedSections: any[]) => {
        const next = [...sections];
        importedSections.forEach((importData) => {
            const mappedPositions = importData.positions.map((p: any) => ({
                id: 'TEMP_POS_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                title: p.title,
                description: p.description || '',
                quantity: p.quantity || 0,
                unit: p.unit || 'Stunden',
                unitPrice: p.unit_price || 0,
            }));
            if (importData.isFullSection) {
                next.push({
                    id: 'TEMP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    title: `${importData.title} (Imported)`,
                    description: importData.description || '',
                    positions: mappedPositions,
                });
            } else if (next.length > 0) {
                next[next.length - 1].positions.push(...mappedPositions);
            } else {
                next.push({
                    id: 'TEMP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    title: 'Importierte Positionen',
                    description: '',
                    positions: mappedPositions,
                });
            }
        });
        setSections(next);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await supabase.from('project_positions').delete().eq('project_id', projectId);
            await supabase.from('project_sections').delete().eq('project_id', projectId);

            for (let i = 0; i < sections.length; i++) {
                const s = sections[i];
                const { data: sectionData, error: secError } = await supabase
                    .from('project_sections')
                    .insert([{
                        project_id: projectId,
                        organization_id: organizationId,
                        title: s.title,
                        description: s.description,
                        order_index: i,
                    }])
                    .select()
                    .single();

                if (secError) throw secError;

                if (sectionData && s.positions.length > 0) {
                    const positionsToInsert = s.positions.map((p, idx) => ({
                        project_id: projectId,
                        organization_id: organizationId,
                        section_id: sectionData.id,
                        title: p.title,
                        description: p.description,
                        quantity: p.quantity,
                        unit: p.unit,
                        unit_price: p.unitPrice,
                        is_external: p.isExternal,
                        purchase_price: p.purchasePrice,
                        order_index: idx,
                        position_nr: `${i + 1}.${idx + 1}`,
                    }));
                    const { error: posError } = await supabase.from('project_positions').insert(positionsToInsert);
                    if (posError) throw posError;
                }
            }

            onSaved();
        } catch (e) {
            console.error('Error saving leistungen:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8 pb-24">
            <div className="flex justify-between items-end border-b border-default pb-4">
                <div>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-accent-subtle text-accent rounded-xl text-xs font-bold hover:bg-blue-100 transition shadow-sm border border-accent-subtle"
                    >
                        <Download size={14} strokeWidth={2.5} /> Importieren
                    </button>
                </div>
                <div className="text-right">
                    <div className="text-xs text-text-muted uppercase font-bold tracking-wider">Gesamtsumme</div>
                    <div className="text-2xl font-bold text-text-primary">
                        {calculateTotal().toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {sections.map((section, sIdx) => (
                    <div key={section.id} className="bg-surface rounded-2xl border border-default overflow-hidden shadow-sm hover:shadow-md transition">
                        <div className="bg-subtle/50 p-4 border-b border-default flex gap-4 items-start group">
                            <div className="flex-1 space-y-2">
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-none p-0 text-lg font-bold text-text-primary placeholder-gray-400 focus:ring-0"
                                    placeholder="Sektion Titel (z.B. Konzeption)"
                                    value={section.title}
                                    onChange={(e) => updateSection(sIdx, 'title', e.target.value)}
                                />
                                <textarea
                                    className="w-full bg-transparent border-none p-0 text-sm text-text-secondary placeholder-gray-400 focus:ring-0 resize-none"
                                    placeholder="Beschreibung / Vertragstext für diesen Abschnitt..."
                                    rows={1}
                                    value={section.description}
                                    onChange={(e) => updateSection(sIdx, 'description', e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                    onClick={() => duplicateSection(sIdx)}
                                    className="p-2 text-text-placeholder hover:text-accent transition"
                                    title="Sektion duplizieren"
                                >
                                    <Copy size={16} />
                                </button>
                                <button
                                    onClick={() => removeSection(sIdx)}
                                    className="p-2 text-text-placeholder hover:text-red-500 transition"
                                    title="Sektion löschen"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-text-muted uppercase font-semibold border-b border-default">
                                    <tr>
                                        <th className="text-left py-2 pl-2 w-12">Pos.</th>
                                        <th className="text-left py-2 w-1/3">Leistung</th>
                                        <th className="text-left py-2">Beschreibung</th>
                                        <th className="text-right py-2 w-20">Menge</th>
                                        <th className="text-left py-2 w-24 pl-2">Einheit</th>
                                        <th className="text-right py-2 w-24">EK (€)</th>
                                        <th className="text-right py-2 w-24">VK (€)</th>
                                        <th className="text-right py-2 w-24">Gesamt</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {section.positions.map((pos, pIdx) => (
                                        <tr key={pos.id} className={`group hover:bg-subtle/50 ${pos.isExternal ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`}>
                                            <td className="py-2 pl-2">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="text-text-placeholder font-mono text-xs">{sIdx + 1}.{pIdx + 1}</span>
                                                    {pos.isExternal && (
                                                        <span className="flex items-center gap-0.5 text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-md leading-none">
                                                            <PackageOpen size={8} /> FL
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-surface focus:ring-1 focus:ring-accent rounded font-medium"
                                                    placeholder="Leistung..."
                                                    value={pos.title}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'title', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-surface focus:ring-1 focus:ring-accent rounded text-text-muted"
                                                    placeholder="Details..."
                                                    value={pos.description}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-2 text-right">
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-surface focus:ring-1 focus:ring-accent rounded text-right font-mono"
                                                    value={pos.quantity}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="py-2 pl-2">
                                                <select
                                                    className="w-full bg-transparent border-none p-1 focus:bg-surface focus:ring-1 focus:ring-accent rounded text-xs"
                                                    value={pos.unit}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'unit', e.target.value)}
                                                >
                                                    <option>Stunden</option>
                                                    <option>Tage</option>
                                                    <option>Pauschal</option>
                                                    <option>Stk.</option>
                                                </select>
                                            </td>
                                            {/* EK — only editable for Fremdleistungen */}
                                            <td className="py-2 text-right">
                                                {pos.isExternal ? (
                                                    <input
                                                        type="number"
                                                        className="w-full bg-transparent border-none p-1 focus:bg-surface focus:ring-1 focus:ring-orange-400 rounded text-right font-mono text-orange-600 dark:text-orange-400"
                                                        value={pos.purchasePrice}
                                                        onChange={(e) => updatePosition(sIdx, pIdx, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                                        placeholder="0"
                                                    />
                                                ) : (
                                                    <span className="text-text-placeholder/30 text-xs">—</span>
                                                )}
                                            </td>
                                            {/* VK */}
                                            <td className="py-2 text-right">
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent border-none p-1 focus:bg-surface focus:ring-1 focus:ring-accent rounded text-right font-mono"
                                                    value={pos.unitPrice}
                                                    onChange={(e) => updatePosition(sIdx, pIdx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="py-2 text-right font-medium text-text-primary">
                                                {(pos.quantity * pos.unitPrice).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                            </td>
                                            <td className="py-2 px-1 text-center opacity-0 group-hover:opacity-100 transition">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPosition({ sIdx, pIdx, data: pos });
                                                            setIsPositionModalOpen(true);
                                                        }}
                                                        className="text-text-placeholder hover:text-accent"
                                                        title="Position bearbeiten"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => duplicatePosition(sIdx, pIdx)}
                                                        className="text-text-placeholder hover:text-accent"
                                                        title="Position duplizieren"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => removePosition(sIdx, pIdx)}
                                                        className="text-text-placeholder hover:text-red-500"
                                                        title="Position löschen"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                onClick={() => addPosition(sIdx)}
                                className="mt-2 text-xs font-bold text-accent hover:text-blue-700 flex items-center gap-1 py-1 px-2 hover:bg-accent-subtle rounded transition"
                            >
                                <Plus size={12} /> Position hinzufügen
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    onClick={addSection}
                    className="w-full py-4 border-2 border-dashed border-default rounded-2xl text-text-placeholder font-bold hover:border-default hover:text-text-secondary transition flex items-center justify-center gap-2"
                >
                    <Plus size={20} /> Neue Sektion hinzufügen
                </button>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/90 backdrop-blur-sm border-t border-default z-10 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-text-primary text-surface px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50 shadow-lg"
                >
                    <Save size={16} />
                    {saving ? 'Speichert...' : 'Speichern'}
                </button>
            </div>

            <PositionEditModal
                isOpen={isPositionModalOpen}
                onClose={() => {
                    setIsPositionModalOpen(false);
                    setEditingPosition(null);
                }}
                onSave={handleSavePosition}
                position={editingPosition?.data || null}
            />

            <CalculationImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportCalculation}
                currentProjectId={projectId}
            />
        </div>
    );
}
