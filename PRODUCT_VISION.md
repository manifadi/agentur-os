# Agentur OS — Produkt-Vision & Roadmap

> **Ziel:** Das ultimative Projektmanagement-Tool für Agenturen — eine Mischung aus Troi und Asana, Apple-like in Design und Bedienbarkeit, als eigenständige SaaS-Plattform vermarktbar.

Stand: Mai 2026 · Erstellt aus Produkt-Gespräch

---

## Die Vision in einem Satz

> **Agentur OS ist das Betriebssystem einer modernen Agentur — Projekte, Stunden, Kalkulation, Todos, Ressourcen und Reporting, alles in einem Tool, so intuitiv dass keine Einschulung nötig ist.**

---

## Warum dieser Markt eine Lücke hat

| Tool | Stärken | Schwächen |
|---|---|---|
| **Troi** | Zeiterfassung, Billing, Kalkulation | Design aus 2005, komplexe UX, kein modernes Task-Management |
| **Asana** | Task-Management, UI, Boards | Kein Billing, keine Agentur-Logik, zu generisch, teuer |
| **Moco** | Moderner als Troi | Wenig Tiefe bei Tasks & Collaboration |
| **Agentur OS** | **Alles davon, schön, intuitiv, DACH-native** | — |

**Der echte Wettbewerbsvorteil ist nicht die Feature-Liste — es ist das Erlebnis.** Eine Software die sich wie ein Apple-Produkt anfühlt und trotzdem Angebote, Stunden und Tasks in einem hat, existiert nicht. Das ist der Moat.

---

## Was bereits existiert (Stand Mai 2026)

### Fertig & funktional
- [x] Projekt-Verwaltung (Erstellen, Bearbeiten, Löschen, Duplizieren)
- [x] Status-System mit Priorisierung (Priorisierung → Bearbeitung → Geplant → Warten → Erledigt → Abgebrochen)
- [x] Todo-Listen mit Zuweisung, Drag & Drop, Logbuch
- [x] Zeiterfassung mit Tagesansicht und Projektbuchung
- [x] Ressourcenplanung (Wochenansicht pro Mitarbeiter)
- [x] Kalender mit iCal-Integration
- [x] Kalkulation & Positionen pro Projekt
- [x] Angebots-PDF & Rechnungs-PDF
- [x] Dokumenten-Upload
- [x] Multi-Tenant Fundament (`organization_id` überall)
- [x] Dark Mode + 7 Accent-Themes
- [x] Design System (Tokens, Komponenten, Typography)
- [x] Toast-Benachrichtigungen nach Aktionen
- [x] Persistente Filter in Projektübersicht
- [x] Status-basiertes Sortieren (Priorisierung zuerst)
- [x] Globale Suche

