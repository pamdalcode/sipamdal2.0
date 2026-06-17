// UiComponents.jsx — SIPAMDAL Sesi 2
// Shared UI components: IC, Modal, Inp, Btn, BtnSimpan, BtnBatal, Bdg, PH, ReadOnlyBanner,
//                       CamScanner, PatrolRing, PosQRHero,
//                       useOnlineStatus, useInnerModal
// Import dari: utils/utils.js (POS_LIST, POS_CAP, decQR, ALL_AREAS, getReguHari)
// Note: QRSvg dihapus dari sini (Sesi 5d) — gunakan QRSvg dari engine/QrEngine.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  POS_LIST, POS_CAP, PATROL_AREAS,
  decQR, ALL_AREAS,
  getReguHari,
} from "../../utils/utils.js";
import { verifyPinFS, DEFAULT_PINS } from "../../stores/useAuthStore.js";
import styles from "./UiComponents.module.css";

// ── Keamanan Pilih Pos Manual (shared constants & helpers) ───────────────────
// PIN verifikasi = PIN login akun yang sedang aktif (verifyPinFS)
const MANUAL_LOG_KEY = "sipamdal_manual_log";
const LOCKOUT_KEY_UI = "sipamdal_manual_lockout";
const MAX_WRONG_PIN = 3;
const LOCKOUT_MS = 5 * 60 * 1000;

const ALASAN_OPTIONS = [
  "Kamera tidak tersedia / rusak",
  "QR code pos rusak / tidak terbaca",
  "Kondisi darurat (posisi harus segera diisi)",
  "Perangkat tidak mendukung kamera",
  "Lainnya (wajib jelaskan di bawah)",
];

function getManualLogUI() {
  try { return JSON.parse(localStorage.getItem(MANUAL_LOG_KEY) || "[]"); }
  catch { return []; }
}
function addManualLogUI(entry) {
  const log = getManualLogUI();
  log.push(entry);
  localStorage.setItem(MANUAL_LOG_KEY, JSON.stringify(log.slice(-200)));
}
function getLockoutUI() {
  try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY_UI)); }
  catch { return null; }
}
function setLockoutUI(data) {
  if (!data) { localStorage.removeItem(LOCKOUT_KEY_UI); return; }
  localStorage.setItem(LOCKOUT_KEY_UI, JSON.stringify(data));
}

