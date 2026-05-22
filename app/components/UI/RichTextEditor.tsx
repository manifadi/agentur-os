'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Heading1, Heading2, Heading3,
    List, ListOrdered, Quote, Link as LinkIcon, Undo2, Redo2, RemoveFormatting,
} from 'lucide-react';
import PromptModal from '../Modals/PromptModal';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: number;
    autoFocus?: boolean;
    onBlur?: () => void;
    /** Compact toolbar for inline / smaller editors */
    compact?: boolean;
}

/**
 * Detects whether a string is HTML (rough heuristic — checks if it has any tags).
 * Plain-text legacy content (e.g. existing logs) is wrapped in <p> when loaded.
 */
function isHtml(s: string): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(s);
}

function plainToHtml(s: string): string {
    if (!s) return '';
    return '<p>' + s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>') + '</p>';
}

export function normalizeIncomingContent(s: string | null | undefined): string {
    if (!s) return '';
    return isHtml(s) ? s : plainToHtml(s);
}

/** Returns true if the editor content is visually empty (just <p></p> or nothing) */
export function isEditorEmpty(html: string): boolean {
    if (!html) return true;
    const stripped = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    return stripped.length === 0;
}

export default function RichTextEditor({
    value, onChange, placeholder, minHeight = 100, autoFocus, onBlur, compact,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                bulletList: { keepMarks: true, keepAttributes: false },
                orderedList: { keepMarks: true, keepAttributes: false },
                codeBlock: false,
                horizontalRule: false,
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'underline text-accent cursor-pointer',
                    rel: 'noopener noreferrer',
                    target: '_blank',
                },
            }),
            Placeholder.configure({ placeholder: placeholder || 'Text eingeben…' }),
        ],
        content: normalizeIncomingContent(value),
        autofocus: autoFocus,
        editorProps: {
            attributes: {
                class: 'rich-text-editor-content prose-sm max-w-none focus:outline-none',
                style: `min-height: ${minHeight}px; padding: 8px 12px;`,
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onChange(isEditorEmpty(html) ? '' : html);
        },
        onBlur: () => onBlur?.(),
        // SSR-safety
        immediatelyRender: false,
    });

    // Update content when value changes externally (e.g. when editing different items)
    useEffect(() => {
        if (!editor) return;
        const normalized = normalizeIncomingContent(value);
        const current = editor.getHTML();
        // Only update if truly different — prevents cursor jump on every keystroke
        if (normalized !== current && !(isEditorEmpty(normalized) && isEditorEmpty(current))) {
            editor.commands.setContent(normalized, { emitUpdate: false });
        }
    }, [value, editor]);

    // Detect manual resize via bottom-right handle → unlock max-height from 40vh to 60vh
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [resized, setResized] = useState(false);
    useEffect(() => {
        const root = wrapperRef.current;
        if (!root) return;
        const editable = root.querySelector('.rich-text-editor-content') as HTMLElement | null;
        if (!editable) return;
        const handler = (e: PointerEvent) => {
            const rect = editable.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Native resize handle sits in the bottom-right ~18px corner
            if (rect.width - x < 18 && rect.height - y < 18) setResized(true);
        };
        editable.addEventListener('pointerdown', handler);
        return () => editable.removeEventListener('pointerdown', handler);
    }, [editor]);

    if (!editor) return null;

    return (
        <div
            ref={wrapperRef}
            className="rich-text-editor rounded-xl overflow-hidden"
            style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                ['--editor-max-h' as any]: resized ? '60vh' : '40vh',
            }}
        >
            <Toolbar editor={editor} compact={compact} />
            <div onClick={() => editor.commands.focus()} style={{ cursor: 'text' }}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

function Toolbar({ editor, compact }: { editor: Editor; compact?: boolean }) {
    // Force re-render whenever the cursor moves or content changes so that
    // `editor.isActive(...)` reflects the formatting at the current cursor position
    // (TipTap v3 doesn't trigger React re-renders on selection-only updates by default).
    const [, forceTick] = useState(0);
    useEffect(() => {
        const tick = () => forceTick(t => t + 1);
        editor.on('selectionUpdate', tick);
        editor.on('transaction', tick);
        editor.on('focus', tick);
        return () => {
            editor.off('selectionUpdate', tick);
            editor.off('transaction', tick);
            editor.off('focus', tick);
        };
    }, [editor]);

    const [linkPrompt, setLinkPrompt] = useState<{ defaultValue: string } | null>(null);

    const handleLink = () => {
        const prev = editor.getAttributes('link').href;
        setLinkPrompt({ defaultValue: prev || 'https://' });
    };

    const applyLink = (url: string) => {
        setLinkPrompt(null);
        const trimmed = url.trim();
        if (trimmed === '' || trimmed === 'https://') {
            editor.chain().focus().unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    };

    return (
        <>
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
            style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
            <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Fett (⌘B)"><Bold size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Kursiv (⌘I)"><Italic size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Unterstrichen (⌘U)"><UnderlineIcon size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Durchgestrichen"><Strikethrough size={14} /></Btn>

            <Divider />

            {!compact && <>
                <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Überschrift 1"><Heading1 size={14} /></Btn>
                <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Überschrift 2"><Heading2 size={14} /></Btn>
                <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Überschrift 3"><Heading3 size={14} /></Btn>
                <Divider />
            </>}

            <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Aufzählung"><List size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Nummerierte Liste"><ListOrdered size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Zitat"><Quote size={14} /></Btn>

            <Divider />

            <Btn onClick={handleLink} active={editor.isActive('link')} title="Link"><LinkIcon size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Formatierung entfernen"><RemoveFormatting size={14} /></Btn>

            <div className="flex-1" />

            <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Rückgängig (⌘Z)"><Undo2 size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Wiederherstellen (⌘⇧Z)"><Redo2 size={14} /></Btn>
        </div>

        <PromptModal
            isOpen={!!linkPrompt}
            title="Link einfügen"
            message="URL eingeben (leer lassen, um den Link zu entfernen)."
            placeholder="https://beispiel.de"
            defaultValue={linkPrompt?.defaultValue}
            confirmText="Link setzen"
            icon={LinkIcon}
            onConfirm={applyLink}
            onCancel={() => setLinkPrompt(null)}
        />
        </>
    );
}

function Btn({ onClick, active, disabled, title, children }: {
    onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // prevent blur on click
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
                if (!active && !disabled) e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
                if (!active && !disabled) e.currentTarget.style.background = 'transparent';
            }}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <div className="w-px h-5 mx-1" style={{ background: 'var(--border-default)' }} />;
}
