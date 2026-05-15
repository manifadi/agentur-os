import crypto from 'crypto';

/**
 * AES-256-GCM encryption for sensitive data at rest (OAuth tokens, CalDAV passwords).
 *
 * Format: `enc:v1:<iv-base64>:<authtag-base64>:<ciphertext-base64>`
 *
 * Setup: generate a 32-byte base64 key and put it in `.env.local`:
 *   CALENDAR_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
 *
 * If the env var is missing, encryption is a no-op (returns plaintext) and a
 * warning is logged. This keeps the app functional during transition while
 * signaling that production needs the key set.
 */

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

let cachedKey: Buffer | null | undefined;
let warnedMissing = false;

function getKey(): Buffer | null {
    if (cachedKey !== undefined) return cachedKey;
    const raw = process.env.CALENDAR_ENCRYPTION_KEY;
    if (!raw) {
        if (!warnedMissing) {
            console.warn('[crypto] CALENDAR_ENCRYPTION_KEY not set — tokens stored as plaintext. Set it in .env.local for production.');
            warnedMissing = true;
        }
        cachedKey = null;
        return null;
    }
    try {
        const buf = Buffer.from(raw, 'base64');
        if (buf.length !== 32) {
            console.error('[crypto] CALENDAR_ENCRYPTION_KEY must decode to exactly 32 bytes (got ' + buf.length + ').');
            cachedKey = null;
            return null;
        }
        cachedKey = buf;
        return buf;
    } catch (e) {
        console.error('[crypto] CALENDAR_ENCRYPTION_KEY is not valid base64:', e);
        cachedKey = null;
        return null;
    }
}

export function encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;
    const key = getKey();
    if (!key) return plaintext; // graceful degradation

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(value: string): string {
    if (!value || !value.startsWith(PREFIX)) return value;
    const key = getKey();
    if (!key) {
        console.error('[crypto] Cannot decrypt: CALENDAR_ENCRYPTION_KEY missing.');
        return value;
    }
    try {
        const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
        const iv = Buffer.from(ivB64, 'base64');
        const tag = Buffer.from(tagB64, 'base64');
        const data = Buffer.from(dataB64, 'base64');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (e) {
        console.error('[crypto] Decryption failed:', e);
        return value;
    }
}

/** Decrypts if encrypted, returns as-is if plaintext (for legacy data migration). */
export function safeDecrypt(value: string | null | undefined): string {
    if (!value) return '';
    return decrypt(value);
}

export function isEncrypted(value: string | null | undefined): boolean {
    return !!value && value.startsWith(PREFIX);
}
