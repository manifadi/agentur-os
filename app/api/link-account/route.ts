import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Verknüpft den eingeloggten Account zuverlässig mit seinem Mitarbeiter-Eintrag.
//
// Läuft mit dem Service-Role-Key (umgeht RLS) und braucht KEINE DB-Migration:
// - liest den User aus dem mitgeschickten Access-Token (id + email)
// - setzt employees.user_id für alle noch unverknüpften Zeilen dieser E-Mail
// - liefert die Organisation zurück
//
// Ersetzt die fragile Kette aus link_invited_employee-RPC (muss manuell deployed
// sein) + generateLink-user-Feld (bei magiclink nicht immer vorhanden).
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

        // Noch unverknüpfte Mitarbeiter-Zeilen dieser E-Mail mit dem Account verknüpfen.
        // ilike = case-insensitiv, falls Altdaten anders geschrieben sind.
        await admin
            .from('employees')
            .update({ user_id: user.id })
            .ilike('email', email)
            .is('user_id', null);

        // Organisation des Accounts ermitteln (jetzt via user_id sichtbar).
        const { data: emp } = await admin
            .from('employees')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

        return NextResponse.json({
            linked: !!emp?.organization_id,
            organizationId: emp?.organization_id ?? null,
        });
    } catch (e: any) {
        console.error('[link-account] error:', e);
        return NextResponse.json({ error: 'Server-Fehler: ' + (e?.message || String(e)) }, { status: 500 });
    }
}
