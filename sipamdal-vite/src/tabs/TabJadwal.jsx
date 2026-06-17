// TabJadwal.jsx — SIPAMDAL
// Migrasi dari tab-jadwal.js (CDN) → Vite + React JSX + Zustand
// Sesi 3: Tab Jadwal Piket
//
// Perubahan dari versi CDN:
//   - `const { useState, ... } = React` → named imports dari 'react'
//   - `React.createElement(...)` → JSX
//   - `localStorage` untuk jadwalLiburMap tetap (bukan Firestore)
//   - `ReactDOM.createPortal` → import dari 'react-dom'
//   - PosTab & PatrolTab di sini tetap (milik tab-jadwal di sumber asli)
//   - Export: JadwalTab (default), JADWAL_LIBUR_DEFAULT, jadwalGenerateLibur

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';

import {
  REGU,
  ANGGOTA_DATA,
  POS_LIST,
  POS_CAP,
  POS_COL,
  PATROL_AREAS,
  fmtT,
  getReguHari,
  cRgba,
  kompressFoto,
  getPos,
} from '../utils/utils.js';

import {
  Modal,
  Inp,
  Btn,
  Bdg,
  PH,
  IC,
  CamScanner,
  ReadOnlyBanner,
  useInnerModal,
} from '../components/ui/UiComponents.jsx';

import { QRSvg } from '../engine/QrEngine.jsx';

import styles from './TabJadwal.module.css';

// ── Konstanta jadwal ──────────────────────────────────────────────────────────
const JADWAL_ANCHOR      = new Date(2026, 5, 6); // 6 Juni 2026
const JADWAL_HARI        = ['Ahd','Sen','Sel','Rab','Kam','Jum','Sab'];
const JADWAL_BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
const JADWAL_BULAN_FULL  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const JADWAL_RC = {
  1: { accent: 'var(--regu-1-col)', bg: 'rgba(13,148,136,0.10)',  label: '①' },
  2: { accent: 'var(--accent)',     bg: 'rgba(5,150,105,0.10)',    label: '②' },
  3: { accent: 'var(--amber-bright)', bg: 'rgba(217,119,6,0.10)', label: '③' },
};

const JADWAL_HARI_LIBUR_DEFAULT = {
  '2026-1-1':  { label: 'Tahun Baru 2026 Masehi',                tipe: 'libur' },
  '2026-1-16': { label: 'Isra Mikraj Nabi Muhammad SAW',          tipe: 'libur' },
  '2026-2-16': { label: 'Cuti Bersama Tahun Baru Imlek',          tipe: 'cuti'  },
  '2026-2-17': { label: 'Tahun Baru Imlek 2577 Kongzili',         tipe: 'libur' },
  '2026-3-18': { label: 'Cuti Bersama Hari Suci Nyepi',           tipe: 'cuti'  },
  '2026-3-19': { label: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', tipe: 'libur' },
  '2026-3-20': { label: 'Cuti Bersama Idulfitri 1447 H',          tipe: 'cuti'  },
  '2026-3-21': { label: 'Idulfitri 1447 H (1)',                   tipe: 'libur' },
  '2026-3-22': { label: 'Idulfitri 1447 H (2)',                   tipe: 'libur' },
  '2026-3-23': { label: 'Cuti Bersama Idulfitri 1447 H',          tipe: 'cuti'  },
  '2026-3-24': { label: 'Cuti Bersama Idulfitri 1447 H',          tipe: 'cuti'  },
  '2026-4-3':  { label: 'Wafat Yesus Kristus',                    tipe: 'libur' },
  '2026-4-5':  { label: 'Kebangkitan Yesus Kristus (Paskah)',     tipe: 'libur' },
  '2026-5-1':  { label: 'Hari Buruh Internasional',               tipe: 'libur' },
  '2026-5-14': { label: 'Kenaikan Yesus Kristus',                 tipe: 'libur' },
  '2026-5-15': { label: 'Cuti Bersama Kenaikan Yesus Kristus',    tipe: 'cuti'  },
  '2026-5-27': { label: 'Iduladha 1447 H',                        tipe: 'libur' },
  '2026-5-28': { label: 'Cuti Bersama Iduladha 1447 H',           tipe: 'cuti'  },
  '2026-5-31': { label: 'Hari Raya Waisak 2570 BE',               tipe: 'libur' },
  '2026-6-1':  { label: 'Hari Lahir Pancasila',                   tipe: 'libur' },
  '2026-6-16': { label: '1 Muharam / Tahun Baru Islam 1448 H',    tipe: 'libur' },
  '2026-8-17': { label: 'Proklamasi Kemerdekaan RI',              tipe: 'libur' },
  '2026-8-25': { label: 'Maulid Nabi Muhammad SAW',               tipe: 'libur' },
  '2026-12-24':{ label: 'Cuti Bersama Natal',                     tipe: 'cuti'  },
  '2026-12-25':{ label: 'Kelahiran Yesus Kristus (Natal)',         tipe: 'libur' },
};

export const JADWAL_LIBUR_DEFAULT = {
  '2026-6-1':[8,9],'2026-6-6':[4,5],'2026-6-7':[7,10],'2026-6-13':[6,8],
  '2026-6-14':[14,15],'2026-6-16':[9,10],'2026-6-20':[12,13],'2026-6-21':[1,2],
  '2026-6-27':[3,4],'2026-6-28':[6,7],'2026-7-4':[8,9],'2026-7-5':[14,15],
  '2026-7-11':[11,12],'2026-7-12':[5,1],'2026-7-18':[2,3],'2026-7-19':[10,6],
  '2026-7-25':[7,8],'2026-7-26':[13,14],
};

// ── Helper functions ──────────────────────────────────────────────────────────
function jadwalGetRegu(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return ((Math.round((d - JADWAL_ANCHOR) / 86400000) % 3) + 3) % 3 + 1;
}

export function jadwalGenerateLibur(hariLiburMap) {
  const result = Object.assign({}, JADWAL_LIBUR_DEFAULT);
  const pairs = {
    1: [[1,2],[3,4],[5,1],[2,3],[4,5]],
    2: [[6,7],[8,9],[10,6],[7,8],[9,10]],
    3: [[11,12],[13,14],[15,11],[12,13],[14,15]],
  };
  const pairIdx = { 1:4, 2:4, 3:2 };
  for (let yr = 2026; yr <= 2027; yr++) {
    const startM = yr === 2026 ? 7 : 0;
    for (let mo = startM; mo < 12; mo++) {
      const daysInMo = new Date(yr, mo+1, 0).getDate();
      for (let day = 1; day <= daysInMo; day++) {
        const key = `${yr}-${mo+1}-${day}`;
        if (result[key]) continue;
        const d   = new Date(yr, mo, day);
        const delta = Math.round((d - JADWAL_ANCHOR) / 86400000);
        const regu = ((delta % 3) + 3) % 3 + 1;
        const dow  = d.getDay();
        const isMerah = !!hariLiburMap[key];
        if (dow !== 0 && dow !== 6 && !isMerah) continue;
        result[key] = pairs[regu][pairIdx[regu] % 5];
        pairIdx[regu]++;
      }
    }
  }
  return result;
}

function jadwalDateKey(y, m, d) { return `${y}-${m+1}-${d}`; }
function jadwalDaysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }

