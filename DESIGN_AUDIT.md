# Design- & UX-Audit — Vela / Agentur OS

Apple-minimalistischer Design-/Produkt-Audit, Seite für Seite. Befunde sind **Vorschläge** (keine Umsetzung). Erst auf ausdrückliche Anweisung wird Code geändert — z.B. „implementiere alle Quick Wins aus DESIGN_AUDIT.md".

> Hinweis: Audit derzeit **code-basiert** (Layout, Struktur, Tokens, States). Live-Screenshots der laufenden App wurden noch nicht erstellt — bei Bedarf separat nachholen.

## Fortschritt

| # | Bereich | Status |
|---|---------|--------|
| 1 | Dashboard „Mein Bereich" | ✅ auditiert (2026-06-12) |
| 2 | Projekte-Übersicht (`/uebersicht`) | ✅ auditiert (2026-06-12) |
| 3 | Projekt-Detail (Tabs) | ✅ auditiert (2026-06-12) |
| 4 | Globale Aufgaben (`/aufgaben`) | ✅ auditiert (2026-06-12) |
| 5 | Ressourcenplan (`/ressourcen`) | ⬜ offen |
| 6 | Zeiterfassung (`/zeiterfassung`) | ⬜ offen |
| 7 | Kalender (`/kalender`) | ⬜ offen |
| 8 | Reporting (`/reporting`) | ⬜ offen |
| 9 | Abwesenheiten (`/abwesenheiten`) | ⬜ offen |
| 10 | Kunden-Cockpit (`/clients/[id]`) | ⬜ offen |
| 11 | Einstellungen (`/einstellungen`) | ⬜ offen |
| 12 | Auth & Onboarding | ⬜ offen |
| 13 | Super-Admin-Panel (`/admin/*`) | ⬜ offen |

---

## Priorisierter Backlog (alle Bereiche)

Wird über die Durchläufe gefüllt. Sortiert nach Wirkung × Aufwand.

> **Umgesetzt in autonomer Session 2026-06-12** (commit `7ceb40b`): dynamische Tailwind-Farbklassen → statische Map; PM-„?"-Platzhalter → dezenter Leerzustand. Verifiziert mit tsc + Tests + `next build`.

### ⚡ Quick Wins
- ✅ **[ERLEDIGT] Dynamische Tailwind-Farbklassen ersetzt** — `text-${info.color}-500` / `bg-${w.color}-500/10` (Dashboard) → statische `WIDGET_COLOR`-Map. Behebt Purge-Risiko im Prod-Build. · `app/components/Dashboard/UserDashboard.tsx`
- ✅ **[ERLEDIGT] PM-Leerzustand in Projektliste** — „?"-Avatar bei fehlendem PM → dezenter „–"-Platzhalter. · `app/components/Projects/ProjectList.tsx`
- **[UX/Politur] Wochenplan-Widget: Akzent-rote Stunden-Pills** — jede Tageszelle ist `text-accent bg-accent/10` (= warmes Marken-Rot); großflächig wirkt das Plan-Raster „alarmierend". Konsistent zur Marke, aber ruhiger wäre neutrale Zahl + nur Tagessumme/Über-Kapazität farbig. **Subjektiv — bewusst NICHT autonom geändert.** · `UserDashboard.tsx:651`
- **[Performance] `/uebersicht` ist die mit Abstand schwerste Route** — First Load **840 kB** (Bundle 539 kB), weil Liste + `ProjectDetail` + alle Modals + `@react-pdf/renderer` zusammen geladen werden. → `ProjectDetail`/PDF dynamisch importieren (`next/dynamic`), Modals lazy. Spürbarer Ladezeit-Hebel. · `app/uebersicht/page.tsx`
- **[Konsistenz] Header-Buttons auf DS-`.btn-*` vereinheitlichen** — Mischung aus `bg-text-primary` (schwarz), Outline-Buttons und Uppercase-Mikro-Labels statt der DS-Button-Klassen. · Dashboard-Header
- **[Konsistenz] „Weitere laden"-Button + Inline-Hover** auf DS-`.btn-secondary` umstellen — derzeit Hover via JS-Inline-Styles nachgebaut. · `app/components/Dashboard/DashboardView.tsx:210`
- **[Theming, systemweit] Hartkodierte Palette-Farben** — `bg-indigo-500/10`, `bg-green-500/10`, `text-red-500`, `text-yellow-400` (Dropdowns/Hero/Stern) **und** Hex-Props `#EF4444`/`#F59E0B`/`#3B82F6`/`#6B7280` (StatCards). Nicht dark-/akzent-aware, uneinheitlich. → semantische Tokens (`--color-danger/warning/info/...`) bzw. zentrale Map. Tritt in Dashboard, Projekt-Detail **und** Aufgaben auf. · `UserDashboard.tsx`, `ProjectDetail.tsx:616–637`, `app/components/Tasks/GlobalTasks.tsx:286–301`
- **[Konsistenz] Inline-SVG durch lucide-Icons ersetzen** — eigene `<svg>`-Chevrons/Häkchen statt `ChevronDown`/`Check`. · `ProjectDetail.tsx:684,697`
- **[Konsistenz, systemweit] Eigene Segmented-Controls auf `ViewSwitcher` umstellen** — `SegmentButton` in Aufgaben (View- & Quellen-Toggle) baut das DS-Pattern nach. `ViewSwitcher` existiert genau dafür. → vereinheitlichen (weniger Code, ein Verhalten). · `GlobalTasks.tsx:312–331`

