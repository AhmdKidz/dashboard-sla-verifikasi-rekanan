import express from 'express';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, getMeta, replaceDatabaseContents, DB_PATH } from './db.mjs';
import { parseRegistrationWorkbook } from './parser.mjs';
import { computeFinalApprovalDiagnostic, computeFgdDefenseData } from '../shared/slaParser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(express.json());

const BIDANG_ORDER = ['Teknik', 'Keuangan', 'Legal', 'BIM', 'CQSMS/QHSSE', 'Final Approval', 'Mandor', 'Umum'];
const TECH_BIDANG = ['Teknik', 'Keuangan', 'Legal', 'BIM', 'CQSMS/QHSSE', 'Final Approval'];
const QUARTER_DAYS = {
  'Q1 2025': 90,
  'Q2 2025': 91,
  'Q3 2025': 92,
  'Q4 2025': 92,
  'Q1 2026': 90,
  'Q2 2026': 91,
  'Q3 2026': 92,
  'Q4 2026': 41,
};
const PERIOD3_META = [
  { id: 'Periode 1', label: 'Jan 2025 - Mar 2026', effectiveDays: 455 },
  { id: 'Periode 2', label: 'Apr 2026 - Sep 2026', effectiveDays: 183 },
  { id: 'Periode 3', label: 'Okt 2026 - 10 Nov 2026', effectiveDays: 41 },
];

function buildFilterWhere(query, table = 'logs') {
  const clauses = [];
  const params = [];

  if (query.tipe && query.tipe !== 'ALL') {
    clauses.push(`tipe_rekanan = ?`);
    params.push(query.tipe);
  }
  if (query.divisi && query.divisi !== 'ALL') {
    clauses.push(`divisi = ?`);
    params.push(query.divisi);
  }
  if (query.periode && query.periode !== 'ALL') {
    if (table === 'logs') {
      clauses.push(`periode_3 = ?`);
      params.push(query.periode);
    } else {
      // Filter vendors whose activity falls in that period
      if (query.periode === 'Periode 1') {
        clauses.push(`start_serial < 46113`);
      } else if (query.periode === 'Periode 2') {
        clauses.push(`end_serial >= 46113 AND start_serial < 46296`);
      } else if (query.periode === 'Periode 3') {
        clauses.push(`end_serial >= 46296`);
      }
    }
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    and: clauses.length ? `AND ${clauses.join(' AND ')}` : '',
    params,
  };
}

// 1. Metadata & Filter Options
app.get('/api/meta', (req, res) => {
  const db = getDb();
  const meta = getMeta(db);
  const divisiList = db
    .prepare(`SELECT divisi, COUNT(*) as count FROM vendors GROUP BY divisi ORDER BY count DESC`)
    .all();
  const dbSizeBytes = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  res.json({
    meta,
    dbSizeBytes,
    divisiList,
    bidangList: BIDANG_ORDER,
  });
});

