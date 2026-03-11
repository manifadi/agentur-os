import React, { useState, useEffect } from 'react';
import { X, Search, Briefcase, ChevronRight, ChevronDown, CheckSquare, Square, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Project } from '../../types';

interface CalculationImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (items: any[]) => void;
    currentProjectId?: string;
}

export default function CalculationImportModal({ isOpen, onClose, onImport, currentProjectId }: CalculationImportModalProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [sourceData, setSourceData] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<{ type: 'section' | 'position', id: string }[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchProjects();
        }
    }, [isOpen]);

    const fetchProjects = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('projects')
            .select('*, clients(name)')
            .neq('id', currentProjectId || '')
            .order('created_at', { ascending: false });
        if (data) setProjects(data);
        setLoading(false);
    };

    const fetchProjectDetails = async (projectId: string) => {
        setLoading(true);
        const { data } = await supabase
            .from('project_sections')
            .select('*, positions:project_positions(*)')
            .eq('project_id', projectId)
            .order('order_index', { ascending: true });
        if (data) setSourceData(data);
        setSelectedProjectId(projectId);
        setLoading(false);
    };

    const toggleItem = (type: 'section' | 'position', id: string, section?: any) => {
        if (type === 'section') {
            const isSelected = selectedItems.some(i => i.id === id && i.type === 'section');
            if (isSelected) {
                // Deselect section and all its positions
                const posIds = section.positions?.map((p: any) => p.id) || [];
                setSelectedItems(prev => prev.filter(i => i.id !== id && !posIds.includes(i.id)));
            } else {
                // Select section and all its positions
                const newItems: { type: 'section' | 'position', id: string }[] = [{ type: 'section' as const, id }];
                section.positions?.forEach((p: any) => {
                    if (!selectedItems.some(si => si.id === p.id)) {
                        newItems.push({ type: 'position' as const, id: p.id });
                    }
                });
                setSelectedItems(prev => [...prev, ...newItems]);
            }
        } else {
            const isSelected = selectedItems.some(i => i.id === id && i.type === 'position');
            if (isSelected) {
                setSelectedItems(prev => prev.filter(i => i.id !== id));
            } else {
                setSelectedItems(prev => [...prev, { type: 'position', id }]);
            }
        }
    };

    const handleImport = () => {
        const itemsToImport: any[] = [];

        sourceData.forEach(section => {
            const sectionSelected = selectedItems.some(i => i.id === section.id && i.type === 'section');
            const selectedPosIds = selectedItems.filter(i => i.type === 'position').map(i => i.id);
            const selectedPositions = section.positions?.filter((p: any) => selectedPosIds.includes(p.id)) || [];

            if (sectionSelected || selectedPositions.length > 0) {
                itemsToImport.push({
                    ...section,
                    positions: selectedPositions,
                    isFullSection: sectionSelected
                });
            }
        });

        onImport(itemsToImport);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-default rounded-[32px] w-full max-w-4xl h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-default flex justify-between items-center bg-surface shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-subtle text-accent flex items-center justify-center border border-accent/20">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-text-primary text-lg">Kalkulation importieren</h2>
                            <p className="text-xs text-text-secondary font-medium uppercase tracking-widest">Aus bestehenden Projekten</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-hover rounded-full transition shadow-sm">
                        <X size={20} className="text-text-muted hover:text-text-primary" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Project List */}
                    <div className="w-80 border-r border-default flex flex-col bg-subtle">
                        <div className="p-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                                <input
                                    type="text"
                                    placeholder="Projekt suchen..."
                                    className="w-full pl-9 pr-4 py-2 bg-surface text-text-primary border border-default rounded-xl text-xs focus:ring-2 focus:ring-accent-subtle focus:border-accent outline-none transition-all shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {loading && !selectedProjectId && (
                                <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-3">
                                    <Loader2 size={24} className="animate-spin text-accent" />
                                    <span className="text-xs font-medium">Lade Projekte...</span>
                                </div>
                            )}
                            {projects.filter(p => {
                                const search = searchTerm.toLowerCase();
                                const titleMatch = p.title.toLowerCase().includes(search);
                                const clientMatch = p.clients?.name?.toLowerCase().includes(search);
                                const jobNrMatch = p.job_number?.toLowerCase().includes(search);
                                return titleMatch || clientMatch || jobNrMatch;
                            }).map(project => (
                                <button
                                    key={project.id}
                                    onClick={() => fetchProjectDetails(project.id)}
                                    className={`w-full text-left p-3 rounded-2xl transition-all group ${selectedProjectId === project.id ? 'bg-accent text-accent-text shadow-default active:scale-95' : 'hover:bg-surface hover:shadow-sm border border-transparent hover:border-default active:bg-hover text-text-primary'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${selectedProjectId === project.id ? 'bg-surface/20 border-transparent' : 'bg-surface border-default group-hover:bg-accent-subtle group-hover:border-accent/30'}`}>
                                            <Briefcase size={18} className={selectedProjectId === project.id ? 'text-accent-text' : 'text-text-muted group-hover:text-accent'} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-xs font-bold truncate ${selectedProjectId === project.id ? 'text-accent-text' : 'text-text-primary'}`}>{project.title}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className={`text-[10px] truncate font-bold px-1.5 py-0.5 border rounded ${selectedProjectId === project.id ? 'bg-surface/20 text-accent-text border-transparent' : 'bg-subtle text-text-secondary border-default'}`}>
                                                    {project.job_number || '---'}
                                                </div>
                                                <div className={`text-[10px] truncate ${selectedProjectId === project.id ? 'text-accent-text/80' : 'text-text-muted font-medium'}`}>
                                                    {project.clients?.name || 'Kein Kunde'}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className={`opacity-0 group-hover:opacity-60 transition-all ${selectedProjectId === project.id ? 'translate-x-1 opacity-100' : ''}`} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Content Selector */}
                    <div className="flex-1 bg-surface overflow-y-auto custom-scrollbar p-6">
                        {!selectedProjectId ? (
                            <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-60">
                                <div className="w-20 h-20 rounded-full bg-subtle border border-default flex items-center justify-center mb-4">
                                    <Briefcase size={32} />
                                </div>
                                <h3 className="font-bold text-text-primary mb-1">Projekt auswählen</h3>
                                <p className="text-xs text-center max-w-[200px]">Wähle links ein Projekt aus, um dessen Kalkulations-Elemente zu sehen.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3">
                                        <Loader2 size={32} className="animate-spin text-accent" />
                                        <span className="text-sm font-medium">Lade Kalkulation...</span>
                                    </div>
                                ) : (
                                    <>
                                        {sourceData.length === 0 ? (
                                            <div className="text-center py-20 border-2 border-dashed border-default rounded-[32px] text-text-muted">
                                                Keine Kalkulation in diesem Projekt gefunden.
                                            </div>
                                        ) : (
                                            sourceData.map((section) => {
                                                const sectionSelected = selectedItems.some(i => i.id === section.id && i.type === 'section');
                                                const somePosSelected = section.positions?.some((p: any) => selectedItems.some(si => si.id === p.id && si.type === 'position'));

                                                return (
                                                    <div key={section.id} className="rounded-2xl border border-default overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                                                        <div className={`flex items-center gap-4 p-4 border-b border-default transition-colors ${sectionSelected ? 'bg-accent-subtle/50' : 'bg-subtle'}`}>
                                                            <button onClick={() => toggleItem('section', section.id, section)} className="shrink-0 transition-transform active:scale-90">
                                                                {sectionSelected ? (
                                                                    <div className="bg-accent text-accent-text rounded-lg p-1 shadow-default">
                                                                        <CheckSquare size={20} strokeWidth={2.5} />
                                                                    </div>
                                                                ) : (
                                                                    <div className={`rounded-lg p-1 border-2 transition-colors ${somePosSelected ? 'bg-accent-subtle border-accent text-accent' : 'bg-surface border-default text-transparent hover:border-accent'}`}>
                                                                        <Square size={20} strokeWidth={2.5} />
                                                                    </div>
                                                                )}
                                                            </button>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-text-primary truncate tracking-tight">{section.title}</h4>
                                                                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">{section.positions?.length || 0} Positionen</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-4 bg-surface space-y-2">
                                                            {section.positions?.map((pos: any) => {
                                                                const posSelected = selectedItems.some(i => i.id === pos.id && i.type === 'position');
                                                                return (
                                                                    <button
                                                                        key={pos.id}
                                                                        onClick={() => toggleItem('position', pos.id)}
                                                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border ${posSelected ? 'bg-accent-subtle/30 border-accent shadow-sm' : 'hover:bg-hover border-transparent hover:border-default'}`}
                                                                    >
                                                                        {posSelected ? (
                                                                            <CheckSquare size={16} className="text-accent shrink-0" strokeWidth={2.5} />
                                                                        ) : (
                                                                            <Square size={16} className="text-text-muted/50 shrink-0 group-hover:text-text-muted" strokeWidth={2.5} />
                                                                        )}
                                                                        <div className="flex-1 text-left min-w-0">
                                                                            <div className={`text-xs font-bold truncate ${posSelected ? 'text-text-primary' : 'text-text-secondary'}`}>{pos.title}</div>
                                                                            <div className="text-[10px] text-text-muted truncate mt-0.5 font-medium">{pos.description || 'Keine Beschreibung'}</div>
                                                                        </div>
                                                                        <div className="text-right shrink-0">
                                                                            <div className={`font-mono font-bold text-xs ${posSelected ? 'text-accent' : 'text-text-primary'}`}>{pos.unit_price.toLocaleString('de-DE')} €</div>
                                                                            <div className="text-[10px] text-text-muted font-medium">{pos.quantity} {pos.unit}</div>
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-default flex justify-between items-center bg-subtle shrink-0">
                    <div className="text-sm font-medium text-text-secondary">
                        {selectedItems.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="bg-accent text-accent-text w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold">{selectedItems.length}</span>
                                <span className="text-text-primary font-bold">Elemente ausgewählt</span>
                            </div>
                        ) : 'Wähle Elemente zum Importieren aus'}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-hover transition-all">
                            Abbrechen
                        </button>
                        <button
                            disabled={selectedItems.length === 0}
                            onClick={handleImport}
                            className="px-8 py-2.5 bg-accent text-accent-text rounded-xl text-sm font-bold hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all shadow-default flex items-center gap-2"
                        >
                            Importieren <Plus size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
