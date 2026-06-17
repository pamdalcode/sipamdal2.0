// ═══════════════════════════════════════════════════════════════════════════════
//  SIPAMDAL Service Worker v9  (app v2.0.0 — ES Module / Vite build)
//  Gabungan: cache/offline + FCM + polling status pimpinan (background)
// ═══════════════════════════════════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// ── Firebase config ───────────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey:            "AIzaSyDq4WcKgbt5tNZh5wWghOjxCW38y5-siKo",
  authDomain:        "sipamdal.firebaseapp.com",
  projectId:         "sipamdal",
  storageBucket:     "sipamdal.firebasestorage.app",
  messagingSenderId: "586437675903",
  appId:             "1:586437675903:web:5a1359dd13c8bd5014a84a",
});

const messaging = firebase.messaging();

// ── Cache config ──────────────────────────────────────────────────────────────
// PENTING: Vite build output ada di /assets/ dengan nama hash.
// Static aset di bawah ini adalah yang ada di /public/ (tidak di-hash Vite).
// File JS/CSS utama di-cache otomatis saat fetch (cache-first).
const CACHE_NAME   = "sipamdal-v9";
const CACHE_STATIC = "sipamdal-static-v9";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-96.png",
  "/icon-192.png",
  "/icon-512.png",
];

const NETWORK_ONLY_HOSTS = [
  "firebase",
  "googleapis",
  "gstatic",
  "cdnjs.cloudflare",
  "fonts.googleapis",
  "fonts.gstatic",
];

// ── Polling config ────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30 * 1000; // cek tiap 30 detik
const FIRESTORE_URL    =
  "https://firestore.googleapis.com/v1/projects/sipamdal/databases/(default)/documents/sipamdal/pad_pimpinan_status";

let pollTimer      = null;
let lastKnownHadir = null; // null = belum init

