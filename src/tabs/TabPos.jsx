// TabPos.jsx — SIPAMDAL (migrasi dari tab-pos.js, Sesi 3)
// Tab Penempatan Pos (PosTab)

import { useState, useRef, useEffect, Fragment } from "react";

import {
  REGU, POS_LIST, POS_CAP,
  kompressFoto,
} from "../utils/utils.js";

import {
  IC, Modal, Inp, Btn, PH, ReadOnlyBanner, CamScanner,
} from "../components/ui/UiComponents.jsx";

import { QRSvg } from "../engine/QrEngine.jsx";

import { verifyPinFS, DEFAULT_PINS } from "../stores/useAuthStore.js";

import styles from "./TabPos.module.css";

// ── Keamanan Pilih Pos Manual ─────────────────────────────────────────────────
// PIN verifikasi = PIN login akun yang sedang aktif (verifyPinFS)
const MANUAL_LOG_KEY = "sipamdal_manual_log";
const LOCKOUT_KEY    = "sipamdal_manual_lockout";
const MAX_WRONG_PIN  = 3;    // maks salah PIN sebelum lockout
const LOCKOUT_MS     = 5 * 60 * 1000; // 5 menit lockout

const ALASAN_OPTIONS = [
  "Kamera tidak tersedia / rusak",
  "QR code pos rusak / tidak terbaca",
  "Kondisi darurat (posisi harus segera diisi)",
  "Perangkat tidak mendukung kamera",
  "Lainnya (wajib jelaskan di bawah)",
];

function getManualLog() {
  try { return JSON.parse(localStorage.getItem(MANUAL_LOG_KEY) || "[]"); } catch { return []; }
}
function addManualLog(entry) {
  const log = getManualLog();
  log.push(entry);
  localStorage.setItem(MANUAL_LOG_KEY, JSON.stringify(log.slice(-200)));
}
function getLockout() {
  const v = localStorage.getItem(LOCKOUT_KEY);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}
function setLockout(data) {
  if (!data) { localStorage.removeItem(LOCKOUT_KEY); return; }
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
}

