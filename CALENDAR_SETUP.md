# Kalender-Integrationen einrichten

Vela unterstützt vier Wege, externe Kalender zu verbinden:

| Provider | Methode | Bidirektional | Setup-Aufwand |
|---|---|---|---|
| **Google Calendar** | OAuth | ✅ Ja | Einmalig App in Google Cloud Console |
| **Microsoft / Outlook / Teams** | OAuth | ✅ Ja | Einmalig App im Azure Portal |
| **CalDAV** (Troi, Apple iCloud, Nextcloud, …) | Username + Passwort | ↔ Wenn Server es zulässt | Pro User |
| **iCal-Feed** | Öffentliche URL | ❌ Nur Read | Pro User |

---

## 1. Encryption Key (zuerst erledigen!)

Tokens und CalDAV-Passwörter werden mit AES-256-GCM verschlüsselt gespeichert. Du brauchst einen Master-Key.

**Key generieren (im Terminal):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Output kopieren** und in `.env.local` einfügen:
```
CALENDAR_ENCRYPTION_KEY=DEIN_BASE64_KEY_HIER
```

⚠️ **Wichtig:** Wenn Du den Key später änderst, können bereits gespeicherte Tokens nicht mehr entschlüsselt werden — alle Nutzer müssten ihre Kalender neu verbinden. Key sicher aufbewahren (z.B. Password-Manager).

**Migration in Supabase ausführen:**

In Supabase Dashboard → SQL Editor → `supabase/calendar_encryption_migration.sql` ausführen. Fügt die Spalte `last_synced_at` hinzu.

---

## 2. Google Calendar einrichten

