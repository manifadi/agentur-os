import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, isEncrypted, safeDecrypt } from '../crypto';

// 32-Byte-Key (base64) — getKey() liest lazy aus process.env, daher reicht
// das Setzen vor dem ersten Aufruf.
beforeAll(() => {
    process.env.CALENDAR_ENCRYPTION_KEY = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
});

describe('crypto AES-256-GCM', () => {
    it('verschlüsselt und entschlüsselt verlustfrei (Round-Trip)', () => {
        const plain = 'geheimes-oauth-token-123';
        const enc = encrypt(plain);
        expect(enc).not.toBe(plain);
        expect(isEncrypted(enc)).toBe(true);
        expect(decrypt(enc)).toBe(plain);
    });

    it('erzeugt pro Aufruf unterschiedliche Chiffretexte (zufälliger IV)', () => {
        expect(encrypt('abc')).not.toBe(encrypt('abc'));
    });

    it('safeDecrypt lässt Klartext unverändert und behandelt null', () => {
        expect(safeDecrypt('plaintext')).toBe('plaintext');
        expect(safeDecrypt(null)).toBe('');
    });
});
