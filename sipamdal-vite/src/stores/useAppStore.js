// src/stores/useAppStore.js — SIPAMDAL
// Migrasi dari: state UI di App() (app-main.js)
// Perubahan:
//   - tab, notif, confirmDlg, moreOpen, fbOnline, textColor, dll → Zustand
//   - window.__anyModalOpen → anyModalOpen di store
//   - window.fb_online / fb_offline events → setFbOnline() dipanggil dari main.jsx
//   - API toast, showConfirm, goTab tetap sama dari sisi konsumer

import { create } from 'zustand';

// ── Konstanta ─────────────────────────────────────────────────────────────────
export const TEXT_COLORS = [
  { id: 'default', label: 'Bawaan',     color: null },
  { id: 'orange',  label: 'Oranye',     color: 'var(--amber)' },
  { id: 'yellow',  label: 'Kuning',     color: 'var(--amber)' },
  { id: 'cyan',    label: 'Cyan',       color: 'var(--accent)' },
  { id: 'lime',    label: 'Hijau Muda', color: 'var(--accent)' },
];

// Tab yang dianggap "modal" — back button menutup dan kembali ke dashboard
export const MODAL_TAB_IDS = new Set([
  'search', 'profile', 'instruksi', 'peserta', 'inventaris', 'paket',
]);

// ── Helper: apply text color ke CSS variable ──────────────────────────────────
function _applyTextColor(id) {
  const col = TEXT_COLORS.find(c => c.id === id);
  if (col?.color) {
    document.documentElement.style.setProperty('--tx-override', col.color);
    document.documentElement.style.setProperty('--tx', col.color);
  } else {
    document.documentElement.style.setProperty('--tx-override', '');
    document.documentElement.style.removeProperty('--tx');
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────
const useAppStore = create((set, get) => ({

  // ── Tab navigation ────────────────────────────────────────────────────────
  tab:         'dashboard',
  tabKey:      0,           // increment untuk force re-mount tab
  visitedTabs: { dashboard: true },

  setTab: (t) => set(s => ({
    tab:         t,
    visitedTabs: { ...s.visitedTabs, [t]: true },
  })),

  goTab: (t) => {
    set(s => ({
      tab:         t,
      tabKey:      s.tabKey + 1,
      visitedTabs: { ...s.visitedTabs, [t]: true },
      moreOpen:    false,
    }));
  },

  // ── Toast notification ────────────────────────────────────────────────────
  notif: null,   // { msg: string, ok: boolean } | null
  _notifTimer: null,

  toast: (msg, ok = true) => {
    const prev = get()._notifTimer;
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => set({ notif: null, _notifTimer: null }), 3000);
    set({ notif: { msg, ok }, _notifTimer: timer });
  },

  // ── Confirm dialog ────────────────────────────────────────────────────────
  // showConfirm(opts) → Promise<boolean>
  // opts: { title, message, confirmLabel, confirmColor, cancelLabel }
  confirmDlg: null,

  showConfirm: (opts) => new Promise(resolve => {
    set({
      confirmDlg: {
        ...opts,
        onConfirm: () => { set({ confirmDlg: null }); resolve(true);  },
        onCancel:  () => { set({ confirmDlg: null }); resolve(false); },
      },
    });
  }),

  // ── Overlay / modal state ─────────────────────────────────────────────────
  moreOpen:       false,
  settingsOpen:   false,
  changePinOpen:  false,
  fabOpen:        false,
  qrScanOpen:     false,
  anyModalOpen:   false,   // menggantikan window.__anyModalOpen

  setMoreOpen:      (v) => set({ moreOpen: v }),
  setSettingsOpen:  (v) => set({ settingsOpen: v }),
  setChangePinOpen: (v) => set({ changePinOpen: v }),
  setFabOpen:       (v) => set({ fabOpen: v }),
  setQrScanOpen:    (v) => set({ qrScanOpen: v }),
  setAnyModalOpen:  (v) => set({ anyModalOpen: v }),

  // Tutup semua overlay sekaligus (dipanggil oleh back button handler)
  closeAllOverlays: () => set({
    moreOpen: false, settingsOpen: false,
    fabOpen: false,  qrScanOpen: false,
    anyModalOpen: false,
  }),

  // ── Firebase online status ────────────────────────────────────────────────
  // Diset dari main.jsx via startOnlineProbe callback
  fbOnline: false,
  setFbOnline: (v) => set({ fbOnline: v }),

  // ── Text color preference ─────────────────────────────────────────────────
  textColor: (() => {
    try { return localStorage.getItem('pad_txcolor') || 'default'; } catch { return 'default'; }
  })(),

  setTextColor: (id) => {
    set({ textColor: id });
    try { localStorage.setItem('pad_txcolor', id); } catch {}
    _applyTextColor(id);
  },

  // Apply saved color saat app load — dipanggil dari main.jsx
  applyTextColor: () => {
    _applyTextColor(get().textColor);
  },

  // ── Back button handler ───────────────────────────────────────────────────
  // Dipanggil dari App.jsx pada event popstate
  handleBackButton: () => {
    const { anyModalOpen, moreOpen, qrScanOpen, tab, goTab, closeAllOverlays, showConfirm } = get();

    if (anyModalOpen) {
      window.dispatchEvent(new CustomEvent('sipamdal_close_modals'));
      set({ anyModalOpen: false });
      window.history.pushState({ sipamdal: true }, '');
      return;
    }
    if (moreOpen) {
      set({ moreOpen: false });
      window.history.pushState({ sipamdal: true }, '');
      return;
    }
    if (qrScanOpen) {
      set({ qrScanOpen: false });
      window.history.pushState({ sipamdal: true }, '');
      return;
    }
    if (MODAL_TAB_IDS.has(tab)) {
      goTab('dashboard');
      window.history.pushState({ sipamdal: true }, '');
      return;
    }
    if (tab !== 'dashboard') {
      goTab('dashboard');
      window.history.pushState({ sipamdal: true }, '');
      return;
    }

    // Sudah di dashboard — tanya konfirmasi keluar
    showConfirm({
      title:        'Keluar Aplikasi?',
      message:      'Yakin ingin menutup SIPAMDAL?',
      confirmLabel: 'Keluar',
      confirmColor: 'var(--red)',
    }).then(ok => {
      if (ok) window.history.back();
    });
  },
}));

export { useAppStore };
export default useAppStore;
