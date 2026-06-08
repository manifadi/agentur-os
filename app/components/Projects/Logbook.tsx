import React, { useState, useRef, useMemo } from 'react';
import { Clock, Plus, ImageIcon, X, Pencil, Trash2, Lock, Globe, List } from 'lucide-react';
import { ProjectLog } from '../../types';
import ConfirmModal from '../Modals/ConfirmModal';
import UserAvatar from '../UI/UserAvatar';
import RichTextEditor from '../UI/RichTextEditor';
import RichTextDisplay from '../UI/RichTextDisplay';
import { toast } from 'sonner';

interface LogbookProps {
    logs: ProjectLog[];
    onAdd: (title: string, content: string, date: string, images: string[], isPublic: boolean) => Promise<void>;
    onUpdate: (id: string, title: string, content: string, date: string, images: string[], isPublic: boolean) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onUploadImage: (file: File) => Promise<string>;
    currentEmployeeId?: string;
}

export default function Logbook({ logs, onAdd, onUpdate, onDelete, onUploadImage, currentEmployeeId }: LogbookProps) {
    // View mode
    const [viewMode, setViewMode] = useState<'date' | 'all'>('date');

    // Sorted unique dates (newest first)
    const sortedDates = useMemo(() => {
        const dates = Array.from(new Set(logs.map(l => l.entry_date.split('T')[0])));
        return dates.sort((a, b) => b.localeCompare(a));
    }, [logs]);

    const latestDate = sortedDates[0] ?? null;
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const effectiveDate = selectedDate ?? latestDate;

    const visibleLogs = useMemo(() => {
        if (viewMode === 'all') return logs;
        if (!effectiveDate) return logs;
        return logs.filter(l => l.entry_date.split('T')[0] === effectiveDate);
    }, [logs, viewMode, effectiveDate]);

    // Add State
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newImages, setNewImages] = useState<string[]>([]);
    const [newIsPublic, setNewIsPublic] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editImages, setEditImages] = useState<string[]>([]);
    const [editIsPublic, setEditIsPublic] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'info' | 'warning' | 'success';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'danger'
    });

    // Refs
    const logImageRef = useRef<HTMLInputElement>(null);
    const editImageRef = useRef<HTMLInputElement>(null);

    // Helper
    const handleUpload = async (files: FileList | File[], isEdit: boolean) => {
        setUploading(true);
        try {
            const uploadPromises = Array.from(files).map(file => onUploadImage(file));
            const urls = await Promise.all(uploadPromises);
            if (isEdit) setEditImages(prev => [...prev, ...urls]);
            else setNewImages(prev => [...prev, ...urls]);
        } catch (e) {
            console.error(e);
            setConfirmConfig({
                isOpen: true,
                title: 'Upload Fehler',
                message: 'Es gab ein Problem beim Hochladen der Bilder. Bitte versuche es erneut.',
                type: 'danger'
            });
        }
        setUploading(false);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (e.clipboardData.files.length > 0) {
            e.preventDefault();
            handleUpload(e.clipboardData.files, editingId !== null);
        }
    };

    const handleSaveNew = async () => {
        if (!newTitle.trim()) { toast.error('Bitte gib einen Titel ein.'); return; }
        await onAdd(newTitle, newContent, newDate || new Date().toISOString(), newImages, newIsPublic);
        setNewTitle(''); setNewContent(''); setNewImages([]); setIsAdding(false); setNewIsPublic(false);
    };

    const handleSaveEdit = async (id: string) => {
        if (!editTitle.trim()) { toast.error('Bitte gib einen Titel ein.'); return; }
        await onUpdate(id, editTitle, editContent, editDate, editImages, editIsPublic);
        setEditingId(null);
    };

    const startEditing = (log: ProjectLog) => {
        setEditingId(log.id);
        setEditTitle(log.title);
        setEditContent(log.content);
        setEditImages(log.image_urls || (log.image_url ? [log.image_url] : []));
        setEditDate(new Date(log.entry_date).toISOString().split('T')[0]);
        setEditIsPublic(log.is_public || false);
    };

    const renderContentWithLinks = (text: string) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all cursor-pointer z-10 relative">
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    // Filter logs for display based on privacy
    // The parent component should only pass allowed logs ideally, but we can double check UI indication here.
    // Actually, the requirement says: "only I see my logs unless public".
    // So if it's NOT public AND not mine, I shouldn't see it.
    // However, the parent will filter what is PASSED to this component.
    // This component just renders what it gets.

    return (
        <div className="flex flex-col h-[500px] lg:h-full bg-surface rounded-2xl p-4 md:p-6 shadow-sm border border-default overflow-hidden order-2 lg:order-1">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Clock size={20} className="text-text-muted" /> Logbuch</h2>
                {logs.length > 0 && (
                    <button
                        onClick={() => setViewMode(v => v === 'date' ? 'all' : 'date')}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-xl border transition ${viewMode === 'all' ? 'bg-subtle border-accent/30 text-accent' : 'border-default text-text-muted hover:text-text-primary'}`}
                    >
                        <List size={12} /> Alle
                    </button>
                )}
            </div>

            {/* Date chips */}
            {viewMode === 'date' && sortedDates.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
                    {sortedDates.map(date => {
                        const label = new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
                        const isSelected = date === effectiveDate;
                        return (
                            <button
                                key={date}
                                onClick={() => setSelectedDate(date)}
                                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-xl border transition font-medium ${
                                    isSelected
                                        ? 'bg-text-primary text-surface border-text-primary'
                                        : 'border-default text-text-secondary hover:border-accent/40 hover:text-text-primary'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}


            {isAdding && (
                <div className="mb-4 bg-subtle p-3 rounded-xl border border-default">
                    <input type="date" className="w-full bg-transparent border-none text-xs text-text-secondary font-bold mb-2 focus:ring-0 p-0" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    <input type="text" placeholder="Titel" className="w-full bg-transparent border-none text-sm font-semibold mb-2 focus:ring-0 p-0 text-text-primary outline-none" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    <div onPaste={handlePaste} className="mb-2">
                        <RichTextEditor
                            value={newContent}
                            onChange={setNewContent}
                            placeholder="Text…"
                            minHeight={90}
                            compact
                        />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => setNewIsPublic(!newIsPublic)}
                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-xl border transition ${newIsPublic ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-subtle border-default text-text-secondary'}`}
                        >
                            {newIsPublic ? <Globe size={10} /> : <Lock size={10} />}
                            {newIsPublic ? 'Für alle sichtbar' : 'Nur für mich'}
                        </button>
                    </div>

                    {uploading && <div className="text-xs text-accent mb-2">Lade Bilder hoch...</div>}
                    {newImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {newImages.map((url, i) => (
                                <div key={i} className="relative w-16 h-16 group">
                                    <img src={url} className="w-full h-full object-cover rounded-xl border border-default" />
                                    <button onClick={() => setNewImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-surface rounded-xl p-0.5 shadow-sm hover:opacity-90 transition">
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-2 border-t border-default pt-2">
                        <button onClick={() => logImageRef.current?.click()} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-hover transition"><ImageIcon size={16} /></button>
                        <input type="file" accept="image/*" multiple ref={logImageRef} className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files, false)} />
                        <div className="flex gap-2">
                            <button onClick={() => setIsAdding(false)} className="text-xs text-text-secondary px-3 py-1 hover:bg-hover rounded-xl">Abbrechen</button>
                            <button onClick={handleSaveNew} disabled={uploading} className="text-xs bg-text-primary text-surface px-3 py-1 rounded-xl shadow-sm disabled:opacity-50">Speichern</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-y-auto pr-2 space-y-6 flex-1 relative">
                <div className="absolute left-[7px] top-2 bottom-0 w-[1px] bg-default"></div>
                {!isAdding && <button onClick={() => { setIsAdding(true); setNewDate(new Date().toISOString().split('T')[0]); }} className="relative ml-6 mb-4 flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition"><Plus size={14} /> Eintrag hinzufügen</button>}

                {!isAdding && logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-subtle border border-default flex items-center justify-center mb-3 shadow-sm">
                            <Clock size={22} className="text-text-placeholder" />
                        </div>
                        <p className="text-sm font-semibold text-text-primary mb-1">Noch keine Einträge</p>
                        <p className="text-xs text-text-secondary mb-4">Halte Fortschritte, Ergebnisse und Notizen im Logbuch fest.</p>
                        <button
                            onClick={() => { setIsAdding(true); setNewDate(new Date().toISOString().split('T')[0]); }}
                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-subtle border border-default hover:border-accent hover:text-accent rounded-xl transition-all"
                        >
                            <Plus size={13} /> Ersten Eintrag erstellen
                        </button>
                    </div>
                )}

                {visibleLogs.map((log) => {
                    const isOwner = log.employee_id === currentEmployeeId || (!log.employee_id && currentEmployeeId);
                    return (
                        <div key={log.id} className="relative pl-6 pb-2 group">
                            <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-surface ${log.is_public ? 'bg-green-500/20' : 'bg-subtle'}`}>
                                {log.is_public && <div className="absolute inset-0 flex items-center justify-center"><Globe size={7} className="text-green-500" /></div>}
                            </div>
                            {editingId === log.id ? (
                                <div className="bg-subtle p-3 rounded-xl border border-accent/20 -ml-2">
                                    <input type="date" className="w-full bg-transparent border-none text-xs text-text-secondary font-bold mb-2 focus:ring-0 p-0" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                                    <input autoFocus type="text" className="w-full bg-transparent border-none text-sm font-semibold mb-1 focus:ring-0 p-0 text-text-primary outline-none" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                    <div className="mb-2">
                                        <RichTextEditor
                                            value={editContent}
                                            onChange={setEditContent}
                                            placeholder="Inhalt"
                                            minHeight={80}
                                            compact
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            onClick={() => setEditIsPublic(!editIsPublic)}
                                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-xl border transition ${editIsPublic ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-subtle border-default text-text-secondary'}`}
                                        >
                                            {editIsPublic ? <Globe size={10} /> : <Lock size={10} />}
                                            {editIsPublic ? 'Für alle sichtbar' : 'Nur für mich'}
                                        </button>
                                    </div>

                                    {editImages.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {editImages.map((url, i) => (
                                                <div key={i} className="relative w-16 h-16 group">
                                                    <img src={url} className="w-full h-full object-cover rounded-xl border border-default" />
                                                    <button onClick={() => setEditImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-surface rounded-xl p-0.5 shadow-sm hover:opacity-90 transition">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-default">
                                        <button onClick={() => editImageRef.current?.click()} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-hover transition"><ImageIcon size={16} /></button>
                                        <input type="file" accept="image/*" multiple ref={editImageRef} className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files, editingId !== null)} />
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingId(null)} className="text-xs text-text-secondary hover:text-text-primary">Abbrechen</button>
                                            <button onClick={() => handleSaveEdit(log.id)} disabled={uploading} className="text-xs bg-text-primary text-surface px-3 py-1 rounded-xl shadow-sm disabled:opacity-50">Update</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="pr-4 relative">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            {log.employees && (
                                                <UserAvatar
                                                    src={log.employees.avatar_url}
                                                    name={log.employees.name}
                                                    initials={log.employees.initials}
                                                    size="xs"
                                                />
                                            )}
                                            <div className="text-xs font-bold text-text-secondary">{new Date(log.entry_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</div>
                                        </div>
                                        {!log.is_public && <Lock size={12} className="text-text-muted" />}
                                    </div>
                                    <div className="text-sm font-medium text-text-primary">{log.title}</div>
                                    <RichTextDisplay html={log.content} className="mt-1" />


                                    {((log.image_urls && log.image_urls.length > 0) || log.image_url) && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {(log.image_urls && log.image_urls.length > 0 ? log.image_urls : [log.image_url!]).map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                                    <img src={url} className="w-20 h-20 object-cover rounded-xl border border-default hover:opacity-80 transition cursor-zoom-in" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {isOwner && (
                                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-surface pl-2">
                                            <button onClick={() => startEditing(log)} className="text-text-muted hover:text-accent focus:outline-none"><Pencil size={12} /></button>
                                            <button onClick={() => onDelete(log.id)} className="text-text-muted hover:text-red-500 focus:outline-none"><Trash2 size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                onConfirm={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                showCancel={false}
                type={confirmConfig.type}
                confirmText="OK"
            />
        </div>
    );
}
