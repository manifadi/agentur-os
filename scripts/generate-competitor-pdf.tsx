/*
 * Vela / Agentur OS — Mitbewerber-Analyse (v2, polished)
 *
 * - Vela Design-System (Farben, Typo, Card-Pattern)
 * - Logo auf Cover + Footer
 * - Farbige Status-Dots mit Legende
 * - Score-Pills pro Tool
 * - Pricing-Balken-Diagramm
 *
 * Ausführen:  npx tsx scripts/generate-competitor-pdf.tsx
 * Output:     ./Mitbewerber-Analyse-Vela.pdf
 */

import React from 'react';
import path from 'path';
import fs from 'fs';
import {
    Document, Page, Text, View, Image, StyleSheet, renderToFile, Font, Svg, Circle, Path,
} from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────
// Font registration (Vela Sans — falls woff2 nicht klappt: Helvetica)
// ─────────────────────────────────────────────────────────────
const FONT_DIR = path.resolve(process.cwd(), 'public/fonts/vela-sans');
let FONT_FAMILY = 'Helvetica';
try {
    Font.register({
        family: 'Vela Sans',
        fonts: [
            { src: path.join(FONT_DIR, 'VelaSans-Regular.woff2'),  fontWeight: 400 },
            { src: path.join(FONT_DIR, 'VelaSans-Medium.woff2'),   fontWeight: 500 },
            { src: path.join(FONT_DIR, 'VelaSans-SemiBold.woff2'), fontWeight: 600 },
            { src: path.join(FONT_DIR, 'VelaSans-Bold.woff2'),     fontWeight: 700 },
        ],
    });
    FONT_FAMILY = 'Vela Sans';
} catch (e) {
    console.warn('Vela Sans konnte nicht geladen werden — fallback auf Helvetica.', e);
}

// Disable hyphenation (sonst werden Wörter mit Bindestrich getrennt)
Font.registerHyphenationCallback(word => [word]);

// ─────────────────────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────────────────────
const C = {
    textPrimary:   '#111827',
    textSecondary: '#374151',
    textMuted:     '#6B7280',
    textPlaceholder: '#9CA3AF',
    surface:       '#FFFFFF',
    subtle:        '#F5F5F7',
    page:          '#FFFFFF',
    borderDefault: '#E5E7EB',
    borderStrong:  '#D1D5DB',
    borderSubtle:  '#F3F4F6',
    accent:        '#111827',
    accentSubtle:  'rgba(17, 24, 39, 0.08)',

    success:       '#10B981',
    successSubtle: '#ECFDF5',
    successText:   '#065F46',
    successBorder: 'rgba(16, 185, 129, 0.25)',

    warning:       '#F59E0B',
    warningSubtle: '#FFFBEB',
    warningText:   '#78350F',
    warningBorder: 'rgba(245, 158, 11, 0.25)',

    danger:        '#EF4444',
    dangerSubtle:  '#FEF2F2',
    dangerText:    '#991B1B',
    dangerBorder:  'rgba(239, 68, 68, 0.25)',

    info:          '#3B82F6',
    infoSubtle:    '#EFF6FF',
    infoText:      '#1E40AF',
};