// 2. Executive Overview
app.get('/api/overview', (req, res) => {
  const db = getDb();
  const vf = buildFilterWhere(req.query, 'vendors');
  const lf = buildFilterWhere(req.query, 'logs');

  const vendorSummary = db
    .prepare(`
      SELECT
        COUNT(*) AS totalVendors,
        SUM(CASE WHEN tipe_rekanan = 'Badan Usaha' THEN 1 ELSE 0 END) AS totalBadanUsaha,
        SUM(CASE WHEN tipe_rekanan = 'Mandor' THEN 1 ELSE 0 END) AS totalMandor,
        SUM(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN 1 ELSE 0 END) AS totalLulus,
        SUM(CASE WHEN tindak_lanjut = 'Antrean di Verifikator' THEN 1 ELSE 0 END) AS totalAntreanVerif,
        SUM(CASE WHEN tindak_lanjut = 'Revisi di Rekanan' THEN 1 ELSE 0 END) AS totalRevisiRekanan,
        AVG(dur_days) AS avgCycleAllDays,
        AVG(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN dur_days END) AS avgCycleApprovedDays,
        MIN(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN dur_days END) AS minCycleApprovedDays,
        MAX(dur_days) AS maxCycleDays,
        AVG(reject_count) AS avgRejectPerVendor,
        AVG(revision_count) AS avgRevisionPerVendor,
        SUM(CASE WHEN tindak_lanjut != 'Lulus Terseleksi' AND aging_days > 30 THEN 1 ELSE 0 END) AS stagnantOver30
      FROM vendors
      ${vf.where}
    `)
    .get(...vf.params);

  const logSummary = db
    .prepare(`
      SELECT
        COUNT(*) AS totalLogs,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS avgSlaVerif,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS avgSlaRekanan,
        AVG(CASE WHEN kategori_aktor = 'Internal Approval Bidang' THEN sla_days END) AS avgSlaInternalAppr,
        AVG(CASE WHEN kategori_aktor = 'SLA Final Approval' THEN sla_days END) AS avgSlaFinalAppr,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN 1 ELSE 0 END) AS countSlaVerif,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND sla_days <= 3 THEN 1 ELSE 0 END) AS countVerifUnder3d,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 1 THEN 1 ELSE 0 END) AS countVerifApprove,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 2 THEN 1 ELSE 0 END) AS countVerifReject,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' AND kelompok_waktu = 'Sebelum Oktober 2026' THEN sla_days END) AS avgVerifBeforeOct,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' AND kelompok_waktu = 'Oktober 2026 - Sekarang' THEN sla_days END) AS avgVerifAfterOct,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' AND kelompok_waktu = 'Sebelum Oktober 2026' THEN sla_days END) AS avgRekBeforeOct,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' AND kelompok_waktu = 'Oktober 2026 - Sekarang' THEN sla_days END) AS avgRekAfterOct
      FROM logs
      ${lf.where}
    `)
    .get(...lf.params);

  // Bidang Bottleneck comparison
  const bidangRows = db
    .prepare(`
      SELECT
        bidang,
        COUNT(*) AS totalLogs,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN 1 ELSE 0 END) AS countVerif,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 1 THEN 1 ELSE 0 END) AS countApprove,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 2 THEN 1 ELSE 0 END) AS countReject,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS avgSlaVerif,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 1 THEN sla_days END) AS avgSlaApprove,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 2 THEN sla_days END) AS avgSlaReject,
        SUM(CASE WHEN kategori_aktor = 'SLA Rekanan' THEN 1 ELSE 0 END) AS countRekanan,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS avgSlaRekanan,
        AVG(CASE WHEN kategori_aktor IN ('Internal Approval Bidang', 'SLA Final Approval') THEN sla_days END) AS avgSlaApprovalInternal
      FROM logs
      ${lf.where}
      GROUP BY bidang
    `)
    .all(...lf.params);

  const bidangOrdered = BIDANG_ORDER.map((b) => bidangRows.find((r) => r.bidang === b)).filter(Boolean);

  // Monthly Trend (23 Months)
  const monthlyTrend = db
    .prepare(`
      SELECT
        periode_bulan AS bulan,
        kelompok_waktu AS kelompokWaktu,
        COUNT(*) AS totalLogs,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS slaVerifikator,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS slaRekanan,
        AVG(sla_days) AS slaTotal,
        AVG(CASE WHEN bidang = 'Teknik' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS teknik,
        AVG(CASE WHEN bidang = 'Keuangan' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS keuangan,
        AVG(CASE WHEN bidang = 'Legal' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS legal,
        AVG(CASE WHEN bidang = 'BIM' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS bim,
        AVG(CASE WHEN bidang = 'CQSMS/QHSSE' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS cqsms,
        AVG(CASE WHEN bidang = 'Final Approval' THEN sla_days END) AS finalApproval
      FROM logs
      ${lf.where}
      GROUP BY periode_bulan
      ORDER BY periode_bulan ASC
    `)
    .all(...lf.params);

  // Quarterly Trend + Approved Output per Quarter
  const quarterlySla = db
    .prepare(`
      SELECT
        triwulan,
        MIN(periode_bulan) AS sortKey,
        COUNT(*) AS totalLogs,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS slaVerifikator,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS slaRekanan
      FROM logs
      ${lf.where}
      GROUP BY triwulan
      ORDER BY sortKey ASC
    `)
    .all(...lf.params);

  const quarterlyApproved = db
    .prepare(`
      SELECT approved_quarter AS triwulan, COUNT(*) AS approvedCount
      FROM vendors
      WHERE tindak_lanjut = 'Lulus Terseleksi' AND approved_quarter != '' ${vf.and}
      GROUP BY approved_quarter
    `)
    .all(...vf.params);
  const qaMap = new Map(quarterlyApproved.map((r) => [r.triwulan, r.approvedCount]));

  const quarterly = quarterlySla.map((q) => {
    const approvedCount = qaMap.get(q.triwulan) || 0;
    const effectiveDays = QUARTER_DAYS[q.triwulan] || 90;
    return {
      ...q,
      approvedCount,
      effectiveDays,
      approvedPerDay: approvedCount / effectiveDays,
    };
  });

  // Queue Breakdown
  const queueDistribution = [
    { name: 'Lulus Terseleksi', value: vendorSummary.totalLulus || 0, color: '#0D9488' },
    { name: 'Antrean di Verifikator', value: vendorSummary.totalAntreanVerif || 0, color: '#2563EB' },
    { name: 'Revisi di Rekanan', value: vendorSummary.totalRevisiRekanan || 0, color: '#D97706' },
  ];

  res.json({
    vendorSummary,
    logSummary,
    bidangSummary: bidangOrdered,
    monthlyTrend,
    quarterly,
    queueDistribution,
  });
});

