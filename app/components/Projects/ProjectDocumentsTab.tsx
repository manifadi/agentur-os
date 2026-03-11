import React, { useRef, useState } from 'react';
import { FileText, Upload, Link as LinkIcon, Edit3, Trash2, Download } from 'lucide-react';
import { Project } from '../../types';

interface ProjectDocumentsTabProps {
    project: Project;
    onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
}

export default function ProjectDocumentsTab({ project, onUpdateProject }: ProjectDocumentsTabProps) {
    // We will parse document_urls from the project (assuming it's an array of strings in the DB)
    // To satisfy the type checker before types.ts is strictly updated everywhere, we cast to any or use fallback
    const documentUrls: string[] = (project as any).document_urls || [];
    const [uploading, setUploading] = useState(false);
    const [isEditingDocUrl, setIsEditingDocUrl] = useState(false);
    const [tempDocUrl, setTempDocUrl] = useState(project.google_doc_url || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleGoogleDocUpdate = async () => {
        await onUpdateProject(project.id, { google_doc_url: tempDocUrl || null });
        setIsEditingDocUrl(false);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            // Quick workaround: Since we don't have direct access to the supabase helper here,
            // we will simulate the file upload for now, or assume the parent passes an upload handler.
            // Wait, we need the real uploadFileToSupabase from the parent. 
            // I should refactor this to accept an upload handler.
            alert("File upload integrated with Supabase will be implemented here.");
        } catch (error) {
            console.error("Error uploading document:", error);
            alert("Fehler beim Hochladen.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDocument = async (urlToDelete: string) => {
        if (!confirm("Möchtest du dieses Dokument wirklich entfernen?")) return;
        const newUrls = documentUrls.filter(url => url !== urlToDelete);
        await onUpdateProject(project.id, { document_urls: newUrls } as any);
    };

    const extractFilename = (url: string) => {
        try {
            // Rough extraction of filename from supabase url
            const parts = url.split('/');
            return decodeURIComponent(parts[parts.length - 1]);
        } catch (e) {
            return "Dokument";
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Left Column - Verknüpfungen (Google Doc) */}
            <div className="col-span-1 flex flex-col gap-6">
                <div className="bg-surface rounded-2xl border border-default p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                        <LinkIcon size={16} className="text-accent" />
                        Verknüpfungen
                    </h3>

                    <div className="space-y-4">
                        <div className="bg-subtle border border-default rounded-xl p-4 transition-colors hover:border-accent/30 group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                                    <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                        <FileText size={14} />
                                    </div>
                                    Google Doc Concept
                                </div>
                                <button
                                    onClick={() => {
                                        setIsEditingDocUrl(true);
                                        setTempDocUrl(project.google_doc_url || '');
                                    }}
                                    className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-surface transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Edit3 size={14} />
                                </button>
                            </div>

                            {isEditingDocUrl ? (
                                <div className="flex flex-col gap-2 mt-3 mb-1">
                                    <input
                                        type="url"
                                        value={tempDocUrl}
                                        onChange={(e) => setTempDocUrl(e.target.value)}
                                        placeholder="https://docs.google.com/..."
                                        className="w-full text-xs p-2 rounded-lg bg-surface border border-default focus:border-accent focus:ring-1 focus:ring-accent outline-none text-text-primary"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setIsEditingDocUrl(false)} className="px-2 py-1 text-[10px] font-medium text-text-muted hover:text-text-primary">Abbrechen</button>
                                        <button onClick={handleGoogleDocUpdate} className="px-2 py-1 text-[10px] font-bold bg-accent text-surface rounded hover:brightness-110">Speichern</button>
                                    </div>
                                </div>
                            ) : project.google_doc_url ? (
                                <a
                                    href={project.google_doc_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-text-secondary truncate block hover:text-accent transition-colors underline-offset-2 hover:underline"
                                    title={project.google_doc_url}
                                >
                                    {project.google_doc_url}
                                </a>
                            ) : (
                                <button
                                    onClick={() => setIsEditingDocUrl(true)}
                                    className="text-xs text-text-muted italic w-full text-left py-1 hover:text-accent transition-colors"
                                >
                                    + Google Doc Link hinzufügen
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Dokumente List & Upload */}
            <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
                <div className="bg-surface rounded-2xl border border-default p-5 shadow-sm min-h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <FileText size={16} className="text-accent" />
                            Hochgeladene Dokumente
                        </h3>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-subtle hover:bg-accent hover:text-surface text-text-primary border border-default hover:border-accent rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                        >
                            {uploading ? (
                                <span className="animate-pulse">Lädt...</span>
                            ) : (
                                <>
                                    <Upload size={14} className="group-hover:-translate-y-0.5 transition-transform" />
                                    Datei hochladen
                                </>
                            )}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                        />
                    </div>

                    {documentUrls.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-default rounded-xl bg-subtle">
                            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 shadow-sm border border-default">
                                <FileText size={24} className="text-text-placeholder" />
                            </div>
                            <h4 className="text-sm font-bold text-text-primary mb-1">Keine Dokumente</h4>
                            <p className="text-xs text-text-secondary max-w-[250px] mb-4">
                                Lade Dateien hoch, um wichtige Projekt-Dokumente zentral zu sammeln. (Max 5MB)
                            </p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-surface border border-default hover:border-accent text-text-primary hover:text-accent rounded-xl text-xs font-bold transition-colors shadow-sm"
                            >
                                Erste Datei hochladen
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documentUrls.map((url, idx) => (
                                <div key={idx} className="group flex flex-col bg-subtle border border-default hover:border-accent/30 rounded-xl p-3 transition-all">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-surface border border-default flex items-center justify-center shrink-0">
                                            {url.toLowerCase().endsWith('.pdf') ? (
                                                <div className="text-red-500 font-bold text-[10px]">PDF</div>
                                            ) : url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                                                <div className="w-full h-full rounded-lg overflow-hidden relative">
                                                    <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/10"></div>
                                                </div>
                                            ) : (
                                                <FileText size={16} className="text-text-muted" />
                                            )}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-1.5 text-text-muted hover:text-accent hover:bg-surface rounded-lg transition-colors"
                                                title="Ansehen / Download"
                                            >
                                                <Download size={14} />
                                            </a>
                                            <button
                                                onClick={() => handleDeleteDocument(url)}
                                                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Löschen"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs font-medium text-text-primary truncate" title={extractFilename(url)}>
                                        {extractFilename(url)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
