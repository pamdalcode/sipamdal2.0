// TabAdmin.jsx — SIPAMDAL
// Migrasi dari tab-admin.js (Sesi 4, update Sesi 5b asli) ke JSX murni — Sesi 4 migrasi Vite.
// Export: AdminMemberTab (default tab admin), InstruksiFormTab, BroadcastTab.
// Helper privat: AdminEditAnggota, AdminUploadAnggota, AdminLiburWrapper, JadwalAdminLibur,
//                hashPin (legacy static-salt), savePinToFS (legacy static-salt).

import React, { useState, useEffect } from 'react';
import {
  ANGGOTA_DATA,
  ANGGOTA_DATA_BASE,
  REGU,
  toLocalKey,
  getBiodata,
  loadAnggotaOverride,
  waLink,
} from '../utils/utils.js';

import { auditAction, runPinMigration } from '../stores/useAuthStore.js';
import { IC, PH, Btn, BtnSimpan, BtnBatal, useInnerModal } from '../components/ui/UiComponents.jsx';
import { useConfirm } from '../AppShell.jsx';
import {
  db, collection, doc, getDoc, setDoc, deleteDoc,
  getDocs, addDoc, serverTimestamp, query, orderBy, limit,
} from '../firebase/firebase.js';

// ── JADWAL constants (lokal, tidak diekspor dari utils karena hanya dipakai tab jadwal & admin) ──
const JADWAL_ANCHOR = new Date(2026, 5, 6); // 6 Juni 2026
const JADWAL_BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const JADWAL_BULAN_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const JADWAL_RC = {
  1: { accent: 'var(--regu-1-col)', bg: 'rgba(13,148,136,0.10)', label: '①' },
  2: { accent: 'var(--accent)', bg: 'rgba(5,150,105,0.10)', label: '②' },
  3: { accent: 'var(--amber-bright)', bg: 'rgba(217,119,6,0.10)', label: '③' },
};

