# Vela — Produkt-Vision & Roadmap

> **Ziel:** Das Betriebssystem moderner Agenturen — Projekte, Stunden, Kalkulation, Todos, Ressourcen, Kalender, Rechnungen und Reporting in einem Tool, Apple-like in Design und Bedienbarkeit, vermarktbar als eigenständige SaaS-Plattform.

Stand: Mai 2026 · Lebendiges Dokument

---

## Die Vision in einem Satz

> **Vela ist das Betriebssystem einer modernen Agentur — alles was Agenturen täglich brauchen in einem Tool, so intuitiv dass keine Einschulung nötig ist.**

---

## Warum dieser Markt eine Lücke hat

| Tool | Stärken | Schwächen |
|---|---|---|
| **Troi** | Zeiterfassung, Billing, Kalkulation | Design aus 2005, komplexe UX, kein modernes Task-Management |
| **Asana** | Task-Management, UI, Boards | Kein Billing, keine Agentur-Logik, zu generisch, teuer |
| **Moco** | Moderner als Troi | Wenig Tiefe bei Tasks & Collaboration |
| **awork** | DACH-fokussiert, Tasks + Zeit | Keine echte Kalkulation, Reporting schwach |
| **Vela** | **Alles davon, schön, intuitiv, DACH-native** | — |

**Der echte Wettbewerbsvorteil ist nicht die Feature-Liste — es ist das Erlebnis.** Eine Software die sich wie ein Apple-Produkt anfühlt und trotzdem Angebote, Stunden, Tasks und Kalender in einem hat, existiert nicht. Das ist der Moat.

---

## Was bereits existiert (Stand Mai 2026)

### Projekt-Management
- [x] Projekt-Verwaltung (CRUD, Duplizieren, Positions-Import aus anderen Projekten)
- [x] Status-System mit Sortierung (Priorisierung → Bearbeitung → Geplant → Warten → Erledigt → Abgebrochen)
- [x] Todo-Listen mit Zuweisung, Drag & Drop, Subtasks
- [x] Projekt-Logbuch mit Multi-Image-Upload
- [x] Dokumente & Links pro Projekt (PDF, Drive, Server-Pfade, Multi-Upload)
- [x] Tab-basiertes Projekt-Detail (Übersicht, Kalkulation, Rechnungen, Dokumente, Logbuch)

### Kunden & CRM
- [x] Kunden-Verwaltung mit Logo-Upload
- [x] Mehrere Ansprechpartner pro Kunde
- [x] **Kunden-Cockpit** mit KPI-Header (Umsatz, offene Rechnungen, Projekte)
- [x] 6 Tabs auf Kunden-Detailseite (Übersicht, Projekte, Finanzen, Aktivität, Dokumente, Team)
- [x] Auto-Aktivitäts-Timeline (Logs + abgeleitete Events)
- [x] Team-Aggregation: wer hat wie viel Zeit pro Kunde geleistet

### Zeiterfassung & Ressourcen
- [x] Tageserfassung mit Projekt- und Positions-Buchung
- [x] Ressourcenplanung (Wochenansicht, Mitarbeiter × Projekt × Tag)
- [x] Allocation-Status (geplant, bestätigt, etc.)

### Kalkulation & Rechnungen
- [x] Positionen mit Stundensatz, Soll-Stunden, Stückpreis
- [x] Externe Positionen (Fremdleistungen)
- [x] Sections für Strukturierung
- [x] Angebots-PDF Generation
- [x] Rechnungs-PDF mit 3 Abrechnungs-Modi (vollständig, Anteil, einzelne Positionen)
- [x] Rechnungs-Status (Entwurf / Final) mit Versionierung
- [x] Rechnungs-Empfänger pro Projekt wählbar

### Kalender (v2) ✅
- [x] Tag-, Wochen-, Monatsansicht
- [x] CalDAV-Integration (Troi, Apple, eigene Server) — bidirektional
- [x] Google Calendar (OAuth) — bidirektional (POST/PATCH/DELETE)
- [x] iCal-Feed Import (read-only)
- [x] Sichtbarkeits-Steuerung pro Kalender
- [x] Color-Picker pro Kalender (14er-Palette)
- [x] Sidebar-State persistent (localStorage)
- [x] Live-Update via Supabase Realtime (`useRealtimeTable` + `CalendarDataProvider`)
- [x] Meeting-URL Auto-Detect (8 Provider: Teams, Meet, Zoom, Webex, Whereby, Jitsi, GoToMeeting, BlueJeans)
- [x] EventDetailModal (read-only Click-Detail für externe + Team-Events)
- [x] Re-Auth-Banner bei OAuth-401
- [x] Encryption für OAuth-Tokens + CalDAV-Passwörter (AES-256-GCM)
- [ ] Microsoft Outlook (OAuth) — Code fertig, Azure-App-Registrierung steht aus
- [ ] Conflict-Resolution (extern + Vela gleichzeitig editiert)
- [ ] Recurring Events (RRULE)
- [ ] Webhooks statt Polling (Latenz < 3 min)
- [ ] Timezone aus `agency_settings` statt hartcodiert