// ─────────────────────────────────────────────
// ManualVerifyModal — 3 langkah: Alasan → PIN → Foto
// ─────────────────────────────────────────────
function ManualVerifyModal({ open, onClose, onVerified, targetPos, userName, rolling, targetName, myCurrentPos }) {
  const [pin, setPin] = useState("");
  const [alasan, setAlasan] = useState("");
  const [ket, setKet] = useState("");
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [wrong, setWrong] = useState(0);
  const [checking, setChecking] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockSisa, setLS] = useState(0);
  const [foto, setFoto] = useState(null);
  const pinRef = useRef();
  const fotoRef = useRef();

  useEffect(() => {
    if (!open) return;
    setPin(""); setAlasan(""); setKet(""); setStep(1); setErr(""); setWrong(0); setFoto(null);
    const lo = getLockoutUI();
    if (lo && Date.now() < lo.until) { setLocked(true); setLS(lo.until - Date.now()); }
    else { setLockoutUI(null); setLocked(false); }
  }, [open]);

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => {
      const lo = getLockoutUI();
      if (!lo || Date.now() >= lo.until) { setLockoutUI(null); setLocked(false); clearInterval(t); }
      else setLS(lo.until - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [locked]);

  if (!open) return null;
  const menit = Math.floor(lockSisa / 60000);
  const detik = Math.floor((lockSisa % 60000) / 1000);
  const butuhKet = alasan.includes("Lainnya");

  const handleStep1 = () => {
    if (!alasan) { setErr("Pilih alasan terlebih dahulu!"); return; }
    if (butuhKet && !ket.trim()) { setErr("Keterangan wajib diisi!"); return; }
    setErr(""); setStep(2);
    setTimeout(() => (pinRef.current == null ? undefined : pinRef.current.focus()), 100);
  };

  const handleStep2 = async () => {
    if (!pin) { setErr("Masukkan PIN!"); return; }
    setChecking(true);
    let pinOk;
    try {
      const fsResult = await verifyPinFS(userName, pin);
      pinOk = fsResult !== null ? fsResult : pin === (DEFAULT_PINS[userName] || "123456");
    } catch {
      pinOk = pin === (DEFAULT_PINS[userName] || "123456");
    }
    setChecking(false);
    if (pinOk) { setErr(""); setStep(3); }
    else {
      const nw = wrong + 1; setWrong(nw); setPin("");
      if (nw >= MAX_WRONG_PIN) {
        const lo = { until: Date.now() + LOCKOUT_MS };
        setLockoutUI(lo); setLocked(true); setLS(LOCKOUT_MS); setErr("");
        addManualLogUI({ ts: Date.now(), user: userName, pos: targetPos, alasan, ket, method: "MANUAL_GAGAL_LOCKOUT" });
      } else {
        setErr(`PIN salah! Sisa percobaan: ${MAX_WRONG_PIN - nw}x`);
      }
    }
  };

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      // Kompres sederhana via canvas
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        setFoto(c.toDataURL("image/jpeg", 0.75));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  };

  const handleFinalSubmit = () => {
    if (!foto) { setErr("📸 Foto bukti wajib diambil!"); return; }
    const logEntry = { ts: Date.now(), user: userName, pos: targetPos, alasan, keterangan: butuhKet ? ket : "", method: "MANUAL", foto };
    addManualLogUI(logEntry);
    setLockoutUI(null);
    onVerified(logEntry);
  };

  let modalBody;
  if (locked) {
    modalBody = (
      <div className={styles.lockedBox}>
        <div className={styles.lockedIcon}>🔒</div>
        <div className={styles.lockedTitle}>Akses Dikunci!</div>
        <div className={styles.lockedSub}>Terlalu banyak percobaan salah. Coba lagi dalam:</div>
        <div className={styles.lockedTimer}>
          {String(menit).padStart(2, "0")}:{String(detik).padStart(2, "0")}
        </div>
        <div className={styles.lockedHint}>Hubungi Admin jika perlu akses segera.</div>
      </div>
    );
  } else if (step === 1) {
    modalBody = (
      <div>
        <div className={styles.stepLabel}>Langkah 1/3 — Alasan tidak scan QR:</div>
        {ALASAN_OPTIONS.map((opt) => (
          <label
            key={opt}
            className={styles.alasanOption}
            style={{
              background: alasan === opt ? "rgba(201,27,42,.08)" : "var(--bg-surface)",
              border: `1.5px solid ${alasan === opt ? "var(--red)" : "var(--border)"}`,
            }}
          >
            <input
              type="radio"
              name="alasan_ui"
              value={opt}
              checked={alasan === opt}
              onChange={() => { setAlasan(opt); setErr(""); }}
              className={styles.alasanRadio}
            />
            <span className={styles.alasanOptionText}>{opt}</span>
          </label>
        ))}
        {butuhKet && (
          <textarea
            placeholder="Jelaskan alasan secara singkat..."
            value={ket}
            onChange={(e) => setKet(e.target.value)}
            maxLength={200}
            className={styles.ketTextarea}
          />
        )}
        {err && <div className={styles.errText}>{err}</div>}
        <div className={styles.btnRow}>
          <Btn onClick={handleStep1} color="var(--accent)" size="lg" full> Lanjut → PIN</Btn>
          <Btn onClick={onClose} color="var(--tx-muted)" variant="outline">Batal</Btn>
        </div>
      </div>
    );
  } else if (step === 2) {
    modalBody = (
      <div>
        <div className={styles.stepLabel}>Langkah 2/3 — PIN Login Anda:</div>
        <div className={styles.aliasanRecap}>
          {`Alasan: ${alasan}${ket ? " — " + ket : ""}`}
        </div>
        <input
          ref={pinRef}
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="PIN Login (6 digit)"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleStep2()}
          className={styles.pinInput}
          style={{ border: `2px solid ${err ? "var(--red)" : "var(--border)"}` }}
        />
        {err && <div className={styles.errText}>❌ {err}</div>}
        <div className={styles.btnRow}>
          <Btn onClick={handleStep2} color="var(--accent)" size="lg" full disabled={pin.length < 6 || checking}>
            {checking ? "Memeriksa PIN..." : " Lanjut → Foto Bukti"}
          </Btn>
          <Btn onClick={() => setStep(1)} color="var(--tx-muted)" variant="outline">← Kembali</Btn>
        </div>
        <div className={styles.attemptHint}>
          {`Salah ${wrong}/${MAX_WRONG_PIN}x — Setelah ${MAX_WRONG_PIN}x salah, dikunci 5 menit.`}
        </div>
      </div>
    );
  } else {
    modalBody = (
      <div>
        <div className={styles.stepLabel}>Langkah 3/3 — Foto Bukti Keberadaan di Pos:</div>
        <div className={styles.aliasanRecap}>
          {`Alasan: ${alasan}${ket ? " — " + ket : ""}`}
        </div>
        {!foto ? (
          <label className={styles.fotoLabel}>
            <span className={styles.fotoIcon}>📸</span>
            Ambil Foto Bukti (WAJIB)
            <span className={styles.fotoHint}>Foto lokasi / situasi pos saat ini</span>
            <input
              ref={fotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFoto}
              className={styles.fotoInputHidden}
            />
          </label>
        ) : (
          <div className={styles.fotoPreviewWrap}>
            <img src={foto} alt="bukti" className={styles.fotoPreviewImg} />
            <div className={styles.fotoReadyBadge}>✅ Foto siap</div>
            <button
              onClick={() => { setFoto(null); if (fotoRef.current) fotoRef.current.value = ""; }}
              className={styles.fotoGantiBtn}
            >
              🔄 Ganti
            </button>
          </div>
        )}
        {err && <div className={styles.errText} style={{ textAlign: "center" }}>{err}</div>}
        <div className={styles.btnRow}>
          <Btn onClick={handleFinalSubmit} color={foto ? "var(--red)" : "var(--tx-muted)"} size="lg" full disabled={!foto}>
            {foto ? "🔓 Konfirmasi Penempatan Manual" : "📸 Foto dulu sebelum konfirmasi"}
          </Btn>
          <Btn onClick={() => setStep(2)} color="var(--tx-muted)" variant="outline">← Kembali</Btn>
        </div>
        <div className={styles.attemptHint}>Foto disimpan sebagai bukti & dapat diperiksa Admin.</div>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="⚠️ Verifikasi Pilih Pos Manual">
      <div>
        <div className={styles.verifyWarnBanner}>
          <div className={styles.verifyWarnTitle}>⚠️ Gunakan QR Code jika memungkinkan!</div>
          <div className={styles.verifyWarnSub}>Pilih pos manual dicatat &amp; dapat diperiksa Admin.</div>
        </div>
        <div className={styles.targetPosBox}>
          <div className={styles.targetPosLabel}>{rolling ? "Pos Tujuan (Penuh — Tukar Posisi)" : "Pos Tujuan"}</div>
          <div className={styles.targetPosName}>{targetPos}</div>
          <div className={styles.targetPosUser}>👤 {userName}</div>
          {rolling && (
            <div className={styles.targetPosRolling}>
              {`↺ ${userName} ⇄ ${targetName} (${myCurrentPos})`}
            </div>
          )}
        </div>
        {modalBody}
      </div>
    </Modal>
  );
}
// ─────────────────────────────────────────────
// IC — Icon component (SVG inline)
// ─────────────────────────────────────────────
export const IC = ({ n, s = 18, c = "currentColor" }) => ({
  shield: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  home: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  cal: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  alert: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  pkg: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  ppl: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  file: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  rot: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  qr: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="5" y="5" width="3" height="3" />
      <rect x="16" y="5" width="3" height="3" />
      <rect x="16" y="16" width="3" height="3" />
      <rect x="5" y="16" width="3" height="3" />
    </svg>
  ),
  cam: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  bell: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  plus: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  ok: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  arr: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  print: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  pos: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  menu: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  search: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  out: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  key: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  user: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  "book-open": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  archive: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  "bell-on": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <line x1="19" y1="1" x2="23" y2="5" />
      <line x1="23" y1="1" x2="19" y2="5" />
    </svg>
  ),
  "bell-off": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  palette: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <circle cx="13.5" cy="6.5" r="1" />
      <circle cx="17.5" cy="10.5" r="1" />
      <circle cx="8.5" cy="7.5" r="1" />
      <circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  "door-out": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  "officer-out": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="3" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h1" />
      <path d="M15 11l5 5-5 5" />
      <line x1="20" y1="16" x2="12" y2="16" />
    </svg>
  ),
  "officer-in": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="3" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h1" />
      <path d="M20 11l-5 5 5 5" />
      <line x1="15" y1="16" x2="23" y2="16" />
    </svg>
  ),
  pin: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  panic: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c !== "currentColor" ? c : "#D93025"} stroke="none">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  ),
  zap: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  megaphone: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  ),
  chart: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  clipboard: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  "alert-circle": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  car: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
  users: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  patrol: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  incident: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  edit: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  save: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  photo: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  log: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  info: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  refresh: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  wifi: (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  "wifi-off": (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
}[n] || null);

