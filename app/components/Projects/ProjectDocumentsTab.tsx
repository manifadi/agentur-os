import React, { useRef, useState } from 'react';
import { Plus, X, Link as LinkIcon, Upload, ExternalLink, Trash2, FileText, Image as ImageIcon, Video, Server, File, Edit3, Check } from 'lucide-react';
import { Project, ProjectLink } from '../../types';
import { supabase } from '../../supabaseClient';
import { uploadFileToSupabase } from '../../utils/supabaseUtils';

interface ProjectDocumentsTabProps {
    project: Project;
    onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
}

function detectType(url: string): ProjectLink['type'] {
    const lower = url.toLowerCase();
    if (lower.includes('drive.google.com')) return 'google_drive';
    if (lower.includes('docs.google.com') || lower.includes('sheets.google.com') || lower.includes('slides.google.com')) return 'google_doc';
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.svg')) return 'image';
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.avi')) return 'video';
    if (lower.startsWith('smb://') || lower.startsWith('\\\\') || lower.startsWith('afp://')) return 'server';
    return 'link';
}

function getTypeIcon(type: ProjectLink['type']) {
    switch (type) {
        case 'pdf':
            return <div className="w-6 h-6 rounded bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-[10px]">PDF</div>;
        case 'image':
            return <ImageIcon size={18} className="text-purple-500" />;
        case 'video':
            return <Video size={18} className="text-pink-500" />;
        case 'google_drive':
            return <div className="w-6 h-6 rounded bg-green-500/10 text-green-600 flex items-center justify-center font-bold text-[10px]">GD</div>;
        case 'google_doc':
            return <FileText size={18} className="text-blue-500" />;
        case 'server':
            return <Server size={18} className="text-orange-500" />;
        case 'link':
            return <LinkIcon size={18} className="text-text-muted" />;
        case 'other':
        default:
            return <File size={18} className="text-text-muted" />;
    }
}

function getTypeBg(type: ProjectLink['type']): string {
    switch (type) {
        case 'pdf': return 'bg-red-500/10';
        case 'image': return 'bg-purple-500/10';
        case 'video': return 'bg-pink-500/10';
        case 'google_drive': return 'bg-green-500/10';
        case 'google_doc': return 'bg-blue-500/10';
        case 'server': return 'bg-orange-500/10';
        default: return 'bg-subtle';
    }
}

function getTypeLabel(type: ProjectLink['type']): string {
    switch (type) {
        case 'pdf': return 'PDF';
        case 'image': return 'Bild';
        case 'video': return 'Video';
        case 'google_drive': return 'Google Drive';
        case 'google_doc': return 'Google Doc';
        case 'server': return 'Server';
        case 'link': return 'Link';
        case 'other': return 'Datei';
    }
}

