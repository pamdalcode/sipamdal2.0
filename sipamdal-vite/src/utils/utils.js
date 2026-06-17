// src/utils/utils.js — SIPAMDAL
// Migrasi dari: utils.js (CDN window.React + window.__FB style)
// Perubahan:
//   - Import React + hooks dari 'react' (bukan window.React)
//   - useFS, usePatrols, useFSCollection: akses Firebase via import langsung
//     dari '../firebase/firebase.js' (bukan window.__FB)
//   - syncAnggotaFromFirestore: terima { db, doc, getDoc } sebagai parameter
//   - Semua logic & konstanta tetap identik

import { useState, useEffect, useRef } from 'react';
import {
  db,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from '../firebase/firebase.js';

// ── Versi aplikasi ────────────────────────────────────────────────────────────
export const APP_VERSION = 'v1.0.0';

// ── Data anggota (non-sensitif) ───────────────────────────────────────────────
// PII (noHp, nip) DIHAPUS dari source code — disimpan di Firestore sipamdal_config/anggota
export const ANGGOTA_DATA_BASE = [
  { id: 1,  regu: 1, nama: 'Dudung',   jabatan: 'Dan Regu' },
  { id: 2,  regu: 1, nama: 'Somantri', jabatan: 'Anggota'  },
  { id: 3,  regu: 1, nama: 'Caca',     jabatan: 'Anggota'  },
  { id: 4,  regu: 1, nama: 'Dadang',   jabatan: 'Anggota'  },
  { id: 5,  regu: 1, nama: 'Endri',    jabatan: 'Anggota'  },
  { id: 6,  regu: 2, nama: 'Asep',     jabatan: 'Dan Regu' },
  { id: 7,  regu: 2, nama: 'Riki',     jabatan: 'Anggota'  },
  { id: 8,  regu: 2, nama: 'Gustaf',   jabatan: 'Anggota'  },
  { id: 9,  regu: 2, nama: 'Iwan 89',  jabatan: 'Anggota'  },
  { id: 10, regu: 2, nama: 'Endang',   jabatan: 'Anggota'  },
  { id: 11, regu: 3, nama: 'Tatang',   jabatan: 'Dan Regu' },
  { id: 12, regu: 3, nama: 'Iwan 92',  jabatan: 'Anggota'  },
  { id: 13, regu: 3, nama: 'Isnanta',  jabatan: 'Anggota'  },
  { id: 14, regu: 3, nama: 'Dudi',     jabatan: 'Anggota'  },
  { id: 15, regu: 3, nama: 'Rukman',   jabatan: 'Anggota'  },
];

export function loadAnggotaOverride() {
  try {
    const s = localStorage.getItem('pamdal_anggota_override');
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function getAnggotaData(base) {
  const src = base || ANGGOTA_DATA_BASE;
  const ovr = loadAnggotaOverride();
  return src.map(a => (ovr[a.id] ? { ...a, ...ovr[a.id] } : a));
}

// [ES MODULE FIX] Gunakan object wrapper agar konsumer yang sudah import
// tetap mendapat data terbaru setelah syncAnggotaFromFirestore() dijalankan.
// Akses dengan: ANGGOTA_DATA.items (bukan langsung ANGGOTA_DATA)
export const ANGGOTA_DATA = {
  items: (() => {
    try {
      const cached = localStorage.getItem('pamdal_anggota_fs');
      if (cached) return getAnggotaData(JSON.parse(cached));
    } catch {}
    return getAnggotaData();
  })(),
};

// Dipanggil sekali saat app load (dari main.jsx atau App.jsx)
export async function syncAnggotaFromFirestore() {
  try {
    const snap = await getDoc(doc(db, 'sipamdal_config', 'anggota'));
    if (snap.exists()) {
      const items = snap.data().items;
      if (Array.isArray(items) && items.length > 0) {
        try { localStorage.setItem('pamdal_anggota_fs', JSON.stringify(items)); } catch {}
        // [ES MODULE FIX] Mutasi .items pada wrapper object, bukan reassign variabel
        ANGGOTA_DATA.items = getAnggotaData(items);
        REGU[1] = ANGGOTA_DATA.items.filter(a => a.regu === 1).map(a => a.nama);
        REGU[2] = ANGGOTA_DATA.items.filter(a => a.regu === 2).map(a => a.nama);
        REGU[3] = ANGGOTA_DATA.items.filter(a => a.regu === 3).map(a => a.nama);
        console.log('[SIPAMDAL] Data anggota di-load dari Firestore:', items.length, 'anggota');
      }
    }
  } catch (e) {
    console.warn('[SIPAMDAL] Gagal fetch anggota dari Firestore, pakai data lokal:', e.message);
  }
}

export function getBiodata(nama) {
  return ANGGOTA_DATA.items.find(a => a.nama === nama) || null;
}

// ── REGU — daftar nama per regu ───────────────────────────────────────────────
export let REGU = {
  1: ANGGOTA_DATA.items.filter(a => a.regu === 1).map(a => a.nama),
  2: ANGGOTA_DATA.items.filter(a => a.regu === 2).map(a => a.nama),
  3: ANGGOTA_DATA.items.filter(a => a.regu === 3).map(a => a.nama),
};

// ── ALL_MEMBERS — flat list semua anggota dengan regu ─────────────────────────
export const ALL_MEMBERS = Object.entries(REGU).flatMap(([regu, names]) =>
  names.map(name => ({ name, regu: Number(regu) }))
);

// ── Konstanta pos & patroli ───────────────────────────────────────────────────
export const POS_LIST = ['Pos Utama', 'Pos Asrama', 'Pos Guest House', 'Gedung Utama'];
export const POS_CAP  = { 'Pos Utama': 2, 'Pos Asrama': 1, 'Pos Guest House': 1, 'Gedung Utama': 1 };
export const POS_COL  = {
  'Pos Utama': 'var(--tx-muted)', 'Pos Asrama': 'var(--tx-muted)',
  'Pos Guest House': 'var(--tx-muted)', 'Gedung Utama': 'var(--tx-muted)',
};

export const PATROL_AREAS = {
  'Pos Asrama':      ['Gedung Asrama 1', 'Gedung Asrama 2', 'Ruang Makan 2', 'Klinik', 'Gedung Kelas E', 'Gedung Kelas A', 'Ruang Makan 1'],
  'Gedung Utama':    ['Gedung Utama', 'Gedung WI', 'Aula', 'Gedung Sarpras', 'Gedung Kepegawaian', 'Area Parkir', 'Gedung Genset'],
  'Pos Utama':       ['Area Pos Utama', 'Taman', 'Gedung Kantin', 'Masjid'],
  'Pos Guest House': ['Guest House 1', 'Guest House 2', 'Guest House 3', 'Guest House 4', 'Guest House 5', 'Gedung GOR', 'Gedung Arsip'],
};

export const QR_PREFIX = 'BBPKA2-PAMDAL-';
export const decQR = (v) => v && v.startsWith(QR_PREFIX) ? v.replace(QR_PREFIX, '').replace(/_/g, ' ') : null;
export const ALL_AREAS = Object.values(PATROL_AREAS).flat();

// ── Hari libur nasional ───────────────────────────────────────────────────────
export const HARI_MERAH = new Set([
  '2025-01-01', '2025-01-27', '2025-01-28', '2025-01-29',
  '2025-03-29', '2025-03-30', '2025-03-31', '2025-04-18',
  '2025-05-01', '2025-05-12', '2025-05-13', '2025-05-29',
  '2025-06-01', '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09',
  '2025-08-17', '2025-09-05', '2025-10-02', '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-01-28', '2026-01-29', '2026-01-30',
  '2026-03-20', '2026-03-27', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-14', '2026-05-24', '2026-06-01',
  '2026-08-17', '2026-12-25',
  '2027-01-01', '2027-01-28', '2027-01-29', '2027-01-30',
  '2027-03-26', '2027-04-01', '2027-04-02',
  '2027-05-01', '2027-05-13', '2027-05-20', '2027-06-01',
  '2027-08-17', '2027-12-25',
]);

export const INC_CAT = ['Rendah', 'Sedang', 'Penting', 'Infrastruktur'];
export const CAT_COL = { Rendah: 'var(--accent)', Sedang: 'var(--amber)', Penting: 'var(--red)', Infrastruktur: 'var(--violet)' };
export const CAT_BG  = { Rendah: 'var(--accent-tint)', Sedang: 'rgba(var(--amber-rgb),.08)', Penting: 'rgba(201,27,42,.08)', Infrastruktur: 'rgba(109,40,217,.08)' };

// ── Warna — single source of truth ───────────────────────────────────────────
export const COLOR = {
  accent:       'var(--accent)',
  accent2:      'var(--accent-2)',
  red:          'var(--red)',
  redBright:    'var(--red-bright)',
  amber:        'var(--amber)',
  amberBright:  'var(--amber-bright)',
  amberDark:    'var(--amber-dark)',
  violet:       'var(--violet)',
  green:        '#2E7D32',
  regu1:        'var(--regu-1-col)',
  regu2:        'var(--regu-2-col)',
  regu3:        'var(--violet)',
  slate:        'var(--tx-muted)',
  txPrimary:    'var(--tx-primary)',
  txSecondary:  '#374151',
  txMuted:      'var(--tx-muted)',
  txGhost:      'var(--tx-ghost)',
  calSunday:    'var(--cal-sunday)',
  calSaturday:  'var(--accent-2)',
  calHoliday:   'var(--amber-bright)',
  whatsapp:     'var(--whatsapp)',
  whatsappDark: 'var(--whatsapp-dark)',
  photoBorder:  'var(--green-light)',
  bgSurface:    'var(--bg-surface)',
  bgOverlay:    '#F8FBFF',
  shellBg:      '#F0F7FF',
  printText:    '#1F2937',
  printBorder:  '#E5E7EB',
  printThBg:    'var(--bg-surface)',
  printMuted:   '#4B5563',
};

// ── Jadwal & regu hari ini ────────────────────────────────────────────────────
export const JADWAL_START = new Date('2025-04-14T07:00:00');

// ── Color helpers ─────────────────────────────────────────────────────────────
export function colRgb(col) {
  if (!col) return 'var(--orb-rgb)';
  if (col.includes('amber'))  return 'var(--amber-rgb)';
  if (col.includes('red'))    return 'var(--red-rgb)';
  if (col.includes('violet')) return 'var(--violet-rgb)';
  if (col.includes('teal') || col.includes('regu-1')) return 'var(--teal-rgb)';
  if (col.includes('col-slate') || col.includes('slate')) return '100,116,139';
  return 'var(--orb-rgb)';
}
export const pinRgb = colRgb; // alias backward compat
export function cRgba(col, a) { return `rgba(${colRgb(col)},${a})`; }

export function toLocalKey(date) {
  const d = date || new Date();
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function getReguHari(date) {
  const d = new Date(date);
  // Shift piket mulai jam 07:00 — geser 7 jam ke belakang
  const shifted = new Date(d.getTime() - 7 * 3600000);
  const localD  = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
  const localS  = new Date(JADWAL_START.getFullYear(), JADWAL_START.getMonth(), JADWAL_START.getDate());
  const diff    = Math.round((localD - localS) / 86400000);
  const urut    = [3, 1, 2];
  return urut[((diff % 3) + 3) % 3];
}

export function getShiftKey(date) {
  const d       = new Date(date);
  const shifted = new Date(d.getTime() - 7 * 3600000);
  return toLocalKey(shifted);
}

export function isHariLibur(date) {
  const d   = new Date(date);
  const dow = d.getDay();
  const key = toLocalKey(d);
  return dow === 0 || dow === 6 || HARI_MERAH.has(key);
}

// ── Format helpers ────────────────────────────────────────────────────────────
export const fmtDT   = (d) => new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
export const fmtT    = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDS   = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export const getShift = (d = new Date()) => {
  const h = d.getHours();
  if (h >= 8  && h < 12) return { l: 'Pagi',   t: '08:00-12:00' };
  if (h >= 12 && h < 18) return { l: 'Siang',  t: '12:00-18:00' };
  if (h >= 18)            return { l: 'Petang', t: '18:00-00:00' };
  return { l: 'Malam', t: '00:00-08:00' };
};

export const getPos = (area) => {
  const found = Object.entries(PATROL_AREAS).find(([, areas]) => areas.includes(area));
  return found ? found[0] : undefined;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────
export const initials = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '??';

export function waLink(noHp, msg) {
  const clean = noHp.replace(/\D/g, '').replace(/^0/, '62');
  return 'https://wa.me/' + clean + '?text=' + encodeURIComponent(msg || 'Halo, saya menghubungi dari SIPAMDAL BBPKA II Jatinangor.');
}

// ── kompressFoto — kompresi + watermark timestamp ─────────────────────────────
export function kompressFoto(dataUrl, maxW = 1280, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio  = Math.min(1, maxW / img.width);
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const now  = new Date();
      const pad  = (n) => String(n).padStart(2, '0');
      const tgl  = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      const jam  = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const stampText = `SIPAMDAL ${tgl} ${jam}`;

      const fontSize = Math.max(14, Math.floor(canvas.width / 26));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = 'bottom';
      const txtW = ctx.measureText(stampText).width;
      const padX = 10, padY = 8;
      const bx = canvas.width  - txtW - padX * 2 - 4;
      const by = canvas.height - fontSize - padY * 2 - 4;

      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(bx, by, txtW + padX * 2, fontSize + padY * 2 + 2);
      ctx.fillStyle = '#F5A623';
      ctx.fillRect(bx, by, txtW + padX * 2, 3);
      ctx.shadowColor   = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur    = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = '#00E5FF';
      ctx.fillText(stampText, bx + padX, canvas.height - padY - 4);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;

      const LIMIT = 750000;
      let result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= LIMIT) { resolve(result); return; }

      for (const q of [0.72, 0.62, 0.52, 0.42]) {
        result = canvas.toDataURL('image/jpeg', q);
        if (result.length <= LIMIT) { resolve(result); return; }
      }

      for (const w of [960, 800, 640]) {
        const r2  = Math.min(1, w / img.width);
        const c2  = document.createElement('canvas');
        c2.width  = Math.round(img.width  * r2);
        c2.height = Math.round(img.height * r2);
        const ctx2 = c2.getContext('2d');
        ctx2.imageSmoothingEnabled = true;
        ctx2.imageSmoothingQuality = 'high';
        ctx2.drawImage(img, 0, 0, c2.width, c2.height);
        const fs2 = Math.max(14, Math.floor(c2.width / 26));
        ctx2.font = `bold ${fs2}px sans-serif`;
        ctx2.textBaseline = 'bottom';
        const tw2 = ctx2.measureText(stampText).width;
        const bx2 = c2.width  - tw2 - padX * 2 - 4;
        const by2 = c2.height - fs2 - padY * 2 - 4;
        ctx2.fillStyle = 'rgba(0,0,0,0.75)';
        ctx2.fillRect(bx2, by2, tw2 + padX * 2, fs2 + padY * 2 + 2);
        ctx2.fillStyle = '#F5A623';
        ctx2.fillRect(bx2, by2, tw2 + padX * 2, 3);
        ctx2.shadowColor   = 'rgba(0,0,0,0.8)';
        ctx2.shadowBlur    = 4;
        ctx2.shadowOffsetX = 1;
        ctx2.shadowOffsetY = 1;
        ctx2.fillStyle = '#00E5FF';
        ctx2.fillText(stampText, bx2 + padX, c2.height - padY - 4);
        ctx2.shadowColor = 'transparent';
        ctx2.shadowBlur  = 0;
        result = c2.toDataURL('image/jpeg', 0.72);
        if (result.length <= LIMIT) { resolve(result); return; }
      }

      resolve(result.length <= LIMIT ? result : canvas.toDataURL('image/jpeg', 0.40));
    };
    img.src = dataUrl;
  });
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** useLS — state yang di-persist ke localStorage */
export function useLS(key, init) {
  const [v, sv] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : init;
    } catch { return init; }
  });
  const set = (x) => {
    sv(x);
    try { localStorage.setItem(key, JSON.stringify(x)); } catch {}
  };
  return [v, set];
}

