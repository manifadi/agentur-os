import React, { useState, useRef } from 'react';
import { Clock, Plus, ImageIcon, X, Pencil, Trash2, Lock, Globe } from 'lucide-react';
import { ProjectLog } from '../../types';
import ConfirmModal from '../Modals/ConfirmModal';
import UserAvatar from '../UI/UserAvatar';

interface LogbookProps {
    logs: ProjectLog[];
    onAdd: (title: string, content: string, date: string, images: string[], isPublic: boolean) => Promise<void>;
    onUpdate: (id: string, title: string, content: string, date: string, images: string[], isPublic: boolean) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onUploadImage: (file: File) => Promise<string>;
    currentEmployeeId?: string;
}

export default function Logbook({ logs, onAdd, onUpdate, onDelete, onUploadImage, currentEmployeeId }: LogbookProps) {
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
        if (!newTitle.trim()) return;
        await onAdd(newTitle, newContent, newDate || new Date().toISOString(), newImages, newIsPublic);
        setNewTitle(''); setNewContent(''); setNewImages([]); setIsAdding(false); setNewIsPublic(false);
    };

    const handleSaveEdit = async (id: string) => {
        if (!editTitle.trim()) return;
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
        <div className="flex flex-col h-[500px] lg:h-full bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 overflow-hidden order-2 lg:order-1">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock size={20} className="text-gray-400" /> Logbuch</h2>

            {isAdding && (
                <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <input type="date" className="w-full bg-transparent border-none text-xs text-gray-500 font-bold mb-2 focus:ring-0 p-0" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    <input type="text" placeholder="Titel" className="w-full bg-transparent border-none text-sm font-semibold mb-2 focus:ring-0 p-0" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    <textarea placeholder="Text..." className="w-full bg-transparent border-none text-sm text-gray-600 resize-none focus:ring-0 p-0 h-24" value={newContent} onChange={(e) => setNewContent(e.target.value)} onPaste={handlePaste} />

                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => setNewIsPublic(!newIsPublic)}
                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-xl border transition ${newIsPublic ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
                        >
                            {newIsPublic ? <Globe size={10} /> : <Lock size={10} />}
                            {newIsPublic ? 'Für alle sichtbar' : 'Nur für mich'}
                        </button>
                    </div>

                    {uploading && <div className="text-xs text-blue-500 mb-2">Lade Bilder hoch...</div>}
                    {newImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {newImages.map((url, i) => (
                                <div key={i} className="relative w-16 h-16 group">
                                    <img src={url} className="w-full h-full object-cover rounded-xl border border-gray-200" />
                                    <button onClick={() => setNewImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-xl p-0.5 shadow-sm hover:bg-red-600 transition">
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-between items-center mt-2 border-t border-gray-200 pt-2">
                        <button onClick={() => logImageRef.current?.click()} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition"><ImageIcon size={16} /></button>
                        <input type="file" accept="image/*" multiple ref={logImageRef} className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files, false)} />
                        <div className="flex gap-2">
                            <button onClick={() => setIsAdding(false)} className="text-xs text-gray-500 px-3 py-1 hover:bg-gray-200 rounded-xl">Abbrechen</button>
                            <button onClick={handleSaveNew} disabled={uploading} className="text-xs bg-gray-900 text-white px-3 py-1 rounded-xl shadow-sm disabled:opacity-50">Speichern</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="overflow-y-auto pr-2 space-y-6 flex-1 relative">
                <div className="absolute left-[7px] top-2 bottom-0 w-[1px] bg-gray-100"></div>
                {!isAdding && <button onClick={() => { setIsAdding(true); setNewDate(new Date().toISOString().split('T')[0]); }} className="relative ml-6 mb-4 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition"><Plus size={14} /> Eintrag hinzufügen</button>}

                {logs.map((log) => {
                    const isOwner = log.employee_id === currentEmployeeId || (!log.employee_id && currentEmployeeId);
                    return (
                        <div key={log.id} className="relative pl-6 pb-2 group">
                            <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${log.is_public ? 'bg-green-100' : 'bg-gray-200'}`}>
                                {log.is_public && <div className="absolute inset-0 flex items-center justify-center"><Globe size={7} className="text-green-600" /></div>}
                            </div>
                            {editingId === log.id ? (
                                <div className="bg-gray-50 p-3 rounded-xl border border-blue-200 -ml-2">
                                    <input type="date" className="w-full bg-transparent border-none text-xs text-gray-500 font-bold mb-2 focus:ring-0 p-0" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                                    <input autoFocus type="text" className="w-full bg-transparent border-none text-sm font-semibold mb-1 focus:ring-0 p-0" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                    <textarea className="w-full bg-transparent border-none text-sm text-gray-600 resize-none focus:ring-0 p-0 h-16" value={editContent} onChange={(e) => setEditContent(e.target.value)} />

                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            onClick={() => setEditIsPublic(!editIsPublic)}
                                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded-xl border transition ${editIsPublic ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
                                        >
                                            {editIsPublic ? <Globe size={10} /> : <Lock size={10} />}
                                            {editIsPublic ? 'Für alle sichtbar' : 'Nur für mich'}
                                        </button>
                                    </div>

                                    {editImages.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {editImages.map((url, i) => (
                                                <div key={i} className="relative w-16 h-16 group">
                                                    <img src={url} className="w-full h-full object-cover rounded-xl border border-gray-200" />
                                                    <button onClick={() => setEditImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-xl p-0.5 shadow-sm hover:bg-red-600 transition">
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                                        <button onClick={() => editImageRef.current?.click()} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition"><ImageIcon size={16} /></button>
                                        <input type="file" accept="image/*" multiple ref={editImageRef} className="hidden" onChange={(e) => e.target.files && handleUpload(e.target.files, editingId !== null)} />
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
                                            <button onClick={() => handleSaveEdit(log.id)} disabled={uploading} className="text-xs bg-gray-900 text-white px-3 py-1 rounded-xl shadow-sm disabled:opacity-50">Update</button>
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
                                            <div className="text-xs font-bold text-gray-500">{new Date(log.entry_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</div>
                                        </div>
                                        {!log.is_public && <Lock size={12} className="text-gray-300" />}
                                    </div>
                                    <div className="text-sm font-medium text-gray-900">{log.title}</div>
                                    <div className="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">{renderContentWithLinks(log.content)}</div>

                                    {((log.image_urls && log.image_urls.length > 0) || log.image_url) && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {(log.image_urls && log.image_urls.length > 0 ? log.image_urls : [log.image_url!]).map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                                    <img src={url} className="w-20 h-20 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition cursor-zoom-in" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {isOwner && (
                                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white pl-2">
                                            <button onClick={() => startEditing(log)} className="text-gray-400 hover:text-blue-600 focus:outline-none"><Pencil size={12} /></button>
                                            <button onClick={() => onDelete(log.id)} className="text-gray-400 hover:text-red-500 focus:outline-none"><Trash2 size={12} /></button>
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