// ─────────────────────────────────────────────
// LucideIcon — wrapper untuk Lucide CDN icons
// Usage: <LucideIcon name="shield" size={20} color="currentColor" />
// ─────────────────────────────────────────────
export const LucideIcon = ({ name, size = 20, color = "currentColor", strokeWidth = 2, style = {} }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      try {
        const iconName = name.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        const iconFn = window.lucide[iconName] || window.lucide[name];
        if (iconFn) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("width", size);
          svg.setAttribute("height", size);
          svg.setAttribute("viewBox", "0 0 24 24");
          svg.setAttribute("fill", "none");
          svg.setAttribute("stroke", color);
          svg.setAttribute("stroke-width", strokeWidth);
          svg.setAttribute("stroke-linecap", "round");
          svg.setAttribute("stroke-linejoin", "round");
          // Lucide v0.263 icon data
          const iconData = iconFn[0]; // [[tag, attrs], ...]
          if (Array.isArray(iconData)) {
            iconData.forEach(([tag, attrs]) => {
              const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
              Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
              svg.appendChild(el);
            });
          }
          ref.current.appendChild(svg);
        }
      } catch (e) { /* fallback ke IC */ }
    }
  }, [name, size, color]);
  return <span ref={ref} style={{ display: "inline-flex", alignItems: "center", ...style }} />;
};
// ─────────────────────────────────────────────
// useOnlineStatus
// ─────────────────────────────────────────────
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return online;
}

