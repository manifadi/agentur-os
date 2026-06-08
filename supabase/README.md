# Supabase-Migrationen

Alle `.sql`-Dateien hier werden **manuell im Supabase SQL Editor** ausgeführt
(kein automatisches Migration-Tool). Alle Migrationen sind idempotent
(`CREATE OR REPLACE`, `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

## Tracking — was ist schon eingespielt?

Damit niemand raten muss, ob eine Migration schon lief, gibt es eine
Tracking-Tabelle.

1. **Einmalig** `_migrations_tracking.sql` ausführen (legt `schema_migrations`
   an + markiert die bisher bestehenden Migrationen als eingespielt).
2. **Stand prüfen** jederzeit:
   ```sql
   SELECT name, applied_at FROM public.schema_migrations ORDER BY applied_at;
   ```

## Konvention für NEUE Migrationen

Jede neue Migrationsdatei endet mit ihrer Selbst-Registrierung (Beispiel siehe
`team_calendar_visibility_migration.sql`):

```sql
INSERT INTO public.schema_migrations (name) VALUES ('<dateiname_ohne_.sql>')
  ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';  -- bei neuen RPCs/Tabellen, sonst sieht PostgREST sie nicht
```

## Reihenfolge (für ein frisches Setup)

Die meisten Migrationen sind unabhängig; die Grundlage zuerst:

1. `rls_migration` — Multi-Tenancy/RLS-Fundament (`get_my_organization_id()`, Policies)
2. `realtime_publication_migration` — Realtime-Publication für Live-Tabellen
3. Feature-Migrationen (Reihenfolge untereinander unkritisch):
   - Projekte: `add_project_links`, `add_external_positions`, `add_allocation_status`, `add_missing_project_status_values`
   - Mitarbeiter: `employees_weekly_hours_migration`, `employees_weekly_schedule_migration`
   - Abwesenheiten: `absences_migration`
   - Kalender: `calendar_v2_migration` → `calendar_caldav_migration` → `calendar_account_label_migration` → `calendar_encryption_migration` → `team_calendar_visibility_migration`
   - Einladung/Signup: `invite_migration`, `self_registration_migration`
   - Feedback: `feedback_migration`
4. Super-Admin: `super_admin_migration` → `super_admin_patch_*` (backup, backups_v2, restore, rls, fixes, fixes_v2)
5. `security_hardening_migration` — Pre-Pilot-Audit-Fixes (zuletzt, baut auf allem auf)

## Fallen (aus CLAUDE.md)

- **Volatility**: `CREATE OR REPLACE FUNCTION` übernimmt die bestehende
  `VOLATILE`/`STABLE`-Eigenschaft. Zum Ändern erst `DROP`, dann neu erstellen.
- **Deadlocks**: Mehrere `ALTER TABLE` in EINER Transaktion können sich mit der
  laufenden App (PostgREST) verklemmen. Jede Tabelle in eigener
  `BEGIN; SET LOCAL lock_timeout='5s'; ALTER …; COMMIT;`-Transaktion ändern
  (siehe `team_calendar_visibility_migration.sql`).