// ── Modal Verifikasi Manual ───────────────────────────────────────────────────
function ManualVerifyModal({ open, onClose, onVerified, targetPos, userName, rolling, targetName, myCurrentPos }) {
  const [pin, setPin]         = useState("");
  const [alasan, setAlasan]   = useState("");
  const [keterangan, setKet]  = useState("");
  const [step, setStep]       = useState(1); // 1=alasan, 2=pin, 3=foto
  const [err, setErr]         = useState("");
  const [wrong, setWrong]     = useState(0);
  const [checking, setChecking] = useState(false);
  const [locked, setLocked]   = useState(false);
  const [lockSisa, setLockSisa] = useState(0);
  const [foto, setFoto]       = useState(null);
  const pinRef  = useRef();
  const fotoRef = useRef();

  // Cek lockout tiap render / buka modal
  useEffect(() => {
    if (!open) return;
    setPin(""); setAlasan(""); setKet(""); setStep(1); setErr(""); setWrong(0); setFoto(null);
    const lo = getLockout();
    if (lo) {
      const sisa = lo.until - Date.now();
      if (sisa > 0) { setLocked(true); setLockSisa(sisa); }
      else { setLockout(null); setLocked(false); }
    } else { setLocked(false); }
  }, [open]);

  // Countdown lockout
  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => {
      const lo = getLockout();
      if (!lo || Date.now() >= lo.until) {
        setLockout(null); setLocked(false); clearInterval(t);
      } else {
        setLockSisa(lo.until - Date.now());
      }
    }, 1000);
    return () => clearInterval(t);
  }, [locked]);

  if (!open) return null;

  const menit = Math.floor(lockSisa / 60000);
  const detik = Math.floor((lockSisa % 60000) / 1000);
  const butuhKet = alasan.includes("Lainnya");

  const handleNextStep = () => {
    if (!alasan) { setErr("Pilih alasan terlebih dahulu!"); return; }
    if (butuhKet && !keterangan.trim()) { setErr("Keterangan wajib diisi!"); return; }
    setErr(""); setStep(2);
    setTimeout(() => (pinRef.current == null ? undefined : pinRef.current.focus()), 100);
  };

  const handlePinNext = async () => {
    if (!pin) { setErr("Masukkan PIN terlebih dahulu!"); return; }
    setChecking(true);
    let pinOk;
    try {
      const fsResult = await verifyPinFS(userName, pin);
      pinOk = fsResult !== null ? fsResult : (pin === (DEFAULT_PINS[userName] || "123456"));
    } catch {
      pinOk = pin === (DEFAULT_PINS[userName] || "123456");
    }
    setChecking(false);
    if (pinOk) {
      setErr(""); setStep(3);
    } else {
      const newWrong = wrong + 1;
      setWrong(newWrong);
      setPin("");
      if (newWrong >= MAX_WRONG_PIN) {
        const lo = { until: Date.now() + LOCKOUT_MS, wrongCount: newWrong };
        setLockout(lo);
        setLocked(true);
        setLockSisa(LOCKOUT_MS);
        setErr("");
        addManualLog({ ts: Date.now(), user: userName, pos: targetPos, alasan, keterangan, method: "MANUAL_GAGAL_LOCKOUT" });
      } else {
        setErr(`PIN salah! Sisa percobaan: ${MAX_WRONG_PIN - newWrong}x`);
      }
    }
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { kompressFoto(r.result).then(compressed => setFoto(compressed)); };
    r.readAsDataURL(file);
  };

  const handleFinalSubmit = () => {
    if (!foto) { setErr("📸 Foto bukti wajib diambil sebelum konfirmasi!"); return; }
    const logEntry = {
      ts: Date.now(), user: userName, pos: targetPos,
      alasan, keterangan: butuhKet ? keterangan : "",
      method: "MANUAL", foto,
    };
    addManualLog(logEntry);
    setLockout(null);
    onVerified(logEntry);
  };

  return (
    <Modal open={open} onClose={onClose} title="⚠️ Verifikasi Pilih Pos Manual">
      <div>
        {/* Banner peringatan */}
        <div className={styles.warnBanner}>
          <div className={styles.warnBannerTitle}>⚠️ Gunakan QR Code jika memungkinkan!</div>
          <div className={styles.warnBannerText}>
            Pilih pos secara manual akan dicatat & dapat diperiksa oleh Admin. Digunakan HANYA jika QR tidak bisa dipakai.
          </div>
        </div>

        {/* Target pos */}
        <div className={styles.targetInfoBox}>
          <div className={styles.targetInfoLabel}>{rolling ? "Pos Tujuan (Penuh — Tukar Posisi)" : "Pos Tujuan"}</div>
          <div className={styles.targetInfoPos}>{targetPos}</div>
          <div className={styles.targetInfoUser}>👤 {userName}</div>
          {rolling && (
            <div className={styles.targetInfoRolling}>
              {`↺ ${userName} ⇄ ${targetName} (${myCurrentPos})`}
            </div>
          )}
        </div>

        {locked ? (
          <div className={styles.lockedBox}>
            <div className={styles.lockedEmoji}>🔒</div>
            <div className={styles.lockedTitle}>Akses Dikunci!</div>
            <div className={styles.lockedText}>Terlalu banyak percobaan salah. Coba lagi dalam:</div>
            <div className={styles.lockedCountdown}>
              {`${String(menit).padStart(2, "0")}:${String(detik).padStart(2, "0")}`}
            </div>
            <div className={styles.lockedFootnote}>Hubungi Admin jika perlu akses segera.</div>
          </div>
        ) : step === 1 ? (
          <div>
            <div className={styles.stepLabel}>Langkah 1/3 — Alasan tidak scan QR:</div>
            {ALASAN_OPTIONS.map(opt => (
              <label
                key={opt}
                className={styles.alasanOption}
                style={{
                  background: alasan === opt ? "rgba(var(--orb-rgb),.1)" : "var(--bg-surface)",
                  border: `1.5px solid ${alasan === opt ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                <input
                  type="radio"
                  name="alasan"
                  value={opt}
                  checked={alasan === opt}
                  onChange={() => { setAlasan(opt); setErr(""); }}
                  className={styles.alasanRadio}
                />
                <span className={styles.alasanText}>{opt}</span>
              </label>
            ))}
            {alasan.includes("Lainnya") && (
              <textarea
                placeholder="Jelaskan alasan secara singkat..."
                value={keterangan}
                onChange={e => setKet(e.target.value)}
                maxLength={200}
                className={styles.alasanTextarea}
              />
            )}
            {err && <div className={styles.errorText}>{err}</div>}
            <div className={styles.formActions}>
              <Btn onClick={handleNextStep} color="var(--accent)" size="lg" full>
                Lanjut → Verifikasi PIN
              </Btn>
              <Btn onClick={onClose} color="var(--tx-muted)" variant="outline">Batal</Btn>
            </div>
          </div>
        ) : step === 2 ? (
          <div>
            <div className={styles.stepLabel} style={{ marginBottom: 10 }}>Langkah 2/3 — Masukkan PIN Login Anda:</div>
            <div className={styles.pinAlasanRecap}>
              {`Alasan: ${alasan}${keterangan ? " — " + keterangan : ""}`}
            </div>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="PIN Login (6 digit)"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handlePinNext()}
              className={styles.pinInput}
              style={{ border: `2px solid ${err ? "var(--red)" : "var(--border)"}` }}
            />
            {err && <div className={styles.pinErrorText}>❌ {err}</div>}
            <div className={styles.formActions} style={{ marginTop: 12 }}>
              <Btn onClick={handlePinNext} color="var(--accent)" size="lg" full disabled={pin.length < 6 || checking}>
                {checking ? "Memeriksa PIN..." : "Lanjut → Ambil Foto Bukti"}
              </Btn>
              <Btn onClick={() => setStep(1)} color="var(--tx-muted)" variant="outline">← Kembali</Btn>
            </div>
            <div className={styles.pinFootnote}>
              {`Percobaan salah: ${wrong}/${MAX_WRONG_PIN} — Setelah ${MAX_WRONG_PIN}x salah, akses dikunci 5 menit.`}
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.fotoStepLabel}>Langkah 3/3 — Foto Bukti Keberadaan di Pos:</div>
            <div className={styles.pinAlasanRecap} style={{ marginBottom: 12 }}>
              {`Alasan: ${alasan}${keterangan ? " — " + keterangan : ""}`}
            </div>

            {!foto ? (
              <label className={styles.fotoDropzoneRequired}>
                {IC({ n: "cam", s: 28, c: "var(--red)" })}
                <span>📸 Ambil Foto Bukti (WAJIB)</span>
                <span className={styles.fotoDropzoneHint}>Foto lokasi / situasi pos saat ini</span>
                <input
                  ref={fotoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotoChange}
                  style={{ display: "none" }}
                />
              </label>
            ) : (
              <div className={styles.fotoPreviewWrap}>
                <img src={foto} alt="bukti" className={styles.fotoPreviewImg} />
                <div className={styles.photoReadyBadge}>✓ Foto siap</div>
                <button
                  onClick={() => { setFoto(null); if (fotoRef.current) fotoRef.current.value = ""; }}
                  className={styles.photoChangeBtn}
                >
                  🔄 Ganti
                </button>
              </div>
            )}

            {err && <div className={styles.errorText} style={{ textAlign: "center" }}>{err}</div>}

            <div className={styles.formActions}>
              <Btn
                onClick={handleFinalSubmit}
                color={foto ? "var(--red)" : "var(--tx-muted)"}
                size="lg"
                full
                disabled={!foto}
              >
                {foto ? "🔓 Konfirmasi Penempatan Manual" : "📸 Foto dulu sebelum konfirmasi"}
              </Btn>
              <Btn onClick={() => setStep(2)} color="var(--tx-muted)" variant="outline">← Kembali</Btn>
            </div>
            <div className={styles.fotoSubmitFootnote}>Foto disimpan sebagai bukti & dapat diperiksa Admin.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Warna per pos ─────────────────────────────────────────────────────────────
const POS_COL = {
  "Pos Utama":       "var(--tx-muted)",
  "Pos Asrama":      "var(--tx-muted)",
  "Pos Guest House": "var(--tx-muted)",
  "Gedung Utama":    "var(--tx-muted)",
};

// ── QR encode/decode khusus pos ───────────────────────────────────────────────
const POS_QR_PREFIX = "BBPKA2-POS-";
const encPosQR = (pos) => POS_QR_PREFIX + pos.replace(/ /g, "_");
const decPosQR = (v) =>
  v && v.startsWith(POS_QR_PREFIX)
    ? v.replace(POS_QR_PREFIX, "").replace(/_/g, " ")
    : null;

// ── Color helper lokal ────────────────────────────────────────────────────────
function colRgb(col) {
  if (!col) return "var(--orb-rgb)";
  if (col.includes("amber"))  return "var(--amber-rgb)";
  if (col.includes("red"))    return "var(--red-rgb)";
  if (col.includes("violet")) return "var(--violet-rgb)";
  if (col.includes("teal") || col.includes("regu-1")) return "var(--teal-rgb)";
  if (col.includes("col-slate") || col.includes("slate")) return "100,116,139";
  return "var(--orb-rgb)";
}
function cRgba(col, a) { return `rgba(${colRgb(col)},${a})`; }

// ── Format jam singkat ────────────────────────────────────────────────────────
const fmtT = (d) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// ─────────────────────────────────────────────────────────────────────────────
// PosTab
// Props: reguHari, posAssign, setPosAssign, posRollingLog, setPosRollingLog,
//        toast, canEdit, isAdmin, currentUser, isUserLibur
// ─────────────────────────────────────────────────────────────────────────────
export function PosTab({ reguHari, posAssign, setPosAssign, posShiftKey, posRollingLog, setPosRollingLog, toast, canEdit, isAdmin, currentUser, isUserLibur }) {
  const members = REGU[reguHari] || [];
  const [mode, setMode] = useState("assign");
  const [scanOpen, setScanOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [rollingFrom, setRollingFrom] = useState("");
  const [rollingTo, setRollingTo] = useState("");
  const [viewPosQR, setViewPosQR] = useState(null);
  const [posPhoto, setPosPhoto] = useState(null);
  const [manualVerify, setManualVerify] = useState(null); // { pos } — trigger modal verifikasi manual
  const [manualLog, setManualLog]       = useState(() => getManualLog()); // log lokal untuk tampil di UI
  const [posConfirmQR, setPosConfirmQR] = useState(null); // { pos, myName } setelah scan QR
  const [posRollingConfirm, setPosRollingConfirm] = useState(null); // { pos, myName, targetName, myCurrentPos } rolling via scan
  const posPhotoRef = useRef();

  const handlePosPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { kompressFoto(r.result).then(compressed => setPosPhoto(compressed)); };
    r.readAsDataURL(file);
  };

  const onScanPos = (raw) => {
    setScanOpen(false);
    const pos = decPosQR(raw) || POS_LIST.find(p => raw.includes(p));
    if (!pos || !POS_LIST.includes(pos)) {
      toast("QR tidak dikenali!", false);
      return;
    }

    // FIX Bug 2 & 3 — mode rolling: cari penghuni pos, isi rollingTo dgn nama anggota (bukan nama pos)
    if (mode === "rolling") {
      const occupant = (posAssign[pos] || [])[0];
      if (!occupant) {
        toast(`${pos} kosong, pilih anggota dari dropdown!`, false);
        return;
      }
      setRollingTo(occupant);
      toast(`${occupant} dipilih dari ${pos}`);
      return;
    }

    const asgn = posAssign[pos] || [];
    const cap  = POS_CAP[pos] || 1;
    const myName = (currentUser == null ? undefined : currentUser.name);
    if (!myName) { toast("Tidak ada pengguna login!", false); return; }
    if (asgn.includes(myName)) { toast(`${myName} sudah ada di ${pos}!`, false); return; }

    // FIX Bug 1 — pos penuh: tawarkan rolling, jangan langsung tolak
    if (asgn.length >= cap) {
      const myCurrentPos = (() => {
        const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(myName));
        return f ? f[0] : undefined;
      })();
      if (!myCurrentPos) {
        toast(`${pos} sudah penuh! Kamu belum di pos manapun untuk ditukar.`, false);
        return;
      }
      const targetName = asgn[0];
      setPosRollingConfirm({ pos, myName, targetName, myCurrentPos });
      return;
    }

    setPosPhoto(null);
    setPosConfirmQR({ pos, myName });
  };

  const doAssignFromQR = () => {
    const { pos, myName } = posConfirmQR;
    const updated = { ...posAssign };
    POS_LIST.forEach(p => { if (updated[p]) updated[p] = updated[p].filter(m => m !== myName); });
    updated[pos] = [...(updated[pos] || []), myName];
    setPosAssign(posShiftKey, updated);
    setPosConfirmQR(null);
    setPosPhoto(null);
    toast(`✓ ${myName} → ${pos}!`);
  };

  const doAssign = () => {
    const nameToAssign = isAdmin ? selectedMember : ((currentUser == null ? undefined : currentUser.name) || "");
    if (!nameToAssign) {
      toast(isAdmin ? "Pilih anggota!" : "Tidak ada pengguna login!", false);
      return;
    }
    const asgn = posAssign[confirm.pos] || [];
    const cap = POS_CAP[confirm.pos] || 1;
    if (asgn.includes(nameToAssign)) {
      toast(`${nameToAssign} sudah ada di ${confirm.pos}!`, false);
      return;
    }
    if (asgn.length >= cap) {
      toast(`${confirm.pos} sudah penuh!`, false);
      return;
    }
    const updated = { ...posAssign };
    POS_LIST.forEach(p => { if (updated[p]) updated[p] = updated[p].filter(m => m !== nameToAssign); });
    updated[confirm.pos] = [...(updated[confirm.pos] || []), nameToAssign];
    setPosAssign(posShiftKey, updated);
    setConfirm(null);
    toast(`✓ ${nameToAssign} → ${confirm.pos}!`);
  };

  const doRolling = () => {
    if (!rollingFrom || !rollingTo) {
      toast("Pilih anggota & pos tujuan!", false);
      return;
    }
    if (rollingFrom === rollingTo) {
      toast("Pilih anggota yang berbeda!", false);
      return;
    }
    const fromPos = (() => {
      const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(rollingFrom));
      return f ? f[0] : undefined;
    })();
    const toPos = (() => {
      const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(rollingTo));
      return f ? f[0] : undefined;
    })();
    if (!fromPos) { toast(`${rollingFrom} belum ditempatkan di pos mana pun!`, false); return; }
    if (!toPos)   { toast(`${rollingTo} belum ditempatkan di pos mana pun!`, false); return; }
    if (fromPos === toPos) { toast("Kedua anggota sudah ada di pos yang sama!", false); return; }

    const updated = { ...posAssign };
    updated[fromPos] = [...(updated[fromPos] || []).filter(x => x !== rollingFrom), rollingTo];
    updated[toPos]   = [...(updated[toPos]   || []).filter(x => x !== rollingTo),   rollingFrom];
    setPosAssign(posShiftKey, updated);
    const log = { id: Date.now(), ts: Date.now(), member: `${rollingFrom} ⇄ ${rollingTo}`, fromPos, toPos };
    setPosRollingLog([...(posRollingLog || []), log]);
    toast(`↺ ${rollingFrom} (${fromPos}) ⇄ ${rollingTo} (${toPos})`);
    setRollingFrom("");
    setRollingTo("");
  };

  const doRollingFromScan = () => {
    const { pos, myName, targetName, myCurrentPos } = posRollingConfirm;
    const updated = { ...posAssign };
    // targetName keluar dari pos tujuan, myName masuk
    updated[pos]          = [...(updated[pos]          || []).filter(x => x !== targetName), myName];
    // myName keluar dari pos asal, targetName masuk
    updated[myCurrentPos] = [...(updated[myCurrentPos] || []).filter(x => x !== myName), targetName];
    setPosAssign(posShiftKey, updated);
    const log = { id: Date.now(), ts: Date.now(), member: `${myName} ⇄ ${targetName}`, fromPos: myCurrentPos, toPos: pos };
    setPosRollingLog([...(posRollingLog || []), log]);
    setPosRollingConfirm(null);
    toast(`↺ ${myName} → ${pos} · ${targetName} → ${myCurrentPos}`);
  };

  const removeFromPos = (pos, m) => {
    if (!canEdit) return;
    const updated = { ...posAssign, [pos]: (posAssign[pos] || []).filter(x => x !== m) };
    setPosAssign(posShiftKey, updated);
    toast(`${m} dilepas dari ${pos}`);
  };

  const todayRolling = (posRollingLog || []).filter(r => new Date(r.ts).toDateString() === new Date().toDateString());
  const allAssigned  = Object.values(posAssign).flat();

  return (
    <div>
      {/* ── Header ── */}
      <PH
        title="Penempatan Pos"
        sub={`Regu ${reguHari}: ${members.join(", ")}`}
        action={isAdmin && (
          <div style={{ display: "flex", gap: 6 }}>
            <Btn onClick={() => setScanOpen(true)} color="var(--accent)" size="sm">
              {IC({ n: "qr", s: 12 })} QR
            </Btn>
          </div>
        )}
      />

      {/* ── ReadOnly banner ── */}
      {!canEdit && (
        <ReadOnlyBanner
          reguHari={reguHari}
          reason={isUserLibur ? "Kamu sedang libur/lepas hari ini - tidak dapat mengisi data." : undefined}
        />
      )}

      {/* ── Mode toggle ── */}
      {canEdit && (
        <div className={styles.modeToggle}>
          {[["assign", "📍 Penempatan"], ["rolling", "↺ Rolling Pos"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={styles.modeToggleBtn}
              style={{
                background: mode === v ? "var(--bg-surface)" : "transparent",
                color: mode === v ? "var(--accent)" : "var(--tx-muted)",
                boxShadow: mode === v ? "0 1px 6px rgba(0,0,0,.08)" : "none",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* ── Mode: Assign ── */}
      {mode === "assign" && (
        <Fragment>
          {/* Banner utamakan QR */}
          {canEdit && !isAdmin && (
            <div className={styles.qrBanner}>
              <span className={styles.qrBannerIcon}>📷</span>
              <div>
                <div className={styles.qrBannerTitle}>Utamakan Scan QR!</div>
                <div className={styles.qrBannerText}>
                  Tap kartu pos hanya jika QR tidak bisa digunakan. Penempatan manual memerlukan alasan & PIN verifikasi dan akan direkam.
                </div>
              </div>
            </div>
          )}
          <div className={styles.posGrid}>
            {POS_LIST.map(pos => {
              const col  = POS_COL[pos];
              const cap  = POS_CAP[pos];
              const asgn = posAssign[pos] || [];
              const isFull  = asgn.length >= cap;
              const isEmpty = asgn.length === 0;
              return (
                <div
                  key={pos}
                  className={`${styles.posCard} ${isEmpty && canEdit ? "pos-empty-card" : ""}`}
                  style={{
                    border: `1.5px solid ${isEmpty && canEdit ? "var(--red)" : isFull ? cRgba(col, .38) : cRgba(col, .16)}`,
                  }}
                >
                  <button
                    onClick={() => {
                      if (!canEdit) return;
                      if (isAdmin) {
                        if (isFull) return;
                        setConfirm({ pos, type: "assign" });
                        setSelectedMember("");
                      } else {
                        // Non-admin WAJIB lewat verifikasi manual (PIN + alasan)
                        const myName = (currentUser == null ? undefined : currentUser.name);
                        if (!myName) return;
                        if ((posAssign[pos] || []).includes(myName)) { toast(`${myName} sudah di ${pos}!`, false); return; }
                        if (isFull) {
                          // Pos penuh — tawarkan tukar posisi (sama seperti hasil scan QR)
                          const myCurrentPos = (() => {
                            const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(myName));
                            return f ? f[0] : undefined;
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
                      }
                    }}
                    disabled={!canEdit || (isFull && isAdmin)}
                    className={styles.posCardHeaderBtn}
                    style={{
                      background: isFull ? col : isEmpty && canEdit ? "var(--red)" : cRgba(col, .80),
                      cursor: canEdit && !(isFull && isAdmin) ? "pointer" : "default",
                    }}
                  >
                    <span className={styles.posCardTitle}>{pos}</span>
                    <span className={styles.posCardCount}>{asgn.length}/{cap}</span>
                  </button>
                  <div className={styles.posCardBody}>
                    {asgn.length === 0 && (
                      <div
                        className={styles.posEmptyMsg}
                        style={{ color: canEdit ? "var(--red)" : "var(--tx-muted)", fontWeight: canEdit ? 700 : 400 }}
                      >
                        {canEdit ? "🔐 Tap untuk isi (PIN diperlukan)" : "Belum ada"}
                      </div>
                    )}
                    {asgn.map(m => (
                      <div key={m} className={styles.posMemberRow}>
                        <div className={styles.posMemberLeft}>
                          {IC({ n: "ok", s: 12, c: col })}
                          <span className={styles.posMemberName}>{m}</span>
                        </div>
                        {canEdit && (
                          <button onClick={() => removeFromPos(pos, m)} className={styles.posMemberRemoveBtn}>✕</button>
                        )}
                      </div>
                    ))}
                    {isFull && !isAdmin && canEdit && !asgn.includes(currentUser == null ? undefined : currentUser.name) && (
                      <div className={styles.posFullHint}>🔁 Penuh — tap untuk tukar posisi (PIN diperlukan)</div>
                    )}
                  </div>
                  {/* Tombol lihat QR pos (admin only) */}
                  {isAdmin && (
                    <button onClick={() => setViewPosQR(pos)} className={styles.posQRViewBtn}>
                      {IC({ n: "qr", s: 11 })} QR Pos
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Fragment>
      )}

      {/* ── Mode: Rolling ── */}
      {mode === "rolling" && canEdit && (
        <div>
          <div className={styles.rollingBox}>
            <div className={styles.rollingTitle}>↺ Tukar Posisi (Rolling)</div>
            <div className={styles.rollingSub}>Pilih dua anggota yang akan saling bertukar pos.</div>
            <Inp label="Anggota A (yang dipindah)" value={rollingFrom} onChange={e => setRollingFrom(e.target.value)} as="select">
              <option value="">— Pilih Anggota A —</option>
              {members.map(m => {
                const curPos = (() => {
                  const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(m));
                  return f ? f[0] : "Belum ditempatkan";
                })();
                return <option key={m} value={m}>{`${m} (${curPos})`}</option>;
              })}
            </Inp>
            {rollingFrom && rollingTo && (() => {
              const posA = (() => {
                const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(rollingFrom));
                return f ? f[0] : "—";
              })();
              const posB = (() => {
                const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(rollingTo));
                return f ? f[0] : "—";
              })();
              return (
                <div className={styles.rollingPreview}>
                  {`${rollingFrom} [${posA}] ⇄ ${rollingTo} [${posB}]`}
                </div>
              );
            })()}
            <Inp label="Anggota B (ditukar dengan)" value={rollingTo} onChange={e => setRollingTo(e.target.value)} as="select">
              <option value="">— Pilih Anggota B —</option>
              {members.filter(m => m !== rollingFrom).map(m => {
                const curPos = (() => {
                  const f = Object.entries(posAssign).find(([, ms]) => ms && ms.includes(m));
                  return f ? f[0] : "Belum ditempatkan";
                })();
                return <option key={m} value={m}>{`${m} (${curPos})`}</option>;
              })}
            </Inp>
            <div className={styles.rollingActions}>
              <Btn onClick={doRolling} color="var(--accent)" size="lg" full>
                {IC({ n: "rot", s: 14 })} Konfirmasi Rolling
              </Btn>
              <Btn onClick={() => setScanOpen(true)} color="var(--tx-muted)" variant="outline">Scan QR Pos</Btn>
            </div>
          </div>
          {todayRolling.length > 0 && (
            <div className={styles.rollingLogBox}>
              <div className={styles.rollingLogTitle}>{`Log Rolling Hari Ini (${todayRolling.length})`}</div>
              {[...todayRolling].reverse().map(r => (
                <div key={r.id} className={styles.rollingLogRow}>
                  <span style={{ fontSize: 13 }}>{IC({ n: "rot", s: 16, c: "currentColor" })}</span>
                  <div className={styles.rollingLogInfo}>
                    <div className={styles.rollingLogMember}>{r.member}</div>
                    <div className={styles.rollingLogTime}>{fmtT(r.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {todayRolling.length === 0 && (
            <div className={styles.rollingEmpty}>Belum ada rolling hari ini</div>
          )}
        </div>
      )}

      {/* ── Modal: CamScanner ── */}
      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="Scan / Pilih Pos" noPad>
        <div style={{ height: 380, display: "flex", flexDirection: "column" }}>
          <CamScanner
            onScan={onScanPos}
            onClose={() => setScanOpen(false)}
            customAreas={POS_LIST}
            customDecode={raw => { const p = decPosQR(raw) || POS_LIST.find(p2 => raw.includes(p2)); return POS_LIST.includes(p) ? p : null; }}
          />
        </div>
      </Modal>

      {/* ── Modal: Konfirmasi penempatan via QR ── */}
      <Modal open={!!posConfirmQR} onClose={() => { setPosConfirmQR(null); setPosPhoto(null); }} title="Konfirmasi Penempatan Pos">
        {posConfirmQR && (
          <div>
            <div
              className={styles.confirmBox}
              style={{
                background: (POS_COL[posConfirmQR.pos] || "var(--accent)") + "14",
                border: "1.5px solid " + (POS_COL[posConfirmQR.pos] || "var(--accent)") + "30",
              }}
            >
              <div className={styles.confirmBoxLabel}>QR terdeteksi — Pos Tujuan</div>
              <div className={styles.confirmBoxPos} style={{ color: POS_COL[posConfirmQR.pos] || "var(--accent)" }}>
                {posConfirmQR.pos}
              </div>
              <div className={styles.confirmBoxName}>👤 {posConfirmQR.myName}</div>
            </div>
            <div className={styles.photoSection}>
              <label className={styles.photoLabel} style={{ color: posPhoto ? "var(--accent)" : "var(--tx-muted)" }}>
                📸 Foto Bukti (Opsional)
              </label>
              {!posPhoto ? (
                <label className={styles.photoDropzone}>
                  {IC({ n: "cam", s: 20, c: "var(--red)" })} Ambil Foto Sekarang
                  <input ref={posPhotoRef} type="file" accept="image/*" capture="environment" onChange={handlePosPhoto} style={{ display: "none" }} />
                </label>
              ) : (
                <div className={styles.photoPreviewWrap}>
                  <img src={posPhoto} alt="bukti" className={styles.photoPreviewImg} />
                  <button
                    onClick={() => { setPosPhoto(null); if (posPhotoRef.current) posPhotoRef.current.value = ""; }}
                    className={styles.photoChangeBtn}
                  >
                    🔄 Ganti
                  </button>
                  <div className={styles.photoReadyBadge}>✓ Foto siap</div>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <Btn onClick={doAssignFromQR} color="var(--accent)" size="lg" full>
                {IC({ n: "ok", s: 14 })} Konfirmasi Penempatan
              </Btn>
              <Btn onClick={() => { setPosConfirmQR(null); setPosPhoto(null); }} color="var(--tx-muted)" variant="outline">Batal</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Rolling via scan QR (pos penuh) ── */}
      <Modal open={!!posRollingConfirm} onClose={() => setPosRollingConfirm(null)} title="Tukar Posisi?">
        {posRollingConfirm && (
          <div>
            <div className={styles.rollingScanInfoBox}>
              <div className={styles.rollingScanLabel}>Pos ini sudah terisi. Tukar posisi?</div>
              <div className={styles.rollingScanPair}>
                <div className={styles.rollingScanPerson}>
                  <div className={styles.rollingScanName}>{posRollingConfirm.myName}</div>
                  <div className={styles.rollingScanPos}>{posRollingConfirm.myCurrentPos}</div>
                </div>
                <div className={styles.rollingScanArrow}>⇄</div>
                <div className={styles.rollingScanPerson}>
                  <div className={styles.rollingScanName}>{posRollingConfirm.targetName}</div>
                  <div className={styles.rollingScanPos}>{posRollingConfirm.pos}</div>
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <Btn onClick={doRollingFromScan} color="var(--accent)" size="lg" full>
                {IC({ n: "rot", s: 14 })} Ya, Tukar Posisi
              </Btn>
              <Btn onClick={() => setPosRollingConfirm(null)} color="var(--tx-muted)" variant="outline">Batal</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Assign manual (admin) ── */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={`Tempatkan ke ${confirm == null ? undefined : confirm.pos}`}>
        {confirm && (
          <div>
            <div
              className={styles.assignTargetBox}
              style={{ background: POS_COL[confirm.pos] + "14", border: `1.5px solid ${POS_COL[confirm.pos]}30` }}
            >
              <div className={styles.assignTargetLabel}>Pos Tujuan</div>
              <div className={styles.assignTargetPos} style={{ color: POS_COL[confirm.pos] }}>{confirm.pos}</div>
              <div className={styles.assignTargetMeta}>
                Kapasitas: {POS_CAP[confirm.pos]} · Terisi: {(posAssign[confirm.pos] || []).length}
              </div>
            </div>
            {isAdmin ? (
              <Inp label="Pilih Anggota" value={selectedMember} onChange={e => setSelectedMember(e.target.value)} as="select">
                <option value="">— Pilih Anggota —</option>
                {members.filter(m => !allAssigned.includes(m)).map(m => <option key={m}>{m}</option>)}
              </Inp>
            ) : (
              <div className={styles.assignSelfBox}>
                <span className={styles.assignSelfEmoji}>👤</span>
                <div>
                  <div className={styles.assignSelfLabel}>Ditempatkan sebagai</div>
                  <div className={styles.assignSelfName}>{currentUser == null ? undefined : currentUser.name}</div>
                </div>
              </div>
            )}
            <div className={styles.modalActions}>
              <Btn onClick={doAssign} color={POS_COL[confirm.pos]} size="lg" full>
                {IC({ n: "ok", s: 14 })} Tempatkan
              </Btn>
              <Btn onClick={() => setConfirm(null)} color="var(--tx-muted)" variant="outline">Batal</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Verifikasi Pilih Pos Manual ── */}
      <ManualVerifyModal
        open={!!manualVerify}
        onClose={() => setManualVerify(null)}
        targetPos={(manualVerify == null ? undefined : manualVerify.pos) || ""}
        userName={(currentUser == null ? undefined : currentUser.name) || "—"}
        rolling={!!(manualVerify == null ? undefined : manualVerify.rolling)}
        targetName={(manualVerify == null ? undefined : manualVerify.targetName) || ""}
        myCurrentPos={(manualVerify == null ? undefined : manualVerify.myCurrentPos) || ""}
        onVerified={(logEntry) => {
          const { pos, rolling, targetName, myCurrentPos } = manualVerify;
          const myName = (currentUser == null ? undefined : currentUser.name);
          if (rolling) {
            // Tukar posisi: myName <-> targetName (pos tujuan penuh)
            const upd = { ...posAssign };
            upd[pos]          = [...(upd[pos]          || []).filter(x => x !== targetName), myName];
            upd[myCurrentPos] = [...(upd[myCurrentPos] || []).filter(x => x !== myName), targetName];
            setPosAssign(posShiftKey, upd);
            const log = { id: Date.now(), ts: Date.now(), member: `${myName} ⇄ ${targetName}`, fromPos: myCurrentPos, toPos: pos };
            setPosRollingLog([...(posRollingLog || []), log]);
            setManualVerify(null);
            setManualLog(getManualLog());
            toast(`📋↺ ${myName} → ${pos} · ${targetName} → ${myCurrentPos} [MANUAL — tercatat]`);
            return;
          }
          const upd = { ...posAssign };
          POS_LIST.forEach(p2 => { if (upd[p2]) upd[p2] = upd[p2].filter(m => m !== myName); });
          const cap = POS_CAP[pos] || 1;
          if ((upd[pos] || []).length >= cap) { toast(`${pos} sudah penuh!`, false); setManualVerify(null); return; }
          upd[pos] = [...(upd[pos] || []), myName];
          setPosAssign(posShiftKey, upd);
          setManualVerify(null);
          setManualLog(getManualLog());
          toast(`📋 ${myName} → ${pos} [MANUAL — tercatat]`);
        }}
      />

      {/* ── Audit Log Penempatan Manual (hanya admin) ── */}
      {isAdmin && manualLog.length > 0 && (
        <div className={styles.auditBox}>
          <div className={styles.auditTitle}>
            🔍 Audit Log Penempatan Manual ({manualLog.filter(l => new Date(l.ts).toDateString() === new Date().toDateString()).length} hari ini / {manualLog.length} total)
          </div>
          {[...manualLog].reverse().slice(0, 20).map((l, i) => (
            <div key={i} className={styles.auditRow}>
              <div className={styles.auditRowHeader}>
                <span
                  className={styles.auditRowMethod}
                  style={{ color: l.method === "MANUAL_GAGAL_LOCKOUT" ? "var(--red)" : "var(--tx-secondary)" }}
                >
                  {l.method === "MANUAL_GAGAL_LOCKOUT" ? "🔒 LOCKOUT" : "📋 MANUAL"} — {l.user} → {l.pos}
                </span>
                <span className={styles.auditRowTime}>
                  {new Date(l.ts).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                </span>
              </div>
              <div className={styles.auditRowReason}>
                Alasan: {l.alasan || "—"}{l.keterangan ? ` — ${l.keterangan}` : ""}
              </div>
              {l.foto ? (
                <img
                  src={l.foto}
                  alt="bukti"
                  className={styles.auditRowPhoto}
                  onClick={() => window.open(l.foto, "_blank")}
                  title="Tap untuk lihat foto penuh"
                />
              ) : (
                l.method !== "MANUAL_GAGAL_LOCKOUT" && <div className={styles.auditRowNoPhoto}>⚠️ Tidak ada foto bukti</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: QR Pos (admin) ── */}
      {isAdmin && (
        <Modal open={!!viewPosQR} onClose={() => setViewPosQR(null)} title={`QR Pos: ${viewPosQR}`}>
          {viewPosQR && (
            <div className={styles.qrViewBox}>
              <div className={styles.qrViewCard} style={{ border: `2px solid ${POS_COL[viewPosQR]}` }}>
                <QRSvg value={encPosQR(viewPosQR)} size={190} />
                <div className={styles.qrViewCardLabel}>{viewPosQR}</div>
                <div className={styles.qrViewCardSub}>BBPKA II Jatinangor — Scan untuk penempatan</div>
              </div>
              <div className={styles.qrViewHint}>Screenshot &amp; cetak, tempel di {viewPosQR}</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
