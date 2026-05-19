'use client';

import React from 'react';
import { normalizeIncomingContent } from './RichTextEditor';

/**
 * Sanitizes HTML by stripping <script>, <iframe>, event handlers, and javascript: URLs.
 * Lightweight DIY sanitizer — sufficient because content originates from authenticated
 * staff inside the same org (RLS-isolated), not from untrusted public input.
 */
function sanitizeHtml(html: string): string {
    if (!html) return '';
    let out = html;

    // Remove dangerous tags entirely
    out = out.replace(/<(script|iframe|object|embed|style|link|meta)[\s\S]*?>[\s\S]*?<\/\1>/gi, '');
    out = out.replace(/<(script|iframe|object|embed|style|link|meta)[^>]*\/?>/gi, '');

    // Strip event handlers (onclick, onerror, etc.)
    out = out.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '');
    out = out.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '');
    out = out.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');

    // Strip javascript: and data: URLs from href/src
    out = out.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"');
    out = out.replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");
    out = out.replace(/(href|src)\s*=\s*"data:[^"]*"/gi, '$1="#"');

    return out;
}

interface Props {
    html: string | null | undefined;
    className?: string;
    /** Limit display to N lines via line-clamp */
    lineClamp?: number;
    /** Fallback text shown when empty */
    fallback?: React.ReactNode;
}

export default function RichTextDisplay({ html, className, lineClamp, fallback }: Props) {
    const normalized = normalizeIncomingContent(html || '');
    const safe = sanitizeHtml(normalized);

    if (!safe || !safe.replace(/<[^>]+>/g, '').trim()) {
        return fallback ? <>{fallback}</> : null;
    }

    const style = lineClamp ? {
        display: '-webkit-box',
        WebkitLineClamp: lineClamp,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
    } : undefined;

    return (
        <div
            className={`rich-text-display ${className || ''}`}
            style={style}
            dangerouslySetInnerHTML={{ __html: safe }}
        />
    );
}
