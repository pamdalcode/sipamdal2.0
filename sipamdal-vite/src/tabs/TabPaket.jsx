// TabPaket.jsx — SIPAMDAL
// Migrasi dari: tab-paket.js
// Sesi 5 — Tab Kecil & Finalisasi

import { useState } from "react";
import { fmtDT, getReguHari } from "../utils/utils.js";
import {
  IC, Modal, Inp, Btn, BtnSimpan, BtnBatal, Bdg, PH, ReadOnlyBanner,
  useInnerModal,
} from "../components/ui/UiComponents.jsx";
import { PhotoPicker } from "./TabInsiden.jsx";
import styles from "./TabPaket.module.css";

const PKG_TYPES = [
  "Paket",
  "Surat",
  "Go-Food / GoJek",
  "GrabFood",
  "Shopee Food",
  "Kurir Lainnya",
];

// ── PC — Kartu satu paket ──────────────────────────────────────────────────────
function PC({ p, upd, canEdit, onViewPhoto }) {
  const pending = p.status === "Belum Diambil";

  return (
    <div className={`${styles.card} ${pending ? styles.cardPending : ""}`}>
      {/* Baris atas: badges + timestamp */}
      <div className={styles.cardHeader}>
        <div className={styles.badges}>
          <Bdg text={p.type}   color="var(--accent)" />
          <Bdg text={p.status} color={pending ? "var(--amber-text)" : "var(--accent)"} />
          {p.photo && <Bdg text="" color="var(--violet)" />}
        </div>
        <span className={styles.timestamp}>{fmtDT(p.ts)}</span>
      </div>

      <div className={styles.recipient}>Untuk: {p.recipient}</div>
      <div className={styles.sender}>Dari: {p.sender || "—"}</div>
      {p.notes && <div className={styles.resi}>Resi: {p.notes}</div>}

      {/* Tombol lihat foto */}
      {p.photo && (
        <button
          className={styles.photoBtn}
          onClick={() => onViewPhoto(p.photo)}
        >
          <img
            src={p.photo}
            alt=""
            className={styles.photoThumb}
          />
          Lihat Foto
        </button>
      )}

      {/* Tombol aksi */}
      {pending && canEdit && (
        <div className={styles.actions}>
          <Btn
            onClick={() => upd(p.id, "Sudah Diambil")}
            color="var(--accent)"
            size="sm"
          >
            {IC({ n: "check", s: 12 })} Diambil
          </Btn>
          <Btn
            onClick={() => upd(p.id, "Diantar")}
            color="var(--accent)"
            size="sm"
          >
            {IC({ n: "truck", s: 12 })} Diantar
          </Btn>
        </div>
      )}
    </div>
  );
}

