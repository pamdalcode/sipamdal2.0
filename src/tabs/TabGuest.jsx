// TabGuest.jsx — SIPAMDAL
// Sesi 5: Konversi tab-guest.js → JSX
// Named export: GuestTab
// Catatan: MutPrint, getNextRegu, MUTASI_TEMPLATES yang ada di source asli
//          dipindah ke TabMutasi.jsx (salah taruh di source).

import { useState } from "react";
import { getReguHari } from "../utils/utils.js";
import {
  Modal, Inp, Btn, Bdg, PH, IC,
  BtnSimpan, BtnBatal, ReadOnlyBanner, useInnerModal,
} from "../components/ui/UiComponents.jsx";
import { PhotoPicker } from "./TabInsiden.jsx";
import { fmtDT } from "../utils/utils.js";

// ── GuestCard (lokal) ─────────────────────────────────────────────────────────

function GC({ g, co, canEdit, onViewPhoto }) {
  const act = g.status === "Masih Ada";
  return (
    <div
      className="data-card"
      style={{
        background: act ? "rgba(109,40,217,.1)" : "var(--bg-surface)",
        borderColor: act ? "rgba(109,40,217,.4)" : "var(--border)",
        padding: "10px 12px", marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Bdg text={g.type}   color="var(--violet)" />
          <Bdg text={g.status} color={act ? "var(--violet)" : "var(--tx-muted)"} />
          {g.photo && <Bdg text="📷" color="var(--violet)" />}
        </div>
        <span style={{ fontSize: 10.5, color: "var(--tx-muted)" }}>{fmtDT(g.ts)}</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tx-secondary)" }}>{g.name}</div>
      <div style={{ fontSize: 11.5, color: "var(--tx-muted)" }}>{g.institution}</div>

      {g.purpose && (
        <div style={{ fontSize: 11, color: "var(--tx-muted)" }}>Keperluan: {g.purpose}</div>
      )}
      {g.room && (
        <div style={{ fontSize: 11, color: "var(--tx-muted)" }}>Kamar: {g.room}</div>
      )}
      {g.vehicle && (
        <div style={{ fontSize: 11, color: "var(--accent-text)", fontWeight: 700 }}>🚗 {g.vehicle}</div>
      )}

      {g.photo && (
        <button
          onClick={() => onViewPhoto(g.photo)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(109,40,217,.1)", border: "1px solid #D1D5DB",
            borderRadius: 6, padding: "8px 10px",
            fontSize: 11, color: "var(--violet)", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", marginTop: 5,
          }}
        >
          <img src={g.photo} alt="" style={{ width: 30, height: 20, objectFit: "cover", borderRadius: 3 }} />
          Lihat Foto
        </button>
      )}

      {act && canEdit && (
        <div style={{ marginTop: 7 }}>
          <Btn onClick={() => co(g.id)} color="var(--accent)" size="sm">✓ Check-Out</Btn>
        </div>
      )}
    </div>
  );
}

// ── GuestTab ──────────────────────────────────────────────────────────────────

