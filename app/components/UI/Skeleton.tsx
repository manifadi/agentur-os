import React from 'react';

interface SkeletonProps {
    className?: string;
    rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Skeleton({ className = '', rounded = 'lg' }: SkeletonProps) {
    const r = { sm: 'rounded', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl', full: 'rounded-full' }[rounded];
    return <div className={`animate-pulse bg-subtle ${r} ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    rounded="md"
                    className={`h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
                />
            ))}
        </div>
    );
}

export function ProjectListSkeleton() {
    return (
        <div className="bg-card rounded-2xl border border-border-subtle overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-3 flex gap-8">
                {['w-20', 'w-40', 'w-24', 'w-20', 'w-20'].map((w, i) => (
                    <Skeleton key={i} className={`h-3 ${w}`} rounded="md" />
                ))}
            </div>
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-5 px-5 py-4 border-b border-border-subtle last:border-none">
                    <Skeleton className="h-3 w-16" rounded="md" />
                    <div className="flex items-center gap-3 flex-1">
                        <Skeleton className="w-7 h-7 shrink-0" rounded="lg" />
                        <Skeleton className="h-3 w-48" rounded="md" />
                    </div>
                    <Skeleton className="h-6 w-20" rounded="full" />
                    <Skeleton className="h-6 w-24" rounded="full" />
                    <Skeleton className="h-3 w-20 ml-auto" rounded="md" />
                </div>
            ))}
        </div>
    );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
    return (
        <div className="bg-card rounded-2xl border border-border-subtle p-5 space-y-3">
            <Skeleton className="h-4 w-32" rounded="md" />
            <SkeletonText lines={lines} />
        </div>
    );
}