// ── TabPaket ───────────────────────────────────────────────────────────────────
export function TabPaket({ packages, setPackages, toast, canEdit }) {
  const [open, setOpen]           = useState(false);
  const [photo, setPhoto]         = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [fm, setFm] = useState({
    recipient: "",
    sender:    "",
    type:      "Paket",
    notes:     "",
    status:    "Belum Diambil",
  });

  useInnerModal([open], [setOpen]);

  const f = (k, v) => setFm(prev => ({ ...prev, [k]: v }));

  const handleClose = () => {
    setOpen(false);
    setPhoto(null);
  };

  const submit = async () => {
    const recipientTrim = fm.recipient.trim();
    if (!recipientTrim)             { toast("Nama penerima wajib diisi!", false); return; }
    if (recipientTrim.length > 100) { toast("Nama penerima terlalu panjang (maks. 100 karakter)", false); return; }
    if (fm.sender.length > 100)     { toast("Nama pengirim terlalu panjang (maks. 100 karakter)", false); return; }
    if (fm.notes.length > 200)      { toast("Keterangan terlalu panjang (maks. 200 karakter)", false); return; }

    setSaving(true);
    const entry = {
      ...fm,
      recipient: recipientTrim,
      sender:    fm.sender.trim(),
      notes:     fm.notes.trim(),
      photo,
      id: Date.now(),
      ts: Date.now(),
    };

    try {
      await setPackages([...packages, entry]);
      setFm({ recipient: "", sender: "", type: "Paket", notes: "", status: "Belum Diambil" });
      setPhoto(null);
      setOpen(false);
      toast("Paket dicatat!");
    } catch {
      toast("❌ Gagal menyimpan. Periksa koneksi lalu coba lagi.", false);
    } finally {
      setSaving(false);
    }
  };

  const upd = (id, status) => {
    if (!canEdit) return;
    setPackages(packages.map(p =>
      p.id === id ? { ...p, status, takenAt: Date.now() } : p
    ));
    toast("Status diperbarui!");
  };

  const pend = packages.filter(p => p.status === "Belum Diambil");
  const done = packages.filter(p => p.status !== "Belum Diambil");

  return (
    <div>
      {/* Header */}
      <PH
        title="Paket & Kurir"
        sub="Catat dan kelola paket masuk"
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)} color="var(--accent)">
              {IC({ n: "plus", s: 13 })} Catat
            </Btn>
          )
        }
      />

      {!canEdit && <ReadOnlyBanner reguHari={getReguHari(new Date())} />}

      {/* Stat tiles */}
      <div className={styles.stats}>
        <div className={`${styles.statTile} ${styles.statPending}`}>
          <div className={`${styles.statNumber} ${styles.statNumberAmber}`}>
            {pend.length}
          </div>
          <div className={`${styles.statLabel} ${styles.statLabelAmber}`}>
            Belum Diambil
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statDone}`}>
          <div className={`${styles.statNumber} ${styles.statNumberAccent}`}>
            {done.length}
          </div>
          <div className={`${styles.statLabel} ${styles.statLabelAccent}`}>
            Selesai
          </div>
        </div>
      </div>

      {/* Menunggu pengambilan */}
      {pend.length > 0 && (
        <>
          <div className={styles.sectionLabel} style={{ color: "var(--amber-text)" }}>
            🕐 Menunggu Pengambilan
          </div>
          {pend.map(p => (
            <PC key={p.id} p={p} upd={upd} canEdit={canEdit} onViewPhoto={setViewPhoto} />
          ))}
          <div className={styles.divider} />
        </>
      )}

      {/* Riwayat */}
      {done.length > 0 && (
        <>
          <div className={styles.sectionLabel} style={{ color: "var(--tx-muted)" }}>
            Riwayat
          </div>
          {[...done].reverse().map(p => (
            <PC key={p.id} p={p} upd={upd} canEdit={canEdit} onViewPhoto={setViewPhoto} />
          ))}
        </>
      )}

      {/* Empty state */}
      {packages.length === 0 && (
        <div className={styles.empty}>Belum ada paket.</div>
      )}

      {/* Modal: catat paket */}
      <Modal open={open} onClose={handleClose} title="Catat Paket / Kurir">
        <Inp
          label="Penerima"
          value={fm.recipient}
          onChange={e => f("recipient", e.target.value)}
          placeholder="Nama karyawan"
        />
        <Inp
          label="Pengirim"
          value={fm.sender}
          onChange={e => f("sender", e.target.value)}
          placeholder="Nama pengirim"
        />
        <Inp
          label="Jenis"
          value={fm.type}
          onChange={e => f("type", e.target.value)}
          as="select"
        >
          {PKG_TYPES.map(t => (
            <option key={t}>{t}</option>
          ))}
        </Inp>
        <Inp
          label="Resi / Keterangan"
          value={fm.notes}
          onChange={e => f("notes", e.target.value)}
          placeholder="Nomor resi"
        />
        <PhotoPicker
          photo={photo}
          setPhoto={setPhoto}
          label="📷 Foto Paket"
          color="var(--amber-text)"
        />
        <div className={styles.formActions}>
          <BtnSimpan onClick={submit} loading={saving} />
          <BtnBatal onClick={handleClose} />
        </div>
      </Modal>

      {/* Modal: lihat foto paket */}
      <Modal
        open={!!viewPhoto}
        onClose={() => setViewPhoto(null)}
        title="Foto Paket"
      >
        {viewPhoto && (
          <div className={styles.photoView}>
            <img
              src={viewPhoto}
              alt="paket"
              className={styles.photoFull}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

export { TabPaket as PkgTab };
