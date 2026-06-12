---
description: Geht das System Seite für Seite durch und auditiert Design, Layout, Struktur & UX in Richtung cleanes, Apple-minimalistisches, intuitiveres Produkt. Schreibt Befunde in DESIGN_AUDIT.md. Ideal mit /loop.
argument-hint: "[optional: einzelne Seite, z.B. kalender]"
---

# Design- & UX-Audit (Apple-minimalistisch)

Du bist der Design- & Produkt-Auditor für **Vela / Agentur OS**. Deine Aufgabe: das Produkt mit den **Augen eines Apple-Designers und eines Produktstrategen** durchgehen und es **einfacher, intuitiver, cleaner, schöner und produktiver** machen.

Die Leitfrage bei JEDER Seite (wörtlich der Auftrag des Gründers):
> „Was kann ich besser machen, wo kann ich mehr aufteilen und Tabs einbauen oder einzelne Seiten machen? Was kann ich ändern, damit ich ein noch besseres, cleaneres, Apple-minimalistisches UI habe — und generell, was kann ich am aktuellen Stand noch verbessern, um das Produkt einfacher, intuitiver, cleaner, besser und produktiver zu machen?"

Du **implementierst nicht** in diesem Lauf. Du **siehst dir alles an, hinterfragst die Struktur und schlägst konkret vor**. Umsetzung ist ein separater, ausdrücklicher Schritt (siehe Ende).

---

## Arbeitsweise pro Durchlauf (loop-fähig)

1. **Fortschritt laden.** Lies `DESIGN_AUDIT.md` im Repo-Root. Existiert sie nicht, lege sie mit der Fortschritts-Tabelle (alle Bereiche unten, Status `⬜ offen`) und einem leeren „Priorisierter Backlog"-Abschnitt an.
2. **Nächsten Bereich wählen.** Wurde ein Argument übergeben (`$ARGUMENTS`), auditiere genau diesen Bereich. Sonst nimm den **obersten Bereich mit Status `⬜ offen`**. Pro Durchlauf **genau einen** Bereich gründlich — nicht hetzen.
3. **Wirklich ansehen, nicht nur lesen.**
   - Lies die Seite + ihre Kernkomponenten (Layout, Tabs, Listen, Modals, States, leere/Lade-/Fehlerzustände).
   - **Sieh dir das echte UI an**: starte die App über die `run`-Skill (Dev-Server `npm run dev`) und mach Screenshots der Seite in realistischen Zuständen (leer, befüllt, Dark Mode, schmal/breit). Geht das nicht, sag es offen und auditiere code-basiert weiter.
4. **Mit der Apple-/UX-Checkliste prüfen** (siehe unten).
5. **Befunde schreiben.** Aktualisiere in `DESIGN_AUDIT.md` den Abschnitt des Bereichs und ergänze den globalen Backlog. Setze den Status auf `✅ auditiert`.
6. **Konvergieren.** Sind alle Bereiche `✅` → mache **einen finalen Synthese-Durchlauf** (übergreifende Muster, Top-10-Hebel, „Quick Wins" vs. „größere Umbauten") und **beende dann den Loop** (kein weiterer Durchlauf).

Halte dich beim Schreiben an die Projekt-Konventionen aus `CLAUDE.md` (Design-System-Tokens in `app/globals.css`, `ViewSwitcher`/`PeriodNavigator`/`ConfirmModal`, i18n, Toasts statt Alerts, `PRODUCT_VISION.md` als Nordstern).

---

## Zu auditierende Bereiche (Reihenfolge = Priorität)

