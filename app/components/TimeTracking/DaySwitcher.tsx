import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DaySwitcherProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
}

export default function DaySwitcher({ currentDate, onDateChange }: DaySwitcherProps) {
    // 1. Calculate Monday of the current week (view)
    // Note: We use 'currentDate' as the anchor. If user selects a day, that day is in the view.
    const weekStart = useMemo(() => {
        const d = new Date(currentDate);
        const day = d.getDay(); // 0 (Sun) - 6 (Sat)
        // Adjust for Monday start (ISO 8601ish)
        // If Sunday (0), we go back 6 days. If Monday (1), go back 0.
        // Formula: (day + 6) % 7 is shifts from Monday? 
        // Sunday (0) -> (0+6)%7 = 6 days back.
        // Monday (1) -> (1+6)%7 = 0 days back. wrong.
        // Standard: diff = d.getDate() - day + (day == 0 ? -6 : 1);
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }, [currentDate]);

    // 2. Generate 7 days
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            days.push(d);
        }
        return days;
    }, [weekStart]);

    // Navigation (Jump 1 week)
    const handlePrevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        onDateChange(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        onDateChange(d);
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();
    };

    // Helper to format date
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    };
    const formatDayName = (date: Date) => {
        return date.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2);
    };

    const isCurrentDateToday = isSameDay(currentDate, new Date());
    const handleJumpToToday = () => onDateChange(new Date());

    return (
        <div className="flex items-center justify-center gap-4 w-full">
            {/* Left Arrow */}
            <button
                onClick={handlePrevWeek}
                className="p-3 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
            >
                <ChevronLeft size={20} />
            </button>

            {/* Week Strip */}
            <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm gap-1">
                {weekDays.map((date) => {
                    const isSelected = isSameDay(date, currentDate);
                    const isToday = isSameDay(date, new Date());
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6; // Sun or Sat

                    // Base classes
                    let wrapperClass = "flex flex-col items-center justify-center w-14 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer select-none relative ";

                    // State Styling
                    if (isSelected) {
                        wrapperClass += "bg-gray-900 text-white shadow-md scale-105 z-10 font-bold";
                    } else if (isToday) {
                        wrapperClass += "bg-blue-100 text-blue-700 font-extrabold border border-blue-200 hover:bg-blue-200";
                    } else if (isWeekend) {
                        wrapperClass += "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600";
                    } else {
                        wrapperClass += "text-gray-600 hover:bg-gray-50 hover:text-gray-900";
                    }

                    return (
                        <div
                            key={date.toISOString()}
                            onClick={() => onDateChange(date)}
                            className={wrapperClass}
                        >
                            <span className={`text-[10px] uppercase mb-0.5 ${isSelected ? 'text-gray-300' : (isWeekend ? 'text-gray-300' : 'text-gray-400')}`}>
                                {formatDayName(date)}
                            </span>
                            <span className="leading-none text-base">
                                {date.getDate()}.
                            </span>

                            {/* Today Dot Indicator if not active */}
                            {isToday && !isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Right Arrow */}
            <button
                onClick={handleNextWeek}
                className="p-3 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
            >
                <ChevronRight size={20} />
            </button>

            {/* Jump to Today - Only show if not on today */}
            {!isCurrentDateToday && (
                <button
                    onClick={handleJumpToToday}
                    className="ml-2 px-4 py-3 bg-blue-50 text-blue-600 font-bold rounded-xl text-sm hover:bg-blue-100 transition-colors"
                >
                    Heute
                </button>
            )}
        </div>
    );
}