### 🏗️ Größere Umbauten
- **[Konsistenz] Karten-Radius/Schatten-Skala vereinheitlichen** — Dashboard nutzt `rounded-[32px]` + bespoke Schatten, der Rest der App `.card` (`rounded-2xl`, `--shadow-sm`). Eine gemeinsame Skala wirkt ruhiger/konsistenter.
- **[IA] Projekt-Detail als eigene Route** — heute rendert `/uebersicht` das Detail state-basiert anstelle der Liste (`?projectId`). Eigene Route (`/projekte/[id]`) bringt echten Browser-Back, sauberes Deep-Linking, erhaltene Scroll-/Filter-Position. Hoher Hebel, betrifft auch Bereich #3.
- **[Produktivität] Karten-/Tabellenansicht für Projektliste** — `ViewSwitcher` Karten/Tabelle (Status/Deadline/PM/Fortschritt sortierbar) für große Projektmengen.
- **[IA] Angebot/Rechnung aus der Tiefe holen** — beide liegen 2 Ebenen tief (Tab „Kalkulation" → Sub-Tab). Für Agenturen sind das Kern-Outputs; prüfen, ob sie prominenter gehören (eigener Tab „Angebote & Rechnungen" oder Umbenennung des Kalkulations-Tabs). · `ProjectDetail.tsx:744`

---

## 1. Dashboard „Mein Bereich" — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Starker, Apple-naher Einstieg (große Begrüßung, ruhiges Widget-Grid, schöne Leerzustände). Es leidet aber an **eigener visueller Sprache** gegenüber dem restlichen DS (Radius/Schatten/Buttons), **dynamischen Farbklassen** (Risiko + nicht theme-aware) und einem **überladenen Header** mit konkurrierenden Aktions-Flächen.

### Befunde

- **[P1] Dynamische Farbklassen vermeiden** — `text-${info.color}-500` (Widget-Header-Icon) und `bg-${w.color}-500/10 text-${w.color}-500` (Galerie) bauen Klassennamen zur Laufzeit. Tailwind-JIT purged ungenutzte Klassen → im Prod-Build können diese Farben **fehlen**; zudem ignorieren sie Dark-Mode/Akzent. → statische Map `widgetColor[id] → {iconClass, bgClass}` oder DS-Variablen. · `app/components/Dashboard/UserDashboard.tsx:271` (Registry), Widget-Header & Galerie-Render.

- **[P1] „Erledigt"-Farbe vereinheitlichen** — `assigned_todos` hakt in **Akzent** ab, `private_todos` in **green-500**. Zwei verschiedene Erledigt-Farben fürs gleiche Konzept stört die Lesbarkeit. → überall eine Semantik (Akzent **oder** `--color-success`). · `UserDashboard.tsx` (Toggle-Buttons beider Todo-Widgets, `~:708`).

- **[P1] Header entschlacken** — Vier konkurrierende Controls (Suche · „Aktionen"-Dropdown · „Widget" · Edit-Toggle), teils schwarz (`bg-text-primary`), teils Uppercase-`tracking-widest`. Apple-Prinzip: **eine** klare Primäraktion. → „Aktionen" als einzelnen `+`-Primary (DS `.btn-primary`), Suche als Ghost-Icon, „Widget hinzufügen" nur im Edit-Modus (bereits so) — und alle auf DS-Buttons + Satzschreibung statt Uppercase. · `UserDashboard.tsx:759–809`.

