import React from 'react';
import { Clock } from 'lucide-react';

interface TimeStatsProps {
    totalHours: number;
    targetHours?: number;
}

export default function TimeStats({ totalHours, targetHours = 8 }: TimeStatsProps) {
    const percentage = Math.min((totalHours / targetHours) * 100, 100);
    const isOvertime = totalHours > targetHours;

    return (
        <div className="flex items-center gap-4 bg-white p-3 pr-6 rounded-xl border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOvertime ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                <Clock size={20} />
            </div>
            <div className="flex-1 min-w-[150px]">
                <div className="flex justify-between items-end mb-1">
                    <div className="text-sm font-medium text-gray-500">Heute</div>
                    <div className="text-lg font-bold text-gray-900">
                        {totalHours.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span className="text-sm font-normal text-gray-400">/ {targetHours}h</span>
                    </div>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${isOvertime ? 'bg-green-500' : 'bg-gray-900'}`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