// 3. Top 10 Fastest & Slowest Leaderboard (Badan Usaha & Mandor)
app.get('/api/leaderboard', (req, res) => {
  const db = getDb();
  const limit = Math.min(25, Math.max(5, Number(req.query.limit) || 10));
  const includeInProgressSlow = req.query.includeInProgress === 'true';
  const divisiFilter = req.query.divisi && req.query.divisi !== 'ALL' ? req.query.divisi : null;
  const divClause = divisiFilter ? 'AND divisi = ?' : '';
  const divParam = divisiFilter ? [divisiFilter] : [];

  // Badan Usaha Top N Tercepat (Lulus Approved, clean full start, >= 7 logs matching Excel rule)
  const buFastest = db
    .prepare(`
      SELECT * FROM vendors
      WHERE tipe_rekanan = 'Badan Usaha'
        AND total_logs >= 7
        AND first_act = 'Konfirmasi Selesai'
        AND clean_pass_dur_days IS NOT NULL
        ${divClause}
      ORDER BY clean_pass_dur_days ASC, total_logs ASC
      LIMIT ?
    `)
    .all(...divParam, limit);

  // Badan Usaha Top N Terlama
  const buSlowestWhere = includeInProgressSlow
    ? `tipe_rekanan = 'Badan Usaha' AND total_logs >= 7 AND first_act = 'Konfirmasi Selesai'`
    : `tipe_rekanan = 'Badan Usaha' AND total_logs >= 7 AND first_act = 'Konfirmasi Selesai' AND tindak_lanjut = 'Lulus Terseleksi'`;

  const buSlowest = db
    .prepare(`
      SELECT * FROM vendors
      WHERE ${buSlowestWhere} ${divClause}
      ORDER BY dur_days DESC
      LIMIT ?
    `)
    .all(...divParam, limit);

  // Mandor Top N Tercepat (Lulus Approved, >= 3 logs, Konfirmasi Selesai Mandor)
  const mandorFastest = db
    .prepare(`
      SELECT * FROM vendors
      WHERE tipe_rekanan = 'Mandor'
        AND total_logs >= 3
        AND first_act = 'Konfirmasi Selesai Mandor'
        AND clean_pass_dur_days IS NOT NULL
        ${divClause}
      ORDER BY clean_pass_dur_days ASC, total_logs ASC
      LIMIT ?
    `)
    .all(...divParam, limit);

  // Mandor Top N Terlama (Excel uses first_act = 'Konfirmasi Selesai Mandor'; allow toggle approved-only vs all)
  const mandorSlowestWhere = includeInProgressSlow
    ? `tipe_rekanan = 'Mandor' AND first_act = 'Konfirmasi Selesai Mandor'`
    : `tipe_rekanan = 'Mandor' AND first_act = 'Konfirmasi Selesai Mandor' AND tindak_lanjut = 'Lulus Terseleksi'`;

  let mandorSlowest = db
    .prepare(`
      SELECT * FROM vendors
      WHERE ${mandorSlowestWhere} ${divClause}
      ORDER BY dur_days DESC
      LIMIT ?
    `)
    .all(...divParam, limit);

  // Note: If approved-only mandors are fewer than limit, still return them accurately and also provide all-status stats
  const mandorStats = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN 1 ELSE 0 END) AS lulus,
        AVG(CASE WHEN clean_pass_dur_days IS NOT NULL THEN clean_pass_dur_days END) AS avgPassDays,
        AVG(dur_days) AS avgAllDays
      FROM vendors WHERE tipe_rekanan = 'Mandor' ${divClause}
    `)
    .get(...divParam);

  const buStats = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN 1 ELSE 0 END) AS lulus,
        AVG(CASE WHEN clean_pass_dur_days IS NOT NULL THEN clean_pass_dur_days END) AS avgPassDays,
        AVG(dur_days) AS avgAllDays
      FROM vendors WHERE tipe_rekanan = 'Badan Usaha' ${divClause}
    `)
    .get(...divParam);

  res.json({
    limit,
    includeInProgressSlow,
    buStats,
    mandorStats,
    buFastest,
    buSlowest,
    mandorFastest,
    mandorSlowest,
  });
});

// 4. Vendor Tracker List (Server-side search, filter, sort, pagination)
app.get('/api/vendors', (req, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 25));
  const search = String(req.query.search || '').trim();
  const tipe = String(req.query.tipe || 'ALL');
  const divisi = String(req.query.divisi || 'ALL');
  const tindakLanjut = String(req.query.tindakLanjut || 'ALL');
  const revisionBand = String(req.query.revisionBand || 'ALL');

  const sortColMap = {
    nama_perusahaan: 'nama_perusahaan',
    id_vendor: 'id_vendor',
    tipe_rekanan: 'tipe_rekanan',
    divisi: 'divisi',
    total_logs: 'total_logs',
    dur_days: 'dur_days',
    reject_count: 'reject_count',
    revision_count: 'revision_count',
    verif_sla_days: 'verif_sla_days',
    rekanan_sla_days: 'rekanan_sla_days',
    aging_days: 'aging_days',
    start_serial: 'start_serial',
    end_serial: 'end_serial',
  };
  const sortBy = sortColMap[req.query.sortBy] || 'end_serial';
  const sortDir = String(req.query.sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const clauses = [];
  const params = [];

  if (search) {
    clauses.push(`(LOWER(nama_perusahaan) LIKE ? OR CAST(id_vendor AS TEXT) LIKE ? OR LOWER(last_act) LIKE ?)`);
    const q = `%${search.toLowerCase()}%`;
    params.push(q, q, q);
  }
  if (tipe !== 'ALL') {
    clauses.push(`tipe_rekanan = ?`);
    params.push(tipe);
  }
  if (divisi !== 'ALL') {
    clauses.push(`divisi = ?`);
    params.push(divisi);
  }
  if (tindakLanjut !== 'ALL') {
    clauses.push(`tindak_lanjut = ?`);
    params.push(tindakLanjut);
  }
  if (revisionBand === '0') clauses.push(`revision_count = 0`);
  else if (revisionBand === '1-3') clauses.push(`revision_count BETWEEN 1 AND 3`);
  else if (revisionBand === '4-10') clauses.push(`revision_count BETWEEN 4 AND 10`);
  else if (revisionBand === '10+') clauses.push(`revision_count > 10`);

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM vendors ${whereSql}`).get(...params);
  const total = totalRow?.total || 0;
  const offset = (page - 1) * pageSize;

  const items = db
    .prepare(`
      SELECT * FROM vendors
      ${whereSql}
      ORDER BY ${sortBy} ${sortDir}, id_vendor ASC
      LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset);

  res.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

