// TabPatrol.jsx — SIPAMDAL
// Sesi 5: Konversi tab-patrol.js → JSX
// Props diterima langsung (belum Zustand): posAssign, patrols, setPatrols, toast, canEdit, isAdmin, currentUser

import { useState, useRef } from "react";
import { REGU, PATROL_AREAS, kompressFoto, getReguHari } from "../utils/utils.js";
import { IC, Modal, Inp, Btn, PH, ReadOnlyBanner } from "../components/ui/UiComponents.jsx";

// ── Konstanta ─────────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = ["Jendela", "Pintu", "Lampu", "Barang Inventaris", "Kondisi Umum"];
const CHECKLIST_ICON = {
  "Jendela": "🪟", "Pintu": "🚪", "Lampu": "💡",
  "Barang Inventaris": "📦", "Kondisi Umum": "🏢",
};
const CHECKLIST_STATUS_OPTS = [
  { val: "aman",      label: "Aman",            icon: "✅", color: "var(--accent-2)",  bg: "rgba(var(--orb-rgb),.12)",   border: "rgba(var(--orb-rgb),.70)",  bgActive: "rgba(var(--orb-rgb),.18)",  shadow: "0 0 14px rgba(14,165,233,.30)" },
  { val: "perhatian", label: "Perlu Perhatian", icon: "⚠️", color: "var(--amber)",     bg: "rgba(var(--amber-rgb),.28)", border: "rgba(var(--amber-rgb),.75)", bgActive: "rgba(var(--amber-rgb),.35)", shadow: "0 0 14px rgba(var(--amber-rgb),.45)" },
  { val: "rusak",     label: "Rusak / Mati",    icon: "🔴", color: "var(--red)",       bg: "rgba(201,27,42,.28)",         border: "rgba(201,27,42,.75)",        bgActive: "rgba(201,27,42,.35)",       shadow: "0 0 14px rgba(201,27,42,.45)" },
];
const QUICK_TEMUAN = [
  { label: "Pintu Rusak",            icon: "🚪", severity: "rusak" },
  { label: "Kunci Hilang",           icon: "🔑", severity: "rusak" },
  { label: "Jendela Rusak",          icon: "🪟", severity: "rusak" },
  { label: "Lampu Mati",             icon: "💡", severity: "rusak" },
  { label: "Lampu Redup",            icon: "🔅", severity: "perhatian" },
  { label: "Kebocoran Air",          icon: "💧", severity: "rusak" },
  { label: "Barang Hilang",          icon: "📦", severity: "rusak" },
  { label: "Area Kotor",             icon: "🗑",  severity: "perhatian" },
  { label: "AC Tidak Berfungsi",     icon: "❄️", severity: "perhatian" },
  { label: "Orang Mencurigakan",     icon: "👤", severity: "rusak" },
  { label: "Kendaraan Tak Dikenal",  icon: "🚗", severity: "perhatian" },
  { label: "Situasi Aman",           icon: "✅", severity: "aman" },
];
const POS_RING = {
  "Pos Asrama":      { ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
  "Gedung Utama":    { ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
  "Pos Utama":       { ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
  "Pos Guest House": { ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPos(area) {
  const found = Object.entries(PATROL_AREAS).find(([, areas]) => areas.includes(area));
  return found ? found[0] : undefined;
}

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

const fmtT = (d) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// ── AreaCircle ────────────────────────────────────────────────────────────────

function AreaCircle({ area, pos, last, onTap, canEdit }) {
  const PATROL_GREEN = "var(--accent)";
  const col = POS_RING[pos] || { ring: "var(--accent)", fill: "rgba(var(--orb-rgb),.10)", txt: "var(--accent)", txtLight: "var(--accent-2)" };
  const minsAgo = last ? Math.floor((Date.now() - last.ts) / 60000) : null;
  const fresh   = minsAgo !== null && minsAgo < 60;
  const words = area.split(" ");
  const line1 = words.slice(0, 2).join(" ");
  const line2 = words.slice(2).join(" ");
  const txtColor = fresh ? PATROL_GREEN : col.txtLight;
  const glassOuter = fresh
    ? `0 0 0 3px ${PATROL_GREEN}30, 0 0 16px ${PATROL_GREEN}40, 0 4px 12px rgba(0,0,0,.15)`
    : `0 0 0 2px ${col.ring}66, 0 0 10px ${col.ring}25, 0 2px 8px rgba(0,0,0,.12)`;

  return (
    <button
      onClick={() => canEdit && onTap(area)}
      disabled={!canEdit}
      style={{
        background: "none", border: "none",
        cursor: canEdit ? "pointer" : "default",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        padding: 4, opacity: canEdit ? 1 : 0.5, transition: "opacity .2s",
      }}
    >
      <div style={{
        width: 82, height: 82, borderRadius: "50%",
        border: `2.5px solid ${fresh ? PATROL_GREEN : col.ring}`,
        background: col.fill,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", boxShadow: glassOuter,
        backdropFilter: "blur(4px)", transition: "all .25s cubic-bezier(.22,1,.36,1)",
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          border: `1.5px solid ${fresh ? `${PATROL_GREEN}70` : col.ring + "80"}`,
          background: fresh ? "var(--br)" : "rgba(255,255,255,.6)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 4, backdropFilter: "blur(2px)",
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 800, color: txtColor,
            textAlign: "center", lineHeight: 1.25, wordBreak: "break-word",
            textShadow: fresh ? `0 0 8px ${PATROL_GREEN}88` : "none",
            fontFamily: "inherit",
          }}>{line1}</div>
          {line2 && (
            <div style={{
              fontSize: 10, fontWeight: 700, color: txtColor,
              textAlign: "center", lineHeight: 1.2, opacity: 0.9,
            }}>{line2}</div>
          )}
        </div>
        {fresh && (
          <div style={{
            position: "absolute", top: -3, right: -3,
            width: 18, height: 18, borderRadius: "50%",
            background: PATROL_GREEN,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 900, color: "#fff",
            boxShadow: `0 0 8px ${PATROL_GREEN}88, 0 2px 4px rgba(0,0,0,.4)`,
          }}>✓</div>
        )}
      </div>
      <div
        className={`patrol-time-label${fresh ? " patrol-time-fresh" : ""}`}
        style={{ fontSize: 9, fontWeight: 700, textAlign: "center", letterSpacing: 0.3, transition: "color .2s" }}
      >
        {minsAgo === null ? "Belum"
          : minsAgo < 60 ? `${minsAgo}m lalu`
          : minsAgo < 1440 ? `${Math.floor(minsAgo / 60)}j lalu`
          : "Kemarin"}
      </div>
    </button>
  );
}

// ── PatrolTab ─────────────────────────────────────────────────────────────────

export function PatrolTab({ posAssign, patrols, setPatrols, toast, canEdit, isAdmin, currentUser }) {
  const [confirm, setConfirm]     = useState(null);
  const [checks, setChecks]       = useState({});
  const [notes, setNotes]         = useState("");
  const [officer, setOfficer]     = useState("");
  const [photo, setPhoto]         = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const fileRef = useRef();

  // ── Buka form checklist area ──
  const openArea = (area) => {
    const pos         = getPos(area) || "—";
    const officerName = currentUser?.name || posAssign[pos]?.join(",") || "";

    // Cegah scan ulang area yang sama dalam 1 jam oleh officer yang sama
    const lastByOfficer = patrols
      .filter(p => p.areas?.includes(area) && p.officer?.includes(officerName))
      .slice(-1)[0];
    if (lastByOfficer && Date.now() - lastByOfficer.ts < 3600000) {
      const sisaMenit = Math.ceil((3600000 - (Date.now() - lastByOfficer.ts)) / 60000);
      toast(`Kamu sudah patroli area ini. Tunggu ${sisaMenit} menit lagi.`, false);
      return;
    }

    const initChecks = {};
    CHECKLIST_ITEMS.forEach(k => { initChecks[k] = null; });
    setChecks(initChecks);
    setNotes("");
    setPhoto(null);
    setOfficer(currentUser?.name || posAssign[pos]?.join(",") || "");
    setConfirm({ area, pos });
  };

  // ── Simpan patroli ──
  const doPatrol = async () => {
    const checkedCount = Object.values(checks).filter(v => v !== null).length;
    if (checkedCount === 0) { toast("Pilih kondisi minimal 1 item!", false); return; }
    if (!photo)             { toast("📷 Foto bukti wajib!", false); return; }
    const resolvedPhoto = (photo instanceof Promise) ? await photo : photo;
    if (!resolvedPhoto)     { toast("📷 Foto gagal diproses, coba lagi!", false); return; }

    const snap        = confirm;
    const temuanItems = Object.entries(checks)
      .filter(([, v]) => v === "perhatian" || v === "rusak")
      .map(([k, v]) => {
        const st = CHECKLIST_STATUS_OPTS.find(o => o.val === v);
        return `${st?.icon || ""} ${k} ${v === "rusak" ? "(Rusak/Mati)" : "(Perlu Perhatian)"}`;
      });
    const allTemuan = [...temuanItems, ...(notes.trim() ? [notes.trim()] : [])].join("; ");

    setPatrols([...patrols, {
      id: Date.now(), ts: Date.now(),
      pos: snap.pos, officer: officer || "—",
      areas: [snap.area],
      notes: allTemuan || "",
      checks: Object.entries(checks).filter(([, v]) => v !== null).map(([k]) => k),
      checkStatus: { ...checks },
      photo: resolvedPhoto,
    }]);
    setConfirm(null);
    toast(`✅ Patroli ${snap.area} dicatat!`);
  };

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => kompressFoto(r.result).then(resolved => setPhoto(resolved));
    r.readAsDataURL(file);
  };

  // Log hari ini
  const todP        = patrols.filter(p => new Date(p.ts).toDateString() === new Date().toDateString());
  const todPVisible = isAdmin
    ? todP
    : todP.filter(p => p.officer?.includes(currentUser?.name || ""));

  // Warna & ikon catatan temuan
  const noteColor = (n) => {
    if (!n) return "var(--accent)";
    if (n.includes("Rusak") || n.includes("Hilang") || n.includes("Mencurigakan")) return "var(--red)";
    if (n.includes("Perlu Perhatian") || n.includes("Redup") || n.includes("Kotor") || n.includes("Tak Dikenal")) return "var(--amber)";
    return "var(--accent)";
  };
  const noteIcon = (n) => {
    if (!n) return "✅";
    if (n.includes("Rusak") || n.includes("Hilang") || n.includes("Mencurigakan")) return "🔴";
    if (n.includes("Perlu Perhatian") || n.includes("Redup") || n.includes("Kotor") || n.includes("Tak Dikenal")) return "⚠️";
    return "✅";
  };

  return (
    <div>
      {/* ── Header ── */}
      <PH title="Patroli" sub="Tap gedung untuk mencatat patroli" />
      {!canEdit && <ReadOnlyBanner reguHari={getReguHari(new Date())} />}

      {/* ── Empty state ── */}
      {patrols.length === 0 && (
        <div style={{
          textAlign: "center", padding: "36px 20px",
          background: "var(--bg-surface)", borderRadius: 16,
          border: "1.5px dashed var(--border)", marginBottom: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🚶</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tx-secondary)", marginBottom: 4 }}>Belum ada catatan patroli</div>
          <div style={{ fontSize: 12, color: "var(--tx-muted)" }}>Tap area gedung di bawah untuk mencatat patroli hari ini</div>
        </div>
      )}

      {/* ── Kartu per pos ── */}
      {Object.entries(PATROL_AREAS).map(([pos, areas], posIdx) => {
        const col        = POS_RING[pos] || { ring: "var(--accent)", fill: "var(--pill-active)" };
        const PATROL_GREEN = "var(--accent)";
        const freshCount = areas.filter(a => {
          const l = patrols.filter(p => p.areas?.includes(a)).slice(-1)[0];
          return l && Date.now() - l.ts < 3600000;
        }).length;
        const allFresh  = freshCount === areas.length;
        const noneFresh = freshCount === 0;
        const pct        = areas.length > 0 ? Math.round(freshCount / areas.length * 100) : 0;
        const badgeColor = allFresh ? PATROL_GREEN : noneFresh ? "rgba(var(--red-rgb),.6)" : col.ring;
        const badgeBg    = allFresh ? "var(--pill-active)" : noneFresh ? "rgba(201,27,42,.1)" : col.ring + "18";
        const badgeBord  = allFresh ? `${PATROL_GREEN}50` : noneFresh ? "rgba(201,27,42,.3)" : col.ring + "40";
        const cardGlow   = allFresh
          ? `0 0 20px ${PATROL_GREEN}25, 0 4px 16px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04)`
          : `0 4px 16px rgba(0,0,0,.55), 0 0 0 1px ${col.ring}15, inset 0 1px 0 rgba(255,255,255,.03)`;
        const stCls = ["card-stagger-1","card-stagger-2","card-stagger-3","card-stagger-4"][posIdx] || "";
        const logPos = todPVisible.filter(p => p.pos === pos);

        return (
          <div
            key={pos}
            className={stCls}
            style={{
              marginBottom: 14,
              background: col.fill,
              border: `1.5px solid ${col.ring}${allFresh ? "50" : "45"}`,
              borderRadius: 16, overflow: "hidden",
              boxShadow: cardGlow, transition: "box-shadow .3s ease",
            }}
          >
            {/* Accent bar atas */}
            <div style={{ height: 3, background: allFresh ? PATROL_GREEN : col.ring, opacity: 0.85 }} />

            {/* Header kartu */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 0" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: allFresh ? "var(--accent-tint)" : cRgba(col.ring, 0.10),
                border: `1.5px solid ${allFresh ? PATROL_GREEN + "55" : col.ring + "80"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,.3)",
              }}>
                <span style={{ fontSize: 16 }}>🏢</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: allFresh ? PATROL_GREEN : "var(--tx)" }}>{pos}</div>
                <div style={{ fontSize: 10, color: "var(--tx-muted)" }}>{areas.length} area</div>
              </div>
              <div style={{
                background: badgeBg, border: `1px solid ${badgeBord}`,
                borderRadius: 20, padding: "3px 10px",
                fontSize: 11, fontWeight: 800, color: badgeColor,
              }}>{pct}%</div>
            </div>

            {/* Area circles */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 14px 12px", justifyContent: "flex-start" }}>
              {areas.map(area => {
                const last = patrols.filter(p => p.areas?.includes(area)).slice(-1)[0];
                return <AreaCircle key={area} area={area} pos={pos} last={last} onTap={openArea} canEdit={canEdit} />;
              })}
            </div>

            {/* Log patroli hari ini untuk pos ini */}
            {logPos.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px 10px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--tx-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Log Hari Ini</div>
                {[...logPos].reverse().map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, marginTop: 1 }}>📍</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--tx-secondary)" }}>{p.areas?.join(", ") || "—"}</div>
                      <div style={{ fontSize: 10, color: "var(--tx-muted)" }}>{p.officer}</div>
                      {p.checks?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                          {p.checkStatus
                            ? Object.entries(p.checkStatus).filter(([, v]) => v).map(([k, v]) => {
                                const st = CHECKLIST_STATUS_OPTS.find(o => o.val === v);
                                return (
                                  <span key={k} style={{
                                    fontSize: 9.5,
                                    background: st?.bg || "var(--accent-tint)",
                                    border: `1px solid ${st?.border || "rgba(14,165,233,.35)"}`,
                                    borderRadius: 5, padding: "1px 6px",
                                    color: st?.color || "var(--accent)", fontWeight: 700,
                                  }}>{st?.icon || ""} {k}</span>
                                );
                              })
                            : p.checks.map(c => (
                                <span key={c} style={{
                                  fontSize: 9.5, background: "var(--accent-tint)",
                                  border: "1px solid rgba(14,165,233,.35)",
                                  borderRadius: 5, padding: "1px 6px",
                                  color: "var(--accent)", fontWeight: 700,
                                }}>{CHECKLIST_ICON[c] || ""} {c}</span>
                              ))
                          }
                        </div>
                      )}
                      {p.notes && (
                        <div style={{ fontSize: 10.5, color: noteColor(p.notes), marginTop: 2, fontWeight: 600 }}>
                          {noteIcon(p.notes)} {p.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)" }}>{fmtT(p.ts)}</span>
                      {p.photo && (
                        <button
                          onClick={() => setViewPhoto(p.photo)}
                          style={{
                            background: "rgba(109,40,217,.1)", border: "1px solid #D1D5DB",
                            borderRadius: 5, padding: "2px 7px",
                            fontSize: 10, color: "var(--violet)", fontWeight: 700,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >Foto</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Modal: Checklist patroli ── */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm ? `Checklist — ${confirm.area}` : "Checklist Patroli"}>
        {confirm && (
          <div>
            {/* Header area */}
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "var(--accent-tint)", border: "1px solid rgba(14,165,233,.35)",
              borderRadius: 12, padding: "12px 16px", marginBottom: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: `3px solid ${POS_RING[confirm.pos]?.ring || "var(--accent)"}`,
                background: POS_RING[confirm.pos]?.fill || "var(--pill-active)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  border: `1.5px solid ${(POS_RING[confirm.pos]?.ring || "") + "66"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 900,
                    color: POS_RING[confirm.pos]?.txt || "var(--accent)",
                    textAlign: "center", lineHeight: 1.2,
                  }}>{confirm.area}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "var(--tx)" }}>{confirm.area}</div>
                <div style={{ fontSize: 11, color: "var(--tx-muted)", marginTop: 2 }}>{confirm.pos}</div>
              </div>
            </div>

            {/* Checklist items */}
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--tx-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Cek Kondisi Item</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
              {CHECKLIST_ITEMS.map(item => {
                const status    = checks[item];
                const activeOpt = CHECKLIST_STATUS_OPTS.find(o => o.val === status);
                return (
                  <div key={item} style={{
                    background: activeOpt ? activeOpt.bgActive || activeOpt.bg : "var(--br)",
                    border: `2px solid ${activeOpt ? activeOpt.border : "var(--border)"}`,
                    borderRadius: 13, padding: "10px 12px",
                    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                    boxShadow: activeOpt ? activeOpt.shadow || "none" : "none",
                    transition: "all .2s cubic-bezier(.22,1,.36,1)",
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 800,
                      color: activeOpt ? activeOpt.color : "var(--tx-secondary)",
                      textShadow: activeOpt ? `0 0 10px ${activeOpt.color}80` : "none",
                      marginBottom: 8, transition: "all .2s",
                    }}>{CHECKLIST_ICON[item] || ""} {item}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {CHECKLIST_STATUS_OPTS.map(opt => {
                        const isActive = status === opt.val;
                        return (
                          <button
                            key={opt.val}
                            onClick={() => setChecks(p => ({ ...p, [item]: isActive ? null : opt.val }))}
                            style={{
                              flex: 1, padding: "8px 4px",
                              background: isActive ? opt.bgActive || opt.bg : "rgba(255,255,255,.04)",
                              border: `2px solid ${isActive ? opt.border : "var(--pill-active)"}`,
                              borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                              fontSize: 10.5, fontWeight: 800,
                              color: isActive ? opt.color : "var(--tx-muted)",
                              boxShadow: isActive ? opt.shadow || "none" : "none",
                              transform: isActive ? "scale(1.03)" : "scale(1)",
                              transition: "all .18s cubic-bezier(.22,1,.36,1)",
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                            }}
                          >
                            <span style={{ fontSize: isActive ? 18 : 14, transition: "font-size .15s", filter: isActive ? "drop-shadow(0 0 4px currentColor)" : "none" }}>{opt.icon}</span>
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Temuan cepat */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--tx-muted)", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 }}>Temuan Cepat</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {QUICK_TEMUAN.map(qt => {
                  const already = notes.includes(qt.label);
                  const sev     = CHECKLIST_STATUS_OPTS.find(o => o.val === qt.severity);
                  return (
                    <button
                      key={qt.label}
                      onClick={() => {
                        if (already) setNotes(n => n.replace(qt.label + "; ", "").replace("; " + qt.label, "").replace(qt.label, "").trim());
                        else         setNotes(n => (n.trim() ? n.trim() + "; " : "") + qt.label);
                      }}
                      style={{
                        padding: "5px 10px",
                        background: already ? sev?.bgActive || sev?.bg || "rgba(14,165,233,.35)" : "var(--br)",
                        border: `2px solid ${already ? sev?.border || "var(--accent)" : "var(--border)"}`,
                        borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 11, fontWeight: 800,
                        color: already ? sev?.color || "var(--accent)" : "var(--tx-muted)",
                        boxShadow: already ? sev?.shadow || "0 0 12px var(--accent-glow)" : "none",
                        transform: already ? "scale(1.04)" : "scale(1)",
                        transition: "all .18s cubic-bezier(.22,1,.36,1)",
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <span>{qt.icon}</span> {qt.label}
                      {already && <span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Petugas */}
            {isAdmin
              ? (
                <Inp label="Petugas" value={officer} onChange={e => setOfficer(e.target.value)} as="select">
                  <option value="">— Pilih —</option>
                  {Object.values(REGU).flat().map(m => <option key={m} value={m}>{m}</option>)}
                </Inp>
              ) : (
                <div style={{
                  marginBottom: 11, display: "flex", alignItems: "center", gap: 8,
                  background: "var(--bg-raised)", border: "1px solid var(--border2)",
                  borderRadius: 9, padding: "9px 12px",
                }}>
                  <span style={{ fontSize: 14 }}>👤</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)" }}>{officer}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx-muted)" }}>Login aktif</span>
                </div>
              )
            }

            {/* Catatan tambahan */}
            <Inp
              label="Catatan Tambahan (opsional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              as="textarea"
              placeholder="Detail temuan lain yang tidak ada di atas..."
            />

            {/* Foto bukti WAJIB */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: "block", fontSize: 11,
                color: photo ? "var(--accent)" : "var(--red)",
                marginBottom: 6, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
              }}>📷 Foto Bukti — WAJIB</label>
              {!photo ? (
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: "rgba(201,27,42,.07)", border: "2px dashed #FFCDD2",
                  borderRadius: 10, padding: "16px 12px",
                  cursor: "pointer", color: "var(--red)", fontWeight: 700, fontSize: 13,
                }}>
                  {IC({ n: "cam", s: 20, c: "var(--red)" })} Ambil Foto Sekarang
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
                </label>
              ) : (
                <div style={{ position: "relative", width: "100%" }}>
                  <img src={photo} alt="bukti" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, border: "2px solid var(--green-light)", display: "block" }} />
                  <button
                    onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}
                    style={{
                      position: "absolute", top: 6, right: 6,
                      background: "rgba(201,27,42,.85)", border: "none",
                      borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 800,
                      padding: "8px 10px", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >✕ Ganti</button>
                  <div style={{
                    position: "absolute", bottom: 6, left: 6,
                    background: "rgba(var(--green-rgb),.85)",
                    borderRadius: 6, padding: "3px 8px",
                    fontSize: 10, color: "#fff", fontWeight: 700,
                  }}>✅ Foto siap</div>
                </div>
              )}
            </div>

            {/* Tombol aksi */}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={doPatrol} color={photo ? "var(--accent)" : "var(--tx-muted)"} size="lg" full>
                {IC({ n: "ok", s: 14 })} Simpan Patroli
              </Btn>
              <Btn onClick={() => setConfirm(null)} color="var(--tx-muted)" variant="outline">Batal</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Lihat foto bukti ── */}
      <Modal open={!!viewPhoto} onClose={() => setViewPhoto(null)} title="Foto Bukti Patroli">
        {viewPhoto && (
          <div style={{ textAlign: "center" }}>
            <img src={viewPhoto} alt="bukti" style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 10, marginBottom: 14 }} />
          </div>
        )}
      </Modal>
    </div>
  );
}
