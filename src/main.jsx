// src/main.jsx — SIPAMDAL
// Entry point Vite — menggantikan mount logic di app-main.js (CDN style)
// Urutan init:
//   1. Apply text color preference (sebelum render, hindari flash)
//   2. initFirebaseAuth() — signInAnonymously
//   3. initDataStore()   — setup semua Firestore subscriptions
//   4. startOnlineProbe() — monitor koneksi Firebase
//   5. syncAnggotaFromFirestore() — load data anggota terbaru
//   6. restoreSession()  — restore login dari localStorage
//   7. ReactDOM.createRoot().render(<App />)
//   8. Hapus splash screen

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initFirebaseAuth, startOnlineProbe } from './firebase/firebase.js';
import { syncAnggotaFromFirestore } from './utils/utils.js';
import { initDataStore } from './stores/useDataStore.js';
import useAuthStore from './stores/useAuthStore.js';
import useAppStore from './stores/useAppStore.js';

// ── 1. Apply text color sebelum render (hindari flash) ───────────────────────
useAppStore.getState().applyTextColor();

// ── 2–7. Init async lalu mount ────────────────────────────────────────────────
async function bootstrap() {
  // Firebase auth
  await initFirebaseAuth();

  // Setup Firestore subscriptions — return cleanup fn (disimpan untuk hot reload)
  const cleanupDataStore = initDataStore();

  // Monitor koneksi Firebase — update useAppStore.fbOnline
  startOnlineProbe({
    onOnline:  () => useAppStore.getState().setFbOnline(true),
    onOffline: () => useAppStore.getState().setFbOnline(false),
  });

  // Sync data anggota dari Firestore (non-blocking — tidak perlu await)
  syncAnggotaFromFirestore().catch(() => {});

  // Restore session login dari localStorage
  useAuthStore.getState().restoreSession();

  // Mount React
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Hapus splash screen
  const splash = document.getElementById('sipamdal-splash');
  if (splash) {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 400);
  }

  // Simpan cleanup untuk HMR (Vite dev mode)
  if (import.meta.hot) {
    import.meta.hot.dispose(() => cleanupDataStore());
  }
}

bootstrap().catch(err => {
  // Fallback: mount tetap jalan meski init gagal
  console.error('[SIPAMDAL] Bootstrap error:', err);
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  const splash = document.getElementById('sipamdal-splash');
  if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 400); }
});

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[SIPAMDAL] SW registered, scope:', reg.scope);
    }).catch(() => {});
  });

  navigator.serviceWorker.addEventListener('message', event => {
    const { type, hadir } = event.data || {};
    if (type === 'NOTIF_CLICK') window.focus();
    if (type === 'PIMPINAN_STATUS_CHANGED') {
      window.dispatchEvent(new CustomEvent('sipamdal_pimpinan_changed', { detail: { hadir } }));
    }
  });
}

// Kirim update status pimpinan ke SW (menggantikan window.__notifySWPimpinan)
export function notifySWPimpinan(hadir) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then(reg => {
    if (reg.active) reg.active.postMessage({ type: 'PIMPINAN_STATUS_UPDATE', hadir });
  }).catch(() => {});
}