// 5. Vendor Detail & Full Log Timeline (with Paired Per-Bidang SLA + Chronological Gaps + Per-Bidang Breakdown)
app.get('/api/vendors/:idVendor', (req, res) => {
  const db = getDb();
  const idVendor = Number(req.params.idVendor);
  if (!idVendor) return res.status(400).json({ error: 'ID Vendor tidak valid.' });

  const vendor = db.prepare(`SELECT * FROM vendors WHERE id_vendor = ?`).get(idVendor);
  if (!vendor) return res.status(404).json({ error: 'Rekanan tidak ditemukan.' });

  const logs = db
    .prepare(`
      SELECT * FROM logs
      WHERE id_vendor = ?
      ORDER BY serial_date ASC, seq_no ASC
    `)
    .all(idVendor);

  // Per-bidang breakdown for this vendor
  const bidangMap = new Map();
  for (const l of logs) {
    if (!bidangMap.has(l.bidang)) {
      bidangMap.set(l.bidang, {
        bidang: l.bidang,
        totalLogs: 0,
        rejects: 0,
        revisions: 0,
        approves: 0,
        verifSlaDays: 0,
        rekananSlaDays: 0,
        internalSlaDays: 0,
        lastAct: l.tipe_activity,
        lastStatus: l.hasil_status,
        lastWaktu: l.waktu_display,
      });
    }
    const b = bidangMap.get(l.bidang);
    b.totalLogs++;
    if (l.status === 2) b.rejects++;
    if (l.status === 1) b.approves++;
    if (l.tipe_activity.startsWith('Konfirmasi Revisi Selesai')) b.revisions++;
    if (l.sla_days !== null) {
      if (l.kategori_aktor === 'SLA Verifikator') b.verifSlaDays += l.sla_days;
      else if (l.kategori_aktor === 'SLA Rekanan' || l.kategori_aktor === 'Aktivitas Rekanan') b.rekananSlaDays += l.sla_days;
      else b.internalSlaDays += l.sla_days;
    }
    b.lastAct = l.tipe_activity;
    b.lastStatus = l.hasil_status;
    b.lastWaktu = l.waktu_display;
  }

  const bidangBreakdown = BIDANG_ORDER.map((name) => bidangMap.get(name)).filter(Boolean);

  // Largest single chronological gap & paired gap
  let maxChronoGap = null;
  let maxPairedGap = null;
  for (const l of logs) {
    if (l.chrono_gap_days !== null && (!maxChronoGap || l.chrono_gap_days > maxChronoGap.chrono_gap_days)) {
      maxChronoGap = l;
    }
    if (l.sla_days !== null && (!maxPairedGap || l.sla_days > maxPairedGap.sla_days)) {
      maxPairedGap = l;
    }
  }

  res.json({
    vendor,
    logs,
    bidangBreakdown,
    highlights: {
      maxChronoGap: maxChronoGap
        ? {
            days: maxChronoGap.chrono_gap_days,
            hours: maxChronoGap.chrono_gap_hours,
            fromAct: maxChronoGap.chrono_prev_act,
            toAct: maxChronoGap.tipe_activity,
            waktu: maxChronoGap.waktu_display,
          }
        : null,
      maxPairedGap: maxPairedGap
        ? {
            days: maxPairedGap.sla_days,
            hours: maxPairedGap.sla_hours,
            fromAct: maxPairedGap.paired_prev_act,
            toAct: maxPairedGap.tipe_activity,
            kategori: maxPairedGap.kategori_aktor,
            bidang: maxPairedGap.bidang,
            waktu: maxPairedGap.waktu_display,
          }
        : null,
    },
  });
});

