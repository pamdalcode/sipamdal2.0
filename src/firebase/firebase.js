// src/firebase/firebase.js
// Firebase config + singleton — Vite ESM
// Migrasi dari: firebase.js (CDN window.__FB style)
// Perubahan:
//   - Import dari npm 'firebase' package (bukan gstatic CDN)
//   - Hapus window.__FB, window.__FCM, window.__FB_ONLINE
//   - writeAuditLog diekspor sebagai fungsi biasa
//   - FCM init tetap lazy (dynamic import) untuk kompatibilitas WebView
//   - Online/offline probe dihandle via useAppStore (dipanggil dari main.jsx)

import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDoc,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// ── Config ────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyDq4WcKgbt5tNZh5wWghOjxCW38y5-siKo',
  authDomain: 'sipamdal.firebaseapp.com',
  projectId: 'sipamdal',
  storageBucket: 'sipamdal.firebasestorage.app',
  messagingSenderId: '586437675903',
  appId: '1:586437675903:web:5a1359dd13c8bd5014a84a',
};

// ── Singleton app ─────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

// [F2-04] persistentLocalCache + persistentMultipleTabManager
// menggantikan enableIndexedDbPersistence (deprecated sejak SDK v9.8+)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

const auth = getAuth(app);

// ── Re-export Firestore helpers ───────────────────────────────────────────────
// Komponen/stores cukup import dari sini, tidak perlu import ulang dari 'firebase/firestore'
export {
  db,
  auth,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
};

// ── Audit log ─────────────────────────────────────────────────────────────────
// Tulis ke Firestore; fallback ke localStorage jika offline
export async function writeAuditLog(entry) {
  try {
    await addDoc(collection(db, 'sipamdal_audit'), {
      ...entry,
      ts: serverTimestamp(),
      tsLocal: new Date().toISOString(),
    });
  } catch {
    try {
      const q = JSON.parse(localStorage.getItem('audit_queue') || '[]');
      q.push({ ...entry, tsLocal: new Date().toISOString() });
      localStorage.setItem('audit_queue', JSON.stringify(q.slice(-50)));
    } catch {}
  }
}

// ── Flush audit queue (dipanggil saat kembali online) ────────────────────────
export async function flushAuditQueue() {
  try {
    const q = JSON.parse(localStorage.getItem('audit_queue') || '[]');
    if (!q.length) return;
    for (const entry of q) {
      await addDoc(collection(db, 'sipamdal_audit'), {
        ...entry,
        ts: serverTimestamp(),
        flushed: true,
      });
    }
    localStorage.removeItem('audit_queue');
  } catch {}
}

// ── Firebase Cloud Messaging (lazy, opsional) ─────────────────────────────────
// [FIX-1] Jangan import firebase/messaging secara langsung — lempar error
// di WebView yang tidak mendukung Push API / Service Worker.
// Gunakan dynamic import bersyarat.

function _isFCMSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function _getVapidKey() {
  try {
    const snap = await getDoc(doc(db, 'sipamdal', 'app_config'));
    return snap.exists() ? (snap.data().vapidKey || null) : null;
  } catch (e) {
    console.warn('[FCM] Gagal fetch VAPID key:', e);
    return null;
  }
}

export async function registerFCMToken() {
  if (!_isFCMSupported()) {
    console.info('[FCM] Browser tidak mendukung Push/Notification API — dinonaktifkan.');
    return null;
  }
  try {
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
    const msg = getMessaging(app);

    // Terima pesan FCM saat app di foreground
    onMessage(msg, payload => {
      const { title, body } = payload.notification || {};
      const data = payload.data || {};
      window.dispatchEvent(new CustomEvent('fcm_foreground', { detail: { title, body, data } }));
    });

    const vapidKey = await _getVapidKey();
    if (!vapidKey) {
      console.warn('[FCM] VAPID key tidak tersedia di Firestore.');
      return null;
    }

    const sw = await navigator.serviceWorker.ready;
    const token = await getToken(msg, { vapidKey, serviceWorkerRegistration: sw });

    if (token) {
      const tokenDoc = doc(db, 'sipamdal_fcm_tokens', token.slice(0, 40));
      await setDoc(
        tokenDoc,
        { token, updatedAt: serverTimestamp(), userAgent: navigator.userAgent.slice(0, 100) },
        { merge: true }
      );
      console.log('[FCM] Token terdaftar:', token.slice(0, 20) + '...');
      return token;
    }
  } catch (e) {
    console.warn('[FCM] Gagal inisialisasi/daftarkan token:', e.message || e);
  }
  return null;
}

// ── signInAnonymously + return promise ───────────────────────────────────────
// Dipanggil dari main.jsx; hasilnya disimpan ke useAuthStore
export async function initFirebaseAuth() {
  try {
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (e) {
    console.warn('[FB] signInAnonymously gagal:', e.message || e);
    return null;
  }
}

// ── Online probe ──────────────────────────────────────────────────────────────
// Dipanggil dari main.jsx setelah auth selesai.
// Callback onOnline / onOffline diteruskan dari useAppStore.
let _unsubProbe = null;

export function startOnlineProbe({ onOnline, onOffline } = {}) {
  if (_unsubProbe) return; // sudah berjalan
  const probe = doc(db, 'sipamdal', 'pad_pos');
  _unsubProbe = onSnapshot(
    probe,
    async () => {
      onOnline?.();
      // Flush audit queue yang tertunda saat kembali online
      await flushAuditQueue();
      await writeAuditLog({ action: 'KEMBALI_ONLINE', info: 'Koneksi Firebase pulih' });
    },
    () => {
      onOffline?.();
      writeAuditLog({ action: 'KONEKSI_OFFLINE', info: 'Koneksi Firebase terputus' }).catch(() => {});
    }
  );
}

export function stopOnlineProbe() {
  _unsubProbe?.();
  _unsubProbe = null;
}
