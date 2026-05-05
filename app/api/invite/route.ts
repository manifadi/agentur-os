import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL ?? 'https://lkyqohkdxmchrjicvurn.supabase.co';

    if (!serviceRoleKey) {
        return NextResponse.json(
            { error: 'SUPABASE_SERVICE_ROLE_KEY ist nicht in .env.local gesetzt. Bitte in den Supabase Project Settings → API den Service Role Key kopieren.' },
            { status: 500 }
        );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email, name, organizationId } = await req.json();

    if (!email || !name || !organizationId) {
        return NextResponse.json({ error: 'email, name und organizationId sind erforderlich.' }, { status: 400 });
    }

    // 1. Prüfen ob Employee bereits existiert
    const { data: existing } = await admin
        .from('employees')
        .select('id')
        .eq('email', email)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits als Mitarbeiter registriert.' }, { status: 409 });
    }

    // 2. Employee-Eintrag vorab anlegen (ohne user_id — wird beim ersten Login verknüpft)
    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const { error: empError } = await admin.from('employees').insert([{
        name,
        email,
        initials,
        role: 'user',
        organization_id: organizationId,
    }]);

    if (empError) {
        return NextResponse.json({ error: 'Mitarbeiter konnte nicht angelegt werden: ' + empError.message }, { status: 500 });
    }

    // 3. Supabase Einladungs-E-Mail senden
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { organization_id: organizationId, name },
        redirectTo: `${req.headers.get('origin')}/auth/callback`,
    });

    if (inviteError) {
        // Employee-Eintrag rückgängig machen
        await admin.from('employees').delete().eq('email', email);
        return NextResponse.json({ error: 'Einladungs-E-Mail konnte nicht gesendet werden: ' + inviteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