export default function ProjectDocumentsTab({ project, onUpdateProject }: ProjectDocumentsTabProps) {
    const [links, setLinks] = useState<ProjectLink[]>((project as any).project_links || []);
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ name: '', url: '' });
    const [uploading, setUploading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const saveLinks = async (newLinks: ProjectLink[]) => {
        setLinks(newLinks);
        await onUpdateProject(project.id, { project_links: newLinks } as any);
    };

    const handleAddLink = async () => {
        if (!addForm.url.trim() || !addForm.name.trim()) return;
        const type = detectType(addForm.url.trim());
        const newLink: ProjectLink = {
            id: crypto.randomUUID(),
            name: addForm.name.trim(),
            url: addForm.url.trim(),
            type,
            created_at: new Date().toISOString(),
        };
        await saveLinks([...links, newLink]);
        setAddForm({ name: '', url: '' });
        setShowAddForm(false);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            setUploading(true);
            const url = await uploadFileToSupabase(file, 'documents');
            const type = detectType(url);
            const nameFallback = file.name || url.split('/').pop() || 'Dokument';
            const newLink: ProjectLink = {
                id: crypto.randomUUID(),
                name: nameFallback,
                url,
                type,
                created_at: new Date().toISOString(),
            };
            await saveLinks([...links, newLink]);
        } catch (error) {
            console.error('Error uploading document:', error);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        await saveLinks(links.filter(l => l.id !== id));
    };

    const handleRename = async (id: string, newName: string) => {
        await saveLinks(links.map(l => l.id === id ? { ...l, name: newName } : l));
        setEditingId(null);
        setEditName('');
    };

    const detectedType = addForm.url ? detectType(addForm.url) : null;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-text-primary">Dokumente & Links</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-subtle hover:bg-accent hover:text-surface text-text-primary border border-default hover:border-accent rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Upload size={13} />
                        Datei hochladen
                    </button>
                    <button
                        onClick={() => { setShowAddForm(!showAddForm); setAddForm({ name: '', url: '' }); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-surface rounded-lg text-xs font-bold transition-all hover:brightness-110 shadow-sm"
                    >
                        <Plus size={13} />
                        Link hinzufügen
                    </button>
                </div>
            </div>

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
            />

            {/* Add Link Form */}
            {showAddForm && (
                <div className="bg-surface border border-default rounded-2xl p-4 mb-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-3 mb-3">
                        <input
                            type="text"
                            placeholder="Name *"
                            value={addForm.name}
                            onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                            className="flex-1 text-sm p-2.5 rounded-xl bg-subtle border border-default focus:border-accent focus:ring-1 focus:ring-accent outline-none text-text-primary placeholder:text-text-placeholder"
                        />
                        <input
                            type="text"
                            placeholder="https://... oder smb://... *"
                            value={addForm.url}
                            onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))}
                            className="flex-1 text-sm p-2.5 rounded-xl bg-subtle border border-default focus:border-accent focus:ring-1 focus:ring-accent outline-none text-text-primary placeholder:text-text-placeholder"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            {detectedType && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${getTypeBg(detectedType)} text-text-secondary`}>
                                    {getTypeLabel(detectedType)}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowAddForm(false); setAddForm({ name: '', url: '' }); }}
                                className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleAddLink}
                                disabled={!addForm.url.trim() || !addForm.name.trim()}
                                className="px-3 py-1.5 bg-accent text-surface rounded-lg text-xs font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content grid */}
            {links.length === 0 && !uploading ? (
                <div className="flex flex-col items-center justify-center text-center py-16 border-2 border-dashed border-default rounded-2xl bg-subtle">
                    <div className="w-14 h-14 bg-surface rounded-full flex items-center justify-center mb-4 shadow-sm border border-default">
                        <Upload size={22} className="text-text-placeholder" />
                    </div>
                    <h4 className="text-sm font-bold text-text-primary mb-1">Noch keine Dokumente</h4>
                    <p className="text-xs text-text-secondary max-w-xs mb-5">
                        Lade Dateien hoch oder füge Links zu Google Drive, PDFs, Bildern und mehr hinzu.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-surface border border-default hover:border-accent text-text-primary hover:text-accent rounded-xl text-xs font-bold transition-colors shadow-sm"
                        >
                            Datei hochladen
                        </button>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-4 py-2 bg-accent text-surface rounded-xl text-xs font-bold hover:brightness-110 transition-all shadow-sm"
                        >
                            Link hinzufügen
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* Uploading placeholder card */}
                    {uploading && (
                        <div className="animate-pulse bg-subtle border border-default rounded-2xl p-4 flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface border border-default" />
                            <div className="h-3 bg-surface rounded w-3/4" />
                            <div className="h-2.5 bg-surface rounded w-1/2" />
                        </div>
                    )}

                    {links.map(link => (
                        <div
                            key={link.id}
                            className="group relative bg-subtle border border-default hover:border-accent/40 rounded-2xl p-4 flex flex-col gap-2 transition-all shadow-sm hover:shadow-md"
                        >
                            {/* Icon / Thumbnail */}
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getTypeBg(link.type)} cursor-pointer`}
                                onClick={() => window.open(link.url, '_blank', 'noreferrer')}
                            >
                                {link.type === 'image' ? (
                                    <img src={link.url} alt={link.name} className="w-10 h-10 rounded-xl object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : getTypeIcon(link.type)}
                            </div>

                            {/* Name */}
                            {editingId === link.id ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleRename(link.id, editName);
                                            if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                                        }}
                                        className="flex-1 text-xs p-1.5 rounded-lg bg-surface border border-accent focus:ring-1 focus:ring-accent outline-none text-text-primary min-w-0"
                                    />
                                    <button onClick={() => handleRename(link.id, editName)} className="p-1 text-accent hover:brightness-110 shrink-0">
                                        <Check size={13} />
                                    </button>
                                </div>
                            ) : (
                                <p
                                    className="text-xs font-semibold text-text-primary truncate cursor-pointer hover:text-accent transition-colors"
                                    title={link.name}
                                    onClick={() => window.open(link.url, '_blank', 'noreferrer')}
                                >
                                    {link.name}
                                </p>
                            )}

                            {/* Type label */}
                            <p className="text-[11px] text-text-muted">{getTypeLabel(link.type)}</p>

                            {/* Hover actions */}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-text-muted hover:text-accent hover:bg-surface rounded-lg transition-colors"
                                    title="Öffnen"
                                >
                                    <ExternalLink size={12} />
                                </a>
                                <button
                                    onClick={() => { setEditingId(link.id); setEditName(link.name); }}
                                    className="p-1.5 text-text-muted hover:text-accent hover:bg-surface rounded-lg transition-colors"
                                    title="Umbenennen"
                                >
                                    <Edit3 size={12} />
                                </button>
                                <button
                                    onClick={() => handleDelete(link.id)}
                                    className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Löschen"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