### Design-System (umgesetzt)
- [x] Typography Scale (`.ds-display`, `.ds-title`, `.ds-body`, `.ds-callout`, `.ds-caption`)
- [x] Button-Hierarchie (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`)
- [x] Status-Dots statt schwerer Pill-Badges
- [x] Saubere Tabellen ohne Zebrastreifen
- [x] Hover-reveal Aktionen in Listen
- [x] Konsistentes Filter-Panel mit Custom-Dropdown

---

## Positionierung & Differenzierung

### Zielgruppe (Primär)
- **Deutschsprachige Kreativ-Agenturen** (Webdesign, Marketing, Branding, PR)
- Teamgröße: 2–30 Mitarbeiter
- Aktuell: Nutzen 2–5 verschiedene Tools (Troi + Asana + Google Sheets + Drive)
- Schmerzpunkt: Keine einheitliche Sicht auf Projekte, Stunden und Rentabilität

### Was Agentur OS einzigartig macht
1. **Agentur-native Kalkulation** — Positionen, Stunden-Budget, Soll/Ist direkt am Projekt, nicht in einem Separaten Tool
2. **Ein Tool, keine Integrationen** — kein Zapier, kein "Tool A + Tool B + Tool C"
3. **Reporting das Sinn macht** — nicht 50 Widgets, sondern: *"Wie profitabel ist dieses Projekt?"* und *"Was macht mein Team diese Woche?"*
4. **Client-Portal** — Kunden sehen Projektstatus, Logbuch und Dokumente ohne Vollzugang
5. **Einfachheit als Kernprinzip** — weniger Optionen, bessere Entscheidungen
6. **DACH-Markt** — Deutsche UI, DATEV-Export, deutsche Rechtssicherheit bei Rechnungen

### Design-Prinzipien (nie aufgeben)
- **Clarity:** Jede Seite hat einen klaren Fokus. Kein Feature-Overload.
- **Deference:** UI tritt zurück, Inhalt steht vorne.
- **Consistency:** Gleiche Aktion = gleicher Button = gleicher Ort — auf jeder Seite.
- **Zero Onboarding:** Neue User verstehen das Tool in 10 Minuten ohne Anleitung.

---

## Feature-Roadmap

### Phase 1 — Fundament festigen (Priorität: Sofort)

#### Multi-Tenant SaaS vorbereiten
- [ ] **Supabase Row-Level Security (RLS) vollständig verifizieren**
  - Jede Tabelle braucht Policy: `organization_id = (auth.jwt() ->> 'org_id')::uuid`
  - Penetration-Test: Kann Org A Daten von Org B lesen? Muss zwingend Nein sein.
- [ ] **Einladungs-System für Mitarbeiter**
  - `invite_tokens` Tabelle mit Token, E-Mail, Org-ID, Ablaufdatum
  - E-Mail-Versand via Resend oder Postmark
  - Einladungs-Link → Registrierung → automatische Org-Zuordnung
- [ ] **Selbst-Registrierung für neue Agenturen**
  - Eigener Onboarding-Flow: Firma anlegen → Logo hochladen → ersten Mitarbeiter einladen
  - Ziel: Neue Agentur ist in unter 5 Minuten einsatzbereit
- [ ] **Einstellungs-Seite vervollständigen**
  - Stundenpreise pro Mitarbeiter / Rolle
  - Standard-Mehrwertsteuer konfigurierbar
  - Firmenadresse für Rechnungs-PDF
  - Rechnungs-Nummerierungsformat

#### UX & Qualität
- [ ] **Skeleton Loading States** statt leerer Flächen beim Laden
- [ ] **44px Touch Targets** für alle interaktiven Elemente (Apple HIG)
- [ ] **Keyboard Navigation** — Tab, Escape, Arrow-Keys in Dropdowns
- [ ] **Leere Zustände** mit sinnvollem CTA auf allen Seiten
- [ ] **Fehlerbehandlung** durchgängig — kein stiller Fehler ohne User-Feedback

---

### Phase 2 — Die 3 Killer-Features (2–3 Monate)

#### 1. Projekt-Reporting
*"Wie profitabel ist dieses Projekt gerade?"*

- [ ] Budget-Verbrauch in Echtzeit (gebuchte Stunden × Stundensatz vs. Angebotssumme)
- [ ] Stunden pro Mitarbeiter auf diesem Projekt
- [ ] Zeitachse der Buchungen
- [ ] Ampel-System: Grün (< 80% Budget), Orange (80–100%), Rot (> 100%)
- [ ] Export als PDF für Kunden-Reporting

#### 2. Mitarbeiter-Reporting
*"Was hat wer gemacht? Wie viele Stunden auf welchen Projekten?"*

- [ ] Wochenübersicht pro Mitarbeiter: Stunden, Projekte, Aufgaben
- [ ] Monatsübersicht mit Soll/Ist (z.B. 40h Soll, 38h gebucht)
- [ ] Projekt-Verteilung als einfaches Balkendiagramm
- [ ] Manager-Ansicht: Alle Mitarbeiter auf einen Blick
- [ ] CSV-Export für Lohnbuchhaltung / Steuerberater

#### 3. Kanban-Board für Todos
*Der Einstieg für User die von Asana kommen*

- [ ] Board-Ansicht als Alternative zur Listen-Ansicht
- [ ] Spalten = Status (Offen / In Arbeit / Review / Erledigt)
- [ ] Drag & Drop zwischen Spalten
- [ ] Karten zeigen: Titel, Zuweisung, Deadline, Priorität
- [ ] Toggle zwischen Listen- und Board-Ansicht (Segmented Control)

---

### Phase 3 — Vermarktbarkeit (3–6 Monate)

#### SaaS-Infrastruktur
- [ ] **Subdomain-Routing** — `meine-agentur.agentur-os.de`
  - Next.js Middleware liest Subdomain, mappt zu Organization
  - Supabase lookup: `domain → organization_id`
- [ ] **Plan-System definieren**
  ```
  Free    → 1 Projekt, 3 User, kein PDF-Export
  Pro     → Unbegrenzt Projekte & User, alle Features — ~49€/Monat
  Agency  → White-Label (eigenes Logo in PDFs), API-Zugang — ~99€/Monat
  ```
- [ ] **Stripe-Integration**
  - Checkout-Flow für neue Organisationen
  - Webhook → `plan_tier` in `agency_settings` aktualisieren
  - Automatische Downgrade-Logik wenn Zahlung scheitert
- [ ] **Feature-Flags** basierend auf `plan_tier`
  - Prüfung vor Plan-exklusiven Features
  - Freundlicher Upgrade-Hinweis statt harter Blockade

#### Client-Portal (Killer-Feature für Vertrieb)
- [ ] Kunden bekommen einen Read-only-Link zum Projekt
- [ ] Sichtbar: Status, Logbuch-Einträge (nur `is_public = true`), Dokumente, Deadline
- [ ] Nicht sichtbar: interne Notizen, Stunden, Kalkulation
- [ ] Optional: Kunde kann Feedback direkt im Logbuch hinterlassen
- [ ] Kein Login nötig (Token-basierter Zugang)

---

### Phase 4 — Wachstum & Ökosystem (6–12 Monate)

- [ ] **DATEV-Export** — für deutsche Agenturen fast Pflicht (Zeiterfassungs-Daten für Steuerberater)
- [ ] **Projekt-Templates** — Vorlagen für typische Agenturprojekte (Webseite, Kampagne, Branding, Rebranding)
- [ ] **@Mentions in Kommentaren** — `@Anna` benachrichtigt Anna per Toast + E-Mail
- [ ] **Deadline-Erinnerungen** — automatische E-Mail 3 Tage vor Deadline
- [ ] **API-Webhooks** — damit fortgeschrittene User eigene Integrationen bauen können
- [ ] **Slack-Integration** — Task zugewiesen → Slack-Nachricht
- [ ] **Mobile-optimierte Zeiterfassung** — schlanke Mobile-Ansicht nur für "Heute buchen"
- [ ] **White-Label** — eigenes Logo, eigene Domain, eigene Farben pro Agentur (Agency-Plan)
- [ ] **KI-Assistent** — Zeitschätzung für Tasks, automatische Projekt-Zusammenfassung, Beschreibungs-Vorschläge

---

## Was bewusst NICHT gebaut wird

| Feature | Warum nicht |
|---|---|
| **Eigener Chat / Messenger** | Slack existiert. Ein eigener Chat ist ein eigenes Produkt. |
| **Gantt-Chart** | Schön zu haben, monatelange Arbeit, kaum täglich genutzt |
| **Native iOS/Android App** | Responsive Web reicht für Phase 1–3 vollständig |
| **Eigene Videocalls** | Zoom/Meet existiert. Integration reicht. |
| **E-Mail-Client** | Scope-Creep. Fokus behalten. |
| **Eigene Cloud-Speicher** | Drive/Dropbox-Link reicht. Eigener Speicher = eigene Infrastruktur. |

---

## Technische Architektur (SaaS-Ready)

### Aktueller Stack
```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:    Supabase (PostgreSQL + Auth + Realtime + Storage)
Hosting:    Vercel (Frontend) + Supabase Cloud (Backend)
PDF:        @react-pdf/renderer
```

### Was für echtes Multi-Tenant SaaS ergänzt werden muss

```
Supabase RLS         → organization_id Policy auf allen Tabellen
Einladungs-System    → invite_tokens Tabelle + E-Mail via Resend
Subdomain-Routing    → Next.js middleware + org domain lookup
Stripe               → Checkout, Webhooks, Plan-Management
Feature-Flags        → plan_tier Check vor Premium-Features
E-Mail-Templates     → Willkommen, Einladung, Deadline-Reminder
Super-Admin Panel    → Alle Orgs verwalten (existiert ansatzweise)
Monitoring           → Sentry für Fehler, Vercel Analytics für Performance
```

### Datenbank-Ergänzungen geplant
```sql
-- Einladungen
CREATE TABLE invite_tokens (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  email TEXT,
  token TEXT UNIQUE,
  role TEXT DEFAULT 'member',
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ
);

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

### Phase 1: Validation (0–3 Monate)
- **3 Pilot-Agenturen** finden — auch kostenlos — die das Tool aktiv nutzen
- Wöchentliche Feedback-Calls: Was fehlt? Was verwirrt? Was lieben sie?
- Kein Vertrieb, nur lernen
- Ziel: Produkt-Market-Fit verstehen

### Phase 2: Early Access (3–6 Monate)
- Landingpage mit Waitlist
- **50–100 Agenturen** auf Waitlist bringen (LinkedIn, BVDW, Agentur-Communities)
- Early-Access zu reduziertem Preis (Lifetime-Deal oder Discount)
- Case Studies aus Pilot-Agenturen

### Phase 3: Launch (6–12 Monate)
- Product Hunt Launch
- DACH-spezifische Kanäle: BVDW, Agentur-Foren, LinkedIn DE
- Partner-Programm für Agentur-Berater
- Pricing live schalten

### Preismodell-Überlegung
```
Free        →  Für Einzelpersonen / Freelancer
             →  1 Projekt, 3 User, kein PDF-Export, Agentur-OS-Branding

Pro         →  ~49€/Monat (oder 39€ jährlich)
             →  Unbegrenzte Projekte & User
             →  Alle Features inkl. Reporting & Client-Portal
             →  E-Mail-Support

Agency      →  ~99€/Monat
             →  Alles aus Pro
             →  White-Label (eigene Domain, eigenes Logo in PDFs)
             →  API-Zugang
             →  Priority Support
             →  DATEV-Export
```

---

## Ehrlichster Ratschlag

> **Hol dir 3 echte Agenturen** — auch gratis — die das Tool aktiv nutzen. Nicht als Beta-Test mit einem Formular, sondern als echte Partnerschaft. Die werden dir in 2 Wochen mehr sagen als 6 Monate alleine entwickeln.

Was sie täglich vermissen, was sie verwirrt, was sie begeistert — das ist der echte Roadmap.

Der Unterschied zwischen einem Tool das verkauft wird und einem das im Repository stirbt, ist nicht die Anzahl der Features. Es ist ob echte Menschen es täglich benutzen wollen.

---

## Nächste konkrete Schritte (Empfehlung)

1. **Projekt-Reporting** implementieren — das ist der Moment wo eine Agentur echten Geschäftswert sieht
2. **Supabase RLS verifizieren** — ohne das kein sicheres SaaS
3. **Onboarding-Flow** bauen — damit eine neue Agentur sich selbst einrichten kann
4. **3 Pilot-Agenturen** ansprechen

---

*Dieses Dokument wird laufend aktualisiert. Es ist der lebendige Plan für den Aufbau von Agentur OS als vollständige SaaS-Plattform.*
