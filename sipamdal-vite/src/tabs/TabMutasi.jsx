// TabMutasi.jsx — SIPAMDAL
// Migrasi dari tab-mutasi.js ke Vite + React JSX + Zustand + CSS Modules
// Sesi 3 (pelengkap): Tab Mutasi / Serah Terima Jaga

import { useState } from 'react';

import {
  REGU,
  fmtDT,
  fmtT,
  getShiftKey,
} from '../utils/utils.js';

import {
  IC, Modal, Inp, Btn, BtnSimpan, BtnBatal, Bdg, PH,
  ReadOnlyBanner, useInnerModal,
} from '../components/ui/UiComponents.jsx';

import { useConfirm } from '../AppShell.jsx';
import { auditAction } from '../stores/useAuthStore.js';
import { PhotoPicker } from './TabInsiden.jsx';

import styles from './TabMutasi.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNextRegu(regu) {
  const urut = [1, 2, 3];
  const idx  = urut.indexOf(Number(regu));
  return urut[(idx + 1) % 3];
}

// ── Template Daftar ───────────────────────────────────────────────────────────

const MUTASI_TEMPLATES = [
  {
    id: 'serah_terima_normal',
    label: 'Serah Terima Normal',
    icon: '↺',
    kategori: 'Serah Terima Jaga',
    color: 'var(--accent)',
    bg: 'var(--pill-active)',
    border: 'var(--accent-glow)',
    content: `SITUASI UMUM:\nKondisi lingkungan BBPKA II Jatinangor dalam keadaan aman dan terkendali.\nKEGIATAN SHIFT:\n- Patroli keliling telah dilaksanakan sesuai jadwal\n- Seluruh pos terjaga dengan baik\n- Tidak ada kejadian luar biasa selama shift berlangsung\nPESAN UNTUK REGU BERIKUTNYA:\n- Harap periksa kembali kondisi seluruh pos\n- Pastikan semua akses masuk/keluar terpantau\n- Laporkan segera jika ada temuan mencurigakan`,
    incidents: 'Tidak ada',
    packages: '',
    guests: '',
    notes: 'Situasi aman, lanjutkan tugas sesuai SOP.',
  },
  {
    id: 'ada_insiden',
    label: 'Ada Insiden Aktif',
    icon: '🚨',
    kategori: 'Laporan Kejadian',
    color: 'var(--red)',
    bg: 'rgba(201,27,42,.08)',
    border: 'rgba(201,27,42,.35)',
    content: `SITUASI UMUM:\nTerdapat insiden yang perlu mendapat perhatian khusus dari regu penerima.\nKRONOLOGI KEJADIAN:\n- Waktu kejadian  : [ISI JAM]\n- Lokasi          : [ISI LOKASI/POS]\n- Jenis kejadian  : [URAIKAN SINGKAT]\n- Tindakan diambil: [LANGKAH YANG SUDAH DILAKUKAN]\nSTATUS PENANGANAN:\n🔴 Masih dalam penanganan → Mohon dilanjutkan oleh regu berikutnya\n✅ Sudah selesai ditangani → Pantau tetap diperlukan\nPESAN UNTUK REGU BERIKUTNYA:\nHarap awasi perkembangan situasi dan laporkan bila ada eskalasi.`,
    incidents: '',
    packages: '',
    guests: '',
    notes: 'Perhatian khusus diperlukan — baca laporan insiden lengkap.',
  },
  {
    id: 'paket_menunggu',
    label: 'Ada Paket Menunggu',
    icon: '📦',
    kategori: 'Serah Terima Jaga',
    color: 'var(--amber-text)',
    bg: 'rgba(var(--amber-rgb),.08)',
    border: 'rgba(var(--amber-rgb),.35)',
    content: `SITUASI UMUM:\nKondisi umum aman. Terdapat paket/surat yang belum diambil oleh penerima.\nKEGIATAN SHIFT:\n- Patroli dilaksanakan sesuai jadwal\n- Pos terjaga dengan baik\nINFORMASI PAKET TERTUNDA:\n- Paket disimpan di : Pos Utama / Pos Asrama [sesuaikan]\n- Penerima          : [NAMA PENERIMA]\n- Keterangan        : [JENIS PAKET, RESI JIKA ADA]\nPESAN UNTUK REGU BERIKUTNYA:\nMohon ingatkan/hubungi penerima untuk segera mengambil paket.`,
    incidents: 'Tidak ada',
    packages: '',
    guests: '',
    notes: 'Paket disimpan aman di pos.',
  },
  {
    id: 'tamu_menginap',
    label: 'Ada Tamu / Peserta',
    icon: '🏠',
    kategori: 'Serah Terima Jaga',
    color: 'var(--violet)',
    bg: 'rgba(109,40,217,.08)',
    border: 'rgba(109,40,217,.35)',
    content: `SITUASI UMUM:\nKondisi umum aman. Terdapat tamu / peserta yang masih berada di dalam lingkungan.\nKEGIATAN SHIFT:\n- Patroli dilaksanakan sesuai jadwal\n- Tamu/peserta telah diidentifikasi dan tercatat\nDATA TAMU / PESERTA:\n- Nama    : [NAMA TAMU]\n- Instansi: [ASAL INSTANSI]\n- Kamar   : [NOMOR KAMAR / LOKASI]\n- Keperluan: [TUJUAN KUNJUNGAN]\n- Status  : Masih di dalam / Menginap\nPESAN UNTUK REGU BERIKUTNYA:\nPantau pergerakan tamu dan pastikan check-out dicatat dengan baik.`,
    incidents: 'Tidak ada',
    packages: '',
    guests: '',
    notes: 'Tamu masih berada di dalam — pantau hingga check-out.',
  },
  {
    id: 'penertiban',
    label: 'Penertiban / Tindakan',
    icon: '🔒',
    kategori: 'Penertiban',
    color: 'var(--tx-muted)',
    bg: 'rgba(100,100,100,.08)',
    border: 'rgba(100,100,100,.25)',
    content: `KEGIATAN PENERTIBAN:\nTelah dilaksanakan tindakan penertiban sebagai berikut:\nDETAIL PENERTIBAN:\n- Jenis tindakan : [URAIKAN JENIS PENERTIBAN]\n- Objek/sasaran  : [SIAPA / APA YANG DITERTIBKAN]\n- Lokasi         : [POS / AREA]\n- Waktu          : [JAM MULAI – JAM SELESAI]\n- Petugas        : [NAMA ANGGOTA YANG BERTUGAS]\nHASIL:\n[URAIKAN HASIL PENERTIBAN — APA YANG TERJADI SETELAH TINDAKAN]\nTINDAK LANJUT:\n⬜ Diperlukan tindak lanjut → [URAIKAN]\n✅ Selesai, tidak diperlukan tindak lanjut`,
    incidents: '',
    packages: '',
    guests: '',
    notes: 'Lihat detail penertiban di uraian laporan.',
  },
  {
    id: 'kondisi_khusus',
    label: 'Kondisi Cuaca / Darurat',
    icon: '🌧️',
    kategori: 'Laporan Kejadian',
    color: 'var(--amber-text)',
    bg: 'rgba(var(--amber-rgb),.08)',
    border: 'rgba(var(--amber-rgb),.35)',
    content: `KONDISI KHUSUS SHIFT INI:\nSITUASI:\n- Kondisi cuaca   : [CERAH / HUJAN / ANGIN KENCANG / LAINNYA]\n- Dampak          : [URAIKAN DAMPAK JIKA ADA]\n- Area terdampak  : [SEBUTKAN POS / AREA]\nTINDAKAN YANG DIAMBIL:\n- [LANGKAH ANTISIPASI YANG DILAKUKAN]\n- [APAKAH ADA KOORDINASI DENGAN PIHAK LAIN]\nSTATUS SAAT SERAH TERIMA:\n🔴 Situasi masih berlangsung → Waspada tinggi\n✅ Situasi sudah mereda → Pantau tetap diperlukan\nPESAN UNTUK REGU BERIKUTNYA:\nTetap waspada dan siagakan komunikasi radio/HP aktif.`,
    incidents: '',
    packages: '',
    guests: '',
    notes: 'Situasi khusus — baca laporan dengan teliti.',
  },
];

