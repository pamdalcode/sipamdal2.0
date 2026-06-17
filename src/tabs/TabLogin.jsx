// TabLogin.jsx — SIPAMDAL
// Sesi 5: Konversi tab-login.js → JSX
// Named exports: ReguAccordion, LoginScreen

import { useState, useEffect } from "react";
import { REGU, getReguHari, JADWAL_START, cRgba, pinRgb } from "../utils/utils.js";
import {
  DEFAULT_PIN_SET, isPinDefaultForUser, hapticPin,
  PIN_COOLDOWN_MS, getPinCooldownSecs, recordPinFailure,
  resetPinAttempts, fmtCooldown,
  bioHasCred, bioPlatformAvailable, bioVerify,
  verifyPinFS, recordLogin, withTimeout,
} from "../stores/useAuthStore.js";

// ── ReguAccordion ─────────────────────────────────────────────────────────────

export function ReguAccordion({ reguColors, onSelect, reguHari }) {
  const urut      = [3, 1, 2];
  const piketIdx  = urut.indexOf(reguHari);
  const nextRegu  = urut[(piketIdx + 1) % 3];
  const liburRegu = urut[(piketIdx + 2) % 3];
  const [activeRegu, setActiveRegu] = useState(reguHari);

  const STATUS_COLOR = { piket: "var(--accent)", libur: "var(--amber)", lepas: "var(--red)" };
  const reguInfo = [reguHari, nextRegu, liburRegu].map((r, i) => ({
    r, members: REGU[r] || [],
    label:   i === 0 ? "PIKET" : i === 1 ? "LIBUR" : "LEPAS",
    col:     i === 0 ? STATUS_COLOR.piket : i === 1 ? STATUS_COLOR.libur : STATUS_COLOR.lepas,
    isPiket: i === 0,
  }));
  const activeInfo = reguInfo.find(x => x.r === activeRegu) || reguInfo[0];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── 3 status buttons ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {reguInfo.map(({ r, label, col, members }) => (
          <button
            key={r}
            onClick={() => setActiveRegu(r)}
            style={{
              borderRadius: 14,
              border: `2px solid ${activeRegu === r ? col : cRgba(col, 0.27)}`,
              background: activeRegu === r ? cRgba(col, 0.08) : cRgba(col, 0.04),
              padding: "12px 6px 10px",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: activeRegu === r ? `0 4px 16px ${cRgba(col, 0.20)}, inset 0 1px 0 ${cRgba(col, 0.14)}` : "none",
              transition: "all .25s cubic-bezier(.22,1,.36,1)",
              transform: activeRegu === r ? "scale(1.05)" : "scale(1)",
            }}
          >
            {/* Hexagon badge */}
            <div style={{ position: "relative", width: 38, height: 44 }}>
              <svg width={38} height={44} viewBox="0 0 36 40">
                <polygon
                  points="18,1 34,10 34,30 18,39 2,30 2,10"
                  style={{
                    fill: activeRegu === r ? cRgba(col, 0.13) : cRgba(col, 0.06),
                    stroke: col,
                    strokeWidth: activeRegu === r ? "2.5" : "1.5",
                    opacity: activeRegu === r ? 1 : 0.40,
                  }}
                />
                <text x="18" y="27" textAnchor="middle" fontSize="14" fontWeight="900" fontFamily="inherit" style={{ fill: col }}>
                  {r}
                </text>
              </svg>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 900, color: col, letterSpacing: 1 }}>{label}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: col, background: cRgba(col, 0.10), borderRadius: 99, padding: "1px 7px" }}>
              {members.length} orang
            </span>
          </button>
        ))}
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "var(--br-subtle)", margin: "2px 4px" }} />

      {/* ── Member chips ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Danru — index 0 */}
        {activeInfo.members[0] && (
          <button
            onClick={() => onSelect({ name: activeInfo.members[0], regu: activeInfo.r })}
            onTouchStart={e => { e.currentTarget.style.transform = "scale(.97)"; e.currentTarget.style.boxShadow = "none"; }}
            onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 2px 12px ${cRgba(activeInfo.col, 0.18)}`; }}
            style={{
              width: "100%",
              background: `linear-gradient(135deg, ${cRgba(activeInfo.col, 0.09)} 0%, ${cRgba(activeInfo.col, 0.04)} 100%)`,
              border: `2px solid ${activeInfo.col}`,
              borderRadius: 14, padding: "13px 16px",
              color: activeInfo.col, fontSize: 14, fontWeight: 900,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              boxShadow: `0 2px 12px ${cRgba(activeInfo.col, 0.18)}`,
              letterSpacing: 0.3,
              transition: "transform .15s, box-shadow .15s",
              animation: "heroContentIn .25s ease both",
            }}
          >
            <span style={{ fontSize: 17, filter: "drop-shadow(0 1px 3px rgba(0,0,0,.2))" }}>👤</span>
            {activeInfo.members[0]}
            <span style={{ fontSize: 9, fontWeight: 700, background: cRgba(activeInfo.col, 0.16), borderRadius: 99, padding: "2px 7px", marginLeft: "auto" }}>DANRU</span>
          </button>
        )}
        {/* Anggota — index 1-4, grid 2x2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
          {activeInfo.members.slice(1).map((name, idx) => (
            <button
              key={name}
              onClick={() => onSelect({ name, regu: activeInfo.r })}
              onTouchStart={e => { e.currentTarget.style.transform = "scale(.93)"; e.currentTarget.style.background = cRgba(activeInfo.col, 0.14); }}
              onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = cRgba(activeInfo.col, 0.06); }}
              style={{
                background: cRgba(activeInfo.col, 0.06),
                border: `1.5px solid ${cRgba(activeInfo.col, 0.50)}`,
                borderRadius: 11, padding: "11px 8px",
                color: activeInfo.col, fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.2,
                transition: "transform .12s, background .12s",
                animation: `heroContentIn .25s ease ${0.05 + idx * 0.06}s both`,
              }}
            >{name}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── LoginScreen ───────────────────────────────────────────────────────────────

export function LoginScreen({ onLogin, userPins }) {
  const [step, setStep]           = useState("select");
  const [selected, setSelected]   = useState(null);
  const [pin, setPin]             = useState("");
  const [err, setErr]             = useState("");
  const [shake, setShake]         = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [pressedKey, setPressedKey] = useState(null);
  const [cooldownSecs, setCooldownSecs] = useState(0);
  // BL-04: biometric state
  const [lsBioAvail, setLsBioAvail]     = useState(false);
  const [lsBioLoading, setLsBioLoading] = useState(false);

  // BL-04: cek biometric tersedia saat step pin
  useEffect(() => {
    let alive = true;
    if (step === "pin" && selected && !selected.isAdmin && !selected.isPimpinan) {
      bioPlatformAvailable().then(ok => { if (alive) setLsBioAvail(ok && bioHasCred(selected.name)); });
    }
    return () => { alive = false; };
  }, [step, selected]);

  const handleLsBioLogin = async () => {
    if (!selected || lsBioLoading) return;
    setLsBioLoading(true);
    setErr("");
    try {
      const ok = await bioVerify(selected.name);
      if (ok) {
        hapticPin("ok");
        resetPinAttempts(selected.name);
        recordLogin(selected.name, selected.regu, selected.isAdmin, selected.isPimpinan);
        onLogin(selected);
      }
    } catch {
      hapticPin("error");
      setErr("Biometrik gagal — gunakan PIN.");
    } finally { setLsBioLoading(false); }
  };

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // BL-03: cooldown ticker
  useEffect(() => {
    if (cooldownSecs <= 0) return;
    const t = setInterval(() => {
      const s = getPinCooldownSecs(selected?.name || "");
      setCooldownSecs(s);
      if (s <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSecs]);

  const doShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const handleSelect = (member) => {
    setSelected(member); setPin(""); setErr(""); setStep("pin");
    setCooldownSecs(getPinCooldownSecs(member.name));
  };
  const handleAdminSelect    = () => { setSelected({ name: "Admin",    regu: 0, isAdmin: true   }); setPin(""); setErr(""); setStep("pin"); setCooldownSecs(getPinCooldownSecs("Admin")); };
  const handlePimpinanSelect = () => { setSelected({ name: "Pimpinan", regu: 0, isPimpinan: true }); setPin(""); setErr(""); setStep("pin"); setCooldownSecs(getPinCooldownSecs("Pimpinan")); };

  const handlePinInput = async (d) => {
    if (pin.length >= 6) return;

    // BL-03: cek lockout
    const remainSecs = getPinCooldownSecs(selected?.name || "");
    if (remainSecs > 0) {
      setErr(`🔒 Akun terkunci. Coba lagi dalam ${fmtCooldown(remainSecs)}.`);
      hapticPin("locked");
      return;
    }

    hapticPin("tap"); // BL-01
    setPressedKey(d);
    setTimeout(() => setPressedKey(null), 150);
    const np = pin + d;
    setPin(np);

    if (np.length === 6) {
      setTimeout(async () => {
        // [F1-01] Verifikasi PIN dengan hash untuk semua role
        let pinOk = false;
        if (selected.isAdmin || selected.isPimpinan) {
          const fsResult = await withTimeout(verifyPinFS(selected.name, np).catch(() => null), 5000, null);
          if (fsResult !== null) {
            pinOk = fsResult;
          } else {
            const fallback = selected.isAdmin ? (userPins["Admin"] || "000000") : (userPins["Pimpinan"] || "111111");
            pinOk = (np === fallback);
          }
        } else {
          const fsResult = await withTimeout(verifyPinFS(selected.name, np).catch(() => null), 5000, null);
          pinOk = fsResult !== null ? fsResult : (np === (userPins[selected.name] || "123456"));
        }

        if (pinOk) {
          resetPinAttempts(selected.name); // BL-03
          hapticPin("ok");                 // BL-01
          recordLogin(selected.name, selected.regu, selected.isAdmin, selected.isPimpinan);

          // [F1-03] Blokir jika PIN masih default
          const stillDefault = await withTimeout(isPinDefaultForUser(selected.name).catch(() => false), 5000, false)
            || DEFAULT_PIN_SET.has(np);
          if (stillDefault) {
            const ganti = window.confirm(
              "⚠️ PIN kamu masih menggunakan PIN default yang lemah.\n\nDemi keamanan, kamu wajib mengganti PIN sebelum melanjutkan.\n\nTekan OK untuk ganti PIN sekarang."
            );
            if (ganti) {
              try { sessionStorage.setItem("sipamdal_force_change_pin", selected.name); } catch (_) {}
              onLogin(selected);
              return;
            } else {
              setPin("");
              setErr("⚠️ Kamu harus mengganti PIN default sebelum bisa masuk.");
              return;
            }
          }
          onLogin(selected);
        } else {
          const { locked, attemptsLeft } = recordPinFailure(selected.name); // BL-03
          hapticPin("error"); // BL-01
          setPin("");
          doShake();
          if (locked) {
            setCooldownSecs(PIN_COOLDOWN_MS / 1000);
            setErr("🔒 Akun terkunci 5 menit karena 3x PIN salah.");
          } else {
            setErr(`PIN salah. ${attemptsLeft} percobaan tersisa.`);
          }
        }
      }, 200);
    }
  };

  const handleDel = () => { setPin(p => p.slice(0, -1)); setErr(""); };

  // Keyboard fisik support
  useEffect(() => {
    if (step !== "pin") return;
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9")  handlePinInput(e.key);
      else if (e.key === "Backspace")     handleDel();
      else if (e.key === "Escape")        { setStep("select"); setPin(""); setErr(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, pin]);

  useEffect(() => {
    const obs = new MutationObserver(() => {});
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Hitung regu & warna
  const _diff0 = (() => {
    const d       = new Date();
    const shifted = new Date(d.getTime() - 7 * 3600000);
    const localD  = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
    const localS  = new Date(JADWAL_START.getFullYear(), JADWAL_START.getMonth(), JADWAL_START.getDate());
    return Math.round((localD - localS) / 86400000);
  })();
  const _urut     = [3, 1, 2];
  const _idx0     = ((_diff0 % 3) + 3) % 3;
  const _piket    = _urut[_idx0];
  const _libur    = _urut[(_idx0 + 1) % 3];
  const _lepas    = _urut[(_idx0 + 2) % 3];
  const reguColors = { [_piket]: "var(--accent)", [_libur]: "var(--amber)", [_lepas]: "var(--red)" };

  const reguHari = getReguHari(new Date());
  const isLight  = true;
  const pinCol   = selected
    ? (selected.isAdmin ? "var(--accent)" : (reguColors[selected.regu] || "var(--accent)"))
    : "var(--accent)";

  return (
    <div style={{
      minHeight: "100vh",
      background: isLight ? "var(--bg-overlay)" : "var(--tx-primary)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: step === "pin" ? "center" : "flex-start",
      padding: step === "pin" ? "0 16px" : "0 16px 32px",
      position: "relative", overflow: "hidden",
    }}>

      {/* Subtle dot pattern */}
      {step === "select" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, #00000010 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
      )}

      {/* ── Hero header (select) ── */}
      {step === "select" && (
        <div style={{
          position: "relative", zIndex: 1, width: "100%", maxWidth: 420,
          textAlign: "center", paddingTop: 56, paddingBottom: 28,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(-20px)",
          transition: "opacity .7s ease, transform .7s ease",
        }}>
          {/* Shield badge — tap tersembunyi untuk Pimpinan */}
          <div
            onClick={handlePimpinanSelect}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 76, height: 76, borderRadius: 22,
              background: "linear-gradient(145deg, var(--accent) 0%, var(--accent-2) 100%)",
              marginBottom: 18, position: "relative",
              transition: "box-shadow .3s ease, transform .15s ease",
              cursor: "pointer",
            }}
          >
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v5c0 5.25 3.5 10.15 8 11.35C16.5 21.15 20 16.25 20 11V6L12 2z" fill="rgba(255,255,255,.95)" stroke="rgba(255,255,255,.3)" strokeWidth=".5" />
            </svg>
            <div style={{
              position: "absolute", inset: -3, borderRadius: 25,
              border: "2px solid rgba(14,165,233,.6)", pointerEvents: "none",
            }} />
          </div>

          <div style={{ fontSize: 28, fontWeight: 900, color: isLight ? "var(--tx-primary)" : "var(--bg-surface)", letterSpacing: -1, lineHeight: 1.1 }}>SIPAMDAL</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: isLight ? "var(--tx-muted)" : "var(--tx-ghost)", letterSpacing: 2.5, textTransform: "uppercase", marginTop: 5 }}>BBPKA II Jatinangor</div>

          {/* Badge — tap tersembunyi untuk Admin */}
          <div
            onClick={handleAdminSelect}
            style={{
              display: "inline-block", fontSize: 10,
              color: isLight ? "var(--tx-ghost)" : "var(--tx-ghost)",
              marginTop: 8, fontWeight: 500,
              background: isLight ? "rgba(0,0,0,.04)" : "rgba(255,255,255,.05)",
              borderRadius: 99, padding: "3px 12px",
              border: "1px solid rgba(0,0,0,.06)",
              cursor: "default", userSelect: "none",
            }}
          >Sistem Informasi Pengamanan Dalam</div>
        </div>
      )}

      {/* ── SELECT step ── */}
      {step === "select" && (
        <div style={{
          position: "relative", zIndex: 1, width: "100%", maxWidth: 420,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(28px)",
          transition: "opacity .55s ease .18s, transform .55s ease .18s",
        }}>
          <div style={{
            background: isLight ? "rgba(255,255,255,.96)" : "rgba(10,22,40,.88)",
            border: "1px solid rgba(0,0,0,.07)", borderRadius: 24, padding: "20px 16px 16px",
            boxShadow: isLight
              ? "0 12px 48px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)"
              : "0 8px 48px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "var(--br-subtle)" }} />
              <span style={{ fontSize: 9.5, fontWeight: 800, color: "var(--tx-muted)", letterSpacing: 2.5, textTransform: "uppercase" }}>Pilih Anggota</span>
              <div style={{ flex: 1, height: 1, background: "var(--br-subtle)" }} />
            </div>
            <ReguAccordion reguColors={reguColors} onSelect={handleSelect} reguHari={reguHari} />
          </div>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 10.5, color: "var(--tx-muted)", fontWeight: 500, opacity: 0.7 }}>
            Pilih nama Anda untuk masuk
          </div>
        </div>
      )}

      {/* ── PIN step ── */}
      {step === "pin" && (
        <div style={{
          position: "relative", zIndex: 1, width: "100%", maxWidth: 340,
          textAlign: "center", animation: "slideUp .35s cubic-bezier(.22,1,.36,1)",
          padding: "0 0 24px",
        }}>
          {/* Identity chip */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: selected.isAdmin
                ? "var(--bg-raised)"
                : selected.isPimpinan
                  ? "rgba(14,165,233,.12)"
                  : cRgba(pinCol, 0.10),
              border: `2px solid ${selected.isAdmin ? "rgba(var(--orb-rgb),.25)" : selected.isPimpinan ? "rgba(14,165,233,.4)" : cRgba(pinCol, 0.50)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 10,
              animation: "avatarPop .45s cubic-bezier(.34,1.56,.64,1)",
            }}>
              <span style={{ fontSize: 24 }}>{selected.isAdmin ? "🛡️" : selected.isPimpinan ? "👑" : "👤"}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--tx-primary)", letterSpacing: -0.3, lineHeight: 1.2 }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: "var(--tx-muted)", marginTop: 3, fontWeight: 500 }}>
              {selected.isAdmin ? "Akses Penuh" : selected.isPimpinan ? "Monitoring & Kendali" : `Regu ${selected.regu} · BBPKA II Jatinangor`}
            </div>
          </div>

          {/* PIN dots */}
          <div style={{ animation: shake ? "shake .4s" : "none" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx-muted)", marginBottom: 16, letterSpacing: 2, textTransform: "uppercase" }}>
              Masukkan PIN
            </div>

            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 8, "--pin-col-rgb": pinRgb(pinCol) }}>
              {[0,1,2,3,4,5].map(i => (
                <div
                  key={i}
                  className={[
                    "pin-dot",
                    i < pin.length ? "filled" : "",
                    i === pin.length - 1 && pin.length > 0 ? "last-filled" : "",
                  ].filter(Boolean).join(" ")}
                />
              ))}
            </div>

            {/* Error */}
            {err
              ? <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 10, fontWeight: 700, animation: "fadeIn .3s", height: 20 }}>⚠️ {err}</div>
              : <div style={{ height: 20, marginTop: 10 }} />
            }

            {/* Numpad */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 20, "--pin-col-rgb": pinRgb(pinCol) }}>
              {[1,2,3,4,5,6,7,8,9,"Kembali",0,"⌫"].map((d, i) => {
                const isBack    = d === "Kembali";
                const isDel     = d === "⌫";
                const isNum     = !isBack && !isDel;
                const isPressed = pressedKey === String(d);
                const className = isNum
                  ? ("pin-btn-num" + (isPressed ? " pressed" : ""))
                  : isDel ? "pin-btn-del" : "pin-btn-back";
                return (
                  <button
                    key={i}
                    className={className}
                    onClick={() => isDel ? handleDel() : isBack ? (setStep("select"), setErr(""), setPin("")) : handlePinInput(String(d))}
                  >
                    {isDel ? (
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                        <line x1={18} y1={9} x2={12} y2={15} />
                        <line x1={12} y1={9} x2={18} y2={15} />
                      </svg>
                    ) : d}
                  </button>
                );
              })}
            </div>

            {/* Default PIN hint — kosong sesuai source */}
            <div style={{ marginTop: 20, fontSize: 10, color: "var(--tx-ghost)", fontWeight: 500 }}></div>

            {/* BL-04: Biometric button */}
            {lsBioAvail && (
              <button
                onClick={handleLsBioLogin}
                disabled={lsBioLoading}
                style={{
                  width: "100%", marginTop: 14, padding: "12px 0",
                  borderRadius: 14, border: "1.5px solid rgba(14,165,233,.35)",
                  background: "rgba(14,165,233,.07)",
                  color: "var(--accent)", fontSize: 13, fontWeight: 700,
                  fontFamily: "inherit", cursor: lsBioLoading ? "wait" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: lsBioLoading ? 0.6 : 1, transition: "all .3s",
                }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07" />
                  <path d="M12 11V3" />
                </svg>
                {lsBioLoading ? "Memverifikasi…" : "Masuk dengan Sidik Jari / Wajah"}
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes avatarPop { from{transform:scale(.5);opacity:0} to{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}
