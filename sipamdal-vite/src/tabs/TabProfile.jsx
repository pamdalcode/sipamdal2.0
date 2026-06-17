// TabProfile.jsx — SIPAMDAL
// Sesi 5: Konversi tab-profile.js → JSX
// Named export: ProfileTab

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { IC, BtnSimpan, BtnBatal } from "../components/ui/UiComponents.jsx";
import {
  DEFAULT_PINS, getPinFromFS, savePinToFS, hashPin, auditAction,
  bioClearCred, bioHasCred, bioIsSupported, bioPlatformAvailable, bioRegister,
} from "../stores/useAuthStore.js";

// ── Helper: PIN field ─────────────────────────────────────────────────────────

function PinField({ label, value, setter }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--tx-muted)", display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={e => setter(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        style={{
          width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)",
          color: "var(--tx-primary)", borderRadius: 9, padding: "10px 12px",
          fontSize: 18, letterSpacing: 6, outline: "none", boxSizing: "border-box",
          fontFamily: "monospace",
        }}
      />
    </div>
  );
}

// ── Helper: TapCard ───────────────────────────────────────────────────────────

function TapCard({ label, value, sub, color, bg, onClick }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px ${color}28`; e.currentTarget.style.transform = "scale(1.02)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "scale(1)"; }}
      style={{
        background: bg, border: `1.5px solid ${color}20`, borderRadius: 12,
        padding: "12px 14px", textAlign: "center",
        cursor: "pointer", transition: "box-shadow .15s, transform .12s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color, marginBottom: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--tx-muted)" }}>{sub}</div>}
      <div style={{ fontSize: 9, fontWeight: 700, color, marginTop: 4, opacity: 0.65 }}>▶ lihat detail</div>
    </div>
  );
}

// ── Helper: GenericModal (portal) ─────────────────────────────────────────────

function GenericModal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(10,22,40,.60)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 2001, background: "#fff", borderRadius: 20,
          width: "calc(100% - 28px)", maxWidth: 420, maxHeight: "80vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,.28)",
          animation: "centerModalIn .25s cubic-bezier(.22,1,.36,1) both",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--accent)", borderRadius: "20px 20px 0 0" }} />
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--tx-primary)" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: "var(--tx-muted)", marginTop: 1 }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e5e7eb", background: "#F9FAFB", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px 16px", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Row components ────────────────────────────────────────────────────────────

function PatrolRow({ p, onViewPhoto }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #F0F7FF" }}>
      <div
        style={{ width: 34, height: 34, borderRadius: 9, background: p.photo ? "rgba(109,40,217,.10)" : "rgba(14,165,233,.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: p.photo ? "pointer" : "default" }}
        onClick={() => p.photo && onViewPhoto(p.photo)}
      >
        <span style={{ fontSize: 16 }}>{p.photo ? "🖼" : "📍"}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tx-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.areas?.join(", ")}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginTop: 1 }}>{p.pos || "—"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
          {new Date(p.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ fontSize: 9.5, color: "var(--tx-muted)" }}>
          {new Date(p.ts).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
        </div>
        {p.photo && (
          <button
            onClick={() => onViewPhoto(p.photo)}
            style={{ background: "rgba(109,40,217,.10)", border: "1px solid #D1D5DB", borderRadius: 5, padding: "2px 8px", fontSize: 10, color: "var(--violet)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >🖼 Foto</button>
        )}
      </div>
    </div>
  );
}

function StandRow({ s }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid #F0F7FF" }}>
      <div style={{ width: 34, height: 34, background: "var(--accent-tint)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {IC({ n: "shield", s: 14, c: "var(--accent)" })}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tx-primary)" }}>{s.area}</div>
        <div style={{ fontSize: 10.5, color: "var(--tx-muted)" }}>{s.pos || "—"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
          {new Date(s.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ fontSize: 9.5, color: "var(--tx-muted)" }}>
          {new Date(s.ts).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
        </div>
      </div>
    </div>
  );
}

function IncidenRow({ i }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 0", borderBottom: "1px solid #FFF0F0" }}>
      <div style={{ width: 34, height: 34, background: "rgba(201,27,42,.10)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {IC({ n: "alert", s: 14, c: "var(--red)" })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tx-primary)", lineHeight: 1.3 }}>{i.title || "—"}</div>
        <div style={{ fontSize: 10.5, color: "var(--tx-muted)", marginTop: 2 }}>{i.category || "—"}</div>
        {i.status && (
          <span style={{
            fontSize: 9.5, fontWeight: 800, borderRadius: 99, padding: "1px 7px", marginTop: 3, display: "inline-block",
            color: i.status === "Selesai" ? "var(--accent)" : "var(--red)",
            background: i.status === "Selesai" ? "rgba(14,165,233,.10)" : "rgba(201,27,42,.10)",
          }}>{i.status}</span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--tx-muted)", flexShrink: 0 }}>
        {new Date(i.ts || i.createdAt || 0).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
      </div>
    </div>
  );
}

// ── ProfileTab ────────────────────────────────────────────────────────────────

export function ProfileTab({
  currentUser, patrols, standJaga, incidents, mutations,
  onLogout, toast, userPins, setUserPins,
  changePinOpen, setChangePinOpen,
}) {
  const name  = currentUser.name;
  const today = new Date();

  const myPatrols      = patrols.filter(p => p.officer?.includes(name));
  const myPatrolsToday = myPatrols.filter(p => new Date(p.ts).toDateString() === today.toDateString());
  const myStand        = standJaga.filter(s => s.officer?.includes(name));
  const myStandToday   = myStand.filter(s => new Date(s.ts).toDateString() === today.toDateString());
  const myIncidents    = incidents.filter(i => i.officer?.includes(name));

  const reguColors = { 1: "var(--regu-1-col)", 2: "var(--amber)", 3: "var(--violet)" };
  const col   = reguColors[currentUser.regu] || "var(--accent)";
  const score = myPatrolsToday.length * 10 + myStandToday.length * 5;

  // Modal states
  const [showTodayLog,     setShowTodayLog]     = useState(false);
  const [showStandToday,   setShowStandToday]   = useState(false);
  const [showAllPatrols,   setShowAllPatrols]   = useState(false);
  const [showAllStand,     setShowAllStand]     = useState(false);
  const [showAllIncidents, setShowAllIncidents] = useState(false);
  const [viewPhoto,        setViewPhoto]        = useState(null);

  // Ganti PIN
  const [oldPin,     setOldPin]     = useState("");
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaving,  setPinSaving]  = useState(false);

  // Biometric
  const [bioAvail,   setBioAvail]   = useState(false);
  const [bioHas,     setBioHas]     = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioMsg,     setBioMsg]     = useState("");

  useEffect(() => {
    if (!bioIsSupported()) return;
    bioPlatformAvailable().then(ok => {
      setBioAvail(ok);
      setBioHas(bioHasCred(name));
    });
  }, [name]);

  // ── Ganti PIN ──
  const handleChangePin = async () => {
    let freshPins = { ...DEFAULT_PINS };
    try {
      const s = localStorage.getItem("pad_pins");
      if (s) freshPins = { ...DEFAULT_PINS, ...JSON.parse(s) };
    } catch {}

    const storedOld = await getPinFromFS(name).catch(() => null);
    let oldPinOk = false;
    if (!storedOld) {
      const correctOld = (freshPins[name] || "123456").trim();
      oldPinOk = oldPin.trim() === correctOld;
    } else if (storedOld.isHash) {
      oldPinOk = await hashPin(oldPin.trim(), name) === storedOld.value;
    } else {
      oldPinOk = oldPin.trim() === storedOld.value;
    }

    if (!oldPinOk) { toast("PIN lama salah! (default: 123456)", false); return; }
    if (newPin.trim().length !== 6 || !/^\d{6}$/.test(newPin.trim())) {
      toast("PIN baru harus 6 angka!", false); return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      toast("Konfirmasi PIN tidak cocok!", false); return;
    }

    setPinSaving(true);
    try {
      await savePinToFS(name, newPin.trim());
      const updated = { ...freshPins, [name]: newPin.trim() };
      setUserPins(updated);
      auditAction(name, currentUser.regu, "GANTI_PIN", "PIN berhasil diubah");
      setChangePinOpen(false);
      setOldPin(""); setNewPin(""); setConfirmPin("");
      toast("PIN berhasil diubah!");
    } catch {
      toast("❌ Gagal menyimpan PIN. Periksa koneksi lalu coba lagi.", false);
    } finally {
      setPinSaving(false);
    }
  };

  // ── Biometrik ──
  const handleBioRegister = async () => {
    setBioLoading(true); setBioMsg("");
    try {
      await bioRegister(name);
      setBioHas(true);
      setBioMsg("✅ Sidik jari / wajah berhasil didaftarkan!");
      toast("Biometrik berhasil didaftarkan!");
    } catch (e) {
      setBioMsg("❌ Gagal: " + e.message);
    }
    setBioLoading(false);
  };

  const handleBioClear = () => {
    bioClearCred(name);
    setBioHas(false);
    setBioMsg("🗑 Data biometrik lokal dihapus.");
    toast("Biometrik dihapus.");
  };

  return (
    <div>
      {/* ── Header kartu profil ── */}
      <div style={{ background: col, borderRadius: 16, padding: "20px", marginBottom: 16, color: "#fff", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, background: "rgba(255,255,255,.25)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
            👤
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Regu {currentUser.regu} · BBPKA II Jatinangor</div>
            <div style={{ marginTop: 6, display: "inline-block", background: "rgba(255,255,255,.2)", borderRadius: 7, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
              ⭐ Skor Hari Ini: {score} poin
            </div>
          </div>
        </div>
      </div>

      {/* ── Aktivitas hari ini ── */}
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", marginBottom: 8 }}>📊 Aktivitas Hari Ini</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <TapCard label="Patroli"    value={myPatrolsToday.length} sub="scan hari ini"  color="var(--accent)" bg="var(--accent-tint)"           onClick={() => setShowTodayLog(true)} />
        <TapCard label="Stand Jaga" value={myStandToday.length}   sub="pos hari ini"   color="var(--accent)" bg="rgba(var(--orb-rgb),.08)"      onClick={() => setShowStandToday(true)} />
      </div>

      {/* ── Total rekap ── */}
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", marginBottom: 8 }}>📈 Total Rekap</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <TapCard label="Patroli"    value={myPatrols.length}   sub="semua waktu" color="var(--accent)" bg="var(--accent-tint)"       onClick={() => setShowAllPatrols(true)} />
        <TapCard label="Stand Jaga" value={myStand.length}     sub="semua waktu" color="var(--accent)" bg="rgba(var(--orb-rgb),.08)" onClick={() => setShowAllStand(true)} />
        <TapCard label="Insiden"    value={myIncidents.length} sub="dilaporkan"  color="var(--red)"    bg="rgba(201,27,42,.10)"      onClick={() => setShowAllIncidents(true)} />
      </div>

      {/* ── Biometrik ── */}
      {bioAvail && (
        <div style={{ background: "var(--bg-surface)", border: "1.5px solid var(--border2)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", marginBottom: 6 }}>🔑 Login Biometrik</div>
          <div style={{ fontSize: 11, color: "var(--tx-muted)", marginBottom: 10, lineHeight: 1.5 }}>
            {bioHas ? "Sidik jari / wajah sudah terdaftar. Kamu bisa login tanpa PIN." : "Daftarkan sidik jari atau wajah untuk login lebih cepat."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!bioHas && (
              <button
                onClick={handleBioRegister} disabled={bioLoading}
                style={{ flex: 1, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, cursor: bioLoading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: bioLoading ? 0.6 : 1 }}
              >{bioLoading ? "⏳ Mendaftarkan…" : "🔐 Daftarkan Biometrik"}</button>
            )}
            {bioHas && (
              <button
                onClick={handleBioClear}
                style={{ flex: 1, background: "rgba(201,27,42,.08)", color: "var(--red)", border: "1px solid rgba(201,27,42,.2)", borderRadius: 9, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >🗑 Hapus Biometrik</button>
            )}
          </div>
          {bioMsg && <div style={{ marginTop: 8, fontSize: 11, color: "var(--tx-muted)", fontWeight: 600, textAlign: "center" }}>{bioMsg}</div>}
        </div>
      )}

      {/* ── Ganti PIN ── */}
      <div style={{ background: "var(--bg-surface)", border: "1.5px solid var(--border2)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", marginBottom: 10 }}>🔒 Ganti PIN</div>
        {changePinOpen ? (
          <div>
            <PinField label="PIN Lama"             value={oldPin}     setter={setOldPin} />
            <PinField label="PIN Baru (6 angka)"   value={newPin}     setter={setNewPin} />
            <PinField label="Konfirmasi PIN Baru"  value={confirmPin} setter={setConfirmPin} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <BtnSimpan onClick={handleChangePin} loading={pinSaving}>💾 Simpan PIN</BtnSimpan>
              <BtnBatal onClick={() => { setChangePinOpen(false); setOldPin(""); setNewPin(""); setConfirmPin(""); }} />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setChangePinOpen(true)}
            style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--accent)", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >🔑 Ubah PIN Sekarang</button>
        )}
      </div>

      {/* ── Logout ── */}
      <button
        onClick={onLogout}
        style={{ width: "100%", background: "rgba(201,27,42,.08)", color: "var(--red)", border: "1.5px solid rgba(201,27,42,.2)", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 8 }}
      >🚪 Keluar / Logout</button>

      {/* ════ MODALS ════ */}

      {/* Patroli Hari Ini */}
      <GenericModal
        open={showTodayLog} onClose={() => setShowTodayLog(false)}
        title="📍 Patroli Hari Ini"
        subtitle={`${myPatrolsToday.length} patroli · ${today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}`}
      >
        {myPatrolsToday.length === 0
          ? <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--tx-muted)" }}>Belum ada patroli hari ini</div>
          : [...myPatrolsToday].sort((a, b) => b.ts - a.ts).map(p => <PatrolRow key={p.id} p={p} onViewPhoto={setViewPhoto} />)
        }
      </GenericModal>

      {/* Stand Jaga Hari Ini */}
      <GenericModal
        open={showStandToday} onClose={() => setShowStandToday(false)}
        title="🛡 Stand Jaga Hari Ini"
        subtitle={`${myStandToday.length} pos · ${today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}`}
      >
        {myStandToday.length === 0
          ? <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--tx-muted)" }}>Belum ada stand jaga hari ini</div>
          : [...myStandToday].sort((a, b) => b.ts - a.ts).map(s => <StandRow key={s.id} s={s} />)
        }
      </GenericModal>

      {/* Semua Patroli */}
      <GenericModal
        open={showAllPatrols} onClose={() => setShowAllPatrols(false)}
        title="📋 Semua Patroli"
        subtitle={`${myPatrols.length} total patroli`}
      >
        {myPatrols.length === 0
          ? <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--tx-muted)" }}>Belum ada patroli</div>
          : [...myPatrols].sort((a, b) => b.ts - a.ts).map(p => <PatrolRow key={p.id} p={p} onViewPhoto={setViewPhoto} />)
        }
      </GenericModal>

      {/* Semua Stand Jaga */}
      <GenericModal
        open={showAllStand} onClose={() => setShowAllStand(false)}
        title="🛡 Semua Stand Jaga"
        subtitle={`${myStand.length} total`}
      >
        {myStand.length === 0
          ? <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--tx-muted)" }}>Belum ada stand jaga</div>
          : [...myStand].sort((a, b) => b.ts - a.ts).map(s => <StandRow key={s.id} s={s} />)
        }
      </GenericModal>

      {/* Semua Insiden */}
      <GenericModal
        open={showAllIncidents} onClose={() => setShowAllIncidents(false)}
        title="⚠️ Insiden yang Dilaporkan"
        subtitle={`${myIncidents.length} insiden`}
      >
        {myIncidents.length === 0
          ? <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "var(--tx-muted)" }}>Belum ada insiden yang dilaporkan</div>
          : [...myIncidents].sort((a, b) => (b.ts || b.createdAt || 0) - (a.ts || a.createdAt || 0)).map(i => <IncidenRow key={i.id} i={i} />)
        }
      </GenericModal>

      {/* Lihat Foto Patroli */}
      {viewPhoto && createPortal(
        <>
          <div
            onClick={() => setViewPhoto(null)}
            style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,.85)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 3001, width: "calc(100% - 24px)", maxWidth: 460 }}
          >
            <img src={viewPhoto} alt="Foto Patroli" style={{ width: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 14, display: "block" }} />
            <button
              onClick={() => setViewPhoto(null)}
              style={{ display: "flex", margin: "14px auto 0", background: "rgba(255,255,255,.15)", border: "none", cursor: "pointer", padding: "8px 24px", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}
            >✕ Tutup</button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