/** useFS — state yang di-sync ke Firestore (dengan localStorage sebagai cache) */
export function useFS(key, init) {
  const [v, sv] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : init;
    } catch { return init; }
  });

  const vRef = useRef(v);
  useEffect(() => { vRef.current = v; }, [v]);

  useEffect(() => {
    const ref   = doc(db, 'sipamdal', key);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data().items != null ? snap.data().items : init;
        sv(data);
        try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      }
    }, () => {});
    return () => unsub();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (x) => {
    const val = typeof x === 'function' ? x(vRef.current) : x;
    sv(val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
    setDoc(doc(db, 'sipamdal', key), { items: val }, { merge: true }).catch(err => {
      console.error('Firebase save error:', key, err.code, err.message);
    });
  };
  return [v, set];
}

// Alias
export const useData = useFS;

/** usePatrols — state patroli dengan foto tersimpan terpisah di localStorage */
export function usePatrols() {
  const LS_KEY          = 'pad_patrol';
  const LS_PHOTO_PREFIX = 'pad_patrol_photo_';
  const FS_COL          = 'sipamdal_patrol';

  const [v, sv] = useState(() => {
    try {
      const s     = localStorage.getItem(LS_KEY);
      const items = s ? JSON.parse(s) : [];
      return items.map(p => {
        if (!p.photo) {
          try { p.photo = localStorage.getItem(LS_PHOTO_PREFIX + p.id) || null; } catch {}
        }
        return p;
      });
    } catch { return []; }
  });

  useEffect(() => {
    const col   = collection(db, FS_COL);
    const q     = query(col, orderBy('ts', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => {
        const data  = d.data();
        let   photo = null;
        try { photo = localStorage.getItem(LS_PHOTO_PREFIX + data.id) || null; } catch {}
        return { ...data, photo };
      });
      sv(items);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(items.map(p => ({ ...p, photo: undefined }))));
      } catch {}
    }, () => {});
    return () => unsub();
  }, []);

  const set = (newArr) => {
    sv(prev => {
      const prevIds = new Set(prev.map(p => String(p.id)));
      const toAdd   = newArr.filter(p => !prevIds.has(String(p.id)));

      if (toAdd.length > 0) {
        toAdd.forEach(p => {
          if (p.photo) {
            try { localStorage.setItem(LS_PHOTO_PREFIX + p.id, p.photo); } catch {}
          }
          const { photo: _ph, ...meta } = p;
          setDoc(doc(collection(db, FS_COL), String(p.id)), { ...meta, id: p.id }).catch(err => {
            console.error('Patrol save error:', err.code, err.message);
          });
        });
      }

      try {
        localStorage.setItem(LS_KEY, JSON.stringify(newArr.map(p => {
          const { photo: _ph, ...rest } = p;
          return rest;
        })));
      } catch {}
      return newArr;
    });
  };
  return [v, set];
}

