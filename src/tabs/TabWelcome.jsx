// TabWelcome.jsx — SIPAMDAL
// Migrasi dari tab-welcome.js (Sesi 5a asli) ke JSX murni — Sesi 4 migrasi Vite.
// Returning Member Welcome Screen: identitas, status piket/libur/lepas, alert pimpinan
// dengan ringtone, hero carousel, quick actions, panic button, search overlay, PIN entry.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  JADWAL_START, POS_LIST, ALL_AREAS, COLOR,
  toLocalKey, cRgba, pinRgb, usePushNotif,
} from '../utils/utils.js';

import { IC } from '../components/ui/UiComponents.jsx';

import {
  hapticPin,
  getPinCooldownSecs,
  fmtCooldown,
  recordPinFailure,
  resetPinAttempts,
  verifyPinFS,
  PIN_COOLDOWN_MS,
  bioHasCred,
  bioPlatformAvailable,
  bioVerify,
  bioRegister,
} from '../stores/useAuthStore.js';

import { db, collection, addDoc, serverTimestamp } from '../firebase/firebase.js';
import { notifySWPimpinan } from '../main.jsx';

// ── WelcomeScreen — Returning Member ──────────────────────────
export function WelcomeScreen({
  user, onLogin, onSwitchUser, userPins, instruksi, broadcast,
  packages, guests, incidents, patrols, posAssign,
  statusPimpinan, setStatusPimpinan, reguHari,
}) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [pressedKey, setPressedKey] = useState(null);
  const [showPin, setShowPin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cooldownSecs, setCooldownSecs] = useState(() => getPinCooldownSecs(user?.name || ''));

  const [pimpinanAlert, setPimpinanAlert] = useState(null); // null | "masuk" | "keluar"
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('semua');
  const [panicConfirm, setPanicConfirm] = useState(false); // BL-05
  const [panicSent, setPanicSent] = useState(false);       // BL-05

  // BL-04: Biometric state di WelcomeScreen
  const [bioAvail, setBioAvail] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  // [FIX] Sebelumnya diambil dari useAppStore(s => s.pushNotif) — field itu TIDAK ADA
  // di useAppStore sama sekali, jadi pushNotif selalu undefined dan notif darurat
  // lokal di tombol panic gagal dikirim secara diam-diam. pushNotif yang benar
  // berasal dari hook usePushNotif() di utils.js (dipakai juga di App.jsx).
  const pushNotif = usePushNotif();

  useEffect(() => {
    let alive = true;
    bioPlatformAvailable().then(ok => { if (alive) setBioAvail(ok && bioHasCred(user?.name || '')); });
    return () => { alive = false; };
  }, [user?.name]);

  const handleBioLogin = async () => {
    if (bioLoading) return;
    setBioLoading(true);
    setErr('');
    try {
      const ok = await bioVerify(user.name);
      if (ok) {
        hapticPin('ok');
        onLogin(user);
      }
    } catch (e) {
      hapticPin('error');
      setErr('Biometrik gagal — gunakan PIN.');
    } finally {
      setBioLoading(false);
    }
  };

  const prevPimpinanRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);
  const ringtoneCtxRef = useRef(null);
  const ringtoneOscsRef = useRef([]); // track all oscillators for hard-stop
  const pendingTabRef = useRef(null); // target tab after PIN success
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroAnim, setHeroAnim] = useState('visible');
  const heroTimerRef = useRef(null);
  const heroTouchStartRef = useRef(null);
  const heroPausedRef = useRef(false);

  // ── Stop ringtone helper — paksa stop semua oscillator yang sudah dijadwalkan ──
  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) { clearInterval(ringtoneIntervalRef.current); ringtoneIntervalRef.current = null; }
    (ringtoneOscsRef.current || []).forEach(osc => { try { osc.stop(); } catch (_) {} });
    ringtoneOscsRef.current = [];
    try { if (ringtoneCtxRef.current) { ringtoneCtxRef.current.close(); ringtoneCtxRef.current = null; } } catch (e) {}
  };

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  // ── Regu status ──
  const urut = [3, 1, 2];
  const diff = (() => {
    const d = new Date(); const shifted = new Date(d.getTime() - 7 * 3600000);
    const ld = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
    const ls = new Date(JADWAL_START.getFullYear(), JADWAL_START.getMonth(), JADWAL_START.getDate());
    return Math.round((ld - ls) / 86400000);
  })();
  const idx = ((diff % 3) + 3) % 3;
  const piketRegu = urut[idx];
  const liburRegu = urut[(idx + 1) % 3];
  const isPiket = user.regu === piketRegu;
  const isLibur = user.regu === liburRegu;
  const statusLabel = isPiket ? 'PIKET' : isLibur ? 'LIBUR' : 'LEPAS';
  const statusColor = isPiket ? 'var(--accent)' : isLibur ? 'var(--amber)' : 'var(--red)';
  const statusBg = isPiket ? 'rgba(var(--orb-rgb),.12)' : isLibur ? 'rgba(var(--amber-rgb),.12)' : 'rgba(201,27,42,.12)';
  const statusEmoji = isPiket ? '' : isLibur ? '' : '↺';  /* S2-04 */
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const pinCol = statusColor;

  // ── Notif ticker items ──
  const instruksiAktif = (instruksi || []).filter(i => i.aktif && !i.selesai);
  const pendingPkg = (packages || []).filter(p => p.status === 'Belum Diambil').length;
  const activeInc = (incidents || []).filter(i => i.status !== 'Selesai').length;
  const pimpinanHadir = statusPimpinan?.hadir !== false;

  // ── Helper bersama: jadwalkan ringtone chime (dipakai oleh dua trigger di bawah) ──
  const playRingtone = (hadir) => {
    stopRingtone();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ringtoneCtxRef.current = ctx;
      ringtoneOscsRef.current = [];
      const chimeDur = hadir ? 0.75 : 0.65;
      const gap = hadir ? 1.5 : 1.2;
      const repeat = 50;
      const playTone = (freq, tStart, dur, vol = 0.28) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, tStart);
        gain.gain.linearRampToValueAtTime(vol, tStart + 0.02);
        gain.gain.linearRampToValueAtTime(0, tStart + dur);
        osc.start(tStart);
        osc.stop(tStart + dur + 0.05);
        ringtoneOscsRef.current.push(osc);
      };
      for (let i = 0; i < repeat; i++) {
        const base = ctx.currentTime + i * (chimeDur + gap);
        if (hadir) {
          playTone(523, base + 0.0, 0.18, 0.28); // C5
          playTone(659, base + 0.2, 0.18, 0.28); // E5
          playTone(784, base + 0.42, 0.26, 0.32); // G5
        } else {
          playTone(659, base + 0.0, 0.22, 0.28); // E5
          playTone(494, base + 0.28, 0.28, 0.25); // B4
        }
      }
    } catch (e) {}
  };

  // ── Deteksi perubahan status pimpinan → trigger alert + ringtone looping (piket only) ──
  useEffect(() => {
    if (prevPimpinanRef.current === null) { prevPimpinanRef.current = pimpinanHadir; return; }
    if (prevPimpinanRef.current !== pimpinanHadir && isPiket) {
      setPimpinanAlert(pimpinanHadir ? 'masuk' : 'keluar');
      setHeroSlide(0); heroPausedRef.current = true;
      playRingtone(pimpinanHadir);
    }
    prevPimpinanRef.current = pimpinanHadir;
  }, [pimpinanHadir, isPiket]);

  // ── Listener event dari SW (polling background) ──────────────
  // Kalau app terbuka tapi di tab background, SW kirim custom event
  // → trigger banner + chime seperti perubahan normal
  useEffect(() => {
    const handler = (e) => {
      const { hadir } = e.detail || {};
      if (typeof hadir !== 'boolean') return;
      if (hadir === prevPimpinanRef.current) return; // sudah tahu, skip
      if (!isPiket) return; // hanya piket yang dapat chime & banner
      setPimpinanAlert(hadir ? 'masuk' : 'keluar');
      setHeroSlide(0); heroPausedRef.current = true;
      playRingtone(hadir);
      prevPimpinanRef.current = hadir;
    };
    window.addEventListener('sipamdal_pimpinan_changed', handler);
    return () => window.removeEventListener('sipamdal_pimpinan_changed', handler);
  }, [isPiket]);

  // ── Hero card slides data ──
  // S1-01: hitung per-pos (bukan per-slot kapasitas) agar konsisten dengan DashTab & PimpinanTab
  const posKosong = (() => {
    const filledPos = POS_LIST.filter(p => (posAssign || {})[p]?.length > 0).length;
    const total = POS_LIST.length;
    return { kosong: total - filledPos, total };
  })();
  const patroliPct = (() => {
    const today = toLocalKey(new Date());
    const todayPatrols = (patrols || []).filter(p => p.date === today || toLocalKey(new Date(p.ts || 0)) === today);
    const done = new Set(todayPatrols.map(p => p.area)).size;
    const total = ALL_AREAS ? ALL_AREAS.length : 1;
    return Math.round((done / total) * 100);
  })();
  const instruksiAktifSlide = instruksiAktif.slice(0, 1)[0] || null;

  const heroSlides = [
    pimpinanAlert && { type: 'pimpinan_alert', alert: pimpinanAlert },
    { type: 'identity' },
    { type: 'pos', kosong: posKosong.kosong, total: posKosong.total },
    { type: 'patroli', pct: patroliPct },
    instruksiAktifSlide && { type: 'instruksi', item: instruksiAktifSlide },
    broadcast?.pesan && { type: 'broadcast', pesan: broadcast.pesan },
  ].filter(Boolean);

  const heroCount = heroSlides.length;

  // ── Auto-slide tiap 4 detik ──
  const startHeroTimer = useCallback(() => {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      if (heroPausedRef.current) return;
      setHeroSlide(s => (s + 1) % heroCount);
    }, 4200);
  }, [heroCount]);
  useEffect(() => {
    startHeroTimer();
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
  }, [startHeroTimer]);

  // ── Swipe manual ──
  const handleHeroTouchStart = (e) => { heroTouchStartRef.current = e.touches[0].clientX; };
  const handleHeroTouchEnd = (e) => {
    if (heroTouchStartRef.current === null) return;
    const dx = e.changedTouches[0].clientX - heroTouchStartRef.current;
    heroTouchStartRef.current = null;
    if (Math.abs(dx) < 40) return;
    heroPausedRef.current = true;
    setHeroSlide(s => dx < 0 ? (s + 1) % heroCount : (s - 1 + heroCount) % heroCount);
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    setTimeout(() => { heroPausedRef.current = false; startHeroTimer(); }, 10000);
  };

  // ── Action buttons ──
  const alertActive = !!pimpinanAlert;
  const actionBtns = [
    { id: 'paket', icon: 'pkg', label: 'Paket', color: 'var(--amber-text)', badge: pendingPkg || 0, disabled: alertActive },
    { id: 'scan', icon: 'qr', label: 'Scan QR', color: 'var(--accent)', disabled: alertActive },
    { id: 'pimpin-keluar', icon: pimpinanHadir ? 'officer-out' : 'officer-in', label: pimpinanHadir ? 'Catat Keluar' : 'Catat Masuk', color: pimpinanHadir ? 'var(--red)' : 'var(--accent)', disabled: !isPiket || alertActive },  /* S3-03 */
    { id: 'cari', icon: 'search', label: 'Cari', color: 'var(--violet)', disabled: alertActive },
    { id: 'insiden', icon: 'alert', label: 'Insiden', color: 'var(--red)', badge: activeInc || 0, disabled: alertActive },
    { id: 'panic', icon: 'panic', label: 'DARURAT', color: '#D93025', disabled: false },
  ];

  const handleActionBtn = (id) => {
    // BL-05: Panic tidak diblokir alertActive
    if (id === 'panic') {
      hapticPin('locked');
      setPanicConfirm(true);
      return;
    }
    if (alertActive) return;
    if (id === 'pimpin-keluar' || id === 'pimpin-masuk') {
      if (!isPiket) return;
      const newHadir = !pimpinanHadir;
      if (setStatusPimpinan) {
        setStatusPimpinan({ hadir: newHadir, updatedAt: Date.now(), updatedBy: user.name });
        notifySWPimpinan(newHadir);
      }
      return;
    }
    if (id === 'cari') {
      setShowSearch(true);
      return;
    }
    const tabMap = { scan: 'patrol', paket: 'package', insiden: 'incident' };
    const targetTab = tabMap[id] || 'dashboard';
    pendingTabRef.current = targetTab;
    setShowPin(true);
  };

  // BL-05: Kirim panic ke Firestore + notif
  const handlePanicConfirm = async () => {
    try {
      hapticPin('error');
      await addDoc(collection(db, 'sipamdal_panic'), {
        sender: user.name,
        regu: user.regu || 0,
        lokasi: 'Belum diketahui',
        ts: serverTimestamp(),
        tsLocal: new Date().toISOString(),
        status: 'aktif',
      });
      // Kirim notif lokal sebagai fallback
      if (pushNotif?.isEnabled) {
        pushNotif.sendNotif(
          ' DARURAT — ' + user.name,
          'Tombol darurat ditekan! Segera periksa lokasi.',
          { tag: 'panic-' + Date.now(), priority: 'Penting' }
        );
      }
      setPanicSent(true);
      setPanicConfirm(false);
      setTimeout(() => setPanicSent(false), 8000);
    } catch (e) {
      console.error('[Panic] Gagal kirim:', e);
      setPanicConfirm(false);
    }
  };

  // BL-03: cooldown ticker
  useEffect(() => {
    if (cooldownSecs <= 0) return;
    const t = setInterval(() => {
      const s = getPinCooldownSecs(user?.name || '');
      setCooldownSecs(s);
      if (s <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSecs]);

  const doShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const handlePinInput = async (d) => {
    if (pin.length >= 6) return;
    // BL-03: cek lockout
    const remainSecs = getPinCooldownSecs(user?.name || '');
    if (remainSecs > 0) {
      setErr(` Akun terkunci. Coba lagi dalam ${fmtCooldown(remainSecs)}.`);
      hapticPin('locked');
      return;
    }
    hapticPin('tap'); // BL-01
    setPressedKey(d); setTimeout(() => setPressedKey(null), 150);
    const np = pin + d;
    setPin(np);
    if (np.length === 6) {
      setTimeout(async () => {
        // [F1-01] Verifikasi dengan hash; fallback ke localStorage jika Firestore gagal
        let pinOk = await verifyPinFS(user.name, np).catch(() => null);
        if (pinOk === null) { pinOk = (np === (userPins[user.name] || '123456')); }
        if (pinOk) {
          resetPinAttempts(user.name); // BL-03
          hapticPin('ok');            // BL-01
          if (pendingTabRef.current) {
            try { sessionStorage.setItem('sipamdal_redirect_tab', pendingTabRef.current); } catch (_) {}
            pendingTabRef.current = null;
          }
          // BL-04: Tawarkan daftar biometrik setelah login PIN pertama kali
          (async () => {
            try {
              if (!bioHasCred(user.name)) {
                const avail = await bioPlatformAvailable();
                if (avail) {
                  const daftar = window.confirm('Login berhasil!\n\nDaftarkan sidik jari / Face ID untuk login lebih cepat ke depannya?');
                  if (daftar) { await bioRegister(user.name); }
                }
              }
            } catch (_) {}
          })();
          onLogin(user);
        } else {
          const { locked, attemptsLeft } = recordPinFailure(user.name); // BL-03
          hapticPin('error'); // BL-01
          doShake();
          setPin('');
          if (locked) {
            setCooldownSecs(PIN_COOLDOWN_MS / 1000);
            setErr(` Akun terkunci 5 menit karena 3x PIN salah.`);
          } else {
            setErr(`PIN salah. ${attemptsLeft} percobaan tersisa.`);
          }
        }
      }, 200);
    }
  };
  const handleDel = () => { setPin(p => p.slice(0, -1)); setErr(''); };

  // Keyboard fisik support untuk PIN (PC/laptop)
  useEffect(() => {
    if (!showPin) return;
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') { handlePinInput(e.key); }
      else if (e.key === 'Backspace') { handleDel(); }
      else if (e.key === 'Escape') { setShowPin(false); setPin(''); setErr(''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPin, pin]);

  const isLight = true;
  const accentCol = statusColor;
  const bgHero = isLight
    ? `linear-gradient(170deg,${cRgba(accentCol, .16)} 0%,${COLOR.shellBg} 55%,${COLOR.bgOverlay} 100%)`
    : `linear-gradient(170deg,${cRgba(accentCol, .13)} 0%,#0a0f1c 55%,#060b14 100%)`; /* dark-only, tidak aktif */

  // ── Sub-render: action circles row (IIFE asli dikonversi jadi komponen lokal) ──
  function ActionCirclesRow() {
    const scrollRef = useRef(null);
    const [scrollPct, setScrollPct] = useState(0);
    const [canScroll, setCanScroll] = useState(false);
    useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      const update = () => {
        const max = el.scrollWidth - el.clientWidth;
        setCanScroll(max > 4);
        setScrollPct(max > 0 ? el.scrollLeft / max : 0);
      };
      update();
      el.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
    }, []);
    const trackW = 48; const thumbW = Math.max(12, trackW / actionBtns.length);
    const thumbX = scrollPct * (trackW - thumbW);
    const alertCol = pimpinanAlert === 'masuk' ? 'var(--accent)' : 'var(--red)';

    return (
      <>
        {alertActive && (
          <div style={{
            margin: '0 0 10px', padding: '8px 14px',
            background: pimpinanAlert === 'masuk' ? 'rgba(var(--orb-rgb),.08)' : 'rgba(201,27,42,0.08)',
            border: `1px solid ${alertCol}40`, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: alertCol, flexShrink: 0, boxShadow: `0 0 0 3px ${alertCol}35`, animation: 'pimpinanDotPulse 1s ease infinite' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: alertCol, flex: 1 }}>
              Tutup notifikasi pimpinan untuk menggunakan tombol
            </span>
            <div
              onClick={() => { setPimpinanAlert(null); stopRingtone(); heroPausedRef.current = false; setHeroSlide(1); startHeroTimer(); }}
              style={{ fontSize: 10, fontWeight: 800, color: alertCol, cursor: 'pointer', padding: '3px 8px', background: `${alertCol}18`, borderRadius: 99, whiteSpace: 'nowrap' }}
            >
              Tutup
            </div>
          </div>
        )}
        <div
          ref={scrollRef}
          style={{
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory',
          }}
        >
          <style>{'div::-webkit-scrollbar{display:none}'}</style>
          <div style={{ display: 'flex', gap: 14, paddingLeft: 12, paddingRight: 12, width: 'max-content', marginBottom: 4 }}>
            {actionBtns.map((btn, i) => (
              <div
                key={btn.id}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  scrollSnapAlign: 'start',
                  opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(14px)',
                  transition: `opacity .4s ease, transform .5s ease ${.18 + i * .07}s`,
                }}
              >
                <button
                  onClick={() => handleActionBtn(btn.id)}
                  disabled={btn.disabled}
                  title={alertActive ? 'Tutup notifikasi pimpinan terlebih dahulu' : btn.disabled ? 'Hanya regu piket yang dapat mengubah status ini' : ''}
                  style={{
                    width: 60, height: 60, borderRadius: 20, position: 'relative',
                    cursor: btn.disabled ? 'not-allowed' : 'pointer',
                    background: isLight ? `${btn.color}14` : `${btn.color}12`,
                    border: `2px solid ${btn.color}${btn.disabled ? '20' : '45'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 16px ${btn.color}22`, transition: 'all .18s',
                    opacity: btn.disabled ? 0.30 : 1,
                    filter: btn.disabled && alertActive ? 'grayscale(0.5)' : 'none',
                    flexShrink: 0,
                  }}
                >
                  <IC n={btn.icon} s={24} c={btn.color} />
                  {btn.badge > 0 && (
                    <div style={{
                      position: 'absolute', top: -5, right: -5,
                      minWidth: 18, height: 18, borderRadius: 9, background: btn.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: '#fff', padding: '0 4px',
                      boxShadow: `0 2px 6px ${btn.color}60`,
                    }}>
                      {btn.badge}
                    </div>
                  )}
                </button>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: btn.disabled && alertActive ? (isLight ? 'var(--tx-ghost)' : 'var(--tx-muted)') : isLight ? 'var(--tx-muted)' : 'var(--tx-ghost)',
                  textAlign: 'center', lineHeight: 1.2, maxWidth: 64, transition: 'color .2s',
                }}>
                  {btn.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        {canScroll && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6, marginBottom: 2 }}>
            <div style={{ width: trackW, height: 3, borderRadius: 99, background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: thumbX, width: thumbW, height: '100%', borderRadius: 99, background: accentCol, transition: 'left .15s ease' }} />
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Sub-render: konten slide hero aktif ──
  function renderHeroSlideContent() {
    const sl = heroSlides[heroSlide] || heroSlides[0];
    const key = heroSlide;
    if (!sl) return null;

    if (sl.type === 'pimpinan_alert') {
      const isMasuk = sl.alert === 'masuk';
      const aCol = isMasuk ? 'var(--accent)' : 'var(--red)';
      const aBg = isMasuk
        ? 'linear-gradient(135deg,rgba(14,165,233,.18),rgba(14,165,233,.08))'
        : 'linear-gradient(135deg,rgba(201,27,42,.18),rgba(201,27,42,.08))';
      return (
        <div key={key} className="hero-slide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 0, padding: '4px 0 0' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 99, background: aBg, border: `1.5px solid ${aCol}60`, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: aCol, boxShadow: `0 0 0 3px ${aCol}40`, animation: 'pimpinanDotPulse 1s ease infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: aCol }}>PIMPINAN</span>
          </div>
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12 }}>{isMasuk ? '' : ''}</div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -.5, color: isLight ? 'var(--tx-primary)' : '#fff', textAlign: 'center', marginBottom: 6 }}>
            {isMasuk ? 'Pimpinan Tiba di Kantor' : 'Pimpinan Meninggalkan Kantor'}
          </div>
          <div
            onClick={() => { setPimpinanAlert(null); stopRingtone(); heroPausedRef.current = false; setHeroSlide(1); startHeroTimer(); }}
            style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 99, background: isLight ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: isLight ? 'var(--tx-muted)' : 'var(--tx-ghost)' }}>Tap untuk tutup</span>
          </div>
        </div>
      );
    }

    if (sl.type === 'identity') {
      return (
        <div key={key} className="hero-slide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 16px', borderRadius: 99, background: cRgba(accentCol, .10), border: `1.5px solid ${cRgba(accentCol, .34)}`, marginBottom: 18 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: accentCol, boxShadow: `0 0 0 3px ${cRgba(accentCol, .21)}` }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: accentCol, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {isPiket ? 'Piket Hari Ini' : isLibur ? 'Libur Hari Ini' : 'Lepas Hari Ini'}
            </span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color: isLight ? 'var(--tx-primary)' : '#fff', textAlign: 'center', lineHeight: 1.05, marginBottom: 5 }}>
            {user.name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: .5, color: isLight ? 'var(--tx-ghost)' : 'rgba(255,255,255,.4)', marginBottom: 10 }}>
            {`Regu ${user.regu}`}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: isLight ? cRgba(accentCol, .80) : 'rgba(255,255,255,.55)', textAlign: 'center', lineHeight: 1.5, marginBottom: 16, maxWidth: 220, fontStyle: 'italic' }}>
            {isPiket
              ? 'Anda sedang bertugas hari ini. Tetap waspada dan jaga keselamatan.'
              : isLibur
              ? 'Nikmati hari libur Anda. Besok kembali berdinas, persiapkan diri dengan baik.'
              : 'Piket telah usai. Pulanglah dengan selamat dan istirahatlah yang cukup.'}
          </div>
          <div style={{ width: 44, height: 3, borderRadius: 99, background: `linear-gradient(90deg,${accentCol},${cRgba(accentCol, .27)})` }} />
        </div>
      );
    }

    if (sl.type === 'pos') {
      const kosong = sl.kosong; const total = sl.total;
      const isiCol = kosong === 0 ? 'var(--accent)' : kosong <= 1 ? 'var(--amber)' : 'var(--red)';
      return (
        <div key={key} className="hero-slide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: isLight ? 'var(--tx-muted)' : 'rgba(255,255,255,.55)', marginBottom: 12 }}>Status Pos</div>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, color: isiCol, lineHeight: 1, marginBottom: 4 }}>{kosong}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? 'var(--tx-secondary)' : 'rgba(255,255,255,.7)', marginBottom: 16 }}>
            {kosong === 0 ? 'Semua pos terisi ' : `pos kosong dari ${total}`}
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 99, background: isLight ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: isiCol, width: `${Math.round(((total - kosong) / Math.max(total, 1)) * 100)}%`, transition: 'width .6s ease' }} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: isLight ? 'var(--tx-muted)' : 'rgba(255,255,255,.55)', marginTop: 8 }}>
            {`${total - kosong} dari ${total} pos bertugas`}
          </div>
        </div>
      );
    }

    if (sl.type === 'patroli') {
      const pct = sl.pct;
      const col = pct >= 80 ? 'var(--accent)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
      return (
        <div key={key} className="hero-slide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: isLight ? 'var(--tx-muted)' : 'rgba(255,255,255,.55)', marginBottom: 12 }}>Patroli Hari Ini</div>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2, color: col, lineHeight: 1, marginBottom: 4 }}>{`${pct}%`}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isLight ? 'var(--tx-secondary)' : 'rgba(255,255,255,.7)', marginBottom: 16 }}>
            {pct === 100 ? 'Semua area sudah dipatroli ' : pct === 0 ? 'Belum ada patroli hari ini' : 'area sudah dicek'}
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 99, background: isLight ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: col, width: `${pct}%`, transition: 'width .6s ease' }} />
          </div>
        </div>
      );
    }

    if (sl.type === 'instruksi') {
      const itm = sl.item;
      const iCol = itm.prioritas === 'Penting' ? 'var(--red)' : itm.prioritas === 'Info' ? 'var(--accent)' : 'var(--amber)';
      const iEmoji = itm.prioritas === 'Penting' ? '' : itm.prioritas === 'Info' ? 'ℹ' : '';
      return (
        <div key={key} className="hero-slide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: `${iCol}18`, border: `1.5px solid ${iCol}50`, marginBottom: 14 }}>
            <span style={{ fontSize: 12 }}>{iEmoji}</span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: iCol }}>Instruksi Aktif</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? 'var(--tx-primary)' : '#fff', textAlign: 'center', lineHeight: 1.35, marginBottom: 8 }}>{itm.judul}</div>
          {itm.isi && (
            <div style={{ fontSize: 12, fontWeight: 500, color: isLight ? 'var(--tx-muted)' : 'var(--tx-ghost)', textAlign: 'center', lineHeight: 1.5, maxHeight: 52, overflow: 'hidden' }}>
              {itm.isi.slice(0, 90) + (itm.isi.length > 90 ? '…' : '')}
            </div>
          )}
        </div>
      );
    }

    if (sl.type === 'broadcast') {
      return (
        <div key={key} className="hero-slide" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: 'rgba(var(--orb-rgb),.12)', border: '1.5px solid rgba(14,165,233,.4)', marginBottom: 14 }}>
            <span style={{ fontSize: 12 }}></span>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--accent)' }}>Broadcast</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: isLight ? 'var(--tx-primary)' : '#fff', textAlign: 'center', lineHeight: 1.5 }}>
            {sl.pesan.slice(0, 100) + (sl.pesan.length > 100 ? '…' : '')}
          </div>
        </div>
      );
    }

    return null;
  }

  // ── Sub-render: hasil pencarian ──
  function renderSearchResults() {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tx-muted)' }}>
          <IC n="search" s={40} c="var(--tx-ghost)" />
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Ketik untuk mencari</div>
          <div style={{ fontSize: 11 }}>Tamu · Paket · Kendaraan</div>
        </div>
      );
    }
    const out = [];
    const sf = searchFilter;
    if (sf === 'semua' || sf === 'paket') (packages || []).forEach(p => {
      if ([p.recipient, p.sender, p.notes, p.type].filter(Boolean).some(v => v.toLowerCase().includes(q)))
        out.push({ icon: 'PKT', title: p.recipient, sub: 'Dari: ' + (p.sender || '—') + ' · ' + p.type, badge: p.status, color: p.status === 'Belum Diambil' ? 'var(--amber-text)' : 'var(--accent)', ts: p.ts });
    });
    if (sf === 'semua' || sf === 'tamu') (guests || []).forEach(g => {
      if ([g.name, g.institution, g.purpose, g.room, g.vehicle].filter(Boolean).some(v => v.toLowerCase().includes(q)))
        out.push({ icon: 'TMU', title: g.name, sub: (g.institution || '') + (g.vehicle ? ' · ' + g.vehicle : ''), badge: g.status, color: g.status === 'Masih Ada' ? 'var(--violet)' : 'var(--tx-muted)', ts: g.ts });
    });
    if (sf === 'semua' || sf === 'kendaraan') (guests || []).forEach(g => {
      if (g.vehicle && g.vehicle.toLowerCase().includes(q))
        out.push({ icon: 'KND', title: g.vehicle, sub: 'Pemilik: ' + g.name, badge: g.status, color: 'var(--accent)', ts: g.ts });
    });
    out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (!out.length) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tx-muted)' }}>
          <IC n="alert-circle" s={40} c="var(--tx-ghost)" />
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Tidak ditemukan</div>
          <div style={{ fontSize: 11 }}>Coba kata kunci lain</div>
        </div>
      );
    }
    return (
      <>
        <div style={{ fontSize: 11, color: 'var(--tx-muted)', fontWeight: 700, marginBottom: 10, paddingTop: 4 }}>
          {out.length} hasil untuk <span style={{ color: 'var(--accent)' }}>{searchQuery}</span>
        </div>
        {out.map((r, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--br-subtle)', borderRadius: 12, padding: '11px 14px', marginBottom: 8, borderLeft: '4px solid ' + r.color }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.icon === 'PKT' ? <IC n="pkg" s={20} c="var(--amber)" /> : r.icon === 'TMU' ? <IC n="users" s={20} c="var(--violet)" /> : <IC n="car" s={20} c="var(--accent)" />}
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--tx)' }}>{r.title}</span>
              </div>
              {r.badge && (
                <span style={{ fontSize: 10, fontWeight: 700, color: r.color, background: r.color + '22', borderRadius: 8, padding: '2px 7px', border: '1px solid ' + r.color + '44', flexShrink: 0 }}>
                  {r.badge}
                </span>
              )}
            </div>
            {r.sub && <div style={{ fontSize: 11.5, color: 'var(--tx-muted)', paddingLeft: 26 }}>{r.sub}</div>}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {/* BL-05: Panic confirm modal */}
      {panicConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(220,38,38,.35)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#D93025', marginBottom: 8 }}>Tombol Darurat</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.5 }}>
              Ini akan mengirim peringatan darurat ke pimpinan dan mencatat insiden. Lanjutkan?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setPanicConfirm(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '2px solid #e5e7eb', background: '#F9FAFB', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}
              >
                Batal
              </button>
              <button
                onClick={handlePanicConfirm}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#D93025', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', color: '#fff', letterSpacing: .3 }}
              >
                 KIRIM DARURAT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BL-05: Panic sent banner */}
      {panicSent && (
        <div style={{ position: 'fixed', top: 16, left: 16, right: 16, zIndex: 2900, background: '#D93025', color: '#fff', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(220,38,38,.4)', animation: 'slideUp .3s cubic-bezier(.22,1,.36,1)' }}>
          <span style={{ fontSize: 24 }}></span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Peringatan Darurat Terkirim</div>
            <div style={{ fontSize: 11, opacity: .85, marginTop: 2 }}>Pimpinan telah diberitahu. Tetap tenang.</div>
          </div>
        </div>
      )}

      {/* ── Pencarian Full-Screen Overlay (menutupi segalanya) ── */}
      {showSearch && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2500, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', animation: 'searchSlideDown .28s cubic-bezier(.22,1,.36,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '52px 18px 10px', borderBottom: '1px solid var(--br-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx-primary)', letterSpacing: .2 }}>Pencarian Cepat</div>
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchFilter('semua'); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 8 }}
            >
              <IC n="x" s={18} c="var(--tx-muted)" />
            </button>
          </div>
          <div style={{ padding: '14px 16px 0', flexShrink: 0, background: 'var(--bg-base)' }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari tamu, plat kendaraan, nama penerima..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 40px 12px 14px', background: 'var(--bg-surface)', border: '1.5px solid var(--accent)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'var(--tx)', fontFamily: 'inherit', outline: 'none' }}
              />
              {searchQuery
                ? <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--tx-muted)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                : <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}><IC n="search" s={18} c="var(--tx-muted)" /></span>}
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
              {[['semua', 'Semua'], ['tamu', 'Tamu'], ['paket', 'Paket'], ['kendaraan', 'Kendaraan']].map(([fid, flabel]) => (
                <button
                  key={fid}
                  onClick={() => setSearchFilter(fid)}
                  style={{
                    flexShrink: 0, padding: '5px 13px', borderRadius: 20,
                    background: searchFilter === fid ? 'var(--pill-active)' : 'var(--bg-surface)',
                    border: '1.5px solid ' + (searchFilter === fid ? 'var(--accent)' : 'var(--border)'),
                    color: searchFilter === fid ? 'var(--accent)' : 'var(--tx-muted)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  {flabel}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 32px', WebkitOverflowScrolling: 'touch' }}>
            {renderSearchResults()}
          </div>
        </div>
      )}

      {/* ── Welcome screen utama ── */}
      <div style={{ minHeight: '100vh', background: bgHero, position: 'relative', display: 'flex', flexDirection: 'column', opacity: mounted ? 1 : 0, transition: 'opacity .4s ease' }}>

        {/* HERO AREA */}
        <div
          style={{
            flex: 1, position: 'relative', zIndex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '0 24px', paddingBottom: 'var(--ws-card-h, 290px)',
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(-14px)',
            transition: 'opacity .55s ease, transform .55s ease',
          }}
        >
          {/* ── Hero info card — swipeable auto-slide ── */}
          <style>{`
            @keyframes heroSlideInR{from{opacity:0;transform:translateX(38px)}to{opacity:1;transform:translateX(0)}}
            @keyframes heroSlideInL{from{opacity:0;transform:translateX(-38px)}to{opacity:1;transform:translateX(0)}}
            .hero-slide{animation:heroSlideInR .38s cubic-bezier(.22,1,.36,1)}
            .hero-slide-back{animation:heroSlideInL .38s cubic-bezier(.22,1,.36,1)}
          `}</style>
          <div
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
            className="hero-card-glass"
            style={{ width: '100%', maxWidth: 400, padding: '28px 24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', userSelect: 'none' }}
          >
            {renderHeroSlideContent()}

            {/* ── Dot indicator + swipe hint (S3-02) ── */}
            {heroSlides.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 18 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {heroSlides.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => { heroPausedRef.current = true; setHeroSlide(i); setTimeout(() => { heroPausedRef.current = false; startHeroTimer(); }, 10000); }}
                      style={{
                        width: i === heroSlide ? 22 : 7, height: 7, borderRadius: 99,
                        background: i === heroSlide ? accentCol : isLight ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.25)',
                        transition: 'all .35s cubic-bezier(.22,1,.36,1)',
                        cursor: 'pointer',
                        boxShadow: i === heroSlide ? `0 0 6px ${accentCol}80` : 'none',
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: .5, color: isLight ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.28)', marginTop: 2 }}>
                  geser untuk info lain
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CSS untuk alert pimpinan ── */}
        <style>{`
          @keyframes borderPulseBiru { 0%,100%{box-shadow:0 -8px 40px rgba(14,165,233,.15),0 0 0 0 rgba(14,165,233,0)} 50%{box-shadow:0 -8px 40px rgba(14,165,233,.5),0 0 0 6px rgba(14,165,233,.18)} }
          @keyframes pimpinanDotPulse { 0%,100%{box-shadow:0 0 0 3px rgba(14,165,233,.4)} 50%{box-shadow:0 0 0 6px rgba(14,165,233,.1)} }
          @keyframes borderPulseMerah { 0%,100%{box-shadow:0 -8px 40px rgba(201,27,42,.15),0 0 0 0 rgba(201,27,42,0)} 50%{box-shadow:0 -8px 40px rgba(201,27,42,.5),0 0 0 6px rgba(201,27,42,.18)} }
        `}</style>

        {/* Bottom sheet card (Livin-style) */}
        <div
          ref={el => {
            if (el) {
              const setH = () => document.documentElement.style.setProperty('--ws-card-h', el.offsetHeight + 'px');
              setH();
              if (!el._wsRO) { el._wsRO = new ResizeObserver(setH); el._wsRO.observe(el); }
            }
          }}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
            background: isLight ? '#ffffff' : 'var(--tx-primary)',
            borderRadius: '24px 24px 0 0',
            border: pimpinanAlert === 'masuk' ? '1.5px solid #1A8FE3' : pimpinanAlert === 'keluar' ? '1.5px solid #D93025' : `1px solid ${isLight ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'}`,
            borderBottom: 'none',
            boxShadow: pimpinanAlert === 'masuk'
              ? '0 -8px 40px rgba(14,165,233,.4)'
              : pimpinanAlert === 'keluar'
              ? '0 -8px 40px rgba(201,27,42,.4)'
              : isLight
              ? '0 -4px 24px rgba(0,0,0,.10)'
              : '0 -4px 32px rgba(0,0,0,.7)',
            animation: pimpinanAlert === 'masuk' ? 'borderPulseBiru 1.2s ease infinite'
              : pimpinanAlert === 'keluar' ? 'borderPulseMerah 1.2s ease infinite' : 'none',
            padding: '0 18px 28px',
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(40px)',
            transition: 'opacity .65s ease .1s, transform .65s ease .1s, border .4s ease, box-shadow .4s ease',
          }}
        >
          {/* ── Drag handle ── */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 14px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: isLight ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.2)' }} />
          </div>

          {/* ── Action circles ── */}
          <ActionCirclesRow />

          {/* Divider */}
          <div style={{ height: 1, background: isLight ? 'rgba(var(--orb-rgb),.25)' : 'rgba(var(--orb-rgb),.12)', margin: '16px 0 18px' }} />

          {showPin ? (
            <div style={{ animation: 'slideUp .3s cubic-bezier(.22,1,.36,1)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isLight ? 'var(--tx-ghost)' : 'var(--tx-muted)', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 14 }}>
                Masukkan PIN
              </div>
              <div style={{ animation: shake ? 'shake .4s' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 8, '--pin-col-rgb': pinRgb(pinCol) }}>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={[
                        'pin-dot',
                        i < pin.length ? 'filled' : '',
                        i === pin.length - 1 && pin.length > 0 ? 'last-filled' : '',
                      ].filter(Boolean).join(' ')}
                    />
                  ))}
                </div>
                {err && <div style={{ fontSize: 11, color: 'var(--red)', textAlign: 'center', marginBottom: 10, fontWeight: 700 }}> {err}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12, '--pin-col-rgb': pinRgb(pinCol) }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Batal', 0, '⌫'].map((d, i) => {
                    const isBack = d === 'Batal', isDel = d === '⌫', isNum = !isBack && !isDel;
                    const isPressed = pressedKey === String(d);
                    const className = isNum
                      ? ('pin-btn-num' + (isPressed ? ' pressed' : ''))
                      : isDel ? 'pin-btn-del' : 'pin-btn-back';
                    return (
                      <button
                        key={i}
                        className={className}
                        onClick={() => isDel ? handleDel() : isBack ? (setShowPin(false), setPin(''), setErr(''), pendingTabRef.current = null) : handlePinInput(String(d))}
                      >
                        {isDel ? (
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                            <line x1={18} y1={9} x2={12} y2={15} />
                            <line x1={12} y1={9} x2={18} y2={15} />
                          </svg>
                        ) : d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Login button */}
              <button
                onClick={() => setShowPin(true)}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 16, border: 'none',
                  cursor: 'pointer',
                  background: `linear-gradient(135deg,${statusColor},${cRgba(statusColor, .80)})`,
                  color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                  boxShadow: `0 4px 20px ${cRgba(statusColor, .28)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all .3s',
                }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <rect x={3} y={11} width={18} height={11} rx={2} />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Masuk dengan PIN
              </button>

              {/* BL-04: Biometric login button (hanya muncul jika tersedia) */}
              {bioAvail && (
                <button
                  onClick={handleBioLogin}
                  disabled={bioLoading}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 16, border: `1.5px solid ${cRgba(statusColor, .40)}`,
                    cursor: bioLoading ? 'wait' : 'pointer',
                    background: cRgba(statusColor, .07),
                    color: statusColor, fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all .3s', opacity: bioLoading ? 0.6 : 1,
                  }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07" />
                    <path d="M12 11V3" />
                  </svg>
                  {bioLoading ? 'Memverifikasi…' : 'Masuk dengan Sidik Jari / Wajah'}
                </button>
              )}

              {/* Switch user */}
              <button
                onClick={onSwitchUser}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 14, border: `1px solid ${isLight ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.10)'}`,
                  cursor: 'pointer', background: 'transparent',
                  color: isLight ? 'var(--tx-ghost)' : 'var(--tx-muted)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx={9} cy={7} r={4} />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Ganti Anggota
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
          @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes searchSlideDown{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}
        `}</style>
      </div>
    </>
  );
}
