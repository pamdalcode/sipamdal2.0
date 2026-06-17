// TabEvaluasi.jsx — SIPAMDAL
// Sesi 4: Tab Evaluasi Anggota — khusus Pimpinan
// Source: tab-evaluasi.js (415 baris)

import { useState, useMemo } from "react";
import { ANGGOTA_DATA, cRgba } from "../utils/utils.js";
import { useDataStore } from "../stores/useDataStore.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function startOf(period, now) {
  const d = new Date(now);
  switch (period) {
    case "hari":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    case "pekan": {
      const day = d.getDay(); // 0=Sun
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    }
    case "bulan":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "tahun":
      return new Date(d.getFullYear(), 0, 1);
    default:
      return new Date(0);
  }
}

function fmtDur(ms) {
  if (!ms || ms < 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}j ${m}m`;
  return `${m} menit`;
}

const PERIODS = [
  { id: "hari",  label: "Hari Ini" },
  { id: "pekan", label: "Pekan Ini" },
  { id: "bulan", label: "Bulan Ini" },
  { id: "tahun", label: "Tahun Ini" },
];

// ── Medal ─────────────────────────────────────────────────────────────────────
function Medal({ rank }) {
  if (rank === 1) return <span style={{ fontSize: 16 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 16 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 16 }}>🥉</span>;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: "var(--tx-ghost)",
      minWidth: 20, textAlign: "center",
    }}>
      {rank}
    </span>
  );
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────
function ScoreBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{
      height: 5, borderRadius: 99, background: "rgba(0,0,0,.07)",
      overflow: "hidden", marginTop: 3,
    }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        background: color, transition: "width .4s ease",
      }} />
    </div>
  );
}

// ── StatTile ──────────────────────────────────────────────────────────────────
function StatTile({ label, value, icon, color }) {
  return (
    <div style={{
      background: cRgba(color, 0.07),
      border: `1.5px solid ${cRgba(color, 0.18)}`,
      borderRadius: 12, padding: "10px 8px", textAlign: "center",
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1, marginTop: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 9.5, color: "var(--tx-muted)", marginTop: 3, fontWeight: 600, lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

// ── LeaderCard ────────────────────────────────────────────────────────────────
function LeaderCard({ title, icon, color, rows, valueKey, valueLabel, note, reverseRank }) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...rows].sort((a, b) =>
    reverseRank ? a[valueKey] - b[valueKey] : b[valueKey] - a[valueKey]
  );
  const maxVal  = sorted.length > 0 ? sorted[0][valueKey] : 1;
  const display = expanded ? sorted : sorted.slice(0, 5);

  return (
    <div style={{
      background: "var(--bg-raised)", border: "1.5px solid var(--border)",
      borderRadius: 16, padding: "12px 14px 10px", marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-primary)" }}>{title}</div>
          {note && (
            <div style={{ fontSize: 10, color: "var(--tx-ghost)", marginTop: 1 }}>{note}</div>
          )}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, color,
          background: cRgba(color, 0.12),
          border: `1px solid ${cRgba(color, 0.25)}`,
          borderRadius: 99, padding: "2px 8px",
        }}>
          {valueLabel}
        </div>
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "16px 0",
          color: "var(--tx-ghost)", fontSize: 12,
        }}>
          Belum ada data di periode ini
        </div>
      ) : (
        display.map((row, idx) => {
          const rank  = idx + 1;
          const isTop = rank === 1 && !reverseRank && row[valueKey] > 0;
          return (
            <div
              key={row.nama}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 8px", borderRadius: 10,
                background: isTop ? cRgba(color, 0.07) : "transparent",
                marginBottom: 2,
              }}
            >
              <div style={{ minWidth: 24, textAlign: "center" }}>
                <Medal rank={rank} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: "var(--tx-primary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {row.nama}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--tx-ghost)", flexShrink: 0 }}>
                    Regu {row.regu}
                  </span>
                </div>
                <ScoreBar value={row[valueKey]} max={maxVal} color={color} />
              </div>
              <div style={{
                fontSize: 14, fontWeight: 800,
                color: row[valueKey] > 0 ? color : "var(--tx-ghost)",
                minWidth: 28, textAlign: "right",
              }}>
                {row[valueKey]}
              </div>
            </div>
          );
        })
      )}

      {/* Expand button */}
      {sorted.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 6, width: "100%", background: "transparent", border: "none",
            fontSize: 11, color: "var(--accent-text)", cursor: "pointer",
            padding: "4px 0", fontFamily: "inherit",
          }}
        >
          {expanded ? "▲ Sembunyikan" : `▼ Lihat semua ${sorted.length} anggota`}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabEvaluasi
// ─────────────────────────────────────────────────────────────────────────────
export default function TabEvaluasi() {
  const patrols   = useDataStore(s => s.patrols)   ?? [];
  const incidents = useDataStore(s => s.incidents) ?? [];
  const mutations = useDataStore(s => s.mutations) ?? [];
  const packages  = useDataStore(s => s.packages)  ?? [];

  const [period, setPeriod] = useState("pekan");

  const now     = new Date();
  const members = ANGGOTA_DATA.items;
  const since   = useMemo(() => startOf(period, now), [period]);

  // Filter data by period
  const fPatrols   = useMemo(() => patrols.filter(p => new Date(p.ts) >= since),                          [patrols, since]);
  const fIncidents = useMemo(() => incidents.filter(i => new Date(i.ts || i.createdAt || 0) >= since),    [incidents, since]);
  const fMutations = useMemo(() => mutations.filter(m => new Date(m.ts) >= since),                        [mutations, since]);
  const fPackages  = useMemo(() => packages.filter(p => new Date(p.ts) >= since),                         [packages, since]);

  // Per-member aggregation
  const memberStats = useMemo(() => members.map(a => {
    const nama = a.nama;

    const patrolCount = fPatrols.filter(p => {
      const officers = (p.officer || "").split(/[,/]/).map(s => s.trim());
      return officers.includes(nama);
    }).length;

    const incidenCount = fIncidents.filter(i => {
      const officers = (i.officer || "").split(/[,/]/).map(s => s.trim());
      return officers.includes(nama);
    }).length;

    const mutasiCount = fMutations.filter(m => (m.actor || "") === nama).length;

    return { ...a, patrolCount, incidenCount, mutasiCount };
  }), [members, fPatrols, fIncidents, fMutations]);

  // Global stats
  const totalPatrols   = fPatrols.length;
  const totalIncidents = fIncidents.length;
  const totalMutations = fMutations.length;
  const totalPackages  = fPackages.length;
  const pkgHandled     = fPackages.filter(p => p.status !== "Belum Diambil");
  const avgHandleMs    = pkgHandled.length > 0
    ? pkgHandled.reduce((sum, p) => sum + (p.takenAt && p.ts ? p.takenAt - p.ts : 0), 0) / pkgHandled.length
    : null;

  const topAnggota = [...memberStats].sort((a, b) =>
    (b.patrolCount + b.incidenCount + b.mutasiCount) -
    (a.patrolCount + a.incidenCount + a.mutasiCount)
  )[0];

  const bottomAnggota = memberStats.filter(
    a => (a.patrolCount + a.incidenCount + a.mutasiCount) === 0
  ).length;

  return (
    <div className="tab-view">

      {/* Top bar */}
      <div style={{
        padding: "14px 16px 0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: "var(--tx-ghost)",
            letterSpacing: 1.2, textTransform: "uppercase",
          }}>
            Pimpinan
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--tx-primary)", lineHeight: 1.1 }}>
            Evaluasi Anggota
          </div>
        </div>
        <span style={{ fontSize: 26 }}>📊</span>
      </div>

      {/* Period filter */}
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 4px", overflowX: "auto" }}>
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              flexShrink: 0, padding: "6px 14px", borderRadius: 99,
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              cursor: "pointer", border: "1.5px solid",
              background:   period === p.id ? "var(--accent)"      : "transparent",
              color:        period === p.id ? "#fff"               : "var(--accent-text)",
              borderColor:  period === p.id ? "var(--accent)"      : "var(--br-default)",
              transition: "all .15s",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Global summary */}
      <div style={{ padding: "10px 16px 4px" }}>
        <div style={{
          background: "var(--bg-surface)", border: "1.5px solid var(--border)",
          borderRadius: 16, padding: "12px 12px 10px",
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: "var(--tx-muted)",
            letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10,
          }}>
            🔢 Ringkasan {PERIODS.find(p => p.id === period)?.label}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <StatTile label="Patroli"  value={totalPatrols}   icon="🛡️" color="var(--accent)" />
            <StatTile label="Insiden"  value={totalIncidents} icon="⚠️" color={totalIncidents > 0 ? "var(--red)" : "var(--tx-muted)"} />
            <StatTile label="Mutasi"   value={totalMutations} icon="🔄" color="var(--violet)" />
            <StatTile label="Paket"    value={totalPackages}  icon="📦" color="var(--amber-bright)" />
          </div>

          {/* Avg handle time */}
          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 10,
            background: avgHandleMs ? "rgba(14,165,233,.07)" : "rgba(0,0,0,.04)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>⏱️</span>
            <div>
              <div style={{ fontSize: 10, color: "var(--tx-muted)", fontWeight: 600 }}>
                Rata-rata waktu ambil paket
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: avgHandleMs ? "var(--accent)" : "var(--tx-ghost)" }}>
                {avgHandleMs ? fmtDur(avgHandleMs) : "Belum ada data"}
              </div>
            </div>
            {pkgHandled.length > 0 && (
              <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx-ghost)" }}>
                dari {pkgHandled.length} paket
              </div>
            )}
          </div>

          {/* Highlight: most active & most idle */}
          {topAnggota && (topAnggota.patrolCount + topAnggota.incidenCount + topAnggota.mutasiCount) > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
              <div style={{
                flex: 1, padding: "7px 10px", borderRadius: 10,
                background: "rgba(46,125,50,.08)", border: "1px solid rgba(46,125,50,.2)",
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: .8 }}>
                  🏆 Paling Aktif
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tx-primary)", marginTop: 2 }}>
                  {topAnggota.nama}
                </div>
                <div style={{ fontSize: 10, color: "var(--tx-ghost)" }}>
                  {topAnggota.patrolCount}× patroli · {topAnggota.incidenCount}× insiden · {topAnggota.mutasiCount}× mutasi
                </div>
              </div>

              {bottomAnggota > 0 && (
                <div style={{
                  flex: 1, padding: "7px 10px", borderRadius: 10,
                  background: "rgba(201,27,42,.06)", border: "1px solid rgba(201,27,42,.18)",
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: .8 }}>
                    💤 Tidak Aktif
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tx-primary)", marginTop: 2 }}>
                    {bottomAnggota} Anggota
                  </div>
                  <div style={{ fontSize: 10, color: "var(--tx-ghost)" }}>
                    Belum ada aktivitas tercatat
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboards */}
      <div style={{ padding: "10px 16px 8px" }}>
        <LeaderCard
          title="Kepatuhan Patroli"
          icon="🛡️"
          color="var(--accent)"
          rows={memberStats}
          valueKey="patrolCount"
          valueLabel="Putaran"
          note="Siapa yang paling rajin keliling"
        />

        <LeaderCard
          title="Laporan Insiden"
          icon="⚠️"
          color="var(--red)"
          rows={memberStats}
          valueKey="incidenCount"
          valueLabel="Laporan"
          note="Siapa yang paling sigap melaporkan kejadian"
        />

        <LeaderCard
          title="Serah Terima / Mutasi"
          icon="🔄"
          color="var(--violet)"
          rows={memberStats}
          valueKey="mutasiCount"
          valueLabel="Kali"
          note="Siapa yang konsisten buat laporan serah terima"
        />

        {/* Kecepatan handle paket — global metric */}
        {pkgHandled.length > 0 && (
          <div style={{
            background: "var(--bg-raised)", border: "1.5px solid var(--border)",
            borderRadius: 16, padding: "12px 14px 10px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📦</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-primary)" }}>
                  Kecepatan Handle Paket
                </div>
                <div style={{ fontSize: 10, color: "var(--tx-ghost)", marginTop: 1 }}>
                  Waktu paket masuk hingga diambil
                </div>
              </div>
            </div>

            {[...pkgHandled]
              .sort((a, b) => (a.takenAt - a.ts) - (b.takenAt - b.ts))
              .slice(0, 5)
              .map((p, i) => {
                const dur   = p.takenAt && p.ts ? p.takenAt - p.ts : 0;
                const color = dur < 3600000 ? "var(--green)" : dur < 86400000 ? "var(--amber-bright)" : "var(--red)";
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 8px", borderRadius: 10, marginBottom: 2,
                    }}
                  >
                    <div style={{ minWidth: 24, textAlign: "center" }}>
                      <Medal rank={i + 1} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: "var(--tx-primary)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {p.recipient || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--tx-ghost)" }}>
                        {p.type || "Paket"}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color, whiteSpace: "nowrap" }}>
                      {fmtDur(dur)}
                    </div>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* Footer note */}
        <div style={{
          textAlign: "center", fontSize: 10,
          color: "var(--tx-ghost)", padding: "4px 0 12px",
        }}>
          Data dihitung dari aktivitas yang tercatat di sistem
        </div>
      </div>
    </div>
  );
}

export { TabEvaluasi as EvaluasiTab };
