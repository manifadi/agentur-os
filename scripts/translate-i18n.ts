/**
 * Auto-Übersetzung des i18n-Katalogs de → en via DeepL.
 *
 * Übersetzt NUR Schlüssel, die in en.json fehlen oder leer sind (inkrementell,
 * günstig). Bestehende englische Texte bleiben unangetastet — manuelle
 * Korrekturen gehen also nicht verloren.
 *
 * Nutzung:
 *   DEEPL_API_KEY=xxxxx npx tsx scripts/translate-i18n.ts
 *
 * Free-Tier-Keys enden auf ":fx" → automatisch api-free.deepl.com.
 * Ohne Key bricht das Script sauber ab (Katalog kann auch manuell gepflegt werden).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type Json = { [k: string]: string | Json };

const LOCALES_DIR = join(process.cwd(), 'app', 'i18n', 'locales');
const DE = join(LOCALES_DIR, 'de.json');
const EN = join(LOCALES_DIR, 'en.json');

function flatten(obj: Json, prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === 'string') out[key] = v;
        else Object.assign(out, flatten(v, key));
    }
    return out;
}

function setDeep(obj: Json, path: string, value: string) {
    const parts = path.split('.');
    let cur: any = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
}

async function deeplTranslate(texts: string[], key: string): Promise<string[]> {
    const host = key.trim().endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const res = await fetch(`${host}/v2/translate`, {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: texts,
            source_lang: 'DE',
            target_lang: 'EN',
            // UI-Strings: Platzhalter wie {{name}} nicht übersetzen.
            ignore_tags: ['x'],
            tag_handling: 'xml',
        }),
    });
    if (!res.ok) {
        throw new Error(`DeepL HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data.translations.map((t: any) => t.text);
}

// {{var}} → <x>{{var}}</x> schützen, danach zurück.
const protect = (s: string) => s.replace(/(\{\{[^}]+\}\})/g, '<x>$1</x>');
const unprotect = (s: string) => s.replace(/<x>(\{\{[^}]+\}\})<\/x>/g, '$1');

async function main() {
    const key = process.env.DEEPL_API_KEY;
    if (!key) {
        console.error('DEEPL_API_KEY nicht gesetzt. Abbruch (Katalog kann auch manuell gepflegt werden).');
        process.exit(1);
    }

    const de = JSON.parse(readFileSync(DE, 'utf8')) as Json;
    const en = JSON.parse(readFileSync(EN, 'utf8')) as Json;
    const deFlat = flatten(de);
    const enFlat = flatten(en);

    const missing = Object.keys(deFlat).filter(k => !enFlat[k] || enFlat[k].trim() === '');
    if (missing.length === 0) {
        console.log('Nichts zu übersetzen — en.json ist vollständig. ✓');
        return;
    }

    console.log(`Übersetze ${missing.length} fehlende Schlüssel de → en …`);
    const sources = missing.map(k => protect(deFlat[k]));

    // In Batches von 50 (DeepL-Limit pro Request ist großzügig, aber sicher ist sicher).
    const translated: string[] = [];
    for (let i = 0; i < sources.length; i += 50) {
        const batch = sources.slice(i, i + 50);
        translated.push(...(await deeplTranslate(batch, key)));
    }

    missing.forEach((k, i) => setDeep(en, k, unprotect(translated[i])));
    writeFileSync(EN, JSON.stringify(en, null, 2) + '\n', 'utf8');
    console.log(`Fertig — ${missing.length} Schlüssel nach en.json geschrieben. ✓`);
}

main().catch(e => { console.error(e); process.exit(1); });
