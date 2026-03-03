'use client';

import React from 'react';
import { Sun, Moon, Monitor, Palette, Type, Layout, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ThemeMode, AccentColor, FontFamily, BackgroundStyle } from '../../hooks/useTheme';

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const FONTS: { id: FontFamily; label: string; preview: string; description: string }[] = [
    { id: 'inter', label: 'Inter', preview: 'Aa', description: 'Standard & modern' },
    { id: 'outfit', label: 'Outfit', preview: 'Aa', description: 'Freundlich & rund' },
    { id: 'dm-sans', label: 'DM Sans', preview: 'Aa', description: 'Klar & neutral' },
    { id: 'playfair', label: 'Playfair Display', preview: 'Aa', description: 'Elegant & klassisch' },
    { id: 'space-grotesk', label: 'Space Grotesk', preview: 'Aa', description: 'Technisch & stark' },
    { id: 'geist-mono', label: 'Geist Mono', preview: 'Aa', description: 'Monospace & präzise' },
];

const FONT_CSS: Record<FontFamily, string> = {
    'inter': "'Inter', sans-serif",
    'outfit': "'Outfit', sans-serif",
    'dm-sans': "'DM Sans', sans-serif",
    'playfair': "'Playfair Display', serif",
    'space-grotesk': "'Space Grotesk', sans-serif",
    'geist-mono': "'Geist Mono', monospace",
};

const ACCENTS: { id: AccentColor; label: string; color: string; ring: string }[] = [
    { id: 'default', label: 'Standard', color: '#111827', ring: '#111827' },
    { id: 'blue', label: 'Blau', color: '#3B82F6', ring: '#3B82F6' },
    { id: 'violet', label: 'Violett', color: '#7C3AED', ring: '#7C3AED' },
    { id: 'rose', label: 'Rose', color: '#F43F5E', ring: '#F43F5E' },
    { id: 'emerald', label: 'Grün', color: '#10B981', ring: '#10B981' },
    { id: 'amber', label: 'Amber', color: '#D97706', ring: '#D97706' },
    { id: 'cyan', label: 'Cyan', color: '#0891B2', ring: '#0891B2' },
    { id: 'slate', label: 'Slate', color: '#475569', ring: '#475569' },
];

const BACKGROUNDS: { id: BackgroundStyle; label: string; description: string; light: string; dark: string }[] = [
    { id: 'clean', label: 'Clean', description: 'Reines Weiß/Grau', light: '#F5F5F7', dark: '#0F0F11' },
    { id: 'subtle', label: 'Subtle', description: 'Warmes Grau', light: '#FAF9F7', dark: '#13121A' },
    { id: 'canvas', label: 'Canvas', description: 'Leichter Cream-Ton', light: '#F8F6F0', dark: '#0E0D0F' },
];