// ── Export Excel ──────────────────────────────────────────────────────────────
function jadwalExportJadwal(jadwalData, jadwalLiburMap, calM, calY) {
  if (typeof XLSX === 'undefined') { alert('SheetJS belum dimuat!'); return; }
  const rows = jadwalData.map(d => {
    const dow = new Date(calY, calM, d.tgl).getDay();
    const key = `${calY}-${calM+1}-${d.tgl}`;
    const liburIds = jadwalLiburMap[key] || [];
    const piket = ANGGOTA_DATA.items.filter(a => a.regu === d.regu && !liburIds.includes(a.id)).map(a => a.nama).join(', ');
    const libur = ANGGOTA_DATA.items.filter(a => a.regu === d.regu && liburIds.includes(a.id)).map(a => a.nama).join(', ');
    return [
      `${d.tgl} ${JADWAL_BULAN_FULL[calM]} ${calY}`,
      JADWAL_HARI[dow],
      `Regu ${d.regu}`,
      d.libur ? d.libur.label : (d.weekend ? 'Weekend' : ''),
      piket,
      libur,
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([['Tanggal','Hari','Regu','Keterangan','Piket','Libur'],...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${JADWAL_BULAN_FULL[calM]} ${calY}`);
  XLSX.writeFile(wb, `Jadwal_PAMDAL_${JADWAL_BULAN_FULL[calM]}_${calY}.xlsx`);
}

function jadwalExportRekap(rekapHitung, tahun) {
  if (typeof XLSX === 'undefined') { alert('SheetJS belum dimuat!'); return; }
  const rows = ANGGOTA_DATA.items.map(a => {
    const vals = rekapHitung[a.id] || Array(12).fill(0);
    return [a.nama, `Regu ${a.regu}`, ...vals, vals.reduce((s,v) => s+v, 0)];
  });
  const ws = XLSX.utils.aoa_to_sheet([['Nama','Regu',...JADWAL_BULAN_SHORT,'Total'],...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Rekap ${tahun}`);
  XLSX.writeFile(wb, `Rekap_Piket_PAMDAL_${tahun}.xlsx`);
}

function jadwalExportPDF(type, payload) {
  let bodyHtml = '';
  if (type === 'rekap') {
    const { rekapHitung, tahun } = payload;
    const tableRows = ANGGOTA_DATA.items.map(a => {
      const vals = rekapHitung[a.id] || Array(12).fill(0);
      const total = vals.reduce((s,v) => s+v, 0);
      return `<tr><td>${a.nama} (Regu ${a.regu})</td>${vals.map(v => `<td style="text-align:center">${v||''}</td>`).join('')}<td style="text-align:center;font-weight:700">${total}</td></tr>`;
    }).join('');
    bodyHtml = `<h2>Rekap Hari Piket PAMDAL BBPKA II Jatinangor</h2><p>Tahun ${tahun} · Dicetak: ${new Date().toLocaleDateString('id-ID')}</p><table border="1" style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr><th style="text-align:left;min-width:110px">Nama</th>${JADWAL_BULAN_SHORT.map(b => `<th>${b}</th>`).join('')}<th>Total</th></tr></thead><tbody>${tableRows}</tbody></table>`;
  } else {
    const { jadwalData, jadwalLiburMap, calM, calY } = payload;
    const rows = jadwalData.map(d => {
      const dow = new Date(calY, calM, d.tgl).getDay();
      const key = `${calY}-${calM+1}-${d.tgl}`;
      const liburIds = jadwalLiburMap[key] || [];
      const piket = ANGGOTA_DATA.items.filter(a => a.regu === d.regu && !liburIds.includes(a.id)).map(a => a.nama).join(', ');
      const libur = ANGGOTA_DATA.items.filter(a => a.regu === d.regu && liburIds.includes(a.id)).map(a => a.nama).join(', ') || null;
      const rowBg = d.weekend || d.libur ? '#FFF8EF' : '';
      return `<tr style="background:${rowBg}"><td style="text-align:center;font-weight:600">${d.tgl}</td><td>${JADWAL_HARI[dow]}</td><td style="font-weight:700">Regu ${d.regu}</td><td style="font-size:10px">${d.libur ? d.libur.label : d.weekend ? 'Weekend' : ''}</td><td>${piket}</td><td style="color:#D93025;font-size:10px">${libur || '-'}</td></tr>`;
    }).join('');
    bodyHtml = `<h2>Jadwal Piket PAMDAL BBPKA II Jatinangor</h2><p>${JADWAL_BULAN_FULL[calM]} ${calY} · Dicetak: ${new Date().toLocaleDateString('id-ID')}</p><table border="1" style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr><th>Tgl</th><th>Hari</th><th>Regu</th><th>Keterangan</th><th>Piket</th><th>Libur</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const w = window.open('', '_blank');
  if (!w) { alert('Izinkan popup untuk cetak PDF.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>PAMDAL</title><style>body{font-family:sans-serif;padding:20px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #D1D5DB;padding:4px 6px}th{background:#F0F7FF}@media print{button{display:none}}</style></head><body>${bodyHtml}<br><button onclick="window.print()">🖨 Cetak</button></body></html>`);
  w.document.close();
}

// ── JadwalAdminLibur — sub-komponen kelola hari libur nasional ─────────────────
function JadwalAdminLibur({ now, jadwalHariLibur, setJadwalHariLibur, setJadwalLiburMap, toast }) {
  const [newKey, setNewKey]     = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newTipe, setNewTipe]   = useState('libur');

  function addLibur() {
    if (!newKey || !newLabel) { toast('Isi tanggal dan label!', false); return; }
    const updated = { ...jadwalHariLibur, [newKey]: { label: newLabel, tipe: newTipe } };
    setJadwalHariLibur(updated);
    try { localStorage.setItem('pamdal_hari_libur', JSON.stringify(updated)); } catch(e) {}
    setJadwalLiburMap(jadwalGenerateLibur(updated));
    setNewKey(''); setNewLabel('');
    toast('Hari libur ditambahkan!');
  }

  function removeLibur(key) {
    const updated = { ...jadwalHariLibur };
    delete updated[key];
    setJadwalHariLibur(updated);
    try { localStorage.setItem('pamdal_hari_libur', JSON.stringify(updated)); } catch(e) {}
    setJadwalLiburMap(jadwalGenerateLibur(updated));
    toast('Hari libur dihapus');
  }

  const entries = Object.entries(jadwalHariLibur).sort((a, b) => {
    const [ay, am, ad] = a[0].split('-').map(Number);
    const [by, bm, bd] = b[0].split('-').map(Number);
    return new Date(ay, am-1, ad) - new Date(by, bm-1, bd);
  });

  return (
    <div>
      <div className={styles.sectionTitle}>🏖 Kelola Hari Libur Nasional</div>

      {/* Form tambah */}
      <div className={styles.liburForm}>
        <Inp label="Tanggal (format: 2026-8-17)" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="2026-8-17" />
        <Inp label="Keterangan" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nama hari libur..." />
        <Inp label="Tipe" value={newTipe} onChange={e => setNewTipe(e.target.value)} as="select">
          <option value="libur">🔴 Libur Nasional</option>
          <option value="cuti">🟠 Cuti Bersama</option>
        </Inp>
        <Btn onClick={addLibur} color="var(--accent)" size="lg" full>+ Tambah</Btn>
      </div>

      {/* Daftar */}
      <div className={styles.liburList}>
        {entries.map(([key, val]) => (
          <div key={key} className={styles.liburItem}>
            <div>
              <div className={styles.liburItemKey}>{key}</div>
              <div className={styles.liburItemLabel}>
                {val.tipe === 'libur' ? '🔴' : '🟠'} {val.label}
              </div>
            </div>
            <button onClick={() => removeLibur(key)} className={styles.liburRemoveBtn}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── JadwalPiketModal ──────────────────────────────────────────────────────────
function JadwalPiketModal({ reguNo, label, tgl, liburInfo, jadwalLiburMap, setJadwalLiburMap, canEdit, isAdmin, toast, onClose }) {
  const key      = `${tgl.y}-${tgl.m}-${tgl.d}`;
  const dow      = new Date(tgl.y, tgl.m - 1, tgl.d).getDay();
  const isWe     = dow === 0 || dow === 6;
  const isRed    = !!liburInfo || isWe;
  const members  = ANGGOTA_DATA.items.filter(a => a.regu === reguNo);
  const liburIds = jadwalLiburMap[key] || [];
  const piketCount = members.filter(a => !liburIds.includes(a.id)).length;
  const rc       = JADWAL_RC[reguNo];
  const canToggle = isAdmin && isRed;

  function toggle(id) {
    const isOff = liburIds.includes(id);
    if (!isOff && piketCount <= 1) {
      toast && toast('Minimal 1 anggota harus tetap piket!', false);
      return;
    }
    const newIds = isOff ? liburIds.filter(x => x !== id) : [...liburIds, id];
    const newMap = { ...jadwalLiburMap };
    if (newIds.length === 0) delete newMap[key]; else newMap[key] = newIds;
    setJadwalLiburMap(newMap);
    try { localStorage.setItem('pamdal_jadwal_libur', JSON.stringify(newMap)); } catch(e) {}
  }

  return (
    <Modal open onClose={onClose} title="📋 Detail Jadwal Piket">
      {/* Header regu */}
      <div style={{ background: rc.accent, borderRadius: 12, padding: '12px 16px', marginBottom: 14, color: '#fff' }}>
        <div style={{ fontSize: 11, opacity: .8, marginBottom: 2 }}>
          {JADWAL_HARI[dow]}, {tgl.d} — Regu {reguNo}
        </div>
        <div style={{ fontSize: 17, fontWeight: 900 }}>{label}</div>
        {liburInfo && (
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '3px 10px', fontSize: 11 }}>
            {liburInfo.tipe === 'libur' ? '🔴' : '🟠'} {liburInfo.label}
          </div>
        )}
        {isWe && !liburInfo && (
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '3px 10px', fontSize: 11 }}>
            📅 {dow === 0 ? 'Hari Minggu' : 'Hari Sabtu'}
          </div>
        )}
      </div>

      {/* Badge ringkasan */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { val: piketCount,      label: 'Piket', bg: 'rgba(2,132,199,0.08)',   bd: 'rgba(2,132,199,0.2)',   col: 'var(--accent-2)' },
          { val: liburIds.length, label: 'Libur', bg: liburIds.length ? 'rgba(239,68,68,0.07)' : 'rgba(100,116,139,0.06)', bd: liburIds.length ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.15)', col: liburIds.length ? 'var(--red-bright)' : 'var(--tx-muted)' },
          { val: members.length,  label: 'Total', bg: 'rgba(100,116,139,0.06)', bd: 'rgba(100,116,139,0.15)', col: 'var(--tx-secondary)' },
        ].map(b => (
          <div key={b.label} style={{ flex: 1, background: b.bg, border: `1px solid ${b.bd}`, borderRadius: 9, padding: '8px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: b.col }}>{b.val}</div>
            <div style={{ fontSize: 10, color: 'var(--tx-muted)', fontWeight: 600 }}>{b.label}</div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      {!isRed && (
        <div className={styles.infoBanner}>
          ℹ️ Libur anggota hanya bisa diatur pada hari merah atau weekend
        </div>
      )}
      {isRed && !isAdmin && (
        <div className={styles.infoBanner}>
          🔒 Hanya Admin yang dapat mengatur libur anggota
        </div>
      )}

      <div className={styles.sectionLabel}>Anggota Regu {reguNo}</div>

      {/* Daftar anggota */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {members.map(a => {
          const isLibur    = liburIds.includes(a.id);
          const isPiketLast = !isLibur && piketCount === 1;
          return (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: isLibur ? 'rgba(239,68,68,0.06)' : 'var(--bg-raised)',
              border: `1px solid ${isLibur ? 'rgba(239,68,68,0.25)' : 'rgba(2,132,199,0.12)'}`,
              borderRadius: 10, padding: '10px 12px', transition: 'all .15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isLibur ? 'rgba(239,68,68,0.12)' : rc.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 900,
                  color: isLibur ? 'var(--red-bright)' : rc.accent, flexShrink: 0,
                }}>
                  {isLibur ? '✕' : '✓'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isLibur ? 'var(--tx-muted)' : 'var(--tx-primary)', textDecoration: isLibur ? 'line-through' : 'none' }}>
                    {a.nama}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx-muted)' }}>
                    {a.jabatan === 'Dan Regu' ? '⭐ Dan Regu' : isLibur ? 'Libur' : 'Piket'}
                  </div>
                </div>
              </div>
              {canToggle && (
                <button
                  onClick={() => toggle(a.id)}
                  disabled={isPiketLast && !isLibur}
                  style={{
                    padding: '6px 14px', borderRadius: 7, border: 'none',
                    cursor: isPiketLast && !isLibur ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                    background: isLibur ? 'rgba(2,132,199,0.12)' : isPiketLast ? 'rgba(100,116,139,0.1)' : 'rgba(239,68,68,0.10)',
                    color: isLibur ? 'var(--accent-2)' : isPiketLast ? 'var(--tx-muted)' : 'var(--red-bright)',
                    opacity: isPiketLast && !isLibur ? .4 : 1, transition: 'all .15s',
                  }}
                >
                  {isLibur ? '✓ Piket' : '✕ Libur'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isRed && canToggle && (
        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--tx-muted)', textAlign: 'center' }}>
          * Minimal 1 anggota wajib tetap piket
        </div>
      )}
    </Modal>
  );
}

// ── JadwalTab (komponen utama) ────────────────────────────────────────────────
export default function JadwalTab({ now, liburData, setLiburData, reguHari, isAdmin, canEdit, toast, setTab, patrols = [], standJaga = [], incidents = [] }) {
  const [subTab, setSubTab] = useState('piket');

  // Data Anggota
  const [memberOpen, setMemberOpen]         = useState(true);
  const [memberSelected, setMemberSelected] = useState(null);

  const reguColors = { 1: 'var(--regu-1-col)', 2: 'var(--amber)', 3: 'var(--violet)' };
  const reguBg     = { 1: 'rgba(14,165,233,.08)', 2: 'rgba(245,158,11,.08)', 3: 'rgba(109,40,217,.08)' };
  const todayStr   = now.toDateString();

  const getMemberStats = (name) => {
    const myPT = patrols.filter(p => p.officer && p.officer.includes(name) && new Date(p.ts).toDateString() === todayStr);
    const myP  = patrols.filter(p => p.officer && p.officer.includes(name));
    const myST = (standJaga || []).filter(s => s.officer && s.officer.includes(name) && new Date(s.ts).toDateString() === todayStr);
    const myI  = incidents.filter(i => i.officer && i.officer.includes(name));
    return { patrolsToday: myPT.length, patrolsTotal: myP.length, standToday: myST.length, incidents: myI.length, poin: myPT.length*10 + myST.length*5 };
  };

  // Hari libur state (localStorage)
  const [jadwalHariLibur, setJadwalHariLibur] = useState(() => {
    try { const s = localStorage.getItem('pamdal_hari_libur'); return s ? JSON.parse(s) : JADWAL_HARI_LIBUR_DEFAULT; }
    catch(e) { return JADWAL_HARI_LIBUR_DEFAULT; }
  });

  const [jadwalLiburMap, setJadwalLiburMap] = useState(() => {
    try {
      const s = localStorage.getItem('pamdal_jadwal_libur');
      const generated = jadwalGenerateLibur(JADWAL_HARI_LIBUR_DEFAULT);
      if (s) {
        const stored = JSON.parse(s);
        return Object.assign({}, stored, JADWAL_LIBUR_DEFAULT);
      }
      return generated;
    } catch(e) { return jadwalGenerateLibur(JADWAL_HARI_LIBUR_DEFAULT); }
  });

  // Kalender state
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const [modal, setModal] = useState(null);
  const [rekapTahun, setRekapTahun] = useState(now.getFullYear());

  // Rekap hitung
  const rekapHitung = useMemo(() => {
    const out = {};
    ANGGOTA_DATA.items.forEach(a => { out[a.id] = Array(12).fill(0); });
    for (let mo = 0; mo < 12; mo++) {
      const days = jadwalDaysInMonth(rekapTahun, mo);
      for (let day = 1; day <= days; day++) {
        const d = new Date(rekapTahun, mo, day);
        const regu = jadwalGetRegu(d);
        const key = jadwalDateKey(rekapTahun, mo, day);
        const liburIds = jadwalLiburMap[key] || [];
        ANGGOTA_DATA.items.filter(a => a.regu === regu && !liburIds.includes(a.id)).forEach(a => { out[a.id][mo]++; });
      }
    }
    return out;
  }, [jadwalLiburMap, rekapTahun]);

  // Build jadwal data bulan ini
  const jadwalData = useMemo(() => {
    const days = jadwalDaysInMonth(calY, calM);
    const result = [];
    for (let day = 1; day <= days; day++) {
      const d = new Date(calY, calM, day);
      const regu = jadwalGetRegu(d);
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const liburKey = jadwalDateKey(calY, calM, day);
      const liburNasional = jadwalHariLibur[liburKey];
      result.push({ tgl: day, regu, weekend: isWeekend, libur: liburNasional || null });
    }
    return result;
  }, [calY, calM, jadwalHariLibur]);

  const todayKey     = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  const todayRegu    = jadwalGetRegu(now);
  const todayLiburIds = jadwalLiburMap[todayKey] || [];
  const todayPiket   = ANGGOTA_DATA.items.filter(a => a.regu === todayRegu && !todayLiburIds.includes(a.id));
  const todayLibur   = ANGGOTA_DATA.items.filter(a => a.regu === todayRegu && todayLiburIds.includes(a.id));
  const todayHariLibur = jadwalHariLibur[todayKey];

  const G = {
    card: '#ffffff', cardBd: 'rgba(2,132,199,0.12)', cardSh: '0 2px 12px rgba(2,132,199,0.07)',
    text: 'var(--tx-primary)', muted: 'var(--tx-muted)', faint: 'var(--tx-ghost)',
  };

  // ── renderPiket ─────────────────────────────────────────────────────────────
  const renderPiket = () => {
    const firstDow = new Date(calY, calM, 1).getDay();
    const totalDays = jadwalDaysInMonth(calY, calM);
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);

    return (
      <div>
        {/* Hero hari ini */}
        <div style={{ background: JADWAL_RC[todayRegu].accent, borderRadius: 14, marginBottom: 12, color: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px' }}>
            <div style={{ fontSize: 10, opacity: .8, marginBottom: 2 }}>
              HARI INI — {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>REGU {todayRegu}</div>
            {todayHariLibur && (
              <div style={{ fontSize: 11, marginTop: 4, background: 'rgba(255,255,255,.2)', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>
                {todayHariLibur.tipe === 'libur' ? '🔴' : '🟠'} {todayHariLibur.label}
              </div>
            )}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {todayPiket.map(a => (
                <span key={a.id} style={{ background: 'rgba(255,255,255,.22)', borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{a.nama}</span>
              ))}
              {todayLibur.map(a => (
                <span key={a.id} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 600, textDecoration: 'line-through', opacity: .7 }}>🏖 {a.nama}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Nav bulan */}
        <div className={styles.calNav}>
          <button className={styles.calNavBtn} onClick={() => { const d = new Date(calY, calM-1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}>‹</button>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx-primary)' }}>{JADWAL_BULAN_FULL[calM]} {calY}</div>
          <button className={styles.calNavBtn} onClick={() => { const d = new Date(calY, calM+1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}>›</button>
        </div>

        {/* Grid kalender */}
        <div style={{ background: G.card, border: `1px solid ${G.cardBd}`, borderRadius: 12, overflow: 'hidden', boxShadow: G.cardSh, marginBottom: 10 }}>
          <div className={styles.calDowRow}>
            {JADWAL_HARI.map(h => (
              <div key={h} style={{ textAlign: 'center', padding: '7px 0', fontSize: 10, fontWeight: 700,
                color: h === 'Ahd' ? 'var(--cal-sunday)' : h === 'Sab' ? 'var(--accent-2)' : 'var(--tx-muted)' }}>
                {h}
              </div>
            ))}
          </div>
          <div className={styles.calGrid}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} style={{ minHeight: 44 }} />;
              const d = new Date(calY, calM, day);
              const dow = d.getDay();
              const isToday = calY === now.getFullYear() && calM === now.getMonth() && day === now.getDate();
              const regu = jadwalGetRegu(d);
              const rc = JADWAL_RC[regu];
              const liburNas = jadwalHariLibur[jadwalDateKey(calY, calM, day)];
              const isWe = dow === 0 || dow === 6;
              const liburIds2 = jadwalLiburMap[jadwalDateKey(calY, calM, day)] || [];
              const piketCount = ANGGOTA_DATA.items.filter(a => a.regu === regu && !liburIds2.includes(a.id)).length;
              const totalRegu  = ANGGOTA_DATA.items.filter(a => a.regu === regu).length;
              return (
                <div
                  key={day}
                  onClick={() => setModal({ reguNo: regu, label: `${JADWAL_HARI[dow]}, ${day} ${JADWAL_BULAN_FULL[calM]} ${calY}`, tgl: { y: calY, m: calM+1, d: day }, liburInfo: liburNas || null })}
                  style={{
                    minHeight: 52, padding: '4px 3px', cursor: 'pointer',
                    borderTop: '1px solid rgba(2,132,199,0.06)',
                    borderRight: (i+1) % 7 === 0 ? 'none' : '1px solid rgba(2,132,199,0.06)',
                    background: isToday ? 'rgba(2,132,199,0.08)' : liburNas ? 'rgba(251,146,60,0.06)' : isWe ? 'rgba(100,116,139,0.04)' : 'transparent',
                    transition: 'background .12s', position: 'relative',
                  }}
                >
                  {liburNas && (
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: liburNas.tipe === 'libur' ? '#D93025' : '#F5A623' }} />
                  )}
                  <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: liburNas ? 'var(--amber-bright)' : isWe ? (dow === 0 ? 'var(--cal-sunday)' : 'var(--accent-2)') : 'var(--tx-secondary)', marginBottom: 1 }}>
                    {day}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: rc.accent, lineHeight: 1.2 }}>{rc.label}</div>
                  {piketCount < totalRegu && (
                    <div style={{ fontSize: 10, color: 'var(--accent-2)', marginTop: 1 }}>{piketCount}P</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Susunan Regu */}
        <div style={{ marginBottom: 10 }}>
          <div className={styles.sectionLabel}>Susunan Regu</div>
          {[1,2,3].map(r => {
            const c = JADWAL_RC[r];
            const members = ANGGOTA_DATA.items.filter(a => a.regu === r);
            const dan = members.find(a => a.jabatan === 'Dan Regu');
            const isToday = r === todayRegu;
            const liburIdsCur = jadwalLiburMap[todayKey] || [];
            return (
              <div key={r} style={{ background: isToday ? c.bg : 'var(--bg-surface)', border: `1.5px solid ${isToday ? c.accent + '50' : 'rgba(2,132,199,0.1)'}`, borderRadius: 12, marginBottom: 6, overflow: 'hidden' }}>
                <div style={{ background: isToday ? c.accent : 'rgba(2,132,199,0.06)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: isToday ? '#fff' : c.accent }}>{c.label} Regu {r}</span>
                    {dan && <span style={{ fontSize: 10, color: isToday ? 'rgba(255,255,255,.8)' : G.muted }}>Dan: {dan.nama.split(' ')[0]}</span>}
                  </div>
                  {isToday && <span style={{ background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>PIKET HARI INI</span>}
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {members.map(a => {
                    const isLibur = isToday && liburIdsCur.includes(a.id);
                    return (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: isLibur ? 'rgba(217,119,6,0.08)' : isToday ? 'rgba(255,255,255,0.6)' : 'var(--bg-base)',
                        border: `1px solid ${isLibur ? 'rgba(217,119,6,0.3)' : isToday ? c.accent + '25' : 'rgba(2,132,199,0.1)'}`,
                        borderRadius: 7, padding: '4px 8px',
                      }}>
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: isLibur ? 600 : 700, color: isLibur ? 'var(--amber-dark)' : 'var(--tx-primary)', textDecoration: isLibur ? 'line-through' : 'none' }}>
                            {a.nama.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: 10, color: G.muted, lineHeight: 1 }}>
                            {a.jabatan === 'Dan Regu' ? 'Dan Regu' : isLibur ? 'Libur' : 'Anggota'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Export */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={styles.exportBtnGreen} onClick={() => jadwalExportJadwal(jadwalData, jadwalLiburMap, calM, calY)}>↓ Excel</button>
          <button className={styles.exportBtnRed} onClick={() => jadwalExportPDF('jadwal', { jadwalData, jadwalLiburMap, calM, calY })}>🖨 PDF</button>
        </div>
      </div>
    );
  };

  // ── renderPerRegu ────────────────────────────────────────────────────────────
  const renderPerRegu = () => {
    return (
      <div>
        <div className={styles.calNav} style={{ marginBottom: 10 }}>
          <button className={styles.calNavBtnCard} onClick={() => { const d = new Date(calY, calM-1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-primary)' }}>{JADWAL_BULAN_FULL[calM]} {calY}</div>
          <button className={styles.calNavBtnCard} onClick={() => { const d = new Date(calY, calM+1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }}>›</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(regu => {
            const c = JADWAL_RC[regu];
            const dan = ANGGOTA_DATA.items.find(a => a.regu === regu && a.jabatan === 'Dan Regu');
            const members = ANGGOTA_DATA.items.filter(a => a.regu === regu);
            const aktif = jadwalData.filter(d => d.regu === regu).length;
            return (
              <div key={regu} style={{ background: G.card, border: `1px solid ${G.cardBd}`, borderRadius: 12, overflow: 'hidden', boxShadow: G.cardSh }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(2,132,199,0.1)', background: c.bg }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: c.accent }}>{c.label}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-primary)' }}>Dan: {dan?.nama}</div>
                      <div style={{ fontSize: 10, color: G.muted }}>
                        <span style={{ color: c.accent, fontWeight: 600 }}>{aktif} hari piket</span> · {JADWAL_BULAN_FULL[calM]} {calY}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button onClick={() => { const d = new Date(calY, calM-1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }} className={styles.reguNavBtn} style={{ color: c.accent, borderColor: c.accent + '44' }}>‹</button>
                    <button onClick={() => { const d = new Date(calY, calM+1, 1); setCalY(d.getFullYear()); setCalM(d.getMonth()); }} className={styles.reguNavBtn} style={{ color: c.accent, borderColor: c.accent + '44' }}>›</button>
                    {dan?.noHp && dan.noHp !== '-' && (
                      <a href={`https://wa.me/${dan.noHp.replace(/\D/g,'').replace(/^0/,'62')}`} target="_blank" rel="noopener noreferrer"
                        style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${c.accent}44`, color: c.accent, borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                        Kontak ›
                      </a>
                    )}
                  </div>
                </div>

                {/* Tabel scroll horizontal */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, background: 'rgba(255,255,255,0.97)', zIndex: 2, minWidth: 90, padding: '6px 10px', fontSize: 10, fontWeight: 700, color: G.muted, textAlign: 'left', borderBottom: '1px solid rgba(2,132,199,0.1)' }}>NAMA</th>
                        {jadwalData.map(d => {
                          const isWe = d.weekend;
                          const isLiburNas = !!d.libur;
                          const isRed = isLiburNas || isWe;
                          const isToday = calY === now.getFullYear() && calM === now.getMonth() && d.tgl === now.getDate();
                          const isPiketRegu = d.regu === regu;
                          const bgColor = isToday ? c.accent : isPiketRegu ? c.bg : 'transparent';
                          return (
                            <th key={d.tgl} style={{ minWidth: 26, padding: '4px 2px', textAlign: 'center', background: bgColor, borderBottom: '1px solid rgba(2,132,199,0.1)', borderLeft: '1px solid rgba(2,132,199,0.06)' }}>
                              <div style={{ fontSize: 10, fontWeight: isToday ? 800 : 600, color: isToday ? '#fff' : isRed ? 'var(--red-bright)' : isPiketRegu ? c.accent : '#D1D5DB', lineHeight: 1 }}>{d.tgl}</div>
                              <div style={{ fontSize: 10, lineHeight: 1, marginTop: 1, color: isToday ? 'rgba(255,255,255,0.8)' : isRed ? 'var(--red-bright)' : 'var(--tx-ghost)', fontWeight: isRed ? 700 : 400 }}>
                                {JADWAL_HARI[(new Date(calY, calM, d.tgl)).getDay()]}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((a, ai) => (
                        <tr key={a.id} style={{ background: ai % 2 === 0 ? 'transparent' : 'rgba(2,132,199,0.02)' }}>
                          <td style={{ position: 'sticky', left: 0, background: ai % 2 === 0 ? 'rgba(255,255,255,0.97)' : 'rgba(240,249,255,0.97)', zIndex: 1, padding: '6px 10px', borderBottom: '1px solid rgba(2,132,199,0.08)' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-primary)', whiteSpace: 'nowrap', maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nama}</div>
                            {a.jabatan === 'Dan Regu' && <div style={{ fontSize: 10, color: 'var(--amber-bright)' }}>⭐ Dan</div>}
                            {a.nip && a.nip !== '-' && <div style={{ fontSize: 10, color: G.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 88 }}>{a.nip}</div>}
                          </td>
                          {jadwalData.map(d => {
                            const isPiket = d.regu === regu;
                            const isRed = !!d.libur || d.weekend;
                            const isToday = calY === now.getFullYear() && calM === now.getMonth() && d.tgl === now.getDate();
                            const key = `${calY}-${calM+1}-${d.tgl}`;
                            const liburIds2 = jadwalLiburMap[key] || [];
                            const anggotaOff = isPiket && isRed && liburIds2.includes(a.id);
                            const cellBg = isToday && isPiket ? c.accent + '22'
                              : isRed ? 'linear-gradient(135deg,rgba(239,68,68,0.10),rgba(239,68,68,0.04))'
                              : isPiket ? c.bg : 'transparent';
                            return (
                              <td key={d.tgl} style={{ textAlign: 'center', padding: '5px 2px', borderBottom: '1px solid rgba(2,132,199,0.08)', borderLeft: '1px solid rgba(2,132,199,0.06)', background: cellBg }}>
                                {isPiket
                                  ? (anggotaOff
                                    ? <span style={{ fontSize: 12, lineHeight: 1 }}>🏖️</span>
                                    : <span style={{ fontSize: 12, fontWeight: 600, color: isRed ? 'var(--red-bright)' : 'var(--accent-2)', lineHeight: 1 }}>✓</span>)
                                  : <span style={{ fontSize: 10, color: 'var(--br-strong)' }}>—</span>
                                }
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div style={{ padding: '6px 12px 8px', display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid rgba(2,132,199,0.1)' }}>
                  <div style={{ fontSize: 10, color: G.muted }}>✓ Piket</div>
                  <div style={{ fontSize: 10, color: G.muted }}>🏖️ Libur anggota</div>
                  <div style={{ fontSize: 10, color: 'var(--red-bright)' }}>Merah = libur/weekend</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── renderRekap ──────────────────────────────────────────────────────────────
  const renderRekap = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: G.muted }}>Rekap hari piket · {rekapTahun}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[2025, 2026, 2027, 2028].map(y => (
            <button key={y} onClick={() => setRekapTahun(y)} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid', fontSize: 11, fontWeight: 600,
              borderColor: rekapTahun === y ? 'var(--accent-2)' : 'rgba(2,132,199,0.15)',
              background: rekapTahun === y ? 'rgba(2,132,199,0.12)' : G.card,
              color: rekapTahun === y ? 'var(--accent-2)' : G.muted, cursor: 'pointer',
            }}>{y}</button>
          ))}
        </div>
      </div>

      <div style={{ background: G.card, border: `1px solid ${G.cardBd}`, borderRadius: 12, overflow: 'auto', boxShadow: G.cardSh }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'rgba(255,255,255,0.97)', zIndex: 1, minWidth: 90, padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid rgba(2,132,199,0.15)', fontSize: 10, color: G.muted, fontWeight: 700 }}>Nama</th>
              {JADWAL_BULAN_SHORT.map(b => (
                <th key={b} style={{ textAlign: 'center', padding: '8px 4px', minWidth: 28, borderBottom: '1px solid rgba(2,132,199,0.15)', fontSize: 10, color: G.muted, fontWeight: 700 }}>{b}</th>
              ))}
              <th style={{ textAlign: 'center', color: 'var(--amber-bright)', padding: '8px 6px', borderBottom: '1px solid rgba(2,132,199,0.15)', fontSize: 10, fontWeight: 700 }}>∑</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3].map(regu => {
              const members = ANGGOTA_DATA.items.filter(a => a.regu === regu);
              const sampleVals = rekapHitung[members[0]?.id] || Array(12).fill(0);
              const maxVal = Math.max(...sampleVals);
              const c = JADWAL_RC[regu];
              const danName = ANGGOTA_DATA.items.find(a => a.regu === regu && a.jabatan === 'Dan Regu')?.nama;
              return (
                <>
                  <tr key={`hdr-${regu}`}>
                    <td colSpan={14} style={{ background: c.bg, color: c.accent, fontSize: 11, fontWeight: 700, padding: '7px 12px' }}>
                      {c.label} — Dan: {danName}
                    </td>
                  </tr>
                  {members.map(a => {
                    const vals = rekapHitung[a.id] || Array(12).fill(0);
                    const total = vals.reduce((s,v) => s+v, 0);
                    return (
                      <tr key={a.id}>
                        <td style={{ position: 'sticky', left: 0, background: 'rgba(255,255,255,0.97)', padding: '7px 10px', borderBottom: '1px solid rgba(2,132,199,0.06)' }}>
                          <div style={{ fontWeight: 600, fontSize: 11, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', color: G.text }}>{a.nama}</div>
                          {a.jabatan === 'Dan Regu' && <div style={{ fontSize: 10, color: 'var(--amber-bright)' }}>⭐</div>}
                        </td>
                        {vals.map((v, i) => (
                          <td key={i} style={{ textAlign: 'center', padding: '6px 2px', borderBottom: '1px solid rgba(2,132,199,0.06)' }}>
                            <span style={{
                              display: 'inline-block', width: 22, height: 20, lineHeight: '20px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                              background: v === maxVal && v > 0 ? 'rgba(2,132,199,0.15)' : 'transparent',
                              color: v === maxVal && v > 0 ? 'var(--accent-2)' : G.muted,
                            }}>{v}</span>
                          </td>
                        ))}
                        <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color: 'var(--amber-bright)', padding: '6px 6px', borderBottom: '1px solid rgba(2,132,199,0.06)' }}>{total}</td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 6, fontSize: 10, color: G.faint, textAlign: 'center' }}>∑ = total hari piket setahun · highlight = bulan terbanyak</div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className={styles.exportBtnGreen} onClick={() => jadwalExportRekap(rekapHitung, rekapTahun)}>↓ Excel</button>
        <button className={styles.exportBtnRed} onClick={() => jadwalExportPDF('rekap', { rekapHitung, tahun: rekapTahun })}>🖨 PDF</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className={styles.sectionLabel} style={{ marginBottom: 8 }}>📋 Jadwal Per Regu</div>
        {renderPerRegu()}
      </div>
    </div>
  );

  // ── renderAnggota ────────────────────────────────────────────────────────────
  const renderAnggota = () => (
    <>
      <div style={{ margin: '0 0 10px' }}>
        <div
          onClick={() => setMemberOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-surface,#fff)', border: '1.5px solid var(--border)',
            borderRadius: memberOpen ? '14px 14px 0 0' : 14, padding: '11px 14px', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx-secondary)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>👥</span>
            Data Anggota
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', background: 'rgba(14,165,233,.12)', borderRadius: 99, padding: '2px 8px', marginLeft: 4 }}>
              {Object.values(REGU).flat().length} anggota
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--tx-muted)', fontWeight: 700, transition: 'transform .2s', display: 'inline-block', transform: memberOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </div>

        {memberOpen && (
          <div style={{ background: 'var(--bg-surface,#fff)', border: '1.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '8px 10px 10px' }}>
            {[1,2,3].map(r => (
              <div key={r} style={{ marginBottom: r < 3 ? 12 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: reguColors[r], letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: reguColors[r] }} />
                  Regu {r}
                </div>
                {REGU[r].map((nm, i, arr) => {
                  const st = getMemberStats(nm);
                  return (
                    <div key={nm} onClick={() => setMemberSelected({ name: nm, regu: r })}
                      style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', alignItems: 'center', gap: 8, padding: '8px 6px', borderBottom: i < arr.length-1 ? '1px solid rgba(0,0,0,.05)' : 'none', cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 99, background: reguBg[r], border: `1.5px solid ${reguColors[r]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: reguColors[r] }}>
                        {nm[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx-primary)', lineHeight: 1.2 }}>{nm}</div>
                        <div style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 2 }}>{st.patrolsToday} patroli · {st.standToday} stand hari ini</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: st.poin > 0 ? reguColors[r] : 'var(--tx-ghost)', lineHeight: 1 }}>{st.poin}</div>
                        <div style={{ fontSize: 10, color: 'var(--tx-muted)', fontWeight: 600 }}>poin</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member detail modal (portal) */}
      {memberSelected && ReactDOM.createPortal(
        <>
          <div onClick={() => setMemberSelected(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(10,22,40,.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9999, width: 'calc(100% - 24px)', maxWidth: 420, background: 'var(--bg-surface,#fff)', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden' }}>
            <div style={{ background: reguColors[memberSelected.regu], padding: '18px 18px 14px', position: 'relative' }}>
              <button onClick={() => setMemberSelected(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,.25)', border: 'none', borderRadius: 99, width: 28, height: 28, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
              <div style={{ width: 48, height: 48, borderRadius: 99, background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
                {memberSelected.name[0]}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>{memberSelected.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginTop: 3 }}>Regu {memberSelected.regu}</div>
            </div>
            {(() => {
              const st = getMemberStats(memberSelected.name);
              return (
                <div style={{ padding: '16px 16px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: 'Patroli Hari Ini', value: st.patrolsToday, col: reguColors[memberSelected.regu] },
                      { label: 'Stand Hari Ini',   value: st.standToday,   col: reguColors[memberSelected.regu] },
                      { label: 'Total Patroli',    value: st.patrolsTotal, col: 'var(--tx-secondary)' },
                      { label: 'Total Insiden',    value: st.incidents,    col: st.incidents > 0 ? 'var(--red)' : 'var(--tx-muted)' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'var(--bg-raised,#F8FBFF)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: s.col, lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--tx-muted)', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: reguBg[memberSelected.regu], border: `1.5px solid ${reguColors[memberSelected.regu]}30`, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: reguColors[memberSelected.regu], letterSpacing: .8, textTransform: 'uppercase', marginBottom: 4 }}>Poin Hari Ini</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: reguColors[memberSelected.regu], lineHeight: 1 }}>{st.poin}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx-muted)', marginTop: 2 }}>patroli×10 + stand×5 poin</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </>,
        document.body
      )}
    </>
  );

  // ── Tab bar config ───────────────────────────────────────────────────────────
  const TABS = [
    { id: 'piket',   label: 'Jadwal',     icon: '📅', desc: 'Kalender piket',   color: '#1A8FE3', bg: 'rgba(26,143,227,.12)',  border: 'rgba(26,143,227,.35)' },
    { id: 'anggota', label: 'Anggota',    icon: '👥', desc: 'Data & statistik',  color: '#7C3AED', bg: 'rgba(124,58,237,.12)', border: 'rgba(124,58,237,.35)' },
    { id: 'rekap',   label: 'Rekap',      icon: '📊', desc: 'Total hari piket', color: '#059669', bg: 'rgba(5,150,105,.12)',  border: 'rgba(5,150,105,.35)'  },
    ...(isAdmin ? [{ id: 'libur', label: 'Hari Libur', icon: '🏖', desc: 'Kelola libur', color: '#D97706', bg: 'rgba(217,119,6,.12)', border: 'rgba(217,119,6,.35)' }] : []),
  ];

  return (
    <div style={{ padding: '0 0 8px' }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, padding: '0 0 2px' }}>
        {TABS.map(t => {
          const isActive = subTab === t.id;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '10px 4px 9px', borderRadius: 14,
              border: isActive ? `2px solid ${t.border}` : '1.5px solid var(--border)',
              background: isActive ? t.bg : 'var(--bg-surface)',
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: isActive ? `0 4px 14px ${t.bg}` : 'none',
              transition: 'all .18s cubic-bezier(.22,1,.36,1)',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .2, color: isActive ? t.color : 'var(--tx-muted)', lineHeight: 1.2 }}>{t.label}</span>
              <span style={{ fontSize: 9, fontWeight: 500, color: isActive ? t.color : 'var(--tx-ghost,#CBD5E1)', lineHeight: 1, opacity: isActive ? .85 : .7 }}>{t.desc}</span>
            </button>
          );
        })}
      </div>

      {subTab === 'piket'   && renderPiket()}
      {subTab === 'anggota' && renderAnggota()}
      {subTab === 'rekap'   && renderRekap()}
      {subTab === 'libur'   && isAdmin && (
        <JadwalAdminLibur now={now} jadwalHariLibur={jadwalHariLibur} setJadwalHariLibur={setJadwalHariLibur} setJadwalLiburMap={setJadwalLiburMap} toast={toast} />
      )}

      {/* Modal piket */}
      {modal && (
        <JadwalPiketModal
          {...modal}
          jadwalLiburMap={jadwalLiburMap}
          setJadwalLiburMap={setJadwalLiburMap}
          canEdit={canEdit}
          isAdmin={isAdmin}
          toast={toast}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export { JadwalTab };