export function GuestTab({ guests, setGuests, toast, canEdit }) {
  const [open, setOpen]           = useState(false);
  const [photo, setPhoto]         = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [fm, setFm] = useState({
    name: "", institution: "", purpose: "",
    type: "Tamu Harian", room: "", vehicle: "", status: "Masih Ada",
  });

  useInnerModal([open], [setOpen]);

  const f = (k, v) => setFm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    const namaTrim = fm.name.trim();
    if (!namaTrim)                { toast("Nama wajib diisi!", false); return; }
    if (namaTrim.length > 100)    { toast("Nama terlalu panjang (maks. 100 karakter)", false); return; }
    if (fm.institution.length > 100) { toast("Instansi terlalu panjang (maks. 100 karakter)", false); return; }
    if (fm.purpose.length > 200)  { toast("Keperluan terlalu panjang (maks. 200 karakter)", false); return; }

    setSaving(true);
    const entry = {
      ...fm,
      name: namaTrim,
      institution: fm.institution.trim(),
      purpose: fm.purpose.trim(),
      photo,
      id: Date.now(),
      ts: Date.now(),
    };
    try {
      await setGuests([...guests, entry]);
      setFm({ name: "", institution: "", purpose: "", type: "Tamu Harian", room: "", vehicle: "", status: "Masih Ada" });
      setPhoto(null);
      setOpen(false);
      toast("Tamu dicatat!");
    } catch {
      toast("❌ Gagal menyimpan. Periksa koneksi lalu coba lagi.", false);
    } finally {
      setSaving(false);
    }
  };

  const co = (id) => {
    if (!canEdit) return;
    setGuests(guests.map(g => g.id === id ? { ...g, status: "Sudah Keluar", checkOut: Date.now() } : g));
    toast("Tamu check-out!");
  };

  const staying = guests.filter(g => g.status === "Masih Ada");
  const gone    = guests.filter(g => g.status !== "Masih Ada");

  return (
    <div>
      <PH
        title="Tamu & Peserta Asrama"
        sub="Tamu harian, menginap, pelatihan, VIP"
        action={canEdit && (
          <Btn onClick={() => setOpen(true)} color="var(--accent)">
            {IC({ n: "plus", s: 13 })} Catat Tamu
          </Btn>
        )}
      />
      {!canEdit && <ReadOnlyBanner reguHari={getReguHari(new Date())} />}

      {/* Masih Ada */}
      {staying.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--violet)", marginBottom: 7 }}>
            🏠 Masih Ada ({staying.length})
          </div>
          {staying.map(g => (
            <GC key={g.id} g={g} co={co} canEdit={canEdit} onViewPhoto={setViewPhoto} />
          ))}
          <div style={{ borderTop: "1px solid var(--border2)", margin: "12px 0" }} />
        </>
      )}

      {/* Riwayat */}
      {gone.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-muted)", marginBottom: 7 }}>Riwayat</div>
          {[...gone].reverse().map(g => (
            <GC key={g.id} g={g} co={co} canEdit={canEdit} onViewPhoto={setViewPhoto} />
          ))}
        </>
      )}

      {/* Empty state */}
      {guests.length === 0 && (
        <div style={{
          textAlign: "center", padding: "36px 20px",
          background: "var(--bg-surface)", borderRadius: 16,
          border: "1.5px dashed var(--border)", marginBottom: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🪪</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-secondary)", marginBottom: 4 }}>Belum ada tamu hari ini</div>
          <div style={{ fontSize: 12, color: "var(--tx-muted)" }}>Tap tombol + Catat Tamu untuk mendaftarkan pengunjung</div>
        </div>
      )}

      {/* Modal: Form catat tamu */}
      <Modal open={open} onClose={() => { setOpen(false); setPhoto(null); }} title="Catat Tamu / Peserta">
        <Inp label="Nama" value={fm.name} onChange={e => f("name", e.target.value)} placeholder="Nama lengkap" />
        <Inp label="Instansi / Asal" value={fm.institution} onChange={e => f("institution", e.target.value)} placeholder="Instansi" />
        <Inp label="Jenis" value={fm.type} onChange={e => f("type", e.target.value)} as="select">
          {["Tamu Harian", "Menginap (Guest House)", "Peserta Pelatihan", "Tamu VIP"].map(t => (
            <option key={t}>{t}</option>
          ))}
        </Inp>
        <Inp label="Keperluan" value={fm.purpose} onChange={e => f("purpose", e.target.value)} placeholder="Tujuan kunjungan" />
        <Inp label="Kamar / Kelas" value={fm.room} onChange={e => f("room", e.target.value)} placeholder="GH-3, Asrama A, dst." />
        <Inp label="No. Kendaraan" value={fm.vehicle} onChange={e => f("vehicle", e.target.value.toUpperCase())} placeholder="Contoh: D 1234 AB" />
        <PhotoPicker photo={photo} setPhoto={setPhoto} label="📷 Foto Tamu / KTP" color="var(--violet)" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <BtnSimpan onClick={submit} loading={saving} />
          <BtnBatal onClick={() => { setOpen(false); setPhoto(null); }} />
        </div>

        {/* Modal: Lihat foto (nested) */}
        <Modal open={!!viewPhoto} onClose={() => setViewPhoto(null)} title="Foto Tamu">
          {viewPhoto && (
            <div style={{ textAlign: "center" }}>
              <img src={viewPhoto} alt="tamu" style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 10, marginBottom: 14 }} />
            </div>
          )}
        </Modal>
      </Modal>
    </div>
  );
}
