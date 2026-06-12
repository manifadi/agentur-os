import React, { useMemo } from 'react';
import PeriodNavigator from '../UI/PeriodNavigator';

interface DaySwitcherProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    /** Tage (Key `YYYY-MM-DD`) mit mindestens einem Zeit-Eintrag → Punkt darunter */
    markedDates?: Set<string>;
}

export default function DaySwitcher({ currentDate, onDateChange, markedDates }: DaySwitcherProps) {
    const dateKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

    // Aktuelle Kalenderwoche (ISO)
    const currentWeek = useMemo(() => {
        const d = new Date(Date.UTC(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }, [currentDate]);
    const currentYear = currentDate.getFullYear();

    return (
        <div className="flex items-center justify-end gap-2.5 flex-wrap">
            {/* Period Navigator — einheitliches Vela-Pattern */}
            <PeriodNavigator
                onPrev={handlePrevWeek}
                onNext={handleNextWeek}
                centerLabel={`KW ${currentWeek} · ${currentYear}`}
                hoverLabel="Aktuelle Woche"
                onCenterClick={() => onDateChange(new Date())}
                centerMinWidth={128}
                centerTitle="Zur aktuellen Woche springen"
                prevTitle="Vorherige Woche"
                nextTitle="Nächste Woche"
            />

            {/* Week Strip */}
            <div
                className="inline-flex items-stretch gap-0.5 p-1 rounded-xl"
                style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-sm)',
                }}
            >
                {weekDays.map(date => {
                    const isSelected = isSameDay(date, currentDate);
                    const isToday    = isSameDay(date, new Date());
                    const isWeekend  = date.getDay() === 0 || date.getDay() === 6;
                    const hasEntry   = !!markedDates?.has(dateKey(date));

                    const baseStyle: React.CSSProperties = {
                        cursor: 'pointer',
                        transition: 'background 150ms ease, color 150ms ease',
                    };

                    let style: React.CSSProperties = { ...baseStyle };
                    if (isSelected) {
                        style.background = 'var(--accent)';
                        style.color = 'var(--accent-text)';
                    } else if (isToday) {
                        style.background = 'var(--accent-subtle)';
                        style.color = 'var(--accent)';
                    } else if (isWeekend) {
                        style.color = 'var(--text-placeholder)';
                    } else {
                        style.color = 'var(--text-secondary)';
                    }

                    const dayLabelColor =
                        isSelected ? 'rgba(255,255,255,0.7)' :
                        isToday    ? 'var(--accent)' :
                        isWeekend  ? 'var(--text-placeholder)' :
                                     'var(--text-muted)';

                    return (
                        <button
                            type="button"
                            key={date.toISOString()}
                            onClick={() => onDateChange(date)}
                            className="flex flex-col items-center justify-center px-2.5 py-1 rounded-lg relative select-none min-w-[40px]"
                            style={style}
                            onMouseEnter={e => {
                                if (!isSelected && !isToday) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={e => {
                                if (!isSelected && !isToday) (e.currentTarget as HTMLElement).style.background = '';
                            }}
                        >
                            <span
                                className="text-[9px] font-bold uppercase tracking-wider leading-none mb-1"
                                style={{ color: dayLabelColor }}
                            >
                                {formatDayName(date)}
                            </span>
                            <span className="text-[13px] font-semibold leading-none">
                                {date.getDate()}
                            </span>
                            {/* Punkt für Tage mit Einträgen */}
                            <span className="h-1.5 mt-1 flex items-center justify-center">
                                {hasEntry && (
                                    <span
                                        className="w-1 h-1 rounded-full"
                                        style={{
                                            background: isSelected ? 'var(--accent-text)' : 'var(--accent)',
                                            opacity: isSelected ? 0.85 : 1,
                                        }}
                                    />
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

