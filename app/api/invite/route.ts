import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, inviteEmailHtml } from '../../utils/email';

export async function POST(req: NextRequest) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL ?? 'https://lkyqohkdxmchrjicvurn.supabase.co';

    if (!serviceRoleKey) {
        return NextResponse.json(
            { error: 'SUPABASE_SERVICE_ROLE_KEY ist nicht in .env.local gesetzt.' },
            { status: 500 }
        );
    }
    if (!process.env.BREVO_API_KEY) {
        return NextResponse.json(
            { error: 'BREVO_API_KEY ist nicht in .env.local gesetzt. Account auf brevo.com → SMTP & API → API Keys.' },
            { status: 500 }
        );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
        const { email, name, organizationId, role } = await req.json();
        if (!email || !name || !organizationId) {
            return NextResponse.json({ error: 'email, name und organizationId sind erforderlich.' }, { status: 400 });
        }

        // ── Auth-Guard: Aufrufer muss Super-Admin oder Admin der Ziel-Org sein ──
        const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 });
        }
        const { data: { user }, error: userErr } = await admin.auth.getUser(token);
        if (userErr || !user) {
            return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
        }
        const { data: caller } = await admin
            .from('employees')
            .select('is_super_admin, role, organization_id')
            .eq('user_id', user.id)
            .maybeSingle();

        const isSuperAdmin = caller?.is_super_admin === true;
        const isOrgAdmin = caller?.role === 'admin' && caller?.organization_id === organizationId;
        if (!isSuperAdmin && !isOrgAdmin) {
            return NextResponse.json({ error: 'Keine Berechtigung, in diese Agentur einzuladen.' }, { status: 403 });
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        // ── Employee-Eintrag idempotent sicherstellen ──
        // (Der Super-Admin-Dialog legt ihn schon per RPC an → hier ggf. nur überspringen)
        const { data: existing } = await admin
            .from('employees')
            .select('id')
            .eq('email', normalizedEmail)
            .eq('organization_id', organizationId)
            .maybeSingle();

        if (!existing) {
            const initials = String(name).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            const { error: empError } = await admin.from('employees').insert([{
                name,
                email: normalizedEmail,
                initials,
                role: role === 'admin' ? 'admin' : 'user',
                organization_id: organizationId,
            }]);
            if (empError) {
                console.error('[invite] employee insert failed:', empError);
                return NextResponse.json({ error: 'Mitarbeiter konnte nicht angelegt werden: ' + empError.message }, { status: 500 });
            }
        }

        // ── Login-Link erzeugen (ohne Supabase-Mail) ──
        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || supabaseUrl;
        // UTM für lückenloses Tracking der Einladungs-Mails (Brevo-Klicks + Analytics)
        const redirectTo = `${origin}/auth/callback?utm_source=email&utm_medium=invite&utm_campaign=team_invite`;

        const generate = async (type: 'invite' | 'magiclink') =>
            admin.auth.admin.generateLink({ type, email: normalizedEmail, options: { redirectTo } });

        // Neuer Nutzer → 'invite' (legt Auth-User an). Existiert er schon → 'magiclink'.
        let linkRes = await generate('invite');
        if (linkRes.error) {
            const msg = (linkRes.error.message || '').toLowerCase();
            if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
                linkRes = await generate('magiclink');
            }
        }
        if (linkRes.error || !linkRes.data?.properties?.action_link) {
            console.error('[invite] generateLink failed:', linkRes.error);
            // Falls vorab neu angelegt → wieder entfernen, damit kein verwaister Eintrag bleibt
            if (!existing) await admin.from('employees').delete().eq('email', normalizedEmail).eq('organization_id', organizationId);
            return NextResponse.json(
                { error: 'Login-Link konnte nicht erzeugt werden: ' + (linkRes.error?.message || 'unbekannt') },
                { status: 500 }
            );
        }

        // ── Mitarbeiter SOFORT mit dem Auth-Account verknüpfen ──
        // generateLink legt den Auth-User an (invite) bzw. liefert ihn (magiclink).
        // Setzen wir user_id hier serverseitig, ist die Org-Zuordnung beim ersten
        // Login bereits vorhanden — der Eingeladene landet direkt im Dashboard statt
        // auf dem Auswahl-Screen. (Der nachträgliche E-Mail-Abgleich war unzuverlässig.)
        const invitedUserId = linkRes.data.user?.id;
        if (invitedUserId) {
            await admin
                .from('employees')
                .update({ user_id: invitedUserId })
                .eq('email', normalizedEmail)
                .eq('organization_id', organizationId)
                .is('user_id', null);
        }

        // ── Org-Name für die Mail ──
        const { data: org } = await admin.from('organizations').select('name').eq('id', organizationId).maybeSingle();

        // Logo muss von einer öffentlich erreichbaren URL kommen (Mail-Clients laden kein localhost).
        // Daher NEXT_PUBLIC_APP_URL (Vercel-URL) bevorzugen, sonst Request-Origin.
        const publicBase = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, '');
        const logoUrl = `${publicBase}/vela-logo.png`;

        // ── Branded Mail über Brevo ──
        const { error: mailErr } = await sendEmail({
            to: normalizedEmail,
            subject: `Einladung zu ${org?.name || 'Vela'}`,
            html: inviteEmailHtml({ name, agencyName: org?.name, actionLink: linkRes.data.properties.action_link, logoUrl }),
        });

        if (mailErr) {
            console.error('[invite] brevo send failed:', mailErr);
            return NextResponse.json({ error: 'E-Mail konnte nicht gesendet werden: ' + mailErr }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[invite] unhandled error:', e);
        return NextResponse.json({ error: 'Server-Fehler: ' + (e?.message || String(e)) }, { status: 500 });
    }
}
