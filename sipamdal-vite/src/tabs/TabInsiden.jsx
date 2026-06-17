// TabInsiden.jsx — SIPAMDAL
// Migrasi dari tab-insiden.js ke Vite + React JSX + Zustand + CSS Modules
// Sesi 5: Tab laporan insiden (TabInsiden) + helper PhotoPicker

import { useState, useRef } from "react";
import styles from "./TabInsiden.module.css";

import {
  POS_LIST,
  INC_CAT, CAT_COL, CAT_BG,
  fmtDT,
  getReguHari,
  kompressFoto,
} from "../utils/utils.js";

import {
  IC, Modal, Inp, Btn, BtnSimpan, BtnBatal, Bdg, PH, ReadOnlyBanner,
  useInnerModal,
} from "../components/ui/UiComponents.jsx";

// ── PhotoPicker ────────────────────────────────────────────────────────────────
// Komponen pilih/ambil foto dengan preview & hapus.
// Diekspor agar bisa di-reuse oleh tab lain (TabPaket, dll).
export function PhotoPicker({ photo, setPhoto, label = " Foto Bukti", color = "var(--accent)" }) {
  const ref = useRef();

  const handle = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      kompressFoto(r.result).then((compressed) => setPhoto(compressed));
    };
    r.readAsDataURL(file);
  };

  const remove = () => {
    setPhoto(null);
    if (ref.current) ref.current.value = "";
  };

  const lightBg =
    color === "var(--red)"    ? "rgba(201,27,42,.1)"        :
    color === "var(--violet)" ? "rgba(109,40,217,.1)"        :
    color === "var(--amber)"  ? "rgba(var(--amber-rgb),.07)" :
    "var(--accent-tint)";

  const lightBorder =
    color === "var(--red)"    ? "var(--red)"                 :
    color === "var(--violet)" ? "rgba(109,40,217,.4)"        :
    color === "var(--amber)"  ? "rgba(var(--amber-rgb),.4)"  :
    "rgba(14,165,233,.35)";

  return (
    <div style={{ marginBottom: 12 }}>
      <label className={styles.pickerLabel} style={{ color }}>
        {label}
      </label>

      {!photo ? (
        <label
          className={styles.pickerDropzone}
          style={{ background: lightBg, border: `2px dashed ${lightBorder}`, color }}
        >
          <IC n="cam" s={20} c={color} />
          {" Ambil / Pilih Foto (opsional)"}
          <input
            ref={ref}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handle}
            style={{ display: "none" }}
          />
        </label>
      ) : (
        <div className={styles.pickerPreviewWrap}>
          <img
            src={photo}
            alt="bukti"
            className={styles.pickerImg}
            style={{ border: `2px solid ${lightBorder}` }}
          />
          <button className={styles.pickerRemoveBtn} onClick={remove}>
            {" Hapus"}
          </button>
          <div
            className={styles.pickerReadyBadge}
            style={{ background: `${color}dd` }}
          >
            {" Foto siap"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TabInsiden ─────────────────────────────────────────────────────────────────
export function TabInsiden({ incidents, setIncidents, posAssign, toast, canEdit }) {
  const [open, setOpen]           = useState(false);
  const [photo, setPhoto]         = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [fm, setFm] = useState({
    title: "", desc: "", category: "Rendah", pos: POS_LIST[0], status: "Aktif",
  });

  useInnerModal([open], [setOpen]);

  const f = (k, v) => setFm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const titleTrim = fm.title.trim();
    if (!titleTrim)                     { toast("Judul insiden wajib diisi!", false); return; }
    if (titleTrim.length > 150)         { toast("Judul terlalu panjang (maks. 150 karakter)", false); return; }
    if (fm.desc.length > 500)           { toast("Deskripsi terlalu panjang (maks. 500 karakter)", false); return; }
    if (!INC_CAT.includes(fm.category)) { toast("Kategori tidak valid", false); return; }
    if (!POS_LIST.includes(fm.pos))     { toast("Pos tidak valid", false); return; }

    setSaving(true);
    const entry = {
      ...fm,
      title:   titleTrim,
      desc:    fm.desc.trim(),
      photo,
      id:      Date.now(),
      ts:      Date.now(),
      officer: posAssign[fm.pos]?.join(", ") || "—",
    };
    try {
      await setIncidents([...incidents, entry]);
      setFm({ title: "", desc: "", category: "Rendah", pos: POS_LIST[0], status: "Aktif" });
      setPhoto(null);
      setOpen(false);
      toast("Insiden dicatat!");
    } catch {
      toast("❌ Gagal menyimpan. Periksa koneksi lalu coba lagi.", false);
    } finally {
      setSaving(false);
    }
  };

  const upd = (id, s) => {
    if (!canEdit) return;
    setIncidents(incidents.map((i) => (i.id === id ? { ...i, status: s } : i)));
  };

  const cardClass = (category) =>
    category === "Penting" ? styles.incCardPenting :
    category === "Sedang"  ? styles.incCardSedang  :
                             styles.incCardRendah;

  return (
    <div>
      {/* ── Header ── */}
      <PH
        title="Laporan Insiden"
        sub="Rendah · Sedang · Penting"
        action={
          canEdit && (
            <Btn
              onClick={() => setOpen(true)}
              color="var(--red)"
              className={styles.btnLaporkan}
            >
              <IC n="plus" s={13} /> Laporkan
            </Btn>
          )
        }
      />

      {!canEdit && <ReadOnlyBanner reguHari={getReguHari(new Date())} />}

      {/* ── Stat tiles per kategori ── */}
      <div className={styles.statTiles}>
        {INC_CAT.map((c) => {
          const cnt = incidents.filter((i) => i.category === c && i.status !== "Selesai").length;
          return (
            <div
              key={c}
              className={styles.statTile}
              style={{ background: CAT_BG[c], borderColor: `${CAT_COL[c]}28` }}
            >
              <div className={styles.statTileNumber} style={{ color: CAT_COL[c] }}>{cnt}</div>
              <div className={styles.statTileLabel}  style={{ color: CAT_COL[c] }}>{c}</div>
            </div>
          );
        })}
      </div>

      {/* ── Empty state ── */}
      {incidents.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🛡️</div>
          <div className={styles.emptyTitle}>Belum ada laporan insiden</div>
          <div className={styles.emptyHint}>Tap tombol + Laporkan di atas jika ada kejadian</div>
        </div>
      )}

      {/* ── Daftar insiden ── */}
      {[...incidents].reverse().map((inc) => (
        <div
          key={inc.id}
          className={`data-card ${cardClass(inc.category)}`}
          style={{ background: CAT_BG[inc.category], borderColor: `${CAT_COL[inc.category]}30` }}
        >
          {/* baris atas: badges + timestamp */}
          <div className={styles.cardHeader}>
            <div className={styles.badgeGroup}>
              <Bdg text={inc.category} color={CAT_COL[inc.category]} />
              <Bdg
                text={inc.status}
                color={inc.status === "Selesai" ? "var(--accent)" : "var(--amber-text)"}
              />
              {inc.photo && <Bdg text=" Foto" color="var(--violet)" />}
            </div>
            <span className={styles.cardTs}>{fmtDT(inc.ts)}</span>
          </div>

          <div className={styles.incTitle}>{inc.title}</div>
          <div className={styles.incDesc}>{inc.desc}</div>
          <div
            className={styles.incMeta}
            style={{ marginBottom: inc.photo ? 6 : 0 }}
          >
            Petugas: {inc.officer}
          </div>

          {/* tombol lihat foto */}
          {inc.photo && (
            <button
              className={styles.fotoBuktiBtn}
              onClick={() => setViewPhoto(inc.photo)}
            >
              <img src={inc.photo} alt="" className={styles.fotoThumb} />
              {" Lihat Foto Bukti"}
            </button>
          )}

          {/* tombol aksi */}
          {canEdit && inc.status !== "Selesai" && (
            <div className={styles.actionRow}>
              <Btn
                onClick={() => upd(inc.id, "Dalam Penanganan")}
                color="var(--amber-text)"
                size="sm"
                variant="outline"
              >
                Penanganan
              </Btn>
              <Btn
                onClick={() => upd(inc.id, "Selesai")}
                color="var(--accent)"
                size="sm"
              >
                {" Selesai"}
              </Btn>
            </div>
          )}
        </div>
      ))}

      {/* ── Modal form laporkan ── */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setPhoto(null); }}
        title="Laporkan Insiden"
      >
        <Inp
          label="Judul"
          value={fm.title}
          onChange={(e) => f("title", e.target.value)}
          placeholder="Judul insiden"
        />
        <Inp
          label="Deskripsi"
          value={fm.desc}
          onChange={(e) => f("desc", e.target.value)}
          as="textarea"
          placeholder="Detail kejadian..."
        />
        <div className={styles.selectRow}>
          <Inp
            label="Kategori"
            value={fm.category}
            onChange={(e) => f("category", e.target.value)}
            as="select"
            half
          >
            {INC_CAT.map((c) => <option key={c}>{c}</option>)}
          </Inp>
          <Inp
            label="Pos"
            value={fm.pos}
            onChange={(e) => f("pos", e.target.value)}
            as="select"
            half
          >
            {POS_LIST.map((p) => <option key={p}>{p}</option>)}
          </Inp>
        </div>
        <PhotoPicker
          photo={photo}
          setPhoto={setPhoto}
          label=" Foto Bukti Insiden"
          color="var(--red)"
        />
        <div className={styles.formActions}>
          <BtnSimpan onClick={submit} loading={saving} color="var(--red)">
            Laporkan Insiden
          </BtnSimpan>
          <BtnBatal onClick={() => { setOpen(false); setPhoto(null); }} />
        </div>
      </Modal>

      {/* ── Modal lihat foto bukti ── */}
      <Modal
        open={!!viewPhoto}
        onClose={() => setViewPhoto(null)}
        title="Foto Bukti Insiden"
      >
        {viewPhoto && (
          <div style={{ textAlign: "center" }}>
            <img src={viewPhoto} alt="bukti" className={styles.fotoViewImg} />
          </div>
        )}
      </Modal>
    </div>
  );
}

export { TabInsiden as IncTab };
export default TabInsiden;