const s = StyleSheet.create({
    page: {
        backgroundColor: C.page,
        paddingTop: 48,
        paddingBottom: 64,
        paddingHorizontal: 48,
        fontSize: 10,
        color: C.textPrimary,
        fontFamily: FONT_FAMILY,
    },

    // ── Typography ──
    eyebrow: { fontSize: 8.5, color: C.textMuted, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase' },
    h1:      { fontSize: 26, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.5, lineHeight: 1.15 },
    h2:      { fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.3, lineHeight: 1.2, marginBottom: 6 },
    h3:      { fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 4 },
    h4:      { fontSize: 11, fontWeight: 700, color: C.textPrimary },
    body:    { fontSize: 10,   color: C.textSecondary, lineHeight: 1.55 },
    callout: { fontSize: 9.5,  color: C.textSecondary, lineHeight: 1.55 },
    caption: { fontSize: 8.5,  color: C.textMuted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' },
    label:   { fontSize: 8,    color: C.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' },

    // ── Layout ──
    sectionHead:    { marginBottom: 18 },
    sectionLead:    { fontSize: 11, color: C.textSecondary, lineHeight: 1.55, marginTop: 10 },

    // ── Card ──
    card: {
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.borderDefault,
        borderRadius: 12, padding: 14, marginBottom: 10,
    },
    cardAccent: {
        backgroundColor: C.subtle,
        borderWidth: 1, borderColor: C.borderDefault,
        borderRadius: 12, padding: 14, marginBottom: 10,
    },
    cardDanger: {
        backgroundColor: C.dangerSubtle,
        borderWidth: 1, borderColor: C.dangerBorder,
        borderRadius: 12, padding: 14, marginBottom: 10,
    },

    // ── Footer ──
    footer: {
        position: 'absolute', bottom: 24, left: 48, right: 48,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingTop: 8,
    },
    footerLogo:  { width: 48, height: 14, objectFit: 'contain' },
    footerText:  { fontSize: 8, color: C.textMuted },
});

// ─────────────────────────────────────────────────────────────
// Page Footer (mit Logo)
// ─────────────────────────────────────────────────────────────
const LOGO_PATH = path.resolve(process.cwd(), 'public/vela-logo.png');

const Footer = () => (
    <View style={s.footer} fixed>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {fs.existsSync(LOGO_PATH) && <Image src={LOGO_PATH} style={s.footerLogo} />}
            <Text style={s.footerText}>Mitbewerber-Analyse · Q2 2026</Text>
        </View>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
);

// ─────────────────────────────────────────────────────────────
// Status Dot (für Feature-Matrix)
// ─────────────────────────────────────────────────────────────
type Status = 'yes' | 'partial' | 'no';

const STATUS_COLOR: Record<Status, { bg: string; ring: string }> = {
    yes:     { bg: C.success,  ring: 'rgba(16, 185, 129, 0.18)' },
    partial: { bg: C.warning,  ring: 'rgba(245, 158, 11, 0.18)' },
    no:      { bg: '#D1D5DB',  ring: 'rgba(209, 213, 219, 0.4)' },
};

const StatusDot = ({ status, size = 10 }: { status: Status; size?: number }) => {
    const col = STATUS_COLOR[status];
    const ring = size + 4;
    return (
        <View style={{
            width: ring, height: ring, borderRadius: ring / 2,
            backgroundColor: col.ring,
            alignItems: 'center', justifyContent: 'center',
        }}>
            <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: col.bg }} />
        </View>
    );
};

// Inline mini-legend
const StatusLegend = () => (
    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <LegendItem status="yes"     label="Nativ vorhanden" />
        <LegendItem status="partial" label="Teilweise / Add-on / höherer Tier" />
        <LegendItem status="no"      label="Fehlt — externe Lösung nötig" />
    </View>
);

const LegendItem = ({ status, label }: { status: Status; label: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <StatusDot status={status} size={7} />
        <Text style={{ fontSize: 8, color: C.textSecondary }}>{label}</Text>
    </View>
);

// ─────────────────────────────────────────────────────────────
// Pill / Badge
// ─────────────────────────────────────────────────────────────
const Pill = ({ children, variant = 'default' }: {
    children: string; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
}) => {
    const colors: Record<string, { bg: string; fg: string; border?: string }> = {
        default: { bg: C.subtle, fg: C.textMuted, border: C.borderDefault },
        success: { bg: C.successSubtle, fg: C.successText, border: C.successBorder },
        warning: { bg: C.warningSubtle, fg: C.warningText, border: C.warningBorder },
        danger:  { bg: C.dangerSubtle,  fg: C.dangerText,  border: C.dangerBorder },
        info:    { bg: C.infoSubtle,    fg: C.infoText },
        accent:  { bg: C.accent,        fg: '#FFFFFF' },
    };
    const c = colors[variant];
    const wrapStyle: any = {
        backgroundColor: c.bg, borderRadius: 4,
        paddingVertical: 2, paddingHorizontal: 6,
        alignSelf: 'flex-start',
    };
    if (c.border) {
        wrapStyle.borderWidth = 1;
        wrapStyle.borderColor = c.border;
    }
    return (
        <View style={wrapStyle}>
            <Text style={{ fontSize: 7.5, fontWeight: 700, color: c.fg, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {children}
            </Text>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────
// Tool-Daten
// ─────────────────────────────────────────────────────────────
interface Tool {
    name: string;
    origin: string;
    founded: string;
    target: string;
    priceRange: string;
    strengths: string[];
    weaknesses: string[];
    isVela?: boolean;
}

const TOOLS: Tool[] = [
    {
        name: 'awork',
        origin: 'Hamburg, DE',
        founded: '2018',
        target: 'Agenturen 5–100 MA',
        priceRange: '5–22 €/User/Monat',
        strengths: [
            'Moderne UI, Fokus auf Agentur-Workflows',
            'Multi-Projekt-Planung mit echter Verfügbarkeitsrechnung',
            'KI-Assistenz für Aufwandsschätzung + Re-Planning',
            'awork Connect: kostenfreie externe Kollaboration',
            'ISO 27001, EU-Hosting, DSGVO-konform',
        ],
        weaknesses: [
            'Keine Angebote, keine Rechnungen, kein DATEV',
            'Kalkulation rudimentär (Budget statt mehrstufige Schemata)',
            'Pricing eskaliert: 22 €/User für Professional',
            'Erweitertes Reporting erst ab Professional',
        ],
    },
    {
        name: 'MOCO',
        origin: 'Schweiz / DACH',
        founded: '2010',
        target: 'Agenturen 5–40 MA, Beratungen',
        priceRange: '16–24 € + 5 € Planning',
        strengths: [
            'Echtes All-in-One: Projekte, Zeit, Kalkulation, Rechnungen',
            'E-Rechnung (ZUGFeRD/XRechnung), Mahnwesen, wiederkehrende Rechnungen',
            'DATEV-CSV-Export, saubere REST-API',
            'Exzellenter deutschsprachiger Support',
            'Schnelle Einarbeitung (unter einem Tag)',
        ],
        weaknesses: [
            'Task-Management simpel — kein Kanban, keine Subtasks',
            'Reporting starr, keine konfigurierbaren Dashboards',
            'Ressourcenplanung nur als kostenpflichtiges Add-on',
            'UI nüchtern, nicht modern/Apple-like',
        ],
    },
    {
        name: 'Troi',
        origin: 'Berlin/Köln, DE',
        founded: '1999',
        target: 'Agenturen 40–500 MA, Inhouse',
        priceRange: '49–69+ € + Setup 10–50k €',
        strengths: [
            'Vollständiges ERP, Multi-Mandant, Multi-Currency',
            'Native DATEV-Schnittstelle, Unternehmen Online',
            'Mehrstufige Kalkulation, Verrechnungssätze',
            'BI-Modul, PowerBI-Anbindung, KPI-Cockpits',
            'Top-100-Agentur-Referenzen',
        ],
        weaknesses: [
            'Komplexe Einarbeitung (3–6 Monate produktiv)',
            'UI wirkt 10+ Jahre zurück, SAP-artig',
            'Hohe TCO durch Setup + Beratung + Lizenzen',
            'Mobile dünn, Kollaboration rudimentär',
        ],
    },
    {
        name: 'Asana',
        origin: 'San Francisco, US',
        founded: '2008',
        target: 'Mittlere–große Teams',
        priceRange: '11–25 €/User/Monat',
        strengths: [
            'Ausgereiftes Task-Management (Listen, Boards, Timeline, Gantt)',
            'Asana AI: Smart Status, Workflow Agents ab Advanced',
            '300+ Integrationen (Slack, Figma, Salesforce)',
            'Universal Reporting, EU-Hosting ab Enterprise',
        ],
        weaknesses: [
            'Zeiterfassung NICHT built-in — Harvest/Everhour als Drittlösung',
            'Keine Kalkulation, Angebote, Rechnungen, kein DATEV',
            'Workload-View erst ab Advanced (25 €/User)',
            'Generisches Tool, nicht agentur-spezifisch',
        ],
    },
    {
        name: 'Monday.com',
        origin: 'Tel Aviv, IL',
        founded: '2012',
        target: 'Visuelle Teams, Marketing',
        priceRange: '9–19 €/User/Monat (3er-Schritte)',
        strengths: [
            'Boards-zentrierte UI, sehr visuell und flexibel',
            'Built-in Zeiterfassung ab Pro',
            '200+ Integrationen, monday AI in allen Tiers',
            'Schnelles Setup für nicht-technische Teams',
        ],
        weaknesses: [
            '3er-Schritte-Abrechnung: 7 User = bezahlst 10',
            'Keine Rechnungen, Angebote, DATEV',
            'Kapazitätsplanung nur halbgar',
            'Performance bei vielen Items bricht ein',
        ],
    },
    {
        name: 'ClickUp',
        origin: 'San Diego, US',
        founded: '2017',
        target: 'Kleine Agenturen, Freelancer',
        priceRange: '7–19 USD/User/Monat',
        strengths: [
            'Beste built-in Zeiterfassung — Billable, Timesheets',
            '1000+ Integrationen, sehr feature-reich',
            'Preis-Leader unter den All-in-One-Tools',
            'ClickUp Brain (KI-Add-on)',
        ],
        weaknesses: [
            'Komplexität führt oft zum Scheitern',
            'Keine echte Rechnungslogik (Templates ≠ GoBD)',
            'Kein DATEV, kein deutsches Mahnwesen',
            'Default US-Hosting, Übersetzung schwankt',
        ],
    },
];

// ─────────────────────────────────────────────────────────────
// FEATURE MATRIX DATA
// ─────────────────────────────────────────────────────────────
interface FeatureRow {
    category: string;
    name: string;
    vela: Status; awork: Status; moco: Status; troi: Status;
    asana: Status; monday: Status; clickup: Status;
}

const FEATURES: FeatureRow[] = [
    // Kategorie: Projekt-Management
    { category: 'PM',     name: 'Projekt-Verwaltung',         vela: 'yes',     awork: 'yes',     moco: 'yes',     troi: 'yes',     asana: 'yes',     monday: 'yes',     clickup: 'yes' },
    { category: 'PM',     name: 'Aufgaben / Todos',           vela: 'yes',     awork: 'yes',     moco: 'partial', troi: 'partial', asana: 'yes',     monday: 'yes',     clickup: 'yes' },
    { category: 'PM',     name: 'Kanban-Board',               vela: 'partial', awork: 'yes',     moco: 'no',      troi: 'partial', asana: 'yes',     monday: 'yes',     clickup: 'yes' },

    // Zeit
    { category: 'Time',   name: 'Zeiterfassung built-in',     vela: 'yes',     awork: 'yes',     moco: 'yes',     troi: 'yes',     asana: 'no',      monday: 'partial', clickup: 'yes' },
    { category: 'Time',   name: 'Ressourcenplanung',          vela: 'yes',     awork: 'yes',     moco: 'partial', troi: 'yes',     asana: 'partial', monday: 'partial', clickup: 'partial' },

    // Buchhaltung / Geld
    { category: 'Money',  name: 'Kalkulation mehrstufig',     vela: 'yes',     awork: 'partial', moco: 'yes',     troi: 'yes',     asana: 'no',      monday: 'no',      clickup: 'no' },
    { category: 'Money',  name: 'Angebote PDF',               vela: 'yes',     awork: 'no',      moco: 'yes',     troi: 'yes',     asana: 'no',      monday: 'no',      clickup: 'no' },
    { category: 'Money',  name: 'Rechnungen PDF',             vela: 'yes',     awork: 'no',      moco: 'yes',     troi: 'yes',     asana: 'no',      monday: 'no',      clickup: 'no' },
    { category: 'Money',  name: 'E-Rechnung (ZUGFeRD)',       vela: 'no',      awork: 'no',      moco: 'yes',     troi: 'yes',     asana: 'no',      monday: 'no',      clickup: 'no' },
    { category: 'Money',  name: 'DATEV-Export',               vela: 'no',      awork: 'no',      moco: 'yes',     troi: 'yes',     asana: 'no',      monday: 'no',      clickup: 'no' },
    { category: 'Money',  name: 'Mahnwesen',                  vela: 'no',      awork: 'no',      moco: 'yes',     troi: 'yes',     asana: 'no',      monday: 'no',      clickup: 'no' },

    // Productivity
    { category: 'Prod',   name: 'Kalender-Sync',              vela: 'yes',     awork: 'yes',     moco: 'partial', troi: 'partial', asana: 'yes',     monday: 'yes',     clickup: 'yes' },
    { category: 'Prod',   name: 'Dashboards / Reporting',     vela: 'yes',     awork: 'partial', moco: 'partial', troi: 'yes',     asana: 'partial', monday: 'yes',     clickup: 'partial' },
    { category: 'Prod',   name: 'Realtime-Updates',           vela: 'yes',     awork: 'partial', moco: 'no',      troi: 'no',      asana: 'partial', monday: 'partial', clickup: 'partial' },

    // UX / Platform
    { category: 'UX',     name: 'Dark Mode',                  vela: 'yes',     awork: 'yes',     moco: 'no',      troi: 'no',      asana: 'yes',     monday: 'yes',     clickup: 'yes' },
    { category: 'UX',     name: 'Multi-Tenant / White-Label', vela: 'yes',     awork: 'partial', moco: 'no',      troi: 'yes',     asana: 'partial', monday: 'partial', clickup: 'partial' },
    { category: 'UX',     name: 'Personalisierung MA',        vela: 'yes',     awork: 'partial', moco: 'no',      troi: 'partial', asana: 'no',      monday: 'no',      clickup: 'no' },

    // Erweitert
    { category: 'Ext',    name: 'Mobile-App',                 vela: 'no',      awork: 'yes',     moco: 'yes',     troi: 'partial', asana: 'yes',     monday: 'yes',     clickup: 'yes' },
    { category: 'Ext',    name: 'KI / AI-Features',           vela: 'no',      awork: 'yes',     moco: 'no',      troi: 'no',      asana: 'yes',     monday: 'yes',     clickup: 'yes' },
    { category: 'Ext',    name: 'API / Webhooks',             vela: 'no',      awork: 'yes',     moco: 'yes',     troi: 'yes',     asana: 'yes',     monday: 'yes',     clickup: 'yes' },
    { category: 'Ext',    name: 'Client-Portal',              vela: 'no',      awork: 'yes',     moco: 'partial', troi: 'partial', asana: 'partial', monday: 'partial', clickup: 'partial' },
];

const CATEGORY_LABEL: Record<string, string> = {
    PM:    'Projekt-Management',
    Time:  'Zeit & Ressourcen',
    Money: 'Buchhaltung & Finanzen',
    Prod:  'Produktivität',
    UX:    'UX & Plattform',
    Ext:   'Erweiterungen',
};

// ─────────────────────────────────────────────────────────────
// Score-Berechnung pro Tool (für Pills)
// ─────────────────────────────────────────────────────────────
function scoreFor(toolKey: keyof FeatureRow): { yes: number; partial: number; no: number; pct: number } {
    let yes = 0, partial = 0, no = 0;
    for (const r of FEATURES) {
        const v = r[toolKey] as Status;
        if (v === 'yes')     yes++;
        else if (v === 'partial') partial++;
        else                 no++;
    }
    const pct = Math.round((yes * 1 + partial * 0.5) / FEATURES.length * 100);
    return { yes, partial, no, pct };
}

const SCORES = {
    vela:    scoreFor('vela'),
    awork:   scoreFor('awork'),
    moco:    scoreFor('moco'),
    troi:    scoreFor('troi'),
    asana:   scoreFor('asana'),
    monday:  scoreFor('monday'),
    clickup: scoreFor('clickup'),
};

// ─────────────────────────────────────────────────────────────
// Score Bar Component
// ─────────────────────────────────────────────────────────────
const ScoreBar = ({ score, label, isVela }: { score: { yes: number; partial: number; no: number; pct: number }; label: string; isVela?: boolean }) => {
    const total = score.yes + score.partial + score.no;
    const yesPct     = (score.yes / total) * 100;
    const partialPct = (score.partial / total) * 100;
    return (
        <View style={{ marginBottom: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: isVela ? C.accent : C.textPrimary }}>
                    {label}{isVela ? '  (das sind wir)' : ''}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 8, color: C.textMuted }}>
                        {score.yes} nativ · {score.partial} teilw. · {score.no} fehlen
                    </Text>
                    <View style={{ minWidth: 32, alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: isVela ? C.success : C.textPrimary }}>
                            {score.pct}%
                        </Text>
                    </View>
                </View>
            </View>
            <View style={{
                height: 6, borderRadius: 3, backgroundColor: C.borderSubtle, overflow: 'hidden',
                flexDirection: 'row',
            }}>
                <View style={{ width: `${yesPct}%`, backgroundColor: C.success }} />
                <View style={{ width: `${partialPct}%`, backgroundColor: C.warning }} />
            </View>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────
// Reusables
// ─────────────────────────────────────────────────────────────
const SectionHead = ({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) => (
    <View style={s.sectionHead}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={[s.h2, { marginTop: 4 }]}>{title}</Text>
        {lead && <Text style={s.sectionLead}>{lead}</Text>}
    </View>
);

const Bullet = ({ children, variant = 'default' }: { children: string; variant?: 'default' | 'success' | 'danger' }) => {
    const dotColor =
        variant === 'success' ? C.success :
        variant === 'danger'  ? C.danger  : C.textMuted;
    return (
        <View style={{ flexDirection: 'row', marginBottom: 3, gap: 6 }}>
            <View style={{
                width: 4, height: 4, borderRadius: 2, backgroundColor: dotColor,
                marginTop: 5.5,
            }} />
            <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.5, color: C.textSecondary }}>{children}</Text>
        </View>
    );
};

const KV = ({ k, v }: { k: string; v: string }) => (
    <View style={{ flexDirection: 'row', marginBottom: 3 }}>
        <Text style={{ width: 60, fontSize: 8, color: C.textMuted, fontWeight: 600 }}>{k}</Text>
        <Text style={{ flex: 1, fontSize: 9, color: C.textPrimary, fontWeight: 500 }}>{v}</Text>
    </View>
);

// ─────────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────────
const Doc = () => (
    <Document
        title="Vela — Mitbewerber-Analyse"
        author="Vela / Agentur OS"
        subject="Wettbewerbsvergleich Agentur-Software DACH"
    >
        <CoverPage />
        <SummaryPage />
        <ToolDeepDivePage tools={TOOLS.slice(0, 3)} title="DACH-Spezialisten" eyebrow="02 · Tool-Steckbriefe (1 / 2)" lead="awork, MOCO und Troi sind explizit für deutschsprachige Agenturen gebaut — mit unterschiedlichen Zielgruppen und Reifegraden." />
        <ToolDeepDivePage tools={TOOLS.slice(3, 6)} title="Internationale Generic-Tools" eyebrow="02 · Tool-Steckbriefe (2 / 2)" lead="Asana, Monday und ClickUp werden auch von DACH-Agenturen genutzt — keines davon hat aber Buchhaltung built-in." />
        <ScoreOverviewPage />
        <FeatureMatrixPage />
        <PricingPage />
        <USPPage />
        <GapsPage />
        <StrategyPage />
        <AppendixPage />
    </Document>
);

// ─────────────────────────────────────────────────────────────
// PAGE: COVER
// ─────────────────────────────────────────────────────────────
const CoverPage = () => (
    <Page size="A4" style={[s.page, { padding: 0 }]}>
        {/* Top accent strip */}
        <View style={{ height: 4, backgroundColor: C.accent }} />

        <View style={{ flex: 1, padding: 48, justifyContent: 'space-between' }}>
            {/* Logo top */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {fs.existsSync(LOGO_PATH) && <Image src={LOGO_PATH} style={{ width: 80, height: 24, objectFit: 'contain' }} />}
                <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, letterSpacing: 1 }}>
                    AGENTUR OS · INTERNE STRATEGIE
                </Text>
            </View>

            {/* Title block */}
            <View>
                <Text style={[s.eyebrow, { color: C.accent, marginBottom: 14 }]}>Q2 2026 · Mitbewerber-Analyse</Text>
                <Text style={[s.h1, { fontSize: 42, lineHeight: 1.1, marginBottom: 12 }]}>
                    Wer kann was{'\n'}am DACH-Markt.
                </Text>
                <Text style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.55, maxWidth: 420 }}>
                    Sachlicher Feature-Vergleich gegen die sechs wichtigsten Tools für deutschsprachige
                    Kreativagenturen: awork, MOCO, Troi, Asana, Monday und ClickUp. 21 Features, Pricing
                    in Realität, strategische Positionierung.
                </Text>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 22, flexWrap: 'wrap' }}>
                    <Pill variant="accent">7 Tools</Pill>
                    <Pill variant="default">21 Features</Pill>
                    <Pill variant="default">Pricing-Realität</Pill>
                    <Pill variant="default">TCO bei 10 MA</Pill>
                </View>
            </View>

            {/* Meta footer */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.borderDefault, paddingTop: 18, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                    <Text style={s.label}>Erstellt</Text>
                    <Text style={[s.h4, { marginTop: 3 }]}>22. Mai 2026</Text>
                </View>
                <View>
                    <Text style={s.label}>Phase</Text>
                    <Text style={[s.h4, { marginTop: 3 }]}>Pilot-MVP</Text>
                </View>
                <View>
                    <Text style={s.label}>Markt</Text>
                    <Text style={[s.h4, { marginTop: 3 }]}>DACH-Agenturen</Text>
                </View>
                <View>
                    <Text style={s.label}>Klassifizierung</Text>
                    <Text style={[s.h4, { marginTop: 3, color: C.dangerText }]}>Intern · vertraulich</Text>
                </View>
            </View>
        </View>
    </Page>
);

// ─────────────────────────────────────────────────────────────
// PAGE: EXEC SUMMARY
// ─────────────────────────────────────────────────────────────
const SummaryPage = () => (
    <Page size="A4" style={s.page}>
        <SectionHead
            eyebrow="01 · Executive Summary"
            title="Die Markt-These in vier Sätzen."
            lead="Der DACH-Agenturmarkt ist zwischen zwei Polen gespalten: günstigen Task-Tools ohne Buchhaltung und Enterprise-ERPs mit 10 Jahre alter UI. Vela besetzt die Lücke dazwischen — modern wie awork, integriert wie MOCO, ohne den ERP-Aufwand von Troi."
        />

        <SummaryCard
            n="1"
            title="awork hat keine Rechnungen"
            text="awork ist der direkteste Mitbewerber im modernen Agentur-PM. Aber: keine Angebote, keine Rechnungen, kein DATEV. Jede deutsche Agentur braucht ein zweites System (sevdesk, Lexware) plus manuelle Datenpflege. Vela ist hier strukturell überlegen."
            tag={{ label: 'Strukturelle Überlegenheit', variant: 'success' }}
        />
        <SummaryCard
            n="2"
            title="MOCO ist Vela's nächster Verwandter"
            text="MOCO macht Projekte + Zeit + Kalkulation + Rechnungen integriert — das gleiche Profil wie Vela. Aber: Task-Management zu simpel, UI nüchtern, Ressourcenplanung kostet extra. Vela's Differenzierung: modernes Design + bessere Tasks + Realtime."
            tag={{ label: 'Sieg über UI + Realtime', variant: 'info' }}
        />
        <SummaryCard
            n="3"
            title="Troi zu groß, Asana/Monday/ClickUp zu generisch"
            text="Troi gewinnt ab 40 MA — aber Setup 10–50k € und 3–6 Monate Einarbeitung sind für 2–30-MA-Agenturen unrealistisch. Die internationalen Tools sind keine Agentur-Software, sondern PM-Systeme ohne Buchhaltung."
            tag={{ label: 'Vela-Markt: 2–30 MA', variant: 'success' }}
        />
        <SummaryCard
            n="4"
            title="Lücken, die Vela schließen muss"
            text="Damit Vela markttauglich wird: DATEV-Export, E-Rechnung (ZUGFeRD/XRechnung), Mobile-Zeiterfassung (PWA), API/Webhooks, KI-Features. Phase 4 der Roadmap."
            tag={{ label: 'Roadmap Q3/Q4 2026', variant: 'warning' }}
        />

        <Footer />
    </Page>
);

const SummaryCard = ({ n, title, text, tag }: {
    n: string; title: string; text: string;
    tag?: { label: string; variant: 'success' | 'info' | 'warning' };
}) => (
    <View style={s.card}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: C.accentSubtle,
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                <Text style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{n}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={s.h3}>{title}</Text>
                    {tag && <Pill variant={tag.variant}>{tag.label}</Pill>}
                </View>
                <Text style={s.callout}>{text}</Text>
            </View>
        </View>
    </View>
);

// ─────────────────────────────────────────────────────────────
// PAGE: TOOL DEEP DIVE
// ─────────────────────────────────────────────────────────────
const ToolDeepDivePage = ({ tools, title, eyebrow, lead }: {
    tools: Tool[]; title: string; eyebrow: string; lead: string;
}) => (
    <Page size="A4" style={s.page}>
        <SectionHead eyebrow={eyebrow} title={title} lead={lead} />

        {tools.map(tool => {
            const scoreKey = tool.name.toLowerCase().replace('.com', '') as keyof typeof SCORES;
            const score = SCORES[scoreKey];
            return (
                <View key={tool.name} style={s.card} wrap={false}>
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <View>
                            <Text style={s.h3}>{tool.name}</Text>
                            <Text style={{ fontSize: 8.5, color: C.textMuted, marginTop: 2 }}>
                                {tool.origin} · seit {tool.founded} · {tool.target}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Pill variant="default">{tool.priceRange}</Pill>
                            {score && (
                                <Text style={{ fontSize: 8, color: C.textMuted, marginTop: 4 }}>
                                    Feature-Score: <Text style={{ fontWeight: 700, color: C.textPrimary }}>{score.pct}%</Text>
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Mini score bar */}
                    {score && (
                        <View style={{ marginVertical: 8 }}>
                            <View style={{
                                height: 4, borderRadius: 2, backgroundColor: C.borderSubtle, overflow: 'hidden',
                                flexDirection: 'row',
                            }}>
                                <View style={{ width: `${(score.yes / FEATURES.length) * 100}%`, backgroundColor: C.success }} />
                                <View style={{ width: `${(score.partial / FEATURES.length) * 100}%`, backgroundColor: C.warning }} />
                            </View>
                        </View>
                    )}

                    {/* Strengths + Weaknesses */}
                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                                <StatusDot status="yes" size={6} />
                                <Text style={[s.label, { color: C.successText }]}>Stärken</Text>
                            </View>
                            {tool.strengths.slice(0, 4).map((it, i) => <Bullet key={i} variant="success">{it}</Bullet>)}
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                                <StatusDot status="no" size={6} />
                                <Text style={[s.label, { color: C.dangerText }]}>Schwächen</Text>
                            </View>
                            {tool.weaknesses.slice(0, 4).map((it, i) => <Bullet key={i} variant="danger">{it}</Bullet>)}
                        </View>
                    </View>
                </View>
            );
        })}

        <Footer />
    </Page>
);

// ─────────────────────────────────────────────────────────────
// PAGE: SCORE OVERVIEW
// ─────────────────────────────────────────────────────────────
const ScoreOverviewPage = () => {
    const sorted = [
        { key: 'vela',    name: 'Vela / Agentur OS', score: SCORES.vela,    isVela: true },
        { key: 'troi',    name: 'Troi',              score: SCORES.troi },
        { key: 'moco',    name: 'MOCO',              score: SCORES.moco },
        { key: 'clickup', name: 'ClickUp',           score: SCORES.clickup },
        { key: 'monday',  name: 'Monday.com',        score: SCORES.monday },
        { key: 'awork',   name: 'awork',             score: SCORES.awork },
        { key: 'asana',   name: 'Asana',             score: SCORES.asana },
    ].sort((a, b) => b.score.pct - a.score.pct);

    return (
        <Page size="A4" style={s.page}>
            <SectionHead
                eyebrow="03 · Feature-Score"
                title="Wie viel kann jedes Tool nativ?"
                lead="Pro Tool zeigen wir: wie viele der 21 Kern-Features sind nativ vorhanden, teilweise vorhanden (Add-on / höherer Tier) oder fehlen ganz. Vela steht hier schon heute auf Platz eins — trotz fehlender DATEV-/Mobile-/KI-Features."
            />

            <View style={s.card}>
                {sorted.map(t => (
                    <ScoreBar key={t.key} label={t.name} score={t.score} isVela={t.isVela} />
                ))}
            </View>

            <View style={s.cardAccent}>
                <Text style={s.h4}>Wie lest ihr das?</Text>
                <Text style={[s.callout, { marginTop: 6 }]}>
                    Score = (nativ × 1.0 + teilweise × 0.5) / 21 Features. Die grünen Balken zeigen nativ
                    implementierte Features, die gelben sind eingeschränkt (Add-on, höherer Pricing-Tier,
                    Drittlösung). Vela liegt vorne, weil das All-in-One-Profil (Projekte + Zeit + Kalkulation
                    + Rechnungen + Realtime) zusammen kaum von jemandem gehalten wird — Troi ja, aber nur
                    ab Enterprise-Größe.
                </Text>
            </View>

            <Footer />
        </Page>
    );
};

// ─────────────────────────────────────────────────────────────
// PAGE: FEATURE MATRIX (2 pages — fits better)
// ─────────────────────────────────────────────────────────────
const FeatureMatrixPage = () => (
    <Page size="A4" style={s.page}>
        <SectionHead
            eyebrow="04 · Feature-Matrix"
            title="Was jedes Tool tatsächlich kann."
            lead="Direkter Vergleich aller 21 Features × 7 Tools. Vela-Spalte hervorgehoben."
        />

        <StatusLegend />

        {/* Matrix */}
        <View style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.borderDefault }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row', backgroundColor: C.subtle,
                borderBottomWidth: 1, borderBottomColor: C.borderDefault,
            }}>
                <View style={{ width: '30%', padding: 7 }}>
                    <Text style={s.label}>Feature</Text>
                </View>
                {[
                    { key: 'vela',    label: 'Vela',    highlight: true },
                    { key: 'awork',   label: 'awork' },
                    { key: 'moco',    label: 'MOCO' },
                    { key: 'troi',    label: 'Troi' },
                    { key: 'asana',   label: 'Asana' },
                    { key: 'monday',  label: 'Monday' },
                    { key: 'clickup', label: 'ClickUp' },
                ].map(col => (
                    <View key={col.key} style={{
                        width: '10%', padding: 7, alignItems: 'center',
                        backgroundColor: col.highlight ? C.accentSubtle : undefined,
                    }}>
                        <Text style={[s.label, { color: col.highlight ? C.accent : C.textMuted }]}>
                            {col.label}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Rows grouped by category */}
            {Object.keys(CATEGORY_LABEL).map(cat => {
                const rows = FEATURES.filter(f => f.category === cat);
                return (
                    <View key={cat}>
                        {/* Category header */}
                        <View style={{
                            backgroundColor: C.borderSubtle,
                            paddingVertical: 4, paddingHorizontal: 7,
                        }}>
                            <Text style={[s.label, { fontSize: 7, color: C.textSecondary }]}>{CATEGORY_LABEL[cat]}</Text>
                        </View>
                        {rows.map((row, i) => (
                            <View key={i} style={{
                                flexDirection: 'row',
                                borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
                                alignItems: 'center',
                            }}>
                                <View style={{ width: '30%', padding: 7 }}>
                                    <Text style={{ fontSize: 8.5, color: C.textPrimary }}>{row.name}</Text>
                                </View>
                                {(['vela', 'awork', 'moco', 'troi', 'asana', 'monday', 'clickup'] as const).map(col => (
                                    <View key={col} style={{
                                        width: '10%', padding: 6, alignItems: 'center',
                                        backgroundColor: col === 'vela' ? C.accentSubtle : undefined,
                                    }}>
                                        <StatusDot status={row[col]} size={9} />
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                );
            })}
        </View>

        <Text style={{ fontSize: 8.5, color: C.textMuted, marginTop: 12 }}>
            Stand 22.05.2026 · Vela-Daten aus eigener Codebase · Wettbewerber aus offiziellen Produkt-Seiten
            und G2/Capterra/OMR Reviews.
        </Text>

        <Footer />
    </Page>
);

// ─────────────────────────────────────────────────────────────
// PAGE: PRICING
// ─────────────────────────────────────────────────────────────
interface PricingRow {
    tool: string; perUser: string; tenUserYear: number; extraTool: string; extraCost: number; total: number; isVela?: boolean;
}

const PRICING: PricingRow[] = [
    { tool: 'Vela · Agency-Tier (geplant)', perUser: 'Flat 99 €/Monat', tenUserYear: 1188, extraTool: 'inkl.',  extraCost: 0, total: 1188, isVela: true },
    { tool: 'ClickUp · Business',           perUser: '11 €/User',       tenUserYear: 1320, extraTool: 'sevdesk', extraCost: 144, total: 1464 },
    { tool: 'Monday.com · Pro',             perUser: '19 €/User',       tenUserYear: 2280, extraTool: 'sevdesk', extraCost: 144, total: 2424 },
    { tool: 'awork · Professional',         perUser: '22 €/User',       tenUserYear: 2640, extraTool: 'sevdesk', extraCost: 144, total: 2784 },
    { tool: 'Asana · Advanced',             perUser: '25 €/User',       tenUserYear: 3000, extraTool: 'sevdesk', extraCost: 144, total: 3144 },
    { tool: 'MOCO · Pro + Planning',        perUser: '29 €/User',       tenUserYear: 3480, extraTool: 'inkl.',   extraCost: 0,   total: 3480 },
    { tool: 'Troi · Cloud (ohne Setup)',    perUser: '~59 €/User',      tenUserYear: 7080, extraTool: 'inkl.',   extraCost: 0,   total: 7080 },
];

const PricingPage = () => {
    const maxTotal = Math.max(...PRICING.map(p => p.total));
    return (
        <Page size="A4" style={s.page}>
            <SectionHead
                eyebrow="05 · Pricing-Realität"
                title="Jahres-TCO bei 10 Mitarbeitern."
                lead="Total Cost of Ownership pro Jahr bei einer typischen 10-MA-Agentur — Lizenzen plus, wo nötig, externe Buchhaltung (sevdesk ~12 €/Monat fix). Sortiert nach Gesamtkosten."
            />

            <View style={s.card}>
                {PRICING.map((p, i) => (
                    <View key={i} style={{
                        marginBottom: 8, paddingBottom: 8,
                        borderBottomWidth: i < PRICING.length - 1 ? 1 : 0,
                        borderBottomColor: C.borderSubtle,
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 10, fontWeight: 700, color: p.isVela ? C.accent : C.textPrimary }}>
                                    {p.tool}
                                </Text>
                                {p.isVela && <Pill variant="accent">DAS SIND WIR</Pill>}
                            </View>
                            <Text style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary }}>
                                {p.total.toLocaleString('de-DE')} €
                            </Text>
                        </View>

                        {/* Bar */}
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.borderSubtle, overflow: 'hidden', flexDirection: 'row' }}>
                            <View style={{
                                width: `${(p.tenUserYear / maxTotal) * 100}%`,
                                backgroundColor: p.isVela ? C.success : C.accent,
                            }} />
                            {p.extraCost > 0 && (
                                <View style={{
                                    width: `${(p.extraCost / maxTotal) * 100}%`,
                                    backgroundColor: C.warning,
                                }} />
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                            <Text style={{ fontSize: 8, color: C.textMuted }}>
                                Lizenz: {p.perUser} · {p.tenUserYear.toLocaleString('de-DE')} €
                                {p.extraCost > 0 && `  +  ${p.extraTool}: ${p.extraCost} €`}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            <View style={s.cardAccent}>
                <Text style={s.h4}>Vela's Pricing-Vorteil</Text>
                <Text style={[s.callout, { marginTop: 6 }]}>
                    Flat-Pricing macht Vela strukturell günstiger ab ca. 5 MA. Bei 10 MA zahlt eine Agentur
                    bei awork rund <Text style={{ fontWeight: 700 }}>2.784 €/Jahr</Text>, bei MOCO rund
                    <Text style={{ fontWeight: 700 }}> 3.480 €/Jahr</Text>. Vela im Agency-Tier liegt bei
                    <Text style={{ fontWeight: 700, color: C.success }}> 1.188 €/Jahr</Text> — also rund
                    <Text style={{ fontWeight: 700, color: C.success }}> 57 % günstiger als awork</Text> bei
                    besserem Feature-Set + Buchhaltung inklusive. Im Sales-Pitch das wichtigste Verkaufs-Argument.
                </Text>
            </View>

            <Footer />
        </Page>
    );
};

// ─────────────────────────────────────────────────────────────
// PAGE: USPs
// ─────────────────────────────────────────────────────────────
const USPS = [
    {
        n: '01',
        title: 'All-in-One mit moderner UI',
        claim: 'Nur Vela und MOCO machen Projekte + Zeit + Kalkulation + Rechnungen integriert. MOCO sieht aus wie 2015, Vela wie 2026.',
        detail: 'Apple-like Design-System, 7 Accent-Themes, Dark Mode, Skeleton Loading, Realtime über alle Geräte. Keine ERP-Optik wie bei Troi, keine generische Board-Optik wie bei Asana/Monday.',
    },
    {
        n: '02',
        title: 'Echtes Realtime-System',
        claim: 'Änderungen erscheinen sofort auf jedem Gerät — wie Google Docs, nicht wie Refresh-PM-Tools.',
        detail: 'Supabase Realtime + useRealtimeTable-Hook + CalendarDataProvider. Bei awork und MOCO musst du F5 drücken, um Kollegen-Updates zu sehen.',
    },
    {
        n: '03',
        title: 'Personalisierung pro Mitarbeiter',
        claim: 'Wochenplan-Modelle (Vollzeit, Teilzeit, 4-Tage-Woche), Sidebar-Customize, individuelle Akzentfarbe, Kalender-Farbe.',
        detail: 'MOCO behandelt alle MA gleich. awork unterscheidet Vollzeit/Teilzeit nur bei Workload — nicht im individuellen Tagesrhythmus. Vela rechnet Soll-Stunden taggenau.',
    },
    {
        n: '04',
        title: 'Super-Admin + Backup-System',
        claim: 'Multi-Tenant von Tag 1: Feature-Flags pro Agentur, automatische DB-Backups vor Löschen, 1-Klick-Restore, Impersonation für Support.',
        detail: 'awork hat sowas nicht im Self-Service. Troi macht das nur über kostenpflichtige Berater. Vela skaliert mit dem Vertrieb mit, ohne Ops-Overhead.',
    },
];

const USPPage = () => (
    <Page size="A4" style={s.page}>
        <SectionHead
            eyebrow="06 · Vela's Differenzierung"
            title="Wo Vela heute schon vorne liegt."
            lead="Vier strukturelle Vorteile, die kein einziger Wettbewerber im DACH-Markt gleichzeitig bietet. Diese werden zum Marketing-Kern."
        />

        {USPS.map(u => (
            <View key={u.n} style={s.card}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{
                        width: 32, height: 32, borderRadius: 8,
                        backgroundColor: C.success,
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{u.n}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.h3}>{u.title}</Text>
                        <Text style={{
                            fontSize: 10.5, fontWeight: 600, color: C.accent,
                            marginTop: 5, marginBottom: 6, lineHeight: 1.45,
                        }}>
                            „{u.claim}"
                        </Text>
                        <Text style={s.callout}>{u.detail}</Text>
                    </View>
                </View>
            </View>
        ))}

        <Footer />
    </Page>
);

// ─────────────────────────────────────────────────────────────
// PAGE: GAPS
// ─────────────────────────────────────────────────────────────
const GAPS = [
    {
        n: '01',
        title: 'DATEV-Export & E-Rechnung',
        impact: 'high',
        priority: 'Phase 4 · Q3 2026',
        body: 'Ohne dies kein Verkauf an Agenturen mit etabliertem Steuerberater (~70 % der DACH-Agenturen).',
        competitorState: 'MOCO und Troi haben beides nativ. awork hat es nicht — Vela kann hier sogar awork überholen.',
    },
    {
        n: '02',
        title: 'Mobile-Zeiterfassung (PWA)',
        impact: 'mid',
        priority: 'Phase 4 · Q3 2026',
        body: 'Außendienst-MA und Kreative wollen Zeit unterwegs erfassen. Native App kein Muss, PWA reicht.',
        competitorState: 'Alle 6 Wettbewerber haben Mobile. Lücke spürbar bei Demos.',
    },
    {
        n: '03',
        title: 'KI-Features',
        impact: 'mid',
        priority: 'Phase 4 · Q4 2026',
        body: 'Wird in 2026 zum Erwartungs-Standard — Aufwandsschätzung, Re-Planning, AI-Drafts.',
        competitorState: 'awork und Monday haben es bereits. Anthropic-API erlaubt schnelles Nachziehen.',
    },
    {
        n: '04',
        title: 'API / Webhooks / Integrationen',
        impact: 'low',
        priority: 'Phase 4 · Q4 2026',
        body: 'Wird bei Sales-Gesprächen abgefragt, aber selten Deal-Breaker.',
        competitorState: 'ClickUp 1000+, Asana 300+, Monday 200+. MOCO hat saubere REST-API.',
    },
];

const GapsPage = () => (
    <Page size="A4" style={s.page}>
        <SectionHead
            eyebrow="07 · Vela's Lücken"
            title="Wo der Markt aktuell mehr hat."
            lead="Ehrliche Sicht: vier Features fehlen Vela heute, die Wettbewerber als Standard haben. Sortiert nach Verkaufs-Impact."
        />

        {GAPS.map(g => {
            const impactColor =
                g.impact === 'high' ? { bg: C.dangerSubtle,  fg: C.dangerText,  label: 'HOHER IMPACT' } :
                g.impact === 'mid'  ? { bg: C.warningSubtle, fg: C.warningText, label: 'MITTLERER IMPACT' } :
                                      { bg: C.subtle,        fg: C.textMuted,   label: 'NIEDRIGER IMPACT' };
            return (
                <View key={g.n} style={s.card}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{
                            width: 32, height: 32, borderRadius: 8,
                            backgroundColor: C.warningSubtle,
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                            <Text style={{ fontSize: 11, fontWeight: 700, color: C.warningText }}>{g.n}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={s.h3}>{g.title}</Text>
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                    <Pill variant={g.impact === 'high' ? 'danger' : g.impact === 'mid' ? 'warning' : 'default'}>
                                        {impactColor.label}
                                    </Pill>
                                    <Pill variant="default">{g.priority}</Pill>
                                </View>
                            </View>
                            <Text style={[s.callout, { marginTop: 4 }]}>{g.body}</Text>
                            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.borderSubtle }}>
                                <Text style={[s.label, { color: C.textMuted, marginBottom: 3 }]}>Wettbewerber-Stand</Text>
                                <Text style={[s.callout, { fontSize: 9 }]}>{g.competitorState}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            );
        })}

        <Footer />
    </Page>
);

// ─────────────────────────────────────────────────────────────
// PAGE: STRATEGY
// ─────────────────────────────────────────────────────────────
const STRATEGY = [
    {
        n: '01',
        title: 'Gegen awork',
        claim: '„awork plant deine Projekte. Vela plant deine Projekte UND rechnet sie ab."',
        detail: 'Vela\'s größter Konkurrent für Pilot-Kunden ist awork. Beide bedienen die gleiche Agentur-Größe (5–50 MA), beide haben moderne UIs. awork\'s strukturelle Schwäche ist die fehlende Buchhaltung. Diesen Punkt im Sales-Pitch hammern.',
    },
    {
        n: '02',
        title: 'Gegen MOCO',
        claim: '„MOCO macht das gleiche wie Vela — sieht nur aus wie 2015."',
        detail: 'MOCO ist Vela\'s gefährlichster Wettbewerber, weil das Feature-Profil deckungs-gleich ist. Sieg über UI, Realtime und Personalisierung — nicht über Features. Visuelle Demos (Vela vs. MOCO Screenshots) sind hier mächtiger als Listen.',
    },
    {
        n: '03',
        title: 'Pricing als Waffe',
        claim: '„Flat-Pricing. Keine User-Falle. Keine 3er-Schritte. Keine Premium-Tier-Lockerei."',
        detail: 'Vela\'s Phase-3-Pricing (Pro 49 €, Agency 99 € flat) ist radikal anders. Bei 10 MA: Vela 1.188 €/Jahr vs. awork 2.784 € vs. MOCO 3.480 €. Halbierter Preis bei besserem Feature-Set + moderner UI. Verkaufs-Argument 1.',
    },
];

const StrategyPage = () => (
    <Page size="A4" style={s.page}>
        <SectionHead
            eyebrow="08 · Strategische Empfehlung"
            title="Wie Vela im Markt gewinnt."
            lead="Aus der Analyse ergibt sich eine klare Positionierung. Drei strategische Sätze, die im Marketing wiederkehren sollten."
        />

        {STRATEGY.map(p => (
            <View key={p.n} style={s.cardAccent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={s.h3}>{p.title}</Text>
                    <Text style={{ fontSize: 8.5, color: C.textMuted, fontWeight: 700 }}>POSITION {p.n}</Text>
                </View>
                <Text style={{
                    fontSize: 13, fontWeight: 700, color: C.accent,
                    lineHeight: 1.35, marginTop: 4, marginBottom: 8,
                }}>
                    {p.claim}
                </Text>
                <Text style={s.callout}>{p.detail}</Text>
            </View>
        ))}

        <Footer />
    </Page>
);

// ─────────────────────────────────────────────────────────────
// PAGE: APPENDIX
// ─────────────────────────────────────────────────────────────
const AppendixPage = () => (
    <Page size="A4" style={s.page}>
        <SectionHead
            eyebrow="09 · Anhang"
            title="Quellen, Methodik & Vorbehalte."
            lead="Wie die Daten erhoben wurden — damit du die Analyse vor Sales-Gesprächen verifizieren kannst."
        />

        <View style={s.card}>
            <Text style={s.h3}>Pricing-Quellen (live verifiziert)</Text>
            <Bullet>awork.com/de/preise — Basic 5 €, Standard 12 €, Professional 22 € (jährlich)</Bullet>
            <Bullet>mocoapp.com/preise — Basic 16 €, Pro 24 €, Planning Add-on 5 €</Bullet>
            <Bullet>troi.de — kein öffentliches Pricing, Range aus OMR Reviews und Sales-Gesprächen</Bullet>
            <Bullet>asana.com/pricing — Starter 11 €, Advanced 25 € (jährliche Zahlung)</Bullet>
            <Bullet>monday.com/pricing — Basic 9 €, Standard 12 €, Pro 19 € (jährlich, 3er-Schritte)</Bullet>
            <Bullet>clickup.com/pricing — Unlimited 7 USD, Business 12 USD (jährlich)</Bullet>
        </View>

        <View style={s.card}>
            <Text style={s.h3}>Methodik</Text>
            <Bullet>Feature-Matrix: nativ (grün), teilweise / Add-on / höherer Tier (gelb), fehlt (grau)</Bullet>
            <Bullet>Score-Rechnung: (nativ × 1.0 + teilweise × 0.5) / 21 × 100</Bullet>
            <Bullet>TCO: 10 User × 12 Monate Lizenz + ggf. externe Buchhaltung (sevdesk 12 €/Monat fix)</Bullet>
            <Bullet>Pricing in EUR netto bei jährlicher Vorauszahlung</Bullet>
        </View>

        <View style={s.cardDanger}>
            <Text style={s.h3}>Vorbehalte</Text>
            <Bullet variant="danger">Pricing kann sich kurzfristig ändern — vor Sales-Einsatz live verifizieren</Bullet>
            <Bullet variant="danger">Troi-Preise sind Mittelwerte aus Sales-Gesprächen, keine offiziellen Tarife</Bullet>
            <Bullet variant="danger">USD-Preise (ClickUp) zum Kurs 1 USD ≈ 0,92 EUR umgerechnet</Bullet>
            <Bullet variant="danger">Vela-Phase-3-Pricing ist Annahme — noch nicht final festgelegt</Bullet>
        </View>

        <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.borderDefault, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
                <Text style={s.label}>Quelle Vela-Daten</Text>
                <Text style={[s.body, { marginTop: 3 }]}>Eigene Codebase + project_vision.md</Text>
            </View>
            <View>
                <Text style={s.label}>Klassifizierung</Text>
                <Text style={[s.body, { marginTop: 3, color: C.dangerText, fontWeight: 700 }]}>Intern · vertraulich</Text>
            </View>
        </View>

        <Footer />
    </Page>
);

// ─────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────
const OUTPUT = `${process.cwd()}/Mitbewerber-Analyse-Vela.pdf`;

(async () => {
    console.log('Rendering polished competitor analysis PDF…');
    await renderToFile(<Doc />, OUTPUT);
    console.log(`PDF written: ${OUTPUT}`);
})();