/** useOnlineStatus — deteksi koneksi jaringan */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const onOnline  = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return online;
}

/** usePushNotif — manajemen notifikasi push */
export function usePushNotif() {
  const [permission, setPermission] = useState(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const supported = 'Notification' in window;

  const requestPermission = async () => {
    if (!supported) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        localStorage.setItem('pad_notif_enabled', '1');
        sendNotif(
          '🔔 Notifikasi Aktif',
          'SIPAMDAL akan memberitahu kamu saat ada instruksi atau broadcast baru dari pimpinan.',
          { tag: 'welcome' }
        );
      }
      return result;
    } catch { return 'denied'; }
  };

  const sendNotif = (title, body, opts = {}) => {
    if (!supported || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(sw => {
          sw.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-96.png',
            vibrate: [200, 100, 200],
            requireInteraction: opts.priority === 'Penting',
            tag: opts.tag || ('sipamdal-' + Date.now()),
            data: { url: window.location.href, tab: opts.tab || 'instruksi' },
            ...opts,
          });
        }).catch(() => {
          new Notification(title, { body, icon: '/icon-192.png', tag: opts.tag || ('sipamdal-' + Date.now()) });
        });
      } else {
        new Notification(title, { body, icon: '/icon-192.png', tag: opts.tag || ('sipamdal-' + Date.now()) });
      }
    } catch (e) {
      console.warn('Notif gagal:', e);
    }
  };

  const isEnabled = permission === 'granted';
  const isDenied  = permission === 'denied';
  return { permission, supported, isEnabled, isDenied, requestPermission, sendNotif };
}

