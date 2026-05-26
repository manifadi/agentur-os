# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Vela / Agentur OS** — Multi-Tenant SaaS für deutschsprachige Kreativagenturen. Projekte, Zeiterfassung, Ressourcenplanung, Kalkulation, Angebote/Rechnungen, Kalender — alles in einem Tool. UI-Sprache durchgehend Deutsch. Apple-like Design-Anspruch ist explizites Produkt-Ziel (siehe `PRODUCT_VISION.md`), nicht beiläufig.

## Commands

```bash
npm run dev          # Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # next lint
npm run start        # Production server

npx tsc --noEmit     # Type-check — WICHTIG: muss manuell laufen!
```

**`next.config.js` setzt `typescript.ignoreBuildErrors: true` und `eslint.ignoreDuringBuilds: true`.** Der Build geht durch trotz Type-Errors. Vor jedem Commit `npx tsc --noEmit` ausführen — sonst landen Fehler unbemerkt im main.

## Architecture

### Stack
Next.js 13 App Router + TypeScript + Tailwind CSS + Supabase (PostgreSQL + RLS + Realtime). Deployed on Vercel.

### Multi-Tenancy ist das Fundament
- Jede Tabelle mit Tenant-Daten hat eine `organization_id`-Spalte
- RLS-Policy auf jeder Tabelle: `USING (organization_id = get_my_organization_id())`
- Helper-RPC `get_my_organization_id()` liest aus `employees.user_id = auth.uid()` — **plus** respektiert eine aktive Impersonation-Session (Super-Admin-Feature)
- Damit greift Tenant-Isolation transparent für alle Queries — Frontend muss nichts filtern

**Konsequenz für neue Tabellen:** Immer `organization_id UUID` + entsprechende RLS-Policy mitliefern. Migrations-Datei in `supabase/` ablegen.

### State + Realtime Pattern
Daten leben in zwei zentralen Contexts:
- `AppContext.tsx` — Projekte, Kunden, Mitarbeiter, Allokationen, agencySettings, Time-Entries
- `CalendarDataContext.tsx` — Kalender-Events + externe Kalender

Beide werden in `ClientAppShell.tsx` initialisiert und via Supabase Realtime-Channels live aktuell gehalten (`shell:<table>:<orgId>`). Per-Table-Refetcher statt "any change → refetch everything".

Für eigene live Tabellen-States in einzelnen Seiten existiert der Hook `app/hooks/useRealtimeTable.ts` — INSERT/UPDATE/DELETE werden inkrementell appliziert. Im `/admin`-Bereich gibt es zusätzlich `SuperAdminContext` mit eigenen Realtime-Subscriptions.

### Supabase-Migrationen sind MANUELL
SQL-Dateien in `supabase/` müssen **eigenhändig im Supabase SQL Editor ausgeführt werden** — kein automatisches Migration-Tool. Alle Migrationen sind idempotent (`CREATE OR REPLACE`, `DROP IF EXISTS`, `IF NOT EXISTS`). Bei neuen RPCs / Tabellen am Ende `NOTIFY pgrst, 'reload schema';` einfügen, sonst sieht PostgREST sie nicht.

**Falle:** `CREATE OR REPLACE FUNCTION` übernimmt die `VOLATILE`/`STABLE`-Eigenschaft der bestehenden Funktion, wenn nicht explizit gesetzt. Wenn du Volatility ändern willst → erst `DROP`, dann neu erstellen. Andernfalls passieren Fehler wie "cannot execute INSERT in a read-only transaction" wenn eine STABLE-Funktion intern via `PERFORM` ins Audit-Log schreibt.

### Design-System (Single Source of Truth: `app/globals.css`)
~115 CSS-Variablen für Farben/Spacing/Schatten + 11 Accent-Themes + Dark Mode. Schriftart: **Vela Sans** (self-hosted in `public/fonts/vela-sans/`).

Wiederverwendbare Klassen in `globals.css`:
- `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-danger`
- `.input-field` — wichtig: nutzt `bg-subtle` (leicht dunkler), fokussiert wechselt auf `bg-surface`
- `.card` / `.card-header` / `.card-header-icon` / `.card-body` / `.card-footer`
- `.badge` + `.badge-success/.badge-warning/.badge-danger/.badge-info/.badge-accent`
- `.segmented-control` / `.segmented-control-item` — Basis für ViewSwitcher
- `.ds-display` (26px) / `.ds-title` (17px) / `.ds-body` (14px) / `.ds-callout` (13px) / `.ds-caption` (11px uppercase)
- `.list-item` / `.empty-state` / `.status-dot`

