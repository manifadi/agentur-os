import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, recoveryEmailHtml } from '../../utils/email';

// Passwort-zurücksetzen-Link per Brevo verschicken.
// KEIN Auth-Guard (User ist ausgeloggt). Anti-Enumeration: bei unbekannter
// E-Mail trotzdem { success: true }, damit man nicht herausfinden kann,
// welche Adressen registriert sind.
export async function POST(req: NextRequest) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL ?? 'https://lkyqohkdxmchrjicvurn.supabase.co';

    if (!serviceRoleKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY ist nicht in .env.local gesetzt.' }, { status: 500 });
    }
    if (!process.env.BREVO_API_KEY) {
        return NextResponse.json({ error: 'BREVO_API_KEY ist nicht in .env.local gesetzt.' }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
        const { email } = await req.json();
        if (!email) {
            return NextResponse.json({ error: 'E-Mail ist erforderlich.' }, { status: 400 });
        }
        const normalizedEmail = String(email).trim().toLowerCase();

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || supabaseUrl;
        // Direkt auf die Reset-Seite — die server-seitig erzeugten Links liefern die
        // Session im URL-Hash (implicit), nicht als ?code. /reset-password nimmt sie auf.
        const redirectTo = `${origin}/reset-password?utm_source=email&utm_medium=email&utm_campaign=password_reset`;

        const { data, error } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email: normalizedEmail,
            options: { redirectTo },
        });

        // Unbekannte Mail / kein Link → maskieren (Anti-Enumeration)
        if (error || !data?.properties?.action_link) {
            console.error('[reset] generateLink (maskiert):', error?.message);
            return NextResponse.json({ success: true });
        }

        const publicBase = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/$/, '');
        const { error: mailErr } = await sendEmail({
            to: normalizedEmail,
            subject: 'Passwort zurücksetzen',
            html: recoveryEmailHtml({ actionLink: data.properties.action_link, logoUrl: `${publicBase}/vela-logo.png` }),
        });
        if (mailErr) console.error('[reset] brevo send failed:', mailErr);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[reset] unhandled error:', e);
        // Auch hier maskieren — Client soll keine Details sehen
        return NextResponse.json({ success: true });
    }
}
