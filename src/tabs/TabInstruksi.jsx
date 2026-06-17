// TabInstruksi.jsx — SIPAMDAL
// Migrasi dari tab-instruksi.js ke Vite + React JSX + Zustand + CSS Modules
// Sesi 5 (pelengkap): Tab Instruksi Pimpinan

import { useState } from 'react';

import { fmtDT } from '../utils/utils.js';

import {
  PH, Btn, BtnBatal, Bdg, Modal, Inp, IC, useInnerModal,
} from '../components/ui/UiComponents.jsx';

// Re-export agar App.jsx hanya perlu import dari TabInstruksi.jsx
export { InstruksiFormTab, BroadcastTab, AdminMemberTab } from './TabAdmin.jsx';

import styles from './TabInstruksi.module.css';

// ── Konstanta warna prioritas ─────────────────────────────────────────────────

const PRI_COL = {
  Penting: 'var(--red)',
  Normal:  'var(--accent)',
  Info:    'var(--accent)',
};

const PRI_BG = {
  Penting: 'rgba(201,27,42,.08)',
  Normal:  'var(--accent-tint)',
  Info:    'var(--accent-tint)',
};

const PRI_ICON = {
  Penting: '🚨',
  Normal:  '📋',
  Info:    'ℹ️',
};

// ── Komponen Utama ────────────────────────────────────────────────────────────

