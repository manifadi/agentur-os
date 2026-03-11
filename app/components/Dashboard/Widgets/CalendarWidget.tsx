import React from 'react';
import { Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

export default function CalendarWidget() {
    return (
        <div className="bg-card rounded-3xl p-6 border border-default shadow-sm hover:shadow-md transition-all h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-500">
                        <CalendarIcon size={18} />
                    </div>
                    <h3 className="font-black text-text-primary text-sm tracking-tight uppercase">Termine & Termine</h3>
                </div>
                <button className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1 font-bold uppercase tracking-wider transition-colors">
                    Kalender öffnen <ChevronRight size={14} />
                </button>
            </div>
            <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-subtle border border-dashed border-default flex flex-col items-center justify-center text-center py-8">
                    <p className="text-xs font-bold text-text-secondary mb-1">Keine Termine für heute</p>
                    <p className="text-[10px] text-text-muted font-medium">Genieße deinen Fokus-Tag! 🚀</p>
                </div>
            </div>
        </div>
    );
}