// ═══════════════════════════════════════════════════════════════════════════════
//  INSTALL
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("install", e => {
  console.log("[SW v9] Install");
  e.waitUntil(
    caches.open(CACHE_STATIC)
      // [FIX] cache.addAll() bersifat all-or-nothing — kalau SATU URL gagal (404/dll),
      // SEMUA aset gagal di-cache tanpa pesan error yang jelas. Pakai cache.add() per
      // aset + catch individual supaya aset lain tetap ter-cache walau salah satu hilang.
      .then(cache => Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn("[SW v9] Gagal precache:", url, err.message))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ACTIVATE
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("activate", e => {
  console.log("[SW v9] Activate");
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
          .map(k => {
            console.log("[SW v9] Hapus cache lama:", k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
  );
  startPolling();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FETCH — Network-only untuk CDN & Firebase, Cache-first untuk aset lokal
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("fetch", e => {
  if (!pollTimer) startPolling(); // restart polling jika sempat mati

  const url = new URL(e.request.url);

  const isNetworkOnly =
    NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h)) ||
    e.request.method !== "GET";

  if (isNetworkOnly) {
    e.respondWith(
      fetch(e.request).catch(() => new Response("", { status: 503 }))
    );
    return;
  }

  // Aset Vite (/assets/*.js, /assets/*.css): cache setelah fetch pertama
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic") {
            caches.open(CACHE_STATIC).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match("/index.html")); // fallback SPA
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  POLLING FIRESTORE — deteksi perubahan status pimpinan tanpa server push
// ═══════════════════════════════════════════════════════════════════════════════
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  checkPimpinanStatus(true); // init pertama — simpan state, tidak kirim notif
  pollTimer = setInterval(() => checkPimpinanStatus(false), POLL_INTERVAL_MS);
}

async function checkPimpinanStatus(isInit) {
  try {
    const resp = await fetch(FIRESTORE_URL, { cache: "no-store" });
    if (!resp.ok) return;
    const json = await resp.json();

    let hadir = true;
    try {
      const f = json.fields;
      if (
        f?.items?.mapValue?.fields?.hadir?.booleanValue !== undefined
      ) {
        hadir = f.items.mapValue.fields.hadir.booleanValue;
      } else if (f?.hadir?.booleanValue !== undefined) {
        hadir = f.hadir.booleanValue;
      }
    } catch (_) { /* field structure tidak terduga — pakai default hadir=true */ }

    if (isInit || lastKnownHadir === null) {
      lastKnownHadir = hadir;
      console.log("[SW v9] Init status pimpinan:", hadir ? "HADIR" : "KELUAR");
      return;
    }

    if (hadir !== lastKnownHadir) {
      console.log("[SW v9] Status berubah →", hadir ? "HADIR" : "KELUAR");
      lastKnownHadir = hadir;
      await kirimNotifPimpinan(hadir);
    }
  } catch (err) {
    console.warn("[SW v9] Polling error:", err.message);
  }
}

async function kirimNotifPimpinan(hadir) {
  const title = hadir
    ? "🟢 Pimpinan Tiba di Kantor"
    : "🔴 Pimpinan Meninggalkan Kantor";
  const body = hadir
    ? "Pimpinan sudah tiba. Pastikan posisi dan kesiapan anggota."
    : "Pimpinan keluar. Tetap jaga ketertiban dan keamanan.";

  await self.registration.showNotification(title, {
    body,
    icon:     "/icon-192.png",
    badge:    "/icon-96.png",
    tag:      "sipamdal-pimpinan",
    renotify: true,
    vibrate:  hadir
      ? [200, 100, 200, 100, 200]
      : [300, 100, 300, 100, 300, 100, 300],
    data:    { hadir, url: "/" },
    actions: [
      { action: "buka",  title: "Buka SIPAMDAL" },
      { action: "tutup", title: "Tutup" },
    ],
  });

  // Kirim pesan ke semua tab terbuka → trigger banner + chime di app
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach(c => c.postMessage({ type: "PIMPINAN_STATUS_CHANGED", hadir }));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUSH — Terima FCM saat app background/tutup (via server langsung)
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {}

  const tipe      = data.tipe || data.type || "info";
  const title     = data.title || "🛡️ SIPAMDAL";
  const body      = data.body  || "Ada notifikasi baru";
  const tag       = data.tag   || ("sipamdal-" + Date.now());
  const isPenting = tipe === "insiden" || data.important;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               "/icon-192.png",
      badge:              "/icon-96.png",
      tag,
      vibrate:            isPenting ? [300, 100, 300, 100, 300] : [200, 100, 200],
      requireInteraction: isPenting,
      data:               { url: data.url || "/", tab: data.tab || "dashboard", tipe },
      actions: isPenting
        ? [{ action: "lihat", title: "⚠️ Lihat Sekarang" }, { action: "tutup", title: "Tutup" }]
        : [{ action: "lihat", title: "Buka App" }],
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FCM onBackgroundMessage — via Firebase Messaging SDK
// ═══════════════════════════════════════════════════════════════════════════════
messaging.onBackgroundMessage(payload => {
  console.log("[SW v9] FCM background:", payload);
  const n        = payload.notification || {};
  const d        = payload.data        || {};
  const tipe     = d.tipe || "info";
  const isPenting = tipe === "insiden";

  return self.registration.showNotification(
    n.title || d.title || "🛡️ SIPAMDAL",
    {
      body:               n.body || d.body || "Ada notifikasi baru",
      icon:               n.icon || "/icon-192.png",
      badge:              "/icon-96.png",
      tag:                d.tag || ("sipamdal-" + Date.now()),
      vibrate:            isPenting ? [300, 100, 300, 100, 300] : [200, 100, 200],
      requireInteraction: isPenting,
      data:               { url: d.url || "/", tab: d.tab || "dashboard", tipe },
      actions: isPenting
        ? [{ action: "lihat", title: "⚠️ Lihat Sekarang" }, { action: "tutup", title: "Tutup" }]
        : [{ action: "lihat", title: "Buka App" }],
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION CLICK
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action === "tutup") return;

  const data = e.notification.data || {};
  const tab  = data.tab || "dashboard";

  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if ("focus" in client) {
            client.focus();
            client.postMessage({ type: "NOTIF_CLICK", tab });
            return;
          }
        }
        return self.clients.openWindow((data.url || "/") + "?tab=" + tab);
      })
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGE dari app
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("message", event => {
  const { type, hadir } = event.data || {};

  // Sync state dari app saat piket ubah status (hindari double notif)
  if (type === "PIMPINAN_STATUS_UPDATE") {
    lastKnownHadir = hadir;
    console.log("[SW v9] State sync dari app: hadir =", hadir);
  }

  if (type === "START_POLLING") startPolling();

  if (type === "STOP_POLLING") {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      console.log("[SW v9] Polling dihentikan");
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BACKGROUND SYNC
// ═══════════════════════════════════════════════════════════════════════════════
self.addEventListener("sync", e => {
  if (e.tag === "sync-audit-log") {
    e.waitUntil(
      self.clients
        .matchAll()
        .then(cs => cs.forEach(c => c.postMessage({ type: "FLUSH_AUDIT" })))
    );
  }
});

self.addEventListener("periodicsync", e => {
  if (e.tag === "sipamdal-check") {
    e.waitUntil(
      self.clients
        .matchAll()
        .then(cs => cs.forEach(c => c.postMessage({ type: "PERIODIC_SYNC" })))
    );
  }
});
