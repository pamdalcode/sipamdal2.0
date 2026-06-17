// TabDash.jsx — SIPAMDAL
// Sesi 3: Tab Dashboard — migrasi dari tab-dash.js
// Menggunakan JSX + CSS Modules + Zustand (via props)

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

import {
  ANGGOTA_DATA,
  REGU,
  POS_LIST,
  JADWAL_START,
  cRgba,
  toLocalKey,
} from "../utils/utils.js";

import {
  IC,
  Modal,
  PosQRHero,
  useOnlineStatus,
} from "../components/ui/UiComponents.jsx";

import { IncTab }      from "./TabInsiden.jsx";
import { PkgTab }      from "./TabPaket.jsx";
import { GuestTab }    from "./TabGuest.jsx";
import { PesertaTab }  from "./TabPeserta.jsx";
import { QRPatrolTab } from "../engine/QrEngine.jsx";
import { useAppStore } from "../stores/useAppStore.js";

import styles from "./TabDash.module.css";

/* ─────────────────────────────────────────────
   Sub-komponen: NotifCarousel
   (dipisah agar hooks tidak bersarang di IIFE)
───────────────────────────────────────────── */
function NotifCarousel({
  notifSlides,
  setInboxOpen,
}) {
  const total = notifSlides.length;
  const [idx, setIdx]         = useState(0);
  const [animDir, setAnimDir] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const timerRef    = useRef(null);
  const pausedRef   = useRef(false);
  const touchStartRef = useRef(null);

  const goTo = useCallback((next, dir) => {
    setAnimDir(dir);
    setAnimKey(k => k + 1);
    setIdx(((next % total) + total) % total);
  }, [total]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setIdx(s => { setAnimDir(1); setAnimKey(k => k + 1); return (s + 1) % total; });
    }, 4000);
  }, [total]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const onTouchStart = (e) => { touchStartRef.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (touchStartRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(dx) < 10) return;
    pausedRef.current = true;
    goTo(dx < 0 ? idx + 1 : idx - 1, dx < 0 ? 1 : -1);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => { pausedRef.current = false; startTimer(); }, 8000);
  };

  const slide = notifSlides[idx] || notifSlides[0];

  const borderColor = slide.type === "ok"
    ? "rgba(22,163,74,.22)"
    : slide.type === "warn"
      ? "rgba(201,27,42,.22)"
      : "rgba(14,165,233,.20)";

  return (
    <div
      className={styles.heroCard}
      style={{ border: `1.5px solid ${borderColor}` }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        @keyframes ncSlideInR { from { opacity:0; transform:translateX(32px) } to { opacity:1; transform:translateX(0) } }
        @keyframes ncSlideInL { from { opacity:0; transform:translateX(-32px) } to { opacity:1; transform:translateX(0) } }
        @keyframes ncBar      { from { width:0% } to { width:100% } }
        .nc-slide-r { animation: ncSlideInR .32s cubic-bezier(.22,1,.36,1) both }
        .nc-slide-l { animation: ncSlideInL .32s cubic-bezier(.22,1,.36,1) both }
      `}</style>

      {/* Header: label + dots */}
      <div className={styles.heroHeader}>
        <div className={styles.heroHeaderLeft}>
          <span style={{ fontSize: 12 }}>{slide.icon}</span>
          <span className={styles.heroLabel}>Notifikasi</span>
          {slide.type !== "ok" && (
            <span
              className={styles.heroTag}
              style={{ background: slide.tagBg, color: slide.tagColor }}
            >
              {slide.tag}
            </span>
          )}
        </div>
        {/* Dot indicators */}
        <div className={styles.heroDots}>
          {notifSlides.map((_, i) => (
            <span
              key={i}
              onClick={() => {
                pausedRef.current = true;
                goTo(i, i > idx ? 1 : -1);
                setTimeout(() => { pausedRef.current = false; startTimer(); }, 8000);
              }}
              style={{
                width: i === idx ? 16 : 6,
                height: 6,
                borderRadius: 99,
                background: i === idx ? "var(--accent)" : "rgba(14,165,233,0.25)",
                transition: "width .3s, background .3s",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Slide content */}
      <div
        key={animKey}
        className={`${animDir >= 0 ? "nc-slide-r" : "nc-slide-l"} ${styles.slideContent}`}
        onClick={slide.action ? () => slide.action() : undefined}
        style={{
          background: slide.accent,
          borderBottom: `1.5px solid ${slide.border}`,
          cursor: slide.action ? "pointer" : "default",
        }}
      >
        <div className={styles.slideTitle}>{slide.title || "—"}</div>
        {slide.body && (
          <div className={styles.slideBody}>{slide.body}</div>
        )}
        {slide.action && (
          <div className={styles.slideAction}>Ketuk untuk detail →</div>
        )}
      </div>

      {/* Progress bar */}
      <div className={styles.progressTrack}>
        <div
          key={`bar-${animKey}`}
          className={styles.progressBar}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Sub-komponen: InboxModal
───────────────────────────────────────────── */
function InboxModal({ onClose, instruksi, broadcast, currentUser }) {
  const [ibTab, setIbTab] = useState("instruksi");

  const allInstruksi = [...(instruksi || [])].reverse();
  const hasBc        = broadcast && broadcast.aktif;

  const regu = currentUser?.regu;
  const instruksiFilerRegu = allInstruksi.filter(
    i => i.targetRegu === "Semua" || String(i.targetRegu) === String(regu)
  );
  const activeInstruksi = instruksiFilerRegu.filter(i => i.aktif && !i.selesai);

  const tabBtn = (id, label, badge) => (
    <button
      key={id}
      onClick={() => setIbTab(id)}
      className={styles.ibTabBtn}
      style={{
        color: ibTab === id ? "var(--accent)" : "var(--tx-secondary)",
        borderBottom: ibTab === id ? "2.5px solid var(--accent)" : "2.5px solid transparent",
      }}
    >
      {label}
      {badge > 0 && <span className={styles.ibBadge}>{badge}</span>}
    </button>
  );

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.centerModal}>
        <div className={styles.accentStripe} />
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}> Kotak Masuk</div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        {/* Tabs */}
        <div className={styles.ibTabBar}>
          {tabBtn("instruksi", " Instruksi", activeInstruksi.length)}
          {tabBtn("broadcast", " Broadcast", hasBc ? 1 : 0)}
        </div>
        {/* Content */}
        <div className={styles.ibScrollArea}>
          {ibTab === "instruksi" && (
            instruksiFilerRegu.length === 0
              ? (
                <div className={styles.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                  <div style={{ fontSize: 12 }}>Tidak ada instruksi</div>
                </div>
              )
              : (
                <div className={styles.instruksiList}>
                  {instruksiFilerRegu.map((ins, i) => {
                    const isActive = ins.aktif && !ins.selesai;
                    const pCol = ins.prioritas === "Penting"
                      ? "var(--red)"
                      : ins.prioritas === "Sedang"
                        ? "var(--amber)"
                        : "var(--accent)";
                    return (
                      <div
                        key={i}
                        className={styles.instruksiCard}
                        style={{
                          background: isActive ? "rgba(14,165,233,0.06)" : "rgba(0,0,0,0.03)",
                          border: `1.5px solid ${isActive ? "rgba(14,165,233,0.25)" : "rgba(0,0,0,0.08)"}`,
                          opacity: ins.selesai ? 0.55 : 1,
                        }}
                      >
                        <div className={styles.instruksiRow}>
                          <div className={styles.instruksiJudul}>{ins.judul || "Instruksi"}</div>
                          {ins.prioritas && (
                            <span
                              className={styles.prioritasBadge}
                              style={{ color: pCol, border: `1px solid ${pCol}` }}
                            >
                              {ins.prioritas}
                            </span>
                          )}
                          {ins.selesai && (
                            <span className={styles.selesaiBadge}>Selesai</span>
                          )}
                        </div>
                        <div className={styles.instruksiIsi}>{ins.isi || ""}</div>
                        <div className={styles.instruksiMeta}>
                          {ins.targetRegu && <span> {ins.targetRegu}</span>}
                          {ins.ts && (
                            <span>
                              {" "}
                              {new Date(ins.ts).toLocaleString("id-ID", {
                                day: "numeric", month: "short",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
          )}

          {ibTab === "broadcast" && (
            !hasBc
              ? (
                <div className={styles.emptyState}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                  <div style={{ fontSize: 12 }}>Tidak ada broadcast aktif</div>
                </div>
              )
              : (
                <div className={styles.broadcastCard}>
                  <div className={styles.broadcastHeader}>
                    <span style={{ fontSize: 24 }}></span>
                    <div>
                      <div className={styles.broadcastTitle}>BROADCAST PIMPINAN</div>
                      {broadcast.ts && (
                        <div className={styles.broadcastTs}>
                          {new Date(broadcast.ts).toLocaleString("id-ID", {
                            day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.broadcastPesan}>{broadcast.pesan || ""}</div>
                  {broadcast.pengirim && (
                    <div className={styles.broadcastPengirim}>— {broadcast.pengirim}</div>
                  )}
                </div>
              )
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─────────────────────────────────────────────
   Sub-komponen: LaporanModal
───────────────────────────────────────────── */
function LaporanModal({
  onClose, now, patrols, posAssign, incidents, packages,
  guests, keluarData, mutations, standJaga,
}) {
  const [kondisiUmum,    setKondisiUmum]    = useState("Aman");
  const [catatanLaporan, setCatatanLaporan] = useState("");
  const [copied,         setCopied]         = useState(false);

  const todayKey = toLocalKey(now);

  const generateLaporan = () => {
    const tgl = now.toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    const urut = [3, 1, 2];
    const d  = new Date();
    const sh = new Date(d.getTime() - 7 * 3600000);
    const ld = new Date(sh.getFullYear(), sh.getMonth(), sh.getDate());
    const ls = new Date(JADWAL_START.getFullYear(), JADWAL_START.getMonth(), JADWAL_START.getDate());
    const diff = Math.round((ld - ls) / 86400000);
    const idx  = ((diff % 3) + 3) % 3;
    const piketRegu = urut[idx];

    const liburHariIni = (() => {
      try {
        const s = localStorage.getItem("pamdal_jadwal_libur");
        const m = s ? JSON.parse(s) : {};
        return (m[todayKey] || []).map(id => {
          const a = ANGGOTA_DATA.items.find(x => x.id === id);
          return a ? a.nama : null;
        }).filter(Boolean);
      } catch { return []; }
    })();

    const posLines = POS_LIST.map(p => {
      const occ = posAssign[p] || [];
      return `   • ${p}: ${occ.length > 0 ? occ.join(", ") : "KOSONG"}`;
    }).join("\n");

    const todayPatrols = patrols.filter(p => new Date(p.ts).toDateString() === now.toDateString());
    const patrolLines  = todayPatrols.length === 0
      ? "   Belum ada patroli hari ini"
      : [...todayPatrols].sort((a, b) => b.ts - a.ts).slice(0, 10)
          .map(p => {
            const t = new Date(p.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
            return `   ${t} — ${(p.areas || []).join(", ")} (${p.officer || "-"})`;
          }).join("\n");

    const activeInc  = incidents.filter(i => i.status !== "Selesai" && i.category !== "Infrastruktur");
    const infraInc   = incidents.filter(i => i.status !== "Selesai" && i.category === "Infrastruktur");
    const pendingPkg = (packages || []).filter(p => p.status === "Belum Diambil");
    const stayGuest  = (guests || []).filter(g => g.status === "Masih Ada");
    const pesertaDiLuar = (keluarData || []).filter(k => !k.kembali);

    const totalAnggota  = (REGU[piketRegu] || []).length - liburHariIni.length;
    const posiBertugas  = POS_LIST.filter(p => (posAssign[p] || []).length > 0).length;

    const incLines   = activeInc.length === 0
      ? "   Tidak ada insiden aktif"
      : activeInc.map(i => `   [${i.category || ""}] ${i.title} — ${i.officer || "-"}`).join("\n");
    const infraLines = infraInc.length === 0
      ? "   Tidak ada laporan kerusakan fasilitas"
      : infraInc.map(i => `   ⚙️ ${i.title}${i.officer ? " — " + i.officer : ""}`).join("\n");
    const pkgLines   = pendingPkg.length === 0
      ? "   Tidak ada paket yang menunggu diambil"
      : pendingPkg.slice(0, 5).map(p => `   ${p.name || p.penerima || "-"} (${p.penerima || "-"})`).join("\n");
    const guestLines = stayGuest.length === 0
      ? "   Tidak ada tamu yang masih berada di lokasi"
      : stayGuest.slice(0, 5).map(g => `   ${g.name || g.nama || "-"} — ${g.keperluan || "-"}`).join("\n");

    const pesertaLine = (keluarData || []).length === 0
      ? "   Belum ada data peserta hari ini"
      : pesertaDiLuar.length === 0
        ? "   Semua peserta di asrama"
        : `   ${pesertaDiLuar.length} peserta sedang keluar: ${pesertaDiLuar.map(k => k.nama).join(", ")}`;

    const kondisiIcon = kondisiUmum === "Darurat" ? "🚨" : kondisiUmum === "Waspada" ? "⚠️" : "✅";
    const catatanBlock = catatanLaporan.trim()
      ? ["", " CATATAN TAMBAHAN", `   ${catatanLaporan.trim().replace(/\n/g, "\n   ")}`]
      : [];

    return [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      " LAPORAN HARIAN SIPAMDAL",
      "BBPKA II JATINANGOR",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      ` ${tgl}`,
      `⏰ Dibuat: ${jam} WIB`,
      `${kondisiIcon} KONDISI: ${kondisiUmum} — Situasi Kondusif`,
      ` Regu Piket: Regu ${piketRegu} (${totalAnggota} anggota aktif)`,
      liburHariIni.length > 0 ? ` Libur: ${liburHariIni.join(", ")}` : "",
      "",
      " STATUS POS",
      `   (${posiBertugas}/${POS_LIST.length} pos bertugas)`,
      posLines,
      "",
      "👥 PESERTA ASRAMA",
      pesertaLine,
      "",
      ` PATROLI (${todayPatrols.length} putaran)`,
      patrolLines,
      "",
      ` INSIDEN AKTIF (${activeInc.length})`,
      incLines,
      "",
      `🔧 KERUSAKAN FASILITAS (${infraInc.length})`,
      infraLines,
      "",
      ` PAKET PENDING (${pendingPkg.length})`,
      pkgLines,
      "",
      ` TAMU MASIH ADA (${stayGuest.length})`,
      guestLines,
      ...catatanBlock,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "Generated by SIPAMDAL App",
    ].filter(x => x !== null).join("\n");
  };

  const teks = generateLaporan();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(teks);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Tekan lama lalu Salin.");
    }
  };

  const handlePrint = () => {
    const tgl = now.toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Laporan Harian SIPAMDAL</title>
<style>body{font-family:monospace;font-size:13px;color:#1F2937;background:#fff;padding:32px;max-width:600px;margin:0 auto;line-height:1.75;}
h2{font-family:sans-serif;font-size:18px;font-weight:800;color:#1A8FE3;margin:0 0 4px;}
.sub{font-family:sans-serif;font-size:11px;color:#6B7280;margin-bottom:20px;}
pre{white-space:pre-wrap;word-break:break-word;background:#F9FAFB;border:1px solid #e5e7eb;border-radius:10px;padding:16px;}
.footer{font-family:sans-serif;font-size:10px;color:#9CA3AF;margin-top:20px;text-align:center;}
@media print{body{padding:16px;}}</style></head>
<body><h2> Laporan Harian SIPAMDAL</h2>
<div class="sub">BBPKA II Jatinangor — ${tgl}</div>
<pre>${teks.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
<div class="footer">Generated by SIPAMDAL App</div>
<script>window.onload=()=>{window.print();}<\/script></body></html>`;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, "_blank");
    if (!w) alert("Izinkan popup untuk membuka PDF.");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.centerModal} onClick={e => e.stopPropagation()}>
        <div className={styles.accentStripe} />
        {/* Header */}
        <div className={styles.laporanHeader}>
          <div>
            <div className={styles.modalTitle}> Laporan Harian</div>
            <div className={styles.laporanSub}>
              {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <button
            className={styles.closeIconBtn}
            onClick={onClose}
          >
            {IC({ n: "x", s: 18, c: "var(--accent)" })}
          </button>
        </div>

        {/* Body */}
        <div className={styles.laporanBody}>
          {/* Kondisi Umum */}
          <div className={styles.kondisiBox}>
            <div className={styles.kondisiLabel}>KONDISI UMUM SITUASI</div>
            <div className={styles.kondisiBtns}>
              {[["Aman", "#16A34A", "#F0FDF4"], ["Waspada", "#D97706", "#FFFBEB"], ["Darurat", "#DC2626", "#FEF2F2"]].map(([k, c, bg]) => (
                <button
                  key={k}
                  onClick={() => setKondisiUmum(k)}
                  className={styles.kondisiBtn}
                  style={{
                    border: `1.5px solid ${kondisiUmum === k ? c : "#e5e7eb"}`,
                    background: kondisiUmum === k ? bg : "#fff",
                    color: kondisiUmum === k ? c : "#9CA3AF",
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div className={styles.catatanBox}>
            <div className={styles.kondisiLabel}>CATATAN TAMBAHAN (opsional)</div>
            <textarea
              value={catatanLaporan}
              onChange={e => setCatatanLaporan(e.target.value)}
              placeholder="Contoh: Jaringan internet pos mati sejak 2 hari lalu. Proyek gedung berjalan normal."
              rows={3}
              className={styles.catatanTextarea}
            />
          </div>

          {/* Preview teks */}
          <div className={styles.laporanPreview}>{teks}</div>
        </div>

        {/* Actions */}
        <div className={styles.laporanActions}>
          <button onClick={handleCopy} className={styles.laporanBtnCopy}>
            <span>{copied ? "" : ""}</span>
            {copied ? "Tersalin!" : "Salin Teks"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(teks)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.laporanBtnWA}
          >
            <span></span> Kirim WA
          </a>
          <button onClick={handlePrint} className={styles.laporanBtnPrint}>
            <span></span> Kirim PDF
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─────────────────────────────────────────────
   Sub-komponen: StatusGrid (6 card keamanan)
───────────────────────────────────────────── */
function StatusGrid({ cards, activeCard, setActiveCard, todP, PATROL_TARGET }) {
  const gridCards = [
    cards[1],
    { l: "Patroli", v: todP, col: "var(--accent)", icon: "patrol", t: "patrol", emoji: "", isPatrol: true },
    cards[3],
    cards[4],
    cards[0],
    cards[2],
  ];

  return (
    <div className={styles.statusGrid}>
      {gridCards.map(c => {
        const isAlert  = c.v > 0;
        const isActive = activeCard === c.t;
        const col      = isAlert || isActive ? c.col : "var(--tx-muted)";

        return (
          <div
            key={c.l}
            onClick={() => c.t && setActiveCard(activeCard === c.t ? null : c.t)}
            className={styles.statusCell}
            style={{
              cursor: c.t ? "pointer" : "default",
              background: isActive ? `${c.col}10` : "rgba(248,250,252,1)",
              border: `1.5px solid ${isActive ? c.col + "40" : "rgba(0,0,0,.06)"}`,
            }}
          >
            <div className={styles.statusIconWrap}>
              {c.isPatrol
                ? (() => {
                    const pct     = Math.min(todP / PATROL_TARGET, 1);
                    const r       = 22;
                    const circ    = 2 * Math.PI * r;
                    const dash    = circ * pct;
                    const ringCol = pct >= 0.67 ? c.col : pct >= 0.34 ? "var(--amber)" : "var(--red)";
                    return (
                      <div style={{ position: "relative", width: 52, height: 52 }}>
                        <svg
                          width={52} height={52}
                          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
                        >
                          <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth={4} />
                          <circle
                            cx={26} cy={26} r={r} fill="none"
                            stroke={ringCol} strokeWidth={4}
                            strokeDasharray={`${dash} ${circ}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className={styles.patrolCount} style={{ color: ringCol }}>
                          {todP}
                        </div>
                      </div>
                    );
                  })()
                : (
                  <div
                    className={styles.statusCircle}
                    style={{
                      background: isAlert || isActive ? `${c.col}15` : "rgba(14,165,233,.07)",
                      border: `3px solid ${isAlert || isActive ? c.col : "rgba(14,165,233,.25)"}`,
                      boxShadow: isAlert || isActive
                        ? `0 0 0 3px ${c.col}18, 0 4px 14px ${c.col}28`
                        : "none",
                    }}
                  >
                    <span style={{
                      fontSize: c.v >= 100 ? 12 : 17,
                      fontWeight: 900,
                      color: isAlert || isActive ? c.col : "var(--accent)",
                      lineHeight: 1,
                    }}>
                      {c.v}
                    </span>
                  </div>
                )
              }
            </div>
            <span
              className={styles.statusLabel}
              style={{ color: isAlert || isActive ? c.col : "var(--tx-muted)" }}
            >
              {c.isPatrol ? `Patroli /${PATROL_TARGET}` : c.l}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Komponen utama: DashTab
───────────────────────────────────────────── */
export function DashTab({
  now, reguHari, posAssign, setPosAssign, posShiftKey,
  incidents, setIncidents, packages, setPackages,
  guests, setGuests, patrols, setPatrols,
  standJaga, mutations, posRollingLog,
  instruksi, currentUser, setTab, canEdit, isAdmin,
  keluarData,
  toast, broadcast, onLogout,
  pushNotif, isUserLibur,
}) {
  const netOnline = useOnlineStatus();

  const [activeCard,   setActiveCard]   = useState(null);
  const [inboxOpen,    setInboxOpen]    = useState(false);
  const [laporanOpen,  setLaporanOpen]  = useState(false);

  /* Sinkronisasi modal dengan popstate Android */
  useEffect(() => {
    useAppStore.getState().setAnyModalOpen(inboxOpen || laporanOpen || !!activeCard);
    if (inboxOpen || laporanOpen) window.history.pushState({ modal: true }, "");
  }, [inboxOpen, laporanOpen, activeCard]);

  useEffect(() => {
    const handler = () => {
      setInboxOpen(false);
      setLaporanOpen(false);
      setActiveCard(null);
    };
    window.addEventListener("sipamdal_close_modals", handler);
    return () => window.removeEventListener("sipamdal_close_modals", handler);
  }, []);

  /* Warna accent regu */
  const myRegu = currentUser?.regu;
  useEffect(() => {
    if (!currentUser || isAdmin) return;
    const urut  = [3, 1, 2];
    const d     = new Date();
    const sh    = new Date(d.getTime() - 7 * 3600000);
    const ld    = new Date(sh.getFullYear(), sh.getMonth(), sh.getDate());
    const ls    = new Date(JADWAL_START.getFullYear(), JADWAL_START.getMonth(), JADWAL_START.getDate());
    const diff  = Math.round((ld - ls) / 86400000);
    const idx   = ((diff % 3) + 3) % 3;
    const RCOL  = {
      [urut[idx]]:           "var(--accent)",
      [urut[(idx + 1) % 3]]: "var(--amber)",
      [urut[(idx + 2) % 3]]: "var(--red)",
    };
    const col  = RCOL[currentUser.regu] || "var(--accent)";
    const root = document.documentElement;
    root.style.setProperty("--regu-col",       col);
    root.style.setProperty("--regu-col-light", cRgba(col, 0.60));
    root.style.setProperty("--regu-col-dim",   cRgba(col, 0.20));
    root.style.setProperty("--regu-col-tint",  cRgba(col, 0.10));
    root.style.setProperty("--regu-col-glow",  cRgba(col, 0.33));
  }, [myRegu]);

  /* ── Computed values ── */
  const todayKey      = toLocalKey(now);
  const pending       = packages.filter(p => p.status === "Belum Diambil").length;
  const staying       = guests.filter(g => g.status === "Masih Ada").length;
  const todP          = patrols.filter(p => new Date(p.ts).toDateString() === now.toDateString()).length;
  const actI          = incidents.filter(i => i.status !== "Selesai").length;
  const emptyPos      = POS_LIST.filter(p => !posAssign[p]?.length);
  const posKosong     = emptyPos.length > 0;
  const keluarDiLuar  = (keluarData || []).filter(k => !k.kembali).length;
  const PATROL_TARGET = 12;

  const lastPatrol   = patrols
    .filter(p => new Date(p.ts).toDateString() === now.toDateString())
    .sort((a, b) => b.ts - a.ts)[0];
  const msSincePatrol  = lastPatrol ? now - lastPatrol.ts : Infinity;
  const patrolOverdue  = msSincePatrol > 3600000;

  const lastRolling  = (posRollingLog || [])
    .filter(r => new Date(r.ts).toDateString() === now.toDateString())
    .sort((a, b) => b.ts - a.ts)[0];
  const msSinceRolling = lastRolling ? now - lastRolling.ts : Infinity;
  const rollingOverdue = msSinceRolling > 7200000;

  const todayMut = mutations.filter(m => new Date(m.ts).toDateString() === now.toDateString());
  const noMutasi = todayMut.length === 0;

  const cards = [
    { l: "Insiden Aktif",   v: actI,           col: actI > 0 ? "var(--red)" : "var(--accent)",   icon: "alert",  t: "incident", emoji: "" },
    { l: "Pos Kosong",      v: emptyPos.length, col: posKosong ? "var(--amber)" : "var(--accent)", icon: "shield", t: "pos",      emoji: "" },
    { l: "Paket Menunggu",  v: pending,         col: "var(--amber)",                               icon: "pkg",    t: "package",  emoji: "" },
    { l: "Tamu Menginap",   v: staying,         col: "var(--violet)",                              icon: "ppl",    t: "guest",    emoji: "" },
    { l: "Peserta Keluar",  v: keluarDiLuar,    col: "var(--tx-muted)",                            icon: "ppl",    t: "keluar",   emoji: "" },
  ];

  /* ── Card modal contents ── */
  const CARD_CONTENTS = {
    incident: () => <IncTab incidents={incidents} setIncidents={setIncidents} posAssign={posAssign} toast={toast} canEdit={canEdit} />,
    pos:      () => <PosQRHero posAssign={posAssign} setPosAssign={setPosAssign} posShiftKey={posShiftKey} currentUser={currentUser} toast={toast} canEdit={canEdit} isUserLibur={isUserLibur} />,
    package:  () => <PkgTab packages={packages} setPackages={setPackages} toast={toast} canEdit={canEdit} />,
    guest:    () => <GuestTab guests={guests} setGuests={setGuests} toast={toast} canEdit={canEdit} />,
    keluar:   () => <PesertaTab canEdit={canEdit} isAdmin={isAdmin} />,
    patrol:   () => <QRPatrolTab patrols={patrols} setPatrols={setPatrols} posAssign={posAssign} toast={toast} currentUser={currentUser} canEdit={canEdit} reguHari={reguHari} isUserLibur={isUserLibur} />,
  };
  const CARD_TITLES = {
    incident: " Insiden", pos: " Status Pos", package: " Paket",
    guest: " Tamu", keluar: " Peserta Keluar", patrol: " Patroli",
  };

  /* ── Notif slides untuk carousel ── */
  const instruksiAktif = (instruksi || []).filter(
    i => i.aktif && !i.selesai &&
    (i.targetRegu === "Semua" || String(i.targetRegu) === String(myRegu))
  );
  const hasBroadcast  = broadcast && broadcast.aktif;
  const totalAlert    = (actI > 0 ? 1 : 0) + (posKosong ? 1 : 0) + (patrolOverdue ? 1 : 0) + (noMutasi ? 1 : 0);

  const notifSlides = [];
  notifSlides.push({
    id: "ringkasan",
    type:  totalAlert === 0 ? "ok" : "warn",
    icon:  totalAlert === 0 ? "" : "",
    title: totalAlert === 0 ? "Semua Kondisi Normal" : `${totalAlert} Peringatan Aktif`,
    body:  totalAlert === 0
      ? "Tidak ada peringatan saat ini. Semua pos, patroli, dan mutasi berjalan normal."
      : [
          actI > 0       ? ` ${actI} insiden aktif`     : null,
          posKosong      ? ` ${emptyPos.length} pos kosong` : null,
          patrolOverdue  ? " Patroli terlambat"           : null,
          noMutasi       ? " Buku mutasi belum dicatat"   : null,
        ].filter(Boolean).join("  •  "),
    tag:      totalAlert === 0 ? "KEAMANAN" : "KEAMANAN",
    tagColor: totalAlert === 0 ? "var(--accent)" : "var(--red)",
    tagBg:    totalAlert === 0 ? "rgba(4,120,87,0.15)" : "rgba(201,27,42,0.15)",
    accent:   totalAlert === 0 ? "rgba(4,120,87,0.25)"  : "rgba(201,27,42,0.20)",
    border:   totalAlert === 0 ? "rgba(4,120,87,0.30)"  : "rgba(201,27,42,0.28)",
    action: null,
  });

  instruksiAktif.slice(0, 5).forEach((ins, i) => {
    const pCol = ins.prioritas === "Penting" ? "var(--red)" : ins.prioritas === "Sedang" ? "var(--amber)" : "var(--accent)";
    const pBg  = ins.prioritas === "Penting" ? "rgba(201,27,42,0.15)" : ins.prioritas === "Sedang" ? "rgba(245,158,11,.15)" : "rgba(4,120,87,0.12)";
    notifSlides.push({
      id: `ins-${i}`,
      type: "instruksi", icon: "",
      title: ins.judul || "Instruksi Baru",
      body:  (ins.isi || "—").slice(0, 120) + ((ins.isi || "").length > 120 ? "…" : ""),
      tag: ins.prioritas || "INSTRUKSI",
      tagColor: pCol, tagBg: pBg,
      accent: "rgba(14,165,233,0.18)", border: "rgba(14,165,233,0.28)",
      action: () => setInboxOpen(true),
    });
  });

  if (hasBroadcast) {
    notifSlides.push({
      id: "broadcast", type: "broadcast", icon: "",
      title: (broadcast.pesan || "Broadcast Pimpinan").slice(0, 100) + ((broadcast.pesan || "").length > 100 ? "…" : ""),
      body:  broadcast.pengirim ? `— ${broadcast.pengirim}` : "",
      tag: "BROADCAST", tagColor: "var(--amber)", tagBg: "rgba(245,158,11,.18)",
      accent: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.32)",
      action: () => setInboxOpen(true),
    });
  }

  if (pushNotif?.supported && !pushNotif?.isEnabled) {
    notifSlides.push({
      id: "notif-off", type: "notif", icon: "",
      title: "Notifikasi Belum Aktif",
      body:  "Aktifkan notifikasi push agar tidak ketinggalan instruksi dan broadcast dari pimpinan.",
      tag: "PENGATURAN", tagColor: "var(--accent)", tagBg: "rgba(14,165,233,0.15)",
      accent: "rgba(14,165,233,0.10)", border: "rgba(14,165,233,0.25)",
      action: async () => {
        if (pushNotif) {
          const r = await pushNotif.requestPermission();
          if (r === "granted") toast(" Notifikasi aktif!");
          else if (r === "denied") toast("Notifikasi diblokir oleh browser", false);
        }
      },
    });
  }

  /* ── Header user info ── */
  const _firstName  = (currentUser?.name || "").split(" ")[0];
  const _fullName   = currentUser?.name || "";
  const _initials   = _fullName.split(" ").slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
  const _myPos      = POS_LIST.find(p => (posAssign[p] || []).includes(currentUser?.name));
  const _accentCol  = getComputedStyle(document.documentElement).getPropertyValue("--regu-col").trim() || "var(--accent)";

  return (
    <div style={{ background: "transparent", minHeight: "100vh" }}>

      {/* ── Modals via portals ── */}
      {inboxOpen && (
        <InboxModal
          onClose={() => setInboxOpen(false)}
          instruksi={instruksi}
          broadcast={broadcast}
          currentUser={currentUser}
        />
      )}

      {laporanOpen && (
        <LaporanModal
          onClose={() => setLaporanOpen(false)}
          now={now}
          patrols={patrols}
          posAssign={posAssign}
          incidents={incidents}
          packages={packages}
          guests={guests}
          keluarData={keluarData}
          mutations={mutations}
          standJaga={standJaga}
        />
      )}

      {/* ── Header (hanya untuk non-admin) ── */}
      {!isAdmin && (
        <>
          <div className={styles.headerWrap}>
            {/* Row: Avatar + Nama + Aksi */}
            <div className={styles.headerRow}>
              {/* Avatar */}
              <div
                className={styles.avatar}
                style={{
                  background: `linear-gradient(135deg,${_accentCol} 0%,${_accentCol}cc 100%)`,
                  border: netOnline
                    ? "2.5px solid var(--accent)"
                    : "2.5px solid var(--red)",
                  boxShadow: netOnline
                    ? `0 0 0 3px rgba(14,165,233,.28), 0 4px 12px ${_accentCol}44`
                    : `0 0 0 3px rgba(201,27,42,.20), 0 4px 12px ${_accentCol}44`,
                }}
              >
                <span className={styles.avatarInitials}>{_initials}</span>
              </div>

              {/* Nama + pos */}
              <div className={styles.headerInfo}>
                <div className={styles.headerName}>{_firstName}</div>
                {_myPos && (
                  <div className={styles.headerPos}>
                    <span style={{ fontSize: 10 }}></span>
                    <span style={{ color: "var(--regu-col)" }}>{_myPos.replace("Pos ", "")}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className={styles.headerActions}>
                {/* Laporan */}
                <button
                  onClick={() => canEdit && setLaporanOpen(true)}
                  disabled={!canEdit}
                  title={canEdit ? "Buat Laporan" : "Hanya bisa dilihat — kamu tidak piket hari ini"}
                  className={styles.headerBtn}
                  style={{ cursor: canEdit ? "pointer" : "not-allowed", opacity: canEdit ? 1 : 0.35 }}
                >
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1={22} y1={2} x2={11} y2={13} />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
                {/* Inbox */}
                <button onClick={() => setInboxOpen(true)} className={styles.headerBtn}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
                  </svg>
                </button>
                {/* Profile */}
                <button onClick={() => setTab("profile")} className={styles.headerBtn}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx={12} cy={7} r={4} />
                  </svg>
                </button>
                {/* Logout */}
                <button onClick={() => onLogout && onLogout()} className={styles.headerBtn}>
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1={21} y1={12} x2={9} y2={12} />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Main content area ── */}
          <div className={styles.contentPad}>
            {/* Notification Carousel */}
            <NotifCarousel
              notifSlides={notifSlides}
              setInboxOpen={setInboxOpen}
            />

            {/* Status Keamanan */}
            <div className={styles.statusBox}>
              <div className={styles.statusBoxHeader}>
                <span className={styles.statusBoxTitle}>Status Keamanan</span>
                <span
                  className={styles.statusBadge}
                  style={{
                    color:       emptyPos.length > 0 || actI > 0 ? "var(--red)" : "var(--green)",
                    background:  emptyPos.length > 0 || actI > 0 ? "rgba(201,27,42,.08)" : "rgba(22,163,74,.08)",
                    border: `1px solid ${emptyPos.length > 0 || actI > 0 ? "rgba(201,27,42,.20)" : "rgba(22,163,74,.20)"}`,
                  }}
                >
                  {emptyPos.length > 0 || actI > 0 ? "⚠ Perlu Perhatian" : "✓ Normal"}
                </span>
              </div>

              <StatusGrid
                cards={cards}
                activeCard={activeCard}
                setActiveCard={setActiveCard}
                todP={todP}
                PATROL_TARGET={PATROL_TARGET}
              />
            </div>

            {/* Search shortcut */}
            <button
              onClick={() => setTab && setTab("search")}
              className={styles.searchBox}
            >
              {IC({ n: "search", s: 18, c: "var(--tx-muted)" })}
              <span className={styles.searchPlaceholder}>
                Cari tamu, paket, kendaraan, insiden, mutasi…
              </span>
            </button>
          </div>
        </>
      )}

      {/* ── Modal activeCard ── */}
      {activeCard && CARD_CONTENTS[activeCard] && (
        <Modal
          open
          onClose={() => setActiveCard(null)}
          title={CARD_TITLES[activeCard] || "Detail"}
          wide={false}
          noPad={false}
        >
          {CARD_CONTENTS[activeCard]()}
        </Modal>
      )}
    </div>
  );
}
