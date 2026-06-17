// TabSearch.jsx — SIPAMDAL
// Sesi 5: Tab Pencarian
// Source: tab-search.js (190 baris)

import { useState, useEffect, useRef, useMemo } from "react";
import { fmtDT } from "../utils/utils.js";
import { PH } from "../components/ui/UiComponents.jsx";
import { useDataStore } from "../stores/useDataStore.js";

const FILTERS = [
  { id: "semua",     label: "Semua" },
  { id: "tamu",      label: "👤 Tamu" },
  { id: "paket",     label: "📦 Paket" },
  { id: "kendaraan", label: "🚗 Kendaraan" },
  { id: "insiden",   label: "⚠️ Insiden" },
  { id: "mutasi",    label: "🔄 Mutasi" },
];

export default function TabSearch() {
  const packages  = useDataStore(s => s.packages);
  const guests    = useDataStore(s => s.guests);
  const mutations = useDataStore(s => s.mutations);
  const incidents = useDataStore(s => s.incidents);

  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState("semua");
  const inp = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inp.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return [];
    const out = [];

    if (filter === "semua" || filter === "paket") {
      packages.forEach(p => {
        const hit = [p.recipient, p.sender, p.notes, p.type]
          .filter(Boolean).some(v => v.toLowerCase().includes(q));
        if (hit) out.push({
          kind: "paket", icon: "📦", title: p.recipient,
          sub: `Dari: ${p.sender || "—"} · ${p.type}`,
          status: p.status, ts: p.ts,
          color: p.status === "Belum Diambil" ? "var(--amber-text)" : "var(--accent)",
          badge: p.status,
        });
      });
    }

    if (filter === "semua" || filter === "tamu") {
      guests.forEach(g => {
        const hit = [g.name, g.institution, g.purpose, g.room, g.vehicle]
          .filter(Boolean).some(v => v.toLowerCase().includes(q));
        if (hit) out.push({
          kind: "tamu", icon: "👤", title: g.name,
          sub: `${g.institution || ""}${g.vehicle ? " · 🚗 " + g.vehicle : ""}${g.room ? " · " + g.room : ""}`,
          status: g.status, ts: g.ts,
          color: g.status === "Masih Ada" ? "rgba(var(--violet-rgb),.4)" : "var(--tx-muted)",
          badge: g.status,
        });
      });
    }

    if (filter === "semua" || filter === "kendaraan") {
      guests.forEach(g => {
        if (!g.vehicle) return;
        if (g.vehicle.toLowerCase().includes(q)) out.push({
          kind: "kendaraan", icon: "🚗", title: g.vehicle,
          sub: `Pemilik: ${g.name}${g.institution ? " · " + g.institution : ""}`,
          status: g.status, ts: g.ts,
          color: "var(--accent)", badge: g.vehicle,
        });
      });
    }

    if (filter === "semua" || filter === "insiden") {
      incidents.forEach(i => {
        const hit = [i.title, i.desc, i.location, i.reportedBy]
          .filter(Boolean).some(v => v.toLowerCase().includes(q));
        if (hit) out.push({
          kind: "insiden", icon: "⚠️", title: i.title || "Insiden",
          sub: `${i.location || ""}${i.reportedBy ? " · " + i.reportedBy : ""}`,
          status: i.status, ts: i.ts,
          color: i.status === "Selesai" ? "var(--tx-muted)" : "var(--red)",
          badge: i.status,
        });
      });
    }

    if (filter === "semua" || filter === "mutasi") {
      mutations.forEach(m => {
        const hit = [m.note, m.fromName, m.toName, String(m.fromRegu || "")]
          .filter(Boolean).some(v => v.toLowerCase().includes(q));
        if (hit) out.push({
          kind: "mutasi", icon: "🔄", title: `Mutasi Regu ${m.fromRegu || ""}`,
          sub: m.note || m.fromName || "",
          status: null, ts: m.ts,
          color: "var(--accent)", badge: null,
        });
      });
    }

    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [q, filter, packages, guests, mutations, incidents]);

  return (
    <div>
      {/* Header */}
      <PH title="Pencarian" sub="Cari tamu, paket, kendaraan, insiden" />

      {/* Search input */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input
          ref={inp}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ketik nama, no. kendaraan, penerima paket..."
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "11px 40px 11px 14px",
            background: "var(--bg-surface)", border: "1.5px solid var(--border2)",
            borderRadius: 12, fontSize: 14, fontWeight: 600,
            color: "var(--tx)", fontFamily: "inherit", outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = "var(--accent)"}
          onBlur={e  => e.target.style.borderColor = "var(--border)"}
        />
        {query
          ? (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute", right: 12, top: "50%",
                transform: "translateY(-50%)", background: "none",
                border: "none", color: "var(--tx-muted)", fontSize: 18,
                cursor: "pointer", padding: 0,
              }}
            >✕</button>
          ) : (
            <span style={{
              position: "absolute", right: 14, top: "50%",
              transform: "translateY(-50%)", fontSize: 16,
            }}>🔍</span>
          )
        }
      </div>

      {/* Filter pills */}
      <div style={{
        display: "flex", gap: 7, overflowX: "auto",
        paddingBottom: 4, marginBottom: 14, scrollbarWidth: "none",
      }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 20,
              background: filter === f.id ? "var(--pill-active)" : "var(--bg-surface)",
              border: `1.5px solid ${filter === f.id ? "var(--accent)" : "var(--border)"}`,
              color: filter === f.id ? "var(--accent)" : "var(--tx-muted)",
              fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Empty state: belum ketik */}
      {!q && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--tx-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Mulai ketik untuk mencari</div>
          <div style={{ fontSize: 11.5, marginTop: 6, color: "var(--tx-muted)" }}>
            Tamu · Paket · Kendaraan · Insiden
          </div>
        </div>
      )}

      {/* Empty state: tidak ditemukan */}
      {q && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--tx-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🕵️</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Tidak ditemukan</div>
          <div style={{ fontSize: 11.5, marginTop: 6 }}>Coba kata kunci lain</div>
        </div>
      )}

      {/* Hasil */}
      {q && results.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, color: "var(--tx-muted)", fontWeight: 700, marginBottom: 10 }}>
            {results.length} hasil untuk &quot;
            <span style={{ color: "var(--accent)" }}>{query}</span>
            &quot;
          </div>

          {results.map((r, i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-surface)", border: "1.5px solid var(--border2)",
                borderRadius: 12, padding: "11px 14px", marginBottom: 8,
                borderLeft: `4px solid ${r.color}`,
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 3,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--tx)" }}>
                    {r.title}
                  </span>
                </div>
                {r.badge && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: r.color,
                    background: r.color + "22", borderRadius: 8,
                    padding: "2px 7px", border: `1px solid ${r.color}44`,
                    flexShrink: 0,
                  }}>
                    {r.badge}
                  </span>
                )}
              </div>
              {r.sub && (
                <div style={{ fontSize: 11.5, color: "var(--tx-muted)", paddingLeft: 25 }}>
                  {r.sub}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: "var(--tx-muted)", paddingLeft: 25, marginTop: 2 }}>
                {fmtDT(r.ts)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export { TabSearch as SearchTab };
