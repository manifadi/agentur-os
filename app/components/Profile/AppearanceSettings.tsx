'use client';

import React, { useRef } from 'react';
import { Sun, Moon, Monitor, Palette, Type, Layout, Check, Pipette } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ThemeMode, AccentColor, FontFamily, BackgroundStyle } from '../../hooks/useTheme';

// ─────────────────────────────────────────────
// Font data — grouped
// ─────────────────────────────────────────────
const FONT_GROUPS: { label: string; fonts: { id: FontFamily; name: string; css: string }[] }[] = [
    {
        label: 'Modern & Klar',
        fonts: [
            { id: 'inter',        name: 'Inter',            css: "'Inter', sans-serif" },
            { id: 'dm-sans',      name: 'DM Sans',          css: "'DM Sans', sans-serif" },
            { id: 'outfit',       name: 'Outfit',           css: "'Outfit', sans-serif" },
            { id: 'manrope',      name: 'Manrope',          css: "'Manrope', sans-serif" },
            { id: 'plus-jakarta', name: 'Plus Jakarta',     css: "'Plus Jakarta Sans', sans-serif" },
            { id: 'figtree',      name: 'Figtree',          css: "'Figtree', sans-serif" },
            { id: 'sora',         name: 'Sora',             css: "'Sora', sans-serif" },
            { id: 'nunito',       name: 'Nunito',           css: "'Nunito', sans-serif" },
            { id: 'space-grotesk',name: 'Space Grotesk',    css: "'Space Grotesk', sans-serif" },
        ],
    },
    {
        label: 'Elegant & Fancy',
        fonts: [
            { id: 'playfair',  name: 'Playfair',   css: "'Playfair Display', serif" },
            { id: 'cormorant', name: 'Cormorant',  css: "'Cormorant Garamond', serif" },
            { id: 'fraunces',  name: 'Fraunces',   css: "'Fraunces', serif" },
            { id: 'italiana',  name: 'Italiana',   css: "'Italiana', serif" },
            { id: 'cinzel',    name: 'Cinzel',     css: "'Cinzel', serif" },
        ],
    },
    {
        label: 'Monospace',
        fonts: [
            { id: 'geist-mono', name: 'Geist Mono', css: "'Geist Mono', monospace" },
        ],
    },
];

// ─────────────────────────────────────────────
// Accent color presets
// ─────────────────────────────────────────────
const ACCENTS: { id: AccentColor; color: string; label: string }[] = [
    { id: 'default', color: '#111827', label: 'Standard' },
    { id: 'blue',    color: '#3B82F6', label: 'Blau' },
    { id: 'indigo',  color: '#6366F1', label: 'Indigo' },
    { id: 'violet',  color: '#7C3AED', label: 'Violett' },
    { id: 'pink',    color: '#EC4899', label: 'Pink' },
    { id: 'rose',    color: '#F43F5E', label: 'Rose' },
    { id: 'orange',  color: '#F97316', label: 'Orange' },
    { id: 'amber',   color: '#D97706', label: 'Amber' },
    { id: 'emerald', color: '#10B981', label: 'Grün' },
    { id: 'teal',    color: '#14B8A6', label: 'Teal' },
    { id: 'cyan',    color: '#0891B2', label: 'Cyan' },
    { id: 'slate',   color: '#475569', label: 'Slate' },
];

const BACKGROUNDS: { id: BackgroundStyle; label: string; description: string; light: string; dark: string }[] = [
    { id: 'clean',  label: 'Clean',  description: 'Reines Weiß/Grau',    light: '#F5F5F7', dark: '#0F0F11' },
    { id: 'subtle', label: 'Subtle', description: 'Warmes Grau',         light: '#FAF9F7', dark: '#13121A' },
    { id: 'canvas', label: 'Canvas', description: 'Leichter Cream-Ton',  light: '#F8F6F0', dark: '#0E0D0F' },
];

