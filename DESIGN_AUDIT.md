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
| 5 | Ressourcenplan (`/ressourcen`) | ✅ auditiert (2026-06-12) |
| 6 | Zeiterfassung (`/zeiterfassung`) | ✅ auditiert (2026-06-12) |
| 7 | Kalender (`/kalender`) | ✅ auditiert (2026-06-12) |
| 8 | Reporting (`/reporting`) | ✅ auditiert (2026-06-12) |
| 9 | Abwesenheiten (`/abwesenheiten`) | ✅ auditiert (2026-06-12) |
| 10 | Kunden-Cockpit (`/clients/[id]`) | ✅ auditiert (2026-06-12) |
| 11 | Einstellungen (`/einstellungen`) | ✅ auditiert (2026-06-12) |
| 12 | Auth & Onboarding | ✅ auditiert (2026-06-12) |
| 13 | Super-Admin-Panel (`/admin/*`) | ✅ auditiert (2026-06-12) |

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

---

## 5. Ressourcenplan (`/ressourcen`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Durchdacht — Karten- **und** Tabellenansicht (`ViewSwitcher`), Wochen-Navigation, Abteilungs-Filter, Kapazitätsbalken je Mitarbeiter, Status-Badges je Projektzeile, dunkle Summenzeile in der Tabelle. Visuell etwas **bunt/dicht**; Begriff „Wochenplan" überschneidet sich mit dem Dashboard-Widget.

### Befunde
- **[P2] Naming-Kollision „Wochenplan"** — Seite (`/ressourcen`) trägt denselben Titel wie das Dashboard-Widget. „Ressourcenplan" als Seitentitel schärft die Unterscheidung. · `app/components/ResourcePlanner/ResourcePlanner.tsx:285`.
- **[P2] Karten-Ansicht visuell laut** — mehrfarbige Kapazitätssegmente + viele kleine, teils rote Tagesnummern erzeugen Unruhe. Ruhiger: eine Akzent-Intensität statt Vollpalette; Zahlen neutral, nur Über-Kapazität farbig. · ResourcePlanner Karten.
- **[P3] Dunkle Summenzeile** — die fast schwarze GESAMT-Leiste in der Tabelle ist ein starker Fremdkörper ggü. dem hellen DS; als `bg-subtle`/`--text-primary` ruhiger und dark-mode-sicherer.
- **[P3] Tages-Eingaben Mikro-Targets** — die per-Tag-Stunden-Felder sind sehr klein (Touch/Treffsicherheit). Etwas größere, klarere Eingabezellen erhöhen Produktivität.

---

## 6. Zeiterfassung (`/zeiterfassung`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Sehr clean und fokussiert — KW-Navigation + Tages-Strip (inkl. **Eintrags-Punkt** unter Tagen, frisch ergänzt), „Heute X/8h"-Karte, schöner Leerzustand (😴). Vorbildlich ruhig.

### Befunde
- **[P3] Viel Leerraum bei leerem Tag** — die Seite ist bei 0 Einträgen sehr leer. Ein dezenter Wochen-Überblick (erfasste Std. Mo–So) oder „zuletzt erfasst" füllt sinnvoll und erhöht Orientierung. · `app/zeiterfassung/page.tsx`.
- **[P3] „Heute / 8h" Soll fix** — das Tagessoll wirkt statisch 8h; sollte dem `weekly_schedule` des Tages folgen (Teilzeit/4-Tage). Konsistenz mit dem neuen Stunden-Modell. · `TimeStats`.
- **[P2] Quick-Win-Konsistenz** — Header-Such-/Aktionsmuster und Button-Stil mit den anderen Seiten angleichen (Teil der systemweiten Button-Vereinheitlichung).

---

## 7. Kalender (`/kalender`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Stärkste, am meisten Apple-typische Seite — Mini-Monat (mit Punkten, frisch korrigiert), Kalender-Gruppen (Meine/Team), Tag/Woche/Monat, ruhige Event-Pills. Sehr gut.

### Befunde
- **[P2] Event-Pills einfarbig blass** — externe/Team-Events sind dezent eingefärbt; bei vielen Terminen hilft etwas mehr Farbkodierung pro Kalender/Person (Lesbarkeit), ohne laut zu werden. · `WeekView`/`MonthView`.
- **[P3] „Neuer Termin" + KW-Nav + View-Switch im Header** — dicht, aber ok; auf schmaler Breite prüfen, ob umbrechend/zugänglich. 
- **[P3] Aktuelle-Zeit-Linie** ist nur eine dünne rote Linie ohne Label — kleine „jetzt"-Markierung erhöht Orientierung.

---

## 8. Reporting (`/reporting`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Klar strukturiert (Anwesenheit + Projektzeit getrennt, KPIs, durchsuchbare Picker, Woche/Monat/Frei). Frisch gebaut, konsistent mit DS.

