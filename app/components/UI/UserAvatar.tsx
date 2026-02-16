import React from 'react';

interface UserAvatarProps {
    src?: string | null;
    name?: string;
    initials?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl'
};

export default function UserAvatar({ src, name = '', initials = '', size = 'md', className = '' }: UserAvatarProps) {
    const derivedInitials = initials || name.split(' ').map(n => n[0]).join('').substring(0, 2);
    const sizeClasses = sizeMap[size] || sizeMap.md;

    if (src) {
        return (
            <div className={`${sizeClasses} rounded-full overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50 ${className}`}>
                <img
                    src={src}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                />
            </div>
        );
    }

    return (
        <div className={`${sizeClasses} rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-500 flex-shrink-0 ${className}`}>
            {derivedInitials.toUpperCase() || '?'}
        </div>
    );
}
