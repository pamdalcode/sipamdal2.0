// TabPeserta.jsx — SIPAMDAL
// Sesi 5: Tab Peserta Keluar Sementara
// Source: tab-peserta.js (165 baris)

import { useState } from "react";
import { getReguHari } from "../utils/utils.js";
import {
  IC, Btn, BtnSimpan, BtnBatal, Inp, PH,
  ReadOnlyBanner, Modal, useInnerModal,
} from "../components/ui/UiComponents.jsx";
import { useDataStore } from "../stores/useDataStore.js";
import { useAppStore } from "../stores/useAppStore.js";

// ── Format jam singkat ─────────────────────────────────────────────────────────
const fmtT = (d) =>
  new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// ─────────────────────────────────────────────────────────────────────────────
// TabPeserta
// ─────────────────────────────────────────────────────────────────────────────
export default function TabPeserta({ canEdit, isAdmin }) {
  const keluarData    = useDataStore(s => s.keluarData);
  const setKeluarData = useDataStore(s => s.setKeluarData);
  const toast         = useAppStore(s => s.toast);
  const now           = Date.now();

  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [fm, setFm]       = useState({ nama: "", plat: "" });

  useInnerModal([open], [setOpen]);

  const f = (k, v) => setFm(p => ({ ...p, [k]: v }));

  const sedangDiLuar = keluarData.filter(k => !k.kembali);
  const sudahKembali = keluarData.filter(k => k.kembali);

  const submit = async () => {
    if (!fm.nama.trim()) { toast("Nama peserta wajib diisi!", false); return; }
    setSaving(true);
    const entry = {
      ...fm,
      id: Date.now(),
      tsKeluar: Date.now(),
      kembali: null,
      tsKembali: null,
    };
    try {
      await setKeluarData([...keluarData, entry]);
      setFm({ nama: "", plat: "" });
      setOpen(false);
      toast(`${fm.nama} dicatat keluar${fm.plat ? " — " + fm.plat.toUpperCase() : ""}`);
    } catch {
      toast("❌ Gagal menyimpan. Periksa koneksi lalu coba lagi.", false);
    } finally {
      setSaving(false);
    }
  };

  const tandaiKembali = (id) => {
    if (!canEdit && !isAdmin) { toast("Tidak bisa edit", false); return; }
    setKeluarData(keluarData.map(k =>
      k.id === id ? { ...k, kembali: true, tsKembali: Date.now() } : k
    ));
    const item = keluarData.find(k => k.id === id);
    toast(`${item?.nama} sudah kembali ✅`);
  };

  const hapus = (id) => {
    if (!isAdmin) { toast("Hanya admin yang bisa hapus", false); return; }
    setKeluarData(keluarData.filter(k => k.id !== id));
    toast("Data dihapus");
  };

  const durasi = (tsKeluar) => {
    const mnt = Math.floor((now - new Date(tsKeluar)) / 60000);
    if (mnt < 60) return `${mnt} menit`;
    return `${Math.floor(mnt / 60)}j ${mnt % 60}m`;
  };

  return (
    <div>
      {/* Header */}
      <PH
        title="Peserta Keluar Sementara"
        sub="Catat peserta yang keluar malam/sore hari"
        action={canEdit && (
          <Btn onClick={() => setOpen(true)} color="var(--accent)">
            {IC({ n: "plus", s: 13 })} Catat Keluar
          </Btn>
        )}
      />

      {/* ReadOnly banner */}
      {!canEdit && !isAdmin && (
        <ReadOnlyBanner reguHari={getReguHari(new Date())} />
      )}

      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{
          background: "rgba(var(--amber-rgb),.12)",
          border: "1.5px solid rgba(var(--amber-rgb),.5)",
          borderRadius: 12, padding: "12px 16px", flex: 1, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "var(--amber-text)" }}>
            {sedangDiLuar.length}
          </div>
          <div style={{ fontSize: 11, color: "var(--amber-text)", fontWeight: 700 }}>
            Sedang di Luar
          </div>
        </div>
        <div style={{
          background: "var(--accent-tint)",
          border: "1.5px solid rgba(14,165,233,.35)",
          borderRadius: 12, padding: "12px 16px", flex: 1, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "var(--accent)" }}>
            {sudahKembali.length}
          </div>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
            Sudah Kembali
          </div>
        </div>
      </div>

      {/* Sedang di luar */}
      {sedangDiLuar.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--amber-text)", marginBottom: 8 }}>
            🚶 Sedang di Luar ({sedangDiLuar.length} orang)
          </div>

          {sedangDiLuar.map((k, idx) => (
            <div
              key={k.id}
              className="keluar-card"
              style={{
                background: "rgba(var(--amber-rgb),.07)",
                border: "1.5px solid rgba(var(--amber-rgb),.35)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 9,
                animationDelay: `${idx * 0.05}s`,
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 5,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tx)" }}>
                    {k.nama}
                  </div>
                  {k.plat && (
                    <div style={{
                      fontSize: 13, color: "var(--amber-text)", fontWeight: 700, marginTop: 3,
                      background: "rgba(var(--amber-rgb),.15)", display: "inline-block",
                      padding: "2px 8px", borderRadius: 6, letterSpacing: 1,
                    }}>
                      🚗 {k.plat.toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10.5, color: "var(--tx-muted)" }}>
                    Keluar {fmtT(k.tsKeluar)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--amber-text)", marginTop: 3 }}>
                    ⏱ {durasi(k.tsKeluar)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                {(canEdit || isAdmin) && (
                  <Btn onClick={() => tandaiKembali(k.id)} color="var(--accent)" size="sm">
                    {IC({ n: "ok", s: 12 })} Sudah Kembali
                  </Btn>
                )}
                {isAdmin && (
                  <Btn onClick={() => hapus(k.id)} color="var(--red)" size="sm" variant="outline">
                    Hapus
                  </Btn>
                )}
              </div>
            </div>
          ))}

          <div style={{ borderTop: "1px solid var(--border2)", margin: "14px 0" }} />
        </>
      )}

      {/* Sudah kembali */}
      {sudahKembali.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-muted)", marginBottom: 8 }}>
            ✅ Sudah Kembali ({sudahKembali.length})
          </div>

          {[...sudahKembali].reverse().map(k => (
            <div
              key={k.id}
              style={{
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 13px", marginBottom: 7,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx-secondary)" }}>
                    {k.nama}
                  </div>
                  {k.plat && (
                    <div style={{ fontSize: 11, color: "var(--tx-muted)" }}>
                      🚗 {k.plat.toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--tx-muted)" }}>
                    Keluar {fmtT(k.tsKeluar)}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--accent)", fontWeight: 700 }}>
                    ✅ Kembali {fmtT(k.tsKembali)}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => hapus(k.id)}
                      style={{
                        marginTop: 4, background: "none", border: "none",
                        fontSize: 10, color: "var(--tx-muted)", cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Empty state */}
      {keluarData.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--tx-muted)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🚶</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Belum ada peserta yang keluar.</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Catat peserta yang keluar sore/malam untuk ketertiban.
          </div>
        </div>
      )}

      {/* Modal: Catat keluar */}
      <Modal open={open} onClose={() => setOpen(false)} title="Catat Peserta Keluar">
        <Inp
          label="Nama Peserta"
          value={fm.nama}
          onChange={e => f("nama", e.target.value)}
          placeholder="Nama lengkap peserta"
        />
        <Inp
          label="Plat Nomor Kendaraan (opsional)"
          value={fm.plat}
          onChange={e => f("plat", e.target.value.toUpperCase())}
          placeholder="Contoh: D 1234 ABC"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <BtnSimpan onClick={submit} loading={saving} />
          <BtnBatal onClick={() => setOpen(false)} />
        </div>
      </Modal>
    </div>
  );
}

export { TabPeserta as PesertaTab };