### Befunde
- **[P2] Zwei rote Sektions-Icons** — Clock/FileText in Akzent-Rot wirken wie Warnungen; neutraler (text-secondary) wäre ruhiger, Rot für echte Negativ-Werte (Differenz) reservieren. · `ReportingPage.tsx`.
- **[P3] Leere Modi** — Projekt/Kunde ohne Auswahl zeigen nur den Hinweis; ein dezenter Beispiel-/Hilfe-Block würde Erstnutzung erleichtern.
- **[P3] Tages-Balken bei Ein-Tages-Daten** — bei nur einem Tag wirkt das Balken-Chart leer; ggf. erst ab ≥2 Tagen mit Daten zeigen.

---

## 9. Abwesenheiten (`/abwesenheiten`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Frisch redesignt — Balance-Hero (Tage **+** Stunden, „5 Wochen × 38,5h", „1 Tag ≈ 7,7h"), Stat-Kacheln, Status-Zähler, filterbare Historie, Jahr-Navigation. Sauber und gesetzeskonform.

### Befunde
- **[P3] Sparsamer Erstzustand** — bei neuem MA sind Zähler 0 und „Anstehend" leer (großer leerer Balken). Ein dezenter Onboarding-Hinweis („Trag deinen ersten Urlaub ein") wäre einladender. · `app/abwesenheiten/page.tsx`.
- **[P3] Status-Filter immer 5 Optionen** — auch wenn nur ein Status existiert; optional nur vorhandene Status zeigen (wie bei den Typ-Chips). 
- **[P2] Konsistenz** — „Eintragen" + Mode-Switcher + Jahr-Nav im Header: Button-/Token-Vereinheitlichung systemweit mitnehmen.

---

## 11. Einstellungen (`/einstellungen`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Gut strukturiert — linke Sektions-Navigation (ICH: Profil/Design/Navigation/Kalender · AGENTUR: Unternehmen/Team/Abteilungen/Stundensätze/Branding/Vorlagen), klare Formular-Karten. Solide IA.

### Befunde
- **[P2] Formular-Dichte & Pflichtfelder** — lange Formulare (Unternehmen) am Stück; sinnvolle Gruppierung ist da, aber Inline-Validierung/Format-Hilfen (IBAN/UID) + klar optionale Felder reduzieren Reibung. 
- **[P3] Aktiver Nav-Eintrag rein farbig** — Akzent-Hintergrund links ist ok; ein zusätzlicher dezenter Indikator (Balken) hilft bei Akzent-Themes mit geringem Kontrast.
- **[P3] „Speichern" pro Karte** — mehrere Speichern-Buttons; klarstellen, was gespeichert wird (pro Sektion), oder Auto-Save/optimistisch. 
- **[P3] Sprache-Toggle** als kleines Segment — konsistent mit `ViewSwitcher` halten.

---

## 10. Kunden-Cockpit (`/clients/[id]`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Funktionsreiches CRM-Cockpit mit 6 Tabs (Übersicht/Projekte/Finanzen/Aktivität/Dokumente/Team), KPI-Tiles, Aktivitäts-Feed. Inhaltlich stark — aber der **Haupt-Hotspot der systemweiten hartkodierten Farben** (green/orange/blue/red-500 in Stat-Tiles, Rechnungs-Status, Event-Icons).

### Befunde
- **[P1] Hartkodierte Palette-Farben (dichtester Vorkommen)** — Umsatz-Tile `green-500`, offene Rechnungen `orange-500`, Aktivitäts-Icons `blue/green/orange-500`, Lösch-Hover `red-500`. → semantische Tokens (`--color-success/warning/info/danger`). Größter Einzel-Hebel für die systemweite Token-Vereinheitlichung. · `app/clients/[id]/page.tsx:792,804,1044,1119,1141`.
- **[P2] 1365 Zeilen in einer Datei** — sechs Tab-Inhalte inline; in Tab-Komponenten auslagern verbessert Wartbarkeit (und ermöglicht Lazy-Loading). Kein UI-Effekt, aber Code-Gesundheit.
- **[P3] 6 Tabs** — gerechtfertigt für ein Cockpit; prüfen, ob „Aktivität" + „Dokumente" zusammengehen, um die Leiste zu entlasten.
- **[P3] Rote Deadlines/Lösch-Icons** — konsistente Danger-Semantik über Tokens statt `text-red-500`.

---

## 12. Auth & Onboarding — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Ruhig und markenkonform — Onboarding mit zentriertem Akzent-Logo-Tile, `rounded-3xl`-Karte, sauberen Lade-/Erfolgszuständen. `app/page.tsx` ist nur ein Redirect; der eigentliche Login ist `LoginScreen`.

### Befunde
- **[P3] Konsistenz Card-Radius** — Onboarding nutzt `rounded-3xl`, andere Flächen `rounded-2xl` (`.card`). Eine gemeinsame Radius-Skala (siehe Backlog) auch hier anwenden.
- **[P3] Markenmoment nutzen** — Login/Onboarding sind die ersten Eindrücke; ein dezenter Branding-/Claim-Block (aus `agency_settings`/Vela) stärkt Vertrauen, ohne Cleanness zu opfern.
- **[P3] Standalone-Seiten** (Login/Onboarding/Passwort) bewusst chromeless — gut; sicherstellen, dass Dark Mode + schmale Breite dort ebenfalls sauber sind.

