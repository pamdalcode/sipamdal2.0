// src/engine/QrEngine.jsx — SIPAMDAL
// Migrasi dari qr-engine.js → Vite + React JSX
// Dependensi: utils.js, ui-components (BtnSimpan, BtnBatal)

import { useState, useEffect, useRef, useCallback } from "react";
import {
  POS_LIST, POS_CAP, PATROL_AREAS, QR_PREFIX, decQR, ALL_AREAS, kompressFoto,
} from "../utils/utils.js";
import { BtnSimpan, BtnBatal } from "../components/ui/UiComponents.jsx";
import { useAppStore } from "../stores/useAppStore.js";

// ── Colour helpers ────────────────────────────────────────────────────────────
function colRgb(col) {
  if (!col) return "var(--orb-rgb)";
  if (col.includes("amber"))  return "var(--amber-rgb)";
  if (col.includes("red"))    return "var(--red-rgb)";
  if (col.includes("violet")) return "var(--violet-rgb)";
  if (col.includes("teal") || col.includes("regu-1")) return "var(--teal-rgb)";
  if (col.includes("col-slate") || col.includes("slate")) return "100,116,139";
  return "var(--orb-rgb)";
}
export function cRgba(col, a) { return `rgba(${colRgb(col)},${a})`; }

// ── Pos QR helpers ────────────────────────────────────────────────────────────
export const POS_QR_PREFIX = "BBPKA2-POS-";
export const encPosQR = (pos) => POS_QR_PREFIX + pos.replace(/ /g, "_");
export const decPosQR = (v) =>
  v && v.startsWith(POS_QR_PREFIX) ? v.replace(POS_QR_PREFIX, "").replace(/_/g, " ") : null;