**Regel:** Neue UI nutzt diese Tokens/Klassen — kein Hex direkt, kein `bg-gray-900` hardcoded. Status-Farben über `var(--color-success/warning/danger/info)` + `-subtle`/`-text`/`-border` Suffixe.

### Zentrale UI-Komponenten (gerade refactored)
- `app/components/UI/ViewSwitcher.tsx` — einheitlicher Mode-Toggle (Tag/Woche/Monat, Karten/Tabelle, Scope etc.). Generic Type-Parameter.
- `app/components/UI/PeriodNavigator.tsx` — Pill mit `[<] Center-Label [>]` für alle Datums-Navigationen (Kalender, Reporting, Ressourcenplan, Zeiterfassung).
- `app/components/Modals/ConfirmModal.tsx` + `PromptModal.tsx` — Ersatz für `window.confirm()` / `window.prompt()`. **Native Browser-Dialoge sind im gesamten Projekt verboten** — `alert()` → `toast.error/success` (sonner ist installiert).

### Routen-Struktur
App Router unter `app/`. Wichtigste Routen:
- `/dashboard` — Mein Bereich (Widget-Grid via react-grid-layout)
- `/uebersicht` — Projekte-Liste
- `/aufgaben` — Globale Aufgaben-Ansicht
- `/ressourcen` — Ressourcenplan (Karten + Tabelle)
- `/zeiterfassung` — Stunden erfassen
- `/kalender` — Kalender (Tag/Woche/Monat + iCal/Google/Outlook/CalDAV-Sync)
- `/reporting` — Mitarbeiter-Reporting (Solo + Team)
- `/clients/[id]` — Kunden-Cockpit mit 6 Tabs
- `/einstellungen` — Profil + Agentur-Settings + Branding + Templates
- `/admin/*` — **Super-Admin-Panel** (separater Layout-Tree, eigene Sidebar, eigener `SuperAdminContext`)

Der Super-Admin-Bereich ist via dediziertem `employees.is_super_admin`-Flag gate'd — **nicht** via `role === 'admin'` (das ist die Agentur-interne Rolle).

### Server-Side Code
`app/api/` — Next.js Route Handlers:
- `auth/` — OAuth-Callbacks für Google/Microsoft Kalender
- `google-calendar/`, `microsoft/`, `caldav/`, `ical-proxy/` — bidirektionale Kalender-Sync
- `calendar/` — interner Kalender-CRUD
- `invite/` — Mitarbeiter-Einladungs-Flow

OAuth-Tokens + CalDAV-Passwörter sind mit AES-256-GCM verschlüsselt in der DB — Master-Key in `.env.local` als `CALENDAR_ENCRYPTION_KEY`. Setup-Details in `CALENDAR_SETUP.md`.

### PDF-Generation
`@react-pdf/renderer` v4 ist installiert. Beispiel-Workflow (Mitbewerber-Analyse): `scripts/generate-competitor-pdf.tsx` definiert Document + Komponenten, wird via `npx tsx scripts/generate-competitor-pdf.tsx` ausgeführt, schreibt PDF direkt ins Projekt-Root. Vela Sans WOFF2 + Logo werden eingebunden — Italic-Variante existiert nicht, also kein `fontStyle: 'italic'` verwenden. JSX-Parser-Falle: `>` und `<` in normalen Strings können als Tag-Boundaries fehlinterpretiert werden — "größer als" / "kleiner als" ausschreiben.

## Wichtige Konventionen

- **Sprache**: UI-Texte auf Deutsch, Code/Kommentare gerne deutsch oder englisch
- **Toasts statt Alerts**: `import { toast } from 'sonner'` — `toast.success()` / `toast.error()` / `toast.warning()`
- **ConfirmModal statt confirm()**: State + `<ConfirmModal isOpen ... type="danger" />`
- **DangerZone-Patterns** (Löschen / Suspend / etc.): immer 2-Step-Bestätigung. Für komplexe Fälle (Agentur löschen) eigener Multi-Stage-Dialog mit Name-Tippen
- **`organization_id` immer mitschicken**: bei neuen Inserts in tenant-Tabellen
- **Audit-Log nutzen**: Super-Admin-RPCs schreiben über `log_super_admin_action(action, target_type, target_id, payload)` in `super_admin_audit_log`. Bei neuen Super-Admin-Aktionen einbauen.

## Externe Doks im Repo
- `PRODUCT_VISION.md` — Roadmap-Phasen, Was existiert, GTM-Strategie, bewusst NICHT gebaute Features
- `CALENDAR_SETUP.md` — OAuth-Provider-Setup (Google/Microsoft/CalDAV/iCal), Encryption-Key-Generation