// ─────────────────────────────────────────────
// Modal — portal ke document.body
// ─────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide, noPad }) {
  if (!open) return null;
  const modalTitleId = "modal-title-" + (title || "").replace(/\s+/g, "-").toLowerCase();
  const content = (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
    >
      <div className={`${styles.modalBox} ${wide ? styles.modalBoxWide : styles.modalBoxNormal}`}>
        <div className={styles.modalHeader}>
          <h3 id={modalTitleId} className={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} aria-label="Tutup" className={styles.modalCloseBtn}>
            {IC({ n: "x", s: 17, c: "var(--accent)" })}
          </button>
        </div>
        <div className={noPad ? styles.modalBodyNoPad : styles.modalBody}>{children}</div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}

// ─────────────────────────────────────────────
// Bdg — Badge pill
// ─────────────────────────────────────────────
export const Bdg = ({ text, color = "var(--accent)" }) => (
  <span
    className={styles.badge}
    style={{ background: color + "15", color, border: `1px solid ${color}30` }}
  >
    {text}
  </span>
);

// ─────────────────────────────────────────────
// Inp — Input / Select / Textarea wrapper
// ─────────────────────────────────────────────
export function Inp({ label, value, onChange, type = "text", placeholder, as, children, half }) {
  return (
    <div className={half ? styles.inpWrapHalf : styles.inpWrap}>
      {label && <label className={styles.inpLabel}>{label}</label>}
      {as === "select" ? (
        <select value={value} onChange={onChange} className={styles.inpBase}>
          {children}
        </select>
      ) : as === "textarea" ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${styles.inpBase} ${styles.inpTextarea}`}
        />
      ) : (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={styles.inpBase} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Btn — Button
// ─────────────────────────────────────────────
export function Btn({ children, onClick, color = "var(--accent)", size = "md", variant = "solid", disabled, full, sx }) {
  const pad = size === "sm" ? "8px 12px" : size === "lg" ? "14px 24px" : "9px 17px";
  const fs = size === "sm" ? 11.5 : size === "lg" ? 13.5 : 13;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: variant === "solid" ? color : "var(--bg-surface)",
        border: `1px solid ${color}`,
        color: variant === "solid" ? "#fff" : color,
        borderRadius: 8,
        padding: pad,
        fontSize: fs,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all .15s",
        width: full ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        boxShadow: variant === "solid" ? `0 2px 8px ${color}25` : "none",
        ...sx,
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────
// BtnSimpan — Tombol aksi utama standar (full width, primary)
// BtnBatal  — Tombol batal standar (full width, outline)
// Dipakai seragam di semua modal/form
// ─────────────────────────────────────────────
export function BtnSimpan({ onClick, disabled, loading, children = "Simpan", color = "var(--accent)" }) {
  const isDisabled = disabled || loading;
  return (
    <Btn onClick={onClick} disabled={isDisabled} color={color} size="lg" variant="solid" full>
      {loading ? (
        <>
          <span className={styles.btnSpinner} />
          <span>Menyimpan...</span>
        </>
      ) : (
        children
      )}
    </Btn>
  );
}
export function BtnBatal({ onClick, children = "Batal", sx }) {
  return (
    <Btn onClick={onClick} color="var(--tx-muted)" size="lg" variant="outline" full sx={sx}>
      {children}
    </Btn>
  );
}

// ─────────────────────────────────────────────
// ActionRow — wrapper tombol aksi berdampingan (gap standar 12px)
// ─────────────────────────────────────────────
export function ActionRow({ children, sx }) {
  return <div className={styles.actionRow} style={sx}>{children}</div>;
}

// ─────────────────────────────────────────────
// PH — Page Header
// ─────────────────────────────────────────────
export function PH({ title, sub, action }) {
  return (
    <div className={styles.phWrap}>
      <div>
        <h2 className={styles.phTitle}>{title}</h2>
        {sub && <p className={styles.phSub}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────
// ReadOnlyBanner
// ─────────────────────────────────────────────
export function ReadOnlyBanner({ reguHari, reason }) {
  return (
    <div className={styles.readOnlyBanner}>
      <span className={styles.readOnlyIcon} />
      <div>
        <div className={styles.readOnlyTitle}>Mode Baca Saja</div>
        <div className={styles.readOnlySub}>
          {reason || `Hanya Regu ${reguHari} (piket hari ini) yang dapat mengisi data.`}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PatrolRing — SVG ring progress
// ─────────────────────────────────────────────
export function PatrolRing({ value, max, label, onClick }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const size = 72;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const col = pct >= 0.8 ? "var(--accent)" : pct >= 0.5 ? "var(--amber)" : "var(--red)";

  return (
    <div onClick={onClick} className={styles.ringWrap} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className={styles.ringInner} style={{ width: size, height: size }}>
        <svg width={size} height={size} className={styles.ringSvg}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={6} />
          <circle
            className="patrol-ring-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={col}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ "--ring-full": circ, "--ring-offset": offset }}
          />
        </svg>
        <div className={styles.ringCenter}>
          <div className={styles.ringValue} style={{ color: col }}>{value}</div>
          <div className={styles.ringMax}>/{max}</div>
        </div>
      </div>
      <div className={styles.ringLabel}>{label}</div>
    </div>
  );
}
// ─────────────────────────────────────────────
// CamScanner — Kamera QR scanner
// ─────────────────────────────────────────────
export function CamScanner({ onScan, onClose, customDecode, customAreas }) {
  const vRef = useRef(null);
  const cRef = useRef(null);
  const stateRef = useRef({ stream: null, raf: null, active: false, done: false });
  const cbRef = useRef({ onScan, customDecode });
  cbRef.current = { onScan, customDecode };

  const [status, setStatus] = useState("idle");
  const [hitText, setHitText] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [jsReady, setJsReady] = useState(!!window.jsQR);

  useEffect(() => {
    if (window.BarcodeDetector || window.jsQR) { setJsReady(true); return; }
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";
    sc.onload = () => {
      setJsReady(true);
      const st = stateRef.current;
      if (st.active && !st.raf && !st.done && st.restartDecode) {
        st.raf = requestAnimationFrame(st.restartDecode);
      }
    };
    document.head.appendChild(sc);
  }, []);

  const hardStop = useCallback(() => {
    const st = stateRef.current;
    st.active = false;
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
    if (st.stream) { st.stream.getTracks().forEach((t) => t.stop()); st.stream = null; }
    if (vRef.current) vRef.current.srcObject = null;
    setStatus((s) => (s === "live" || s === "starting" ? "idle" : s));
  }, []);

  const decodeFrame = useCallback(() => {
    const st = stateRef.current;
    if (!st.active || st.done) return;
    const v = vRef.current, c = cRef.current;
    if (!v || !c || v.readyState < 2) { st.raf = requestAnimationFrame(decodeFrame); return; }
    const W = v.videoWidth || 320, H = v.videoHeight || 240;
    if (c.width !== W) c.width = W;
    if (c.height !== H) c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, W, H);

    const tryResult = (raw) => {
      if (!raw || st.done) return false;
      const { customDecode: cd } = cbRef.current;
      const result = cd ? cd(raw) : decQR(raw) || ALL_AREAS.find((a) => raw.includes(a)) || null;
      if (!result) return false;
      st.done = true; st.active = false;
      if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
      setHitText(result);
      setStatus("hit");
      setTimeout(() => { hardStop(); cbRef.current.onScan(result); }, 500);
      return true;
    };

    if (window.BarcodeDetector) {
      new window.BarcodeDetector({ formats: ["qr_code"] }).detect(c)
        .then((bs) => { if (!bs.length || !tryResult(bs[0].rawValue)) { if (st.active) st.raf = requestAnimationFrame(decodeFrame); } })
        .catch(() => { if (st.active) st.raf = requestAnimationFrame(decodeFrame); });
    } else if (window.jsQR) {
      const img = ctx.getImageData(0, 0, W, H);
      const code = window.jsQR(img.data, W, H, { inversionAttempts: "attemptBoth" });
      if (!code || !tryResult(code.data)) { if (st.active) st.raf = requestAnimationFrame(decodeFrame); }
    } else {
      if (st.active) st.raf = requestAnimationFrame(decodeFrame);
    }
  }, [hardStop]);

  const start = useCallback(async () => {
    const st = stateRef.current;
    if (st.stream || st.active) return;
    setStatus("starting"); setErrMsg(""); setHitText("");
    st.done = false; st.active = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      st.stream = stream;
      const v = vRef.current;
      if (!v) { stream.getTracks().forEach((t) => t.stop()); st.stream = null; return; }
      v.srcObject = stream;
      const go = () => {
        v.play().then(() => { st.active = true; setStatus("live"); st.raf = requestAnimationFrame(decodeFrame); }).catch(() => {});
      };
      if (v.readyState >= 1) go(); else v.onloadedmetadata = go;
    } catch (e) {
      setStatus("err");
      setErrMsg("Kamera tidak dapat diakses. Pastikan izin kamera diberikan.");
    }
  }, [decodeFrame]);

  useEffect(() => {
    stateRef.current.restartDecode = decodeFrame;
    start();
    return () => { stateRef.current.done = true; hardStop(); };
  }, []);

  const isLive = status === "live";
  const isHit = status === "hit";
  const isErr = status === "err";
  const isStart = status === "starting" || status === "idle";
  const hasBD = !!window.BarcodeDetector;

  const CORNERS = [["0%", "0%", "0", "0"], ["0%", "auto", "0", "0"], ["auto", "0%", "0", "0"], ["auto", "auto", "0", "0"]];

  return (
    <div className={styles.scannerWrap}>
      <div className={styles.scannerStage}>
        <video
          ref={vRef}
          className={`${styles.scannerVideo} ${isLive || isHit ? "" : styles.scannerVideoHidden}`}
          playsInline
          muted
        />
        <canvas ref={cRef} className={styles.scannerCanvas} />

        {isLive && (
          <div className={styles.scannerCornerOverlay}>
            <div className={styles.scannerCornerBox}>
              {CORNERS.map(([t, b, r, l], i) => (
                <div
                  key={i}
                  className={styles.scannerCorner}
                  style={{
                    top: t, bottom: b, right: r, left: l,
                    borderTop: t === "0%" ? "3px solid var(--accent-light)" : "none",
                    borderBottom: b === "0%" ? "3px solid var(--accent-light)" : "none",
                    borderLeft: l === "0%" ? "3px solid var(--accent-light)" : "none",
                    borderRight: r === "0%" ? "3px solid var(--accent-light)" : "none",
                    borderRadius: i === 0 ? "8px 0 0 0" : i === 1 ? "0 0 0 8px" : i === 2 ? "0 8px 0 0" : "0 0 8px 0",
                  }}
                />
              ))}
              <div className={styles.scannerDim} />
            </div>
          </div>
        )}

        {isHit && (
          <div className={styles.scannerHit}>
            <div className={styles.scannerHitBox}>
              <div className={styles.scannerHitEmoji} />
              {hitText}
            </div>
          </div>
        )}

        {isStart && (
          <div className={styles.scannerStart}>
            {IC({ n: "cam", s: 44, c: "var(--accent)" })}
            <div className={styles.scannerStartLabel}>{status === "starting" ? "Memulai kamera..." : "Kamera siap"}</div>
          </div>
        )}

        {isErr && (
          <div className={styles.scannerErr}>
            <div className={styles.scannerErrEmoji} />
            <div className={styles.scannerErrMsg}>{errMsg}</div>
            <button
              onClick={() => { setStatus("idle"); setErrMsg(""); start(); }}
              className={styles.scannerRetryBtn}
              style={{ marginBottom: customAreas ? 14 : 0 }}
            >
              ↺ Coba Lagi
            </button>
            {customAreas && customAreas.length > 0 && (
              <div>
                <div className={styles.scannerAltLabel}>— atau pilih manual —</div>
                <div className={styles.scannerAltList}>
                  {customAreas.map((area) => (
                    <button
                      key={area}
                      onClick={() => {
                        if (customDecode) {
                          const r = customDecode(area);
                          if (r) { onScan && onScan(r); return; }
                        }
                        onScan && onScan(area);
                      }}
                      className={styles.scannerAltBtn}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.scannerFooter}>
        {isLive && (
          <div
            className={styles.scannerStatusBox}
            style={{
              background: hasBD || jsReady ? "rgba(var(--green-rgb),.08)" : "rgba(var(--amber-rgb),.08)",
              border: "1px solid " + (hasBD || jsReady ? "rgba(var(--green-rgb),.4)" : "var(--amber)"),
              color: hasBD || jsReady ? "var(--accent)" : "var(--amber)",
            }}
          >
            {hasBD ? " BarcodeDetector aktif — arahkan ke QR code" : jsReady ? " jsQR aktif — arahkan kamera ke QR code" : "⏳ Memuat decoder..."}
          </div>
        )}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
// PosQRHero — Scan QR Pos + daftar status pos
// ─────────────────────────────────────────────
const POS_QR_PREFIX = "BBPKA2-PAMDAL-POS-";
const decPosQR = (v) => (v && v.startsWith(POS_QR_PREFIX) ? v.replace(POS_QR_PREFIX, "").replace(/_/g, " ") : null);

export function PosQRHero({ posAssign, setPosAssign, currentUser, toast, canEdit = true, isUserLibur }) {
  const [scanOpen, setScanOpen] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualVerify, setManualVerify] = useState(null); // { pos } — wajib verifikasi sebelum assign manual
  const [manualLog, setManualLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sipamdal_manual_log") || "[]"); }
    catch { return []; }
  });

  // Fungsi assign setelah verifikasi berhasil (dipanggil oleh ManualVerifyModal)
  const doAssignVerified = (pos) => {
    const myName = currentUser == null ? undefined : currentUser.name;
    if (!myName) { toast("Tidak ada pengguna login!", false); return; }
    if (manualVerify == null ? undefined : manualVerify.rolling) {
      // Tukar posisi: myName <-> targetName (pos tujuan penuh)
      const { targetName, myCurrentPos } = manualVerify;
      const updated = { ...posAssign };
      updated[pos] = [...(updated[pos] || []).filter((x) => x !== targetName), myName];
      updated[myCurrentPos] = [...(updated[myCurrentPos] || []).filter((x) => x !== myName), targetName];
      setPosAssign(updated);
      setManualLog((() => {
        try { return JSON.parse(localStorage.getItem("sipamdal_manual_log") || "[]"); }
        catch { return []; }
      })());
      toast(`📋↺ ${myName} → ${pos} · ${targetName} → ${myCurrentPos} [MANUAL — tercatat]`);
      setShowManual(false);
      setManualVerify(null);
      return;
    }
    const asgn = posAssign[pos] || [];
    const cap = POS_CAP[pos] || 1;
    if (asgn.includes(myName)) { toast(myName + " sudah ada di " + pos + "!", false); return; }
    if (asgn.length >= cap) { toast(pos + " sudah penuh!", false); return; }
    const updated = { ...posAssign };
    POS_LIST.forEach((p) => { if (updated[p]) updated[p] = updated[p].filter((m) => m !== myName); });
    updated[pos] = [...(updated[pos] || []), myName];
    setPosAssign(updated);
    setManualLog((() => {
      try { return JSON.parse(localStorage.getItem("sipamdal_manual_log") || "[]"); }
      catch { return []; }
    })());
    toast("📋 " + myName + " → " + pos + " [MANUAL — tercatat]");
    setShowManual(false);
    setManualVerify(null);
  };

  // Klik tombol pos manual → WAJIB verifikasi dulu, tidak langsung assign
  const requestManualAssign = (pos) => {
    const myName = currentUser == null ? undefined : currentUser.name;
    if (!myName) { toast("Tidak ada pengguna login!", false); return; }
    if ((posAssign[pos] || []).includes(myName)) { toast(myName + " sudah ada di " + pos + "!", false); return; }
    const asgn = posAssign[pos] || [];
    const cap = POS_CAP[pos] || 1;
    if (asgn.length >= cap) {
      // Pos penuh — tawarkan tukar posisi (sama seperti hasil scan QR)
      const myCurrentPos = (() => {
        const found = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(myName));
        return found ? found[0] : undefined;
      })();
      if (!myCurrentPos) {
        toast(`${pos} sudah penuh! Kamu belum di pos manapun untuk ditukar.`, false);
        return;
      }
      const targetName = asgn[0];
      setManualVerify({ pos, rolling: true, targetName, myCurrentPos });
      return;
    }
    setManualVerify({ pos });
  };

  const onScanPos = (raw) => {
    setScanOpen(false);
    const pos = POS_LIST.find((p) => raw.includes(p));
    if (!pos) { toast("QR tidak dikenali!", false); return; }
    // QR scan → langsung assign (jalur resmi, tanpa verifikasi PIN)
    const myName = currentUser == null ? undefined : currentUser.name;
    if (!myName) { toast("Tidak ada pengguna login!", false); return; }
    const asgn = posAssign[pos] || [];
    const cap = POS_CAP[pos] || 1;
    if (asgn.includes(myName)) { toast(myName + " sudah ada di " + pos + "!", false); return; }
    if (asgn.length >= cap) { toast(pos + " sudah penuh!", false); return; }
    const updated = { ...posAssign };
    POS_LIST.forEach((p) => { if (updated[p]) updated[p] = updated[p].filter((m) => m !== myName); });
    updated[pos] = [...(updated[pos] || []), myName];
    setPosAssign(updated);
    toast(" " + myName + " → " + pos + "!");
  };

  const reguHariNow = getReguHari(new Date());

  return (
    <div>
      {!canEdit && (
        <ReadOnlyBanner
          reguHari={reguHariNow}
          reason={isUserLibur ? "Kamu sedang libur/lepas hari ini - tidak dapat mengisi pos." : undefined}
        />
      )}

      {/* ── Header row: label kiri + tombol scan kanan ── */}
      <div className={styles.posHeroRow}>
        <div>
          <div className={styles.posHeroTitle}>Status Pos</div>
          <div className={styles.posHeroSub}>{POS_LIST.length} lokasi pengamanan</div>
        </div>
        <button
          onClick={() => canEdit && setScanOpen(true)}
          disabled={!canEdit}
          className={styles.scanBtn}
          style={{
            background: canEdit ? "var(--amber)" : "var(--tx-muted)",
            cursor: canEdit ? "pointer" : "not-allowed",
            boxShadow: canEdit ? "0 3px 10px rgba(var(--amber-rgb),.40)" : "none",
            opacity: canEdit ? 1 : 0.5,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="5" y="5" width="3" height="3" />
            <rect x="16" y="5" width="3" height="3" />
            <rect x="16" y="16" width="3" height="3" />
            <rect x="5" y="16" width="3" height="3" />
          </svg>
          Scan QR
        </button>
      </div>

      {/* ── Tombol fallback manual (jika QR gagal) ── */}
      {canEdit && (
        <button
          onClick={() => setShowManual((v) => !v)}
          className={styles.manualToggleBtn}
          style={{
            marginBottom: showManual ? 0 : 12,
            background: showManual ? "rgba(201,27,42,.10)" : "var(--bg-surface)",
            border: `1.5px solid ${showManual ? "var(--red)" : "var(--border2)"}`,
            borderRadius: showManual ? "12px 12px 0 0" : 12,
          }}
        >
          <div className={styles.manualToggleLeft}>
            <div className={styles.manualToggleTitle} style={{ color: showManual ? "var(--red)" : "var(--tx-secondary)" }}>
              Pilih Pos Manual
            </div>
            <div className={styles.manualToggleSub}>Jika QR gagal / kamera tidak tersedia</div>
          </div>
          <span className={styles.manualToggleChevron}>{showManual ? "▲" : "▼"}</span>
        </button>
      )}

      {/* Warning banner saat accordion manual terbuka */}
      {showManual && canEdit && (
        <div className={styles.manualWarnBanner}>
          <span className={styles.manualWarnIcon}>⚠️</span>
          <div className={styles.manualWarnText}>
            Pilihan ini memerlukan verifikasi: alasan, PIN, dan foto bukti. Data dicatat dan dapat diperiksa Admin.
          </div>
        </div>
      )}

      {showManual && canEdit && (
        <div className={styles.manualPosGrid}>
          {POS_LIST.map((pos) => {
            const asgn = posAssign[pos] || [];
            const cap = POS_CAP[pos] || 1;
            const full = asgn.length >= cap;
            const isMe = asgn.includes(currentUser == null ? undefined : currentUser.name);
            return (
              <button
                key={pos}
                onClick={() => requestManualAssign(pos)}
                disabled={isMe}
                className={styles.manualPosBtn}
                style={{
                  border: `1.5px solid ${full ? "var(--border2)" : "var(--red)"}`,
                  background: full ? "var(--bg-raised)" : "rgba(201,27,42,.08)",
                  cursor: isMe ? "not-allowed" : "pointer",
                  color: full ? "var(--tx-muted)" : "var(--red)",
                }}
              >
                🔐 {pos}{full ? " (Penuh — tukar)" : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Daftar pos ── */}
      {POS_LIST.map((pos) => {
        const asgn = posAssign[pos] || [];
        const cap = POS_CAP[pos] || 1;
        const full = asgn.length >= cap;
        return (
          <div
            key={pos}
            className={styles.posRow}
            style={{
              background: full ? "rgba(var(--green-rgb),.07)" : "rgba(201,27,42,.05)",
              border: "1.5px solid " + (full ? "rgba(var(--green-rgb),.28)" : "rgba(201,27,42,.20)"),
            }}
          >
            <div>
              <div className={styles.posRowName} style={{ color: "var(--tx-secondary,#374151)" }}>{pos}</div>
              <div className={styles.posRowStatus} style={{ color: asgn.length > 0 ? "var(--tx-muted)" : "var(--red)" }}>
                {asgn.length > 0 ? asgn.join(", ") : "Kosong"}
              </div>
            </div>
            <div
              className={styles.posRowCount}
              style={{
                background: full ? "rgba(var(--green-rgb),.15)" : "rgba(201,27,42,.12)",
                color: full ? "var(--accent)" : "var(--red)",
              }}
            >
              {asgn.length}/{cap}
            </div>
          </div>
        );
      })}

      {scanOpen && (
        <Modal open onClose={() => setScanOpen(false)} title="Scan QR Pos" noPad>
          <div style={{ height: 380, display: "flex", flexDirection: "column" }}>
            <CamScanner
              onScan={onScanPos}
              onClose={() => setScanOpen(false)}
              customDecode={(raw) => {
                const p = decPosQR(raw) || POS_LIST.find((x) => raw.includes(x));
                return POS_LIST.includes(p) ? p : null;
              }}
            />
          </div>
        </Modal>
      )}

      {/* ── Modal Verifikasi Manual (WAJIB: alasan + PIN + foto) ── */}
      {manualVerify && (
        <ManualVerifyModal
          open={!!manualVerify}
          onClose={() => setManualVerify(null)}
          targetPos={(manualVerify == null ? undefined : manualVerify.pos) || ""}
          userName={(currentUser == null ? undefined : currentUser.name) || "—"}
          rolling={!!(manualVerify == null ? undefined : manualVerify.rolling)}
          targetName={(manualVerify == null ? undefined : manualVerify.targetName) || ""}
          myCurrentPos={(manualVerify == null ? undefined : manualVerify.myCurrentPos) || ""}
          onVerified={() => doAssignVerified(manualVerify.pos)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// useInnerModal — daftarkan inner modal ke sistem back-button terpusat
// Cara pakai: useInnerModal([open, showTemplates], [setOpen, setShowTemplates])
// ─────────────────────────────────────────────
export function useInnerModal(booleans, closers) {
  const anyOpen = booleans.some(Boolean);
  const closersRef = useRef(closers);
  closersRef.current = closers;

  useEffect(() => {
    if (anyOpen) window.__anyModalOpen = true;
  }, [anyOpen]);

  useEffect(() => {
    const handler = () => closersRef.current.forEach((fn) => fn && fn(false));
    window.addEventListener("sipamdal_close_modals", handler);
    return () => window.removeEventListener("sipamdal_close_modals", handler);
  }, []);
}
