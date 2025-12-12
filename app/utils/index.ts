export const getStatusStyle = (status: string) => {
    switch (status) {
        case 'Bearbeitung': return 'bg-green-100 text-green-700 border-green-200';
        case 'Warten auf Kundenfeedback': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'Warten auf Mitarbeiter': return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'Erledigt': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Abgebrochen': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
};

export const STATUS_OPTIONS = [
    'Bearbeitung',
    'Warten auf Kundenfeedback',
    'Warten auf Mitarbeiter',
    'Erledigt',
    'Abgebrochen'
];

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
