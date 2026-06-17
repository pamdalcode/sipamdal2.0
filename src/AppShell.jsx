// AppShell.jsx — SIPAMDAL
// Migrasi dari app-shell.js → Vite + React JSX
// Komponen: NAV_TABS, MenuOverlay, DockNav, useConfirm, ConfirmDialog, applyAccentGlobal

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { memo } from 'react';
import { initials, fmtDS } from './utils/utils.js';
import { IC, BtnBatal } from './components/ui/UiComponents.jsx';

// ── NAV_TABS — daftar tab navbar per role ──────────────────────────────────

export const NAV_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'search',    label: 'Cari',      icon: 'search' },
  { id: 'patrol',    label: 'Patroli',   icon: 'qr' },
  { id: 'more',      label: 'Lainnya',   icon: 'menu' },
];

export const NAV_TABS_ADMIN = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'search',    label: 'Cari',      icon: 'search' },
  { id: 'evaluasi',  label: 'Evaluasi',  icon: 'chart' },
  { id: 'more',      label: 'Lainnya',   icon: 'menu' },
];

export const NAV_TABS_PIMPINAN = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'search',    label: 'Cari',      icon: 'search' },
  { id: 'instruksi', label: 'Instruksi', icon: 'pin' },
  { id: 'more',      label: 'Lainnya',   icon: 'menu' },
];

// ── applyAccentGlobal — bersihkan sisa tema lama (legacy cleanup) ───────────

export function applyAccentGlobal(_preset) {
  const root = document.documentElement;
  const varsToClean = [
    '--accent', '--accent-light', '--accent-dim', '--accent-glow', '--accent-tint', '--accent-pill',
    '--orb-rgb', '--ok', '--dk', '--pn', '--mica-bg', '--card-solid', '--card2-solid',
    '--status-card-bg', '--admin-card-bg', '--card', '--card2', '--green-card',
    '--border', '--border2', '--green-border', '--dark-border', '--dark-border2',
    '--qr-border', '--pill-active', '--br', '--tx', '--tx2', '--tx3', '--tx4',
    '--bg-base', '--bg-surface', '--bg-raised', '--bg-overlay',
    '--br-subtle', '--br-default', '--br-strong',
  ];
  varsToClean.forEach(v => root.style.removeProperty(v));
  ['theme-cobalt', 'theme-steel', 'theme-tac_green', 'theme-alert_red', 'theme-deep_purple', 'theme-copper', 'theme-arctic']
    .forEach(t => root.classList.remove(t));
  const bgTag = document.getElementById('accent-body-glow');
  if (bgTag) bgTag.textContent = '';
  const hexTag = document.getElementById('accent-hex-grid');
  if (hexTag) hexTag.textContent = '';
  localStorage.removeItem('sipamdal_accent');
}

// ── MenuOverlay ──────────────────────────────────────────────────────────────
// Didefinisikan di LUAR App agar tidak di-recreate tiap render (setiap setNow()).