// ─────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <section
            className="p-6 rounded-2xl shadow-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
            <h2 className="text-sm font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Icon size={16} style={{ color: 'var(--accent)' }} />
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
    const colorInputRef = useRef<HTMLInputElement>(null);

    const isDark = themePrefs.themeMode === 'dark' ||
        (themePrefs.themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const activeCustomColor = themePrefs.customAccentColor || '#3B82F6';

    return (
        <div className="space-y-5 max-w-2xl">

            {/* ── 1. Light / Dark Mode ── */}
            <Section title="Erscheinungsbild" icon={Sun}>
                <div className="grid grid-cols-3 gap-3">
                    {([
                        { id: 'light' as ThemeMode, label: 'Hell',    Icon: Sun },
                        { id: 'dark'  as ThemeMode, label: 'Dunkel',  Icon: Moon },
                        { id: 'system'as ThemeMode, label: 'System',  Icon: Monitor },
                    ]).map(({ id, label, Icon: ModeIcon }) => {
                        const active = themePrefs.themeMode === id;
                        return (
                            <button
                                key={id}
                                onClick={() => updateThemePrefs({ themeMode: id })}
                                className="relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150"
                                style={{
                                    background: active ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                    border: active ? '2px solid var(--accent)' : '2px solid var(--border-default)',
                                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                                }}
                            >
                                <div
                                    className="w-full rounded-lg overflow-hidden"
                                    style={{ height: 44, border: '1px solid var(--border-default)' }}
                                >
                                    <div className="w-full h-full flex items-center justify-center" style={{
                                        background: id === 'dark' ? '#0F0F11' : id === 'light' ? '#F5F5F7' : 'linear-gradient(135deg, #F5F5F7 50%, #0F0F11 50%)',
                                    }}>
                                        <ModeIcon size={16} color={id === 'dark' ? '#FAFAFA' : id === 'light' ? '#111827' : 'gray'} />
                                    </div>
                                </div>
                                <span className="text-xs font-semibold">{label}</span>
                                {active && (
                                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                                        <Check size={9} color="white" strokeWidth={3} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </Section>

            {/* ── 2. Akzentfarbe ── */}
            <Section title="Akzentfarbe" icon={Palette}>
                {/* Preset swatches */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {ACCENTS.map(({ id, color, label }) => {
                        const active = themePrefs.accentColor === id;
                        return (
                            <button
                                key={id}
                                onClick={() => updateThemePrefs({ accentColor: id })}
                                title={label}
                                className="relative w-8 h-8 rounded-full transition-all duration-150 flex items-center justify-center"
                                style={{
                                    background: color,
                                    boxShadow: active ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${color}` : 'none',
                                    transform: active ? 'scale(1.15)' : 'scale(1)',
                                }}
                            >
                                {active && <Check size={13} color="white" strokeWidth={3} />}
                            </button>
                        );
                    })}

                    {/* Custom color picker */}
                    <div className="relative">
                        <button
                            onClick={() => colorInputRef.current?.click()}
                            title="Eigene Farbe"
                            className="relative w-8 h-8 rounded-full transition-all duration-150 flex items-center justify-center overflow-hidden"
                            style={{
                                background: themePrefs.accentColor === 'custom'
                                    ? activeCustomColor
                                    : 'conic-gradient(from 0deg, #f43f5e, #f97316, #facc15, #10b981, #3b82f6, #7c3aed, #ec4899, #f43f5e)',
                                boxShadow: themePrefs.accentColor === 'custom'
                                    ? `0 0 0 2px var(--bg-card), 0 0 0 4px ${activeCustomColor}`
                                    : 'none',
                                transform: themePrefs.accentColor === 'custom' ? 'scale(1.15)' : 'scale(1)',
                            }}
                        >
                            {themePrefs.accentColor === 'custom'
                                ? <Check size={13} color="white" strokeWidth={3} />
                                : <Pipette size={12} color="white" strokeWidth={2.5} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }} />
                            }
                        </button>
                        <input
                            ref={colorInputRef}
                            type="color"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            value={activeCustomColor}
                            onChange={(e) => updateThemePrefs({ accentColor: 'custom', customAccentColor: e.target.value })}
                        />
                    </div>
                </div>

                {/* Custom color label */}
                {themePrefs.accentColor === 'custom' && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: activeCustomColor }} />
                        Eigene Farbe: <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{activeCustomColor.toUpperCase()}</span>
                    </div>
                )}
            </Section>

            {/* ── 3. Schriftart ── */}
            <Section title="Schriftart" icon={Type}>
                <div className="space-y-4">
                    {FONT_GROUPS.map((group) => (
                        <div key={group.label}>
                            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                                {group.label}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {group.fonts.map(({ id, name, css }) => {
                                    const active = themePrefs.fontFamily === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => updateThemePrefs({ fontFamily: id })}
                                            className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150"
                                            style={{
                                                background: active ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                                border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border-default)',
                                                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <span
                                                className="text-lg font-bold leading-none"
                                                style={{ fontFamily: css, lineHeight: 1 }}
                                            >
                                                Aa
                                            </span>
                                            <span className="text-xs font-semibold whitespace-nowrap" style={{ fontFamily: css }}>
                                                {name}
                                            </span>
                                            {active && (
                                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                                                    <Check size={8} color="white" strokeWidth={3} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            {/* ── 4. Hintergrund ── */}
            <Section title="Hintergrund" icon={Layout}>
                <div className="grid grid-cols-3 gap-3">
                    {BACKGROUNDS.map(({ id, label, description, light, dark }) => {
                        const active = themePrefs.backgroundStyle === id;
                        const previewColor = isDark ? dark : light;
                        return (
                            <button
                                key={id}
                                onClick={() => updateThemePrefs({ backgroundStyle: id })}
                                className="relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-150"
                                style={{
                                    background: active ? 'var(--accent-subtle)' : 'var(--bg-subtle)',
                                    border: active ? '2px solid var(--accent)' : '2px solid var(--border-default)',
                                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                                }}
                            >
                                <div className="w-full rounded-lg" style={{
                                    height: 40,
                                    background: previewColor,
                                    border: '1px solid var(--border-default)',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                                }} />
                                <div className="text-center">
                                    <div className="text-xs font-bold">{label}</div>
                                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>
                                </div>
                                {active && (
                                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                                        <Check size={9} color="white" strokeWidth={3} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <p className="text-xs text-center pb-2" style={{ color: 'var(--text-muted)' }}>
                Alle Einstellungen werden automatisch gespeichert und auf allen Geräten synchronisiert.
            </p>
        </div>
    );
}
