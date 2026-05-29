import React, { useState, useEffect } from 'react';
import { Department } from '../../types';
import { supabase } from '../../supabaseClient';
import { Building2, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../Modals/ConfirmModal';

interface Props {
    departments: Department[];
    organizationId: string;
    onUpdate: () => void;
}

// Eine Abteilungs-Zeile mit Inline-Umbenennung (speichert bei Blur/Enter).
function DeptRow({ dept, onRename, onDelete }: {
    dept: Department;
    onRename: (id: string, name: string) => Promise<void>;
    onDelete: (dept: Department) => void;
}) {
    const [name, setName] = useState(dept.name);
    const [saving, setSaving] = useState(false);

    useEffect(() => { setName(dept.name); }, [dept.name]);

    const commit = async () => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === dept.name) { setName(dept.name); return; }
        setSaving(true);
        await onRename(dept.id, trimmed);
        setSaving(false);
    };

    return (
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <Building2 size={15} className="text-text-muted shrink-0" />
            <input
                className="input-field flex-1"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={commit}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            {saving && <Loader2 size={14} className="animate-spin text-text-muted shrink-0" />}
            <button
                onClick={() => onDelete(dept)}
                className="btn-ghost p-2 shrink-0"
                title="Abteilung löschen"
            >
                <Trash2 size={15} />
            </button>
        </div>
    );
}

export default function AdminDepartmentManagement({ departments, organizationId, onUpdate }: Props) {
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [toDelete, setToDelete] = useState<Department | null>(null);

    const sorted = [...departments].sort((a, b) => a.name.localeCompare(b.name, 'de'));

    const handleAdd = async () => {
        const name = newName.trim();
        if (!name) return;
        if (sorted.some(d => d.name.toLowerCase() === name.toLowerCase())) {
            toast.warning('Diese Abteilung existiert bereits.');
            return;
        }
        setAdding(true);
        const { error } = await supabase.from('departments').insert([{ name, organization_id: organizationId }]);
        setAdding(false);
        if (error) { toast.error('Fehler: ' + error.message); return; }
        setNewName('');
        toast.success(`Abteilung „${name}" angelegt.`);
        onUpdate();
    };

    const handleRename = async (id: string, name: string) => {
        const { error } = await supabase.from('departments').update({ name }).eq('id', id);
        if (error) { toast.error('Fehler: ' + error.message); return; }
        onUpdate();
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        const dept = toDelete;
        setToDelete(null);
        // Zuweisungen lösen, damit kein FK-Konflikt entsteht.
        await supabase.from('employees').update({ department_id: null }).eq('department_id', dept.id);
        const { error } = await supabase.from('departments').delete().eq('id', dept.id);
        if (error) { toast.error('Fehler: ' + error.message); return; }
        toast.success(`Abteilung „${dept.name}" gelöscht.`);
        onUpdate();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-lg font-bold text-text-primary">Abteilungen</h2>
                    <p className="text-sm text-text-muted">Gruppen, denen du Mitarbeiter zuordnen kannst.</p>
                </div>
            </div>

            <div className="bg-surface rounded-xl shadow-sm border border-default overflow-hidden">
                {sorted.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-text-muted">
                        Noch keine Abteilungen. Lege unten die erste an.
                    </div>
                ) : (
                    sorted.map(d => (
                        <DeptRow key={d.id} dept={d} onRename={handleRename} onDelete={setToDelete} />
                    ))
                )}

                {/* Neue Abteilung anlegen */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--bg-subtle)' }}>
                    <Plus size={15} className="text-text-muted shrink-0" />
                    <input
                        className="input-field flex-1"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                        placeholder="Neue Abteilung, z.B. Design"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newName.trim() || adding}
                        className="btn-primary shrink-0"
                    >
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Hinzufügen
                    </button>
                </div>
            </div>

            {toDelete && (
                <ConfirmModal
                    isOpen={true}
                    title="Abteilung löschen?"
                    message={`„${toDelete.name}" wird gelöscht. Zugeordnete Mitarbeiter behalten ihren Eintrag, verlieren aber diese Abteilung.`}
                    onConfirm={handleDelete}
                    onCancel={() => setToDelete(null)}
                    type="danger"
                    confirmText="Löschen"
                />
            )}
        </div>
    );
}
