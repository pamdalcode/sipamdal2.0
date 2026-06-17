# SIPAMDAL — Catatan Progres Migrasi ke JSX

**Proyek:** SIPAMDAL v1.0.0 → Vite + React + Zustand + CSS Modules  
**Source:** `sipamdal-v1_0_0-evaluasi-admin.zip`  
**Total JS:** ~15.381 baris, 26 file JS  
**Update terakhir:** 2026-06-17

---

## Keputusan Arsitektur

| Aspek | Keputusan |
|---|---|
| Build tool | Vite + React |
| Nama file | PascalCase (`TabJadwal.jsx`) |
| State management | Zustand (semua app state) |
| Styles | CSS Modules per komponen |
| Firebase | Tetap Firestore, diakses via Zustand store |

---

## Struktur Target

```
sipamdal-vite/
├── index.html
├── vite.config.js
├── package.json
├── public/
│   ├── sw.js
│   ├── icon-*.png
│   └── manifest.json
└── src/
    ├── main.jsx               ← entry point (ganti index.html CDN)
    ├── App.jsx                ← dari app-main.js
    ├── AppShell.jsx           ← dari app-shell.js
    ├── firebase/
    │   └── firebase.js        ← config + singleton (tetap)
    ├── stores/
    │   ├── useAuthStore.js    ← dari auth.js
    │   ├── useAppStore.js     ← state global app (tab, notif, confirm)
    │   └── useDataStore.js    ← collections: incidents, packages, guests, dll
    ├── utils/
    │   └── utils.js           ← dari utils.js (refactor export)
    ├── components/
    │   └── ui/
    │       ├── UiComponents.jsx   ← dari ui-components.js
    │       └── UiComponents.module.css
    ├── engine/
    │   └── QrEngine.jsx       ← dari qr-engine.js
    └── tabs/
        ├── TabDash.jsx
        ├── TabDash.module.css
        ├── TabPimpinan.jsx
        ├── TabPimpinan.module.css
        ├── TabEvaluasi.jsx
        ├── TabPos.jsx
        ├── TabPos.module.css
        ├── TabMutasi.jsx          ← BELUM
        ├── TabMutasi.module.css   ← BELUM
        ├── TabJadwal.jsx
        ├── TabJadwal.module.css
        ├── TabAdmin.jsx
        ├── TabAdmin.module.css
        ├── TabWelcome.jsx
        ├── TabLogin.jsx
        ├── TabPatrol.jsx
        ├── TabInsiden.jsx
        ├── TabGuest.jsx
        ├── TabProfile.jsx
        ├── TabInventaris.jsx
        ├── TabPaket.jsx
        ├── TabSearch.jsx
        ├── TabInstruksi.jsx       ← BELUM
        └── TabPeserta.jsx
```

---

## Rencana Sesi

### ✅ Sesi 1 — Fondasi & Infrastruktur — SELESAI
- [x] `package.json` (27 baris)
- [x] `vite.config.js` (47 baris)
- [x] `index.html` (136 baris)
- [x] `src/firebase/firebase.js` (210 baris)
- [x] `src/stores/useAuthStore.js` (386 baris)
- [x] `src/stores/useAppStore.js` (172 baris)
- [x] `src/stores/useDataStore.js` (291 baris)
- [x] `src/utils/utils.js` (618 baris)
- [x] `src/App.jsx` (851 baris)
- [x] `src/AppShell.jsx` (286 baris)
- [x] `src/main.jsx` (100 baris)

---

### ✅ Sesi 2 — UI Components & QR Engine — SELESAI
- [x] `src/components/ui/UiComponents.jsx` (1409 baris)
- [x] `src/components/ui/UiComponents.module.css` (622 baris)
- [x] `src/engine/QrEngine.jsx` (1156 baris)
- [x] `public/sw.js` (323 baris)

---

### 🔄 Sesi 3 — Tab Operasional Besar — SEBAGIAN SELESAI
- [x] `TabJadwal.jsx` (982 baris) + `TabJadwal.module.css` (214 baris)
- [x] `TabPos.jsx` (948 baris) + `TabPos.module.css` (759 baris)
- [x] `TabDash.jsx` (1009 baris) + `TabDash.module.css` (675 baris)
- [ ] `TabMutasi.jsx` + `TabMutasi.module.css` ← **BELUM**

---