---

## 13. Super-Admin-Panel (`/admin/*`) — ✅ auditiert (2026-06-12)

**Gesamteindruck:** Eigener, klar abgetrennter Bereich (eigene Sidebar/Layout). Nutzt **konsequent DS-Bausteine** (`.card`, `.card-header`, `.card-header-icon`, `ds-caption`) — eine der konsistentesten Ecken. Unterseiten: Agenturen, Reports, Anfragen, Audit-Log, Backups.

### Befunde
- **[P2] Bewusst „anderes" System** — der Super-Admin soll sich abgetrennt anfühlen (lt. CLAUDE.md). Das ist gut; sicherstellen, dass spätere DS-Vereinheitlichungen diese gewollte Trennung **nicht** verwässern (eigener Akzent/Chrome ok).
- **[P3] Dichte Tabellen/Listen** (Agenturen/Audit) — bei Wachstum: Suche/Filter/Pagination wie in der Projektliste übernehmen.
- **[P3] Gefahren-Aktionen** (Suspend/Löschen/Impersonation) — durchgehend 2-Step + klare Danger-Tokens; bereits teils so, systemweit konsistent halten.

---

## Synthese — Top-Hebel über das ganze Produkt (2026-06-12)

Das Produkt ist **bereits clean und Apple-nah**; die größten Gewinne liegen in **Konsistenz & Systematik**, nicht im Neudesign. Reihenfolge = Wirkung × Aufwand.

### ⚡ Quick Wins (klein, hohe Konsistenz-Wirkung)
1. ✅ **Dynamische Tailwind-Farbklassen** (Prod-Bug) — *erledigt, commit `7ceb40b`*.
2. ✅ **PM-Leerzustand** Projektliste — *erledigt, commit `7ceb40b`*.
3. ✅ **Farb-Tokens statt `*-500`-Literalfarben** — *erledigt für die Haupt-Hotspots: Kunden-Cockpit (`7c50dc2`), ProjectDetail + GlobalTasks (`c4f4f79`).* Rest: Dashboard-Favoriten-Stern (bewusst gelb belassen) + „AKTIONEN"-Button-Casing (subjektiv, offen).
4. ✅ **Segmented-Controls → `ViewSwitcher`** (GlobalTasks) + **bespoke Buttons → `.btn-secondary`** (Aufgaben „Historie", Projektliste „Weitere laden") — *erledigt `c4f4f79` / `81e0be8`*.
5. ✅ **Inline-SVGs → lucide-Icons** (ProjectDetail-Status-Dropdown) — *erledigt `c4f4f79`*.

> **Status:** Alle ⚡ Quick Wins umgesetzt & auf `main` (verifiziert mit tsc + 27 Tests + `next build`). Offen sind die 🏗️ größeren Umbauten unten.

### 🏗️ Größere Umbauten (planen)
- ✅ **`/uebersicht`-Bundle entschlacken** — *erledigt `57cabf1`*: ProjectDetail via `next/dynamic`, First Load 840 → 311 kB.
- ✅ **Karten-Radius/Schatten-Skala vereinheitlichen** — *erledigt `1283bf4`*: arbiträre Radien → `rounded-3xl`, Schatten → DS-Token.
- **Karten-/Tabellen-Toggle für Projektliste** — *vom Gründer verworfen (kompakte Liste bleibt).*
- ✅ **Projekt-Detail als eigene Route** `/projekte/[id]` — *erledigt `25984bf`/`e3a312e`/`2e79045`*: Browser-Back, Deep-Links, kontextsensitiver Zurück-Button („Zurück zu <letztem Modul>"), Listen-Filter persistent.
- ✅ **Angebot/Rechnung aus der Tiefe holen** — *erledigt `777241a`*: eigene Top-Tabs „Angebot"/„Rechnung" (vorher Sub-Tabs unter Kalkulation→Leistungen).

### Durchgängige Themen
- **Eine Akzent-Intensität**: Akzent-Rot gezielt für Primäraktionen/echte Negativwerte, nicht für neutrale Zahlen (Wochenplan-Pills, Reporting-Sektions-Icons).
- **Satzschreibung statt UPPERCASE** auf Buttons; Uppercase nur für `ds-caption`-Mikrolabels.
- **Naming schärfen**: „Übersicht" vs „Projekte", „Wochenplan" (Seite vs Widget), „Mein Bereich" vs „persönlicher Arbeitsbereich".
- **Leerzustände** sind durchweg gut — bei sehr leeren Seiten (Zeiterfassung/Abwesenheiten neu) dezente Orientierung/Onboarding ergänzen.

**Audit vollständig (Bereiche #1–#13).**