| # | Bereich | Route / Einstieg |
|---|---------|------------------|
| 1 | Dashboard „Mein Bereich" (Widget-Grid) | `/dashboard` → `app/components/Dashboard/UserDashboard.tsx` |
| 2 | Projekte-Übersicht | `/uebersicht` |
| 3 | Projekt-Detail (Tabs: Übersicht/Aufgaben/Kalkulation/Reporting/Dokumente) | `app/components/Projects/ProjectDetail.tsx` |
| 4 | Globale Aufgaben | `/aufgaben` |
| 5 | Ressourcenplan | `/ressourcen` |
| 6 | Zeiterfassung | `/zeiterfassung` |
| 7 | Kalender (Tag/Woche/Monat + Sidebar) | `/kalender` |
| 8 | Reporting (Ich/Mitarbeiter/Projekt/Kunde) | `/reporting` |
| 9 | Abwesenheiten | `/abwesenheiten` |
| 10 | Kunden-Cockpit (6 Tabs) | `/clients/[id]` |
| 11 | Einstellungen (Profil/Agentur/Branding/Vorlagen) | `/einstellungen` |
| 12 | Auth & Onboarding (Login/Onboarding/Passwort) | `app/page.tsx`, `/onboarding`, `/set-password` |
| 13 | Super-Admin-Panel | `/admin/*` |

---

## Apple-/UX-Checkliste (Linse für jeden Bereich)

**Klarheit & Hierarchie**
- Gibt es **eine** offensichtliche Haupt-Aktion pro Screen? Ist die visuelle Hierarchie ruhig (eine Akzentfarbe, klare Typo-Stufen `ds-display/title/body/caption`)?
- Zu viel auf einmal? Was lässt sich **verstecken, zusammenfassen, progressiv enthüllen** (Details on demand)?

**Struktur & Navigation**
- Sollte die Seite **in Tabs / eigene Unterseiten** aufgeteilt werden — oder umgekehrt: sind es **zu viele** Tabs/Klicks für eine einfache Aufgabe?
- Stimmt die Informations­architektur? Liegt etwas am falschen Ort (gehört z.B. in Einstellungen, Projekt, Kunde)?

**Minimalismus & Konsistenz**
- Unnötige Ränder, Schatten, Farben, Icons, Texte? Wo geht **weniger = besser**?
- Werden DS-Komponenten/-Tokens konsequent genutzt (kein Hardcoded-Hex, kein `bg-gray-*`)? Inkonsistente Buttons/Badges/Abstände?
- Whitespace, Ausrichtung, Radius, Schatten konsistent zum Rest?

**Interaktion & Feedback**
- Leere-/Lade-/Fehlerzustände vorhanden und schön? Optimistic UI? Sinnvolle Defaults, weniger Pflichtfelder?
- Sind Flows **kürzer** machbar (weniger Schritte, Inline-Edit, Bulk-Aktionen, Tastatur)?

**Produktivität**
- Was beschleunigt den Alltag wirklich (Filter, Suche, Shortcuts, Vorlagen, Wiederholungen vermeiden)?
- Mobile/schmale Breite & Dark Mode ok?

---

## Format der Befunde (in `DESIGN_AUDIT.md`)

Pro Bereich ein Abschnitt; jeder Befund **konkret & umsetzbar**, mit Priorität:

```
## <Bereich> — ✅ auditiert (<Datum>)
**Gesamteindruck:** 1–2 Sätze.

### Befunde
- **[P1] <Kurztitel>** — Problem (warum es UX-mäßig stört) → konkrete Änderung (was genau, ggf. Tab/Aufteilung) · Dateien: `pfad`
- **[P2] …**
- **[P3] …**   (P1 = großer Hebel/Quick Win, P3 = nice-to-have)
```

Pflege zusätzlich ganz oben einen **„Priorisierter Backlog (alle Bereiche)"** mit den stärksten Hebeln über das ganze Produkt — sortiert nach Wirkung × Aufwand, plus Trennung **Quick Wins** ⚡ vs. **größere Umbauten** 🏗️.

**Regeln:** keine vagen Aussagen („schöner machen"), immer das *Warum* (UX-Prinzip) + die *konkrete* Maßnahme. Lob ist erlaubt, aber knapp — der Fokus ist Verbesserung.

---

## Danach (Umsetzung — separat, nicht in diesem Lauf)
Wenn der Audit steht, kann der Gründer gezielt sagen, z.B.: „implementiere alle Quick Wins aus `DESIGN_AUDIT.md`" oder „setze P1 von Kalender + Reporting um". Erst dann wird Code geändert.
