import React from 'react';

// ─────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-[12px] rounded-lg',
    md: 'px-4 py-2.5 text-[13px] rounded-xl',
    lg: 'px-5 py-3 text-[14px] rounded-xl',
};

export function Button({
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    const variantClass =
        variant === 'primary' ? 'btn-primary' :
        variant === 'ghost'   ? 'btn-ghost' :
        variant === 'danger'  ? 'btn-danger' :
                                'btn-secondary';

    return (
        <button
            className={`${variantClass} ${sizeClasses[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0" />
            ) : icon ? (
                <span className="shrink-0">{icon}</span>
            ) : null}
            {children}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
    dot?: boolean;
}

const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-[var(--text-muted)]',
    accent:  'bg-[var(--accent)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    danger:  'bg-[var(--color-danger)]',
    info:    'bg-[var(--color-info)]',
};

export function Badge({ variant = 'default', children, className = '', dot = false }: BadgeProps) {
    return (
        <span className={`badge badge-${variant} ${className}`}>
            {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
            {children}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────
interface SectionHeaderProps {
    label: string;
    count?: number;
    action?: { label: string; onClick: () => void };
    className?: string;
}

export function SectionHeader({ label, count, action, className = '' }: SectionHeaderProps) {
    return (
        <div className={`section-header ${className}`}>
            <span className="section-header-label">{label}</span>
            <div className="flex items-center gap-2">
                {count !== undefined && (
                    <Badge variant="accent">{count}</Badge>
                )}
                {action && (
                    <button
                        onClick={action.onClick}
                        className="text-[12px] font-semibold transition-colors duration-150"
                        style={{ color: 'var(--accent)' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                        {action.label}
                    </button>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────
interface CardProps {
    header?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    noPadding?: boolean;
}

export function Card({ header, footer, children, className = '', bodyClassName = '', noPadding = false }: CardProps) {
    return (
        <div className={`card ${className}`}>
            {header && <div className="card-header">{header}</div>}
            <div className={noPadding ? '' : `card-body ${bodyClassName}`}>
                {children}
            </div>
            {footer && <div className="card-footer">{footer}</div>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// CardHeader helper
// ─────────────────────────────────────────────────────────────
interface CardHeaderProps {
    icon?: React.ReactNode;
    title: string;
    action?: React.ReactNode;
}

export function CardHeader({ icon, title, action }: CardHeaderProps) {
    return (
        <>
            <div className="card-header-title">
                {icon && <div className="card-header-icon">{icon}</div>}
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                </span>
            </div>
            {action && <div>{action}</div>}
        </>
    );
}

// ─────────────────────────────────────────────────────────────
// ListItem
// ─────────────────────────────────────────────────────────────
interface ListItemProps {
    icon?: React.ReactNode;
    iconVariant?: BadgeVariant;
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
    actions?: React.ReactNode;
    onClick?: () => void;
    className?: string;
}

const iconBg: Record<BadgeVariant, string> = {
    default: 'var(--accent-subtle)',
    accent:  'var(--accent-subtle)',
    success: 'var(--color-success-subtle)',
    warning: 'var(--color-warning-subtle)',
    danger:  'var(--color-danger-subtle)',
    info:    'var(--color-info-subtle)',
};
const iconColor: Record<BadgeVariant, string> = {
    default: 'var(--accent)',
    accent:  'var(--accent)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger:  'var(--color-danger)',
    info:    'var(--color-info)',
};

export function ListItem({
    icon,
    iconVariant = 'accent',
    title,
    subtitle,
    trailing,
    actions,
    onClick,
    className = '',
}: ListItemProps) {
    return (
        <div
            className={`list-item ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={onClick}
        >
            {icon && (
                <div
                    className="list-item-icon"
                    style={{ background: iconBg[iconVariant], color: iconColor[iconVariant] }}
                >
                    {icon}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="list-item-title">{title}</div>
                {subtitle && <div className="list-item-subtitle">{subtitle}</div>}
            </div>
            {trailing && (
                <div className="text-[12px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {trailing}
                </div>
            )}
            {actions && <div className="list-item-actions">{actions}</div>}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// AddTrigger
// ─────────────────────────────────────────────────────────────
interface AddTriggerProps {
    label: string;
    onClick: () => void;
    className?: string;
}

export function AddTrigger({ label, onClick, className = '' }: AddTriggerProps) {
    return (
        <button className={`add-trigger ${className}`} onClick={onClick}>
            <span className="add-trigger-icon">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
            </span>
            {label}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────
// SegmentedControl
// ─────────────────────────────────────────────────────────────
interface SegmentedOption {
    id: string;
    label: string;
    icon?: React.ReactNode;
}

interface SegmentedControlProps {
    options: SegmentedOption[];
    value: string;
    onChange: (id: string) => void;
    className?: string;
}

export function SegmentedControl({ options, value, onChange, className = '' }: SegmentedControlProps) {
    return (
        <div className={`segmented-control ${className}`}>
            {options.map(opt => (
                <button
                    key={opt.id}
                    onClick={() => onChange(opt.id)}
                    className={`segmented-control-item ${value === opt.id ? 'active' : ''}`}
                >
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">{icon}</div>
            <p className="empty-state-title">{title}</p>
            {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
            {action && (
                <Button variant="primary" size="sm" onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// DragHandle
// ─────────────────────────────────────────────────────────────
export function DragHandle({ className = '' }: { className?: string }) {
    return (
        <div className={`drag-handle ${className}`}>
            <div className="drag-handle-bar" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// InputField
// ─────────────────────────────────────────────────────────────
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
    leadingIcon?: React.ReactNode;
}

export function InputField({ label, hint, error, leadingIcon, className = '', ...props }: InputFieldProps) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label className="section-header-label">{label}</label>
            )}
            <div className="relative">
                {leadingIcon && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: 'var(--text-muted)' }}>
                        {leadingIcon}
                    </span>
                )}
                <input
                    className={`input-field ${leadingIcon ? 'pl-9' : ''} ${error ? 'border-[var(--color-danger)] ring-2 ring-[var(--color-danger-subtle)]' : ''} ${className}`}
                    {...props}
                />
            </div>
            {(hint || error) && (
                <span className="text-[11px]" style={{ color: error ? 'var(--color-danger-text)' : 'var(--text-muted)' }}>
                    {error || hint}
                </span>
            )}
        </div>
    );
}
