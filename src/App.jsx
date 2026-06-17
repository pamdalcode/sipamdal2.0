// App.jsx — SIPAMDAL
// Migrasi dari app-main.js → Vite + React JSX + Zustand
// Catatan:
//   - State data (incidents, packages, dst) diambil dari useDataStore
//   - Auth (currentUser, login, logout) dari useAuthStore
//   - Tab, toast, confirm, overlay dari useAppStore
//   - window.__FB, window.__FB_ONLINE, window.__anyModalOpen → dihapus/diganti

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useAuthStore }  from './stores/useAuthStore.js';
import { useAppStore }   from './stores/useAppStore.js';
import { useDataStore }  from './stores/useDataStore.js';

import {
  APP_VERSION,
  ANGGOTA_DATA,
  syncAnggotaFromFirestore,
  JADWAL_START,
  getReguHari,
  getShiftKey,
  toLocalKey,
  getShift,
  cRgba,
  usePushNotif,
} from './utils/utils.js';

import {
  DEFAULT_PINS,
  savePinToFS,
  verifyPinFS,
  auditAction,
} from './stores/useAuthStore.js';

import {
  NAV_TABS, NAV_TABS_ADMIN, NAV_TABS_PIMPINAN,
  applyAccentGlobal,
  MenuOverlay,
  DockNav,
  ConfirmDialog,
} from './AppShell.jsx';

import { Modal, Inp, Btn, IC, BtnSimpan, BtnBatal } from './components/ui/UiComponents.jsx';

import { LoginScreen }   from './tabs/TabLogin.jsx';
import { WelcomeScreen } from './tabs/TabWelcome.jsx';
import { DashTab }       from './tabs/TabDash.jsx';
import { PimpinanTab }   from './tabs/TabPimpinan.jsx';
import { EvaluasiTab }   from './tabs/TabEvaluasi.jsx';
import { PosTab }        from './tabs/TabPos.jsx';
import { QRPatrolTab, QRAdminTab, QRScannerModal } from './engine/QrEngine.jsx';
import { IncTab }        from './tabs/TabInsiden.jsx';
import { PkgTab }        from './tabs/TabPaket.jsx';
import { GuestTab }      from './tabs/TabGuest.jsx';
import { MutTab }        from './tabs/TabMutasi.jsx';
import { InventarisTab } from './tabs/TabInventaris.jsx';
import { JadwalTab, JADWAL_LIBUR_DEFAULT, jadwalGenerateLibur } from './tabs/TabJadwal.jsx';
import { SearchTab }     from './tabs/TabSearch.jsx';
import { PesertaTab }    from './tabs/TabPeserta.jsx';
import { ProfileTab }    from './tabs/TabProfile.jsx';
import {
  InstruksiFormTab,
  BroadcastTab,
  AdminMemberTab,
} from './tabs/TabInstruksi.jsx';

// ── Konstanta ─────────────────────────────────────────────────────────────────

const AUTO_LOGOUT_MS = 15 * 60 * 1000;

// clearOldData: jalankan sekali saat module di-load
(function clearOldData() {
  if (localStorage.getItem('pad_app_version') === APP_VERSION) return;
  const KEEP = ['pad_pins', 'pad_admin_pin', 'pad_app_version'];
  Object.keys(localStorage)
    .filter(k => k.startsWith('pad_') && !KEEP.includes(k))
    .forEach(k => localStorage.removeItem(k));
  localStorage.setItem('pad_app_version', APP_VERSION);
  console.log('🧹 Data lama dibersihkan untuk versi', APP_VERSION);
})();

// ── ErrorBoundary ─────────────────────────────────────────────────────────────
// Tetap class component — React belum support function error boundary.

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error('[SIPAMDAL] Crash:', err, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-overlay)', padding: '24px', fontFamily: 'monospace' }}>
        <div style={{ background: '#fff', border: '2px solid #FFCDD2', borderRadius: 16, padding: '24px', maxWidth: 380, width: '100%', boxShadow: '0 4px 24px rgba(201,27,42,.12)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💥</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)', marginBottom: 8 }}>SIPAMDAL Error</div>
          <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--bg-overlay)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, wordBreak: 'break-word', lineHeight: 1.6 }}>
            {String(e.message || e)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--tx-ghost)', marginBottom: 16 }}>Lihat console browser untuk detail lengkap.</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >↺ Coba Lagi</button>
        </div>
      </div>
    );
  }
}

// ── DEFAULT_INVENTARIS fallback ───────────────────────────────────────────────

