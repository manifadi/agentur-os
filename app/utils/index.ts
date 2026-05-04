export const getStatusStyle = (status: string) => {
    switch (status) {
        case 'Priorisierung': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'Bearbeitung': return 'bg-green-100 text-green-700 border-green-200';
        case 'Geplant': return 'bg-slate-100 text-slate-700 border-slate-200';
        case 'Warten auf Mitarbeiter': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'Warten auf Kundenfeedback': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'Erledigt': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Abgebrochen': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
};

export const STATUS_OPTIONS = [
    'Priorisierung',
    'Bearbeitung',
    'Geplant',
    'Warten auf Mitarbeiter',
    'Warten auf Kundenfeedback',
    'Erledigt',
    'Abgebrochen'
];

export const STATUS_SORT_ORDER: Record<string, number> = {
    'Priorisierung': 1,
    'Bearbeitung': 2,
    'Geplant': 3,
    'Warten auf Mitarbeiter': 4,
    'Warten auf Kundenfeedback': 5,
    'Erledigt': 6,
    'Abgebrochen': 7,
};

export const getStatusSortRank = (status: string | null | undefined) => {
    if (!status) return 99;
    return STATUS_SORT_ORDER[status] ?? 50;
};

export const getStatusDot = (status: string | null | undefined): string => {
    switch (status) {
        case 'Priorisierung': return 'bg-purple-500';
        case 'Bearbeitung': return 'bg-emerald-500';
        case 'Geplant': return 'bg-slate-400';
        case 'Warten auf Mitarbeiter': return 'bg-amber-400';
        case 'Warten auf Kundenfeedback': return 'bg-orange-400';
        case 'Erledigt': return 'bg-blue-500';
        case 'Abgebrochen': return 'bg-rose-400';
        default: return 'bg-gray-300';
    }
};

export const getDeadlineColorClass = (dateString?: string | null) => {
    if (!dateString) return 'text-gray-400';
    const deadline = new Date(dateString);
    const today = new Date();
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-red-600 font-bold';
    if (diffDays <= 3) return 'text-red-500 font-medium';
    if (diffDays <= 7) return 'text-orange-500';
    return 'text-gray-500';
};