// 6. Deep Analytics (Mirrors Excel Sheets 2, 4, 5 & Nilai Statis: 2-Periode, 3-Periode, Per-Bidang Monthly & Quarterly, Tipe Activity, Status Matrix)
app.get('/api/analytics', (req, res) => {
  const db = getDb();
  const lf = buildFilterWhere(req.query, 'logs');
  const vf = buildFilterWhere(req.query, 'vendors');

  // Part 1: Before vs After October 2026 per Bidang
  const period2Raw = db
    .prepare(`
      SELECT
        bidang,
        SUM(CASE WHEN kelompok_waktu = 'Sebelum Oktober 2026' THEN 1 ELSE 0 END) AS logsBefore,
        AVG(CASE WHEN kelompok_waktu = 'Sebelum Oktober 2026' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS verifBefore,
        AVG(CASE WHEN kelompok_waktu = 'Sebelum Oktober 2026' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS rekBefore,
        AVG(CASE WHEN kelompok_waktu = 'Sebelum Oktober 2026' THEN sla_days END) AS totalBefore,
        SUM(CASE WHEN kelompok_waktu = 'Oktober 2026 - Sekarang' THEN 1 ELSE 0 END) AS logsAfter,
        AVG(CASE WHEN kelompok_waktu = 'Oktober 2026 - Sekarang' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS verifAfter,
        AVG(CASE WHEN kelompok_waktu = 'Oktober 2026 - Sekarang' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS rekAfter,
        AVG(CASE WHEN kelompok_waktu = 'Oktober 2026 - Sekarang' THEN sla_days END) AS totalAfter,
        AVG(CASE WHEN kelompok_waktu = 'Sebelum Oktober 2026' AND kategori_aktor = 'SLA Final Approval' THEN sla_days END) AS finalBefore,
        AVG(CASE WHEN kelompok_waktu = 'Oktober 2026 - Sekarang' AND kategori_aktor = 'SLA Final Approval' THEN sla_days END) AS finalAfter
      FROM logs
      ${lf.where}
      GROUP BY bidang
    `)
    .all(...lf.params);

  const period2Comparison = BIDANG_ORDER.map((b) => {
    const r = period2Raw.find((x) => x.bidang === b);
    if (!r) return null;
    const vB = b === 'Final Approval' ? r.finalBefore : r.verifBefore;
    const vA = b === 'Final Approval' ? r.finalAfter : r.verifAfter;
    const delta = vB != null && vA != null ? vA - vB : null;
    return {
      bidang: b,
      logsBefore: r.logsBefore,
      verifBefore: vB,
      rekBefore: r.rekBefore,
      totalBefore: r.totalBefore,
      logsAfter: r.logsAfter,
      verifAfter: vA,
      rekAfter: r.rekAfter,
      totalAfter: r.totalAfter,
      deltaVerif: delta,
      statusEval: delta === null ? 'Tidak Ada Data Baru' : delta < -0.05 ? 'Membaik' : delta > 0.05 ? 'Meningkat' : 'Stabil',
    };
  }).filter(Boolean);

  // Part 2: 3-Periode Waktu Comparison (Jan 25–Mar 26, Apr–Sep 26, Okt–Nov 26)
  const period3Logs = db
    .prepare(`
      SELECT
        periode_3 AS periode,
        COUNT(*) AS totalLogs,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS slaVerif,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS slaRekanan,
        AVG(CASE WHEN bidang = 'Teknik' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS teknikVerif,
        AVG(CASE WHEN bidang = 'Teknik' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS teknikRek,
        AVG(CASE WHEN bidang = 'Keuangan' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS keuanganVerif,
        AVG(CASE WHEN bidang = 'Keuangan' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS keuanganRek,
        AVG(CASE WHEN bidang = 'Legal' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS legalVerif,
        AVG(CASE WHEN bidang = 'Legal' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS legalRek,
        AVG(CASE WHEN bidang = 'BIM' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS bimVerif,
        AVG(CASE WHEN bidang = 'BIM' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS bimRek,
        AVG(CASE WHEN bidang = 'CQSMS/QHSSE' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS cqsmsVerif,
        AVG(CASE WHEN bidang = 'CQSMS/QHSSE' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS cqsmsRek,
        AVG(CASE WHEN bidang = 'Final Approval' THEN sla_days END) AS finalAppr
      FROM logs
      ${lf.where}
      GROUP BY periode_3
    `)
    .all(...lf.params);

  const period3Appr = db
    .prepare(`
      SELECT approved_period3 AS periode, COUNT(*) AS approvedCount
      FROM vendors
      WHERE tindak_lanjut = 'Lulus Terseleksi' AND approved_period3 != '' ${vf.and}
      GROUP BY approved_period3
    `)
    .all(...vf.params);
  const p3ApprMap = new Map(period3Appr.map((r) => [r.periode, r.approvedCount]));

  const period3Summary = PERIOD3_META.map((pm) => {
    const row = period3Logs.find((x) => x.periode === pm.id) || {};
    const approvedCount = p3ApprMap.get(pm.id) || 0;
    return {
      ...pm,
      ...row,
      approvedCount,
      approvedPerDay: approvedCount / pm.effectiveDays,
    };
  });

  // Part 3: Per-Bidang Monthly & Quarterly Trend (for interactive chart studio replacing 14 static Excel charts!)
  const bidangMonthly = db
    .prepare(`
      SELECT
        periode_bulan AS label,
        AVG(CASE WHEN bidang = 'Teknik' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS teknikVerif,
        AVG(CASE WHEN bidang = 'Teknik' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS teknikRek,
        AVG(CASE WHEN bidang = 'Keuangan' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS keuanganVerif,
        AVG(CASE WHEN bidang = 'Keuangan' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS keuanganRek,
        AVG(CASE WHEN bidang = 'Legal' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS legalVerif,
        AVG(CASE WHEN bidang = 'Legal' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS legalRek,
        AVG(CASE WHEN bidang = 'BIM' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS bimVerif,
        AVG(CASE WHEN bidang = 'BIM' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS bimRek,
        AVG(CASE WHEN bidang = 'CQSMS/QHSSE' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS cqsmsVerif,
        AVG(CASE WHEN bidang = 'CQSMS/QHSSE' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS cqsmsRek,
        AVG(CASE WHEN bidang = 'Final Approval' THEN sla_days END) AS finalVerif
      FROM logs
      ${lf.where}
      GROUP BY periode_bulan
      ORDER BY periode_bulan ASC
    `)
    .all(...lf.params);

  const bidangQuarterly = db
    .prepare(`
      SELECT
        triwulan AS label,
        MIN(periode_bulan) AS sortKey,
        AVG(CASE WHEN bidang = 'Teknik' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS teknikVerif,
        AVG(CASE WHEN bidang = 'Teknik' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS teknikRek,
        AVG(CASE WHEN bidang = 'Keuangan' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS keuanganVerif,
        AVG(CASE WHEN bidang = 'Keuangan' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS keuanganRek,
        AVG(CASE WHEN bidang = 'Legal' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS legalVerif,
        AVG(CASE WHEN bidang = 'Legal' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS legalRek,
        AVG(CASE WHEN bidang = 'BIM' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS bimVerif,
        AVG(CASE WHEN bidang = 'BIM' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS bimRek,
        AVG(CASE WHEN bidang = 'CQSMS/QHSSE' AND kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS cqsmsVerif,
        AVG(CASE WHEN bidang = 'CQSMS/QHSSE' AND kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS cqsmsRek,
        AVG(CASE WHEN bidang = 'Final Approval' THEN sla_days END) AS finalVerif
      FROM logs
      ${lf.where}
      GROUP BY triwulan
      ORDER BY sortKey ASC
    `)
    .all(...lf.params);

  // Part 4: Status Distribution by Kategori Aktor SLA (Excel Bagian 9)
  const statusMatrix = db
    .prepare(`
      SELECT
        kategori_aktor AS kategori,
        COUNT(*) AS totalLogs,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS countApprove,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS countReject,
        AVG(CASE WHEN status = 1 THEN sla_days END) AS avgSlaApprove,
        AVG(CASE WHEN status = 2 THEN sla_days END) AS avgSlaReject,
        AVG(sla_days) AS avgSlaAll
      FROM logs
      ${lf.where}
      GROUP BY kategori_aktor
      ORDER BY totalLogs DESC
    `)
    .all(...lf.params);

  // Part 5: Ringkasan Tipe Activity (Excel Sheet 4)
  const activitySummary = db
    .prepare(`
      SELECT
        tipe_activity AS tipeActivity,
        bidang,
        aktor_login AS aktor,
        COUNT(*) AS totalKejadian,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS countApprove,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS countReject,
        AVG(sla_hours) AS avgSlaHours,
        AVG(sla_days) AS avgSlaDays,
        AVG(CASE WHEN status = 1 THEN sla_days END) AS avgSlaApprove,
        AVG(CASE WHEN status = 2 THEN sla_days END) AS avgSlaReject
      FROM logs
      ${lf.where}
      GROUP BY tipe_activity
      ORDER BY totalKejadian DESC
    `)
    .all(...lf.params);

  const faRows = db
    .prepare(`
      SELECT
        id_vendor, nama_perusahaan, message_by, serial_date, waktu_display,
        periode_bulan, kelompok_waktu, paired_prev_act, paired_prev_waktu, sla_hours, sla_days
      FROM logs
      WHERE bidang = 'Final Approval' ${lf.and}
    `)
    .all(...lf.params);

  const finalApprovalDiagnostic = computeFinalApprovalDiagnostic(faRows);

  res.json({
    period2Comparison,
    period3Summary,
    bidangMonthly,
    bidangQuarterly,
    statusMatrix,
    activitySummary,
    finalApprovalDiagnostic,
  });
});