const JADWAL_HARI_LIBUR_DEFAULT = {
  '2026-1-1': { label: 'Tahun Baru 2026 Masehi', tipe: 'libur' },
  '2026-1-16': { label: 'Isra Mikraj Nabi Muhammad SAW', tipe: 'libur' },
  '2026-2-16': { label: 'Cuti Bersama Tahun Baru Imlek', tipe: 'cuti' },
  '2026-2-17': { label: 'Tahun Baru Imlek 2577 Kongzili', tipe: 'libur' },
  '2026-3-18': { label: 'Cuti Bersama Hari Suci Nyepi', tipe: 'cuti' },
  '2026-3-19': { label: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', tipe: 'libur' },
  '2026-3-20': { label: 'Cuti Bersama Idulfitri 1447 H', tipe: 'cuti' },
  '2026-3-21': { label: 'Idulfitri 1447 H (1)', tipe: 'libur' },
  '2026-3-22': { label: 'Idulfitri 1447 H (2)', tipe: 'libur' },
  '2026-3-23': { label: 'Cuti Bersama Idulfitri 1447 H', tipe: 'cuti' },
  '2026-3-24': { label: 'Cuti Bersama Idulfitri 1447 H', tipe: 'cuti' },
  '2026-4-3': { label: 'Wafat Yesus Kristus', tipe: 'libur' },
  '2026-4-5': { label: 'Kebangkitan Yesus Kristus (Paskah)', tipe: 'libur' },
  '2026-5-1': { label: 'Hari Buruh Internasional', tipe: 'libur' },
  '2026-5-14': { label: 'Kenaikan Yesus Kristus', tipe: 'libur' },
  '2026-5-15': { label: 'Cuti Bersama Kenaikan Yesus Kristus', tipe: 'cuti' },
  '2026-5-27': { label: 'Iduladha 1447 H', tipe: 'libur' },
  '2026-5-28': { label: 'Cuti Bersama Iduladha 1447 H', tipe: 'cuti' },
  '2026-5-31': { label: 'Hari Raya Waisak 2570 BE', tipe: 'libur' },
  '2026-6-1': { label: 'Hari Lahir Pancasila', tipe: 'libur' },
  '2026-6-16': { label: '1 Muharam / Tahun Baru Islam 1448 H', tipe: 'libur' },
  '2026-8-17': { label: 'Proklamasi Kemerdekaan RI', tipe: 'libur' },
  '2026-8-25': { label: 'Maulid Nabi Muhammad SAW', tipe: 'libur' },
  '2026-12-24': { label: 'Cuti Bersama Natal', tipe: 'cuti' },
  '2026-12-25': { label: 'Kelahiran Yesus Kristus (Natal)', tipe: 'libur' },
};

const JADWAL_LIBUR_DEFAULT = {
  '2026-6-1': [8, 9], '2026-6-6': [4, 5], '2026-6-7': [7, 10], '2026-6-13': [6, 8],
  '2026-6-14': [14, 15], '2026-6-16': [9, 10], '2026-6-20': [12, 13], '2026-6-21': [1, 2],
  '2026-6-27': [3, 4], '2026-6-28': [6, 7], '2026-7-4': [8, 9], '2026-7-5': [14, 15],
  '2026-7-11': [11, 12], '2026-7-12': [5, 1], '2026-7-18': [2, 3], '2026-7-19': [10, 6],
  '2026-7-25': [7, 8], '2026-7-26': [13, 14],
};

function jadwalGetRegu(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return ((Math.round((d - JADWAL_ANCHOR) / 86400000) % 3) + 3) % 3 + 1;
}

function jadwalGenerateLibur(hariLiburMap) {
  const result = Object.assign({}, JADWAL_LIBUR_DEFAULT);
  const pairs = {
    1: [[1, 2], [3, 4], [5, 1], [2, 3], [4, 5]],
    2: [[6, 7], [8, 9], [10, 6], [7, 8], [9, 10]],
    3: [[11, 12], [13, 14], [15, 11], [12, 13], [14, 15]],
  };
  const pairIdx = { 1: 4, 2: 4, 3: 2 };
  for (let yr = 2026; yr <= 2027; yr++) {
    const startM = yr === 2026 ? 7 : 0;
    for (let mo = startM; mo < 12; mo++) {
      const daysInMo = new Date(yr, mo + 1, 0).getDate();
      for (let day = 1; day <= daysInMo; day++) {
        const key = yr + '-' + (mo + 1) + '-' + day;
        if (result[key]) continue;
        const d = new Date(yr, mo, day);
        const delta = Math.round((d - JADWAL_ANCHOR) / 86400000);
        const regu = ((delta % 3) + 3) % 3 + 1;
        const dow = d.getDay();
        const isMerah = !!hariLiburMap[key];
        if (dow !== 0 && dow !== 6 && !isMerah) continue;
        result[key] = pairs[regu][pairIdx[regu] % 5];
        pairIdx[regu]++;
      }
    }
  }
  return result;
}

// ── Crypto helpers (lokal — SENGAJA dipertahankan terpisah dari useAuthStore.js) ──
// Format hash di sini memakai static-salt (name + "_sipamdal_2026"), BUKAN random-salt
// modern yang dipakai hashPin/savePinToFS di useAuthStore.js. Ini disengaja: verifyPinFS
// di useAuthStore.js punya jalur fallback "legacySalt" yang mengenali format static-salt
// ini, lalu auto-migrate ke random-salt saat user login berikutnya. Reset PIN oleh admin
// sengaja menulis format legacy ini agar konsisten dengan jalur migrasi tersebut.
// JANGAN diganti ke hashPin/savePinToFS dari useAuthStore.js tanpa mengubah juga alur
// migrasinya di sana.
async function hashPin(pin, name) {
  const enc = new TextEncoder();
  const salt = enc.encode(name + '_sipamdal_2026');
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMat, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function savePinToFS(name, pin) {
  const pinHash = await hashPin(pin, name);
  await setDoc(doc(db, 'sipamdal_pins', name), { pinHash, updatedAt: new Date().toISOString() });
}

// ── useConfirm ────────────────────────────────────────────────────────────────
// (Sesi 5b asli: dipindah ke app-shell.js — diimpor di atas dari AppShell.jsx, tidak
// didefinisikan lokal di sini agar tidak duplikat. ConfirmDialog sebagai komponen
// terpisah tidak dipakai langsung di file ini — useConfirm() sudah mengembalikan
// instance dialog-nya sebagai elemen ke-2 dari tuple [confirm, confirmDialog].)

// ── JadwalAdminLibur ──────────────────────────────────────────────────────────
function JadwalAdminLibur({ now, jadwalHariLibur, setJadwalHariLibur, setJadwalLiburMap, toast }) {
  const [newLabel, setNewLabel] = useState('');
  const [newTipe, setNewTipe] = useState('libur');
  const [selY, setSelY] = useState(now.getFullYear());
  const [selM, setSelM] = useState(now.getMonth() + 1);
  const [selD, setSelD] = useState(now.getDate());
  const maxDay = new Date(selY, selM, 0).getDate();
  const safeD = Math.min(selD, maxDay);
  const builtKey = selY + '-' + selM + '-' + safeD;
  const exists = !!jadwalHariLibur[builtKey];
  const G = { card: '#ffffff', cardBd: 'rgba(2,132,199,0.12)', cardSh: '0 2px 12px rgba(2,132,199,0.07)', muted: 'var(--tx-muted)' };
  const DD = { background: 'rgba(240,249,255,0.8)', border: '1px solid rgba(2,132,199,0.2)', color: 'var(--tx-primary)', borderRadius: 8, padding: '8px 10px', fontSize: 12, flex: 1 };
  const sorted = Object.entries(jadwalHariLibur)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => {
      const pa = a.key.split('-').map(Number);
      const pb = b.key.split('-').map(Number);
      return new Date(pa[0], pa[1] - 1, pa[2]) - new Date(pb[0], pb[1] - 1, pb[2]);
    });

  const addHl = () => {
    if (!newLabel.trim()) return;
    const updated = { ...jadwalHariLibur, [builtKey]: { label: newLabel.trim(), tipe: newTipe } };
    setJadwalHariLibur(updated);
    try { localStorage.setItem('pamdal_hari_libur', JSON.stringify(updated)); } catch (e) {}
    const newMap = jadwalGenerateLibur(updated);
    setJadwalLiburMap(newMap);
    try { localStorage.setItem('pamdal_jadwal_libur', JSON.stringify(newMap)); } catch (e) {}
    setNewLabel('');
    toast && toast(' Hari libur disimpan!');
  };

  const removeHl = (key) => {
    const next = Object.fromEntries(Object.entries(jadwalHariLibur).filter(([k]) => k !== key));
    setJadwalHariLibur(next);
    try { localStorage.setItem('pamdal_hari_libur', JSON.stringify(next)); } catch (e) {}
    const newMap = jadwalGenerateLibur(next);
    setJadwalLiburMap(newMap);
    try { localStorage.setItem('pamdal_jadwal_libur', JSON.stringify(newMap)); } catch (e) {}
    toast && toast('Hari libur dihapus');
  };

  return (
    <div>
      <div style={{ background: G.card, border: '1px solid ' + G.cardBd, borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: G.cardSh }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tambah / Edit</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select value={selY} onChange={e => setSelY(+e.target.value)} style={{ ...DD, flex: '0 0 72px' }}>
            {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selM} onChange={e => { setSelM(+e.target.value); setSelD(1); }} style={DD}>
            {JADWAL_BULAN_FULL.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
          </select>
          <select value={safeD} onChange={e => setSelD(+e.target.value)} style={{ ...DD, flex: '0 0 54px' }}>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11, color: exists ? 'var(--amber-bright)' : 'var(--tx-muted)', textAlign: 'center', marginBottom: 8 }}>
          {exists ? ' ' + builtKey + ' sudah ada' : ' ' + safeD + ' ' + JADWAL_BULAN_FULL[selM - 1] + ' ' + selY}
        </div>
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Nama hari libur"
          style={{ width: '100%', background: 'rgba(240,249,255,0.8)', border: '1px solid rgba(2,132,199,0.2)', color: 'var(--tx-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['libur', 'cuti'].map(t => (
            <button
              key={t}
              onClick={() => setNewTipe(t)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                borderColor: newTipe === t ? (t === 'libur' ? 'var(--cal-sunday)' : '#F5A623') : 'rgba(2,132,199,0.2)',
                background: newTipe === t ? (t === 'libur' ? 'rgba(239,68,68,0.1)' : 'rgba(251,146,60,0.1)') : 'rgba(255,255,255,0.8)',
                color: newTipe === t ? (t === 'libur' ? 'var(--red-bright)' : 'var(--amber-bright)') : 'var(--tx-muted)',
              }}
            >
              {t === 'libur' ? ' Libur Nasional' : ' Cuti Bersama'}
            </button>
          ))}
        </div>
        <button
          onClick={addHl}
          disabled={!newLabel.trim()}
          style={{
            width: '100%',
            background: newLabel.trim() ? 'var(--accent-2)' : 'var(--disabled-bg)',
            color: newLabel.trim() ? '#fff' : 'var(--tx-ghost)',
            border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700,
            cursor: newLabel.trim() ? 'pointer' : 'default',
          }}
        >
          {exists ? ' Timpa Data' : '+ Tambahkan'}
        </button>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: G.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Daftar ({sorted.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(e => (
          <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: G.card, border: '1px solid rgba(2,132,199,0.12)', borderRadius: 10, padding: '9px 12px' }}>
            <span style={{ fontSize: 14 }}>{e.tipe === 'libur' ? '' : ''}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</div>
              <div style={{ fontSize: 10, color: 'var(--tx-muted)' }}>{e.key}</div>
            </div>
            <button onClick={() => removeHl(e.key)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red-bright)', borderRadius: 6, padding: '8px 10px', fontSize: 11, cursor: 'pointer' }}>
              
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AdminLiburWrapper ─────────────────────────────────────────────────────────
function AdminLiburWrapper({ now, toast }) {
  const [jadwalHariLibur, setJadwalHariLibur] = useState(() => {
    try { const s = localStorage.getItem('pamdal_hari_libur'); return s ? JSON.parse(s) : JADWAL_HARI_LIBUR_DEFAULT; } catch (e) { return JADWAL_HARI_LIBUR_DEFAULT; }
  });
  const [, setJadwalLiburMap] = useState(() => {
    try { const s = localStorage.getItem('pamdal_jadwal_libur'); return s ? JSON.parse(s) : jadwalGenerateLibur(JADWAL_HARI_LIBUR_DEFAULT); } catch (e) { return jadwalGenerateLibur(JADWAL_HARI_LIBUR_DEFAULT); }
  });
  return <JadwalAdminLibur now={now} jadwalHariLibur={jadwalHariLibur} setJadwalHariLibur={setJadwalHariLibur} setJadwalLiburMap={setJadwalLiburMap} toast={toast} />;
}

// ── AdminEditAnggota ──────────────────────────────────────────────────────────
function AdminEditAnggota({ toast }) {
  const [override, setOverride] = useState(() => loadAnggotaOverride());
  const [editing, setEditing] = useState(null);
  const [formHp, setFormHp] = useState('');
  const [formNip, setFormNip] = useState('');
  const reguColors = { 1: 'var(--regu-1-col)', 2: 'var(--amber)', 3: 'var(--violet)' };

  const startEdit = (a) => {
    const ovr = override[a.id] || {};
    setFormHp(ovr.noHp != null ? ovr.noHp : (a.noHp != null ? a.noHp : ''));
    setFormNip(ovr.nip != null ? ovr.nip : (a.nip != null ? a.nip : ''));
    setEditing(a);
  };

  const saveEdit = () => {
    if (!editing) return;
    const updated = { ...override, [editing.id]: { noHp: formHp.trim(), nip: formNip.trim() } };
    setOverride(updated);
    try { localStorage.setItem('pamdal_anggota_override', JSON.stringify(updated)); } catch (e) {}
    toast && toast(' Data ' + editing.nama + ' disimpan');
    setEditing(null);
  };

  const resetOne = (id) => {
    const { [id]: _, ...rest } = override;
    setOverride(rest);
    try { localStorage.setItem('pamdal_anggota_override', JSON.stringify(rest)); } catch (e) {}
    toast && toast('Data direset ke default');
  };

  const INP = { width: '100%', background: 'rgba(240,249,255,0.8)', border: '1px solid rgba(2,132,199,0.25)', color: 'var(--tx-primary)', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  if (editing) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setEditing(null)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Kembali</button>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)' }}>{editing.nama}</span>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(2,132,199,0.15)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Edit Data Kontak</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', display: 'block', marginBottom: 4 }}>No. HP / WhatsApp</label>
            <input value={formHp} onChange={e => setFormHp(e.target.value)} placeholder="08xxxxxxxxxx" type="tel" style={INP} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-muted)', display: 'block', marginBottom: 4 }}>NIP</label>
            <input value={formNip} onChange={e => setFormNip(e.target.value)} placeholder="NIP (kosongkan jika tidak ada)" style={INP} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <BtnSimpan onClick={saveEdit}> Simpan</BtnSimpan>
            <BtnBatal onClick={() => setEditing(null)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--tx-muted)', marginBottom: 10, lineHeight: 1.5 }}>
        Edit no HP & NIP anggota. Data disimpan lokal di perangkat ini.
        <span style={{ display: 'block', fontSize: 10, color: 'var(--tx-ghost)', marginTop: 2 }}> = tanda override aktif</span>
      </div>
      {[1, 2, 3].map(r => (
        <div key={r} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: reguColors[r], marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: reguColors[r] }} />
            REGU {r}
          </div>
          {ANGGOTA_DATA_BASE.filter(a => a.regu === r).map(a => {
            const ovr = override[a.id];
            const hp = (ovr?.noHp != null ? ovr.noHp : a.noHp);
            const nip = (ovr?.nip != null ? ovr.nip : a.nip);
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-surface)', border: '1px solid ' + (ovr ? 'rgba(2,132,199,0.3)' : 'var(--border)'), borderRadius: 10, padding: '10px 12px', marginBottom: 5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>{a.nama}</span>
                    {ovr && <span style={{ fontSize: 10, background: 'rgba(2,132,199,0.12)', color: 'var(--accent-2)', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}> EDITED</span>}
                    {a.jabatan === 'Dan Regu' && <span style={{ fontSize: 10, background: 'rgba(217,119,6,0.12)', color: 'var(--amber-bright)', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>DANRU</span>}
                  </div>
                  {hp && <div style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 2 }}> {hp}</div>}
                  {nip && nip !== '-' && <div style={{ fontSize: 9, color: 'var(--tx-ghost)' }}>NIP: {nip}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button onClick={() => startEdit(a)} style={{ background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', color: 'var(--accent-2)', borderRadius: 6, padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}></button>
                  {ovr && (
                    <button onClick={() => resetOne(a.id)} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--red-bright)', borderRadius: 6, padding: '8px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      <IC n="rot" s={16} c="currentColor" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── AdminUploadAnggota ────────────────────────────────────────────────────────
function AdminUploadAnggota({ toast, confirm }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleUpload = async () => {
    const yes = await confirm({
      title: 'Upload Data Anggota?',
      message: `${ANGGOTA_DATA_BASE.length} anggota akan ditulis ke Firestore (sipamdal_config/anggota). Data yang ada akan ditimpa.`,
      confirmLabel: 'Upload',
      confirmColor: 'var(--accent)',
    });
    if (!yes) return;
    setLoading(true); setStatus(null);
    try {
      await setDoc(doc(db, 'sipamdal_config', 'anggota'), {
        items: ANGGOTA_DATA_BASE,
        updatedAt: Date.now(),
        updatedBy: 'Admin',
      });
      try { localStorage.setItem('pamdal_anggota_fs', JSON.stringify(ANGGOTA_DATA_BASE)); } catch (e) {}
      setStatus('ok');
      toast(' Data anggota berhasil diupload ke Firestore!');
    } catch (e) {
      setStatus('err');
      toast('Gagal upload: ' + e.message, false);
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'var(--bg-base)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-text)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}> Sinkronisasi Firebase</div>
      <div style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 12, lineHeight: 1.5 }}>
        {`Upload ${ANGGOTA_DATA_BASE.length} data anggota dari kode ke Firestore. Lakukan sekali setelah pertama pasang, atau setelah ada perubahan data di kode.`}
      </div>
      <button
        onClick={handleUpload}
        disabled={loading}
        style={{ width: '100%', background: loading ? 'var(--bg-surface)' : 'var(--accent)', color: loading ? 'var(--tx-muted)' : '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
      >
        {loading ? '⏳ Mengupload...' : ' Upload ke Firestore'}
      </button>
      {status === 'ok' && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-text)', fontWeight: 700, textAlign: 'center' }}> Berhasil — semua perangkat akan pakai data Firestore</div>}
      {status === 'err' && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red)', fontWeight: 700, textAlign: 'center' }}> Gagal upload, cek koneksi dan izin Firestore</div>}
    </div>
  );
}

// ── InstruksiFormTab ──────────────────────────────────────────────────────────
export function InstruksiFormTab({ instruksi, setInstruksi, currentUser, toast }) {
  const [instrJudul, setInstrJudul] = useState('');
  const [instrIsi, setInstrIsi] = useState('');
  const [instrPrio, setInstrPrio] = useState('Normal');
  const [instrTgt, setInstrTgt] = useState('Semua');
  const visibel = (instruksi || []).filter(i => i.aktif && !i.selesai);

  const handleKirim = () => {
    if (!instrJudul.trim() || !instrIsi.trim()) { toast('Judul dan isi wajib diisi!', false); return; }
    if (instrJudul.trim().length > 150) { toast('Judul terlalu panjang (maks. 150 karakter)', false); return; }
    if (instrIsi.trim().length > 1000) { toast('Isi instruksi terlalu panjang (maks. 1000 karakter)', false); return; }
    const validPrio = ['Normal', 'Penting', 'Info'];
    if (!validPrio.includes(instrPrio)) { toast('Prioritas tidak valid', false); return; }
    const validTgt = ['Semua', '1', '2', '3'];
    if (!validTgt.includes(instrTgt)) { toast('Target regu tidak valid', false); return; }
    const ins = { id: Date.now(), judul: instrJudul.trim(), isi: instrIsi.trim(), prioritas: instrPrio, targetRegu: instrTgt, aktif: true, ts: Date.now(), dari: currentUser?.name || 'Pimpinan', selesai: false };
    setInstruksi(prev => [ins, ...(prev || [])]);
    setInstrJudul(''); setInstrIsi('');
    toast('Instruksi dikirim!');
  };

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tx-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          {' Instruksi Aktif' + (visibel.length > 0 ? ' (' + visibel.length + ')' : '')}
        </div>
        {visibel.length === 0 ? (
          <div style={{ background: 'var(--accent-tint)', border: '1.5px solid #A5D6A7', borderRadius: 10, padding: '12px', textAlign: 'center', color: 'var(--accent-text)', fontSize: 12, fontWeight: 700 }}>
             Tidak ada instruksi aktif
          </div>
        ) : (
          visibel.map(ins => {
            const col = ins.prioritas === 'Penting' ? 'var(--red)' : 'var(--accent)';
            return (
              <div key={ins.id} style={{ background: 'rgba(0,0,0,.02)', border: '1px solid var(--border)', borderLeft: '3px solid ' + col, borderRadius: '0 8px 8px 0', padding: '8px 10px 8px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: col, marginBottom: 2 }}>{ins.prioritas + ' · ' + ins.judul}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.4 }}>{ins.isi.slice(0, 80) + (ins.isi.length > 80 ? '…' : '')}</div>
                  </div>
                  {ins.targetRegu !== 'Semua' && (
                    <span style={{ fontSize: 9, color: 'var(--tx-muted)', background: 'var(--border)', borderRadius: 4, padding: '1px 5px', marginLeft: 6, flexShrink: 0 }}>Regu {ins.targetRegu}</span>
                  )}
                </div>
                <button
                  onClick={() => { setInstruksi(prev => prev.filter(i => i.id !== ins.id)); toast('Instruksi dihapus.'); }}
                  style={{ marginTop: 4, background: 'rgba(201,27,42,.08)', border: '1px solid rgba(201,27,42,.22)', color: 'var(--red)', borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                   Hapus
                </button>
              </div>
            );
          })
        )}
      </div>
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--red)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}> Buat Instruksi Baru</div>
      <input
        value={instrJudul}
        onChange={e => setInstrJudul(e.target.value)}
        placeholder="Judul instruksi..."
        style={{ width: '100%', background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
      />
      <textarea
        value={instrIsi}
        onChange={e => setInstrIsi(e.target.value)}
        placeholder="Isi instruksi..."
        style={{ width: '100%', minHeight: 70, background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--tx)', fontSize: 12, resize: 'none', boxSizing: 'border-box', outline: 'none', marginBottom: 8, fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['Normal', 'Penting', 'Info'].map(p => (
          <button
            key={p}
            onClick={() => setInstrPrio(p)}
            style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: '1.5px solid ' + (instrPrio === p ? 'var(--accent)' : 'var(--border)'), background: instrPrio === p ? 'var(--accent)' : 'transparent', color: instrPrio === p ? '#fff' : 'var(--tx-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {p}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['Semua', '1', '2', '3'].map(t => (
          <button
            key={t}
            onClick={() => setInstrTgt(t)}
            style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: '1.5px solid ' + (instrTgt === t ? 'var(--accent)' : 'var(--border)'), background: instrTgt === t ? 'var(--accent)' : 'transparent', color: instrTgt === t ? '#fff' : 'var(--tx-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t === 'Semua' ? 'Semua' : 'Regu ' + t}
          </button>
        ))}
      </div>
      <button onClick={handleKirim} style={{ width: '100%', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
         Kirim Instruksi
      </button>
    </div>
  );
}

// ── BroadcastTab ──────────────────────────────────────────────────────────────
export function BroadcastTab({ broadcast, setBroadcast, currentUser, toast, waGrup, setWaGrup }) {
  const [bcText, setBcText] = useState('');
  const [waInput, setWaInput] = useState(waGrup || '');
  const hasBc = broadcast && broadcast.aktif;

  const handleKirimBc = () => {
    if (!bcText.trim()) { toast('Ketik pesan terlebih dahulu!', false); return; }
    if (bcText.trim().length > 500) { toast('Pesan broadcast terlalu panjang (maks. 500 karakter)', false); return; }
    setBroadcast({ aktif: true, pesan: bcText.trim(), pengirim: currentUser?.name || 'Pimpinan', ts: Date.now() });
    setBcText('');
    toast('Pesan terkirim ke anggota!');
  };

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      {/* Setting Link WA Grup */}
      <div style={{ marginBottom: 16, background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.25)', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#128c7e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>⚙️ Link WA Grup Piket</div>
        <div style={{ fontSize: 10, color: 'var(--tx-muted)', marginBottom: 8 }}>
          Isi dengan link WhatsApp grup piket (chat.whatsapp.com/...) atau nomor WA Dan Regu.
        </div>
        <input
          value={waInput}
          onChange={e => setWaInput(e.target.value)}
          placeholder="https://chat.whatsapp.com/... atau 628xxxxxxx"
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(37,211,102,.35)', fontSize: 12, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', background: 'var(--bg-surface)', color: 'var(--tx-primary)' }}
        />
        <button
          onClick={() => { setWaGrup(waInput.trim()); toast('Link WA grup tersimpan!'); }}
          style={{ marginTop: 8, background: '#25d366', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Simpan Link
        </button>
      </div>

      {hasBc && (
        <div style={{ background: 'rgba(14,165,233,.07)', border: '1px solid rgba(4,120,87,.20)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: 'var(--tx-muted)', fontWeight: 700, marginBottom: 3 }}>BROADCAST AKTIF</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.5 }}>{broadcast.pesan}</div>
          {broadcast.pengirim && <div style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 4, fontStyle: 'italic' }}>— {broadcast.pengirim}</div>}
          {broadcast.ts && (
            <div style={{ fontSize: 9.5, color: 'var(--tx-ghost)', marginTop: 2 }}>
              {new Date(broadcast.ts).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
            </div>
          )}
          <button
            onClick={() => { setBroadcast(null); toast('Broadcast dihapus.'); }}
            style={{ marginTop: 8, background: 'rgba(201,27,42,.08)', border: '1px solid rgba(201,27,42,.22)', color: 'var(--red)', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
             Hapus Broadcast
          </button>
        </div>
      )}
      {!hasBc && (
        <div style={{ background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.20)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 11, color: 'var(--tx-muted)', textAlign: 'center' }}>
          Belum ada broadcast aktif
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-text)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}> Kirim Broadcast Baru</div>
        <textarea
          value={bcText}
          onChange={e => setBcText(e.target.value)}
          placeholder="Ketik pesan broadcast ke semua anggota..."
          style={{ width: '100%', minHeight: 100, background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 9, padding: '9px 12px', color: 'var(--tx)', fontSize: 12, resize: 'none', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={handleKirimBc} style={{ marginTop: 8, width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 9, padding: '10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
           Kirim Broadcast
        </button>
      </div>
    </div>
  );
}

// ── AdminMemberTab ────────────────────────────────────────────────────────────
export function AdminMemberTab({ patrols, standJaga, incidents, mutations, toast, instruksi, setInstruksi, broadcast, setBroadcast, currentUser }) {
  const [confirm, confirmDialog] = useConfirm();
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeTab, setActiveTab] = useState('progres');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newResetPin, setNewResetPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinMap, setPinMap] = useState({});
  const [migrasiLoading, setMigrasiLoading] = useState(false);
  const [migrasiResult, setMigrasiResult] = useState(null);
  const [resetDataOpen, setResetDataOpen] = useState(false);
  const [resetDataPin, setResetDataPin] = useState('');
  const [resetDataLoading, setResetDataLoading] = useState(false);
  const [resetDataItems, setResetDataItems] = useState({
    patroli: true, insiden: true, paket: true, tamu: true,
    mutasi: true, instruksi: false, inventaris: false, libur: false,
    pos: true, audit: true, login: true, pins: false,
  });
  const today = new Date();
  const reguColors = { 1: 'var(--regu-1-col)', 2: 'var(--amber)', 3: 'var(--violet)' };

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const q = query(collection(db, 'sipamdal_audit'), orderBy('tsLocal', 'desc'), limit(50));
      const snap = await getDocs(q);
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const q2 = query(collection(db, 'sipamdal_login_history'), orderBy('tsLocal', 'desc'), limit(30));
      const snap2 = await getDocs(q2);
      setLoginHistory(snap2.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoadingAudit(false);
  };

  useEffect(() => { if (activeTab === 'audit') loadAudit(); }, [activeTab]);
  useEffect(() => {
    try { const s = localStorage.getItem('pad_pins'); if (s) setPinMap(JSON.parse(s)); } catch (_) {}
  }, []);

  const handleResetPin = async () => {
    if (!resetTarget) return;
    if (newResetPin.length !== 6 || !/^\d{6}$/.test(newResetPin)) { toast('PIN harus 6 angka!', false); return; }
    const yes = await confirm({ title: 'Reset PIN?', message: `PIN ${resetTarget.name} akan direset ke ${newResetPin}. Tindakan ini tidak bisa dibatalkan.`, confirmLabel: 'Reset PIN', confirmColor: 'var(--red)' });
    if (!yes) return;
    setIsSavingPin(true);
    try {
      await savePinToFS(resetTarget.name, newResetPin);
      const updated = { ...pinMap, [resetTarget.name]: newResetPin };
      setPinMap(updated);
      try { localStorage.setItem('pad_pins', JSON.stringify(updated)); } catch (_) {}
      auditAction('Admin', 0, 'RESET_PIN', 'Reset PIN ' + resetTarget.name);
      toast(' PIN ' + resetTarget.name + ' berhasil direset ke ' + newResetPin);
      setResetTarget(null); setNewResetPin('');
    } catch {
      toast('❌ Gagal menyimpan PIN. Periksa koneksi lalu coba lagi.', false);
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleRunMigration = async () => {
    setMigrasiLoading(true);
    setMigrasiResult(null);
    try {
      const result = await runPinMigration();
      setMigrasiResult(result);
      auditAction('Admin', 0, 'MIGRASI_PIN', `migrated:${result.migrated.length} skipped:${result.skipped.length} errors:${result.errors.length}`);
      if (result.errors.length > 0) {
        toast(`Migrasi selesai — ${result.migrated.length} berhasil, ${result.errors.length} error.`, false);
      } else {
        toast(`Migrasi selesai — ${result.migrated.length} dimigrasikan.`);
      }
    } catch (e) {
      toast('❌ Migrasi gagal: ' + (e.message || 'periksa koneksi'), false);
    } finally {
      setMigrasiLoading(false);
    }
  };

  const handleResetData = async () => {
    const savedPin = pinMap['Admin'] || localStorage.getItem('pad_admin_pin') || '000000';
    if (resetDataPin !== savedPin) { toast('PIN Admin salah!', false); return; }
    setResetDataLoading(true);
    const LS_MAP = {
      patroli: 'pad_patrol', insiden: 'pad_inc', paket: 'pad_pkg', tamu: 'pad_guest',
      mutasi: 'pad_mut', instruksi: 'pad_instruksi', inventaris: 'pad_inv_cek', libur: 'pad_libur', pos: 'pad_pos_',
    };
    const FS_COLLECTIONS = { audit: 'sipamdal_audit', login: 'sipamdal_login_history' };
    let fsError = false;
    try {
      for (const [key, lsKey] of Object.entries(LS_MAP)) {
        if (!resetDataItems[key]) continue;
        if (key === 'pos') Object.keys(localStorage).filter(k => k.startsWith('pad_pos_')).forEach(k => localStorage.removeItem(k));
        else localStorage.removeItem(lsKey);
      }
      if (resetDataItems.pins) { localStorage.removeItem('pad_pins'); localStorage.removeItem('pad_admin_pin'); }

      for (const [key, colName] of Object.entries(FS_COLLECTIONS)) {
        if (!resetDataItems[key]) continue;
        try { const snap = await getDocs(collection(db, colName)); await Promise.all(snap.docs.map(d => deleteDoc(d.ref))); }
        catch (_) { fsError = true; }
      }
      const mainKeys = [];
      if (resetDataItems.patroli) {
        try {
          const snap = await getDocs(collection(db, 'sipamdal_patrol'));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
          Object.keys(localStorage).filter(k => k.startsWith('pad_patrol_photo_')).forEach(k => localStorage.removeItem(k));
        } catch (_) { fsError = true; }
      }
      if (resetDataItems.insiden) mainKeys.push('pad_inc');
      if (resetDataItems.paket) mainKeys.push('pad_pkg');
      if (resetDataItems.tamu) mainKeys.push('pad_guest');
      if (resetDataItems.mutasi) mainKeys.push('pad_mut');
      if (resetDataItems.instruksi) mainKeys.push('pad_instruksi');
      if (resetDataItems.libur) mainKeys.push('pad_libur');
      if (resetDataItems.inventaris) mainKeys.push('pad_inv_daftar', 'pad_inv_cek');
      for (const k of mainKeys) {
        try { await setDoc(doc(db, 'sipamdal', k), { items: [] }); }
        catch (_) { fsError = true; }
      }
      if (resetDataItems.pos) {
        try {
          const snap = await getDocs(collection(db, 'sipamdal'));
          await Promise.all(snap.docs.filter(d => d.id.startsWith('pad_pos_')).map(d => deleteDoc(d.ref)));
        } catch (_) { fsError = true; }
      }

      setResetDataLoading(false); setResetDataOpen(false); setResetDataPin('');
      if (fsError) toast(' Data lokal dihapus, sebagian Firebase gagal. Refresh otomatis...', false);
      else toast(' Data berhasil dihapus! Memuat ulang...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setResetDataLoading(false);
      toast(' Terjadi kesalahan: ' + e.message, false);
    }
  };

  const ACTION_COL = { LOGIN: 'var(--accent)', LOGOUT: 'var(--tx-ghost)', AUTO_LOGOUT: 'var(--amber)', GANTI_PIN: 'var(--violet)', RESET_PIN: 'var(--red)' };
  const ACTION_ICON = { LOGIN: '', LOGOUT: '', AUTO_LOGOUT: '⏱', GANTI_PIN: '', RESET_PIN: '' };

  const getMemberStats = (name) => {
    const myP = patrols.filter(p => p.officer && p.officer.includes(name));
    const myPT = myP.filter(p => new Date(p.ts).toDateString() === today.toDateString());
    const myS = standJaga.filter(s => s.officer && s.officer.includes(name));
    const myST = myS.filter(s => new Date(s.ts).toDateString() === today.toDateString());
    const myI = incidents.filter(i => i.officer && i.officer.includes(name));
    return { patrols: myP.length, patrolsToday: myPT.length, stand: myS.length, standToday: myST.length, incidents: myI.length, score: myPT.length * 10 + myST.length * 5 };
  };

  // ── Detail member ──
  if (selectedMember) {
    const m = selectedMember;
    const bio = getBiodata(m.name) || {};
    const stats = getMemberStats(m.name);
    const myP = patrols.filter(p => p.officer && p.officer.includes(m.name));
    const myS = standJaga.filter(s => s.officer && s.officer.includes(m.name));
    const col = reguColors[m.regu];
    return (
      <div>
        {confirmDialog}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <button onClick={() => setSelectedMember(null)} style={{ background: 'var(--accent-tint)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--accent-text)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Kembali</button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--tx)' }}>{m.name}</h2>
        </div>
        <div style={{ background: col, borderRadius: 14, padding: '16px 18px', marginBottom: 14, color: '#fff' }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{m.name}</div>
          <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>{(bio.jabatan || 'Anggota') + ' · Regu ' + m.regu}</div>
          {bio.nip && bio.nip !== '-' && <div style={{ fontSize: 10.5, opacity: .7, marginTop: 1 }}>{'NIP: ' + bio.nip}</div>}
          <div style={{ fontSize: 12, opacity: .75, marginTop: 1 }}>{'Skor Hari Ini: ' + stats.score + ' poin'}</div>
          {bio.noHp && (
            <a
              href={waLink(bio.noHp, 'Halo ' + m.name + ', saya dari SIPAMDAL BBPKA II Jatinangor.')}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'rgba(255,255,255,0.22)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 99, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            >
              <span></span>{bio.noHp}
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          {[['patrolsToday', 'Patroli Hari Ini'], ['standToday', 'Stand Hari Ini'], ['patrols', 'Total Patroli'], ['incidents', 'Insiden']].map(([k, l]) => (
            <div key={k} style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{stats[k]}</div>
              <div style={{ fontSize: 10 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border2)', borderRadius: 12, padding: '12px 14px', marginBottom: 12, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-text)', marginBottom: 8 }}>{'Log Patroli (' + myP.length + ')'}</div>
          {myP.length === 0 && <div style={{ fontSize: 12, color: 'var(--tx-muted)' }}>Belum ada</div>}
          {[...myP].reverse().slice(0, 10).map(p => (
            <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--tx)' }}>{p.areas == null ? undefined : p.areas.join(', ')}</div>
              <div style={{ color: 'var(--tx-muted)', fontSize: 10.5 }}>{new Date(p.ts).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + p.pos}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border2)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-text)', marginBottom: 8 }}>{'Log Stand Jaga (' + myS.length + ')'}</div>
          {myS.length === 0 && <div style={{ fontSize: 12, color: 'var(--tx-muted)' }}>Belum ada</div>}
          {[...myS].reverse().slice(0, 10).map(s => (
            <div key={s.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--tx)' }}>{s.area}</div>
              <div style={{ color: 'var(--tx-muted)', fontSize: 10.5 }}>{new Date(s.ts).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + s.pos}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Jadwal sub-tab (inline, tanpa import JadwalTab penuh) ──
  const renderJadwal = () => {
    const now2 = today;
    const pimTodayRegu = jadwalGetRegu(now2);
    const pimTodayKey = now2.getFullYear() + '-' + (now2.getMonth() + 1) + '-' + now2.getDate();
    const pimLiburIds = (() => { try { const s = localStorage.getItem('pamdal_jadwal_libur'); const m = s ? JSON.parse(s) : null; return m ? m[pimTodayKey] || [] : JADWAL_LIBUR_DEFAULT[pimTodayKey] || []; } catch (e) { return []; } })();
    const pimHariLibur = (() => { try { const s = localStorage.getItem('pamdal_hari_libur'); const m = s ? JSON.parse(s) : null; return m ? m[pimTodayKey] : JADWAL_HARI_LIBUR_DEFAULT[pimTodayKey]; } catch (e) { return null; } })();
    const pimPiket = ANGGOTA_DATA.items.filter(a => a.regu === pimTodayRegu && !pimLiburIds.includes(a.id));
    const pimLibur = ANGGOTA_DATA.items.filter(a => a.regu === pimTodayRegu && pimLiburIds.includes(a.id));
    const rc = JADWAL_RC[pimTodayRegu];
    return (
      <div>
        <div style={{ background: rc.accent, borderRadius: 12, color: '#fff', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, opacity: .8 }}>{now2.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{'REGU ' + pimTodayRegu + ' PIKET'}</div>
            {pimHariLibur && (
              <div style={{ fontSize: 10, background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '3px 8px', display: 'inline-block', marginTop: 4 }}>
                {(pimHariLibur.tipe === 'libur' ? '' : '') + ' ' + pimHariLibur.label}
              </div>
            )}
          </div>
          <div style={{ padding: '8px 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {pimPiket.map(a => (
              <span key={a.id} style={{ background: 'rgba(255,255,255,.22)', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>
                {(a.jabatan === 'Dan Regu' ? ' ' : '') + a.nama}
              </span>
            ))}
            {pimLibur.map(a => (
              <span key={a.id} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 600, textDecoration: 'line-through', opacity: .65 }}>
                {' ' + a.nama}
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Susunan Semua Regu</div>
        {[1, 2, 3].map(r => {
          const c = JADWAL_RC[r];
          const members = ANGGOTA_DATA.items.filter(a => a.regu === r);
          const dan = members.find(a => a.jabatan === 'Dan Regu');
          const isToday = r === pimTodayRegu;
          return (
            <div key={r} style={{ background: isToday ? c.bg : 'var(--bg-surface)', border: '1.5px solid ' + (isToday ? c.accent + '50' : 'var(--border)'), borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ background: isToday ? c.accent : 'rgba(2,132,199,0.06)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: isToday ? '#fff' : c.accent }}>{c.label + ' Regu ' + r}</span>
                  {dan && <span style={{ fontSize: 10, color: isToday ? 'rgba(255,255,255,.8)' : 'var(--tx-muted)' }}>{'· Dan: ' + dan.nama.split(' ')[0]}</span>}
                </div>
                {isToday && <span style={{ background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 700 }}>PIKET HARI INI</span>}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {members.map(a => {
                    const isLibur = isToday && pimLiburIds.includes(a.id);
                    return (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: isLibur ? 'rgba(217,119,6,0.08)' : isToday ? 'rgba(255,255,255,0.7)' : 'var(--bg-base)',
                          border: '1px solid ' + (isLibur ? 'rgba(217,119,6,0.3)' : isToday ? c.accent + '25' : 'var(--border)'),
                          borderRadius: 7, padding: '4px 8px',
                        }}
                      >
                        <span style={{ fontSize: 9 }}>{a.jabatan === 'Dan Regu' ? '' : isLibur ? '' : ''}</span>
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: isLibur ? 'var(--amber-dark)' : 'var(--tx)', textDecoration: isLibur ? 'line-through' : 'none' }}>{a.nama.split(' ')[0]}</div>
                          <div style={{ fontSize: 10, color: 'var(--tx-ghost)' }}>{a.jabatan === 'Dan Regu' ? 'Dan Regu' : isLibur ? 'Libur' : 'Anggota'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Main render ──
  return (
    <div>
      {confirmDialog}
      <PH title="Anggota & Keamanan" sub="Progres, audit log, dan manajemen PIN" />

      {/* Sub-tab bar */}
      <div className="subtab-bar">
        {[
          { id: 'progres', label: ' Progres' },
          { id: 'instruksi', label: ' Instruksi' },
          { id: 'broadcast', label: ' Broadcast' },
          { id: 'jadwal', label: ' Jadwal' },
          { id: 'edit', label: ' Edit' },
          { id: 'audit', label: ' Audit' },
          { id: 'pin', label: ' PIN' },
          { id: 'reset', label: ' Reset' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={'subtab-btn' + (activeTab === t.id ? ' active' : '')}>{t.label}</button>
        ))}
      </div>

      {/* ── Progres ── */}
      {activeTab === 'progres' && [1, 2, 3].map(r => (
        <div key={r} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: reguColors[r], marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: reguColors[r] }} />
            REGU {r}
          </div>
          {REGU[r].map(name => {
            const stats = getMemberStats(name);
            const bio = getBiodata(name) || {};
            return (
              <div key={name} onClick={() => setSelectedMember({ name, regu: r })} className="member-card" style={{ borderColor: `${reguColors[r]}25` }}>
                <div style={{ width: 42, height: 42, background: `${reguColors[r]}15`, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {name}
                    {bio.jabatan === 'Dan Regu' && <span style={{ fontSize: 9, fontWeight: 700, background: reguColors[r] + '22', color: reguColors[r], borderRadius: 99, padding: '1px 6px' }}>DANRU</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 2 }}>{'Hari ini: ' + stats.patrolsToday + ' patroli · ' + stats.standToday + ' stand'}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx-muted)' }}>{'Total: ' + stats.patrols + ' patroli · ' + stats.incidents + ' insiden'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: reguColors[r] }}>{stats.score}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--tx-muted)' }}>poin</div>
                  </div>
                  {bio.noHp && (
                    <a
                      href={waLink(bio.noHp, 'Halo ' + name + ', saya dari SIPAMDAL BBPKA II Jatinangor.')}
                      target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#25d36615', border: '1px solid #25d36640', borderRadius: 99, padding: '4px 9px', color: 'var(--whatsapp-dark)', fontSize: 10, fontWeight: 700, textDecoration: 'none' }}
                    >
                       WA
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Instruksi ── */}
      {activeTab === 'instruksi' && <InstruksiFormTab instruksi={instruksi} setInstruksi={setInstruksi} currentUser={currentUser} toast={toast} />}

      {/* ── Broadcast ── */}
      {activeTab === 'broadcast' && <BroadcastTab broadcast={broadcast} setBroadcast={setBroadcast} currentUser={currentUser} toast={toast} />}

      {/* ── Jadwal ── */}
      {activeTab === 'jadwal' && renderJadwal()}

      {/* ── Edit ── */}
      {activeTab === 'edit' && (
        <div>
          <AdminEditAnggota toast={toast} />
          <div style={{ height: 1, background: 'rgba(2,132,199,0.1)', margin: '16px 0' }} />
          <AdminUploadAnggota toast={toast} confirm={confirm} />
          <div style={{ height: 1, background: 'rgba(2,132,199,0.1)', margin: '16px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}> Hari Libur / Tanggal Merah</div>
          <AdminLiburWrapper now={today} toast={toast} />
        </div>
      )}

      {/* ── Audit ── */}
      {activeTab === 'audit' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx-secondary)' }}>{'Riwayat Aksi (' + auditLogs.length + ')'}</div>
            <button onClick={loadAudit} style={{ background: 'rgba(var(--orb-rgb),.1)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', fontFamily: 'inherit' }}>↺ Refresh</button>
          </div>
          {loadingAudit && <div style={{ textAlign: 'center', padding: 20, color: 'var(--tx-muted)', fontSize: 12 }}>Memuat...</div>}
          {!loadingAudit && auditLogs.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--tx-muted)', fontSize: 12 }}>Belum ada log</div>}
          {!loadingAudit && auditLogs.map(log => (
            <div key={log.id} className="audit-card">
              <span style={{ fontSize: 18, flexShrink: 0 }}>{ACTION_ICON[log.action] || ''}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: ACTION_COL[log.action] || 'var(--accent)', background: (ACTION_COL[log.action] || 'var(--accent)') + '15', borderRadius: 5, padding: '2px 7px' }}>{log.action}</span>
                  <span style={{ fontSize: 10, color: 'var(--tx-muted)' }}>{log.tsLocal ? new Date(log.tsLocal).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx-secondary)', marginTop: 3 }}>{log.actor}{log.regu ? ' · Regu ' + log.regu : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 1 }}>{log.detail}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx-secondary)', marginTop: 18, marginBottom: 10 }}>{'Riwayat Login (' + loginHistory.length + ')'}</div>
          {!loadingAudit && loginHistory.map(log => (
            <div key={log.id} style={{ background: 'var(--accent-tint)', border: '1.5px solid #C8E6C9', borderRadius: 10, padding: '9px 12px', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent-text)' }}>{log.name}</span>
                <span style={{ fontSize: 10, color: 'var(--tx-muted)' }}>{log.tsLocal ? new Date(log.tsLocal).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--tx-muted)', marginTop: 1 }}>
                {(log.isAdmin ? 'Admin' : log.isPimpinan ? 'Pimpinan' : 'Regu ' + log.regu) + ' · ' + (log.device || '').slice(0, 40)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PIN ── */}
      {activeTab === 'pin' && (
        <div>
          <div style={{ background: 'rgba(var(--amber-rgb),.07)', border: '1.5px solid #FDD87A', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--amber)' }}>
            {' Reset PIN hanya untuk admin. PIN default baru: '}<strong>123456</strong>
          </div>
          {[1, 2, 3].map(r => (
            <div key={r} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: reguColors[r], marginBottom: 8 }}>{'REGU ' + r}</div>
              {REGU[r].map(name => {
                const bio = getBiodata(name) || {};
                return (
                  <div key={name} className="data-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx-secondary)' }}>{name}</div>
                      <div style={{ fontSize: 10, color: 'var(--tx-muted)' }}>{bio.jabatan || 'Anggota'}</div>
                      <div style={{ fontSize: 10, color: 'var(--tx-ghost)' }}>PIN tersimpan di Firestore</div>
                    </div>
                    <button onClick={() => setResetTarget({ name, regu: r })} style={{ background: 'rgba(201,27,42,.1)', border: '1.5px solid #FFCDD2', borderRadius: 7, padding: '8px 11px', fontSize: 11, fontWeight: 700, color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>Reset</button>
                  </div>
                );
              })}
            </div>
          ))}
          {resetTarget && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--tx-secondary)', marginBottom: 4 }}>Reset PIN</div>
                <div style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 14 }}>{resetTarget.name + ' · Regu ' + resetTarget.regu}</div>
                <input
                  value={newResetPin}
                  onChange={e => setNewResetPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  type="tel"
                  placeholder="PIN baru 6 digit"
                  style={{ width: '100%', border: '1.5px solid var(--border2)', borderRadius: 9, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <BtnSimpan onClick={handleResetPin} color="var(--red)" loading={isSavingPin}>Simpan PIN</BtnSimpan>
                  <BtnBatal onClick={() => { setResetTarget(null); setNewResetPin(''); }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Migrasi PIN Legacy ── */}
      {activeTab === 'reset' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1.5px solid var(--border2)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--tx-secondary)', marginBottom: 4 }}>🔑 Migrasi PIN Legacy</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx-muted)', lineHeight: 1.6, marginBottom: 10 }}>
              Scan dokumen PIN di Firestore dan migrate format lama ke PBKDF2+random salt.
              PIN dengan static-salt akan migrate otomatis saat user login berikutnya.
            </div>
            <button
              onClick={handleRunMigration}
              disabled={migrasiLoading}
              style={{ width: '100%', padding: '11px', background: migrasiLoading ? 'var(--tx-ghost)' : 'var(--accent)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 900, cursor: migrasiLoading ? 'wait' : 'pointer', fontFamily: 'inherit' }}
            >
              {migrasiLoading ? '⏳ Memproses...' : '🔄 Jalankan Migrasi PIN'}
            </button>
            {migrasiResult && (
              <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.8 }}>
                <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{`✅ Dimigrasikan: ${migrasiResult.migrated.length}`}</div>
                {migrasiResult.migrated.map(r => <div key={r.name} style={{ color: 'var(--tx-muted)', paddingLeft: 12 }}>{`• ${r.name} (${r.from})`}</div>)}
                <div style={{ color: 'var(--tx-secondary)', fontWeight: 700 }}>{`⏭ Dilewati: ${migrasiResult.skipped.length}`}</div>
                {migrasiResult.skipped.map(r => <div key={r.name} style={{ color: 'var(--tx-muted)', paddingLeft: 12 }}>{`• ${r.name} — ${r.reason}`}</div>)}
                {migrasiResult.errors.length > 0 && <div style={{ color: 'var(--red)', fontWeight: 700 }}>{`❌ Error: ${migrasiResult.errors.length}`}</div>}
                {migrasiResult.errors.map(r => <div key={r.name} style={{ color: 'var(--red)', paddingLeft: 12, fontSize: 11 }}>{`• ${r.name}: ${r.error}`}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Reset ── */}
      {activeTab === 'reset' && (
        <div>
          <div style={{ background: 'rgba(201,27,42,.08)', border: '1.5px solid #FFCDD2', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--red)', marginBottom: 4 }}> Zona Bahaya</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx-secondary)', lineHeight: 1.6 }}>
              Fitur ini menghapus data permanen dari Firebase & perangkat. Gunakan sebelum launching untuk memulai dengan data bersih. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
            </div>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx-secondary)', marginBottom: 10 }}>Pilih Data yang Dihapus:</div>
            {[
              { key: 'patroli', label: ' Data Patroli', desc: 'Semua catatan patroli' },
              { key: 'insiden', label: ' Data Insiden', desc: 'Semua laporan insiden' },
              { key: 'paket', label: ' Data Paket', desc: 'Riwayat paket masuk/keluar' },
              { key: 'tamu', label: ' Data Tamu', desc: 'Riwayat tamu menginap' },
              { key: 'mutasi', label: ' Laporan Mutasi', desc: 'Semua laporan serah terima' },
              { key: 'pos', label: ' Penempatan Pos', desc: 'Semua data posisi anggota' },
              { key: 'audit', label: ' Audit Log', desc: 'Log aktivitas sistem (Firestore)' },
              { key: 'login', label: ' Riwayat Login', desc: 'Log login semua pengguna' },
              { key: 'instruksi', label: ' Instruksi Pimpinan', desc: 'Semua instruksi yang tersimpan' },
              { key: 'libur', label: ' Data Libur', desc: 'Pengaturan hari libur tambahan' },
              { key: 'inventaris', label: ' Cek Inventaris', desc: 'Riwayat cek inventaris' },
              { key: 'pins', label: ' Semua PIN', desc: 'Reset PIN ke default (hati-hati!)' },
            ].map(item => (
              <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <div
                  style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${resetDataItems[item.key] ? 'var(--red)' : 'var(--border2)'}`, background: resetDataItems[item.key] ? 'var(--red)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}
                  onClick={() => setResetDataItems(p => ({ ...p, [item.key]: !p[item.key] }))}
                >
                  {resetDataItems[item.key] && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}></span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: resetDataItems[item.key] ? 'var(--red)' : 'var(--tx)' }}>{item.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--tx-muted)' }}>{item.desc}</div>
                </div>
              </label>
            ))}
            <button onClick={() => setResetDataOpen(true)} style={{ width: '100%', padding: '13px', background: 'var(--red)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: .5 }}> Hapus Data Terpilih</button>
          </div>
          {resetDataOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 18, padding: 22, width: '100%', maxWidth: 340, boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--red)', marginBottom: 6 }}> Konfirmasi Hapus</div>
                <div style={{ fontSize: 12, color: 'var(--tx-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  Masukkan <strong>PIN Admin</strong> untuk mengkonfirmasi penghapusan. Data yang dihapus tidak bisa dikembalikan.
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-secondary)', marginBottom: 6 }}>Data yang akan dihapus:</div>
                <div style={{ background: 'rgba(201,27,42,.06)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 11, color: 'var(--red)', lineHeight: 1.8 }}>
                  {Object.entries(resetDataItems).filter(([, v]) => v).map(([k]) => ({
                    patroli: ' Patroli', insiden: ' Insiden', paket: ' Paket', tamu: ' Tamu',
                    mutasi: ' Mutasi', pos: ' Penempatan Pos', audit: ' Audit Log', login: ' Login History',
                    instruksi: ' Instruksi', libur: ' Libur', inventaris: ' Inventaris', pins: ' Semua PIN',
                  }[k] || k)).join(' · ')}
                </div>
                <input
                  type="tel"
                  placeholder="PIN Admin (6 digit)"
                  value={resetDataPin}
                  onChange={e => setResetDataPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ width: '100%', border: '2px solid #D93025', borderRadius: 10, padding: '11px 14px', fontSize: 16, fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box', textAlign: 'center', letterSpacing: 4, color: 'var(--tx)', background: 'var(--bg-raised)' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <BtnBatal onClick={() => { setResetDataOpen(false); setResetDataPin(''); }} />
                  <button
                    onClick={handleResetData}
                    disabled={resetDataLoading || resetDataPin.length !== 6}
                    style={{ flex: 2, padding: 11, background: resetDataLoading || resetDataPin.length !== 6 ? 'var(--tx-ghost)' : 'var(--red)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 900, fontSize: 13, cursor: resetDataLoading ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                  >
                    {resetDataLoading ? '⏳ Menghapus...' : ' Hapus Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
