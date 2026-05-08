import React from 'react';

interface SkeletonProps {
    className?: string;
    rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function Skeleton({ className = '', rounded = 'lg' }: SkeletonProps) {
    const r = { sm: 'rounded', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl', '2xl': 'rounded-2xl', full: 'rounded-full' }[rounded];
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
        <div className="bg-surface rounded-2xl border border-default overflow-hidden">
            <div className="border-b border-default px-5 py-3 flex gap-8">
                {['w-20', 'w-40', 'w-24', 'w-20', 'w-20'].map((w, i) => (
                    <Skeleton key={i} className={`h-3 ${w}`} rounded="md" />
                ))}
            </div>
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-5 px-5 py-4 border-b border-default last:border-none">
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
        <div className="bg-surface rounded-2xl border border-default p-5 space-y-3">
            <Skeleton className="h-4 w-32" rounded="md" />
            <SkeletonText lines={lines} />
        </div>
    );
}

export function DashboardSkeleton() {
    return (
        <div className="p-6 md:p-10 max-w-[1920px] mx-auto animate-in fade-in duration-300">
            <div className="mb-12">
                <Skeleton className="h-10 w-72 mb-3" rounded="xl" />
                <Skeleton className="h-4 w-52" rounded="md" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-[32px] border border-default bg-surface p-6" style={{ height: 384 }}>
                        <div className="flex items-center gap-3 mb-6">
                            <Skeleton className="w-8 h-8" rounded="xl" />
                            <Skeleton className="h-4 w-32" rounded="md" />
                        </div>
                        <SkeletonText lines={6} />
                    </div>
                ))}
            </div>
            <div className="rounded-[32px] border border-default bg-surface p-6" style={{ height: 320 }}>
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton className="w-8 h-8" rounded="xl" />
                    <Skeleton className="h-4 w-44" rounded="md" />
                </div>
                <div className="grid grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-40" rounded="xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SettingsFormSkeleton() {
    return (
        <div className="space-y-6">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-surface p-6 rounded-2xl border border-default shadow-sm space-y-4">
                    <Skeleton className="h-4 w-36" rounded="md" />
                    <div className="grid grid-cols-2 gap-5">
                        {[1, 2, 3, 4].map(j => (
                            <div key={j} className="space-y-2">
                                <Skeleton className="h-3 w-24" rounded="md" />
                                <Skeleton className="h-10 w-full" rounded="xl" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