// 6b. FGD Defense & Q&A Evidence Pack (Answers tough questions from 3-Slide FGD PPT)
app.get('/api/fgd-defense', (req, res) => {
  const db = getDb();
  const vf = buildFilterWhere(req.query, 'vendors');
  const lf = buildFilterWhere(req.query, 'logs');
  const meta = getMeta(db);

  const vendors = db.prepare(`SELECT * FROM vendors ${vf.where}`).all(...vf.params);
  const logs = db
    .prepare(`
      SELECT
        id_vendor, nama_perusahaan, tipe_rekanan, divisi, status, hasil_status,
        message_by, serial_date, waktu_iso, waktu_display, periode_bulan, kelompok_waktu,
        tipe_activity, bidang, sla_hours, sla_days, kategori_aktor, paired_prev_act
      FROM logs
      ${lf.where}
    `)
    .all(...lf.params);

  res.json(computeFgdDefenseData(vendors, logs, meta));
});

// 7. Division, Revision Friction & Aging Queue Analysis (New Deep Insights!)
app.get('/api/divisions-revisions', (req, res) => {
  const db = getDb();
  const vf = buildFilterWhere(req.query, 'vendors');
  const lf = buildFilterWhere(req.query, 'logs');

  // Division performance breakdown
  const divisionStats = db
    .prepare(`
      SELECT
        divisi,
        COUNT(*) AS totalVendors,
        SUM(CASE WHEN tipe_rekanan = 'Badan Usaha' THEN 1 ELSE 0 END) AS badanUsaha,
        SUM(CASE WHEN tipe_rekanan = 'Mandor' THEN 1 ELSE 0 END) AS mandor,
        SUM(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN 1 ELSE 0 END) AS lulus,
        SUM(CASE WHEN tindak_lanjut = 'Antrean di Verifikator' THEN 1 ELSE 0 END) AS antreanVerif,
        SUM(CASE WHEN tindak_lanjut = 'Revisi di Rekanan' THEN 1 ELSE 0 END) AS revisiRekanan,
        AVG(dur_days) AS avgDurDays,
        AVG(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN dur_days END) AS avgDurApproved,
        AVG(reject_count) AS avgRejects,
        AVG(revision_count) AS avgRevisions,
        AVG(verif_sla_days) AS avgTotalVerifSla,
        AVG(rekanan_sla_days) AS avgTotalRekananSla
      FROM vendors
      ${vf.where}
      GROUP BY divisi
      ORDER BY CASE WHEN divisi = 'Tidak Tercantum' THEN 1 ELSE 0 END, totalVendors DESC
    `)
    .all(...vf.params);

  // Revision Buckets vs Average Cycle Duration
  const revisionBuckets = db
    .prepare(`
      SELECT
        CASE
          WHEN revision_count = 0 THEN '0 Revisi (Mulus)'
          WHEN revision_count BETWEEN 1 AND 2 THEN '1 - 2 Revisi'
          WHEN revision_count BETWEEN 3 AND 5 THEN '3 - 5 Revisi'
          WHEN revision_count BETWEEN 6 AND 10 THEN '6 - 10 Revisi'
          ELSE '> 10 Revisi'
        END AS bucket,
        CASE
          WHEN revision_count = 0 THEN 1
          WHEN revision_count BETWEEN 1 AND 2 THEN 2
          WHEN revision_count BETWEEN 3 AND 5 THEN 3
          WHEN revision_count BETWEEN 6 AND 10 THEN 4
          ELSE 5
        END AS sortOrder,
        COUNT(*) AS vendorCount,
        SUM(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN 1 ELSE 0 END) AS lulusCount,
        AVG(dur_days) AS avgDurDays,
        AVG(CASE WHEN tindak_lanjut = 'Lulus Terseleksi' THEN dur_days END) AS avgDurApproved,
        AVG(reject_count) AS avgRejects
      FROM vendors
      ${vf.where}
      GROUP BY bucket, sortOrder
      ORDER BY sortOrder ASC
    `)
    .all(...vf.params);

  // Reject & Revision Volume by Bidang
  const bidangFriction = db
    .prepare(`
      SELECT
        bidang,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS totalRejects,
        SUM(CASE WHEN tipe_activity LIKE 'Konfirmasi Revisi Selesai%' THEN 1 ELSE 0 END) AS totalRevisions,
        AVG(CASE WHEN kategori_aktor = 'SLA Rekanan' THEN sla_days END) AS avgRevisionResponseDays,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 2 THEN sla_days END) AS avgVerifRejectDays
      FROM logs
      WHERE bidang IN ('Teknik', 'Keuangan', 'Legal', 'BIM', 'CQSMS/QHSSE') ${lf.and}
      GROUP BY bidang
      ORDER BY totalRejects DESC
    `)
    .all(...lf.params);

  // Aging Queue Distribution (Active vendors NOT yet Lulus Terseleksi)
  const agingBuckets = db
    .prepare(`
      SELECT
        CASE
          WHEN aging_days <= 7 THEN '0 - 7 Hari'
          WHEN aging_days <= 30 THEN '8 - 30 Hari'
          WHEN aging_days <= 90 THEN '31 - 90 Hari'
          WHEN aging_days <= 180 THEN '91 - 180 Hari'
          ELSE '> 180 Hari'
        END AS bucket,
        CASE
          WHEN aging_days <= 7 THEN 1
          WHEN aging_days <= 30 THEN 2
          WHEN aging_days <= 90 THEN 3
          WHEN aging_days <= 180 THEN 4
          ELSE 5
        END AS sortOrder,
        SUM(CASE WHEN tindak_lanjut = 'Antrean di Verifikator' THEN 1 ELSE 0 END) AS antreanVerif,
        SUM(CASE WHEN tindak_lanjut = 'Revisi di Rekanan' THEN 1 ELSE 0 END) AS revisiRekanan,
        COUNT(*) AS total
      FROM vendors
      WHERE tindak_lanjut != 'Lulus Terseleksi' ${vf.and}
      GROUP BY bucket, sortOrder
      ORDER BY sortOrder ASC
    `)
    .all(...vf.params);

  // Top 15 Longest Waiting Active Queue (Antrean di Verifikator & Revisi di Rekanan)
  const stagnantVerif = db
    .prepare(`
      SELECT * FROM vendors
      WHERE tindak_lanjut = 'Antrean di Verifikator' ${vf.and}
      ORDER BY aging_days DESC
      LIMIT 15
    `)
    .all(...vf.params);

  const stagnantRekanan = db
    .prepare(`
      SELECT * FROM vendors
      WHERE tindak_lanjut = 'Revisi di Rekanan' ${vf.and}
      ORDER BY aging_days DESC
      LIMIT 15
    `)
    .all(...vf.params);

  res.json({
    divisionStats,
    revisionBuckets,
    bidangFriction,
    agingBuckets,
    stagnantVerif,
    stagnantRekanan,
  });
});