// ─────────────────────────────────────────────
// Section wrapper helper
// ─────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <section
            className="p-6 rounded-2xl shadow-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
            <h2
                className="text-base font-bold mb-5 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
            >
                <Icon size={18} style={{ color: 'var(--accent)' }} />
                {title}
            </h2>
            {children}
        </section>
    );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function AppearanceSettings() {
    const { themePrefs, updateThemePrefs } = useApp();
    const isDark = themePrefs.themeMode === 'dark' ||
        (themePrefs.themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
        <div className="space-y-6 max-w-2xl">
            {/* ── 1. Light / Dark Mode ────────────────────── */}
            <Section title="Erscheinungsbild" icon={Sun}>
                <div className="grid grid-cols-3 gap-3">
                    {([
                        { id: 'light' as ThemeMode, label: 'Hell', Icon: Sun },
                        { id: 'dark' as ThemeMode, label: 'Dunkel', Icon: Moon },
                        { id: 'system' as ThemeMode, label: 'System', Icon: Monitor },
                    ]).map(({ id, label, Icon: ModeIcon }) => {
                        const active = themePrefs.themeMode === id;
                        return (
                            <button
                                key={id}
                                onClick={() => updateThemePrefs({ themeMode: id })}
                                className="relative flex flex-col items-center gap-2.5 p-4 rounded-xl transition-all duration-150"
                                style={{
                                    background: active ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                    border: active ? '2px solid var(--accent)' : '2px solid var(--border-default)',
                                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                                }}
                            >
                                {/* Preview swatch */}
                                <div
                                    className="w-full rounded-lg overflow-hidden"
                                    style={{ height: 56, border: '1px solid var(--border-default)' }}
                                >
                                    <div
                                        className="w-full h-full flex items-center justify-center"
                                        style={{
                                            background: id === 'dark' ? '#0F0F11' : id === 'light' ? '#F5F5F7' : 'linear-gradient(135deg, #F5F5F7 50%, #0F0F11 50%)',
                                        }}
                                    >
                                        <ModeIcon size={18} color={id === 'dark' ? '#FAFAFA' : id === 'light' ? '#111827' : 'gray'} />
                                    </div>
                                </div>
                                <span className="text-xs font-semibold">{label}</span>
                                {active && (
                                    <div
                                        className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{ background: 'var(--accent)' }}
                                    >
                                        <Check size={10} color="white" strokeWidth={3} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </Section>

            {/* ── 2. Akzentfarbe ───────────────────────────── */}
            <Section title="Akzentfarbe" icon={Palette}>
                <div className="grid grid-cols-4 gap-3">
                    {ACCENTS.map(({ id, label, color }) => {
                        const active = themePrefs.accentColor === id;
                        return (
                            <button
                                key={id}
                                onClick={() => updateThemePrefs({ accentColor: id })}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150"
                                style={{
                                    background: active ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                    border: active ? '2px solid var(--accent)' : '2px solid transparent',
                                }}
                                title={label}
                            >
                                <div
                                    className="w-8 h-8 rounded-full relative flex items-center justify-center shadow-sm"
                                    style={{ background: color }}
                                >
                                    {active && <Check size={14} color="white" strokeWidth={3} />}
                                </div>
                                <span className="text-[10px] font-semibold" style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </Section>

            {/* ── 3. Schriftart ────────────────────────────── */}
            <Section title="Schriftart" icon={Type}>
                <div className="grid grid-cols-2 gap-3">
                    {FONTS.map(({ id, label, preview, description }) => {
                        const active = themePrefs.fontFamily === id;
                        return (
                            <button
                                key={id}
                                onClick={() => updateThemePrefs({ fontFamily: id })}
                                className="relative flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-150"
                                style={{
                                    background: active ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                    border: active ? '2px solid var(--accent)' : '2px solid var(--border-default)',
                                }}
                            >
                                {/* Font preview */}
                                <div
                                    className="text-3xl font-bold shrink-0 w-12 text-center leading-none"
                                    style={{
                                        fontFamily: FONT_CSS[id],
                                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                    }}
                                >
                                    {preview}
                                </div>
                                <div className="min-w-0">
                                    <div
                                        className="text-sm font-bold leading-tight truncate"
                                        style={{ color: active ? 'var(--accent)' : 'var(--text-primary)', fontFamily: FONT_CSS[id] }}
                                    >
                                        {label}
                                    </div>
                                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {description}
                                    </div>
                                </div>
                                {active && (
                                    <div
                                        className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{ background: 'var(--accent)' }}
                                    >
                                        <Check size={10} color="white" strokeWidth={3} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </Section>

            {/* ── 4. Hintergrund ───────────────────────────── */}
            <Section title="Hintergrund" icon={Layout}>
                <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map(({ id, label, description, light, dark }) => {
                        const active = themePrefs.backgroundStyle === id;
                        const previewColor = isDark ? dark : light;
                        return (
                            <button
                                key={id}
                                onClick={() => updateThemePrefs({ backgroundStyle: id })}
                                className="relative flex flex-col items-center gap-2.5 p-4 rounded-xl transition-all duration-150"
                                style={{
                                    background: active ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                    border: active ? '2px solid var(--accent)' : '2px solid var(--border-default)',
                                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                                }}
                            >
                                {/* Preview swatch */}
                                <div
                                    className="w-full rounded-lg"
                                    style={{
                                        height: 48,
                                        background: previewColor,
                                        border: '1px solid var(--border-default)',
                                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                                    }}
                                />
                                <div className="text-center">
                                    <div className="text-xs font-bold">{label}</div>
                                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>
                                </div>
                                {active && (
                                    <div
                                        className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{ background: 'var(--accent)' }}
                                    >
                                        <Check size={10} color="white" strokeWidth={3} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </Section>

            {/* ── Info Footer ───────────────────────────────── */}
            <p className="text-xs text-center pb-2" style={{ color: 'var(--text-muted)' }}>
                Alle Einstellungen werden automatisch gespeichert und auf allen Geräten synchronisiert.
            </p>
        </div>
    );
}
