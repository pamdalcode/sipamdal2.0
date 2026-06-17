// src/stores/useDataStore.js — SIPAMDAL
// Migrasi dari: semua hook data di app-main.js (useFS/useData/useFSCollection/usePatrols)
// Perubahan:
//   - Data terpusat di satu Zustand store, bukan tersebar di App() hooks
//   - Subscriptions Firestore di-setup sekali via initDataStore() dari main.jsx
//   - Komponen cukup: const { incidents, setIncidents } = useDataStore()
//   - Semua LS key & Firestore collection name identik dengan aslinya

import { create } from 'zustand';
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
  serverTimestamp,
} from '../firebase/firebase.js';

// ── Default inventaris ────────────────────────────────────────────────────────
export const DEFAULT_INVENTARIS = [
  { id: 'inv1', nama: 'TV',          jumlah: '1 unit' },
  { id: 'inv2', nama: 'Dispenser',   jumlah: '1 unit' },
  { id: 'inv3', nama: 'Senter',      jumlah: '2 unit' },
  { id: 'inv4', nama: 'APAR',        jumlah: '1 unit' },
  { id: 'inv5', nama: 'Komputer',    jumlah: '1 unit' },
  { id: 'inv6', nama: 'Police Line', jumlah: '1 unit' },
];

// ── LS helpers ────────────────────────────────────────────────────────────────
function lsGet(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Foto patroli tersimpan terpisah (base64 besar) ────────────────────────────
const LS_PHOTO_PREFIX = 'pad_patrol_photo_';
function getPatrolPhoto(id) {
  try { return localStorage.getItem(LS_PHOTO_PREFIX + id) || null; } catch { return null; }
}
function setPatrolPhoto(id, dataUrl) {
  try { localStorage.setItem(LS_PHOTO_PREFIX + id, dataUrl); } catch {}
}

// ── Store ─────────────────────────────────────────────────────────────────────
const useDataStore = create((set, get) => ({

  // ── useFSCollection collections ───────────────────────────────────────────
  incidents:   lsGet('pad_inc_v2',       []),
  packages:    lsGet('pad_pkg_v2',       []),
  guests:      lsGet('pad_guest_v2',     []),
  mutations:   lsGet('pad_mut_v2',       []),
  instruksi:   lsGet('pad_instruksi_v2', []),
  keluarData:  lsGet('pad_keluar_v2',    []),

  // ── usePatrols ────────────────────────────────────────────────────────────
  patrols: (() => {
    const items = lsGet('pad_patrol', []);
    return items.map(p => ({ ...p, photo: getPatrolPhoto(p.id) }));
  })(),

  // ── useData / useFS (single-doc Firestore) ────────────────────────────────
  posAssign:      {},    // key dinamis: pad_pos_<shiftKey>
  standJaga:      lsGet('pad_stand',           []),
  posRollingLog:  lsGet('pad_posroll',         []),
  rollings:       lsGet('pad_rolling',         []),
  liburData:      lsGet('pad_libur',           {}),
  inventarisDaftar: lsGet('pad_inv_daftar',    DEFAULT_INVENTARIS),
  inventarisCek:  lsGet('pad_inv_cek',         {}),
  statusPimpinan: lsGet('pad_pimpinan_status', { hadir: true, updatedAt: null, updatedBy: null }),
  broadcast:      lsGet('pad_broadcast',       null),
  waGrup:         lsGet('pad_wa_grup',         ''),

  // ── Setters untuk useFSCollection ─────────────────────────────────────────
  // Optimistic update + sync ke Firestore (add/update/delete per-doc)
  _setFSCollection: async (collectionName, lsKey, updater) => {
    const prev   = get()[_storeKey(collectionName)];
    const newArr = typeof updater === 'function' ? updater(prev) : updater;

    // Optimistic update
    set({ [_storeKey(collectionName)]: newArr });
    lsSet(lsKey, newArr);

    const prevMap = new Map(prev.map(item => [String(item.id), item]));
    const newIds  = new Set(newArr.map(item => String(item.id)));
    const col     = collection(db, collectionName);
    const writes  = [];

    newArr.forEach(item => {
      const idStr = String(item.id);
      const old   = prevMap.get(idStr);
      if (!old) {
        writes.push(setDoc(doc(col, idStr), item));
      } else if (JSON.stringify(old) !== JSON.stringify(item)) {
        writes.push(setDoc(doc(col, idStr), item, { merge: true }));
      }
    });

    prev.forEach(item => {
      if (!newIds.has(String(item.id))) {
        writes.push(deleteDoc(doc(col, String(item.id))));
      }
    });

    return Promise.all(writes).catch(err => {
      console.error('[useDataStore] write error:', collectionName, err.code, err.message);
      window.dispatchEvent(new CustomEvent('sipamdal_error', {
        detail: { msg: 'Gagal menyimpan data. Periksa koneksi dan coba lagi.' },
      }));
      throw err;
    });
  },

  // ── Setter untuk single-doc Firestore (useData / useFS) ───────────────────
  _setFSDoc: (fsKey, lsKey, updater, storeKey) => {
    const prev = get()[storeKey];
    const val  = typeof updater === 'function' ? updater(prev) : updater;
    set({ [storeKey]: val });
    lsSet(lsKey, val);
    setDoc(doc(db, 'sipamdal', fsKey), { items: val }, { merge: true }).catch(err => {
      console.error('[useDataStore] setDoc error:', fsKey, err.code, err.message);
    });
  },

  // ── Public setters — API identik dengan useFS/useFSCollection lama ────────
  setIncidents:    (u) => get()._setFSCollection('sipamdal_inc',       'pad_inc_v2',       u),
  setPackages:     (u) => get()._setFSCollection('sipamdal_pkg',       'pad_pkg_v2',       u),
  setGuests:       (u) => get()._setFSCollection('sipamdal_guest',     'pad_guest_v2',     u),
  setMutations:    (u) => get()._setFSCollection('sipamdal_mut',       'pad_mut_v2',       u),
  setInstruksi:    (u) => get()._setFSCollection('sipamdal_instruksi', 'pad_instruksi_v2', u),
  setKeluarData:   (u) => get()._setFSCollection('sipamdal_keluar',    'pad_keluar_v2',    u),

  setStandJaga:    (u) => get()._setFSDoc('pad_stand',           'pad_stand',           u, 'standJaga'),
  setPosRollingLog:(u) => get()._setFSDoc('pad_posroll',         'pad_posroll',         u, 'posRollingLog'),
  setRollings:     (u) => get()._setFSDoc('pad_rolling',         'pad_rolling',         u, 'rollings'),
  setLiburData:    (u) => get()._setFSDoc('pad_libur',           'pad_libur',           u, 'liburData'),
  setInventarisDaftar:(u) => get()._setFSDoc('pad_inv_daftar',   'pad_inv_daftar',      u, 'inventarisDaftar'),
  setInventarisCek:(u) => get()._setFSDoc('pad_inv_cek',         'pad_inv_cek',         u, 'inventarisCek'),
  setStatusPimpinan:(u) => get()._setFSDoc('pad_pimpinan_status','pad_pimpinan_status', u, 'statusPimpinan'),
  setBroadcast:    (u) => get()._setFSDoc('pad_broadcast',       'pad_broadcast',       u, 'broadcast'),
  setWaGrup:       (u) => get()._setFSDoc('pad_wa_grup',         'pad_wa_grup',         u, 'waGrup'),

  // posAssign: key dinamis berdasarkan shift key
  setPosAssign: (shiftKey, updater) => {
    const fsKey   = 'pad_pos_' + shiftKey;
    const prev    = get().posAssign;
    const val     = typeof updater === 'function' ? updater(prev) : updater;
    set({ posAssign: val });
    lsSet(fsKey, val);
    setDoc(doc(db, 'sipamdal', fsKey), { items: val }, { merge: true }).catch(() => {});
  },

  // ── usePatrols setter ─────────────────────────────────────────────────────
  setPatrols: (newArr) => {
    const prev    = get().patrols;
    const prevIds = new Set(prev.map(p => String(p.id)));
    const toAdd   = newArr.filter(p => !prevIds.has(String(p.id)));

    toAdd.forEach(p => {
      if (p.photo) setPatrolPhoto(p.id, p.photo);
      const { photo: _ph, ...meta } = p;
      setDoc(doc(collection(db, 'sipamdal_patrol'), String(p.id)), { ...meta, id: p.id })
        .catch(err => console.error('Patrol save error:', err.code, err.message));
    });

    lsSet('pad_patrol', newArr.map(p => { const { photo: _ph, ...rest } = p; return rest; }));
    set({ patrols: newArr });
  },

  // ── loadPosAssign: load posAssign untuk shift key tertentu ───────────────
  loadPosAssign: async (shiftKey) => {
    const fsKey  = 'pad_pos_' + shiftKey;
    const cached = lsGet(fsKey, {});
    set({ posAssign: cached });
    try {
      const snap = await getDoc(doc(db, 'sipamdal', fsKey));
      if (snap.exists()) {
        const val = snap.data().items ?? {};
        set({ posAssign: val });
        lsSet(fsKey, val);
      }
    } catch {}
  },
}));

// ── Map Firestore collection name → store key ─────────────────────────────────
function _storeKey(collectionName) {
  const map = {
    'sipamdal_inc':       'incidents',
    'sipamdal_pkg':       'packages',
    'sipamdal_guest':     'guests',
    'sipamdal_mut':       'mutations',
    'sipamdal_instruksi': 'instruksi',
    'sipamdal_keluar':    'keluarData',
  };
  return map[collectionName] || collectionName;
}

// ── Map single-doc FS key → store key ────────────────────────────────────────
const _fsDocMap = {
  'pad_stand':           'standJaga',
  'pad_posroll':         'posRollingLog',
  'pad_rolling':         'rollings',
  'pad_libur':           'liburData',
  'pad_inv_daftar':      'inventarisDaftar',
  'pad_inv_cek':         'inventarisCek',
  'pad_pimpinan_status': 'statusPimpinan',
  'pad_broadcast':       'broadcast',
  'pad_wa_grup':         'waGrup',
};

// ── initDataStore — setup semua Firestore subscriptions ───────────────────────
// Dipanggil SEKALI dari main.jsx setelah initFirebaseAuth() selesai.
// Return: fungsi cleanup untuk unsubscribe semua listener.
export function initDataStore() {
  const store = useDataStore.getState();
  const unsubs = [];

  // Helper: subscribe useFSCollection
  function subCollection(collectionName, lsKey, storeKey, orderField = 'ts') {
    const col   = collection(db, collectionName);
    const q     = query(col, orderBy(orderField, 'asc'));
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      useDataStore.setState({ [storeKey]: items });
      lsSet(lsKey, items);
    }, err => {
      console.warn('[initDataStore] onSnapshot error:', collectionName, err.message);
    });
    unsubs.push(unsub);
  }

  // Helper: subscribe single-doc (useData / useFS)
  function subDoc(fsKey, lsKey, storeKey, defaultVal) {
    const ref   = doc(db, 'sipamdal', fsKey);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data().items ?? defaultVal;
        useDataStore.setState({ [storeKey]: data });
        lsSet(lsKey, data);
      }
    }, () => {});
    unsubs.push(unsub);
  }

  // ── useFSCollection subscriptions ────────────────────────────────────────
  subCollection('sipamdal_inc',       'pad_inc_v2',       'incidents');
  subCollection('sipamdal_pkg',       'pad_pkg_v2',       'packages');
  subCollection('sipamdal_guest',     'pad_guest_v2',     'guests');
  subCollection('sipamdal_mut',       'pad_mut_v2',       'mutations');
  subCollection('sipamdal_instruksi', 'pad_instruksi_v2', 'instruksi');
  subCollection('sipamdal_keluar',    'pad_keluar_v2',    'keluarData');

  // ── usePatrols subscription ───────────────────────────────────────────────
  const patrolCol  = collection(db, 'sipamdal_patrol');
  const patrolQ    = query(patrolCol, orderBy('ts', 'asc'));
  const unsubPatrol = onSnapshot(patrolQ, snap => {
    const items = snap.docs.map(d => {
      const data = d.data();
      return { ...data, photo: getPatrolPhoto(data.id) };
    });
    useDataStore.setState({ patrols: items });
    lsSet('pad_patrol', items.map(p => { const { photo: _ph, ...rest } = p; return rest; }));
  }, () => {});
  unsubs.push(unsubPatrol);

  // ── single-doc subscriptions ──────────────────────────────────────────────
  subDoc('pad_stand',           'pad_stand',           'standJaga',       []);
  subDoc('pad_posroll',         'pad_posroll',         'posRollingLog',   []);
  subDoc('pad_rolling',         'pad_rolling',         'rollings',        []);
  subDoc('pad_libur',           'pad_libur',           'liburData',       {});
  subDoc('pad_inv_daftar',      'pad_inv_daftar',      'inventarisDaftar',DEFAULT_INVENTARIS);
  subDoc('pad_inv_cek',         'pad_inv_cek',         'inventarisCek',   {});
  subDoc('pad_pimpinan_status', 'pad_pimpinan_status', 'statusPimpinan',  { hadir: true, updatedAt: null, updatedBy: null });
  subDoc('pad_broadcast',       'pad_broadcast',       'broadcast',       null);
  subDoc('pad_wa_grup',         'pad_wa_grup',         'waGrup',          '');

  // Cleanup semua listener
  return () => unsubs.forEach(u => u());
}

export { useDataStore };
export default useDataStore;