// ── Checklist constants ───────────────────────────────────────────────────────
export const CHECKLIST_ITEMS = ["Jendela", "Pintu", "Lampu", "Barang Inventaris", "Kondisi Umum"];
export const CHECKLIST_ICON  = {
  "Jendela": "", "Pintu": "", "Lampu": "",
  "Barang Inventaris": "", "Kondisi Umum": "",
};
export const CHECKLIST_STATUS_OPTS = [
  { val: "aman",      label: "Aman",            icon: "", color: "var(--accent-2)",  bg: "rgba(var(--orb-rgb),.12)",    border: "rgba(var(--orb-rgb),.70)",   bgActive: "rgba(var(--orb-rgb),.18)",   shadow: "0 0 14px rgba(14,165,233,.30)"  },
  { val: "perhatian", label: "Perlu Perhatian",  icon: "", color: "var(--amber)",     bg: "rgba(var(--amber-rgb),.28)", border: "rgba(var(--amber-rgb),.75)", bgActive: "rgba(var(--amber-rgb),.35)", shadow: "0 0 14px rgba(var(--amber-rgb),.45)" },
  { val: "rusak",     label: "Rusak / Mati",     icon: "", color: "var(--red)",       bg: "rgba(201,27,42,.28)",        border: "rgba(201,27,42,.75)",        bgActive: "rgba(201,27,42,.35)",        shadow: "0 0 14px rgba(201,27,42,.45)"   },
];
export const QUICK_TEMUAN = [
  { label: "Pintu Rusak",          icon: "", severity: "rusak"     },
  { label: "Kunci Hilang",         icon: "", severity: "rusak"     },
  { label: "Jendela Rusak",        icon: "", severity: "rusak"     },
  { label: "Lampu Mati",           icon: "", severity: "rusak"     },
  { label: "Lampu Redup",          icon: "", severity: "perhatian" },
  { label: "Kebocoran Air",        icon: "", severity: "rusak"     },
  { label: "Barang Hilang",        icon: "", severity: "rusak"     },
  { label: "Area Kotor",           icon: "", severity: "perhatian" },
  { label: "AC Tidak Berfungsi",   icon: "", severity: "perhatian" },
  { label: "Orang Mencurigakan",   icon: "", severity: "rusak"     },
  { label: "Kendaraan Tak Dikenal",icon: "", severity: "perhatian" },
  { label: "Situasi Aman",         icon: "", severity: "aman"      },
];
export const POS_RING = {
  "Pos Asrama":     { ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
  "Gedung Utama":   { ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
  "Pos Utama":      { ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
  "Pos Guest House":{ ring: "var(--col-slate)", fill: "rgba(100,100,100,.10)", txt: "var(--col-slate)", txtLight: "var(--tx-secondary)" },
};

// ── QR Code Generator (self-contained, no external deps) ─────────────────────
// IIFE tetap — tidak perlu JSX, hanya expose window.__encodeQR & window.__drawQRToCanvas
(function () {
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x; GF_LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11d; x &= 0xff;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) { return (a && b) ? GF_EXP[GF_LOG[a] + GF_LOG[b]] : 0; }
  function gfPolyMul(p, q) {
    const r = new Uint8Array(p.length + q.length - 1);
    for (let i = 0; i < p.length; i++)
      for (let j = 0; j < q.length; j++)
        r[i + j] ^= gfMul(p[i], q[j]);
    return r;
  }
  function rsGenerator(n) {
    let g = new Uint8Array([1]);
    for (let i = 0; i < n; i++) g = gfPolyMul(g, [1, GF_EXP[i]]);
    return g;
  }
  function rsEncode(data, nEcc) {
    const gen = rsGenerator(nEcc);
    const msg = new Uint8Array(data.length + nEcc);
    msg.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0)
        for (let j = 1; j < gen.length; j++)
          msg[i + j] ^= gfMul(gen[j], coef);
    }
    return msg.slice(data.length);
  }

  const QR_CAP = {
    1: { dc: 16,  ecc: 10, b1: 1, dc1: 16,  b2: 0, dc2: 0 },
    2: { dc: 28,  ecc: 16, b1: 1, dc1: 28,  b2: 0, dc2: 0 },
    3: { dc: 44,  ecc: 26, b1: 1, dc1: 44,  b2: 0, dc2: 0 },
    4: { dc: 64,  ecc: 18, b1: 2, dc1: 32,  b2: 0, dc2: 0 },
    5: { dc: 86,  ecc: 24, b1: 2, dc1: 43,  b2: 0, dc2: 0 },
    6: { dc: 108, ecc: 16, b1: 4, dc1: 27,  b2: 0, dc2: 0 },
    7: { dc: 124, ecc: 18, b1: 4, dc1: 31,  b2: 0, dc2: 0 },
    8: { dc: 154, ecc: 22, b1: 2, dc1: 38,  b2: 2, dc2: 39 },
    9: { dc: 182, ecc: 22, b1: 3, dc1: 36,  b2: 2, dc2: 37 },
    10:{ dc: 216, ecc: 26, b1: 4, dc1: 43,  b2: 1, dc2: 44 },
  };
  const FORMAT_INFO = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0];
  const ALIGN_POS = {
    1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34],
    7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50],
  };

  function encodeQR(text) {
    const bytes = new TextEncoder().encode(text);
    const len = bytes.length;
    const cwNeeded = Math.ceil((4 + 8 + 8 * len) / 8);
    let ver = 1;
    for (let v = 1; v <= 10; v++) {
      if (QR_CAP[v] && QR_CAP[v].dc >= cwNeeded) { ver = v; break; }
    }
    const cap = QR_CAP[ver];
    const sz = ver * 4 + 17;
    const bits = [];
    const pushBits = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pushBits(0b0100, 4);
    pushBits(len, 8);
    for (const b of bytes) pushBits(b, 8);
    for (let i = 0; i < 4 && bits.length < cap.dc * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const padWords = [0xEC, 0x11]; let pi = 0;
    while (bits.length < cap.dc * 8) { pushBits(padWords[pi % 2], 8); pi++; }
    const dataBytes = new Uint8Array(cap.dc);
    for (let i = 0; i < cap.dc; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i * 8 + j];
      dataBytes[i] = b;
    }
    const blocks = []; let offset = 0;
    for (let b = 0; b < cap.b1; b++) {
      const d = dataBytes.slice(offset, offset + cap.dc1); offset += cap.dc1;
      blocks.push({ data: d, ecc: rsEncode(d, cap.ecc) });
    }
    for (let b = 0; b < cap.b2; b++) {
      const d = dataBytes.slice(offset, offset + cap.dc2); offset += cap.dc2;
      blocks.push({ data: d, ecc: rsEncode(d, cap.ecc) });
    }
    const finalBytes = [];
    const maxData = Math.max(cap.dc1, cap.dc2 || 0);
    for (let i = 0; i < maxData; i++)
      for (const bl of blocks)
        if (i < bl.data.length) finalBytes.push(bl.data[i]);
    for (let i = 0; i < cap.ecc; i++)
      for (const bl of blocks)
        finalBytes.push(bl.ecc[i]);
    const finalBits = [];
    for (const byte of finalBytes) for (let i = 7; i >= 0; i--) finalBits.push((byte >> i) & 1);
    const remBits = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0][ver] || 0;
    for (let i = 0; i < remBits; i++) finalBits.push(0);
    const mat  = Array.from({ length: sz }, () => new Int8Array(sz).fill(-1));
    const func = Array.from({ length: sz }, () => new Uint8Array(sz));
    const setMod = (r, c, v, f = 0) => { if (r >= 0 && r < sz && c >= 0 && c < sz) { mat[r][c] = v; if (f) func[r][c] = 1; } };
    const placeFinder = (tr, tc) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const v = (r >= 0 && r <= 6 && c >= 0 && c <= 6)
          ? (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ? 1 : 0
          : -1;
        setMod(tr + r, tc + c, v < 0 ? 0 : v, 1);
      }
    };
    placeFinder(0, 0); placeFinder(0, sz - 7); placeFinder(sz - 7, 0);
    for (let i = 8; i < sz - 8; i++) { setMod(6, i, i % 2 ? 0 : 1, 1); setMod(i, 6, i % 2 ? 0 : 1, 1); }
    setMod(sz - 8, 8, 1, 1);
    const FI_COORDS = [];
    for (let i = 0; i < 6; i++) FI_COORDS.push([8, i]);
    FI_COORDS.push([8, 7], [8, 8], [7, 8]);
    for (let i = 5; i >= 0; i--) FI_COORDS.push([i, 8]);
    for (let i = sz - 7; i < sz; i++) FI_COORDS.push([i, 8]);
    for (let i = sz - 8; i < sz; i++) FI_COORDS.push([8, i]);
    FI_COORDS.forEach(([r, c]) => func[r][c] = 1);
    const ap = ALIGN_POS[ver] || [];
    for (const ar of ap) for (const ac of ap) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === ap[ap.length - 1]) || (ar === ap[ap.length - 1] && ac === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const v = (dr === -2 || dr === 2 || dc === -2 || dc === 2) ? 1 : (dr === 0 && dc === 0) ? 1 : 0;
        setMod(ar + dr, ac + dc, v, 1);
      }
    }
    let bi = 0, upward = true;
    for (let right = sz - 1; right >= 0; right -= 2) {
      if (right === 6) right = 5;
      for (let pass = 0; pass < sz; pass++) {
        const row = upward ? (sz - 1 - pass) : pass;
        for (let col = right; col >= right - 1; col--) {
          if (func[row][col]) continue;
          mat[row][col] = bi < finalBits.length ? finalBits[bi++] : 0;
        }
      }
      upward = !upward;
    }
    function applyMask(m, matrix) {
      const masked = matrix.map(r => new Int8Array(r));
      const maskFn = [
        (r, c) => (r + c) % 2 === 0,
        (r, c) => r % 2 === 0,
        (r, c) => c % 3 === 0,
        (r, c) => (r + c) % 3 === 0,
        (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
        (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
        (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
        (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
      ];
      for (let r = 0; r < sz; r++)
        for (let c = 0; c < sz; c++)
          if (!func[r][c] && masked[r][c] !== -1)
            masked[r][c] ^= (maskFn[m](r, c) ? 1 : 0);
      return masked;
    }
    function applyFormatInfo(m, matrix) {
      const fi = FORMAT_INFO[m];
      const bits15 = [];
      for (let i = 14; i >= 0; i--) bits15.push((fi >> i) & 1);
      const coords1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
      const coords2 = [[sz-1,8],[sz-2,8],[sz-3,8],[sz-4,8],[sz-5,8],[sz-6,8],[sz-7,8],[8,sz-8],[8,sz-7],[8,sz-6],[8,sz-5],[8,sz-4],[8,sz-3],[8,sz-2],[8,sz-1]];
      coords1.forEach(([r, c], i) => matrix[r][c] = bits15[i]);
      coords2.forEach(([r, c], i) => matrix[r][c] = bits15[i]);
    }
    function penalty(matrix) {
      let p = 0;
      for (let r = 0; r < sz; r++) {
        let run = 1;
        for (let c = 1; c < sz; c++) {
          if (matrix[r][c] === matrix[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else run = 1;
        }
      }
      for (let c = 0; c < sz; c++) {
        let run = 1;
        for (let r = 1; r < sz; r++) {
          if (matrix[r][c] === matrix[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else run = 1;
        }
      }
      for (let r = 0; r < sz - 1; r++)
        for (let c = 0; c < sz - 1; c++)
          if (matrix[r][c] === matrix[r][c+1] && matrix[r][c] === matrix[r+1][c] && matrix[r][c] === matrix[r+1][c+1])
            p += 3;
      let dark = 0;
      matrix.forEach(row => { for (const v of row) if (v === 1) dark++; });
      const ratio = dark / (sz * sz);
      p += 10 * Math.abs(Math.round(ratio * 20) - 10);
      return p;
    }
    let bestMask = 0, bestPen = Infinity, bestMatrix = null;
    for (let m = 0; m < 8; m++) {
      const masked = applyMask(m, mat);
      applyFormatInfo(m, masked);
      const pen = penalty(masked);
      if (pen < bestPen) { bestPen = pen; bestMask = m; bestMatrix = masked; }
    }
    return { matrix: bestMatrix, size: sz, version: ver };
  }

  function drawQRToCanvas(canvas, text, moduleSize) {
    moduleSize = moduleSize || 4;
    let qr;
    try { qr = encodeQR(text); }
    catch (e) { console.error("QR encode error:", e); return false; }
    const quiet = 4;
    const sz    = qr.size;
    const total = (sz + quiet * 2) * moduleSize;
    canvas.width  = total;
    canvas.height = total;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < sz; r++)
      for (let c = 0; c < sz; c++)
        if (qr.matrix[r][c] === 1)
          ctx.fillRect((c + quiet) * moduleSize, (r + quiet) * moduleSize, moduleSize, moduleSize);
    return true;
  }

  window.__encodeQR       = encodeQR;
  window.__drawQRToCanvas = drawQRToCanvas;
})();

// ── QRSvg — React component QR code via canvas ───────────────────────────────
export function QRSvg({ value, size = 160 }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        if (window.__drawQRToCanvas) {
          const ok = window.__drawQRToCanvas(canvas, value, Math.floor(size / 37));
          if (ok) { setReady(true); return; }
        }
        if (window.qrcodegen) {
          const QRC = window.qrcodegen.QrCode;
          const code = QRC.encodeText(value, QRC.Ecc.MEDIUM);
          const n    = code.size;
          const mod  = Math.floor(size / (n + 8));
          const quiet = 4;
          const total = (n + quiet * 2) * mod;
          canvas.width = total; canvas.height = total;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, total, total);
          ctx.fillStyle = "#000";
          for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++)
              if (code.getModule(x, y))
                ctx.fillRect((x + quiet) * mod, (y + quiet) * mod, mod, mod);
          setReady(true);
        }
      } catch (e) { console.warn("QR draw error", e); }
    };
    if (window.__drawQRToCanvas || window.qrcodegen) { draw(); }
    else {
      const t = setInterval(() => {
        if (window.__drawQRToCanvas || window.qrcodegen) { clearInterval(t); draw(); }
      }, 100);
      return () => clearInterval(t);
    }
  }, [value, size]);

  return (
    <div style={{ background: "#fff", borderRadius: 8, display: "inline-block", padding: 4 }}>
      {!ready && (
        <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--tx-ghost)" }}>
          Memuat QR...
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: ready ? "block" : "none", borderRadius: 6 }} />
    </div>
  );
}