### 2.1 Google Cloud Console
1. Gehe zu [console.cloud.google.com](https://console.cloud.google.com)
2. **Neues Projekt anlegen** (oder bestehendes auswählen) — Name z.B. "Vela Calendar"
3. **APIs aktivieren:**
   - Linkes Menü → "APIs & Dienste" → "Bibliothek"
   - Suche: **Google Calendar API** → "Aktivieren"
4. **OAuth Consent Screen einrichten:**
   - "APIs & Dienste" → "OAuth-Zustimmungsbildschirm"
   - User Type: **External** (oder Internal wenn Google Workspace)
   - App-Name: "Vela"
   - User support email: Deine E-Mail
   - Developer contact: Deine E-Mail
   - **Scopes hinzufügen:** `https://www.googleapis.com/auth/calendar`
   - Test users: Deine E-Mail (während Entwicklung)
5. **OAuth Client ID erstellen:**
   - "APIs & Dienste" → "Anmeldedaten" → "Anmeldedaten erstellen" → "OAuth-Client-ID"
   - Application type: **Webanwendung**
   - Name: "Vela Web Client"
   - **Authorized redirect URIs:** Diese URL hinzufügen:
     ```
     https://DEINE-DOMAIN.com/api/auth/google-calendar/callback
     ```
     Für lokales Testen zusätzlich:
     ```
     http://localhost:3000/api/auth/google-calendar/callback
     ```
   - Erstellen → **Client ID + Client Secret kopieren**

### 2.2 In `.env.local`
```
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://DEINE-DOMAIN.com
```

Bei lokalem Testen: `NEXT_PUBLIC_APP_URL=http://localhost:3000`

### 2.3 Testen
Server neustarten → in Vela: Kalender → "+" → "Google" → "Mit Google verbinden". Du wirst zu Google weitergeleitet, gibst Zustimmung, kommst zurück. Fertig.

---

## 3. Microsoft / Outlook / Teams einrichten

### 3.1 Azure Portal
1. Gehe zu [portal.azure.com](https://portal.azure.com)
2. **App registrations** suchen → "+ New registration"
3. Konfiguration:
   - Name: "Vela Calendar"
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (für maximale Kompatibilität)
   - Redirect URI: **Web** → `https://DEINE-DOMAIN.com/api/auth/microsoft/callback`
4. Nach dem Erstellen: **Application (client) ID kopieren**
5. **Client Secret erstellen:**
   - Linkes Menü → "Certificates & secrets" → "+ New client secret"
   - Description: "Vela", Expiry: 24 Monate
   - **Value (nicht Secret ID!) kopieren** — wird nur einmal angezeigt
6. **API Permissions:**
   - Linkes Menü → "API permissions" → "+ Add a permission"
   - Microsoft Graph → Delegated permissions
   - Hinzufügen: `Calendars.ReadWrite`, `offline_access`, `User.Read`
   - "Grant admin consent" klicken (falls Admin)
7. Optional: Für lokales Testen zweite Redirect URI hinzufügen:
   - Authentication → Add URI: `http://localhost:3000/api/auth/microsoft/callback`

### 3.2 In `.env.local`
```
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.3 Testen
Server neustarten → in Vela: Kalender → "+" → "Outlook" → "Mit Microsoft verbinden". Microsoft-Login öffnet sich, Zustimmung, fertig. Teams-Meeting-Links werden automatisch als „Beitreten"-Button erkannt.

---

## 4. CalDAV einrichten (Troi, Apple iCloud, Nextcloud, …)

### Allgemeiner Flow
1. In Vela: Kalender → "+" → "CalDAV"
2. Preset wählen (Troi / Apple / Eigener Server)
3. Server-URL, Benutzername, Passwort eingeben
4. **"Verbinden & Kalender suchen"** klicken
5. Vela durchläuft die CalDAV-Discovery und zeigt alle gefundenen Kalender
6. Auswählen, welche verbunden werden sollen
7. "X Kalender hinzufügen"

### 4.1 Troi
**API-Key generieren (anstelle des Passworts):**
1. In Troi einloggen
2. **Sicherheits-Center** → "API-Keys"
3. Neuen Key erzeugen, Berechtigung "Kalender"
4. Key kopieren — fungiert als Passwort

**In Vela eingeben:**
- Preset: **Troi**
- Server-Adresse: `https://app.troi.software`
- Kalenderpfad: **leer lassen** — wird automatisch ermittelt
- Benutzername: Deine Troi-E-Mail-Adresse
- Passwort: Der **API-Key** (nicht Dein Login-Passwort!)

### 4.2 Apple iCloud
**App-spezifisches Passwort erzeugen:**
1. [appleid.apple.com](https://appleid.apple.com) → Anmelden
2. "Sicherheit" → "App-spezifische Passwörter" → "Generieren"
3. Label: "Vela", Passwort wird angezeigt — kopieren

**In Vela eingeben:**
- Preset: **Apple / iCloud**
- Server-Adresse: `https://caldav.icloud.com`
- Kalenderpfad: leer lassen
- Benutzername: Deine Apple-ID (E-Mail)
- Passwort: Das **app-spezifische Passwort** (nicht Dein Apple-ID-Passwort!)

### 4.3 Nextcloud / Eigener Server
- Preset: **Eigener Server**
- Server-Adresse: z.B. `https://cloud.deine-domain.com`
- Kalenderpfad: optional `/remote.php/dav/calendars/USERNAME/`
- Username/Passwort wie üblich

### Was Vela automatisch tut
Sobald Du auf "Verbinden & Kalender suchen" klickst:
1. PROPFIND auf Server-URL → findet User-Principal
2. PROPFIND auf Principal → findet Calendar-Home
3. PROPFIND mit Depth=1 → listet alle Kalender mit Namen, Farben, Schreibrechten
4. Zeigt Dir die Liste — Du wählst aus

Schreibrechte (↔ Sync vs 🔒 Read-only) werden direkt aus dem Server gelesen. Wenn Dein Provider Schreibzugriff erlaubt, kannst Du Events aus Vela direkt in Troi/iCloud/Nextcloud erstellen.

---

## 5. iCal-Feed (öffentliche Kalender)

Einfachster Weg, externe Kalender ohne Login einzubinden:
1. iCal-URL kopieren (Google Kalender → Einstellungen → Geheime URL im iCal-Format)
2. In Vela: Kalender → "+" → "iCal URL" → URL einfügen
3. Read-only, alle 5 Min. gecached

---

## Troubleshooting

### Google: "redirect_uri_mismatch"
Die in Google Cloud Console eingetragene Redirect URI muss **exakt** zur `NEXT_PUBLIC_APP_URL` passen, inkl. `/api/auth/google-calendar/callback`. Auch http vs. https und Trailing-Slashes zählen.

### Microsoft: "AADSTS50011" (Reply URL mismatch)
Gleiches Problem im Azure Portal — Redirect URI muss zur Vela-Domain passen.

### CalDAV: "Verbindung erfolgreich, aber keine Kalender gefunden"
Der Login funktioniert, aber unter dem angegebenen Pfad gibt es keine Kalender-Sammlung. Versuche:
- Server-URL ohne Pfad eingeben (Vela findet den Calendar-Home automatisch)
- Bei Troi: Checken ob das Konto Kalender-Berechtigung hat

### CalDAV: "401 — Anmeldung fehlgeschlagen"
- Bei Troi: API-Key statt Login-Passwort verwenden
- Bei iCloud: App-spezifisches Passwort verwenden (Standard-Passwort funktioniert nicht)
- Username ist meist die E-Mail-Adresse

### Banner "Kalender konnte nicht synchronisiert werden"
Vela zeigt den genauen Server-Fehler. Häufige Ursachen:
- Token abgelaufen und Refresh fehlgeschlagen → Kalender neu verbinden
- CalDAV-Passwort geändert → Kalender neu verbinden
- Server vorübergehend offline

---

## Datenbank-Migrationen (Übersicht)

In dieser Reihenfolge in Supabase SQL Editor ausführen:
1. `calendar_v2_migration.sql` — Basis-Schema, OAuth-Felder
2. `calendar_caldav_migration.sql` — `caldav_username` Feld
3. `calendar_encryption_migration.sql` — `last_synced_at` Feld
4. `calendar_account_label_migration.sql` — `account_label` Feld (für Multi-Kalender Gruppierung)

---

## Sicherheits-Hinweise

- ✅ Tokens und CalDAV-Passwörter werden mit AES-256-GCM verschlüsselt gespeichert (wenn `CALENDAR_ENCRYPTION_KEY` gesetzt)
- ✅ CalDAV-Anfragen laufen ausschließlich serverseitig (keine CORS-Issues, keine Credentials im Browser)
- ✅ OAuth-Tokens werden automatisch erneuert wenn abgelaufen (Refresh-Token-Flow)
- ✅ Row-Level-Security auf `external_calendars` Tabelle (Multi-Tenant isoliert)
- ⚠️ Encryption-Key sicher aufbewahren — Verlust = alle Tokens unbrauchbar
