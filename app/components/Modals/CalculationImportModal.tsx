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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] w-full max-w-4xl h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 text-lg">Kalkulation importieren</h2>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Aus bestehenden Projekten</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition shadow-sm">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Project List */}
                    <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
                        <div className="p-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Projekt suchen..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {loading && !selectedProjectId && (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                                    <Loader2 size={24} className="animate-spin text-blue-500" />
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
                                    className={`w-full text-left p-3 rounded-2xl transition-all group ${selectedProjectId === project.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95' : 'hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 active:bg-gray-100'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${selectedProjectId === project.id ? 'bg-white/20 border-white/30' : 'bg-white border-gray-100 group-hover:bg-blue-50 group-hover:border-blue-100'}`}>
                                            <Briefcase size={18} className={selectedProjectId === project.id ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-xs font-bold truncate ${selectedProjectId === project.id ? 'text-white' : 'text-gray-900'}`}>{project.title}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <div className={`text-[10px] truncate font-bold px-1.5 py-0.5 rounded ${selectedProjectId === project.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                    {project.job_number || '---'}
                                                </div>
                                                <div className={`text-[10px] truncate ${selectedProjectId === project.id ? 'text-blue-100' : 'text-gray-400 font-medium'}`}>
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
                    <div className="flex-1 bg-white overflow-y-auto custom-scrollbar p-6">
                        {!selectedProjectId ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                                    <Briefcase size={32} />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Projekt auswählen</h3>
                                <p className="text-xs text-center max-w-[200px]">Wähle links ein Projekt aus, um dessen Kalkulations-Elemente zu sehen.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                                        <Loader2 size={32} className="animate-spin text-blue-500" />
                                        <span className="text-sm font-medium">Lade Kalkulation...</span>
                                    </div>
                                ) : (
                                    <>
                                        {sourceData.length === 0 ? (
                                            <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[32px] text-gray-400">
                                                Keine Kalkulation in diesem Projekt gefunden.
                                            </div>
                                        ) : (
                                            sourceData.map((section) => {
                                                const sectionSelected = selectedItems.some(i => i.id === section.id && i.type === 'section');
                                                const somePosSelected = section.positions?.some((p: any) => selectedItems.some(si => si.id === p.id && si.type === 'position'));

                                                return (
                                                    <div key={section.id} className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                                                        <div className={`flex items-center gap-4 p-4 border-b border-gray-50 transition-colors ${sectionSelected ? 'bg-blue-50/50' : 'bg-gray-50/30'}`}>
                                                            <button onClick={() => toggleItem('section', section.id, section)} className="shrink-0 transition-transform active:scale-90">
                                                                {sectionSelected ? (
                                                                    <div className="bg-blue-600 text-white rounded-lg p-1 shadow-lg shadow-blue-500/30 ring-2 ring-blue-100">
                                                                        <CheckSquare size={20} strokeWidth={2.5} />
                                                                    </div>
                                                                ) : (
                                                                    <div className={`rounded-lg p-1 border-2 transition-colors ${somePosSelected ? 'bg-blue-50 border-blue-300 text-blue-500' : 'bg-white border-gray-200 text-transparent hover:border-blue-400'}`}>
                                                                        <Square size={20} strokeWidth={2.5} />
                                                                    </div>
                                                                )}
                                                            </button>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-gray-900 truncate tracking-tight">{section.title}</h4>
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{section.positions?.length || 0} Positionen</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-4 bg-white space-y-2">
                                                            {section.positions?.map((pos: any) => {
                                                                const posSelected = selectedItems.some(i => i.id === pos.id && i.type === 'position');
                                                                return (
                                                                    <button
                                                                        key={pos.id}
                                                                        onClick={() => toggleItem('position', pos.id)}
                                                                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border ${posSelected ? 'bg-blue-50/30 border-blue-200 shadow-sm' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}`}
                                                                    >
                                                                        {posSelected ? (
                                                                            <CheckSquare size={16} className="text-blue-600 shrink-0" strokeWidth={2.5} />
                                                                        ) : (
                                                                            <Square size={16} className="text-gray-200 shrink-0 group-hover:text-gray-300" strokeWidth={2.5} />
                                                                        )}
                                                                        <div className="flex-1 text-left min-w-0">
                                                                            <div className={`text-xs font-bold truncate ${posSelected ? 'text-blue-900' : 'text-gray-700'}`}>{pos.title}</div>
                                                                            <div className="text-[10px] text-gray-400 truncate mt-0.5 font-medium">{pos.description || 'Keine Beschreibung'}</div>
                                                                        </div>
                                                                        <div className="text-right shrink-0">
                                                                            <div className={`font-mono font-bold text-xs ${posSelected ? 'text-blue-600' : 'text-gray-900'}`}>{pos.unit_price.toLocaleString('de-DE')} €</div>
                                                                            <div className="text-[10px] text-gray-400 font-medium">{pos.quantity} {pos.unit}</div>
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
                <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                    <div className="text-sm font-medium text-gray-500">
                        {selectedItems.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg shadow-blue-500/20 font-bold">{selectedItems.length}</span>
                                <span className="text-gray-900 font-bold">Elemente ausgewählt</span>
                            </div>
                        ) : 'Wähle Elemente zum Importieren aus'}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-white transition-all">
                            Abbrechen
                        </button>
                        <button
                            disabled={selectedItems.length === 0}
                            onClick={handleImport}
                            className="px-8 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-30 disabled:grayscale transition-all shadow-xl shadow-gray-200 flex items-center gap-2"
                        >
                            Importieren <Plus size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
