import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Verknüpft den eingeloggten Account zuverlässig mit seinem Mitarbeiter-Eintrag.
//
// Läuft mit dem Service-Role-Key (umgeht RLS) und braucht KEINE DB-Migration:
// - liest den User aus dem mitgeschickten Access-Token (id + email)
// - ist der Account schon verknüpft → gibt direkt die Organisation zurück
// - sonst wird genau EINE offene Mitarbeiter-Zeile dieser E-Mail verknüpft
// - überzählige unverknüpfte Duplikat-Zeilen (aus Alt-Tests) werden best-effort
//   aufgeräumt, damit .single()-Queries nicht an Mehrfachzeilen scheitern (406)
//
// Ersetzt die fragile Kette aus link_invited_employee-RPC (muss manuell deployed
// sein, kollidiert bei Duplikaten mit dem user_id-Unique-Constraint → 409) und dem
// generateLink-user-Feld (bei magiclink nicht immer vorhanden).
export async function POST(req: NextRequest) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL ?? 'https://lkyqohkdxmchrjicvurn.supabase.co';

    if (!serviceRoleKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt.' }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
        const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });
        }

        const { data: { user }, error: userErr } = await admin.auth.getUser(token);
        if (userErr || !user?.email) {
            return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
        }

        const email = user.email.trim().toLowerCase();

        // 1) Schon verknüpft? (user_id ist eindeutig → genau eine Zeile)
        const { data: linked } = await admin
            .from('employees')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

        if (linked?.organization_id) {
            // Aufräumen: überzählige, nie aktivierte Einladungs-Duplikate derselben
            // E-Mail entfernen (best-effort, FK-Fehler ignorieren).
            await admin.from('employees').delete().ilike('email', email).is('user_id', null);
            return NextResponse.json({ linked: true, organizationId: linked.organization_id });
        }

        // 2) Noch nicht verknüpft → genau EINE offene Zeile dieser E-Mail nehmen.
        const { data: candidates } = await admin
            .from('employees')
            .select('id, organization_id')
            .ilike('email', email)
            .is('user_id', null)
            .order('id', { ascending: true });

        const candidate = candidates?.[0];
        if (!candidate) {
            return NextResponse.json({ linked: false, organizationId: null });
        }

        // Nur diese eine Zeile verknüpfen (gezielt per id → kein Mehrfach-Update-Konflikt).
        const { error: updErr } = await admin
            .from('employees')
            .update({ user_id: user.id })
            .eq('id', candidate.id);

        if (updErr) {
            console.error('[link-account] update failed:', updErr);
            return NextResponse.json({ linked: false, organizationId: null });
        }

        // Verbleibende offene Duplikate dieser E-Mail aufräumen (best-effort).
        await admin.from('employees').delete().ilike('email', email).is('user_id', null);

        return NextResponse.json({ linked: true, organizationId: candidate.organization_id });
    } catch (e: any) {
        console.error('[link-account] error:', e);
        return NextResponse.json({ error: 'Server-Fehler: ' + (e?.message || String(e)) }, { status: 500 });
    }
}