const KATEGORI_OPTS = [
  'Serah Terima Jaga',
  'Patroli',
  'Penertiban',
  'Laporan Kejadian',
  'Tidak Ada Serah Terima',
];

// ── Komponen Print ────────────────────────────────────────────────────────────

function MutPrint({ m, onClose, inventarisDaftar = [], inventarisCek = {} }) {
  const handlePrint = () => window.print();
  return (
    <div className={styles.printWrap}>
      <div className={styles.printHeader}>
        <div className={styles.printTitle}>LAPORAN MUTASI TUGAS JAGA</div>
        <div className={styles.printSub}>BBPKA II Jatinangor</div>
      </div>

      <div className={styles.printMeta}>
        <div><b>Tanggal/Waktu:</b> {fmtDT(m.ts)}</div>
        <div><b>Dari Regu:</b> Regu {m.fromRegu} → Regu {m.toRegu}</div>
        {m.actor && <div><b>Pelapor:</b> {m.actor}</div>}
        {m.kategori && <div><b>Kategori:</b> {m.kategori}</div>}
        {m.tipe && <div><b>Tipe:</b> {m.tipe}</div>}
      </div>

      <div className={styles.printSection}>
        <div className={styles.printSectionLabel}>URAIAN LAPORAN</div>
        <pre className={styles.printContent}>{m.content}</pre>
      </div>

      {(m.incidents || m.packages || m.guests) && (
        <div className={styles.printSection}>
          <div className={styles.printSectionLabel}>RINGKASAN</div>
          {m.incidents && <div><b>Insiden:</b> {m.incidents}</div>}
          {m.packages && <div><b>Paket:</b> {m.packages}</div>}
          {m.guests && <div><b>Tamu:</b> {m.guests}</div>}
        </div>
      )}

      {m.notes && (
        <div className={styles.printSection}>
          <div className={styles.printSectionLabel}>CATATAN TAMBAHAN</div>
          <div>{m.notes}</div>
        </div>
      )}

      {m.konfirmasi && (
        <div className={styles.printSection}>
          <div className={styles.printSectionLabel}>KONFIRMASI PENERIMAAN</div>
          <div>Status: {m.konfirmasi.status}</div>
          <div>Oleh: {m.konfirmasi.oleh} (Regu {m.konfirmasi.regu})</div>
          {m.konfirmasi.catatan && <div>Catatan: {m.konfirmasi.catatan}</div>}
          <div>Waktu: {fmtDT(m.konfirmasi.ts)}</div>
        </div>
      )}

      {inventarisDaftar.length > 0 && (
        <div className={styles.printSection}>
          <div className={styles.printSectionLabel}>CEK INVENTARIS</div>
          {inventarisDaftar.map(item => (
            <div key={item.id} className={styles.printInventarisRow}>
              <span>{item.nama}</span>
              <span className={inventarisCek[item.id] === 'ok' ? styles.invOk : inventarisCek[item.id] === 'masalah' ? styles.invMasalah : styles.invBelum}>
                {inventarisCek[item.id] === 'ok' ? '✅ OK' : inventarisCek[item.id] === 'masalah' ? '⚠️ Masalah' : '— Belum dicek'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.printActions + ' no-print'}>
        <Btn onClick={handlePrint} color="var(--accent)" size="md">🖨️ Cetak</Btn>
        <Btn onClick={onClose} color="var(--tx-muted)" variant="outline" size="md">Tutup</Btn>
      </div>
    </div>
  );
}

// ── Komponen Utama ────────────────────────────────────────────────────────────

export function MutTab({
  mutations,
  setMutations,
  reguHari,
  toast,
  canEdit,
  patrols       = [],
  incidents     = [],
  packages      = [],
  guests        = [],
  currentUser,
  standJaga     = [],
  rollings      = [],
  inventarisDaftar = [],
  inventarisCek    = {},
}) {
  const [confirm, confirmDialog] = useConfirm();

  const [open,          setOpen]          = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [photo,         setPhoto]         = useState(null);
  const [viewPhoto,     setViewPhoto]     = useState(null);
  const [printMut,      setPrintMut]      = useState(null);
  const [cekOpen,       setCekOpen]       = useState(null);
  const [cekCatatan,    setCekCatatan]    = useState('');
  const [isSaving,      setIsSaving]      = useState(false);
  const [kategori,      setKategori]      = useState('Serah Terima Jaga');
  const [isAutoMode,    setIsAutoMode]    = useState(false);
  const [noHandoverMode,setNoHandoverMode]= useState(false);
  const [alasanWaktu,   setAlasanWaktu]  = useState('');

  useInnerModal(
    [open, showTemplates, !!viewPhoto, !!printMut, !!cekOpen],
    [setOpen, () => setShowTemplates(false), () => setViewPhoto(null), () => setPrintMut(null), () => setCekOpen(null)],
  );

  // Regu otomatis
  const toReguAuto = String(getNextRegu(reguHari));
  const reguSebelum = String(((Number(reguHari) - 2 + 3) % 3) + 1);
  const myRegu = currentUser ? String(currentUser.regu) : null;

  // Form state
  const [fm, setFm] = useState({
    content: '', fromRegu: String(reguHari), toRegu: toReguAuto,
    incidents: '', packages: '', guests: '', notes: '',
  });
  const f = (k, v) => setFm(p => ({ ...p, [k]: v }));

  // Deteksi jam normal (06.00–08.00 WIB)
  const jamSekarang = (() => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; })();
  const diLuarJamNormal = jamSekarang < 6 || jamSekarang >= 8;
  const labelWaktuNormal = '06.00 – 08.00 WIB';

  // Deteksi belum ada serah terima masuk
  const todayShiftKey = getShiftKey(Date.now());
  const adaSerahTerimaMasuk = mutations.some(
    m => String(m.toRegu) === myRegu && getShiftKey(m.ts) === todayShiftKey,
  );
  const tampilkanBannerNoHandover =
    canEdit && myRegu && String(reguHari) === myRegu && !adaSerahTerimaMasuk;

  // ── Auto-laporan generator ──────────────────────────────────────────────────

  const buatAutoLaporan = (headerExtra) => {
    const now   = new Date();
    const today = now.toDateString();
    const waktu = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const pelapor   = currentUser?.name || '—';
    const reguLabel = 'Regu ' + reguHari;

    const patrolHari      = patrols.filter(p => new Date(p.ts).toDateString() === today).sort((a, b) => a.ts - b.ts);
    const insidenHari     = incidents.filter(i => new Date(i.ts).toDateString() === today);
    const insidenAktif    = incidents.filter(i => i.status !== 'Selesai');
    const paketMasukHari  = packages.filter(p => new Date(p.ts).toDateString() === today).sort((a, b) => a.ts - b.ts);
    const paketDiambilHari= packages.filter(p => p.takenAt && new Date(p.takenAt).toDateString() === today);
    const paketPending    = packages.filter(p => p.status === 'Belum Diambil');
    const tamuMasukHari   = guests.filter(g => new Date(g.ts).toDateString() === today).sort((a, b) => a.ts - b.ts);
    const tamuKeluarHari  = guests.filter(g => g.checkOut && new Date(g.checkOut).toDateString() === today);
    const tamuAda         = guests.filter(g => g.status === 'Masih Ada');
    const standHari       = standJaga.filter(s => new Date(s.ts).toDateString() === today).sort((a, b) => a.ts - b.ts);
    const rollingHari     = rollings.filter(r => new Date(r.ts).toDateString() === today).sort((a, b) => a.ts - b.ts);

    // Patroli per petugas
    const patrolPerPetugas = {};
    patrolHari.forEach(p => {
      const officers = (p.officer || '—').split(/[,/]/).map(s => s.trim()).filter(Boolean);
      const pos = p.pos || '—';
      officers.forEach(ofcr => {
        if (!patrolPerPetugas[ofcr]) patrolPerPetugas[ofcr] = {};
        if (!patrolPerPetugas[ofcr][pos]) patrolPerPetugas[ofcr][pos] = [];
        patrolPerPetugas[ofcr][pos].push(p);
      });
    });

    const kondisiAman = insidenAktif.length === 0 && paketPending.length === 0;
    let isi = '';

    if (headerExtra) {
      isi += '═══════════════════════════════════════\n';
      isi += '⚠️  TANPA SERAH TERIMA DARI REGU SEBELUMNYA\n';
      isi += '═══════════════════════════════════════\n';
      isi += headerExtra + '\n';
    }

    isi += '═══════════════════════════════════════\n';
    isi += '   LAPORAN MUTASI TUGAS JAGA\n';
    isi += '   BBPKA II Jatinangor\n';
    isi += '═══════════════════════════════════════\n';
    isi += 'Hari / Tanggal : ' + now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '\n';
    isi += 'Waktu laporan  : ' + waktu + ' WIB\n';
    isi += 'Pelapor        : ' + pelapor + ' (' + reguLabel + ')\n\n';

    isi += '🔄 SERAH TERIMA TUGAS JAGA:\n';
    if (headerExtra) {
      isi += `  Pukul 08.00 WIB — ${reguLabel} mulai tugas jaga,\n`;
      isi += `  NAMUN Regu ${reguSebelum} tidak membuat laporan\n`;
      isi += `  mutasi/serah terima. Laporan ini dibuat sebagai\n`;
      isi += `  catatan kondisi awal versi ${reguLabel}.\n`;
    } else {
      isi += `  Pukul 08.00 WIB — ${reguLabel} resmi menerima\n`;
      isi += `  tugas jaga dari Regu ${reguSebelum}.\n`;
    }
    isi += `  Kondisi saat serah terima: ${kondisiAman ? 'AMAN & TERKENDALI ✅' : 'PERLU PERHATIAN ⚠️'}\n\n`;

    // Patroli
    const petugasNama = Object.keys(patrolPerPetugas);
    isi += `👣 PATROLI (${patrolHari.length}x · ${petugasNama.length} petugas):\n`;
    if (petugasNama.length > 0) {
      let noUrut = 1;
      petugasNama.forEach(ofcr => {
        Object.entries(patrolPerPetugas[ofcr]).forEach(([pos, patrls]) => {
          const gedungList   = [...new Set(patrls.flatMap(p => p.areas || []))];
          const catatanList  = patrls.map(p => p.notes).filter(n => n?.trim());
          const waktuMulai   = fmtT(Math.min(...patrls.map(p => p.ts)));
          const waktuAkhir   = fmtT(Math.max(...patrls.map(p => p.ts)));
          const rentangWaktu = patrls.length > 1 ? `${waktuMulai}–${waktuAkhir}` : waktuMulai;
          const adaTemuan    = catatanList.some(n =>
            ['Rusak','Hilang','Mencurigakan','Perlu Perhatian','Redup','Kotor','Tak Dikenal','Kebocoran'].some(kw => n.includes(kw)),
          );
          const situasiLabel = catatanList.length > 0
            ? (adaTemuan ? '⚠️ Ada temuan: ' : '✅ ') + catatanList.join('; ')
            : '✅ Situasi aman, tidak ada temuan';

          isi += `  ${String(noUrut).padStart(2, '0')}. Petugas ${ofcr} melaksanakan patroli\n`;
          isi += `      Area   : ${pos} [${rentangWaktu}]\n`;
          isi += `      Titik  : ${gedungList.join(', ')}\n`;
          isi += `      Situasi: ${situasiLabel}\n`;
          noUrut++;
        });
      });
    } else {
      isi += '  Belum ada patroli tercatat pada shift ini.\n';
    }

    isi += '\n🚨 INSIDEN:\n';
    if (insidenHari.length > 0) {
      insidenHari.forEach((inc, i) => {
        isi += `  ${String(i+1).padStart(2,'0')}. [${fmtT(inc.ts)}] [${inc.category}] ${inc.title}\n`;
        isi += `      Lokasi : ${inc.pos || '—'}\n`;
        isi += `      Status : ${inc.status}${inc.status !== 'Selesai' ? ' 🔴' : ' ✅'}\n`;
        if (inc.desc)    isi += `      Ket    : ${inc.desc}\n`;
        if (inc.officer) isi += `      Petugas: ${inc.officer}\n`;
      });
      if (insidenAktif.length > 0) {
        isi += `  ⚠️ MASIH AKTIF: ${insidenAktif.map(i => i.title).join(', ')}\n`;
        isi += '  → Harap ditindaklanjuti oleh regu berikutnya.\n';
      }
    } else {
      isi += '  Tidak ada insiden — kondisi AMAN ✅\n';
    }

    isi += '\n📦 PAKET & KURIR:\n';
    if (paketMasukHari.length > 0) {
      isi += `  Masuk hari ini (${paketMasukHari.length} item):\n`;
      paketMasukHari.forEach((p, i) => {
        isi += `  ${String(i+1).padStart(2,'0')}. [${fmtT(p.ts)}] ${p.type}\n`;
        isi += `      Penerima : ${p.recipient}\n`;
        isi += `      Pengirim : ${p.sender || '—'}\n`;
        isi += `      Status   : ${p.status}${p.status === 'Belum Diambil' ? ' ⏳' : ' ✅'}\n`;
        if (p.notes) isi += `      Resi     : ${p.notes}\n`;
      });
    } else {
      isi += '  Tidak ada paket masuk — LENGKAP ✅\n';
    }
    if (paketDiambilHari.length > 0)
      isi += `  Sudah diambil/diantar: ${paketDiambilHari.map(p => p.recipient).join(', ')}\n`;
    if (paketPending.length > 0) {
      isi += `  ⏳ Belum diambil (${paketPending.length}): ${paketPending.map(p => `${p.recipient} (${p.type})`).join(', ')}\n`;
      isi += '  → Mohon ingatkan penerima oleh regu berikutnya.\n';
    }

    isi += '\n🏠 TAMU & PESERTA:\n';
    if (tamuMasukHari.length > 0) {
      isi += `  Masuk hari ini (${tamuMasukHari.length} orang):\n`;
      tamuMasukHari.forEach((g, i) => {
        isi += `  ${String(i+1).padStart(2,'0')}. [${fmtT(g.ts)}] ${g.name} (${g.type})\n`;
        if (g.institution) isi += `      Instansi  : ${g.institution}\n`;
        if (g.purpose)     isi += `      Keperluan : ${g.purpose}\n`;
        if (g.room)        isi += `      Kamar/Kelas: ${g.room}\n`;
        if (g.vehicle)     isi += `      Kendaraan : ${g.vehicle}\n`;
        isi += `      Status    : ${g.status}${g.status === 'Masih Ada' ? ' ⏳' : ' ✅'}\n`;
      });
    } else {
      isi += '  Tidak ada tamu masuk — LENGKAP ✅\n';
    }
    if (tamuKeluarHari.length > 0)
      isi += `  Check-out hari ini: ${tamuKeluarHari.map(g => `${g.name} [${fmtT(g.checkOut)}]`).join(', ')}\n`;
    if (tamuAda.length > 0) {
      isi += `  ⏳ Masih di dalam (${tamuAda.length}): ${tamuAda.map(g => g.name + (g.room ? ` — ${g.room}` : '')).join(', ')}\n`;
      isi += '  → Pantau hingga check-out.\n';
    } else {
      isi += '  Tidak ada tamu/peserta yang masih di dalam ✅\n';
    }

    if (standHari.length > 0) {
      isi += `\n🪖 STAND JAGA (${standHari.length}x):\n`;
      standHari.forEach((s, i) => {
        isi += `  ${String(i+1).padStart(2,'0')}. [${fmtT(s.ts)}] ${s.area}\n`;
        isi += `      Petugas: ${s.officer || '—'}\n`;
        if (s.notes) isi += `      Ket    : ${s.notes}\n`;
      });
    }

    if (rollingHari.length > 0) {
      isi += `\n↺ ROLLING POS (${rollingHari.length}x):\n`;
      rollingHari.forEach((r, i) => {
        isi += `  ${String(i+1).padStart(2,'0')}. [${fmtT(r.ts)}] ${r.member || ('Regu ' + r.fromRegu)}\n`;
        if (r.fromPos && r.toPos) isi += `      ${r.fromPos} → ${r.toPos}\n`;
        if (r.notes) isi += `      Ket: ${r.notes}\n`;
      });
    }

    isi += '\n───────────────────────────────────────\n';
    isi += 'RINGKASAN SHIFT:\n';
    isi += `  Patroli  : ${patrolHari.length}x${patrolHari.length === 0 ? ' ⚠️ Belum ada!' : ' ✅'}\n`;
    isi += `  Stand    : ${standHari.length}x${standHari.length === 0 ? ' —' : ' ✅'}\n`;
    isi += `  Insiden  : ${insidenHari.length === 0 ? 'Tidak ada ✅' : `${insidenHari.length} (${insidenAktif.length} aktif)`}\n`;
    isi += `  Paket    : ${paketMasukHari.length === 0 ? 'Tidak ada ✅' : `${paketMasukHari.length} masuk, ${paketPending.length} pending`}\n`;
    isi += `  Tamu     : ${tamuMasukHari.length === 0 ? 'Tidak ada ✅' : `${tamuMasukHari.length} masuk, ${tamuAda.length} masih di dalam`}\n`;
    isi += `  Kondisi  : ${kondisiAman ? 'AMAN & TERKENDALI ✅' : 'PERLU PERHATIAN ⚠️'}\n`;
    isi += '───────────────────────────────────────\n';
    isi += `Dilaporkan oleh: ${pelapor} (${reguLabel})\n`;
    isi += `Waktu laporan  : ${waktu} WIB`;

    f('content', isi.trim());
    f('incidents', insidenAktif.length > 0
      ? `${insidenAktif.length} aktif — ${insidenAktif.map(i => i.title).join(', ')}`
      : 'Tidak ada ✅');
    f('packages', paketPending.length > 0
      ? `${paketPending.length} belum diambil — ${paketPending.map(p => p.recipient).join(', ')}`
      : 'Tidak ada ✅');
    f('guests', tamuAda.length > 0
      ? `${tamuAda.length} orang — ${tamuAda.map(g => g.name).join(', ')}`
      : 'Tidak ada ✅');

    toast(headerExtra
      ? '📋 Laporan terima tugas (tanpa serah terima) berhasil dibuat!'
      : '⚡ Laporan shift berhasil dibuat!');
  };

  const buatLaporanTanpaSerahTerima = () => {
    const headerExtra =
      `Regu ${reguHari} mulai bertugas hari ini, namun Regu ${reguSebelum}\n` +
      `TIDAK membuat laporan mutasi/serah terima jaga.\n` +
      `Laporan di bawah ini disusun otomatis sebagai catatan KONDISI AWAL\n` +
      `yang ditemukan Regu ${reguHari} saat menerima tugas jaga,\n` +
      `agar tidak menjadi tanggung jawab Regu ${reguHari} jika ada masalah\n` +
      `yang sebenarnya berasal dari shift sebelumnya.\n`;
    buatAutoLaporan(headerExtra);
    f('fromRegu', reguSebelum);
    f('toRegu', myRegu);
  };

  // ── Konfirmasi terima ───────────────────────────────────────────────────────

  const bisaCekTerima = (m) => myRegu && String(m.toRegu) === myRegu && !m.konfirmasi;

  const konfirmasiTerima = (m) => {
    setMutations(prev => prev.map(x =>
      x.id === m.id
        ? { ...x, konfirmasi: {
            status: 'Diterima',
            oleh: currentUser?.name || '—',
            regu: myRegu,
            catatan: cekCatatan.trim(),
            ts: Date.now(),
          }}
        : x,
    ));
    setCekOpen(null);
    setCekCatatan('');
    toast('✅ Serah terima dikonfirmasi!');
  };

  // ── Simpan mutasi ───────────────────────────────────────────────────────────

  const handleSaveMutasi = async () => {
    const contentTrim = fm.content.trim();
    if (!contentTrim) {
      toast('⚠️ Harap isi uraian mutasi secara detail.', false);
      return;
    }
    if (contentTrim.length > 3000) {
      toast('Uraian mutasi terlalu panjang (maks. 3000 karakter)', false);
      return;
    }
    if (diLuarJamNormal && !alasanWaktu.trim()) {
      toast('⏰ Di luar jam normal (06.00–08.00). Wajib isi alasan!', false);
      return;
    }

    const yes = await confirm({
      title: 'Simpan Mutasi?',
      message: 'Laporan mutasi tidak bisa diedit setelah disimpan. Pastikan data sudah benar.',
      confirmLabel: 'Simpan',
      confirmColor: 'var(--accent)',
    });
    if (!yes) return;

    setIsSaving(true);
    const now   = new Date();
    const waktu = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tipe  = noHandoverMode ? 'TANPA_SERAH_TERIMA' : isAutoMode ? 'AUTO' : 'MANUAL';
    const keteranganWaktu = diLuarJamNormal && alasanWaktu.trim()
      ? `\n[DI LUAR JAM NORMAL] Alasan: ${alasanWaktu.trim()}`
      : '';
    const prefix = noHandoverMode
      ? `[TANPA SERAH TERIMA] - ${kategori.toUpperCase()} - ${waktu}${keteranganWaktu}\n\n`
      : isAutoMode
        ? `[SYSTEM] - ${kategori.toUpperCase()} - ${waktu}${keteranganWaktu}\n\n`
        : `[MANUAL] - ${kategori.toUpperCase()} - ${waktu}${keteranganWaktu}\n\n`;

    const entry = {
      ...fm,
      content: prefix + fm.content.trim(),
      photo,
      id: Date.now(),
      ts: Date.now(),
      tipe,
      kategori,
      actor: currentUser?.name || '—',
    };

    if (noHandoverMode) {
      entry.konfirmasi = {
        status: 'Diterima (Tanpa Serah Terima)',
        oleh: currentUser?.name || '—',
        regu: myRegu,
        catatan: `Regu ${reguSebelum} tidak membuat laporan serah terima.`,
        ts: Date.now(),
      };
    }

    try {
      await setMutations(prev => [...prev, entry]);
      setFm({ content: '', fromRegu: String(reguHari), toRegu: toReguAuto, incidents: '', packages: '', guests: '', notes: '' });
      setKategori('Serah Terima Jaga');
      setPhoto(null);
      setIsAutoMode(false);
      setNoHandoverMode(false);
      setAlasanWaktu('');
      setOpen(false);
      toast('✅ Mutasi disimpan!');
      auditAction(currentUser?.name || '—', currentUser?.regu || 0, 'SIMPAN_MUTASI', `[${tipe}] ${kategori}`);
    } catch {
      toast('❌ Gagal menyimpan. Periksa koneksi lalu coba lagi.', false);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {confirmDialog}

      <PH
        title="Mutasi Pamdal BBPKA II Jatinangor"
        sub="Laporan serah terima tugas jaga"
        action={canEdit && (
          <Btn onClick={() => setShowTemplates(true)} color="var(--blue-dark)" size="md">
            {IC({ n: 'plus', s: 14 })} Catat Mutasi
          </Btn>
        )}
      />

      {!canEdit && <ReadOnlyBanner reguHari={reguHari} />}

      {/* Banner: belum ada serah terima */}
      {tampilkanBannerNoHandover && (
        <div className={styles.bannerNoHandover}>
          <span className={styles.bannerIcon}>⚠️</span>
          <div className={styles.bannerBody}>
            <div className={styles.bannerTitle}>Belum Ada Serah Terima dari Regu {reguSebelum}</div>
            <div className={styles.bannerDesc}>
              Regu {reguSebelum} belum membuat laporan mutasi serah terima untuk shift ini.
              Buat laporan terima tugas berisi kondisi awal yang ditemukan, agar tercatat
              di buku mutasi dan diketahui Pimpinan.
            </div>
            <button
              className={styles.bannerBtn}
              onClick={() => {
                setIsAutoMode(true);
                setNoHandoverMode(true);
                setKategori('Tidak Ada Serah Terima');
                f('content', '');
                setOpen(true);
                setTimeout(buatLaporanTanpaSerahTerima, 100);
              }}
            >
              📋 Lapor Terima Tugas (Tanpa Serah Terima)
            </button>
          </div>
        </div>
      )}

      {/* Daftar mutasi */}
      {mutations.length === 0 && (
        <div className={styles.empty}>Belum ada mutasi.</div>
      )}

      {[...mutations].reverse().map(m => {
        const isAuto       = m.tipe === 'AUTO' || (!m.tipe && m.content?.startsWith('[SYSTEM]'));
        const isNoHandover = m.tipe === 'TANPA_SERAH_TERIMA';
        const borderColor  = isNoHandover
          ? 'rgba(201,27,42,.45)'
          : m.konfirmasi
            ? 'rgba(14,165,233,.35)'
            : isAuto
              ? 'var(--accent-glow)'
              : 'rgba(var(--orb-rgb),.35)';
        const headerBg = isNoHandover
          ? 'rgba(201,27,42,.08)'
          : isAuto
            ? 'var(--bg-surface)'
            : 'rgba(var(--orb-rgb),.06)';

        return (
          <div key={m.id} className="data-card" style={{ borderColor, borderLeftWidth: 3 }}>
            {/* Header badge */}
            <div className={styles.cardHeader} style={{ background: headerBg }}>
              {isNoHandover
                ? <span className={styles.badgeNoHandover}>⚠️ TANPA SERAH TERIMA</span>
                : isAuto
                  ? <span className={styles.badgeAuto}>⚙️ SYSTEM · AUTO</span>
                  : <span className={styles.badgeManual}>✏️ MANUAL</span>
              }
              {m.kategori && m.kategori !== 'System' && (
                <span className={styles.badgeKategori}>· {m.kategori}</span>
              )}
              {m.actor && <span className={styles.badgeActor}>· {m.actor}</span>}
            </div>

            {/* Meta row */}
            <div className={styles.metaRow}>
              <div className={styles.metaLeft}>
                <Bdg text={`Regu ${m.fromRegu}`} color="var(--accent)" />
                {IC({ n: 'arr', s: 13, c: 'var(--tx-muted)' })}
                {m.toRegu && <Bdg text={`Regu ${m.toRegu}`} color="var(--accent)" />}
                {m.photo && <Bdg text="📷" color="var(--violet)" />}
                {m.konfirmasi
                  ? <span className={styles.pillDiterima}>✅ Diterima Regu {m.konfirmasi.regu}</span>
                  : m.toRegu
                    ? <span className={styles.pillPending}>⏳ Belum Dikonfirmasi</span>
                    : null
                }
              </div>
              <div className={styles.metaRight}>
                <span className={styles.ts}>{fmtDT(m.ts)}</span>
                <Btn onClick={() => setPrintMut(m)} color="var(--accent)" variant="outline" size="sm">
                  {IC({ n: 'print', s: 11 })} Cetak
                </Btn>
              </div>
            </div>

            {/* Isi laporan */}
            <pre className={styles.contentBox}>{m.content}</pre>

            {/* Ringkasan pills */}
            <div className={styles.summaryRow}>
              {m.incidents && (
                <div className={styles.pillIncident}>
                  <div className={styles.pillLabel}>INSIDEN</div>
                  <div className={styles.pillValue} style={{ color: 'var(--red)' }}>{m.incidents}</div>
                </div>
              )}
              {m.packages && (
                <div className={styles.pillPackage}>
                  <div className={styles.pillLabel}>PAKET</div>
                  <div className={styles.pillValue} style={{ color: 'var(--amber-text)' }}>{m.packages}</div>
                </div>
              )}
              {m.guests && (
                <div className={styles.pillGuest}>
                  <div className={styles.pillLabel}>TAMU</div>
                  <div className={styles.pillValue} style={{ color: 'var(--violet)' }}>{m.guests}</div>
                </div>
              )}
            </div>

            {/* Foto */}
            {m.photo && (
              <button className={styles.fotoBtn} onClick={() => setViewPhoto(m.photo)}>
                <img src={m.photo} alt="" className={styles.fotoThumb} />
                Lihat Foto
              </button>
            )}

            {/* Catatan */}
            {m.notes && <div className={styles.notes}>📝 {m.notes}</div>}

            {/* Catatan konfirmasi */}
            {m.konfirmasi?.catatan && (
              <div className={styles.catatanKonfirmasi}>
                📋 <b>Catatan Regu {m.konfirmasi.regu}:</b> {m.konfirmasi.catatan}
              </div>
            )}

            {/* Tombol konfirmasi */}
            {bisaCekTerima(m) && (
              <button
                className={styles.btnKonfirmasi}
                onClick={() => { setCekOpen(m); setCekCatatan(''); }}
              >
                ✅ Konfirmasi Terima Serah Terima
              </button>
            )}
          </div>
        );
      })}

      {/* Modal: Lihat Foto */}
      <Modal open={!!viewPhoto} onClose={() => setViewPhoto(null)} title="Foto Mutasi">
        {viewPhoto && (
          <div style={{ textAlign: 'center' }}>
            <img src={viewPhoto} alt="mutasi" className={styles.fotoFull} />
          </div>
        )}
      </Modal>

      {/* Modal: Pilih Template */}
      <Modal open={showTemplates} onClose={() => setShowTemplates(false)} title="Pilih Template Mutasi">
        <div style={{ marginBottom: 12 }}>
          <div className={styles.tplHint}>
            Pilih template sebagai titik awal laporan, lalu sesuaikan isinya sebelum menyimpan.
          </div>
          <div className={styles.tplPlaceholderNote}>
            <span>✏️</span>
            <span>Ganti teks dalam tanda <b>[kurung siku]</b> dengan data sebenarnya sebelum menyimpan.</span>
          </div>
          <div className={styles.tplGrid}>
            {MUTASI_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                className={styles.tplCard}
                style={{ background: tpl.bg, border: `1.5px solid ${tpl.border}` }}
                onClick={() => {
                  setIsAutoMode(false);
                  setNoHandoverMode(false);
                  setKategori(tpl.kategori);
                  f('content', tpl.content);
                  f('incidents', tpl.incidents);
                  f('packages', tpl.packages);
                  f('guests', tpl.guests);
                  f('notes', tpl.notes);
                  setShowTemplates(false);
                  setOpen(true);
                }}
              >
                <div className={styles.tplIcon}>{tpl.icon}</div>
                <div className={styles.tplLabel} style={{ color: tpl.color }}>{tpl.label}</div>
                <div className={styles.tplKategori}>{tpl.kategori}</div>
              </button>
            ))}
          </div>

          <div className={styles.orDivider}>
            <div className={styles.orLine} />
            <span className={styles.orText}>atau</span>
            <div className={styles.orLine} />
          </div>

          <button
            className={styles.formKosongBtn}
            onClick={() => {
              setIsAutoMode(false);
              setNoHandoverMode(false);
              setKategori('Serah Terima Jaga');
              f('content', ''); f('incidents', ''); f('packages', ''); f('guests', ''); f('notes', '');
              setShowTemplates(false);
              setOpen(true);
            }}
          >
            <span style={{ fontSize: 18 }}>✏️</span>
            <div style={{ textAlign: 'left' }}>
              <div className={styles.formKosongTitle}>Form Kosong</div>
              <div className={styles.formKosongSub}>Isi uraian dari awal tanpa template</div>
            </div>
          </button>
        </div>
      </Modal>

      {/* Modal: Cetak */}
      <Modal open={!!printMut} onClose={() => setPrintMut(null)} title="Laporan Mutasi" wide noPad>
        {printMut && (
          <MutPrint
            m={printMut}
            onClose={() => setPrintMut(null)}
            inventarisDaftar={inventarisDaftar}
            inventarisCek={inventarisCek}
          />
        )}
      </Modal>

      {/* Modal: Konfirmasi Serah Terima */}
      <Modal open={!!cekOpen} onClose={() => setCekOpen(null)} title="Konfirmasi Serah Terima">
        {cekOpen && (
          <div>
            <div className={styles.cekPreview}>
              <div className={styles.cekPreviewTitle}>📋 Laporan dari Regu {cekOpen.fromRegu}</div>
              <pre className={styles.cekPreviewContent}>{cekOpen.content}</pre>
              {cekOpen.incidents && <div className={styles.cekIncident}>⚠️ Insiden: {cekOpen.incidents}</div>}
              {cekOpen.packages  && <div className={styles.cekPackage}>📦 Paket: {cekOpen.packages}</div>}
              {cekOpen.guests    && <div className={styles.cekGuest}>🏠 Tamu: {cekOpen.guests}</div>}
              {cekOpen.notes     && <div className={styles.cekNotes}>📝 Catatan: {cekOpen.notes}</div>}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className={styles.cekLabel}>📝 Catatan Temuan (opsional)</label>
              <textarea
                value={cekCatatan}
                onChange={e => setCekCatatan(e.target.value)}
                placeholder="Tulis temuan atau catatan saat cek serah terima... (kosongkan jika tidak ada)"
                className={styles.cekTextarea}
              />
            </div>

            <div className={styles.cekKonfirmasiNote}>
              ✅ Dengan konfirmasi ini, Regu {myRegu} menyatakan telah menerima
              serah terima dari Regu {cekOpen.fromRegu}.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => konfirmasiTerima(cekOpen)} color="var(--accent)" size="lg">
                Konfirmasi Diterima
              </Btn>
              <Btn onClick={() => setCekOpen(null)} color="var(--tx-muted)" variant="outline" size="lg">
                Batal
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Form Buat Mutasi */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setPhoto(null); setIsAutoMode(false); setNoHandoverMode(false); setShowTemplates(false); }}
        title="Buat Laporan Mutasi"
      >
        {/* Toggle Manual / Auto */}
        {!noHandoverMode && (
          <div className={styles.modeToggle}>
            <button
              className={styles.modeBtn + (!isAutoMode ? ' ' + styles.modeBtnActive : '')}
              onClick={() => { setIsAutoMode(false); f('content', ''); }}
            >
              ✏️ Manual
            </button>
            <button
              className={styles.modeBtn + (isAutoMode ? ' ' + styles.modeBtnActive : '')}
              onClick={() => { setIsAutoMode(true); f('content', ''); setTimeout(buatAutoLaporan, 100); }}
            >
              ⚙️ Auto (System)
            </button>
          </div>
        )}

        {/* Status badge */}
        <div className={styles.statusRow}>
          {noHandoverMode
            ? <span className={styles.statusBadgeNoHandover}>⚠️ [TANPA SERAH TERIMA] — Laporan kondisi awal terima tugas</span>
            : isAutoMode
              ? <span className={styles.statusBadgeAuto}>⚙️ [SYSTEM] — Log akan bertanda otomatis</span>
              : <span className={styles.statusBadgeManual}>✏️ [MANUAL] — Input langsung oleh petugas</span>
          }
          {/* Ganti template */}
          {!isAutoMode && fm.content.trim().length > 0 && (() => {
            const matchTpl = MUTASI_TEMPLATES.find(t =>
              fm.content.trim().startsWith(t.content.trim().slice(0, 30)),
            );
            if (!matchTpl) return null;
            return (
              <button
                className={styles.gantiTplBtn}
                style={{ background: matchTpl.bg, border: `1px solid ${matchTpl.border}`, color: matchTpl.color }}
                onClick={() => {
                  f('content', ''); f('incidents', ''); f('packages', ''); f('guests', ''); f('notes', '');
                  setShowTemplates(true);
                  setOpen(false);
                }}
              >
                {matchTpl.icon} {matchTpl.label} · Ganti template
              </button>
            );
          })()}
        </div>

        {/* Kategori */}
        <div style={{ marginBottom: 10 }}>
          <label className={styles.fieldLabel}>📂 Kategori</label>
          <select
            value={kategori}
            onChange={e => setKategori(e.target.value)}
            className={styles.selectKategori}
          >
            {KATEGORI_OPTS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Info serah terima */}
        <div className={styles.serahTerimaBox}>
          <div
            className={styles.serahTerimaInner}
            style={{
              background: noHandoverMode ? 'rgba(201,27,42,.08)' : 'var(--accent-tint)',
              border: noHandoverMode ? '1.5px solid rgba(201,27,42,.35)' : '1.5px solid #A5D6A7',
            }}
          >
            <span className={styles.serahTerimaEmoji}>{noHandoverMode ? '⚠️' : '🔄'}</span>
            <div style={{ flex: 1 }}>
              <div className={styles.serahTerimaTitle} style={{ color: noHandoverMode ? 'var(--red)' : 'var(--accent-text)' }}>
                {noHandoverMode ? 'Tanpa Serah Terima' : 'Serah Terima'}
              </div>
              {noHandoverMode
                ? <div className={styles.serahTerimaSub}>
                    Regu <b>{reguSebelum}</b> tidak melapor → Regu <b>{reguHari}</b> mencatat sendiri
                  </div>
                : <div className={styles.serahTerimaSub}>
                    Regu <b>{reguHari}</b> → Regu <b>{toReguAuto}</b>
                  </div>
              }
            </div>
          </div>
          {!isAutoMode && !noHandoverMode && (
            <Btn onClick={buatAutoLaporan} color="var(--accent)" size="sm">⚡ Isi Otomatis</Btn>
          )}
        </div>

        {/* Dari / Kepada Regu */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Inp label="Dari Regu" value={fm.fromRegu} onChange={e => f('fromRegu', e.target.value)} as="select" half>
            {[1, 2, 3].map(r => <option key={r} value={r}>Regu {r}</option>)}
          </Inp>
          <Inp label="Kepada Regu" value={fm.toRegu} onChange={e => f('toRegu', e.target.value)} as="select" half>
            <option value="">— Pilih —</option>
            {[1, 2, 3].map(r => <option key={r} value={r}>Regu {r}</option>)}
          </Inp>
        </div>

        {/* Uraian */}
        <Inp
          label="Uraian Laporan"
          value={fm.content}
          onChange={e => f('content', e.target.value)}
          as="textarea"
          placeholder={isAutoMode ? 'Laporan otomatis sudah diisi...' : 'Tulis uraian mutasi secara detail...'}
        />

        {/* Warning placeholder */}
        {/\[.+?\]/.test(fm.content) && (
          <div className={styles.placeholderWarning}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>Uraian masih mengandung placeholder <b>[...]</b> — ganti dengan data sebenarnya sebelum menyimpan.</span>
          </div>
        )}

        {/* Insiden / Paket / Tamu */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Inp label="Insiden" value={fm.incidents} onChange={e => f('incidents', e.target.value)} placeholder="Detail" half />
          <Inp label="Paket"   value={fm.packages}  onChange={e => f('packages', e.target.value)}  placeholder="Jumlah" half />
          <Inp label="Tamu"    value={fm.guests}     onChange={e => f('guests', e.target.value)}    placeholder="Nama"   half />
        </div>

        <Inp
          label="Catatan Tambahan"
          value={fm.notes}
          onChange={e => f('notes', e.target.value)}
          as="textarea"
          placeholder="Pesan untuk regu berikutnya..."
        />

        {/* Banner di luar jam normal */}
        {diLuarJamNormal && (
          <div className={styles.luarJamBanner}>
            <div className={styles.luarJamHeader}>
              <span style={{ fontSize: 20 }}>⏰</span>
              <div>
                <div className={styles.luarJamTitle}>Di Luar Jam Normal Mutasi</div>
                <div className={styles.luarJamSub}>Pembuatan mutasi seharusnya dilakukan {labelWaktuNormal}</div>
              </div>
            </div>
            <label className={styles.luarJamLabel}>⚠️ Wajib isi alasan pembuatan di luar jam normal:</label>
            <textarea
              value={alasanWaktu}
              onChange={e => setAlasanWaktu(e.target.value)}
              placeholder="Contoh: Serah terima terlambat karena briefing pimpinan, atau mutasi darurat karena ada insiden..."
              rows={3}
              className={styles.luarJamTextarea}
            />
          </div>
        )}

        <PhotoPicker photo={photo} setPhoto={setPhoto} label="📷 Foto Kondisi Laporan" color="var(--accent)" />

        <div style={{ display: 'flex', gap: 8 }}>
          <BtnSimpan onClick={handleSaveMutasi} loading={isSaving}>
            {noHandoverMode ? '⚠️ Simpan Laporan' : isAutoMode ? '⚡ Simpan Auto' : '✅ Simpan Manual'}
          </BtnSimpan>
          <BtnBatal onClick={() => { setOpen(false); setIsAutoMode(false); setNoHandoverMode(false); }} />
        </div>
      </Modal>
    </div>
  );
}

export default MutTab;