- **[P2] Karten-Sprache an DS angleichen** — `rounded-[32px]` + eigene `shadow-[0_4px_20px_...]` weichen vom DS (`.card`, `rounded-2xl`, `--shadow-sm`) ab. Vereinheitlichen reduziert „zwei Designsprachen"-Gefühl. · Widget-Container `UserDashboard.tsx:~808`.

- **[P2] Zwei Zeit-Widgets klarer trennen** — „Stundenerfassung" (Projektzeit) und „Stempeluhr" (Anwesenheit) stehen gleichwertig nebeneinander; der Unterschied ist für Neue nicht offensichtlich. → entweder klarere Sub-Titel/Tooltip („Projektzeit" vs. „Kommen/Gehen") oder ein kombiniertes „Zeit"-Widget mit Umschalter. · Registry + Render-Cases.

- **[P2] Todo-Sortiermenü vereinfachen** — Custom-Dropdown mit Uppercase-Mikro-Labels („Sortieren" → 3 Optionen) pro Widget ist visuell schwer für eine Nebensächlichkeit. → kompaktes Icon-Segment oder `ViewSwitcher size="sm"`. · `UserDashboard.tsx` (Sort-Menüs der Todo-Widgets).

- **[P3] Filler-Subtitel** — „Hier ist dein Überblick für heute." trägt wenig. Apple lässt solche Sätze meist weg oder ersetzt sie durch echte Information (z.B. „3 Aufgaben heute · 2 Termine"). · `UserDashboard.tsx:755`.

- **[P3] Mobile-Edit** — react-grid-layout-Drag/Resize ist auf schmalen Screens fummelig; im Edit-Modus auf Mobile ggf. nur Hinzufügen/Entfernen statt Drag anbieten. · Grid-Konfig.

---

## 2. Projekte-Übersicht (`/uebersicht`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Deutlich DS-konsistenter als das Dashboard — `ds-display`/`ds-caption`, `btn-primary`, Tokens, gutes Empty-State, reichhaltige Filter (Suche/Kunde/Status/PM/Sort) und „Weitere laden"-Pagination. Stärkster Schwachpunkt ist die **Informationsarchitektur**: das Projekt-Detail lebt im selben Container statt als eigene Route.

### Befunde

- **[P1] Projekt-Detail ohne eigene Route** — `selectedProject ? <ProjectDetail> : <DashboardView>` ersetzt die Liste in-place (state + `?projectId`). Kein nativer Browser-Back pro Projekt, kein sauberes Deep-Link/Teilen, Scroll- und Filterzustand der Liste gehen beim Öffnen/Schließen verloren. → eigene Next-Route fürs Detail, Liste bleibt gemountet. · `app/uebersicht/page.tsx:283`.

- **[P2] Zwei Such-Eingaben** — Header zeigt ein Lupe-Icon für die **globale** Suche (⌘K), die Filterbar darunter eine **Projekt-Suche**. „Wo suche ich?" ist nicht eindeutig. → im Projektkontext das Header-Such-Icon weglassen (Filterbar-Suche genügt) oder klar trennen/labeln. · `DashboardView.tsx:144` + `ProjectFilterBar`.

- **[P2] Nur Kartenansicht** — für Agenturen mit vielen Projekten fehlt eine **dichte Tabelle** (sortierbar nach Status/Deadline/PM/Fortschritt). → `ViewSwitcher` Karten/Tabelle (Muster aus Ressourcenplan/Reporting). Produktivitäts-Hebel.

- **[P2] „Weitere laden" nicht DS-konform** — Button baut Hover-States über `onMouseEnter/Leave`-Inline-Styles nach statt `.btn-secondary` zu nutzen — mehr Code, inkonsistent. · `DashboardView.tsx:210–230`.

- **[P3] IA: Mitarbeiter-Bearbeitung auf der Projektseite** — `EmployeeModal` wird hier eingebunden; Mitarbeiter-Verwaltung wirkt fehl am Platz auf der Projekt-Übersicht (gehört zu Einstellungen/Team). Prüfen, ob der Einstieg hier nötig ist. · `app/uebersicht/page.tsx:317`.

- **[P3] Filter als umrandete Karte** — die Filterleiste sitzt in einer eigenen Card mit Border/Background, was etwas schwer wirkt. Apple-typisch wäre eine leichtere, randlose Filterzeile direkt über der Liste. · `DashboardView.tsx:158`.

- **[P3] Begriffs-Konsistenz** — Sidebar/Heading wechseln zwischen „Übersicht" und „Projekte". Einheitliche Benennung schärft die Sprache.

---

