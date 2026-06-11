// ─────────────────────────────────────────────────────────────
// Platzhalter für Angebots-/Rechnungstexte.
// Vorlagen können Tokens wie [anrede] [vorname] [nachname] enthalten,
// die mit den Daten des Empfängers (ClientContact) bzw. des Kunden
// (Client) gefüllt werden — im Textfeld beim Anwenden einer Vorlage
// UND als Catch-all beim PDF-Rendern.
// ─────────────────────────────────────────────────────────────
import { ClientContact, Client } from '../types';

export function splitName(name?: string | null): { firstName: string; lastName: string } {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** "Herr" | "Frau" | "" — das reine Anrede-Wort. */
export function salutationWord(salutation?: string | null): string {
    if (salutation === 'herr') return 'Herr';
    if (salutation === 'frau') return 'Frau';
    return '';
}

/** Vollständige, grammatikalisch korrekte Grußformel inkl. Komma. */
export function buildGreeting(contact?: ClientContact | null): string {
    if (!contact || !contact.name?.trim()) return 'Sehr geehrte Damen und Herren,';
    const { lastName } = splitName(contact.name);
    const surname = lastName || contact.name.trim();
    if (contact.salutation === 'frau') return `Sehr geehrte Frau ${surname},`;
    if (contact.salutation === 'herr') return `Sehr geehrter Herr ${surname},`;
    return `Sehr geehrte/r ${contact.name.trim()},`;
}

/**
 * Setzt/aktualisiert die Anrede-Zeile am Anfang eines Textes, ohne den Rest
 * anzutasten. Wird beim Wechsel des Empfängers getriggert.
 *  - Leerer Text → nur die Grußformel.
 *  - Beginnt der Text mit einer erkennbaren Anrede ("Sehr geehrte…", "Hallo…",
 *    "Guten Tag…", "Liebe…"), wird ausschließlich diese erste Zeile ersetzt.
 *  - Andernfalls bleibt der Text unverändert (kein Überschreiben eigener Texte).
 */
export function applyGreeting(text: string, greeting: string): string {
    const t = text ?? '';
    if (t.trim() === '') return greeting;
    const nl = t.indexOf('\n');
    const firstLine = nl === -1 ? t : t.slice(0, nl);
    if (/^\s*(sehr geehrte|hallo|guten tag|liebe[rs]?\b)/i.test(firstLine)) {
        return nl === -1 ? greeting : greeting + t.slice(nl);
    }
    return t;
}

/**
 * Ersetzt Platzhalter im Text. Unbekannte Tokens bleiben unangetastet,
 * damit Tippfehler sichtbar bleiben. Deutsche und englische Aliase werden
 * unterstützt ([nachname] == [lastname]).
 */
export function fillPlaceholders(text: string, contact?: ClientContact | null, client?: Client | null): string {
    if (!text || text.indexOf('[') === -1) return text || '';

    const { firstName, lastName } = splitName(contact?.name);
    const fullName = contact?.name?.trim() || client?.full_name || client?.name || '';
    const company = client?.full_name || client?.name || '';
    const today = new Date().toLocaleDateString('de-DE');

    const map: Record<string, string> = {
        anrede: salutationWord(contact?.salutation),
        gender: salutationWord(contact?.salutation),
        vorname: firstName,
        firstname: firstName,
        nachname: lastName,
        lastname: lastName,
        name: fullName,
        grußformel: buildGreeting(contact),
        grussformel: buildGreeting(contact),
        anredezeile: buildGreeting(contact),
        salutation: buildGreeting(contact),
        email: contact?.email || '',
        mail: contact?.email || '',
        telefon: contact?.phone || '',
        phone: contact?.phone || '',
        rolle: contact?.role || '',
        position: contact?.role || '',
        firma: company,
        kunde: company,
        company: company,
        datum: today,
        date: today,
    };

    return text.replace(/\[([a-zA-ZäöüÄÖÜß_]+)\]/g, (whole, key: string) => {
        const v = map[key.toLowerCase()];
        return v !== undefined ? v : whole;
    });
}

/** Für UI-Hinweise: die unterstützten Platzhalter (kompakt). */
export const PLACEHOLDER_HINT = '[anrede] [vorname] [nachname] [name] [grußformel] [email] [telefon] [firma] [datum]';