const DEFAULT_INVENTARIS_FALLBACK = [
  { id: 'inv1', nama: 'TV',          jumlah: '1 unit' },
  { id: 'inv2', nama: 'Dispenser',   jumlah: '1 unit' },
  { id: 'inv3', nama: 'Senter',      jumlah: '2 unit' },
  { id: 'inv4', nama: 'APAR',        jumlah: '1 unit' },
  { id: 'inv5', nama: 'Komputer',    jumlah: '1 unit' },
  { id: 'inv6', nama: 'Police Line', jumlah: '1 unit' },
];

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Auth store ──
  const currentUser    = useAuthStore(s => s.currentUser);
  const setCurrentUser = useAuthStore(s => s.setCurrentUser);
  const userPins       = useAuthStore(s => s.userPins);
  const setUserPins    = useAuthStore(s => s.setUserPins);

  // ── App store ──
  const tab         = useAppStore(s => s.tab);
  const setTab      = useAppStore(s => s.setTab);
  const fbOnline    = useAppStore(s => s.fbOnline);
  const notif       = useAppStore(s => s.notif);
  const toast       = useAppStore(s => s.toast);
  const textColor   = useAppStore(s => s.textColor);
  const setTextColor = useAppStore(s => s.setTextColor);

  // ── Data store ──
  const incidents          = useDataStore(s => s.incidents);
  const setIncidents       = useDataStore(s => s.setIncidents);
  const packages           = useDataStore(s => s.packages);
  const setPackages        = useDataStore(s => s.setPackages);
  const guests             = useDataStore(s => s.guests);
  const setGuests          = useDataStore(s => s.setGuests);
  const patrols            = useDataStore(s => s.patrols);
  const setPatrols         = useDataStore(s => s.setPatrols);
  const mutations          = useDataStore(s => s.mutations);
  const setMutations       = useDataStore(s => s.setMutations);
  const instruksi          = useDataStore(s => s.instruksi);
  const setInstruksi       = useDataStore(s => s.setInstruksi);
  const keluarData         = useDataStore(s => s.keluarData);
  const setKeluarData      = useDataStore(s => s.setKeluarData);
  const broadcast          = useDataStore(s => s.broadcast);
  const setBroadcast       = useDataStore(s => s.setBroadcast);
  const standJaga          = useDataStore(s => s.standJaga);
  const posRollingLog      = useDataStore(s => s.posRollingLog);
  const setPosRollingLog   = useDataStore(s => s.setPosRollingLog);
  const rollings           = useDataStore(s => s.rollings);
  const liburData          = useDataStore(s => s.liburData);
  const setLiburData       = useDataStore(s => s.setLiburData);
  const inventarisDaftar   = useDataStore(s => s.inventarisDaftar);
  const setInventarisDaftar = useDataStore(s => s.setInventarisDaftar);
  const inventarisCek      = useDataStore(s => s.inventarisCek);
  const setInventarisCek   = useDataStore(s => s.setInventarisCek);
  const waGrup             = useDataStore(s => s.waGrup);
  const setWaGrup          = useDataStore(s => s.setWaGrup);
  const statusPimpinan     = useDataStore(s => s.statusPimpinan);
  const setStatusPimpinan  = useDataStore(s => s.setStatusPimpinan);
  const posAssign          = useDataStore(s => s.posAssign);
  const setPosAssign       = useDataStore(s => s.setPosAssign);
  const loadPosAssign      = useDataStore(s => s.loadPosAssign);

  // ── Local UI state ──
  const [visitedTabs, setVisitedTabs]   = useState({ dashboard: true });
  const [tabKey, setTabKey]             = useState(0);
  const [now, setNow]                   = useState(new Date());
  const [moreOpen, setMoreOpen]         = useState(false);
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [confirmDlg, setConfirmDlg]     = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fabOpen, setFabOpen]           = useState(false);
  const [qrScanOpen, setQrScanOpen]     = useState(false);
  const inactiveTimer = useRef(null);

  // ── showConfirm local ──
  const showConfirm = (opts) => new Promise(resolve => {
    setConfirmDlg({
      ...opts,
      onConfirm: () => { setConfirmDlg(null); resolve(true); },
      onCancel:  () => { setConfirmDlg(null); resolve(false); },
    });
  });

  // ── Waktu & sync ──
  useEffect(() => { setVisitedTabs(v => ({ ...v, [tab]: true })); }, [tab]);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  useEffect(() => { syncAnggotaFromFirestore(); }, []);

  // [FIX] Effect lama di sini listen ke event 'fb_online'/'fb_offline' yang TIDAK
  // PERNAH di-dispatch di mana pun (fbOnline sudah diupdate langsung oleh
  // startOnlineProbe() di main.jsx -> useAppStore.setFbOnline()) — jadi efek itu mati
  // total (plus ada setInterval kosong yang tidak melakukan apa-apa). Dihapus.
  // ── textColor apply ke :root ──
  const TEXT_COLORS = [
    { id: 'default', label: 'Bawaan',     color: null },
    { id: 'orange',  label: 'Oranye',     color: 'var(--amber)' },
    { id: 'yellow',  label: 'Kuning',     color: 'var(--amber)' },
    { id: 'cyan',    label: 'Cyan',       color: 'var(--accent)' },
    { id: 'lime',    label: 'Hijau Muda', color: 'var(--accent)' },
  ];
  useEffect(() => {
    const col = TEXT_COLORS.find(c => c.id === textColor);
    if (col?.color) document.documentElement.style.setProperty('--tx', col.color);
    else document.documentElement.style.removeProperty('--tx');
  }, [textColor]);

  // ── Back button ──
  useEffect(() => { window.history.pushState({ sipamdal: true }, ''); }, []);
  useEffect(() => {
    const MODAL_TAB_IDS = new Set([
      'package', 'paket', 'mutation', 'inventaris', 'instruksi', 'broadcast',
      'jadwal', 'search', 'guest', 'tamu', 'keluar', 'profile', 'members',
    ]);
    const handler = () => {
      if (useAppStore.getState().anyModalOpen) {
        useAppStore.getState().setAnyModalOpen(false);
        window.dispatchEvent(new CustomEvent('sipamdal_close_modals'));
        window.history.pushState({ sipamdal: true }, '');
        return;
      }
      if (qrScanOpen) { setQrScanOpen(false); window.history.pushState({ sipamdal: true }, ''); return; }
      if (moreOpen)   { setMoreOpen(false);   window.history.pushState({ sipamdal: true }, ''); return; }
      if (MODAL_TAB_IDS.has(tab)) { setTab('dashboard'); setTabKey(k => k + 1); window.history.pushState({ sipamdal: true }, ''); return; }
      if (tab !== 'dashboard')    { setTab('dashboard'); window.history.pushState({ sipamdal: true }, ''); return; }
      window.history.pushState({ sipamdal: true }, '');
      showConfirm({
        title: 'Keluar Aplikasi?',
        message: 'Yakin ingin menutup SIPAMDAL?',
        confirmLabel: 'Keluar',
        confirmColor: 'var(--red)',
      }).then(yes => {
        if (yes) {
          try { window.close(); } catch (_) {}
          setTimeout(() => {
            try { window.history.go(-(window.history.length + 10)); } catch (_) {}
            window.location.replace('about:blank');
          }, 150);
        }
      });
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [tab, moreOpen, qrScanOpen]);

  // ── Auto logout ──
  const resetTimer = useCallback(() => {
    if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
    if (!currentUser) return;
    inactiveTimer.current = setTimeout(() => {
      auditAction(currentUser.name, currentUser.regu, 'AUTO_LOGOUT', 'Tidak aktif 15 menit');
      setCurrentUser(null);
      setTab('dashboard');
    }, AUTO_LOGOUT_MS);
  }, [currentUser]);
  useEffect(() => {
    const events = ['touchstart', 'click', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
    };
  }, [resetTimer]);

  // ── Push notif ──
  const pushNotif = usePushNotif();
  useEffect(() => {
    if (!pushNotif.isEnabled) return;
    if (!instruksi || instruksi.length === 0) return;
    const notifiedSet = notifiedInstruksiRef.current;
    let changed = false;
    instruksi.forEach(ins => {
      const id = String(ins.id);
      if (!notifiedSet.has(id) && ins.aktif && !ins.selesai) {
        notifiedSet.add(id); changed = true;
        const priIcon = ins.prioritas === 'Penting' ? '🔴' : ins.prioritas === 'Info' ? 'ℹ️' : '🟡';
        pushNotif.sendNotif(
          `${priIcon} Instruksi: ${ins.judul}`,
          ins.isi ? ins.isi.slice(0, 100) + (ins.isi.length > 100 ? '…' : '') : '',
          { tag: 'ins-' + id, priority: ins.prioritas, tab: 'instruksi' }
        );
      }
    });
    if (changed) { try { localStorage.setItem('pad_notified_ins', JSON.stringify([...notifiedSet].slice(-100))); } catch (_) {} }
  }, [instruksi, pushNotif.isEnabled]);

  useEffect(() => {
    if (!pushNotif.isEnabled) return;
    if (!broadcast?.pesan) return;
    const bcKey = String(broadcast.ts || broadcast.pesan.slice(0, 30));
    if (notifiedBroadcastRef.current === bcKey) return;
    notifiedBroadcastRef.current = bcKey;
    try { localStorage.setItem('pad_notified_bc', bcKey); } catch (_) {}
    pushNotif.sendNotif('📢 Pesan dari Pimpinan', broadcast.pesan.slice(0, 120) + (broadcast.pesan.length > 120 ? '…' : ''), { tag: 'broadcast', tab: 'dashboard' });
  }, [broadcast, pushNotif.isEnabled]);

  useEffect(() => {
    if (!pushNotif.isEnabled) return;
    if (!incidents || incidents.length === 0) return;
    const notifiedSet = notifiedIncidentRef.current;
    let changed = false;
    incidents.forEach(inc => {
      const id = String(inc.id);
      if (!notifiedSet.has(id) && inc.status === 'Aktif') {
        notifiedSet.add(id); changed = true;
        const sevIcon = inc.category === 'Penting' ? '🔴' : inc.category === 'Sedang' ? '🟡' : '🟢';
        const title = `${sevIcon} Insiden ${inc.category}: ${inc.title}`;
        const body  = [inc.desc, inc.pos ? `📍 ${inc.pos}` : null, inc.officer ? `👮 ${inc.officer}` : null]
          .filter(Boolean).join(' — ').slice(0, 120);
        pushNotif.sendNotif(title, body, {
          tag: 'inc-' + id, priority: inc.category, tab: 'incident', tipe: 'insiden',
          vibrate: inc.category === 'Penting' ? [300, 100, 300, 100, 300] : [200, 100, 200],
        });
      }
    });
    if (changed) { try { localStorage.setItem('pad_notified_inc', JSON.stringify([...notifiedSet].slice(-100))); } catch (_) {} }
  }, [incidents, pushNotif.isEnabled]);

  useEffect(() => {
    const handler = (e) => {
      const { title, body } = e.detail || {};
      if (title || body) toast(`${title || ''}${body ? ': ' + body : ''}`);
    };
    window.addEventListener('fcm_foreground', handler);
    return () => window.removeEventListener('fcm_foreground', handler);
  }, []);

  // ── Listener error global dari useFSCollection ──
  useEffect(() => {
    const handler = (e) => toast(e.detail?.msg || 'Terjadi kesalahan. Coba lagi.', false);
    window.addEventListener('sipamdal_error', handler);
    return () => window.removeEventListener('sipamdal_error', handler);
  }, []);

  const notifiedInstruksiRef = useRef(new Set(JSON.parse(localStorage.getItem('pad_notified_ins') || '[]')));
  const notifiedBroadcastRef = useRef(localStorage.getItem('pad_notified_bc') || '');
  const notifiedIncidentRef  = useRef(new Set(JSON.parse(localStorage.getItem('pad_notified_inc') || '[]')));

  // ── Kalkulasi shift, regu, dll ──
  const shift      = getShift(now);
  const reguHari   = getReguHari(now);
  const todayKey   = toLocalKey(new Date());
  const posShiftKey = getShiftKey(now);

  // [FIX setPosAssign] posAssign disimpan per-shift di Firestore (dok pad_pos_<shiftKey>).
  // Muat ulang setiap kali shift berganti — sebelumnya tidak pernah dipanggil sama sekali,
  // jadi posAssign tidak pernah sinkron dari Firestore saat app dibuka / shift berganti.
  useEffect(() => { loadPosAssign(posShiftKey); }, [posShiftKey]);

  // Auto-fill Pos Utama saat posAssign kosong
  useEffect(() => {
    if (!posAssign || Object.keys(posAssign).length > 0) return;
    if (!reguHari) return;
    try {
      const s = localStorage.getItem('pamdal_jadwal_libur');
      const stored = s ? JSON.parse(s) : {};
      const def = { '2026-6-1': [8,9], '2026-6-6': [4,5], '2026-6-7': [7,10], '2026-6-13': [6,8], '2026-6-14': [14,15], '2026-6-16': [9,10], '2026-6-20': [12,13], '2026-6-21': [1,2], '2026-6-27': [3,4], '2026-6-28': [6,7], '2026-7-4': [8,9], '2026-7-5': [14,15], '2026-7-11': [11,12], '2026-7-12': [5,1], '2026-7-18': [2,3], '2026-7-19': [10,6], '2026-7-25': [7,8], '2026-7-26': [13,14] };
      const liburMap = Object.assign({}, stored, def);
      const todayJKey = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
      const liburIds = liburMap[todayJKey] || [];
      const anggotaPiket = ANGGOTA_DATA.items.filter(a => a.regu === reguHari && !liburIds.includes(a.id)).map(a => a.nama);
      // [FIX setPosAssign] dulu dipanggil dengan 1 argumen saja — shiftKey wajib disertakan
      // karena signature store-nya setPosAssign(shiftKey, updater).
      if (anggotaPiket.length > 0) setPosAssign(posShiftKey, { 'Pos Utama': anggotaPiket });
    } catch (_) {}
  }, [reguHari, posShiftKey]); // eslint-disable-line

  // ── Handlers ──
  const handleLogin = (user) => {
    setCurrentUser(user);
    try {
      const redirectTab = sessionStorage.getItem('sipamdal_redirect_tab');
      if (redirectTab) { sessionStorage.removeItem('sipamdal_redirect_tab'); setTab(redirectTab); }
      else setTab('dashboard');
    } catch (_) { setTab('dashboard'); }
    if (!user.isAdmin) {
      const _urut2 = [3, 1, 2];
      const _d2 = new Date();
      const _sh2 = new Date(_d2.getTime() - 7 * 3600000);
      const _ld2 = new Date(_sh2.getFullYear(), _sh2.getMonth(), _sh2.getDate());
      const _ls2 = new Date(JADWAL_START.getFullYear(), JADWAL_START.getMonth(), JADWAL_START.getDate());
      const _diff2 = Math.round((_ld2 - _ls2) / 86400000);
      const _idx2  = ((_diff2 % 3) + 3) % 3;
      const _piket2 = _urut2[_idx2];
      const _libur2 = _urut2[(_idx2 + 1) % 3];
      const REGU_COL = { [_piket2]: 'var(--accent)', [_libur2]: 'var(--amber)', [_urut2[(_idx2 + 2) % 3]]: 'var(--red)' };
      const col  = REGU_COL[user.regu] || 'var(--accent)';
      const root = document.documentElement;
      root.style.setProperty('--regu-col',       col);
      root.style.setProperty('--regu-col-light',  cRgba(col, .60));
      root.style.setProperty('--regu-col-dim',    cRgba(col, .20));
      root.style.setProperty('--regu-col-tint',   cRgba(col, .10));
      root.style.setProperty('--regu-col-glow',   cRgba(col, .33));
    }
    auditAction(user.name, user.regu, 'LOGIN', 'Masuk ke sistem');
  };

  const handleLogout = async () => {
    const yes = await showConfirm({
      title: 'Keluar Akun?',
      message: `Yakin ingin keluar dari akun ${currentUser?.name || ''}?`,
      confirmLabel: 'Keluar',
      confirmColor: 'var(--red)',
    });
    if (!yes) return;
    if (currentUser) auditAction(currentUser.name, currentUser.regu, 'LOGOUT', 'Keluar manual');
    setCurrentUser(null);
    setTab('dashboard');
    applyAccentGlobal(null);
  };

  // ── Ganti PIN state ──
  const [cpOldPin, setCpOldPin]   = useState('');
  const [cpNewPin, setCpNewPin]   = useState('');
  const [cpConfPin, setCpConfPin] = useState('');
  const [cpSaving, setCpSaving]   = useState(false);

  const handleChangePin = async () => {
    if (!currentUser) return;
    const name = currentUser.name;
    let freshPins = Object.assign({}, DEFAULT_PINS);
    try { const s = localStorage.getItem('pad_pins'); if (s) freshPins = Object.assign({ ...DEFAULT_PINS }, JSON.parse(s)); } catch (_) {}
    const defPin = currentUser.isPimpinan ? '111111' : '123456';
    // [FIX] Sebelumnya: hashPin(cpOldPin, name) — tapi hashPin(pin, saltB64) butuh salt
    // ASLI dari Firestore (storedOld.salt), bukan nama user. Akibatnya verifikasi PIN lama
    // selalu gagal untuk siapa pun yang PIN-nya sudah pernah di-hash. Pakai verifyPinFS
    // (jalur yang sama dipakai saat login) yang sudah menangani salt & legacy format dgn benar.
    const fsResult = await verifyPinFS(name, cpOldPin.trim()).catch(() => null);
    const oldPinOk = fsResult !== null ? fsResult : (cpOldPin.trim() === (freshPins[name] || defPin).trim());
    if (!oldPinOk) { toast(`PIN lama salah! (default: ${defPin})`, false); return; }
    if (cpNewPin.trim().length !== 6 || !/^\d{6}$/.test(cpNewPin.trim())) { toast('PIN baru harus 6 angka!', false); return; }
    if (cpNewPin.trim() !== cpConfPin.trim()) { toast('Konfirmasi PIN tidak cocok!', false); return; }
    setCpSaving(true);
    try {
      await savePinToFS(name, cpNewPin.trim());
      const updated = { ...freshPins, [name]: cpNewPin.trim() };
      setUserPins(updated);
      auditAction(name, currentUser.regu, 'GANTI_PIN', 'PIN berhasil diubah');
      setChangePinOpen(false); setCpOldPin(''); setCpNewPin(''); setCpConfPin('');
      toast('PIN berhasil diubah!');
    } catch {
      toast('❌ Gagal menyimpan PIN. Periksa koneksi lalu coba lagi.', false);
    } finally {
      setCpSaving(false);
    }
  };

  // ── Welcome screen (returning member) ──
  const [welcomeUser, setWelcomeUser] = useState(() => {
    try { const s = localStorage.getItem('pad_last_known_user'); return s ? JSON.parse(s) : null; } catch (_) { return null; }
  });

  // ── Belum login ──
  if (!currentUser) {
    if (welcomeUser && !welcomeUser.isAdmin && !welcomeUser.isPimpinan) {
      return (
        <WelcomeScreen
          user={welcomeUser}
          onLogin={(user) => handleLogin(user)}
          onSwitchUser={() => { setWelcomeUser(null); localStorage.removeItem('pad_last_known_user'); }}
          userPins={userPins}
          instruksi={instruksi}
          broadcast={broadcast}
          packages={packages}
          guests={guests}
          incidents={incidents}
          patrols={patrols}
          posAssign={posAssign}
          statusPimpinan={statusPimpinan}
          setStatusPimpinan={setStatusPimpinan}
          reguHari={reguHari}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={(u) => {
          if (!u.isAdmin && !u.isPimpinan) {
            try { localStorage.setItem('pad_last_known_user', JSON.stringify(u)); } catch (_) {}
            setWelcomeUser(u);
          }
          handleLogin(u);
        }}
        userPins={userPins}
      />
    );
  }

  // ── Sudah login ──
  const isAdmin    = currentUser.isAdmin;
  const isPimpinan = currentUser.isPimpinan;

  const isUserLibur = (() => {
    try {
      const todayKey2 = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const s = localStorage.getItem('pamdal_jadwal_libur');
      const stored = s ? JSON.parse(s) : null;
      const hariLiburStored = localStorage.getItem('pamdal_hari_libur');
      const hariLiburMap = hariLiburStored ? JSON.parse(hariLiburStored) : JADWAL_LIBUR_DEFAULT;
      const m = stored || jadwalGenerateLibur(hariLiburMap);
      const liburIds = m[todayKey2] || [];
      const myData = ANGGOTA_DATA.items.find(a => a.nama === currentUser.name);
      return myData ? liburIds.includes(myData.id) : false;
    } catch (_) { return false; }
  })();

  const canEdit = isAdmin || isPimpinan || (currentUser.regu === reguHari && !isUserLibur);

  const pending        = packages.filter(p => p.status === 'Belum Diambil').length;
  const activeI        = incidents.filter(i => i.status !== 'Selesai').length;
  const instruksiAktif = instruksi.filter(i => i.aktif && (i.targetRegu === 'Semua' || String(i.targetRegu) === String(currentUser?.regu))).length;
  const keluarDiLuar   = keluarData.filter(k => !k.kembali).length;

  const goTab = (t) => { setTab(t); setTabKey(k => k + 1); setMoreOpen(false); };

  const MENU_SECTIONS = [
    {
      title: 'Administrasi',
      items: [
        ...(isAdmin ? [{ id: 'members', label: 'Anggota', icon: 'ppl', color: 'var(--accent)', badge: 0 }] : []),
        { id: 'inventaris', label: 'Inventaris',  icon: 'pkg',  color: 'var(--accent)', badge: 0 },
        { id: 'jadwal',     label: 'Jadwal',      icon: 'cal',  color: 'var(--accent)', badge: instruksiAktif > 0 ? instruksiAktif : 0 },
        { id: 'mutation',   label: 'Buku Mutasi', icon: 'file', color: 'var(--accent)', badge: 0 },
      ],
    },
    {
      title: 'Akun',
      items: [
        { id: 'profile',    label: 'Profil',    icon: 'user',    color: 'var(--accent)', badge: 0 },
        { id: '__pin',      label: 'Ganti PIN', icon: 'key',     color: 'var(--accent)', badge: 0 },
        { id: '__settings', label: 'Tampilan',  icon: 'palette', color: 'var(--accent)', badge: 0 },
        { id: '__notif',    label: 'Notif',     icon: 'bell',    color: 'var(--accent)', badge: 0 },
        { id: '__logout',   label: 'Logout',    icon: 'out',     color: 'var(--red)',    badge: 0 },
      ],
    },
  ];

  const DOCK_TABS = isAdmin
    ? [
        { id: 'dashboard', label: 'Home',     icon: 'home' },
        { id: 'qrpatroli', label: 'QR Admin', icon: 'qr' },
        { id: 'evaluasi',  label: 'Evaluasi', icon: 'chart' },
        { id: 'more',      label: 'Menu',     icon: 'menu' },
      ]
    : isPimpinan
    ? [
        { id: 'dashboard', label: 'Home',      icon: 'home' },
        { id: 'instruksi', label: 'Instruksi', icon: 'clipboard' },
        { id: 'evaluasi',  label: 'Evaluasi',  icon: 'chart' },
        { id: 'broadcast', label: 'Broadcast', icon: 'megaphone' },
      ]
    : [
        { id: 'dashboard', label: 'Home',    icon: 'home' },
        { id: 'qrscan',    label: 'Scan QR', icon: 'qr' },
        { id: 'more',      label: 'Menu',    icon: 'menu' },
      ];

  // ── Settings modal content ──
  const settingsContent = (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Notifikasi</div>
        {!pushNotif.supported ? (
          <div style={{ background: 'rgba(var(--amber-rgb),.1)', border: '1px solid rgba(var(--amber-rgb),.3)', borderRadius: 10, padding: '10px 14px', fontSize: 11.5, color: 'var(--amber)' }}>
            ⚠️ Browser ini tidak mendukung Push Notification
          </div>
        ) : pushNotif.isDenied ? (
          <div style={{ background: 'rgba(201,27,42,.1)', border: '1px solid rgba(201,27,42,.3)', borderRadius: 10, padding: '10px 14px', fontSize: 11.5, color: 'var(--red)' }}>
            🔕 Notifikasi diblokir. Buka <strong>Pengaturan Browser</strong> → izinkan notifikasi.
          </div>
        ) : (
          <>
            <button
              className={'notif-toggle' + (pushNotif.isEnabled ? ' active' : '')}
              onClick={async () => { if (!pushNotif.isEnabled) await pushNotif.requestPermission(); }}
              style={{ width: '100%', border: 'none', textAlign: 'left', fontFamily: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{pushNotif.isEnabled ? '🔔' : '🔕'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: pushNotif.isEnabled ? 'var(--accent)' : 'var(--tx-secondary)' }}>
                    {pushNotif.isEnabled ? 'Notifikasi Aktif' : 'Aktifkan Notifikasi'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--tx-muted)', marginTop: 1 }}>
                    {pushNotif.isEnabled ? 'Kamu akan dapat notif instruksi & broadcast' : 'Tap untuk izinkan notifikasi dari SIPAMDAL'}
                  </div>
                </div>
              </div>
              <div className={'notif-switch' + (pushNotif.isEnabled ? ' on' : '')} />
            </button>
            {pushNotif.isEnabled && (
              <button
                onClick={() => pushNotif.sendNotif('🔔 Test', 'Notifikasi SIPAMDAL berfungsi!', { tag: 'test' })}
                style={{ marginTop: 8, width: '100%', padding: '8px 0', background: 'var(--green-t)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                🧪 Kirim Test Notifikasi
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ background: 'var(--bg-raised)', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Tentang</div>
        <div style={{ fontSize: 12, color: 'var(--tx-muted)' }}>SIPAMDAL — Sistem Informasi Pengamanan Dalam</div>
        <div style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 4 }}>BBPKA II Jatinangor · v1.3.0</div>
      </div>

      {isAdmin && (
        <div style={{ marginTop: 14, background: 'var(--bg-raised)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>📋 Changelog</div>
          {[
            { ver: 'v1.3.0', date: '10 Jun 2026', items: [
              'Tombol kembali: logika priority-stack (inner modal → QR → more menu → modal tab → home → konfirmasi keluar)',
              'useInnerModal hook: semua inner modal (form, detail, template) terdaftar ke sistem back-button',
              'IncTab, PkgTab, GuestTab, MutTab, InstruksiTab, InventarisTab, PesertaTab: back dari inner modal kembali ke modal tab, bukan langsung ke home',
              'MutTab: back dari Pilih Template kembali ke Buku Mutasi, bukan ke home',
              'Tombol Keluar Aplikasi: menggunakan window.close() + fallback about:blank agar benar-benar menutup',
            ]},
            { ver: 'v1.2.0', date: '8 Jun 2026', items: [
              'Multi-role system: Anggota, Admin, Pimpinan dengan PIN-based login',
              'PimpinanTab: dashboard supervisor dengan status keamanan real-time',
              'BroadcastTab: kirim pesan broadcast dari Pimpinan ke seluruh anggota',
            ]},
            { ver: 'v1.1.0', date: '5 Jun 2026', items: [
              'JadwalTab: kalender bulanan jadwal piket, tally per anggota, editor hari libur nasional',
              'DockNav: navigasi bawah per role dengan FAB Scan QR',
            ]},
            { ver: 'v1.0.0', date: '2 Jun 2026', items: [
              'Initial release SIPAMDAL',
              'DashTab, PosTab, PatrolTab, IncTab, PkgTab, GuestTab, ProfileTab',
            ]},
          ].map((entry, ei) => (
            <div key={ei} style={{ marginBottom: ei === 0 ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--tx-primary)' }}>{entry.ver}</span>
                <span style={{ fontSize: 9.5, color: 'var(--tx-muted)', fontWeight: 600 }}>{entry.date}</span>
              </div>
              {entry.items.map((it, ii) => (
                <div key={ii} style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2, flexShrink: 0 }}>●</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-muted)', lineHeight: 1.5 }}>{it}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── MODAL_TABS universal ──
  const MODAL_TABS = {
    package:    { title: '📦 Paket',             color: 'var(--accent)' },
    mutation:   { title: '📋 Buku Mutasi',        color: 'var(--accent)' },
    inventaris: { title: '🗂️ Inventaris Barang',  color: 'var(--accent)' },
    instruksi:  { title: '📝 Buat Instruksi',     color: 'var(--accent)' },
    broadcast:  { title: '📢 Broadcast',          color: 'var(--accent)' },
    jadwal:     { title: '📅 Jadwal Piket',       color: 'var(--accent)' },
    search:     { title: '🔍 Pencarian',          color: 'var(--accent)' },
    guest:      { title: '🙋 Tamu & Peserta',     color: 'var(--accent)' },
    keluar:     { title: '🚶 Peserta Keluar',     color: 'var(--accent)' },
    profile:    { title: '👤 Profil Saya',        color: 'var(--accent)' },
    members:    { title: '👥 Data Anggota',       color: 'var(--accent)' },
  };

  const isModalTab = !!MODAL_TABS[tab];
  const closeModal = () => { setTab('dashboard'); setTabKey(k => k + 1); };

  const contentMap = {
    package:    <PkgTab packages={packages} setPackages={setPackages} toast={toast} canEdit={canEdit} />,
    mutation:   <MutTab mutations={mutations} setMutations={setMutations} reguHari={reguHari} toast={toast} canEdit={canEdit} patrols={patrols} incidents={incidents} packages={packages} guests={guests} currentUser={currentUser} standJaga={standJaga} rollings={rollings} inventarisDaftar={inventarisDaftar} inventarisCek={inventarisCek} />,
    inventaris: <InventarisTab canEdit={canEdit} isAdmin={isAdmin} />,
    instruksi:  <InstruksiFormTab instruksi={instruksi} setInstruksi={setInstruksi} currentUser={currentUser} toast={toast} />,
    broadcast:  <BroadcastTab broadcast={broadcast} setBroadcast={setBroadcast} currentUser={currentUser} toast={toast} waGrup={waGrup} setWaGrup={setWaGrup} />,
    jadwal:     <JadwalTab now={now} liburData={liburData} setLiburData={setLiburData} reguHari={reguHari} isAdmin={isAdmin} canEdit={canEdit} toast={toast} setTab={setTab} patrols={patrols} standJaga={standJaga} incidents={incidents} />,
    search:     <SearchTab />,
    guest:      <GuestTab guests={guests} setGuests={setGuests} toast={toast} canEdit={canEdit} />,
    keluar:     <PesertaTab canEdit={canEdit} isAdmin={isAdmin} />,
    profile:    <ProfileTab currentUser={currentUser} patrols={patrols} standJaga={standJaga} incidents={incidents} mutations={mutations} onLogout={handleLogout} toast={toast} userPins={userPins} setUserPins={setUserPins} changePinOpen={changePinOpen} setChangePinOpen={setChangePinOpen} />,
    members:    <AdminMemberTab patrols={patrols} standJaga={standJaga} incidents={incidents} mutations={mutations} toast={toast} instruksi={instruksi} setInstruksi={setInstruksi} broadcast={broadcast} setBroadcast={setBroadcast} currentUser={currentUser} />,
  };

  return (
    <div
      className={'v3-shell' + ((isAdmin || isPimpinan) ? ' pimpinan-shell' : '')}
      style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}
    >
      {/* Toast */}
      {notif && (
        <div
          className="v3-toast"
          role={notif.ok ? 'status' : 'alert'}
          aria-live={notif.ok ? 'polite' : 'assertive'}
          aria-atomic="true"
          style={{ background: notif.ok ? 'var(--accent)' : 'var(--red)' }}
        >
          {notif.ok ? '✅ ' : '⚠️ '}{notif.msg}
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog {...(confirmDlg || {})} open={!!confirmDlg} />

      {/* Menu overlay */}
      {moreOpen && (
        <MenuOverlay
          setMoreOpen={setMoreOpen}
          setChangePinOpen={setChangePinOpen}
          setSettingsOpen={setSettingsOpen}
          setQrScanOpen={setQrScanOpen}
          currentUser={currentUser}
          isAdmin={isAdmin}
          shift={shift}
          now={now}
          fbOnline={fbOnline}
          tab={tab}
          goTab={goTab}
          menuSections={MENU_SECTIONS}
          pushNotif={pushNotif}
          handleLogout={handleLogout}
        />
      )}

      {/* Ganti PIN modal */}
      <Modal
        open={changePinOpen}
        onClose={() => { setChangePinOpen(false); setCpOldPin(''); setCpNewPin(''); setCpConfPin(''); }}
        title="Ganti PIN"
      >
        <Inp label="PIN Lama" value={cpOldPin} onChange={e => setCpOldPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} type="tel" placeholder="Ketik 6 angka" />
        <Inp label="PIN Baru (6 digit)" value={cpNewPin} onChange={e => setCpNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} type="tel" placeholder="Ketik 6 angka" />
        <Inp label="Konfirmasi PIN Baru" value={cpConfPin} onChange={e => setCpConfPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} type="tel" placeholder="Ulangi PIN baru" />
        <div style={{ display: 'flex', gap: 8 }}>
          <BtnSimpan onClick={handleChangePin} loading={cpSaving} />
          <BtnBatal onClick={() => { setChangePinOpen(false); setCpOldPin(''); setCpNewPin(''); setCpConfPin(''); }} />
        </div>
      </Modal>

      {/* Settings modal */}
      {settingsOpen && createPortal(
        <>
          <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 820, background: 'rgba(10,22,40,.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'statBsBackdropIn .2s ease both' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 821, width: 'calc(100% - 24px)', maxWidth: 480, maxHeight: '88vh', background: 'var(--bg-surface)', borderRadius: 22, boxShadow: '0 24px 64px rgba(0,0,0,.30)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'centerModalIn .25s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)', borderRadius: '22px 22px 0 0', zIndex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 12px', borderBottom: '1px solid var(--br-subtle)', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx-primary)' }}>⚙️ Pengaturan Tampilan</div>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 8 }}>
                {IC({ n: 'x', s: 18, c: 'var(--accent)' })}
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 18px', WebkitOverflowScrolling: 'touch' }}>
              {settingsContent}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Universal modal (tab sebagai modal) */}
      {isModalTab && createPortal(
        <>
          <div onClick={closeModal} style={{ position: 'fixed', inset: 0, zIndex: 820, background: 'rgba(10,22,40,.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'statBsBackdropIn .2s ease both' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 821, width: 'calc(100% - 24px)', maxWidth: 520, maxHeight: '88vh', background: 'var(--bg-surface)', borderRadius: 22, boxShadow: '0 24px 64px rgba(0,0,0,.30)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'centerModalIn .25s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: MODAL_TABS[tab].color, borderRadius: '22px 22px 0 0', zIndex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 18px 12px', borderBottom: '1px solid var(--br-subtle)', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx-primary)' }}>{MODAL_TABS[tab].title}</div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 8 }}>
                {IC({ n: 'x', s: 18, c: 'var(--accent)' })}
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
              {contentMap[tab]}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Main content */}
      <main style={{ flex: 1, padding: 0, overflowY: 'auto', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))', background: 'transparent' }}>
        <div key={tabKey} className="tab-view" style={{ paddingTop: 0 }}>
          {visitedTabs['pimpinan']  && <div style={{ display: tab === 'pimpinan'  ? 'contents' : 'none' }}>{tab === 'pimpinan'  && <PimpinanTab setTab={setTab} onLogout={handleLogout} pushNotif={pushNotif} />}</div>}
          {visitedTabs['evaluasi']  && <div style={{ display: tab === 'evaluasi'  ? 'contents' : 'none' }}>{tab === 'evaluasi'  && <EvaluasiTab />}</div>}
          {visitedTabs['dashboard'] && <div style={{ display: tab === 'dashboard' && !isAdmin && !isPimpinan ? 'contents' : 'none' }}>{tab === 'dashboard' && !isAdmin && !isPimpinan && <DashTab now={now} reguHari={reguHari} posAssign={posAssign} setPosAssign={setPosAssign} posShiftKey={posShiftKey} incidents={incidents} setIncidents={setIncidents} packages={packages} setPackages={setPackages} guests={guests} setGuests={setGuests} patrols={patrols} setPatrols={setPatrols} standJaga={standJaga} mutations={mutations} posRollingLog={posRollingLog} instruksi={instruksi} currentUser={currentUser} setTab={setTab} canEdit={canEdit} isAdmin={isAdmin} keluarData={keluarData} toast={toast} broadcast={broadcast} onLogout={handleLogout} pushNotif={pushNotif} isUserLibur={isUserLibur} />}</div>}
          {visitedTabs['dashboard'] && <div style={{ display: tab === 'dashboard' && (isAdmin || isPimpinan) ? 'contents' : 'none' }}>{tab === 'dashboard' && (isAdmin || isPimpinan) && <PimpinanTab setTab={setTab} onLogout={handleLogout} pushNotif={pushNotif} />}</div>}
          {visitedTabs['pos']       && <div style={{ display: tab === 'pos'       ? 'contents' : 'none' }}>{tab === 'pos'       && <PosTab reguHari={reguHari} posAssign={posAssign} setPosAssign={setPosAssign} posShiftKey={posShiftKey} posRollingLog={posRollingLog} setPosRollingLog={setPosRollingLog} toast={toast} canEdit={canEdit} isAdmin={isAdmin} currentUser={currentUser} isUserLibur={isUserLibur} />}</div>}
          {visitedTabs['patrol']    && <div style={{ display: tab === 'patrol'    ? 'contents' : 'none' }}>{tab === 'patrol'    && <QRPatrolTab patrols={patrols} setPatrols={setPatrols} posAssign={posAssign} toast={toast} currentUser={currentUser} canEdit={canEdit} reguHari={reguHari} isUserLibur={isUserLibur} />}</div>}
          {visitedTabs['qrpatroli'] && <div style={{ display: tab === 'qrpatroli' ? 'contents' : 'none' }}>{tab === 'qrpatroli' && <QRAdminTab patrols={patrols} posAssign={posAssign} />}</div>}
          {visitedTabs['incident']  && <div style={{ display: tab === 'incident'  ? 'contents' : 'none' }}>{tab === 'incident'  && <IncTab incidents={incidents} setIncidents={setIncidents} posAssign={posAssign} toast={toast} canEdit={canEdit} />}</div>}
        </div>
      </main>

      {/* QR Scanner Modal */}
      {qrScanOpen && (
        <QRScannerModal
          open={qrScanOpen}
          onClose={() => setQrScanOpen(false)}
          patrols={patrols}
          setPatrols={setPatrols}
          posAssign={posAssign}
          setPosAssign={setPosAssign}
          posShiftKey={posShiftKey}
          toast={toast}
          currentUser={currentUser}
          setTab={(t) => { setTab(t); setQrScanOpen(false); }}
          setTabKey={setTabKey}
        />
      )}

      {/* Bottom dock */}
      <DockNav
        tab={tab}
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
        setTab={setTab}
        setFabOpen={setFabOpen}
        dockTabs={DOCK_TABS}
        badge={instruksiAktif + activeI}
        qrScanOpen={qrScanOpen}
        setQrScanOpen={(v) => {
          if (!canEdit) { toast('Mode baca saja — kamu sedang libur/lepas hari ini.', false); return; }
          setQrScanOpen(v);
        }}
      />
    </div>
  );
}
