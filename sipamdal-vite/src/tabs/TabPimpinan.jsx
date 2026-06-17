// TabPimpinan.jsx — SIPAMDAL
// Sesi 4: Tab Dashboard Pimpinan
// Source: tab-pimpinan.js (766 baris)

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ANGGOTA_DATA, REGU, POS_LIST, cRgba,
  toLocalKey, getShiftKey, getBiodata, waLink,
} from "../utils/utils.js";
import { useDataStore } from "../stores/useDataStore.js";
import { useAppStore } from "../stores/useAppStore.js";
import { useAuthStore } from "../stores/useAuthStore.js";

// ── Konstanta jadwal ──────────────────────────────────────────────────────────
const JADWAL_ANCHOR = new Date(2026, 5, 6); // 6 Juni 2026

const JADWAL_HARI_LIBUR_DEFAULT = {
  "2026-1-1":   { label: "Tahun Baru 2026 Masehi" },
  "2026-1-16":  { label: "Isra Mikraj Nabi Muhammad SAW" },
  "2026-3-21":  { label: "Idulfitri 1447 H (1)" },
  "2026-3-22":  { label: "Idulfitri 1447 H (2)" },
  "2026-4-3":   { label: "Wafat Yesus Kristus" },
  "2026-5-1":   { label: "Hari Buruh Internasional" },
  "2026-5-14":  { label: "Kenaikan Yesus Kristus" },
  "2026-5-27":  { label: "Iduladha 1447 H" },
  "2026-5-31":  { label: "Hari Raya Waisak 2570 BE" },
  "2026-6-1":   { label: "Hari Lahir Pancasila" },
  "2026-6-16":  { label: "1 Muharam / Tahun Baru Islam 1448 H" },
  "2026-8-17":  { label: "Proklamasi Kemerdekaan RI" },
  "2026-12-25": { label: "Kelahiran Yesus Kristus (Natal)" },
};

const JADWAL_LIBUR_EKSTRA_DEFAULT = {
  "2026-6-1": [8,9],  "2026-6-6": [4,5],  "2026-6-7": [7,10], "2026-6-13": [6,8],
  "2026-6-14": [14,15],"2026-6-16": [9,10],"2026-6-20": [12,13],"2026-6-21": [1,2],
  "2026-6-27": [3,4], "2026-6-28": [6,7], "2026-7-4": [8,9],  "2026-7-5": [14,15],
  "2026-7-11": [11,12],"2026-7-12": [5,1], "2026-7-18": [2,3], "2026-7-19": [10,6],
  "2026-7-25": [7,8], "2026-7-26": [13,14],
};

const HARI_LIBUR_MAP_CEPAT = {
  "2026-1-1":1,"2026-1-16":1,"2026-2-17":1,"2026-3-19":1,"2026-3-21":1,"2026-3-22":1,
  "2026-4-3":1,"2026-4-5":1,"2026-5-1":1,"2026-5-14":1,"2026-5-27":1,"2026-5-31":1,
  "2026-6-1":1,"2026-6-16":1,"2026-8-17":1,"2026-8-25":1,"2026-12-25":1,
};

function jadwalGetRegu(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return ((Math.round((d - JADWAL_ANCHOR) / 86400000) % 3) + 3) % 3 + 1;
}

function fmtAgo(ms) {
  if (!isFinite(ms)) return null;
  const mnt = Math.floor(ms / 60000);
  if (mnt < 1) return "baru saja";
  if (mnt < 60) return `${mnt} menit lalu`;
  const jam = Math.floor(mnt / 60);
  return `${jam} jam ${mnt % 60} menit lalu`;
}

// ── SimpleModal helper ────────────────────────────────────────────────────────
function SimpleModal({ open, onClose, headerBg, headerBorder, title, titleColor, children }) {
  if (!open) return null;
  return createPortal(
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 1900,
        background: "rgba(10,22,40,.55)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: "calc(100% - 32px)", maxWidth: 360,
        background: "var(--bg-surface,#fff)", borderRadius: 20,
        zIndex: 1901, overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,.28)",
        animation: "centerModalIn .22s cubic-bezier(.22,1,.36,1) both",
      }}>
        <div style={{
          background: headerBg, borderBottom: `1px solid ${headerBorder}`,
          padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: titleColor }}>{title}</div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 99, border: "1px solid var(--border)",
            background: "var(--bg-raised,#F8FAFC)", fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        {children}
      </div>
    </>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabPimpinan
// ─────────────────────────────────────────────────────────────────────────────
export default function TabPimpinan({ onLogout, setTab, pushNotif = { isEnabled: false, isDenied: false, supported: false, requestPermission: async () => "denied" } }) {
  const patrols         = useDataStore(s => s.patrols)         ?? [];
  const standJaga       = useDataStore(s => s.standJaga)       ?? [];
  const incidents       = useDataStore(s => s.incidents)       ?? [];
  const posAssign       = useDataStore(s => s.posAssign)       ?? {};
  const instruksi       = useDataStore(s => s.instruksi)       ?? [];
  const setInstruksi    = useDataStore(s => s.setInstruksi);
  const mutations       = useDataStore(s => s.mutations)       ?? [];
  const packages        = useDataStore(s => s.packages)        ?? [];
  const guests          = useDataStore(s => s.guests)          ?? [];
  const liburData       = useDataStore(s => s.liburData)       ?? {};
  const waGrup          = useDataStore(s => s.waGrup)          ?? "";

  const toast           = useAppStore(s => s.toast);
  const currentUser     = useAuthStore(s => s.currentUser);

  const now       = new Date();
  const todayKey  = toLocalKey(now);
  const reguHari  = jadwalGetRegu(now);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [instruksiOpen, setInstruksiOpen] = useState(false);
  const [instruksiText, setInstruksiText] = useState("");
  const [lepasOpen,     setLepasOpen]     = useState(false);
  const [liburOpen,     setLiburOpen]     = useState(false);
  const [piketSelected, setPiketSelected] = useState(null);

  // Sync anyModalOpen ke window (untuk back button handler)
  useEffect(() => {
    window.__anyModalOpen = instruksiOpen || lepasOpen || liburOpen;
    if (instruksiOpen || lepasOpen || liburOpen)
      window.history.pushState({ modal: true }, "");
  }, [instruksiOpen, lepasOpen, liburOpen]);

  useEffect(() => {
    const handler = () => {
      setInstruksiOpen(false);
      setLepasOpen(false);
      setLiburOpen(false);
    };
    window.addEventListener("sipamdal_close_modals", handler);
    return () => window.removeEventListener("sipamdal_close_modals", handler);
  }, []);

  // ── Computed: libur ekstra (jadwal) ──────────────────────────────────────
  const jadwalLiburEkstraNama = (() => {
    try {
      const raw  = localStorage.getItem("pamdal_jadwal_libur");
      const jld  = raw ? { ...JSON.parse(raw), ...JADWAL_LIBUR_EKSTRA_DEFAULT } : { ...JADWAL_LIBUR_EKSTRA_DEFAULT };
      const key  = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const ids  = jld[key] || [];
      return ANGGOTA_DATA.items.filter(a => ids.includes(a.id)).map(a => a.nama);
    } catch { return []; }
  })();

  // ── Computed: patrol & status ─────────────────────────────────────────────
  const emptyPos       = POS_LIST.filter(p => !posAssign[p]?.length);
  const todP           = patrols.filter(p => new Date(p.ts).toDateString() === now.toDateString()).length;
  const lastPatrol     = patrols.filter(p => new Date(p.ts).toDateString() === now.toDateString()).sort((a, b) => b.ts - a.ts)[0];
  const msSince        = lastPatrol ? now - lastPatrol.ts : Infinity;
  const patrolOverdue  = msSince > 3600000;
  const kepatuhan      = Math.min(100, Math.round((todP / 12) * 100));
  const kepatColor     = kepatuhan >= 80 ? "var(--accent)" : kepatuhan >= 40 ? "var(--amber-text)" : "var(--red)";
  const lastAgo        = fmtAgo(msSince);

  const pendingPkg     = packages.filter(p => p.status === "Belum Diambil").length;
  const stayingGuest   = guests.filter(g => g.status === "Masih Ada").length;
  const todayMutations = mutations.filter(m => new Date(m.ts).toDateString() === now.toDateString()).length;

  const startOfWeek    = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const weekPatrols    = patrols.filter(p => new Date(p.ts) >= startOfWeek).length;
  const weekIncidents  = incidents.filter(i => new Date(i.ts || i.createdAt || 0) >= startOfWeek).length;
  const weekMutations  = mutations.filter(m => new Date(m.ts) >= startOfWeek).length;

  const actI           = incidents.filter(i => i.status !== "Selesai").length;
  const instrAktifCount = instruksi.filter(i => i.aktif && !i.selesai).length;

  const currentShiftKey     = getShiftKey(now);
  const tanpaSerahTerima    = mutations.filter(m => m.tipe === "TANPA_SERAH_TERIMA" && getShiftKey(m.ts) === currentShiftKey);
  const adaTanpaSerahTerima = tanpaSerahTerima.length > 0;

  const systemStatus = emptyPos.length > 1 ? "KRITIS" : emptyPos.length === 1 ? "PERHATIAN" : "NORMAL";
  const statusColor  = emptyPos.length > 1 ? "var(--red)" : emptyPos.length === 1 ? "var(--amber)" : "var(--accent)";

  // ── Regu lepas & libur ────────────────────────────────────────────────────
  const _urut2     = [3, 1, 2];
  const _idx2      = _urut2.indexOf(reguHari);
  const lepasRegu  = _urut2[(_idx2 + 2) % 3];
  const liburRegu2 = _urut2[(_idx2 + 1) % 3];
  const lepasAnggota = REGU[lepasRegu]  || [];
  const liburAnggota = REGU[liburRegu2] || [];
  const liburList    = (liburData[todayKey] || []).filter(nm => (REGU[reguHari] || []).includes(nm));

  // ── Hari libur nasional ───────────────────────────────────────────────────
  const hariLiburKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const hariLibur = (() => {
    try {
      const s = localStorage.getItem("pamdal_hari_libur");
      const m = s ? JSON.parse(s) : null;
      return m ? m[hariLiburKey] : JADWAL_HARI_LIBUR_DEFAULT[hariLiburKey];
    } catch { return null; }
  })();

  const isWeekendOrHoliday = (() => {
    const dow = now.getDay();
    if (dow === 0 || dow === 6) return true;
    try {
      const hl    = localStorage.getItem("pamdal_hari_libur");
      const hlMap = hl ? JSON.parse(hl) : {};
      return !!(hlMap[hariLiburKey] || HARI_LIBUR_MAP_CEPAT[hariLiburKey]);
    } catch { return false; }
  })();

  // ── WA Instruksi link builder ─────────────────────────────────────────────
  const buildWaHref = () => {
    const tgl   = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const jam   = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const nama  = currentUser?.name || "Pimpinan";
    const pesan = `📢 *INSTRUKSI KHUSUS*\n━━━━━━━━━━━━━━━━━━━━━━\n📅 ${tgl}, ${jam} WIB\n👤 Dari: ${nama}\n━━━━━━━━━━━━━━━━━━━━━━\n${instruksiText.trim() || "(tidak ada isi)"}`;
    const enc   = encodeURIComponent(pesan);
    if (waGrup) {
      return waGrup.includes("chat.whatsapp.com")
        ? waGrup
        : `https://wa.me/${waGrup.replace(/\D/g, "")}?text=${enc}`;
    }
    return `https://wa.me/?text=${enc}`;
  };

  return (
    <div style={{ paddingBottom: 24, background: "var(--bg-base)" }}>

      {/* ── TOP BAR ── */}
      <div className="pimp-topbar" style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "14px 16px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
      }}>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--tx-muted)", marginBottom: 2 }}>
            Monitoring & Kendali
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--tx-primary)", letterSpacing: -0.3, lineHeight: 1.2 }}>
            {currentUser?.name || "Pimpinan"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Status badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: systemStatus === "NORMAL" ? "rgba(14,165,233,.10)" : systemStatus === "PERHATIAN" ? "rgba(180,83,9,.11)" : "rgba(201,27,42,.11)",
            border: `1.5px solid ${systemStatus === "NORMAL" ? "rgba(4,120,87,.35)" : systemStatus === "PERHATIAN" ? "rgba(180,83,9,.40)" : "rgba(201,27,42,.38)"}`,
            borderRadius: 99, padding: "5px 11px 5px 8px",
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: statusColor,
              boxShadow: `0 0 0 2px ${cRgba(statusColor, .19)}`,
              animation: emptyPos.length > 0 ? "pulse 1.4s infinite" : "none", flexShrink: 0,
            }} />
            <span style={{ fontSize: 11.5, fontWeight: 900, color: statusColor, letterSpacing: 0.4 }}>
              {systemStatus}
            </span>
          </div>

          {/* Tombol Instruksi */}
          <button onClick={() => setInstruksiOpen(true)} style={{
            height: 36, borderRadius: 10, padding: "0 12px",
            background: "rgba(217,119,6,.08)", border: "1.5px solid rgba(217,119,6,.30)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            cursor: "pointer", flexShrink: 0, fontSize: 11, fontWeight: 700,
            color: "var(--amber-bright)", fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 14 }}>📢</span> Instruksi
          </button>

          {/* Logout */}
          <button onClick={() => onLogout?.()} style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(201,27,42,.07)", border: "1.5px solid rgba(201,27,42,.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, fontSize: 17,
          }}>
            🚪
          </button>
        </div>
      </div>

      {/* ── MODAL: Instruksi Khusus ── */}
      {instruksiOpen && createPortal(
        <>
          <div onClick={() => setInstruksiOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(10,22,40,.60)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 2001, background: "#fff", borderRadius: 22,
            width: "calc(100% - 32px)", maxWidth: 480,
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,.30)",
            animation: "centerModalIn .25s cubic-bezier(.22,1,.36,1) both",
          }}>
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tx-primary)" }}>📢 Instruksi Khusus</div>
                <div style={{ fontSize: 10, color: "var(--tx-muted)", marginTop: 1 }}>
                  {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })} · {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                </div>
              </div>
              <button onClick={() => setInstruksiOpen(false)} style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb",
                background: "#F9FAFB", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>

            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--tx-muted)", marginBottom: 8 }}>
                Ketik instruksi untuk grup piket. Akan dikirim langsung ke WhatsApp grup.
              </div>
              <textarea
                value={instruksiText}
                onChange={e => setInstruksiText(e.target.value)}
                placeholder="Contoh: Harap perhatikan pos utama, ada tamu penting jam 10.00..."
                rows={5}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1.5px solid var(--border)", fontSize: 12, lineHeight: 1.6,
                  fontFamily: "inherit", resize: "vertical",
                  background: "var(--bg-surface)", color: "var(--tx-primary)",
                  boxSizing: "border-box", outline: "none",
                }}
              />
              {!waGrup && (
                <div style={{ marginTop: 8, fontSize: 10, color: "var(--amber-bright)", background: "rgba(217,119,6,.08)", border: "1px solid rgba(217,119,6,.25)", borderRadius: 8, padding: "6px 10px" }}>
                  ⚠️ Link WA grup belum diset. Minta Admin untuk mengisi di menu Admin → Pengaturan Grup WA.
                </div>
              )}
            </div>

            <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
              <button onClick={() => { setInstruksiText(""); setInstruksiOpen(false); }} style={{
                flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid var(--border)",
                background: "var(--bg-surface)", color: "var(--tx-muted)", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>Batal</button>
              <a
                href={buildWaHref()}
                target="_blank" rel="noopener noreferrer"
                onClick={() => { if (!instruksiText.trim()) { alert("Tulis instruksi dulu!"); return false; } }}
                style={{
                  flex: 2, padding: "11px 0", borderRadius: 12,
                  border: "1.5px solid #25d36640", background: "#25d36615", color: "#128c7e",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none",
                }}
              >
                📱 Kirim ke Grup WA
              </a>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── 2-kolom layout ── */}
      <div className="pimp-layout">
        {/* ═══ KOLOM KIRI ═══ */}
        <div className="pimp-col">

          {/* Notif push belum aktif */}
          {pushNotif?.supported && !pushNotif?.isEnabled && (
            <div style={{ margin: "0 0 10px", background: "rgba(234,88,12,.08)", border: "1.5px solid rgba(234,88,12,.40)", borderLeft: "4px solid #D93025", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#D93025", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>🔔 Notifikasi Belum Aktif</div>
                <div style={{ fontSize: 10, color: "#B02820", lineHeight: 1.4 }}>
                  {pushNotif?.isDenied
                    ? "Notifikasi diblokir. Aktifkan manual di pengaturan browser."
                    : "Aktifkan agar tidak ketinggalan instruksi & broadcast dari pimpinan."}
                </div>
              </div>
              {!pushNotif?.isDenied && (
                <button onClick={async () => {
                  const r = await pushNotif?.requestPermission();
                  if (r === "granted") toast("🔔 Notifikasi aktif!");
                  else if (r === "denied") toast("Notifikasi diblokir oleh browser", false);
                }} style={{ flexShrink: 0, padding: "7px 12px", background: "#D93025", color: "#fff", border: "none", borderRadius: 10, fontSize: 10.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  Aktifkan
                </button>
              )}
            </div>
          )}

          {/* Alert tanpa serah terima */}
          {adaTanpaSerahTerima && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "rgba(201,27,42,.08)", border: "1.5px solid rgba(201,27,42,.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--red)", marginBottom: 2 }}>Serah Terima Tidak Dilakukan</div>
                {tanpaSerahTerima.map((m, i) => (
                  <div key={m.id || i} style={{ fontSize: 11, color: "var(--tx-secondary)", lineHeight: 1.5 }}>
                    Regu {m.fromRegu} tidak membuat laporan mutasi — Regu {m.toRegu} mencatat kondisi awal sendiri.
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Situasi Harian Hero Card ── */}
          <div style={{
            margin: "0 0 14px",
            background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-overlay) 60%, var(--bg-surface) 100%)",
            border: "1.5px solid rgba(14,165,233,0.30)",
            borderRadius: 18, padding: "16px 14px 14px",
            boxShadow: "0 4px 20px rgba(14,165,233,0.10)",
          }}>
            {/* Header piket */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent-text)", letterSpacing: 1.2, textTransform: "uppercase" }}>
                  🛡 Piket · Regu {reguHari}
                </div>
                <button onClick={() => setTab("jadwal")} style={{
                  fontSize: 9, fontWeight: 800, color: "var(--accent)",
                  background: "rgba(14,165,233,0.10)", border: "1px solid rgba(14,165,233,0.30)",
                  borderRadius: 99, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>
                  📅 Lihat Jadwal Lengkap
                </button>
              </div>
              {hariLibur && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(180,83,9,0.10)", color: "var(--amber-text)", border: "1px solid rgba(180,83,9,0.25)", borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>
                    🗓 {hariLibur.label}
                  </span>
                </div>
              )}
            </div>

            {/* Pill anggota piket */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {(REGU[reguHari] || [])
                .filter(nm => !(liburData[todayKey] || []).includes(nm) && !jadwalLiburEkstraNama.includes(nm))
                .map((nm, i) => {
                  const isSelected = piketSelected === nm;
                  return (
                    <button key={nm} onClick={() => setPiketSelected(prev => prev === nm ? null : nm)} style={{
                      flex: "1 1 0", minWidth: 0,
                      background: isSelected ? "var(--accent)" : "rgba(14,165,233,0.08)",
                      border: isSelected ? "2px solid var(--accent)" : "1.5px solid rgba(14,165,233,0.20)",
                      borderRadius: 99, padding: "6px 4px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", fontFamily: "inherit",
                      boxShadow: isSelected ? "0 3px 12px rgba(14,165,233,0.30)" : "none",
                      transition: "all .15s ease", overflow: "hidden",
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? "#fff" : "var(--tx-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        {nm.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              {jadwalLiburEkstraNama.filter(nm => (REGU[reguHari] || []).includes(nm)).map(nm => (
                <span key={`libur-${nm}`} style={{
                  flex: "1 1 0", minWidth: 0, fontSize: 11, fontWeight: 600,
                  color: "var(--amber-text)", background: "rgba(180,83,9,0.06)",
                  border: "1.5px solid rgba(180,83,9,0.18)", borderRadius: 99, padding: "6px 4px",
                  textDecoration: "line-through", opacity: 0.75,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {nm.split(" ")[0]} 🏖
                </span>
              ))}
            </div>

            {/* Badge Lepas & Libur */}
            <div style={{ display: "flex", gap: 6, marginBottom: piketSelected ? 8 : 0 }}>
              <button onClick={() => setLepasOpen(true)} style={{ flex: 1, background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.22)", borderRadius: 99, padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "var(--tx-muted)", letterSpacing: .5, textTransform: "uppercase" }}>↺ Lepas · Regu {lepasRegu}</span>
                <span style={{ fontSize: 10, color: "var(--tx-ghost)", fontWeight: 600 }}>{lepasAnggota.length} org</span>
              </button>
              <button onClick={() => setLiburOpen(true)} style={{ flex: 1, background: "rgba(180,83,9,0.07)", border: "1px solid rgba(180,83,9,0.22)", borderRadius: 99, padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "var(--amber-text)", letterSpacing: .5, textTransform: "uppercase" }}>☀ Libur · Regu {liburRegu2}</span>
                <span style={{ fontSize: 10, color: "var(--amber-text)", opacity: .7, fontWeight: 600 }}>{liburAnggota.length} org</span>
              </button>
            </div>

            {/* Mini-card anggota terpilih */}
            {piketSelected && (() => {
              const nm     = piketSelected;
              const posNya = POS_LIST.find(p => (posAssign[p] || []).includes(nm));
              const bio    = getBiodata(nm) || {};
              const nmPat  = patrols.filter(p => new Date(p.ts).toDateString() === now.toDateString() && p.officer?.includes(nm)).length;
              const skor   = Math.min(100, Math.round((nmPat / 12) * 100));
              const skC    = skor >= 80 ? "var(--accent)" : skor >= 50 ? "var(--amber-text)" : skor === 0 ? "var(--tx-ghost)" : "var(--red)";
              return (
                <div style={{ marginTop: 8, background: "var(--bg-surface,#fff)", border: "1.5px solid rgba(14,165,233,0.30)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 10px rgba(14,165,233,0.10)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 99, flexShrink: 0, background: "rgba(14,165,233,0.12)", border: `2px solid ${skC}`, color: skC, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {nm[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tx-primary)" }}>{nm}</div>
                    <div style={{ fontSize: 10, color: "var(--tx-muted)", marginTop: 1 }}>
                      {posNya ? `📍 ${posNya}` : "📍 Belum ditugaskan"}  ·  {nmPat}/12 patroli
                    </div>
                  </div>
                  {bio.noHp && bio.noHp !== "-" && (
                    <a href={waLink(bio.noHp, `Halo ${nm}, ada instruksi dari pimpinan.`)} target="_blank" rel="noopener noreferrer" style={{ width: 34, height: 34, borderRadius: 99, flexShrink: 0, background: "#25d36615", border: "1px solid #25d36640", fontSize: 17, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      📱
                    </a>
                  )}
                  <button onClick={() => setPiketSelected(null)} style={{ width: 28, height: 28, borderRadius: 99, border: "1px solid var(--border)", background: "var(--bg-raised,#F8FAFC)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "inherit" }}>
                    ×
                  </button>
                </div>
              );
            })()}
          </div>

          {/* ── Situasi Lapangan ── */}
          <div style={{ margin: "0 0 14px", background: "rgba(100,116,139,0.06)", border: "1.5px solid rgba(100,116,139,0.18)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#4B5563", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
              🗺 Situasi Lapangan
            </div>

            {/* Grid pos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {POS_LIST.map(p => {
                const liburSemua = [...(liburData[todayKey] || []), ...jadwalLiburEkstraNama];
                const occ        = (posAssign[p] || []).filter(nm => !liburSemua.includes(nm));
                const filled     = occ.length > 0;
                const isHighlighted = piketSelected && occ.includes(piketSelected);
                const isOptional    = p === "Gedung Utama" && isWeekendOrHoliday;
                return (
                  <div key={p} style={{
                    background: isOptional && !filled ? "rgba(100,116,139,0.05)" : filled ? "rgba(4,120,87,.07)" : "rgba(201,27,42,.07)",
                    border: isHighlighted ? "2px solid var(--accent)" : isOptional && !filled ? "1px dashed rgba(100,116,139,0.35)" : `1px solid ${filled ? "rgba(4,120,87,.22)" : "rgba(201,27,42,.25)"}`,
                    borderRadius: 10, padding: "6px 9px",
                    boxShadow: isHighlighted ? "0 0 0 3px rgba(14,165,233,0.18)" : "none",
                    transition: "all .15s ease", opacity: isOptional && !filled ? 0.65 : 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, flexShrink: 0, background: isOptional && !filled ? "rgba(100,116,139,0.4)" : filled ? "var(--accent)" : "var(--red)" }} />
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--tx-primary)" }}>{p}</span>
                      {isOptional && !filled && <span style={{ fontSize: 10, marginLeft: "auto", opacity: 0.5 }}>🔒</span>}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, paddingLeft: 12, color: filled ? "var(--accent-text)" : isOptional ? "var(--tx-muted)" : "var(--red)" }}>
                      {filled
                        ? occ.map((nm, i) => (
                            <span key={nm} style={nm === piketSelected ? { fontWeight: 900, textDecoration: "underline" } : {}}>
                              {i > 0 ? ", " : ""}{nm.split(" ")[0]}
                            </span>
                          ))
                        : isOptional ? "Tidak perlu diisi" : "Kosong"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Kepatuhan Patroli */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--accent-text)", letterSpacing: 1.2, textTransform: "uppercase" }}>🛡 Kepatuhan Patroli</div>
              <span style={{ fontSize: 11, fontWeight: 900, color: kepatColor }}>{todP} / 12 putaran</span>
            </div>
            <div style={{ height: 8, background: "rgba(14,165,233,0.15)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${kepatuhan}%`, background: kepatColor, borderRadius: 99, transition: "width .4s ease" }} />
            </div>
            <div style={{ fontSize: 10, color: patrolOverdue ? "var(--amber-text)" : "var(--tx-ghost)", fontWeight: 700, marginTop: 5 }}>
              {lastAgo
                ? (patrolOverdue ? `⚠️ Patroli terakhir: ${lastAgo}` : `Patroli terakhir: ${lastAgo}`)
                : "⚠️ Belum ada patroli hari ini"}
            </div>
          </div>

          {/* Status Hari Ini */}
          <div style={{ background: "var(--bg-surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "12px 12px 10px", marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--tx-muted)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>📋 Status Hari Ini</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Paket Menunggu",  col: pendingPkg > 0     ? "var(--amber)"   : "var(--tx-muted)", bg: pendingPkg > 0     ? "rgba(var(--amber-rgb),.07)" : "rgba(0,0,0,.03)", value: pendingPkg },
                { label: "Tamu Menginap",   col: stayingGuest > 0   ? "var(--accent)"  : "var(--tx-muted)", bg: stayingGuest > 0   ? "rgba(14,165,233,.07)"       : "rgba(0,0,0,.03)", value: stayingGuest },
                { label: "Mutasi Hari Ini", col: todayMutations > 0 ? "var(--violet)"  : "var(--tx-muted)", bg: todayMutations > 0 ? "rgba(109,40,217,.07)"       : "rgba(0,0,0,.03)", value: todayMutations },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: "1.5px solid var(--border)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.col, lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "var(--tx-muted)", marginTop: 2, lineHeight: 1.2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ KOLOM KANAN ═══ */}
        <div className="pimp-col">

          {/* Rekap Minggu Ini */}
          <div style={{ background: "var(--bg-surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "12px 12px 10px", marginBottom: 10 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--tx-muted)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>📅 Rekap Minggu Ini</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Patroli",       value: weekPatrols,   col: "var(--accent)",                                      bg: "rgba(14,165,233,.09)" },
                { label: "Insiden",       value: weekIncidents, col: weekIncidents > 0 ? "var(--red)" : "var(--tx-muted)", bg: weekIncidents > 0 ? "rgba(201,27,42,.08)" : "rgba(0,0,0,.04)" },
                { label: "Serah Terima",  value: weekMutations, col: "var(--violet)",                                      bg: "rgba(109,40,217,.08)" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${cRgba(s.col, .15)}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.col, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "var(--tx-muted)", fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>{/* /pimp-layout */}

      {/* Logout footer */}
      <div style={{ padding: "12px 12px 20px" }}>
        <button
          onClick={() => onLogout?.()}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "13px 0", background: "rgba(201,27,42,.06)",
            border: "1.5px solid rgba(201,27,42,.22)", borderRadius: 14,
            cursor: "pointer", fontFamily: "inherit", transition: "background .15s, border-color .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,27,42,.12)"; e.currentTarget.style.borderColor = "rgba(201,27,42,.40)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(201,27,42,.06)"; e.currentTarget.style.borderColor = "rgba(201,27,42,.22)"; }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>Keluar</span>
        </button>
        <div style={{ textAlign: "center", fontSize: 10, color: "var(--tx-ghost)", marginTop: 6 }}>
          {currentUser?.name} · Monitoring & Kendali
        </div>
      </div>

      {/* ── Modal Lepas ── */}
      <SimpleModal
        open={lepasOpen}
        onClose={() => setLepasOpen(false)}
        headerBg="rgba(100,116,139,0.12)"
        headerBorder="rgba(100,116,139,0.20)"
        title={`↺ Regu ${lepasRegu} — Regu Lepas`}
        titleColor="var(--tx-primary)"
      >
        <div style={{ padding: "12px 18px 20px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {lepasAnggota.map(nm => (
            <span key={nm} style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-secondary)", background: "rgba(100,116,139,0.10)", border: "1px solid rgba(100,116,139,0.20)", borderRadius: 99, padding: "5px 12px" }}>
              {nm.split(" ")[0]}
            </span>
          ))}
        </div>
      </SimpleModal>

      {/* ── Modal Libur ── */}
      <SimpleModal
        open={liburOpen}
        onClose={() => setLiburOpen(false)}
        headerBg="rgba(180,83,9,0.08)"
        headerBorder="rgba(180,83,9,0.20)"
        title={`☀ Regu ${liburRegu2} — Regu Libur`}
        titleColor="var(--tx-primary)"
      >
        <div style={{ padding: "12px 18px 20px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {liburAnggota.map(nm => (
            <span key={nm} style={{ fontSize: 12, fontWeight: 600, color: "var(--amber-text)", background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.20)", borderRadius: 99, padding: "5px 12px" }}>
              {nm.split(" ")[0]}
            </span>
          ))}
          {liburList.length > 0 && (
            <div style={{ width: "100%", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(180,83,9,0.15)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--amber-text)", marginBottom: 6 }}>CUTI PIKET REGU INI</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {liburList.map(nm => (
                  <span key={nm} style={{ fontSize: 12, fontWeight: 600, color: "var(--amber-text)", background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.20)", borderRadius: 99, padding: "5px 12px", textDecoration: "line-through", opacity: .7 }}>
                    {nm.split(" ")[0]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SimpleModal>

    </div>
  );
}

export { TabPimpinan as PimpinanTab };
