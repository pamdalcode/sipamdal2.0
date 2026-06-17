// TabInventaris.jsx — SIPAMDAL
// Sesi 5: Tab Inventaris Barang
// Source: tab-inventaris.js (253 baris)

import { useState } from "react";
import { toLocalKey, getReguHari } from "../utils/utils.js";
import {
  IC, Btn, BtnSimpan, BtnBatal, PH, ReadOnlyBanner,
  Modal, useInnerModal,
} from "../components/ui/UiComponents.jsx";
import { useDataStore } from "../stores/useDataStore.js";
import { useAppStore } from "../stores/useAppStore.js";
import { useAuthStore } from "../stores/useAuthStore.js";

// ── Konstanta status ──────────────────────────────────────────────────────────
const STATUS_OPTS  = ["Lengkap", "Kurang", "Rusak"];
const STATUS_COLOR = {
  Lengkap: "var(--accent)",
  Kurang:  "var(--amber)",
  Rusak:   "var(--red)",
};
const STATUS_BG = {
  Lengkap: "rgba(var(--green-rgb),.12)",
  Kurang:  "rgba(var(--amber-rgb),.12)",
  Rusak:   "rgba(201,27,42,.12)",
};

// ─────────────────────────────────────────────────────────────────────────────
// TabInventaris
// ─────────────────────────────────────────────────────────────────────────────
export default function TabInventaris({ canEdit, isAdmin }) {
  const inventarisDaftar    = useDataStore(s => s.inventarisDaftar);
  const setInventarisDaftar = useDataStore(s => s.setInventarisDaftar);
  const inventarisCek       = useDataStore(s => s.inventarisCek);
  const setInventarisCek    = useDataStore(s => s.setInventarisCek);
  const posAssign           = useDataStore(s => s.posAssign) ?? {};
  const toast               = useAppStore(s => s.toast);
  const currentUser         = useAuthStore(s => s.currentUser);

  const now      = new Date();
  const todayKey = toLocalKey(now);
  const cekHari  = inventarisCek[todayKey] || {};

  // ── Cek apakah user bertugas di Pos Utama ────────────────────────────────
  const isPosUtama = isAdmin || (() => {
    const nama = currentUser?.name;
    if (!nama) return false;
    return (posAssign["Pos Utama"] || []).includes(nama);
  })();
  const canCeklis = canEdit && isPosUtama;

  const [editOpen,    setEditOpen]    = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [formNama,    setFormNama]    = useState("");
  const [formJumlah,  setFormJumlah]  = useState("");

  useInnerModal([editOpen], [setEditOpen]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const setCekStatus = (id, status) => {
    if (!canCeklis) {
      if (!canEdit) { toast("Mode baca saja — bukan regu piket hari ini", false); return; }
      toast("Ceklist inventaris hanya untuk petugas Pos Utama", false);
      return;
    }
    const updated = {
      ...inventarisCek,
      [todayKey]: {
        ...cekHari,
        [id]: {
          ...(cekHari[id] || {}),
          status,
          waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      },
    };
    setInventarisCek(updated);
    toast("Status diperbarui!");
  };

  const setCekKet = (id, ket) => {
    if (!canCeklis) return;
    const updated = {
      ...inventarisCek,
      [todayKey]: {
        ...cekHari,
        [id]: { ...(cekHari[id] || {}), ket },
      },
    };
    setInventarisCek(updated);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormNama(item ? item.nama : "");
    setFormJumlah(item ? item.jumlah : "");
    setEditOpen(true);
  };

  const saveEdit = () => {
    const namaTrim = formNama.trim();
    if (!namaTrim)                      return toast("Nama barang wajib diisi!", false);
    if (namaTrim.length > 100)          return toast("Nama barang terlalu panjang (maks. 100 karakter)", false);
    if (formJumlah.trim().length > 50)  return toast("Jumlah/satuan terlalu panjang (maks. 50 karakter)", false);

    if (editItem) {
      setInventarisDaftar(inventarisDaftar.map(x =>
        x.id === editItem.id
          ? { ...x, nama: namaTrim, jumlah: formJumlah.trim() || "-" }
          : x
      ));
      toast("Barang diperbarui!");
    } else {
      const newId = "inv" + Date.now();
      setInventarisDaftar([
        ...inventarisDaftar,
        { id: newId, nama: namaTrim, jumlah: formJumlah.trim() || "-" },
      ]);
      toast("Barang ditambahkan!");
    }
    setEditOpen(false);
  };

  const hapusItem = (id) => {
    if (!window.confirm("Hapus barang ini?")) return;
    setInventarisDaftar(inventarisDaftar.filter(x => x.id !== id));
    toast("Barang dihapus!");
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalCek   = inventarisDaftar.filter(b => cekHari[b.id]?.status).length;
  const adaMasalah = inventarisDaftar.filter(b => cekHari[b.id]?.status && cekHari[b.id]?.status !== "Lengkap").length;

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <PH
        title="Inventaris Barang"
        sub="Cek & kelola barang per shift"
        action={isAdmin && (
          <Btn onClick={() => openEdit(null)} color="var(--accent)" size="sm">
            {IC({ n: "plus", s: 12 })} Tambah
          </Btn>
        )}
      />

      {/* ReadOnly banner */}
      {!canEdit && !isAdmin && (
        <ReadOnlyBanner reguHari={getReguHari(new Date())} />
      )}

      {/* Pos Utama banner */}
      {canEdit && !isAdmin && !isPosUtama && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
          background: "rgba(245,158,11,.10)", border: "1.5px solid rgba(245,158,11,.35)",
          borderRadius: 12, padding: "10px 14px",
        }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--amber)" }}>
              Hanya Petugas Pos Utama
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-muted)", marginTop: 1 }}>
              Ceklist inventaris hanya bisa dilakukan oleh anggota yang bertugas di Pos Utama
            </div>
          </div>
        </div>
      )}

      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div className="stat-tile" style={{
          flex: 1, background: "rgba(var(--orb-rgb),.1)",
          borderColor: "rgba(var(--orb-rgb),.18)",
        }}>
          <div className="stat-tile-number" style={{ color: "var(--accent)" }}>
            {totalCek}/{inventarisDaftar.length}
          </div>
          <div className="stat-tile-label" style={{ color: "var(--accent)" }}>Sudah Dicek</div>
        </div>

        <div className="stat-tile" style={{
          flex: 1,
          background: adaMasalah > 0 ? "rgba(201,27,42,.1)" : "var(--accent-tint)",
          borderColor: adaMasalah > 0 ? "rgba(201,27,42,.3)" : "rgba(14,165,233,.35)",
        }}>
          <div className="stat-tile-number" style={{ color: adaMasalah > 0 ? "var(--red)" : "var(--accent)" }}>
            {adaMasalah}
          </div>
          <div className="stat-tile-label" style={{ color: adaMasalah > 0 ? "var(--red)" : "var(--accent)" }}>
            Ada Masalah
          </div>
        </div>

        <div className="stat-tile" style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tx)" }}>
            {now.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
          </div>
          <div className="stat-tile-label" style={{ color: "var(--tx-muted)" }}>Tanggal Cek</div>
        </div>
      </div>

      {/* Daftar barang */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {inventarisDaftar.map((b, i) => {
          const cek       = cekHari[b.id] || {};
          const hasStatus = !!cek.status;

          return (
            <div
              key={b.id}
              className="inv-card"
              style={{
                borderColor: hasStatus ? STATUS_COLOR[cek.status] : "var(--border)",
                borderWidth: hasStatus ? 2 : 1,
                background: hasStatus ? STATUS_BG[cek.status] : undefined,
              }}
            >
              {/* Baris atas: nomor, nama, status badge, tombol edit/hapus */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: hasStatus ? 8 : 0,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "rgba(var(--orb-rgb),.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, color: "var(--accent)", fontSize: 12, flexShrink: 0,
                }}>
                  {i + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--tx-secondary)" }}>
                    {b.nama}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--tx-muted)" }}>{b.jumlah}</div>
                </div>

                {hasStatus && (
                  <div style={{
                    background: STATUS_BG[cek.status],
                    border: `1px solid ${STATUS_COLOR[cek.status]}44`,
                    borderRadius: 8, padding: "3px 8px",
                    fontSize: 11, fontWeight: 700, color: STATUS_COLOR[cek.status],
                  }}>
                    {cek.status}
                    {cek.waktu && (
                      <span style={{ fontWeight: 400, color: "var(--tx-muted)", marginLeft: 4 }}>
                        {cek.waktu}
                      </span>
                    )}
                  </div>
                )}

                {isAdmin && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(b)}
                      style={{
                        background: "var(--bg-surface)", border: "1px solid var(--border)",
                        borderRadius: 6, padding: "8px 10px", cursor: "pointer",
                        color: "var(--accent)", fontSize: 10, fontWeight: 700,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => hapusItem(b.id)}
                      style={{
                        background: "rgba(201,27,42,.1)", border: "1px solid #FFCDD2",
                        borderRadius: 6, padding: "8px 10px", cursor: "pointer",
                        color: "var(--red)", fontSize: 10, fontWeight: 700,
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              {/* Tombol status */}
              {canCeklis && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATUS_OPTS.map(s => (
                    <button
                      key={s}
                      onClick={() => setCekStatus(b.id, s)}
                      style={{
                        flex: 1, minWidth: 70, padding: "6px 4px", borderRadius: 8,
                        border: `1.5px solid ${cek.status === s ? STATUS_COLOR[s] : "var(--border2)"}`,
                        background: cek.status === s ? STATUS_BG[cek.status] : "var(--bg-surface)",
                        color: cek.status === s ? STATUS_COLOR[s] : "var(--tx-secondary)",
                        fontWeight: cek.status === s ? 700 : 600,
                        fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input keterangan masalah */}
              {hasStatus && cek.status !== "Lengkap" && canCeklis && (
                <input
                  value={cek.ket || ""}
                  onChange={e => setCekKet(b.id, e.target.value)}
                  placeholder="Keterangan masalah..."
                  style={{
                    width: "100%", marginTop: 6, padding: "6px 10px",
                    borderRadius: 8, border: "1.5px solid #FFCDD2",
                    fontSize: 11, fontFamily: "inherit",
                    boxSizing: "border-box", color: "var(--tx)",
                  }}
                />
              )}

              {/* Keterangan read-only */}
              {hasStatus && cek.status !== "Lengkap" && !canCeklis && cek.ket && (
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--red)", fontStyle: "italic" }}>
                  📝 {cek.ket}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Tambah / Edit barang */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editItem ? "Edit Barang" : "Tambah Barang"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{
              fontSize: 12, fontWeight: 600, color: "var(--tx)",
              display: "block", marginBottom: 4,
            }}>
              Nama Barang *
            </label>
            <input
              value={formNama}
              onChange={e => setFormNama(e.target.value)}
              placeholder="Contoh: Senter, APAR, Handy Talky..."
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10,
                border: "1px solid var(--border)", fontSize: 13,
                fontFamily: "inherit", boxSizing: "border-box", color: "var(--tx)",
              }}
            />
          </div>

          <div>
            <label style={{
              fontSize: 12, fontWeight: 600, color: "var(--tx)",
              display: "block", marginBottom: 4,
            }}>
              Jumlah
            </label>
            <input
              value={formJumlah}
              onChange={e => setFormJumlah(e.target.value)}
              placeholder="Contoh: 2 unit, 1 set..."
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10,
                border: "1px solid var(--border)", fontSize: 13,
                fontFamily: "inherit", boxSizing: "border-box", color: "var(--tx)",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <BtnSimpan onClick={saveEdit} />
            <BtnBatal onClick={() => setEditOpen(false)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export { TabInventaris as InventarisTab };
