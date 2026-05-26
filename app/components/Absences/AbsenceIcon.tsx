import React from 'react';
import { Plane, Stethoscope, Home, Pin } from 'lucide-react';
import { AbsenceType } from '../../types';

// Zentrale Icon-Zuordnung für Abwesenheits-Typen.
// Stil-Konsistenz: ausschließlich lucide-react, gleicher Stroke-Width.
const ICON_MAP: Record<AbsenceType, React.ComponentType<any>> = {
    vacation:    Plane,
    sick:        Stethoscope,
    home_office: Home,
    other:       Pin,
};

interface Props {
    type: AbsenceType;
    size?: number;
    strokeWidth?: number;
    className?: string;
    style?: React.CSSProperties;
}

export default function AbsenceIcon({ type, size = 14, strokeWidth = 1.75, className, style }: Props) {
    const Icon = ICON_MAP[type];
    return <Icon size={size} strokeWidth={strokeWidth} className={className} style={style} />;
}

export { ICON_MAP as ABSENCE_ICONS };