/**
 * useFSCollection — hook anti-overwrite untuk array data penting.
 * Tiap item = 1 dokumen Firestore → aman konkurensi.
 *
 * @param {string} collectionName - nama Firestore collection
 * @param {string} lsCacheKey     - key localStorage untuk cache offline
 * @param {string} orderField     - field untuk sorting (default: 'ts')
 * @param {Function} onError      - callback error (opsional)
 */
export function useFSCollection(collectionName, lsCacheKey, orderField = 'ts', onError = null) {
  const [v, sv] = useState(() => {
    try {
      const s = localStorage.getItem(lsCacheKey);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const vRef = useRef(v);
  useEffect(() => { vRef.current = v; }, [v]);

  useEffect(() => {
    const col   = collection(db, collectionName);
    const q     = query(col, orderBy(orderField, 'asc'));
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      sv(items);
      try { localStorage.setItem(lsCacheKey, JSON.stringify(items)); } catch {}
    }, (err) => {
      console.warn('[useFSCollection] onSnapshot error:', collectionName, err.message);
    });
    return () => unsub();
  }, [collectionName, lsCacheKey, orderField]);

  const _fireErr = (msg) => {
    if (typeof onError === 'function') {
      onError(msg);
    } else {
      window.dispatchEvent(new CustomEvent('sipamdal_error', { detail: { msg } }));
    }
  };

  const set = (updater) => {
    const newArr = typeof updater === 'function' ? updater(vRef.current) : updater;

    // Optimistic update
    sv(newArr);
    try { localStorage.setItem(lsCacheKey, JSON.stringify(newArr)); } catch {}

    const prevMap = new Map(vRef.current.map(item => [String(item.id), item]));
    const newIds  = new Set(newArr.map(item => String(item.id)));
    const col     = collection(db, collectionName);
    const writes  = [];

    newArr.forEach(item => {
      const idStr = String(item.id);
      const prev  = prevMap.get(idStr);
      if (!prev) {
        writes.push(setDoc(doc(col, idStr), item));
      } else if (JSON.stringify(prev) !== JSON.stringify(item)) {
        writes.push(setDoc(doc(col, idStr), item, { merge: true }));
      }
    });

    vRef.current.forEach(item => {
      const idStr = String(item.id);
      if (!newIds.has(idStr)) {
        writes.push(deleteDoc(doc(col, idStr)));
      }
    });

    return Promise.all(writes).catch(err => {
      console.error('[useFSCollection] write error:', collectionName, err.code, err.message);
      _fireErr('Gagal menyimpan data. Periksa koneksi dan coba lagi.');
      throw err;
    });
  };

  return [v, set];
}