## 3. Projekt-Detail (Tabs) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Sehr brauchbarer, dichter Projekt-Header (Kunden-Logo/Breadcrumb, Titel, Favorit, inline editierbares Status-Dropdown, PM-/Deadline-/Fortschritts-Badges) und saubere Tab-Leiste. Schwächen: wiederkehrende **hartkodierte Palette-Farben**, **Inline-SVGs** statt DS-Icons und ein **IA-Thema** (Angebot/Rechnung tief vergraben).

### Befunde

- **[P1] Angebot & Rechnung 2 Klicks tief** — Weg: Tab „Kalkulation" → Sub-Tab „Angebot"/„Rechnung". Für eine Agentur sind das zentrale Ergebnisse; sie sind aktuell hinter einem rechnerisch klingenden Tab versteckt. → eigenen Tab „Angebote & Rechnungen" anlegen **oder** „Kalkulation" umbenennen/teilen. · `ProjectDetail.tsx:744`.

- **[P1] Hartkodierte Farben in Aktionsmenü & Hero** — Icon-Tiles `bg-indigo-500/10`, `bg-green-500/10`, Delete `text-red-500`, Favoriten-Stern `text-yellow-400`. Nicht theme-/akzent-aware, brechen die ruhige Ein-Akzent-Ästhetik. → semantische Tokens (`--color-danger` für Löschen) + zentrale Map. · `ProjectDetail.tsx:616–637,667`.

- **[P2] Inline-SVG statt lucide** — eigener Chevron + Häkchen im Status-Dropdown als rohe `<svg>`. → `ChevronDown`/`Check` wie überall sonst (Konsistenz, weniger Markup). · `ProjectDetail.tsx:684,697`.

- **[P2] Doppelte Edit-Einstiege** — Aktionsmenü bietet „Grunddaten bearbeiten" **und** „Positionen bearbeiten" (Letzteres springt nur in den Kalkulations-Tab, den es schon gibt). Redundanz → „Positionen bearbeiten" entfernen, Tab genügt. · `ProjectDetail.tsx:612–620`.

- **[P3] Breadcrumb nicht klickbar** — Kundenname/Logo im Header führt nicht ins Kunden-Cockpit. Klickbar machen beschleunigt Quer-Navigation. · `ProjectDetail.tsx:650`.

- **[P3] Status-Pill zeigt Rohwert** — `{project.status}` direkt; sicherstellen, dass es ein sauberes Label ist (i18n-fähig), nicht ein interner Key.

- **[P3] Favoriten-Farbe off-palette** — `yellow-400` als einzige gelbe Stelle; entweder bewusst als „Favorit"-Semantik definieren oder auf Akzent vereinheitlichen.

---

## 4. Globale Aufgaben (`/aufgaben`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Eine der **produktivsten** Seiten — `ds-display`/`ds-caption`, klickbare KPI-Stat-Cards (Überfällig/Heute/Woche/Alle), Heute-/Listen-Ansicht, Quellen-Toggle (Alle/Projekt/Privat), Suche, Projekt-Multiselect, Inline-Add. Schwächen sind durchweg **systemisch** (Farben, nachgebaute Controls, Buttons), nicht konzeptionell.

### Befunde

- **[P1] StatCard-Farben als Hex-Props** — `#EF4444/#F59E0B/#3B82F6/#6B7280` direkt übergeben statt DS-Tokens. Nicht theme-/dark-aware, weicht von der Statusfarben-Semantik ab. → `--color-danger/warning/info/...`. · `GlobalTasks.tsx:286–301`.

- **[P2] Zwei nachgebaute Segmented-Controls** — `SegmentButton` für View- (Heute/Liste) und Quellen-Toggle (Alle/Projekt/Privat) dupliziert `ViewSwitcher`. → DS-Komponente nutzen (Konsistenz, weniger Code, gleiche Tastatur/States). · `GlobalTasks.tsx:309–332`.

- **[P2] „Historie"-Button bespoke** — inline-gestylt statt `.btn-secondary`. Gleiches Muster wie an anderen Stellen. · `GlobalTasks.tsx:273`.

- **[P3] Toolbar als schwere Card** — Toggles/Suche/Filter sitzen in einer umrandeten Card (wie in der Projekt-Übersicht). Eine leichtere, randlose Toolbar wirkt Apple-typischer. · `GlobalTasks.tsx:306`.

- **[P3] Subtitle-/Naming-Überlappung** — „Dein persönlicher Arbeitsbereich" überschneidet sich begrifflich mit dem Dashboard („Mein Bereich"). Schärfere, eindeutige Benennung.