export const MenuOverlay = memo(function MenuOverlay({
  setMoreOpen, setChangePinOpen, setSettingsOpen, setQrScanOpen,
  currentUser, isAdmin, shift, now, fbOnline,
  tab, goTab, menuSections, pushNotif, handleLogout,
}) {
  return (
    <div className="v3-menu-overlay" role="dialog" aria-modal="true" aria-label="Menu lainnya">
      <div className="v3-menu-drag-handle" />
      <div className="v3-menu-close-bar">
        <div className="v3-menu-title">Menu</div>
        <button
          className="v3-menu-close-btn"
          onClick={() => setMoreOpen(false)}
          aria-label="Tutup"
        >
          {IC({ n: 'x', s: 18, c: 'var(--tx-secondary)' })}
        </button>
      </div>

      <div style={{
        padding: '12px 16px 24px',
        background: '#f8f9fb',
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'env(safe-area-inset-bottom, 24px)',
      }}>
        {/* User card */}
        <div className="v3-user-card" style={{ marginBottom: 16 }}>
          <div className="v3-user-avatar">{initials(currentUser.name)}</div>
          <div className="v3-menu-text">
            <div className="v3-user-name">{currentUser.name}</div>
            <div className="v3-user-role">
              {isAdmin ? 'Pimpinan / Admin' : `Regu ${currentUser.regu} · ${shift.l}`}
              {' · '}{fmtDS(now)}
            </div>
          </div>
          <div className="v3-conn-dot" style={{ background: fbOnline ? 'var(--accent)' : 'var(--red)' }} />
        </div>

        {/* Menu sections */}
        {menuSections && menuSections.length > 0 ? (
          <div className="v3-menu-sections">
            {menuSections.map((section, si) => (
              <div key={si} className="v3-menu-section">
                {section.title && <div className="v3-menu-section-title">{section.title}</div>}
                <div className="v3-menu-grid">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      className="v3-menu-grid-item"
                      style={{ '--item-color': item.color }}
                      onClick={() => {
                        if      (item.id === '__qrscan')    { setMoreOpen(false); setQrScanOpen?.(true); }
                        else if (item.id === '__pin')       { setMoreOpen(false); setChangePinOpen?.(true); }
                        else if (item.id === '__settings')  { setMoreOpen(false); setSettingsOpen?.(true); }
                        else if (item.id === '__notif')     { setMoreOpen(false); if (pushNotif && !pushNotif.isEnabled) pushNotif.requestPermission(); else setSettingsOpen?.(true); }
                        else if (item.id === '__logout')    { setMoreOpen(false); handleLogout?.(); }
                        else { goTab(item.id); }
                      }}
                    >
                      <div className="v3-menu-grid-icon">
                        {IC({ n: item.icon, s: 22, c: item.color })}
                      </div>
                      {item.badge > 0 && <span className="v3-menu-grid-badge">{item.badge}</span>}
                      <span className="v3-menu-grid-label">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--tx-muted)', textAlign: 'center', padding: '8px 0 16px' }}>
            Semua menu tersedia di halaman Home
          </div>
        )}

        {isAdmin && (
          <button
            onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
            style={{
              width: '100%', padding: '14px 0', marginBottom: 10,
              background: 'rgba(var(--orb-rgb),.06)',
              border: '1.5px solid rgba(14,165,233,.22)',
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 16 }}>⚙️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>Changelog &amp; Pengaturan</span>
          </button>
        )}
      </div>
    </div>
  );
});

// ── DockNav ──────────────────────────────────────────────────────────────────
// memo agar tidak re-render tiap detik akibat setNow di App.

export const DockNav = memo(function DockNav({
  tab, moreOpen, setMoreOpen, setTab, setFabOpen, dockTabs, badge, qrScanOpen, setQrScanOpen,
}) {
  return (
    <nav className="v3-dock">
      {dockTabs.map(t => {
        const active = t.id === 'more' ? moreOpen : t.id === 'qrscan' ? qrScanOpen : tab === t.id;
        const handleClick = () => {
          if (t.id === 'more')   { setMoreOpen(v => !v); setFabOpen(false); setQrScanOpen?.(false); }
          else if (t.id === 'qrscan') { setQrScanOpen?.(v => !v); setMoreOpen(false); setFabOpen(false); }
          else { setTab(t.id); setMoreOpen(false); setFabOpen(false); setQrScanOpen?.(false); }
        };

        // Tombol QR — raised FAB
        if (t.id === 'qrscan') {
          return (
            <button
              key={t.id}
              data-active={active}
              className="v3-dock-btn-qr"
              onClick={handleClick}
              aria-label="Scan atau buat QR"
              aria-current={active ? 'page' : undefined}
            >
              <div className="v3-dock-qr-fab">
                {IC({ n: 'qr', s: 24, c: 'currentColor' })}
              </div>
              <span className="v3-dock-qr-label">{t.label}</span>
            </button>
          );
        }

        return (
          <button
            key={t.id}
            data-active={active}
            className="v3-dock-btn"
            onClick={handleClick}
            aria-label={t.label}
            aria-current={active ? 'page' : undefined}
          >
            <div className="v3-dock-indicator" />
            {t.id === 'more' && badge > 0 && <div className="v3-dock-badge">{badge}</div>}
            <div className="v3-dock-icon-wrap">
              {IC({ n: t.icon, s: 20, c: active ? 'var(--accent)' : 'currentColor' })}
            </div>
            <span className="v3-dock-label" style={active ? { color: 'var(--accent)' } : undefined}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}, (prev, next) =>
  prev.tab === next.tab &&
  prev.moreOpen === next.moreOpen &&
  prev.badge === next.badge &&
  prev.dockTabs === next.dockTabs &&
  prev.qrScanOpen === next.qrScanOpen
);

// ── useConfirm ───────────────────────────────────────────────────────────────

export function useConfirm() {
  const [dlg, setDlg] = useState(null);
  const confirm = (opts) => new Promise(resolve => {
    setDlg({
      ...opts,
      onConfirm: () => { setDlg(null); resolve(true); },
      onCancel:  () => { setDlg(null); resolve(false); },
    });
  });
  const dialog = <ConfirmDialog {...(dlg || {})} open={!!dlg} />;
  return [confirm, dialog];
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

export function ConfirmDialog({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  if (!open) return null;
  return createPortal(
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(10,22,40,.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 9101, width: 'calc(100% - 40px)', maxWidth: 340,
          background: 'var(--bg-surface)', borderRadius: 18,
          boxShadow: '0 20px 60px rgba(0,0,0,.35)',
          padding: '24px 20px 18px', fontFamily: 'inherit',
        }}
      >
        <div id="confirm-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx-primary)', marginBottom: 8, textAlign: 'center' }}>
          {title || 'Konfirmasi'}
        </div>
        <div id="confirm-msg" style={{ fontSize: 13, color: 'var(--tx-secondary)', marginBottom: 22, textAlign: 'center', lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <BtnBatal onClick={onCancel} sx={{ flex: 1 }} />
          <button
            onClick={onConfirm}
            style={{
              flex: 1, background: confirmColor || 'var(--accent)',
              border: 'none', color: '#fff', borderRadius: 10,
              padding: '11px 0', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
            }}
          >
            {confirmLabel || 'Ya'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