### Multi-Tenant SaaS
- [x] Supabase RLS (Row-Level Security) auf allen Tabellen
- [x] Selbst-Registrierung neuer Agenturen
- [x] Onboarding-Flow (Org anlegen, Logo, ersten User einladen)
- [x] Einladungs-System (Token, E-Mail-Versand, Org-Zuordnung)
- [x] Agentur-Einstellungen (Firmenadresse, Logo, Dokument-Header)
- [x] User-Rollen (admin / user)
- [x] Super-Admin Panel (Orgs verwalten)

### Dashboard & Navigation
- [x] Anpassbares Dashboard (Drag/Drop/Resize, Widget-Galerie)
- [x] Widgets: Zugewiesene Todos, Private Todos, Deadlines, Zeiterfassung, Ressourcen-Wochenplan, Favoriten
- [x] Einheitliches Click-Pattern: Task-Klick öffnet Sidebar, Hover zeigt "Zum Projekt"
- [x] Klickbare Deadlines (Sprung zum Projekt)
- [x] Globale Suche (Cmd+K) mit Kunden, Projekten, Tasks, Logs
- [x] Kontext-Sidebar mit Kunden-Liste
- [x] Persistente Filter in Projektübersicht
- [x] Skeleton Loading States

### Design-System
- [x] Vela-Branding (Logo, Favicon, dynamische Browser-Tab-Titel)
- [x] Dark Mode mit 7 Accent-Themes
- [x] Typography Scale (`.ds-display`, `.ds-title`, `.ds-body`, `.ds-callout`, `.ds-caption`)
- [x] Button-Hierarchie (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`)
- [x] Token-System (`text-text-primary`, `bg-accent`, `border-default`)
- [x] Konsistentes Filter-Panel mit Custom-Dropdown
- [x] Toast-Benachrichtigungen, ConfirmModals statt nativer alerts
- [x] Hover-reveal Aktionen in Listen

### Reporting (Phase 1)
- [x] Projekt-Reporting (Budget vs. Ist, Stunden, Verteilung)
- [x] Kunden-Reporting (Umsatz, Team-Beteiligung, Aktivität)

---

## Positionierung & Differenzierung

### Zielgruppe (Primär)
- **Deutschsprachige Kreativ-Agenturen** (Webdesign, Marketing, Branding, PR, Werbeagenturen)
- Teamgröße: 2–30 Mitarbeiter
- Aktuell: Nutzen 2–5 verschiedene Tools (Troi + Asana + Google Sheets + Drive + Outlook)
- Schmerzpunkt: Keine einheitliche Sicht auf Projekte, Stunden, Rentabilität und Kunden-Aktivität

### Was Vela einzigartig macht
1. **Agentur-native Kalkulation** — Positionen, Stunden-Budget, Soll/Ist direkt am Projekt
2. **Ein Tool, keine Integrationen** — kein Zapier-Tool-Stack
3. **CRM-Cockpit pro Kunde** — Umsatz, Rechnungen, Aktivität, Team auf einen Blick
4. **Kalender direkt integriert** — keine Tab-Wechsel zu Google/Outlook
5. **Reporting das Sinn macht** — *"Wie profitabel ist dieses Projekt?"* statt 50 sinnlose Widgets
6. **DACH-Markt** — Deutsche UI, EUR-Formatierung, DATEV-Ready (geplant)

### Design-Prinzipien (nie aufgeben)
- **Clarity:** Jede Seite hat einen klaren Fokus. Kein Feature-Overload.
- **Deference:** UI tritt zurück, Inhalt steht vorne.
- **Consistency:** Gleiche Aktion = gleicher Button = gleicher Ort.
- **Zero Onboarding:** Neue User verstehen das Tool in 10 Minuten ohne Anleitung.

---

## Feature-Roadmap

### Phase 1 — Fundament festigen ✅ (größtenteils erledigt)
- [x] Supabase RLS vollständig
- [x] Einladungs-System
- [x] Selbst-Registrierung
- [x] Onboarding-Flow
- [x] Einstellungs-Seite (Firma, Logo, Header, Mitarbeiter, Stundensätze)
- [x] Skeleton Loading States
- [x] Leere Zustände mit CTAs auf allen Seiten
- [x] Fehlerbehandlung mit ConfirmModals
- [x] **Kalender stabilisiert** — bidirektionale Sync für Google + CalDAV, Live-Updates, Detail-View
- [x] **Live-System Architektur** — `useRealtimeTable`-Hook + Per-Tabelle-Subscriptions
- [ ] **Penetration-Test der RLS** — kann Org A wirklich keine Daten von Org B sehen? (kritisch vor Verkaufsstart)

### Phase 2 — Killer-Features schärfen (1–2 Monate)

#### Kalender funktionsfähig machen ✅
- [x] OAuth-Flow stabilisieren (Token-Refresh, AES-Verschlüsselung)
- [x] Bidirektionale Sync robuster (PATCH-Endpoints, Delete-Propagation, Target-Change)
- [x] Event-Erstellung aus Vela → Provider (Google, CalDAV)
- [x] Provider → Vela Polling (3 min + Tab-Focus)
- [ ] Konflikt-Resolution (last-write-wins → updated_at-Vergleich)
- [ ] Webhooks statt Polling (Google Calendar Push Notifications)

#### Mitarbeiter-Reporting
- [ ] Wochenübersicht pro Mitarbeiter: Stunden, Projekte, Aufgaben
- [ ] Monatsübersicht mit Soll/Ist (40h Soll, 38h gebucht)
- [ ] Projekt-Verteilung als Balkendiagramm
- [ ] Manager-Ansicht: Alle Mitarbeiter auf einen Blick
- [ ] CSV-Export für Lohnbuchhaltung

#### Kanban-Board für Todos
*Asana-Migrationspfad*
- [ ] Board-Ansicht als Alternative zur Liste
- [ ] Spalten = Status (Offen / In Arbeit / Review / Erledigt)
- [ ] Drag & Drop zwischen Spalten
- [ ] Toggle zwischen Listen- und Board-Ansicht

#### Mehr Tiefe im Kunden-Cockpit
- [ ] Umsatz-Verlauf als Chart (Monate)
- [ ] Margen-Analyse: Umsatz minus Stunden-Kosten
- [ ] "Kunden im Risiko" Indikator (keine Aktivität in X Tagen)

---

### Phase 3 — Vermarktbarkeit (3–6 Monate)

#### SaaS-Infrastruktur
- [ ] **Subdomain-Routing** — `meine-agentur.vela.app`
- [ ] **Plan-System**
  ```
  Free    → 1 Projekt, 3 User, kein PDF-Export
  Pro     → ~49€/Monat, unbegrenzt, alle Features
  Agency  → ~99€/Monat, White-Label, API
  ```
- [ ] **Stripe-Integration** (Checkout, Webhooks, Plan-Management)
- [ ] **Feature-Flags** basierend auf `plan_tier`

#### Client-Portal (Killer-Feature für Vertrieb)
- [ ] Kunden bekommen Read-only-Link zum Projekt
- [ ] Sichtbar: Status, öffentliche Logs, Dokumente, Deadline
- [ ] Nicht sichtbar: interne Notizen, Stunden, Kalkulation
- [ ] Optional: Kunde kann Feedback im Logbuch hinterlassen
- [ ] Kein Login nötig (Token-basiert)

#### Quality of Life
- [ ] **44px Touch Targets** durchgängig (Apple HIG)
- [ ] **Keyboard Navigation** — Tab, Escape, Arrow-Keys in Dropdowns
- [ ] Mobile-optimierte Zeiterfassung (schlanker Mobile-View)

---

### Phase 4 — Wachstum & Ökosystem (6–12 Monate)
- [ ] **DATEV-Export** — Zeiterfassung für Steuerberater
- [ ] **Projekt-Templates** — Webseite, Kampagne, Branding, Rebranding
- [ ] **@Mentions in Kommentaren** mit Push + E-Mail
- [ ] **Deadline-Erinnerungen** automatisch 3 Tage vorher
- [ ] **API-Webhooks** für eigene Integrationen
- [ ] **Slack-Integration** (Task zugewiesen → Slack-Nachricht)
- [ ] **White-Label** — eigene Domain, eigenes Logo in PDFs
- [ ] **KI-Assistent** — Zeitschätzung, Projekt-Summaries, Beschreibungs-Vorschläge

---

## Was bewusst NICHT gebaut wird

| Feature | Warum nicht |
|---|---|
| **Eigener Chat / Messenger** | Slack existiert. Eigener Chat = eigenes Produkt. |
| **Gantt-Chart** | Schön zu haben, monatelange Arbeit, kaum täglich genutzt |
| **Native iOS/Android App** | Responsive Web reicht für Phase 1–3 |
| **Eigene Videocalls** | Zoom/Meet existiert. Integration reicht. |
| **E-Mail-Client** | Scope-Creep. Fokus behalten. |
| **Eigene Cloud-Speicher** | Drive/Dropbox-Link reicht. |

---

## Technische Architektur

### Aktueller Stack
```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:    Supabase (PostgreSQL + Auth + Realtime + Storage + RLS)
Hosting:    Vercel (Frontend) + Supabase Cloud (Backend)
PDF:        @react-pdf/renderer
Kalender:   CalDAV + Google OAuth + Microsoft OAuth + iCal Proxy
Layout:     react-grid-layout für anpassbares Dashboard
```

### Was noch ergänzt werden muss für vollen SaaS-Launch
```
Subdomain-Routing    → Next.js middleware + org domain lookup
Stripe               → Checkout, Webhooks, Plan-Management
Feature-Flags        → plan_tier Check vor Premium-Features
E-Mail-Templates     → Willkommen, Einladung, Deadline-Reminder
Monitoring           → Sentry für Fehler, Vercel Analytics
DATEV-Export         → CSV-Format für Steuerberater
```

### Datenbank-Migrationen (vorhanden)
```
rls_migration.sql              ✅ RLS auf allen Tabellen
invite_migration.sql           ✅ Einladungs-System
self_registration_migration.sql ✅ Selbst-Registrierung
calendar_v2_migration.sql      ✅ Kalender-Schema
calendar_caldav_migration.sql  ✅ CalDAV-Felder
add_project_links.sql          ✅ Dokumente-Links
add_external_positions.sql     ✅ Fremdleistungen
add_allocation_status.sql      ✅ Ressourcen-Status
add_missing_project_status_values.sql ✅ Status-Erweiterung
```

### Geplante Migrationen
```sql
-- Subscriptions
ALTER TABLE agency_settings ADD COLUMN plan_tier TEXT DEFAULT 'free';
ALTER TABLE agency_settings ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE agency_settings ADD COLUMN plan_expires_at TIMESTAMPTZ;

-- Client Portal
ALTER TABLE projects ADD COLUMN client_portal_token TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN client_portal_enabled BOOLEAN DEFAULT false;
```

---

## Go-to-Market Strategie

### Phase 1: Validation (jetzt — 3 Monate)
- **3 Pilot-Agenturen** finden — kostenlos — die das Tool aktiv nutzen
- Wöchentliche Feedback-Calls
- Kein Vertrieb, nur lernen
- Ziel: Produkt-Market-Fit verstehen

### Phase 2: Early Access (3–6 Monate)
- Landingpage mit Waitlist
- 50–100 Agenturen auf Waitlist (LinkedIn, BVDW, Agentur-Communities)
- Early-Access zu reduziertem Preis (Lifetime-Deal oder Discount)
- Case Studies aus Pilot-Agenturen

### Phase 3: Launch (6–12 Monate)
- Product Hunt Launch
- DACH-spezifische Kanäle (BVDW, Agentur-Foren, LinkedIn DE)
- Partner-Programm für Agentur-Berater
- Pricing live

### Preismodell-Überlegung
```
Free        →  1 Projekt, 3 User, kein PDF-Export, Vela-Branding in PDFs
Pro         →  ~49€/Monat — Unbegrenzte Projekte & User, alle Features
Agency      →  ~99€/Monat — White-Label, eigene Domain, API, Priority Support, DATEV
```

---

## Ehrlichster Ratschlag

> **Hol Dir 3 echte Agenturen** — auch gratis — die Vela aktiv nutzen. Nicht als Beta-Test mit Formular, sondern als echte Partnerschaft. Die werden Dir in 2 Wochen mehr sagen als 6 Monate alleine entwickeln.

Was sie täglich vermissen, was sie verwirrt, was sie begeistert — das ist die echte Roadmap.

Der Unterschied zwischen einem Tool das verkauft wird und einem das im Repository stirbt, ist nicht die Anzahl der Features. Es ist ob echte Menschen es täglich benutzen wollen.

---

## Nächste konkrete Schritte (Empfehlung)

1. ~~**Kalender funktionsfähig machen**~~ ✅ erledigt (Mai 2026)
2. **Mitarbeiter-Reporting** bauen — Wochen-/Monatsübersicht ⬅ aktuell in Arbeit
3. **3 Pilot-Agenturen** ansprechen (parallel zur Entwicklung)
4. **RLS-Penetration-Test** vor Verkaufsstart
5. **Client-Portal** als Vertriebs-Hook
6. **Microsoft/Outlook** OAuth-Integration aktivieren (Code fertig, Azure-App fehlt)

---

*Dieses Dokument wird laufend aktualisiert. Es ist der lebendige Plan für Vela als vollständige SaaS-Plattform.*
