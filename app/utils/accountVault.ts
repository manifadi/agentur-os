// ─────────────────────────────────────────────────────────────
// Account-Vault: speichert die Sessions mehrerer Agentur-Logins
// lokal, damit man ohne erneutes Anmelden zwischen ihnen wechseln
// kann. Tokens liegen in localStorage — dieselbe Mechanik, die
// Supabase ohnehin für die aktive Session nutzt.
// ─────────────────────────────────────────────────────────────

export interface StoredAccount {
    id: string;            // Supabase auth user id
    email: string;
    accessToken: string;
    refreshToken: string;
    agencyName?: string;
    logoUrl?: string | null;
    userName?: string;
    updatedAt: number;
}

const KEY = 'vela:accounts:v1';
const CHANGE_EVENT = 'vela-accounts-changed';

function read(): StoredAccount[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function write(accounts: StoredAccount[]) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(accounts));
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    } catch {
        /* localStorage nicht verfügbar — ignorieren */
    }
}

export function getAccounts(): StoredAccount[] {
    // Neueste zuerst
    return read().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Session einfügen/aktualisieren. Bestehende Meta-Felder bleiben erhalten.
export function upsertAccount(account: {
    id: string;
    email: string;
    accessToken: string;
    refreshToken: string;
}): void {
    const accounts = read();
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
        accounts[idx] = { ...accounts[idx], ...account, updatedAt: Date.now() };
    } else {
        accounts.push({ ...account, updatedAt: Date.now() });
    }
    write(accounts);
}

// Anzeige-Infos (Agenturname, Logo, Nutzername) nachträglich ergänzen.
export function updateAccountMeta(id: string, meta: Partial<Pick<StoredAccount, 'agencyName' | 'logoUrl' | 'userName'>>): void {
    const accounts = read();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx < 0) return;
    const next = { ...accounts[idx], ...meta };
    // Kein unnötiges Schreiben, wenn sich nichts geändert hat
    if (next.agencyName === accounts[idx].agencyName
        && next.logoUrl === accounts[idx].logoUrl
        && next.userName === accounts[idx].userName) return;
    accounts[idx] = next;
    write(accounts);
}

export function removeAccount(id: string): void {
    const accounts = read().filter(a => a.id !== id);
    write(accounts);
}

export function subscribeAccounts(cb: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = () => cb();
    window.addEventListener(CHANGE_EVENT, handler);
    // 'storage' fängt Änderungen aus anderen Tabs ab
    window.addEventListener('storage', handler);
    return () => {
        window.removeEventListener(CHANGE_EVENT, handler);
        window.removeEventListener('storage', handler);
    };
}