// 8. Verifiers Performance Leaderboard (Excel Sheet 3)
app.get('/api/verifiers', (req, res) => {
  const db = getDb();
  const minLogs = Number(req.query.minLogs) || 5;
  const bidang = String(req.query.bidang || 'ALL');
  const lf = buildFilterWhere(req.query, 'logs');

  const raw = db
    .prepare(`
      SELECT
        message_by AS verifierId,
        COUNT(*) AS totalInternalLogs,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN 1 ELSE 0 END) AS totalSlaVerif,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 1 THEN 1 ELSE 0 END) AS countApprove,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND status = 2 THEN 1 ELSE 0 END) AS countReject,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN sla_hours END) AS avgSlaHours,
        AVG(CASE WHEN kategori_aktor = 'SLA Verifikator' THEN sla_days END) AS avgSlaDays,
        SUM(CASE WHEN kategori_aktor = 'SLA Verifikator' AND sla_days <= 3 THEN 1 ELSE 0 END) AS within3Days
      FROM logs
      WHERE by_login = 0 AND message_by != '' ${lf.and}
      GROUP BY message_by
      HAVING totalInternalLogs >= ?
      ORDER BY totalSlaVerif DESC, totalInternalLogs DESC
    `)
    .all(...lf.params, minLogs);

  // Determine dominant bidang per verifier
  const bidangCounts = db
    .prepare(`
      SELECT message_by AS verifierId, bidang, COUNT(*) AS cnt
      FROM logs
      WHERE by_login = 0 AND message_by != '' ${lf.and}
      GROUP BY message_by, bidang
      ORDER BY cnt DESC
    `)
    .all(...lf.params);

  const mainBidangMap = new Map();
  for (const r of bidangCounts) {
    if (!mainBidangMap.has(r.verifierId)) mainBidangMap.set(r.verifierId, r.bidang);
  }

  let items = raw.map((r) => ({
    ...r,
    bidangUtama: mainBidangMap.get(r.verifierId) || 'Umum',
    slaComplianceRate: r.totalSlaVerif > 0 ? r.within3Days / r.totalSlaVerif : null,
    approveRate: r.totalSlaVerif > 0 ? r.countApprove / r.totalSlaVerif : null,
  }));

  if (bidang !== 'ALL') {
    items = items.filter((x) => x.bidangUtama === bidang);
  }

  res.json({ items });
});

