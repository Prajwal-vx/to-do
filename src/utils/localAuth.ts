const ACCOUNT_KEY = 'taskflow_local_account_v1';
const SESSION_KEY = 'taskflow_local_session_v1';
const ITERATIONS = 210_000;

interface LocalAccount {
  name: string;
  email: string;
  salt: string;
  passwordHash: string;
  iterations: number;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function hashPassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure sign-in is unavailable in this browser. Open the app using its HTTPS address.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBuffer = new Uint8Array(salt).buffer as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuffer, iterations, hash: 'SHA-256' }, material, 256);
  return new Uint8Array(bits);
}

function readAccount(): LocalAccount | null {
  try {
    const value = localStorage.getItem(ACCOUNT_KEY);
    if (!value) return null;
    const account = JSON.parse(value) as Partial<LocalAccount>;
    if (typeof account.name !== 'string' || typeof account.email !== 'string' || typeof account.salt !== 'string' || typeof account.passwordHash !== 'string' || typeof account.iterations !== 'number') return null;
    return account as LocalAccount;
  } catch {
    throw new Error('This browser cannot access saved sign-in details. Enable site storage and try again.');
  }
}

export function hasLocalAccount(): boolean {
  return Boolean(readAccount());
}

export function hasLocalSession(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === 'signed-in' || localStorage.getItem(SESSION_KEY) === 'signed-in'; }
  catch { return false; }
}

function beginSession(remember = false): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, 'signed-in');
  }
  catch { throw new Error('This browser could not start a sign-in session. Enable site storage and try again.'); }
}

export async function createLocalAccount(name: string, email: string, password: string): Promise<void> {
  if (readAccount()) throw new Error('An account already exists on this device. Please sign in.');
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure sign-in is unavailable in this browser. Open the app using its HTTPS address.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt, ITERATIONS);
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({
      name: name.trim(), email: email.trim().toLowerCase(), salt: bytesToHex(salt),
      passwordHash: bytesToHex(hash), iterations: ITERATIONS,
    } satisfies LocalAccount));
  } catch {
    throw new Error('Could not save this account. Check available browser storage and try again.');
  }
  beginSession();
}

export async function signInLocalAccount(email: string, password: string, remember = false): Promise<void> {
  const account = readAccount();
  if (!account) throw new Error('No account is set up on this device yet.');
  const matchesEmail = email.trim().toLowerCase() === account.email;
  const candidate = await hashPassword(password, hexToBytes(account.salt), account.iterations);
  const expected = hexToBytes(account.passwordHash);
  let difference = candidate.length ^ expected.length;
  for (let i = 0; i < Math.max(candidate.length, expected.length); i++) {
    difference |= (candidate[i] || 0) ^ (expected[i] || 0);
  }
  if (!matchesEmail || difference !== 0) throw new Error('Email or password is incorrect.');
  beginSession(remember);
}

export function getLocalAccountProfile(): { name: string; email: string } | null {
  const account = readAccount();
  return account ? { name: account.name, email: account.email } : null;
}

export function updateLocalAccountEmail(email: string): void {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return;
  const account = readAccount();
  if (!account) return;
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ ...account, email: normalizedEmail }));
  } catch {
    // The editable profile email remains available even if account metadata cannot be updated.
  }
}

export function signOutLocalAccount(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch { /* The sign-in will expire when the tab closes. */ }
}
