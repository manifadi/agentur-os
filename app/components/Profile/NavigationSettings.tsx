'use client';
import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Eye, EyeOff, Check } from 'lucide-react';
import { Employee, SidebarItemId, ALL_SIDEBAR_ITEMS, DEFAULT_SIDEBAR_ITEMS } from '../../types';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';

interface Props {
    currentUser: Employee;
    onUpdate: () => void;
}

export default function NavigationSettings({ currentUser, onUpdate }: Props) {
    // Aktuelle Sidebar-Items + nicht-aktive (für reorder-toggle)
    const initial = currentUser.dashboard_config?.sidebar_items ?? DEFAULT_SIDEBAR_ITEMS;
    const [items, setItems] = useState<SidebarItemId[]>(initial);
    const [saving, setSaving] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    useEffect(() => {
        setItems(currentUser.dashboard_config?.sidebar_items ?? DEFAULT_SIDEBAR_ITEMS);
    }, [currentUser.id]);

    const hiddenItems = ALL_SIDEBAR_ITEMS.filter(i => !items.includes(i.id));

    const moveUp = (idx: number) => {
        if (idx === 0) return;
        const copy = [...items];
        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
        setItems(copy);
    };

    const moveDown = (idx: number) => {
        if (idx === items.length - 1) return;
        const copy = [...items];
        [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
        setItems(copy);
    };

    const toggleItem = (id: SidebarItemId) => {
        if (items.includes(id)) {
            setItems(items.filter(i => i !== id));
        } else {
            setItems([...items, id]);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const newConfig = {
            ...(currentUser.dashboard_config || { widgets: [] }),
            sidebar_items: items,
        };
        const { error } = await supabase.from('employees')
            .update({ dashboard_config: newConfig })
            .eq('id', currentUser.id);
        setSaving(false);
        if (error) {
            toast.error(`Speichern fehlgeschlagen: ${error.message}`);
            return;
        }
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
        onUpdate();
    };

    const handleReset = () => {
        setItems(DEFAULT_SIDEBAR_ITEMS);
    };

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sichtbare Einträge</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Reihenfolge mit Pfeilen ändern. Klick auf Auge ausblenden.
                </p>
                <div className="space-y-1.5">
                    {items.map((id, idx) => {
                        const meta = ALL_SIDEBAR_ITEMS.find(i => i.id === id);
                        if (!meta) return null;
                        return (
                            <div key={id} className="flex items-center gap-2 p-3 rounded-xl"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                            >
                                <span className="text-xs font-bold tabular-nums w-5" style={{ color: 'var(--text-muted)' }}>{idx + 1}.</span>
                                <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
                                <button onClick={() => moveUp(idx)} disabled={idx === 0}
                                    className="p-1.5 rounded-lg disabled:opacity-30"
                                    style={{ color: 'var(--text-muted)' }}
                                    title="nach oben"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                                    className="p-1.5 rounded-lg disabled:opacity-30"
                                    style={{ color: 'var(--text-muted)' }}
                                    title="nach unten"
                                >
                                    <ChevronDown size={14} />
                                </button>
                                <button onClick={() => toggleItem(id)}
                                    className="p-1.5 rounded-lg"
                                    style={{ color: 'var(--text-muted)' }}
                                    title="ausblenden"
                                >
                                    <Eye size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {hiddenItems.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Verfügbar (ausgeblendet)</h3>
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                        Klick auf Auge um in der Sidebar einzublenden.
                    </p>
                    <div className="space-y-1.5">
                        {hiddenItems.map(meta => (
                            <div key={meta.id} className="flex items-center gap-2 p-3 rounded-xl opacity-60"
                                style={{ background: 'var(--bg-subtle)', border: '1px dashed var(--border-default)' }}
                            >
                                <span className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>{meta.label}</span>
                                <button onClick={() => toggleItem(meta.id)}
                                    className="p-1.5 rounded-lg"
                                    style={{ color: 'var(--accent)' }}
                                    title="einblenden"
                                >
                                    <EyeOff size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={handleReset}
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                >
                    Auf Standard zurücksetzen
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5"
                    style={{
                        background: savedFlash ? '#22c55e' : 'var(--accent)',
                        color: 'var(--accent-text)',
                    }}
                >
                    {savedFlash ? <><Check size={13} /> Gespeichert</> : saving ? '...' : 'Speichern'}
                </button>
            </div>
        </div>
    );
}