// 9. Verifier recent logs drilldown
app.get('/api/verifiers/:verifierId/logs', (req, res) => {
  const db = getDb();
  const verifierId = String(req.params.verifierId);
  const logs = db
    .prepare(`
      SELECT * FROM logs
      WHERE by_login = 0 AND message_by = ?
      ORDER BY serial_date DESC
      LIMIT 100
    `)
    .all(verifierId);
  res.json({ verifierId, logs });
});

// 10. Upload / Import New Excel File into Local SQLite DB
app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File Excel (.xlsx) tidak ditemukan dalam unggahan.' });
  const exclude2024 = req.body.exclude2024 !== 'false';
  const excludeDummies = req.body.excludeDummies !== 'false';

  try {
    const parsed = parseRegistrationWorkbook(req.file.path, { exclude2024, excludeDummies });
    const db = getDb();
    replaceDatabaseContents(db, parsed, req.file.originalname);
    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      message: `Berhasil mengimpor ${parsed.meta.cleanVendors.toLocaleString('id-ID')} rekanan dan ${parsed.meta.cleanLogs.toLocaleString('id-ID')} log bersih.`,
      meta: parsed.meta,
    });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: `Gagal memproses file Excel: ${err.message}` });
  }
});

// 11. Export Filtered Vendors OR Single Vendor Logs to Excel (.xlsx)
app.get('/api/export/vendors', (req, res) => {
  const db = getDb();
  const vf = buildFilterWhere(req.query, 'vendors');
  const rows = db
    .prepare(`
      SELECT
        id_vendor AS "ID Vendor",
        nama_perusahaan AS "Nama Rekanan",
        tipe_rekanan AS "Tipe Rekanan",
        divisi AS "Divisi",
        start_iso AS "Mulai Registrasi",
        end_iso AS "Aktivitas Terakhir",
        total_logs AS "Total Log",
        ROUND(dur_days, 2) AS "Durasi Siklus (Hari)",
        ROUND(dur_hours, 2) AS "Durasi Siklus (Jam)",
        reject_count AS "Jumlah Reject",
        revision_count AS "Jumlah Revisi",
        ROUND(verif_sla_days, 2) AS "Akumulasi SLA Verifikator (Hari)",
        ROUND(rekanan_sla_days, 2) AS "Akumulasi SLA Rekanan (Hari)",
        last_act AS "Aktivitas Terakhir",
        tindak_lanjut AS "Status Tindak Lanjut",
        ROUND(aging_days, 2) AS "Aging Antrean (Hari)"
      FROM vendors
      ${vf.where}
      ORDER BY end_serial DESC
    `)
    .all(...vf.params);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Siklus Rekanan');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Export_Pelacak_SLA_Rekanan.xlsx"');
  res.send(buf);
});

app.get('/api/export/vendors/:idVendor', (req, res) => {
  const db = getDb();
  const idVendor = Number(req.params.idVendor);
  const vendor = db.prepare(`SELECT * FROM vendors WHERE id_vendor = ?`).get(idVendor);
  if (!vendor) return res.status(404).json({ error: 'Rekanan tidak ditemukan.' });

  const logs = db
    .prepare(`
      SELECT
        waktu_display AS "Waktu",
        bidang AS "Bidang",
        tipe_activity AS "Aktivitas",
        hasil_status AS "Status",
        aktor_login AS "Aktor",
        message_by AS "User / ID",
        kategori_aktor AS "Kategori SLA (Per-Bidang)",
        paired_prev_act AS "Acuan Sebelumnya (Per-Bidang)",
        ROUND(sla_hours, 2) AS "SLA Per-Bidang (Jam)",
        ROUND(sla_days, 2) AS "SLA Per-Bidang (Hari)",
        chrono_prev_act AS "Log Kronologis Sebelumnya",
        ROUND(chrono_gap_hours, 2) AS "Jarak Kronologis (Jam)",
        ROUND(chrono_gap_days, 2) AS "Jarak Kronologis (Hari)",
        ROUND(cumulative_days, 2) AS "Kumulatif Sejak Awal (Hari)",
        message AS "Pesan Log"
      FROM logs
      WHERE id_vendor = ?
      ORDER BY serial_date ASC, seq_no ASC
    `)
    .all(idVendor);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(logs);
  XLSX.utils.book_append_sheet(wb, ws, 'Log Rekanan');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const safeName = vendor.nama_perusahaan.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Log_${idVendor}_${safeName}.xlsx"`);
  res.send(buf);
});

// Serve built frontend in production mode
const distDir = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  const db = getDb();
  const meta = getMeta(db);
  console.log(`API SLA Verifikasi Rekanan berjalan di http://localhost:${PORT}`);
  console.log(`SQLite DB: ${DB_PATH} (${meta.cleanVendors || 0} rekanan, ${meta.cleanLogs || 0} log)`);
});
