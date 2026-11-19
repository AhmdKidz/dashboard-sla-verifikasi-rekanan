# Dashboard SLA Verifikasi Rekanan (Lokal)

Dashboard operasional lokal untuk melacak siklus registrasi, jarak antar-log (pairing per-bidang maupun kronologis keseluruhan), revisi dokumen, kinerja verifikator, dan peringkat kecepatan rekanan **Badan Usaha** maupun **Mandor**.

## Fitur Utama

1. **Ringkasan Eksekutif (`Overview`)**
   - 6 KPI inti (Total Rekanan Unik, Tingkat Kelulusan Penuh, Antrean Aktif & Stagnan >30 hari, Rata-rata SLA Verifikator + delta pasca-Oktober 2026, Rata-rata Revisi Rekanan, dan Durasi Siklus End-to-End).
   - Callout bottleneck otomatis, grafik tren bulanan (23 bulan) & triwulanan, donut distribusi status klik-untuk-filter, komparasi bottleneck antar-bidang dengan garis acuan target 3 hari, serta output kelulusan per triwulan.
2. **Top 10 Tercepat & Terlama (`Leaderboard`)**
   - Peringkat **Top 10 Tercepat** dan **Top 10 Terlama** secara terpisah untuk **Badan Usaha** (ID `1xxx`/`2xxx`) dan **Mandor** (ID `8xxx`), dilengkapi grafik batang horizontal, filter Divisi, dan opsi menyertakan rekanan *Dalam Proses*.
3. **Pelacak Rekanan & Log (`Tracker`) + Panel Detail Timeline**
   - Tabel `@tanstack/react-table` dengan pencarian real-time (nama perusahaan/mandor, ID vendor, aktivitas terakhir), filter Tipe Rekanan, Divisi, Status Tindak Lanjut, dan Band Frekuensi Revisi.
   - Klik rekanan mana pun untuk membuka **Panel Inspeksi Log**:
     - Proporsi waktu Verifikator vs Revisi Rekanan vs Internal/Final Approval.
     - Deteksi otomatis jeda waktu terlama (bottleneck rekanan).
     - Matriks progres & jumlah reject/revisi per bidang.
     - Toggle **Jarak Per-Bidang** (pairing sesuai metode laporan SLA) vs **Jarak Kronologis Keseluruhan** (log-ke-log + kumulatif `T+hari`).
     - Tampilan **Timeline** maupun **Tabel Audit**, plus tombol **Ekspor Log Rekanan (.xlsx)**.
4. **Analisa Bidang & Periode (`Analytics`)**
   - Studio Tren Interaktif Bulanan & Triwulanan (komparasi 6 bidang verifikator, 5 bidang revisi rekanan, atau fokus per bidang).
   - Komparasi Sebelum vs Sesudah Oktober 2026, Evaluasi 3 Periode Waktu (`Jan 25–Mar 26`, `Apr–Sep 26`, `Okt–Nov 26`), Distribusi Status Approve (St=1) vs Reject (St=2), dan Ringkasan Tipe Activity.
5. **Divisi, Revisi & Antrean Stagnan (`Divisions & Revisions`)**
   - Performa 5 Divisi operasional yang diekstrak otomatis dari pesan registrasi (`Infrastruktur I`, `Gedung`, `Sipil Umum`, `Infrastruktur II`, `EPC`).
   - Dampak jumlah putaran revisi terhadap lama siklus kelulusan & peta bidang penyumbang reject terbesar.
   - Distribusi *Aging Queue* dan daftar 15 rekanan paling lama tertahan di Antrean Verifikator maupun Revisi Rekanan.
6. **Kinerja Verifikator & Data Lokal (`Verifiers & Data`)**
   - Peringkat kepatuhan SLA ≤ 3 hari per verifikator (`Message_by`) dengan drilldown 100 aktivitas terakhir.
   - Database lokal **SQLite** (`node:sqlite` bawaan Node.js v24) dengan fitur **Impor Excel baru (.xlsx)** langsung dari UI serta **Ekspor laporan (.xlsx)**.

## Arsitektur & Stack

- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS v4, Radix UI (`shadcn/ui` patterns), Lucide React, Recharts, TanStack Table v8.
- **Backend & Penyimpanan Lokal:** Node.js v24 (`node:sqlite` bawaan tanpa instalasi DB eksternal), Express 5, Multer, SheetJS (`xlsx`).

## Cara Menjalankan di Lokal

### 1. Instalasi dependensi
```bash
npm install
```

### 2. Isi (Seed) database SQLite dari file Excel history registrasi
```bash
npm run seed -- "path/ke/history_registrasi_rekanan2026-11-10.xlsx"
```
*(Atau langsung jalankan aplikasi dan unggah file `.xlsx` dari menu **Verifikator & Data Lokal**.)*

### 3. Jalankan Dashboard & API Lokal
```bash
npm run dev
```
- **Dashboard Web:** `http://localhost:5173`
- **Local API Server:** `http://localhost:3001`

### Mode Produksi (Single Server)
```bash
npm run build
npm run server
```
Akses di `http://localhost:3001`.
