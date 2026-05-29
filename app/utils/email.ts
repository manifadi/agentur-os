// ─────────────────────────────────────────────────────────────
// Zentraler E-Mail-Versand über Brevo (Transactional API, server-side).
// Brauchst KEINE eigene Domain: in Brevo reicht ein verifizierter
// Einzel-Absender (z.B. deine Gmail-Adresse).
// .env.local:
//   BREVO_API_KEY      — Brevo → SMTP & API → API Keys
//   BREVO_SENDER_EMAIL — verifizierte Absender-Adresse (Senders)
//   BREVO_SENDER_NAME  — Anzeigename (optional, Default "Vela")
// ─────────────────────────────────────────────────────────────

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || '';
export const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Vela';

export function isEmailConfigured(): boolean {
    return !!process.env.BREVO_API_KEY && !!BREVO_SENDER_EMAIL;
}

interface SendArgs {
    to: string;
    subject: string;
    html: string;
}

// Gibt { error } zurück (null = erfolgreich), damit Aufrufer sauber reagieren können.
export async function sendEmail({ to, subject, html }: SendArgs): Promise<{ error: string | null }> {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return { error: 'BREVO_API_KEY ist nicht in .env.local gesetzt.' };
    if (!BREVO_SENDER_EMAIL) return { error: 'BREVO_SENDER_EMAIL ist nicht in .env.local gesetzt.' };

    try {
        const res = await fetch(BREVO_ENDPOINT, {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'accept': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
                to: [{ email: to }],
                subject,
                htmlContent: html,
            }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({} as any));
            return { error: body?.message || `Brevo-Fehler (HTTP ${res.status})` };
        }
        return { error: null };
    } catch (e: any) {
        return { error: e?.message || 'Unbekannter Brevo-Fehler' };
    }
}

// ─────────────────────────────────────────────────────────────
// Vorlage: Einladungs-Mail (deutsch, inline-styles für Mail-Clients)
// ─────────────────────────────────────────────────────────────

export function inviteEmailHtml(opts: {
    name?: string;
    agencyName?: string;
    actionLink: string;
    logoUrl?: string;
}): string {
    const greeting = opts.name ? `Hallo ${escapeHtml(opts.name)},` : 'Hallo,';
    const agency = opts.agencyName ? escapeHtml(opts.agencyName) : 'deiner Agentur';
    const brand = opts.logoUrl
        ? `<img src="${opts.logoUrl}" alt="Vela" height="30" style="height:30px; width:auto; display:block; border:0;" />`
        : `<div style="font-size:20px; font-weight:800; color:#111827; letter-spacing:-0.02em;">Vela</div>`;

    return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f5f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7; padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #ececef;">
        <tr><td style="padding:28px 32px 20px; border-bottom:1px solid #f3f4f6;">
          ${brand}
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <p style="font-size:15px; color:#111827; line-height:1.6; margin:0 0 12px;">${greeting}</p>
          <p style="font-size:15px; color:#374151; line-height:1.6; margin:0 0 24px;">
            du wurdest zu <strong>${agency}</strong> auf Vela eingeladen. Mit dem Button unten meldest du dich
            ohne Passwort an und legst beim ersten Login dein Konto fest.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:12px; background:#111827;">
              <a href="${opts.actionLink}" target="_blank"
                 style="display:inline-block; padding:13px 28px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">
                Jetzt anmelden
              </a>
            </td></tr>
          </table>
          <p style="font-size:12px; color:#9ca3af; line-height:1.6; margin:0 0 8px;">
            Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
          </p>
          <p style="font-size:12px; color:#6b7280; line-height:1.5; margin:0 0 24px; word-break:break-all;">
            ${opts.actionLink}
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 28px; border-top:1px solid #f3f4f6;">
          <p style="font-size:11px; color:#9ca3af; line-height:1.5; margin:0;">
            Du hast diese Einladung nicht erwartet? Dann ignoriere diese E-Mail einfach.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