export function InstruksiTab({ instruksi, setInstruksi, toast, isAdmin, currentUser }) {
  const [open,      setOpen]      = useState(false);
  const [editItem,  setEditItem]  = useState(null);
  const [showArsip, setShowArsip] = useState(false);
  const [fm, setFm] = useState({ judul: '', isi: '', prioritas: 'Normal', targetRegu: 'Semua' });

  useInnerModal([open], [setOpen]);

  const f = (k, v) => setFm(p => ({ ...p, [k]: v }));

  const openNew  = () => {
    setEditItem(null);
    setFm({ judul: '', isi: '', prioritas: 'Normal', targetRegu: 'Semua' });
    setOpen(true);
  };

  const openEdit = (ins) => {
    setEditItem(ins);
    setFm({ judul: ins.judul, isi: ins.isi, prioritas: ins.prioritas, targetRegu: ins.targetRegu });
    setOpen(true);
  };

  const submit = () => {
    if (!fm.judul || !fm.isi) { toast('Judul & isi wajib diisi!', false); return; }
    if (editItem) {
      setInstruksi(instruksi.map(i =>
        i.id === editItem.id ? { ...i, ...fm, editedAt: Date.now() } : i,
      ));
      toast('Instruksi diperbarui!');
    } else {
      setInstruksi([{ ...fm, id: Date.now(), ts: Date.now(), aktif: true, selesai: false }, ...instruksi]);
      toast('Instruksi berhasil dikirim!');
    }
    setOpen(false);
  };

  const toggleAktif = (id) => {
    setInstruksi(instruksi.map(i => i.id === id ? { ...i, aktif: !i.aktif } : i));
    toast('Status arsip diperbarui');
  };

  const toggleSelesai = (id) => {
    const ins  = instruksi.find(i => i.id === id);
    const next = !ins?.selesai;
    setInstruksi(instruksi.map(i =>
      i.id === id
        ? { ...i, selesai: next, selesaiBy: next ? (currentUser?.name || '—') : null, selesaiAt: next ? Date.now() : null }
        : i,
    ));
    toast(next ? '✅ Ditandai selesai' : 'Dikembalikan ke belum selesai');
  };

  const hapus = (id) => {
    if (!window.confirm('Hapus instruksi ini?')) return;
    setInstruksi(instruksi.filter(i => i.id !== id));
    toast('Instruksi dihapus');
  };

  const myRegu      = currentUser?.regu;
  const aktifList   = instruksi.filter(i => i.aktif && (i.targetRegu === 'Semua' || String(i.targetRegu) === String(myRegu)));
  const arsipList   = instruksi.filter(i => !i.aktif);
  const belumSelesai = aktifList.filter(i => !i.selesai).length;

  return (
    <div>
      {/* Header */}
      <PH
        title="Instruksi Pimpinan"
        sub="Perintah & arahan dari pimpinan untuk seluruh anggota pamdal"
        action={isAdmin && (
          <Btn onClick={openNew} color="var(--red)">
            {IC({ n: 'plus', s: 13 })} Buat Instruksi
          </Btn>
        )}
      />

      {/* Tab switcher Aktif / Arsip */}
      <div className={styles.tabSwitcher}>
        {[
          ['aktif', `Aktif${belumSelesai > 0 ? ` (${belumSelesai} belum)` : ''}`],
          ['arsip', `Arsip (${arsipList.length})`],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setShowArsip(v === 'arsip')}
            className={styles.tabBtn + (showArsip === (v === 'arsip') ? ' ' + styles.tabBtnActive : '')}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Tab: Aktif */}
      {!showArsip && (
        <>
          {aktifList.length === 0 && (
            <div className={styles.emptyAktif}>✅ Tidak ada instruksi aktif saat ini</div>
          )}

          {aktifList.map(ins => {
            const barColor = ins.selesai ? 'var(--accent)' : (PRI_COL[ins.prioritas] || 'var(--accent)');
            const cardBg   = ins.selesai ? 'var(--bg-surface)' : (PRI_BG[ins.prioritas] || 'var(--accent-tint)');
            const border   = ins.selesai ? 'var(--border)' : `${PRI_COL[ins.prioritas] || 'var(--accent)'}40`;

            return (
              <div
                key={ins.id}
                className={styles.card}
                style={{ background: cardBg, border: `2px solid ${border}`, opacity: ins.selesai ? 0.75 : 1 }}
              >
                {/* Accent bar atas */}
                <div className={styles.accentBar} style={{ background: barColor }} />

                {/* Badges + aksi admin */}
                <div className={styles.cardTopRow}>
                  <div className={styles.badgeRow}>
                    <span
                      className={styles.prioBadge}
                      style={{ background: ins.selesai ? 'var(--accent)' : (PRI_COL[ins.prioritas] || 'var(--accent)') }}
                    >
                      {ins.selesai ? '✅' : PRI_ICON[ins.prioritas] || '📋'} {ins.selesai ? 'Selesai' : ins.prioritas}
                    </span>
                    {ins.targetRegu !== 'Semua' && <Bdg text={`Regu ${ins.targetRegu}`} color="var(--tx-muted)" />}
                    <span className={styles.ts}>{fmtDT(ins.ts)}</span>
                    {ins.editedAt && <span className={styles.editedTag}>(diedit)</span>}
                  </div>

                  {isAdmin && (
                    <div className={styles.adminActions}>
                      <button className={styles.btnEdit}    onClick={() => openEdit(ins)}>✏️ Edit</button>
                      <button className={styles.btnArsip}   onClick={() => toggleAktif(ins.id)}>Arsipkan</button>
                      <button className={styles.btnHapus}   onClick={() => hapus(ins.id)}>Hapus</button>
                    </div>
                  )}
                </div>

                {/* Konten */}
                <div className={styles.judul}>{ins.judul}</div>
                <div className={styles.isi}>{ins.isi}</div>

                {/* Info selesai */}
                {ins.selesai && ins.selesaiBy && (
                  <div className={styles.selesaiInfo}>
                    ✅ Diselesaikan oleh <strong>{ins.selesaiBy}</strong> · {fmtDT(ins.selesaiAt)}
                  </div>
                )}

                {/* Tombol aksi */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {!ins.selesai
                    ? (
                      <button className={styles.btnSelesai} onClick={() => toggleSelesai(ins.id)}>
                        {IC({ n: 'ok', s: 15, c: 'var(--bg-surface)' })} Tandai Selesai
                      </button>
                    ) : (
                      <button className={styles.btnBelumSelesai} onClick={() => toggleSelesai(ins.id)}>
                        ↩ Tandai Belum Selesai
                      </button>
                    )
                  }
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Tab: Arsip */}
      {showArsip && (
        <>
          {arsipList.length === 0 && (
            <div className={styles.emptyArsip}>Belum ada instruksi diarsipkan</div>
          )}

          {[...arsipList].reverse().map(ins => (
            <div key={ins.id} className={styles.cardArsip}>
              <div className={styles.arsipRow}>
                <div style={{ flex: 1 }}>
                  <div className={styles.arsipMeta}>
                    <span className={styles.arsipPrio}>{ins.prioritas} · {fmtDT(ins.ts)}</span>
                    {ins.selesai && <span className={styles.arsipSelesai}>✅ Selesai</span>}
                  </div>
                  <div className={styles.arsipJudul}>{ins.judul}</div>
                </div>

                {isAdmin && (
                  <div className={styles.adminActions}>
                    <button className={styles.btnEdit}    onClick={() => openEdit(ins)}>✏️</button>
                    <button className={styles.btnEdit}    onClick={() => toggleAktif(ins.id)}>Aktifkan</button>
                    <button className={styles.btnHapus}   onClick={() => hapus(ins.id)}>Hapus</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Modal: Buat / Edit Instruksi */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editItem ? 'Edit Instruksi' : 'Buat Instruksi Pimpinan'}
      >
        {!editItem && (
          <div className={styles.modalWarning}>
            🔴 Instruksi akan langsung terlihat oleh semua anggota yang login
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Inp label="Prioritas" value={fm.prioritas} onChange={e => f('prioritas', e.target.value)} as="select" half>
            <option>Penting</option>
            <option>Normal</option>
            <option>Info</option>
          </Inp>
          <Inp label="Target" value={fm.targetRegu} onChange={e => f('targetRegu', e.target.value)} as="select" half>
            <option>Semua</option>
            <option value="1">Regu 1</option>
            <option value="2">Regu 2</option>
            <option value="3">Regu 3</option>
          </Inp>
        </div>

        <Inp
          label="Judul Instruksi"
          value={fm.judul}
          onChange={e => f('judul', e.target.value)}
          placeholder="Contoh: Siaga penuh malam ini"
        />
        <Inp
          label="Isi Instruksi"
          value={fm.isi}
          onChange={e => f('isi', e.target.value)}
          as="textarea"
          placeholder="Detail perintah / arahan dari pimpinan..."
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={submit} color="var(--red)" size="lg" full>
            {editItem ? '✅ Simpan Perubahan' : '📤 Kirim Instruksi'}
          </Btn>
          <BtnBatal onClick={() => setOpen(false)} />
        </div>
      </Modal>
    </div>
  );
}

export default InstruksiTab;
