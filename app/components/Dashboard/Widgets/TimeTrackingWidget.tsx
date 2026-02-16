import React from 'react';
import { Timer, Plus } from 'lucide-react';

interface TimeTrackingWidgetProps {
    todaysHours: number;
    onAddTime: () => void;
}

export default function TimeTrackingWidget({ todaysHours, onAddTime }: TimeTrackingWidgetProps) {
    return (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Timer size={24} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Heute erfasst</h3>
                    <p className="text-2xl font-black text-gray-900">{todaysHours}h</p>
                </div>
            </div>
            <button
                onClick={onAddTime}
                className="p-2.5 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm flex items-center gap-2"
            >
                <Plus size={20} strokeWidth={3} />
                <span className="text-xs font-bold hidden group-hover:block transition-all">Quick Add</span>
            </button>
        </div>
    );
}