### ✅ Sesi 4 — Tab Pimpinan & Admin — SELESAI
- [x] `TabWelcome.jsx` (1018 baris)
- [x] `TabAdmin.jsx` (1172 baris)
- [x] `TabPimpinan.jsx` (691 baris) + `TabPimpinan.module.css` (97 baris)
- [x] `TabEvaluasi.jsx` (476 baris)

---

### 🔄 Sesi 5 — Tab Kecil & Finalisasi — SEBAGIAN SELESAI
- [x] `TabPatrol.jsx` (591 baris)
- [x] `TabLogin.jsx` (529 baris)
- [x] `TabGuest.jsx` (209 baris)
- [x] `TabProfile.jsx` (465 baris)
- [x] `TabInsiden.jsx` (333 baris) + `TabInsiden.module.css` (253 baris)
- [x] `TabInventaris.jsx` (384 baris) + `TabInventaris.module.css` (265 baris)
- [x] `TabPaket.jsx` (273 baris) + `TabPaket.module.css` (169 baris)
- [x] `TabSearch.jsx` (248 baris)
- [x] `TabPeserta.jsx` (276 baris)
- [ ] `TabInstruksi.jsx` ← **BELUM**
- [ ] CSS Module yang belum ada:
  - `TabProfile.module.css` ← **BELUM**
  - `TabLogin.module.css` ← **BELUM**
  - `TabPatrol.module.css` ← **BELUM**
  - `TabSearch.module.css` ← **BELUM**
  - `TabGuest.module.css` ← **BELUM**
  - `TabPeserta.module.css` ← **BELUM**
  - `TabWelcome.module.css` ← **BELUM**
  - `TabAdmin.module.css` ← **BELUM**
  - `TabEvaluasi.module.css` ← **BELUM**
- [ ] Review akhir: semua import/export konsisten
- [ ] `vite build` test

---

## Ringkasan Status

| Kategori | Total | Selesai | Belum |
|---|---|---|---|
| Infrastruktur | 11 | 11 | 0 |
| UI Engine | 3 | 3 | 0 |
| Tab JSX | 23 | 21 | 2 (`TabMutasi`, `TabInstruksi`) |
| CSS Module | 23 | 14 | 9 |
| **TOTAL FILE** | **60** | **49** | **11** |

**Progress: ~82% selesai**

---

## Yang Masih Perlu Dikerjakan

### Prioritas 1 — File yang belum ada sama sekali
1. `TabMutasi.jsx` + `TabMutasi.module.css`
2. `TabInstruksi.jsx`

### Prioritas 2 — CSS Module yang belum ada
3. `TabAdmin.module.css`
4. `TabWelcome.module.css`
5. `TabLogin.module.css`
6. `TabPatrol.module.css`
7. `TabProfile.module.css`
8. `TabGuest.module.css`
9. `TabSearch.module.css`
10. `TabPeserta.module.css`
11. `TabEvaluasi.module.css`

---

## Catatan Teknis Penting

### Penggantian `window.__FB`
```js
// Sebelum (CDN style)
const { db, collection } = window.__FB;
// Sesudah (Vite ESM)
import { db, collection } from '../firebase/firebase.js';
```

### Penggantian `window.__anyModalOpen` dll
- `window.__anyModalOpen` → `useAppStore.getState().anyModalOpen`
- `window.__notifySWPimpinan` → fungsi biasa di `main.jsx`
- `window.__FB_ONLINE` → `useAppStore` state `fbOnline`
- `window.__pushNotif` → tidak perlu, pakai hook Zustand langsung

### CSS Modules
- `styles.css` tetap ada di `public/` untuk CSS variables global (`:root { --accent: ... }`)
- Komponen-spesifik pindah ke `*.module.css` masing-masing

### ErrorBoundary
Tetap sebagai class component di `App.jsx` (React belum support function error boundary).

### Service Worker
`sw.js` dipindah ke `public/sw.js` — Vite otomatis serve static files dari folder `public`.

---

## Log Sesi

| Sesi | Tanggal | Output | Status |
|---|---|---|---|
| 1 | 2026-06-17 | Fondasi + Stores + App.jsx | ✅ Selesai |
| 2 | 2026-06-17 | UI Components + QR Engine + sw.js | ✅ Selesai |
| 3 | 2026-06-17 | TabJadwal, TabPos, TabDash (TabMutasi belum) | 🔄 Sebagian |
| 4 | 2026-06-17 | TabWelcome, TabAdmin, TabPimpinan, TabEvaluasi | ✅ Selesai |
| 5 | 2026-06-17 | Tab kecil (TabInstruksi + CSS module belum) | 🔄 Sebagian |