// ── CamScanner — kamera + decode QR real-time ─────────────────────────────────
export function CamScanner({ onScan, onClose, customDecode }) {
  const vRef     = useRef(null);
  const cRef     = useRef(null);
  const stateRef = useRef({ stream: null, raf: null, active: false, done: false });
  const cbRef    = useRef({ onScan, customDecode });
  cbRef.current  = { onScan, customDecode };

  const [status,  setStatus]  = useState("idle");
  const [hitText, setHitText] = useState("");
  const [errMsg,  setErrMsg]  = useState("");
  const [jsReady, setJsReady] = useState(!!window.jsQR);

  useEffect(() => {
    if (window.BarcodeDetector || window.jsQR) { setJsReady(true); return; }
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";
    sc.onload = () => {
      setJsReady(true);
      const st = stateRef.current;
      if (st.active && !st.raf && !st.done && st.restartDecode)
        st.raf = requestAnimationFrame(st.restartDecode);
    };
    document.head.appendChild(sc);
  }, []);

  const hardStop = useCallback(() => {
    const st = stateRef.current;
    st.active = false;
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
    if (st.stream) { st.stream.getTracks().forEach(t => t.stop()); st.stream = null; }
    if (vRef.current) vRef.current.srcObject = null;
    setStatus(s => (s === "live" || s === "starting") ? "idle" : s);
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
      const result = cd ? cd(raw) : (decQR(raw) || ALL_AREAS.find(a => raw.includes(a)) || null);
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
        .then(bs => { if (!bs.length || !tryResult(bs[0].rawValue)) { if (st.active) st.raf = requestAnimationFrame(decodeFrame); } })
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
    setStatus("starting"); setErrMsg(""); setHitText(""); st.done = false; st.active = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      st.stream = stream;
      const v = vRef.current;
      if (!v) { stream.getTracks().forEach(t => t.stop()); st.stream = null; return; }
      v.srcObject = stream;
      const go = () => {
        v.play().then(() => { st.active = true; setStatus("live"); st.raf = requestAnimationFrame(decodeFrame); }).catch(() => {});
      };
      if (v.readyState >= 1) go(); else v.onloadedmetadata = go;
    } catch {
      setStatus("err");
      setErrMsg("Kamera tidak dapat diakses. Pastikan izin kamera diberikan.");
    }
  }, [decodeFrame]);

  useEffect(() => {
    stateRef.current.restartDecode = decodeFrame;
    start();
    return () => { stateRef.current.done = true; hardStop(); };
  }, []);

  const isLive  = status === "live";
  const isHit   = status === "hit";
  const isErr   = status === "err";
  const isStart = status === "starting" || status === "idle";
  const hasBD   = !!window.BarcodeDetector;

  const cornerStyles = [
    { top: "0%",  bottom: "auto", right: "auto", left: "0%",  borderRadius: "8px 0 0 0" },
    { top: "auto",bottom: "0%",   right: "auto", left: "0%",  borderRadius: "0 0 0 8px" },
    { top: "0%",  bottom: "auto", right: "0%",   left: "auto",borderRadius: "0 8px 0 0" },
    { top: "auto",bottom: "0%",   right: "0%",   left: "auto",borderRadius: "0 0 8px 0" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%" }}>
      <div style={{ position: "relative", background: "var(--tx-primary)", height: "100%", minHeight: 280, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <video
          ref={vRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: (isLive || isHit) ? "block" : "none" }}
          playsInline
          muted
        />
        <canvas ref={cRef} style={{ display: "none" }} />

        {isLive && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: 200, height: 200, position: "relative" }}>
              {cornerStyles.map((cs, i) => (
                <div key={i} style={{
                  position: "absolute",
                  width: 28, height: 28,
                  ...cs,
                  borderTop:    cs.top    === "0%"   ? "3px solid var(--accent-light)" : "none",
                  borderBottom: cs.bottom === "0%"   ? "3px solid var(--accent-light)" : "none",
                  borderLeft:   cs.left   === "0%"   ? "3px solid var(--accent-light)" : "none",
                  borderRight:  cs.right  === "0%"   ? "3px solid var(--accent-light)" : "none",
                }} />
              ))}
              <div style={{ position: "absolute", inset: -9999, boxShadow: "inset 0 0 0 9999px rgba(0,0,0,.55)", pointerEvents: "none" }} />
            </div>
          </div>
        )}

        {isHit && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.5)" }}>
            <div style={{ background: "var(--accent)", color: "#fff", borderRadius: 12, padding: "14px 24px", fontWeight: 800, fontSize: 15, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}></div>
              {hitText}
            </div>
          </div>
        )}

        {isStart && (
          <div style={{ textAlign: "center", color: "#fff", padding: 28 }}>
            <div style={{ fontSize: 44 }}></div>
            <div style={{ marginTop: 10, fontSize: 13 }}>{status === "starting" ? "Memulai kamera..." : "Kamera siap"}</div>
          </div>
        )}

        {isErr && (
          <div style={{ textAlign: "center", color: "rgba(var(--red-rgb),.4)", padding: 24, fontSize: 12.5 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}></div>
            {errMsg}
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px 16px" }}>
        {isLive && (
          <div style={{
            background: (hasBD || jsReady) ? "rgba(var(--green-rgb),.08)" : "rgba(var(--amber-rgb),.08)",
            border: "1px solid " + ((hasBD || jsReady) ? "rgba(var(--green-rgb),.4)" : "var(--amber)"),
            borderRadius: 8, padding: "7px 12px", marginBottom: 10,
            fontSize: 12, color: (hasBD || jsReady) ? "var(--accent)" : "var(--amber)"
          }}>
            {hasBD
              ? " BarcodeDetector aktif — arahkan ke QR code"
              : jsReady
                ? " jsQR aktif — arahkan kamera ke QR code"
                : "⏳ Memuat decoder..."}
          </div>
        )}
      </div>
    </div>
  );
}

// ── QRPatrolTab ───────────────────────────────────────────────────────────────
export function QRPatrolTab({ patrols, setPatrols, posAssign, toast, currentUser, canEdit = true, reguHari, isUserLibur }) {
  const [scanOpen,     setScanOpen]     = useState(false);
  const [lastHit,      setLastHit]      = useState(null);
  const [tab,          setInnerTab]     = useState("scan");
  const [showFallback, setShowFallback] = useState(false);
  const [confirm,      setConfirm]      = useState(null);
  const [checks,       setChecks]       = useState({});
  const [notes,        setNotes]        = useState("");
  const [officer,      setOfficer]      = useState("");
  const [photo,        setPhoto]        = useState(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const fileRef = useRef();

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { kompressFoto(r.result).then(c => setPhoto(c)); };
    r.readAsDataURL(file);
  };

  const myName   = currentUser?.name || "";
  const todayStr = new Date().toDateString();

  const myToday = patrols.filter(p =>
    new Date(p.ts).toDateString() === todayStr && p.officer && p.officer.includes(myName)
  );
  const doneAreas = new Set(
    patrols.filter(p => new Date(p.ts).toDateString() === todayStr).flatMap(p => p.areas || [])
  );
  const totalArea = ALL_AREAS.length;
  const doneCnt   = doneAreas.size;
  const pct       = totalArea > 0 ? Math.round(doneCnt / totalArea * 100) : 0;

  const openAreaChecklist = (area, viaQR = false) => {
    if (!ALL_AREAS.includes(area)) { toast("Area tidak dikenali!", false); return; }
    const pos = Object.entries(PATROL_AREAS).find(([, as]) => as.includes(area))?.[0] ?? "—";
    const officerName = myName || currentUser?.name || "";
    const lastByOfficer = patrols
      .filter(p => p.areas?.includes(area) && p.officer && p.officer.includes(officerName))
      .slice(-1)[0];
    if (lastByOfficer && Date.now() - lastByOfficer.ts < 3600000) {
      const sisaMenit = Math.ceil((3600000 - (Date.now() - lastByOfficer.ts)) / 60000);
      toast(`Kamu sudah patroli area ini. Tunggu ${sisaMenit} menit lagi.`, false);
      return;
    }
    const initChecks = {};
    CHECKLIST_ITEMS.forEach(k => { initChecks[k] = null; });
    setChecks(initChecks); setNotes(""); setPhoto(null);
    setOfficer(myName || "");
    setConfirm({ area, pos, viaQR });
  };

  const handleScan = (area) => { setScanOpen(false); openAreaChecklist(area, true); };

  useEffect(() => {
    const pending = useAppStore.getState().pendingPatrolArea;
    if (pending) {
      useAppStore.getState().setPendingPatrolArea(null);
      const { area, viaQR } = pending;
      if (area && ALL_AREAS.includes(area)) openAreaChecklist(area, viaQR !== false);
    }
  }, []);

  const doPatrol = async () => {
    if (!photo) { toast("Foto bukti wajib diambil!", false); return; }
    setIsSaving(true);
    const entry = {
      id: Date.now(), ts: Date.now(),
      pos: confirm.pos, officer: officer || myName || "—",
      areas: [confirm.area], notes,
      checks: Object.keys(checks).filter(k => checks[k] !== null),
      checkStatus: { ...checks },
      photo, viaQR: !!confirm.viaQR,
    };
    try {
      await setPatrols([...patrols, entry]);
      setLastHit({ area: confirm.area, pos: confirm.pos, ts: Date.now() });
      setConfirm(null);
      toast(` Patroli ${confirm.area} tercatat${confirm.viaQR ? " via QR" : " manual"}!`);
    } catch {
      toast("❌ Gagal menyimpan patroli. Periksa koneksi lalu coba lagi.", false);
    } finally {
      setIsSaving(false);
    }
  };

  const fmtTime     = (ts) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const statusColor = pct >= 80 ? "var(--accent)" : pct >= 40 ? "var(--amber)" : "var(--red)";

  const STATUS_BG_MAP = {
    aman:      "rgba(var(--orb-rgb),.08)",
    perhatian: "rgba(var(--amber-rgb),.10)",
    rusak:     "rgba(201,27,42,.08)",
  };

  return (
    <div style={{ padding: "16px 16px 80px" }}>

      {/* ReadOnly banner */}
      {!canEdit && (
        <div style={{ background: "rgba(201,27,42,.08)", border: "1.5px solid rgba(201,27,42,.45)", borderRadius: 14, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}></span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--red)" }}>Mode Baca Saja</div>
            <div style={{ fontSize: 11, color: "var(--tx-muted)" }}>
              {isUserLibur
                ? "Kamu sedang libur/lepas hari ini — tidak dapat melakukan patroli."
                : `Hanya Regu ${reguHari || ""} (piket hari ini) yang dapat mengisi data.`}
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border2)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-muted)", textTransform: "uppercase", letterSpacing: .5 }}>Progress Patroli Hari Ini</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: statusColor }}>{doneCnt}/{totalArea} ({pct}%)</span>
        </div>
        <div style={{ background: "var(--bg-raised)", borderRadius: 99, height: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: statusColor, width: pct + "%", transition: "width .5s ease" }} />
        </div>
      </div>

      {/* Tombol scan utama */}
      <div style={{ marginBottom: 16, opacity: canEdit ? 1 : 0.45, pointerEvents: canEdit ? "auto" : "none" }}>
        <button
          onClick={() => canEdit && setScanOpen(true)}
          disabled={!canEdit}
          style={{
            width: "100%", padding: "20px 16px", marginBottom: 8,
            background: canEdit ? "var(--accent)" : "var(--tx-muted)",
            border: "none", borderRadius: 16, cursor: canEdit ? "pointer" : "not-allowed",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            boxShadow: canEdit ? "0 4px 24px rgba(14,165,233,.35)" : "none", color: "#fff",
          }}
        >
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3"  y="3"  width="7" height="7" rx="1" />
            <rect x="14" y="3"  width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3"  y="14" width="7" height="7" rx="1" />
            <rect x="5"  y="5"  width="3" height="3" fill="#fff" stroke="none" />
            <rect x="16" y="5"  width="3" height="3" fill="#fff" stroke="none" />
            <rect x="16" y="16" width="3" height="3" fill="#fff" stroke="none" />
            <rect x="5"  y="16" width="3" height="3" fill="#fff" stroke="none" />
          </svg>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Scan QR Pos</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)" }}>Arahkan kamera ke QR code di pos</div>
        </button>

        {/* Tombol fallback manual */}
        <button
          onClick={() => setShowFallback(f => !f)}
          style={{
            width: "100%", padding: "10px 16px",
            background: showFallback ? "rgba(var(--amber-rgb),.12)" : "var(--bg-surface)",
            border: `1.5px solid ${showFallback ? "var(--amber)" : "var(--border2)"}`,
            borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s",
          }}
        >
          <span style={{ fontSize: 16 }}></span>
          <div style={{ textAlign: "left", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: showFallback ? "var(--amber)" : "var(--tx-secondary)" }}>Input Manual</div>
            <div style={{ fontSize: 11, color: "var(--tx-muted)" }}>Jika kamera tidak tersedia</div>
          </div>
          <span style={{ fontSize: 14, color: "var(--tx-muted)" }}>{showFallback ? "▲" : "▼"}</span>
        </button>

        {/* Orb fallback grid */}
        {showFallback && (
          <div style={{ marginTop: 12 }}>
            {Object.entries(PATROL_AREAS).map(([pos, areas]) => (
              <div key={pos} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--tx-muted)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 7 }}> {pos}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {areas.map(area => {
                    const done = doneAreas.has(area);
                    return (
                      <button
                        key={area}
                        onClick={() => canEdit && openAreaChecklist(area, false)}
                        style={{
                          padding: "10px 8px", borderRadius: 10,
                          border: `1.5px solid ${done ? "var(--accent)" : "var(--border2)"}`,
                          background: done ? "rgba(var(--orb-rgb),.08)" : "var(--bg-surface)",
                          fontSize: 11.5, fontWeight: 700, cursor: canEdit ? "pointer" : "default",
                          color: done ? "var(--accent)" : "var(--tx-secondary)", fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 5,
                          minHeight: 44, textAlign: "left",
                        }}
                      >
                        <span>{done ? "" : "○"}</span>
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scanner modal */}
      {scanOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,.97)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "max(env(safe-area-inset-top),18px) 16px 12px", background: "rgba(0,0,0,.5)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}> Scan QR Patroli</div>
            <button onClick={() => setScanOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}></button>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <CamScanner onScan={handleScan} onClose={() => setScanOpen(false)} />
          </div>
        </div>
      )}

      {/* Checklist modal */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 950, background: "var(--scrim)", backdropFilter: "blur(8px)", display: "flex", alignItems: "stretch", justifyContent: "stretch" }}>
          <div style={{ background: "var(--bg-surface)", borderRadius: 0, width: "100%", height: "100%", maxHeight: "none", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {/* Sticky header */}
            <div style={{ position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1, padding: "16px 18px 12px", borderBottom: "1px solid var(--border)", borderRadius: "20px 20px 0 0" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>✓ Checklist Patroli</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "var(--tx-primary)" }}>{confirm.area}</div>
              <div style={{ fontSize: 12, color: "var(--tx-muted)", marginTop: 2 }}> {confirm.pos}{confirm.viaQR ? " · via QR" : " · manual"}</div>
            </div>
            {/* Scrollable content */}
            <div style={{ padding: "16px 18px 32px", overflowY: "auto" }}>
              {/* Checklist items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {CHECKLIST_ITEMS.map((item, idx) => {
                  const sel    = checks[item];
                  const opt    = CHECKLIST_STATUS_OPTS.find(o => o.val === sel);
                  const hasStatus = !!sel;
                  const now_ts = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div
                      key={item}
                      style={{
                        background: hasStatus ? STATUS_BG_MAP[sel] : "var(--bg-surface)",
                        border: `${hasStatus ? 2 : 1}px solid ${hasStatus ? opt.border : "var(--border)"}`,
                        borderRadius: 12, padding: "10px 12px", transition: "all .2s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hasStatus ? 8 : 6 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: hasStatus ? `${opt.color}18` : "rgba(var(--orb-rgb),.10)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, color: hasStatus ? opt.color : "var(--accent)", fontSize: 12, flexShrink: 0,
                        }}>{idx + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--tx-secondary)" }}>
                            {CHECKLIST_ICON[item] || ""} {item}
                          </div>
                        </div>
                        {hasStatus && (
                          <div style={{
                            background: STATUS_BG_MAP[sel],
                            border: `1px solid ${opt.border}44`,
                            borderRadius: 8, padding: "3px 8px",
                            fontSize: 11, fontWeight: 700, color: opt.color,
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                            {opt.label}
                            <span style={{ fontWeight: 400, color: "var(--tx-muted)", fontSize: 10 }}>{now_ts}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {CHECKLIST_STATUS_OPTS.map(o => (
                          <button
                            key={o.val}
                            onClick={() => setChecks(c => ({ ...c, [item]: c[item] === o.val ? null : o.val }))}
                            style={{
                              flex: 1, padding: "7px 4px", borderRadius: 8,
                              border: `1.5px solid ${sel === o.val ? o.border : "var(--border2)"}`,
                              background: sel === o.val ? o.bgActive : "var(--bg-raised)",
                              color: sel === o.val ? o.color : "var(--tx-secondary)",
                              fontWeight: sel === o.val ? 700 : 600,
                              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            {o.icon} {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Catatan */}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border2)", background: "var(--bg-raised)", color: "var(--tx)", fontSize: 13, fontFamily: "inherit", resize: "none", minHeight: 68, marginBottom: 14, boxSizing: "border-box" }}
              />

              {/* Foto */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx-muted)", marginBottom: 8 }}> Foto Bukti (wajib)</div>
                {photo
                  ? (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <img src={photo} style={{ width: "100%", maxHeight: 200, borderRadius: 10, objectFit: "cover" }} alt="foto bukti" />
                      <button onClick={() => setPhoto(null)} style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: 14 }}></button>
                    </div>
                  )
                  : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      style={{ width: "100%", padding: "18px", border: "2px dashed var(--border2)", borderRadius: 12, background: "var(--bg-raised)", color: "var(--tx-muted)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                    >
                       Ambil / Pilih Foto
                    </button>
                  )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhoto} />
              </div>

              {/* Tombol aksi */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <BtnSimpan onClick={doPatrol} loading={isSaving}> Simpan Patroli</BtnSimpan>
                <BtnBatal onClick={() => setConfirm(null)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── QRAdminTab ────────────────────────────────────────────────────────────────
export function QRAdminTab({ patrols, posAssign }) {
  const [innerTab, setInnerTab] = useState("generate");
  const [selPos,   setSelPos]   = useState(null);
  const [selArea,  setSelArea]  = useState(null);
  const [rekDay,   setRekDay]   = useState(new Date().toISOString().slice(0, 10));

  const todayStr  = new Date(rekDay + "T00:00:00").toDateString();
  const rekPatrol = patrols.filter(p => new Date(p.ts).toDateString() === todayStr);
  const donePct   = ALL_AREAS.length > 0
    ? Math.round(new Set(rekPatrol.flatMap(p => p.areas || [])).size / ALL_AREAS.length * 100)
    : 0;
  const byOfficer = rekPatrol.reduce((acc, p) => {
    const key = p.officer || "—";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const fmtTime = ts => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ padding: "16px 16px 80px" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 900, color: "var(--tx-secondary)" }}>QR Patroli</h2>
        <p style={{ margin: 0, color: "var(--tx-muted)", fontSize: 12 }}>Generate & rekap scan QR anggota</p>
      </div>

      {/* Tab switch */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-surface)", borderRadius: 10, padding: 3, marginBottom: 16, border: "1px solid var(--border2)" }}>
        {[["generate", " Generate QR"], ["rekap", " Rekap"]].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setInnerTab(v)}
            style={{
              flex: 1, padding: "9px 6px", border: "none", borderRadius: 8,
              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              background: innerTab === v ? "var(--accent)" : "transparent",
              color: innerTab === v ? "#fff" : "var(--tx-muted)", transition: "all .2s",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Generate QR ── */}
      {innerTab === "generate" && (
        <div>
          <div style={{ fontSize: 11, color: "var(--tx-muted)", marginBottom: 12 }}>
            Tap gedung/area untuk melihat QR. Print atau screenshot untuk dipasang di lokasi.
          </div>
          {Object.entries(PATROL_AREAS).map(([pos, areas]) => {
            const col = POS_RING[pos] || { ring: "var(--accent)", fill: "var(--pill-active)" };
            return (
              <div key={pos} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: .8, color: col.ring, marginBottom: 7, paddingLeft: 2 }}> {pos}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {areas.map(a => (
                    <button
                      key={a}
                      onClick={() => { setSelArea(a); setSelPos(pos); }}
                      style={{
                        background: selArea === a ? "rgba(100,100,100,.10)" : "var(--bg-surface)",
                        border: `1.5px solid ${selArea === a ? "var(--accent)" : "var(--border2)"}`,
                        borderRadius: 10, padding: "10px 8px", cursor: "pointer",
                        fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                        color: selArea === a ? "var(--accent)" : "var(--tx-secondary)",
                        textAlign: "center", transition: "all .15s",
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {selArea && (
            <div style={{ position: "sticky", bottom: 72, marginTop: 12, background: "var(--bg-surface)", border: "2px solid var(--accent)", borderRadius: 16, padding: 16, textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
              <div style={{ fontSize: 12, color: "var(--tx-muted)", marginBottom: 8 }}> {selPos} → {selArea}</div>
              <div style={{ display: "inline-block", padding: 12, background: "#fff", borderRadius: 12 }}>
                <QRSvg value={QR_PREFIX + selArea.replace(/ /g, "_")} size={180} />
              </div>
              <div style={{ fontSize: 9, color: "var(--tx-muted)", marginTop: 8, fontFamily: "monospace", letterSpacing: .5 }}>
                {QR_PREFIX + selArea.replace(/ /g, "_")}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--tx-muted)" }}>Screenshot atau print QR ini untuk dipasang di lokasi</div>
              <BtnBatal onClick={() => { setSelArea(null); setSelPos(null); }}>Tutup</BtnBatal>
            </div>
          )}
        </div>
      )}

      {/* ── Rekap ── */}
      {innerTab === "rekap" && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--tx-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, display: "block", marginBottom: 6 }}>Tanggal</label>
            <input
              type="date"
              value={rekDay}
              onChange={e => setRekDay(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", background: "var(--bg-surface)", border: "1px solid var(--border2)", borderRadius: 9, color: "var(--tx)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              ["Area Dipat.", new Set(rekPatrol.flatMap(p => p.areas || [])).size + "/" + ALL_AREAS.length, "var(--accent)"],
              ["Total Log",   rekPatrol.length, "var(--accent)"],
              ["Progress",    donePct + "%", donePct >= 80 ? "var(--accent)" : donePct >= 40 ? "var(--amber)" : "var(--red)"],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: "var(--bg-surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: c, marginBottom: 3 }}>{v}</div>
                <div style={{ fontSize: 10, color: "var(--tx-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>{l}</div>
              </div>
            ))}
          </div>

          {Object.keys(byOfficer).length === 0
            ? (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--tx-muted)", fontSize: 13, background: "var(--bg-surface)", border: "1px solid var(--border2)", borderRadius: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                Belum ada data patroli untuk tanggal ini.
              </div>
            )
            : Object.entries(byOfficer).map(([officer, logs]) => {
                const myAreas = new Set(logs.flatMap(p => p.areas || []));
                return (
                  <div key={officer} style={{ background: "var(--bg-surface)", border: "1px solid var(--border2)", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tx-primary)" }}>{officer}</div>
                      <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>{myAreas.size} area · {logs.length} log</div>
                    </div>
                    <div style={{ padding: "8px 14px 12px" }}>
                      {logs.map((p, i) => (
                        <div key={i} style={{ fontSize: 11, color: "var(--tx-muted)", marginBottom: 4, display: "flex", gap: 8, alignItems: "baseline" }}>
                          <span style={{ fontWeight: 700, color: "var(--accent)" }}>{fmtTime(p.ts)}</span>
                          <span>{(p.areas || []).join(", ") || "—"}</span>
                          {p.viaQR && <span style={{ fontSize: 9, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>QR</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}
    </div>
  );
}

// ── QRScannerModal — Navbar QR scanner untuk Patroli & Pos Jaga ──────────────
export function QRScannerModal({ open, onClose, patrols, setPatrols, posAssign, setPosAssign, posShiftKey, toast, currentUser, setTab, setTabKey }) {
  const [result,  setResult]  = useState(null);
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    if (!open) setResult(null);
    else { setScanKey(k => k + 1); setResult(null); }
  }, [open]);

  const customDecode = useCallback((raw) => {
    const area = decQR(raw);
    if (area && ALL_AREAS.includes(area)) return "PAT:" + area;
    const pos = decPosQR(raw) || POS_LIST.find(p => raw.includes(p));
    if (pos && POS_LIST.includes(pos)) return "POS:" + pos;
    return null;
  }, []);

  const handleScan = useCallback((decoded) => {
    if (!decoded) return;
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);

    if (decoded.startsWith("PAT:")) {
      const area = decoded.replace("PAT:", "");
      const pos  = Object.entries(PATROL_AREAS).find(([, as]) => as.includes(area))?.[0] ?? "—";
      const officerName = currentUser?.name || "";
      const lastByOfficer = patrols
        .filter(p => p.areas?.includes(area) && p.officer && p.officer.includes(officerName))
        .slice(-1)[0];
      if (lastByOfficer && Date.now() - lastByOfficer.ts < 3600000) {
        const sisaMenit = Math.ceil((3600000 - (Date.now() - lastByOfficer.ts)) / 60000);
        setResult({ type: "patrol", name: area, pos, ok: false, msg: `Kamu sudah patroli area ini. Tunggu ${sisaMenit} menit lagi.` });
        return;
      }
      setResult({ type: "patrol", name: area, pos, ok: true });
    } else if (decoded.startsWith("POS:")) {
      const posName = decoded.replace("POS:", "");
      const myName  = currentUser?.name;
      if (!myName) { toast("Tidak ada pengguna login!", false); onClose(); return; }
      const asgn = (posAssign && posAssign[posName]) || [];
      const cap  = POS_CAP[posName] || 1;
      if (asgn.includes(myName)) { setResult({ type: "pos", name: posName, ok: false, msg: "Anda sudah berada di pos ini!" }); return; }
      if (asgn.length >= cap)   { setResult({ type: "pos", name: posName, ok: false, msg: posName + " sudah penuh!" }); return; }
      const updated = { ...posAssign };
      POS_LIST.forEach(p => { if (updated[p]) updated[p] = updated[p].filter(m => m !== myName); });
      updated[posName] = [...(updated[posName] || []), myName];
      if (setPosAssign) setPosAssign(posShiftKey, updated);
      setResult({ type: "pos", name: posName, ok: true, msg: ` ${myName} → ${posName}!` });
    }
  }, [currentUser, patrols, posAssign, setPosAssign, posShiftKey, toast, onClose]);

  const goToPatrol = () => {
    onClose();
    if (setTab) setTab("patrol");
    if (setTabKey) setTabKey(k => k + 1);
    if (result?.name) useAppStore.getState().setPendingPatrolArea({ area: result.name, pos: result.pos, viaQR: true });
  };
  const rescan = () => { setResult(null); setScanKey(k => k + 1); };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.97)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "max(env(safe-area-inset-top),20px) 18px 14px", background: "rgba(0,0,0,.6)", backdropFilter: "blur(10px)", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: -.3 }}> Scan QR</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 1 }}>QR Patroli (BBPKA2-PAMDAL-…) & Pos (BBPKA2-POS-…)</div>
        </div>
        <button
          onClick={onClose}
          style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.12)", border: "none", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          
        </button>
      </div>

      {/* Scanner */}
      {!result && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflow: "hidden" }} key={scanKey}>
            <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <CamScanner onScan={handleScan} onClose={onClose} customDecode={customDecode} />
            </div>
          </div>
        </div>
      )}

      {/* Hasil scan */}
      {result && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, gap: 16 }}>
          <div style={{ width: 88, height: 88, borderRadius: 22, background: result.ok ? "rgba(var(--green-rgb),.15)" : "rgba(201,27,42,.15)", border: `2.5px solid ${result.ok ? "var(--accent)" : "var(--red)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>
            {result.ok ? (result.type === "patrol" ? "" : "") : ""}
          </div>
          <div style={{ background: "var(--bg-surface)", borderRadius: 18, padding: "20px 24px", border: `1px solid ${result.ok ? "var(--br-default)" : "rgba(201,27,42,.3)"}`, textAlign: "center", maxWidth: 300, width: "100%" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: result.ok ? "var(--accent)" : "var(--red)", marginBottom: 6 }}>
              {result.ok ? (result.type === "patrol" ? " Area Patroli Terdeteksi" : " Pos Jaga Tercatat") : " Gagal"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--tx-primary)", marginBottom: 4, lineHeight: 1.2 }}>{result.name}</div>
            {result.pos && <div style={{ fontSize: 12, color: "var(--tx-muted)", marginTop: 4 }}> {result.pos}</div>}
            {result.msg && <div style={{ fontSize: 12, color: result.ok ? "var(--accent)" : "var(--red)", marginTop: 6, fontWeight: 600 }}>{result.msg}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 }}>
            {result.type === "patrol" && result.ok && (
              <button
                onClick={goToPatrol}
                style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 20px rgba(14,165,233,.5)" }}
              >
                 Lanjut Isi Checklist Patroli
              </button>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={rescan}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: result.type === "patrol" ? "rgba(255,255,255,.1)" : "var(--accent)", border: result.type === "patrol" ? "1px solid rgba(255,255,255,.2)" : "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                ↺ Scan Lagi
              </button>
              <button
                onClick={onClose}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.85)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
