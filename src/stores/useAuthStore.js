// src/stores/useAuthStore.js — SIPAMDAL
// Migrasi dari: auth.js (window.__FB style)
// Perubahan:
//   - Semua fungsi helper auth tetap diekspor (hashPin, verifyPinFS, dll)
//   - Akses Firebase via import langsung (bukan window.__FB)
//   - State login (currentUser, isAdmin, dll) pindah ke Zustand store
//   - recordLogin & auditAction pakai writeAuditLog dari firebase.js
//   - window.__FB dihapus sepenuhnya

import { create } from 'zustand';
import {
  db,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  writeAuditLog,
} from '../firebase/firebase.js';
import { ALL_MEMBERS } from '../utils/utils.js';

// ── Default PINs ──────────────────────────────────────────────────────────────
export const DEFAULT_PINS = {};
ALL_MEMBERS.forEach(m => { DEFAULT_PINS[m.name] = '123456'; });
DEFAULT_PINS['Pimpinan'] = '111111';
DEFAULT_PINS['Admin']    = '000000';

export const DEFAULT_PIN_SET = new Set(['123456', '000000', '111111']);

// ── [F1-01] PIN Hashing — PBKDF2-SHA256 dengan random salt ───────────────────
function _genSalt() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export async function hashPin(pin, saltB64) {
  const enc    = new TextEncoder();
  const salt   = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMat, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

// ── Firestore PIN helpers ─────────────────────────────────────────────────────

export async function isPinDefaultForUser(name) {
  try {
    const snap = await getDoc(doc(db, 'sipamdal_pins', name));
    if (snap.exists()) return snap.data().isPinDefault === true;
    return true; // dokumen belum ada → masih default
  } catch { return false; }
}

export async function markPinChanged(name) {
  try {
    await setDoc(doc(db, 'sipamdal_pins', name), { isPinDefault: false }, { merge: true });
  } catch {}
}

export async function savePinWithDefaultFlag(name, pin, isDefault = false) {
  try {
    const pinSalt = _genSalt();
    const pinHash = await hashPin(pin, pinSalt);
    await setDoc(doc(db, 'sipamdal_pins', name), {
      pinHash, pinSalt,
      isPinDefault: isDefault,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.error('[savePinWithDefaultFlag] Gagal menyimpan PIN:', e);
    window.dispatchEvent(new CustomEvent('sipamdal_error', {
      detail: { msg: 'Gagal menyimpan PIN. Pastikan koneksi internet tersedia dan coba lagi.' },
    }));
  }
}

export async function savePinToFS(name, pin) {
  const pinSalt = _genSalt();
  const pinHash = await hashPin(pin, pinSalt);
  await setDoc(doc(db, 'sipamdal_pins', name), {
    pinHash, pinSalt,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function getPinFromFS(name) {
  try {
    const snap = await getDoc(doc(db, 'sipamdal_pins', name));
    if (snap.exists()) {
      const data = snap.data();
      if (data.pinHash && data.pinSalt)
        return { isHash: true, value: data.pinHash, salt: data.pinSalt };
      if (data.pinHash && !data.pinSalt)
        return { isHash: true, value: data.pinHash, salt: null, legacySalt: true, name };
      if (data.pin)
        return { isHash: false, value: data.pin };
    }
  } catch {}
  return null;
}

export async function verifyPinFS(name, inputPin) {
  const stored = await getPinFromFS(name);
  if (!stored) return null;

  if (stored.isHash) {
    if (stored.legacySalt) {
      // [H4-MIGRATION] Legacy static salt — verifikasi sekali lalu migrate
      const legacySaltB64 = btoa(name + '_sipamdal_2026');
      const inputHash     = await hashPin(inputPin, legacySaltB64);
      if (inputHash === stored.value) {
        savePinToFS(name, inputPin).catch(() => {});
        return true;
      }
      return false;
    }
    const inputHash = await hashPin(inputPin, stored.salt);
    return inputHash === stored.value;
  }

  // Legacy plaintext — verifikasi lalu migrate
  if (inputPin === stored.value) {
    savePinToFS(name, inputPin).catch(() => {});
    return true;
  }
  return false;
}

// ── [LOGIN-HANG-FIX] Timeout guard ────────────────────────────────────────────
export function withTimeout(promise, ms = 5000, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ── [H4-MIGRATION] Migrasi PIN legacy ────────────────────────────────────────
export async function runPinMigration() {
  const snap   = await getDocs(collection(db, 'sipamdal_pins'));
  const result = { migrated: [], skipped: [], errors: [] };
  await Promise.all(snap.docs.map(async (d) => {
    const name = d.id;
    const data = d.data();
    try {
      if (data.pinHash && data.pinSalt) {
        result.skipped.push({ name, reason: 'sudah modern' });
      } else if (data.pin) {
        const pinSalt = _genSalt();
        const pinHash = await hashPin(data.pin, pinSalt);
        await setDoc(doc(db, 'sipamdal_pins', name), {
          pinHash, pinSalt,
          updatedAt: new Date().toISOString(),
          pin: null,
        }, { merge: true });
        result.migrated.push({ name, from: 'plaintext' });
      } else if (data.pinHash && !data.pinSalt) {
        result.skipped.push({ name, reason: 'static-salt (migrate saat login)' });
      } else {
        result.skipped.push({ name, reason: 'format tidak dikenal' });
      }
    } catch (e) {
      result.errors.push({ name, error: e.message || String(e) });
    }
  }));
  return result;
}

// ── Haptic feedback ───────────────────────────────────────────────────────────
export function hapticPin(type = 'tap') {
  if (!navigator.vibrate) return;
  if (type === 'tap')    navigator.vibrate(25);
  else if (type === 'ok')     navigator.vibrate([40, 30, 80]);
  else if (type === 'error')  navigator.vibrate([80, 60, 80, 60, 120]);
  else if (type === 'locked') navigator.vibrate([200, 100, 200, 100, 200]);
}

// ── PIN Lockout ───────────────────────────────────────────────────────────────
export const PIN_MAX_ATTEMPTS = 3;
export const PIN_COOLDOWN_MS  = 5 * 60 * 1000;

export function getPinAttemptKey(name) { return `pin_attempts_${name}`; }
export function getPinLockoutKey(name) { return `pin_lockout_${name}`;  }

async function _writeLockoutFS(name, until, attempts) {
  try {
    await setDoc(doc(db, 'sipamdal_pins', name), {
      lockoutUntil: until,
      failedAttempts: attempts,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch {}
}

export function getPinCooldownSecs(name) {
  try {
    const until = parseInt(localStorage.getItem(getPinLockoutKey(name)) || '0', 10);
    const secs  = Math.ceil((until - Date.now()) / 1000);
    return secs > 0 ? secs : 0;
  } catch { return 0; }
}

export function getPinAttempts(name) {
  try { return parseInt(localStorage.getItem(getPinAttemptKey(name)) || '0', 10); }
  catch { return 0; }
}

export function recordPinFailure(name) {
  try {
    const attempts = getPinAttempts(name) + 1;
    localStorage.setItem(getPinAttemptKey(name), String(attempts));
    if (attempts >= PIN_MAX_ATTEMPTS) {
      const until = Date.now() + PIN_COOLDOWN_MS;
      localStorage.setItem(getPinLockoutKey(name), String(until));
      localStorage.setItem(getPinAttemptKey(name), '0');
      _writeLockoutFS(name, new Date(until).toISOString(), 0);
      return { locked: true, attemptsLeft: 0, cooldownSecs: PIN_COOLDOWN_MS / 1000 };
    }
    _writeLockoutFS(name, null, attempts);
    return { locked: false, attemptsLeft: PIN_MAX_ATTEMPTS - attempts, cooldownSecs: 0 };
  } catch { return { locked: false, attemptsLeft: 1, cooldownSecs: 0 }; }
}

export function resetPinAttempts(name) {
  try {
    localStorage.removeItem(getPinAttemptKey(name));
    localStorage.removeItem(getPinLockoutKey(name));
  } catch {}
  _writeLockoutFS(name, null, 0);
}

export function fmtCooldown(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── WebAuthn Biometric Helpers ────────────────────────────────────────────────
const _BIO_KEY = 'sipamdal_bio_creds';
function _bioGetAll() {
  try { return JSON.parse(localStorage.getItem(_BIO_KEY) || '{}'); } catch { return {}; }
}
function _bioSave(name, b64) {
  const a = _bioGetAll();
  a[name] = b64;
  try { localStorage.setItem(_BIO_KEY, JSON.stringify(a)); } catch {}
}

export function bioHasCred(name)  { return !!_bioGetAll()[name]; }
export function bioIsSupported()  {
  return !!(window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function');
}
export async function bioPlatformAvailable() {
  if (!bioIsSupported()) return false;
  try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
  catch { return false; }
}

function _b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function _b64uDec(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - s.length % 4) : '';
  return Uint8Array.from(atob(s + pad), c => c.charCodeAt(0)).buffer;
}

export async function bioRegister(name) {
  if (!bioIsSupported()) throw new Error('WebAuthn tidak didukung browser ini.');
  const enc        = new TextEncoder();
  const credential = await navigator.credentials.create({
    publicKey: {
      rp:      { name: 'SIPAMDAL BBPKA II', id: location.hostname },
      user:    { id: enc.encode(name), name, displayName: name },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60000,
    },
  });
  if (!credential) throw new Error('Registrasi dibatalkan.');
  _bioSave(name, _b64u(credential.rawId));
  return true;
}

export async function bioVerify(name) {
  const storedId = _bioGetAll()[name];
  if (!storedId) throw new Error('Biometrik belum terdaftar.');
  const credential = await navigator.credentials.get({
    publicKey: {
      rpId:    location.hostname,
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: _b64uDec(storedId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return !!credential;
}

export function bioClearCred(name) {
  const a = _bioGetAll();
  delete a[name];
  try { localStorage.setItem(_BIO_KEY, JSON.stringify(a)); } catch {}
}

// ── Login tracking & audit ────────────────────────────────────────────────────
export function recordLogin(name, regu, isAdmin, isPimpinan) {
  writeAuditLog({
    action: 'LOGIN', actor: name, regu: regu || 0,
    isAdmin: !!isAdmin, isPimpinan: !!isPimpinan, detail: 'Berhasil login',
  });
  addDoc(collection(db, 'sipamdal_login_history'), {
    name, regu: regu || 0, isAdmin: !!isAdmin, isPimpinan: !!isPimpinan,
    ts: serverTimestamp(), tsLocal: new Date().toISOString(),
    device: navigator.userAgent.slice(0, 80),
  }).catch(() => {});
}

export function auditAction(actor, regu, action, detail) {
  writeAuditLog({ action, actor, regu: regu || 0, detail });
}

// ── Zustand Store ─────────────────────────────────────────────────────────────
// State login terpusat — menggantikan localStorage + prop drilling
const useAuthStore = create((set, get) => ({
  // State
  currentUser:  null,   // string nama user yang login
  currentRegu:  0,      // number regu (1/2/3/0 untuk non-regu)
  isAdmin:      false,
  isPimpinan:   false,
  isLoggedIn:   false,

  // Restore session dari localStorage (dipanggil dari main.jsx saat app load)
  restoreSession: () => {
    try {
      const raw = localStorage.getItem('pad_session');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.name) {
        set({
          currentUser: s.name,
          currentRegu: s.regu || 0,
          isAdmin:     !!s.isAdmin,
          isPimpinan:  !!s.isPimpinan,
          isLoggedIn:  true,
        });
      }
    } catch {}
  },

  // Login — dipanggil dari TabLogin setelah verifyPinFS berhasil
  login: (name, regu, isAdmin, isPimpinan) => {
    set({ currentUser: name, currentRegu: regu || 0, isAdmin: !!isAdmin, isPimpinan: !!isPimpinan, isLoggedIn: true });
    try {
      localStorage.setItem('pad_session', JSON.stringify({ name, regu, isAdmin, isPimpinan }));
    } catch {}
    recordLogin(name, regu, isAdmin, isPimpinan);
  },

  // Logout
  logout: () => {
    const { currentUser, currentRegu, isAdmin, isPimpinan } = get();
    writeAuditLog({
      action: 'LOGOUT', actor: currentUser || '-', regu: currentRegu,
      isAdmin: !!isAdmin, isPimpinan: !!isPimpinan, detail: 'Logout',
    });
    set({ currentUser: null, currentRegu: 0, isAdmin: false, isPimpinan: false, isLoggedIn: false });
    try { localStorage.removeItem('pad_session'); } catch {}
  },
}));

export { useAuthStore };
export default useAuthStore;
