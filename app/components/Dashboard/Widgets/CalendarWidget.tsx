import React from 'react';
import { Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

export default function CalendarWidget() {
    return (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                        <CalendarIcon size={18} />
                    </div>
                    <h3 className="font-black text-gray-900 text-sm tracking-tight uppercase">Termine & Termine</h3>
                </div>
                <button className="text-[10px] text-gray-400 hover:text-gray-900 flex items-center gap-1 font-bold uppercase tracking-wider transition-colors">
                    Kalender öffnen <ChevronRight size={14} />
                </button>
            </div>
            <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center py-8">
                    <p className="text-xs font-bold text-gray-600 mb-1">Keine Termine für heute</p>
                    <p className="text-[10px] text-gray-400 font-medium">Genieße deinen Fokus-Tag! 🚀</p>
                </div>
            </div>
        </div>
    );
}
