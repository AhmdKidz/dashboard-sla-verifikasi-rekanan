import * as XLSX from 'xlsx';
import {
  computeFgdDefenseData,
  computeFinalApprovalDiagnostic,
  parseRegistrationWorkbookObject,
} from '../../shared/slaParser.mjs';
import type { GlobalFilters, LogRow, VendorRow } from '@/lib/api';

const IDB_NAME = 'sla-verifikasi-local-db';
const IDB_VERSION = 1;
const STORE_NAME = 'datasets';
const DATASET_KEY = 'current';

const BIDANG_ORDER = ['Teknik', 'Keuangan', 'Legal', 'BIM', 'CQSMS/QHSSE', 'Final Approval', 'Mandor', 'Umum'];
const QUARTER_DAYS: Record<string, number> = {
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

interface StoredDataset {
  meta: Record<string, string>;
  vendors: VendorRow[];
  logs: LogRow[];
  approxBytes: number;
}

let memoryDataset: StoredDataset | null = null;
let loadPromise: Promise<StoredDataset | null> | null = null;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka IndexedDB browser.'));
  });
}

async function readFromIdb(): Promise<StoredDataset | null> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(DATASET_KEY);
    req.onsuccess = () => resolve((req.result as StoredDataset) || null);
    req.onerror = () => reject(req.error || new Error('Gagal membaca data dari IndexedDB.'));
  });
}

async function writeToIdb(payload: StoredDataset): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(payload, DATASET_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Gagal menyimpan data ke IndexedDB.'));
  });
}

export async function clearBrowserDataset(): Promise<void> {
  memoryDataset = null;
  loadPromise = null;
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(DATASET_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function ensureDataset(): Promise<StoredDataset> {
  if (memoryDataset) return memoryDataset;
  if (!loadPromise) {
    loadPromise = readFromIdb().then((d) => {
      memoryDataset = d;
      return d;
    });
  }
  const res = await loadPromise;
  return (
    res || {
      meta: {},
      vendors: [],
      logs: [],
      approxBytes: 0,
    }
  );
}

function toSnakeVendor(v: any): VendorRow {
  return {
    id_vendor: v.idVendor,
    nama_perusahaan: v.namaPerusahaan,
    tipe_rekanan: v.tipeRekanan,
    divisi: v.divisi,
    total_logs: v.totalLogs,
    start_serial: v.startSerial,
    end_serial: v.endSerial,
    start_iso: v.startIso,
    end_iso: v.endIso,
    start_month: v.startMonth,
    end_month: v.endMonth,
    dur_days: v.durDays,
    dur_hours: v.durHours,
    first_act: v.firstAct,
    last_act: v.lastAct,
    last_status: v.lastStatus,
    last_by_login: v.lastByLogin,
    status_kelulusan: v.statusKelulusan,
    tindak_lanjut: v.tindakLanjut,
    clean_pass_dur_days: v.cleanPassDurDays,
    has_valid_start: v.hasValidStart,
    reject_count: v.rejectCount,
    revision_count: v.revisionCount,
    verif_sla_days: v.verifSlaDays,
    rekanan_sla_days: v.rekananSlaDays,
    internal_sla_days: v.internalSlaDays,
    aging_days: v.agingDays,
    approved_quarter: v.approvedQuarter,
    approved_period3: v.approvedPeriod3,
  };
}

function toSnakeLog(l: any): LogRow {
  return {
    seq_no: l.seqNo,
    log_id: l.logId,
    id_vendor: l.idVendor,
    nama_perusahaan: l.namaPerusahaan,
    tipe_rekanan: l.tipeRekanan,
    divisi: l.divisi,
    message: l.message,
    status: l.status,
    hasil_status: l.hasilStatus,
    message_by: l.messageBy,
    serial_date: l.serialDate,
    waktu_iso: l.waktuIso,
    waktu_display: l.waktuDisplay,
    periode_bulan: l.periodeBulan,
    triwulan: l.triwulan,
    kelompok_waktu: l.kelompokWaktu,
    periode_3: l.periode3,
    tipe_sub_modul: l.tipeSubModul,
    tipe_activity: l.tipeActivity,
    bidang: l.bidang,
    dari_modul: l.dariModul,
    by_login: l.byLogin,
    aktor_login: l.aktorLogin,
    paired_prev_act: l.pairedPrevAct,
    paired_prev_waktu: l.pairedPrevWaktu,
    sla_hours: l.slaHours,
    sla_days: l.slaDays,
    kategori_aktor: l.kategoriAktor,
    chrono_prev_act: l.chronoPrevAct,
    chrono_gap_hours: l.chronoGapHours,
    chrono_gap_days: l.chronoGapDays,
    cumulative_days: l.cumulativeDays,
  };
}

export async function importExcelInBrowser(
  file: File,
  options: { exclude2024: boolean; excludeDummies: boolean }
) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: false });
  const parsed = parseRegistrationWorkbookObject(wb, options);

  const metaObj: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.meta)) metaObj[k] = String(v ?? '');
  metaObj.sourceFile = file.name;
  metaObj.importedAt = new Date().toISOString();

  const vendors = parsed.vendors.map(toSnakeVendor);
  const logs = parsed.logs.map(toSnakeLog);
  const approxBytes = new Blob([JSON.stringify({ meta: metaObj, vendors, logs })]).size;

  const dataset: StoredDataset = { meta: metaObj, vendors, logs, approxBytes };
  await writeToIdb(dataset);
  memoryDataset = dataset;
  loadPromise = Promise.resolve(dataset);

  return {
    success: true,
    message: `Berhasil mengimpor ${parsed.meta.cleanVendors.toLocaleString('id-ID')} rekanan dan ${parsed.meta.cleanLogs.toLocaleString('id-ID')} log bersih ke IndexedDB browser.`,
    meta: parsed.meta,
  };
}

function filterVendors(vendors: VendorRow[], filters: Partial<GlobalFilters>) {
  return vendors.filter((v) => {
    if (filters.tipe && filters.tipe !== 'ALL' && v.tipe_rekanan !== filters.tipe) return false;
    if (filters.divisi && filters.divisi !== 'ALL' && v.divisi !== filters.divisi) return false;
    if (filters.periode && filters.periode !== 'ALL') {
      if (filters.periode === 'Periode 1' && !(v.start_serial < 46113)) return false;
      if (filters.periode === 'Periode 2' && !(v.end_serial >= 46113 && v.start_serial < 46296)) return false;
      if (filters.periode === 'Periode 3' && !(v.end_serial >= 46296)) return false;
    }
    return true;
  });
}

function filterLogs(logs: LogRow[], filters: Partial<GlobalFilters>) {
  return logs.filter((l) => {
    if (filters.tipe && filters.tipe !== 'ALL' && l.tipe_rekanan !== filters.tipe) return false;
    if (filters.divisi && filters.divisi !== 'ALL' && l.divisi !== filters.divisi) return false;
    if (filters.periode && filters.periode !== 'ALL' && l.periode_3 !== filters.periode) return false;
    return true;
  });
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  let sum = 0;
  for (let i = 0; i < nums.length; i++) sum += nums[i];
  return sum / nums.length;
}

export async function browserGetMeta() {
  const ds = await ensureDataset();
  const divMap = new Map<string, number>();
  for (const v of ds.vendors) {
    divMap.set(v.divisi, (divMap.get(v.divisi) || 0) + 1);
  }
  const divisiList = [...divMap.entries()]
    .map(([divisi, count]) => ({ divisi, count }))
    .sort((a, b) => b.count - a.count);

  return {
    meta: ds.meta,
    dbSizeBytes: ds.approxBytes || 0,
    divisiList,
    bidangList: BIDANG_ORDER,
  };
}

export async function browserGetOverview(filters: GlobalFilters) {
  const ds = await ensureDataset();
  const vList = filterVendors(ds.vendors, filters);
  const lList = filterLogs(ds.logs, filters);

  let totalBadanUsaha = 0;
  let totalMandor = 0;
  let totalLulus = 0;
  let totalAntreanVerif = 0;
  let totalRevisiRekanan = 0;
  let stagnantOver30 = 0;
  let sumAllDur = 0;
  let maxCycleDays = 0;
  let sumRej = 0;
  let sumRev = 0;
  const approvedDurs: number[] = [];

  for (const v of vList) {
    if (v.tipe_rekanan === 'Badan Usaha') totalBadanUsaha++;
    else totalMandor++;
    if (v.tindak_lanjut === 'Lulus Terseleksi') {
      totalLulus++;
      approvedDurs.push(v.dur_days);
    } else if (v.tindak_lanjut === 'Antrean di Verifikator') {
      totalAntreanVerif++;
    } else {
      totalRevisiRekanan++;
    }
    if (v.tindak_lanjut !== 'Lulus Terseleksi' && v.aging_days > 30) stagnantOver30++;
    sumAllDur += v.dur_days;
    if (v.dur_days > maxCycleDays) maxCycleDays = v.dur_days;
    sumRej += v.reject_count;
    sumRev += v.revision_count;
  }

  const vendorSummary = {
    totalVendors: vList.length,
    totalBadanUsaha,
    totalMandor,
    totalLulus,
    totalAntreanVerif,
    totalRevisiRekanan,
    avgCycleAllDays: vList.length ? sumAllDur / vList.length : null,
    avgCycleApprovedDays: avg(approvedDurs),
    minCycleApprovedDays: approvedDurs.length ? Math.min(...approvedDurs) : null,
    maxCycleDays: vList.length ? maxCycleDays : null,
    avgRejectPerVendor: vList.length ? sumRej / vList.length : null,
    avgRevisionPerVendor: vList.length ? sumRev / vList.length : null,
    stagnantOver30,
  };

  const verifSla: number[] = [];
  const rekSla: number[] = [];
  const intApprSla: number[] = [];
  const finalApprSla: number[] = [];
  const verifBeforeOct: number[] = [];
  const verifAfterOct: number[] = [];
  const rekBeforeOct: number[] = [];
  const rekAfterOct: number[] = [];
  let countVerifUnder3d = 0;
  let countVerifApprove = 0;
  let countVerifReject = 0;

  const bidangAgg = new Map<string, any>();
  const monthAgg = new Map<string, any>();
  const qAgg = new Map<string, any>();

  for (const l of lList) {
    if (l.kategori_aktor === 'SLA Verifikator' && l.sla_days !== null) {
      verifSla.push(l.sla_days);
      if (l.sla_days <= 3) countVerifUnder3d++;
      if (l.status === 1) countVerifApprove++;
      if (l.status === 2) countVerifReject++;
      if (l.kelompok_waktu === 'Sebelum Oktober 2026') verifBeforeOct.push(l.sla_days);
      else verifAfterOct.push(l.sla_days);
    } else if (l.kategori_aktor === 'SLA Rekanan' && l.sla_days !== null) {
      rekSla.push(l.sla_days);
      if (l.kelompok_waktu === 'Sebelum Oktober 2026') rekBeforeOct.push(l.sla_days);
      else rekAfterOct.push(l.sla_days);
    } else if (l.kategori_aktor === 'Internal Approval Bidang' && l.sla_days !== null) {
      intApprSla.push(l.sla_days);
    } else if (l.kategori_aktor === 'SLA Final Approval' && l.sla_days !== null) {
      finalApprSla.push(l.sla_days);
    }

    if (!bidangAgg.has(l.bidang)) {
      bidangAgg.set(l.bidang, {
        bidang: l.bidang,
        totalLogs: 0,
        countVerif: 0,
        countApprove: 0,
        countReject: 0,
        verifDays: [] as number[],
        verifApprDays: [] as number[],
        verifRejDays: [] as number[],
        countRekanan: 0,
        rekDays: [] as number[],
        apprIntDays: [] as number[],
      });
    }
    const ba = bidangAgg.get(l.bidang);
    ba.totalLogs++;
    if (l.kategori_aktor === 'SLA Verifikator') {
      ba.countVerif++;
      if (l.status === 1) ba.countApprove++;
      if (l.status === 2) ba.countReject++;
      if (l.sla_days !== null) {
        ba.verifDays.push(l.sla_days);
        if (l.status === 1) ba.verifApprDays.push(l.sla_days);
        if (l.status === 2) ba.verifRejDays.push(l.sla_days);
      }
    } else if (l.kategori_aktor === 'SLA Rekanan') {
      ba.countRekanan++;
      if (l.sla_days !== null) ba.rekDays.push(l.sla_days);
    } else if (
      (l.kategori_aktor === 'Internal Approval Bidang' || l.kategori_aktor === 'SLA Final Approval') &&
      l.sla_days !== null
    ) {
      ba.apprIntDays.push(l.sla_days);
    }

    if (!monthAgg.has(l.periode_bulan)) {
      monthAgg.set(l.periode_bulan, {
        bulan: l.periode_bulan,
        kelompokWaktu: l.kelompok_waktu,
        totalLogs: 0,
        v: [] as number[],
        r: [] as number[],
        t: [] as number[],
        teknik: [] as number[],
        keuangan: [] as number[],
        legal: [] as number[],
        bim: [] as number[],
        cqsms: [] as number[],
        finalApproval: [] as number[],
      });
    }
    const ma = monthAgg.get(l.periode_bulan);
    ma.totalLogs++;
    if (l.sla_days !== null) {
      ma.t.push(l.sla_days);
      if (l.kategori_aktor === 'SLA Verifikator') {
        ma.v.push(l.sla_days);
        if (l.bidang === 'Teknik') ma.teknik.push(l.sla_days);
        else if (l.bidang === 'Keuangan') ma.keuangan.push(l.sla_days);
        else if (l.bidang === 'Legal') ma.legal.push(l.sla_days);
        else if (l.bidang === 'BIM') ma.bim.push(l.sla_days);
        else if (l.bidang === 'CQSMS/QHSSE') ma.cqsms.push(l.sla_days);
      } else if (l.kategori_aktor === 'SLA Rekanan') {
        ma.r.push(l.sla_days);
      }
      if (l.bidang === 'Final Approval') ma.finalApproval.push(l.sla_days);
    }

    if (!qAgg.has(l.triwulan)) {
      qAgg.set(l.triwulan, {
        triwulan: l.triwulan,
        sortKey: l.periode_bulan,
        totalLogs: 0,
        v: [] as number[],
        r: [] as number[],
      });
    }
    const qa = qAgg.get(l.triwulan);
    if (l.periode_bulan < qa.sortKey) qa.sortKey = l.periode_bulan;
    qa.totalLogs++;
    if (l.sla_days !== null) {
      if (l.kategori_aktor === 'SLA Verifikator') qa.v.push(l.sla_days);
      else if (l.kategori_aktor === 'SLA Rekanan') qa.r.push(l.sla_days);
    }
  }

  const logSummary = {
    totalLogs: lList.length,
    avgSlaVerif: avg(verifSla),
    avgSlaRekanan: avg(rekSla),
    avgSlaInternalAppr: avg(intApprSla),
    avgSlaFinalAppr: avg(finalApprSla),
    countSlaVerif: verifSla.length,
    countVerifUnder3d,
    countVerifApprove,
    countVerifReject,
    avgVerifBeforeOct: avg(verifBeforeOct),
    avgVerifAfterOct: avg(verifAfterOct),
    avgRekBeforeOct: avg(rekBeforeOct),
    avgRekAfterOct: avg(rekAfterOct),
  };

  const bidangSummary = BIDANG_ORDER.map((b) => {
    const ba = bidangAgg.get(b);
    if (!ba) return null;
    return {
      bidang: b,
      totalLogs: ba.totalLogs,
      countVerif: ba.countVerif,
      countApprove: ba.countApprove,
      countReject: ba.countReject,
      avgSlaVerif: avg(ba.verifDays),
      avgSlaApprove: avg(ba.verifApprDays),
      avgSlaReject: avg(ba.verifRejDays),
      countRekanan: ba.countRekanan,
      avgSlaRekanan: avg(ba.rekDays),
      avgSlaApprovalInternal: avg(ba.apprIntDays),
    };
  }).filter(Boolean);

  const monthlyTrend = [...monthAgg.values()]
    .sort((a, b) => a.bulan.localeCompare(b.bulan))
    .map((m) => ({
      bulan: m.bulan,
      kelompokWaktu: m.kelompokWaktu,
      totalLogs: m.totalLogs,
      slaVerifikator: avg(m.v),
      slaRekanan: avg(m.r),
      slaTotal: avg(m.t),
      teknik: avg(m.teknik),
      keuangan: avg(m.keuangan),
      legal: avg(m.legal),
      bim: avg(m.bim),
      cqsms: avg(m.cqsms),
      finalApproval: avg(m.finalApproval),
    }));

  const qaApprovedMap = new Map<string, number>();
  for (const v of vList) {
    if (v.tindak_lanjut === 'Lulus Terseleksi' && v.approved_quarter) {
      qaApprovedMap.set(v.approved_quarter, (qaApprovedMap.get(v.approved_quarter) || 0) + 1);
    }
  }

  const quarterly = [...qAgg.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((q) => {
      const approvedCount = qaApprovedMap.get(q.triwulan) || 0;
      const effectiveDays = QUARTER_DAYS[q.triwulan] || 90;
      return {
        triwulan: q.triwulan,
        sortKey: q.sortKey,
        totalLogs: q.totalLogs,
        slaVerifikator: avg(q.v),
        slaRekanan: avg(q.r),
        approvedCount,
        effectiveDays,
        approvedPerDay: approvedCount / effectiveDays,
      };
    });

  const queueDistribution = [
    { name: 'Lulus Terseleksi', value: totalLulus, color: '#0D9488' },
    { name: 'Antrean di Verifikator', value: totalAntreanVerif, color: '#2563EB' },
    { name: 'Revisi di Rekanan', value: totalRevisiRekanan, color: '#D97706' },
  ];

  return {
    vendorSummary,
    logSummary,
    bidangSummary,
    monthlyTrend,
    quarterly,
    queueDistribution,
  };
}

export async function browserGetLeaderboard(params: {
  limit?: number;
  includeInProgress?: boolean;
  divisi?: string;
}) {
  const ds = await ensureDataset();
  const limit = Math.min(25, Math.max(5, params.limit || 10));
  const includeInProgressSlow = Boolean(params.includeInProgress);
  const divFilter = params.divisi && params.divisi !== 'ALL' ? params.divisi : null;
  const vList = divFilter ? ds.vendors.filter((v) => v.divisi === divFilter) : ds.vendors;

  const buFastest = vList
    .filter(
      (v) =>
        v.tipe_rekanan === 'Badan Usaha' &&
        v.total_logs >= 7 &&
        v.first_act === 'Konfirmasi Selesai' &&
        v.clean_pass_dur_days !== null
    )
    .sort((a, b) => (a.clean_pass_dur_days! - b.clean_pass_dur_days!) || a.total_logs - b.total_logs)
    .slice(0, limit);

  const buSlowest = vList
    .filter(
      (v) =>
        v.tipe_rekanan === 'Badan Usaha' &&
        v.total_logs >= 7 &&
        v.first_act === 'Konfirmasi Selesai' &&
        (includeInProgressSlow || v.tindak_lanjut === 'Lulus Terseleksi')
    )
    .sort((a, b) => b.dur_days - a.dur_days)
    .slice(0, limit);

  const mandorFastest = vList
    .filter(
      (v) =>
        v.tipe_rekanan === 'Mandor' &&
        v.total_logs >= 3 &&
        v.first_act === 'Konfirmasi Selesai Mandor' &&
        v.clean_pass_dur_days !== null
    )
    .sort((a, b) => (a.clean_pass_dur_days! - b.clean_pass_dur_days!) || a.total_logs - b.total_logs)
    .slice(0, limit);

  const mandorSlowest = vList
    .filter(
      (v) =>
        v.tipe_rekanan === 'Mandor' &&
        v.first_act === 'Konfirmasi Selesai Mandor' &&
        (includeInProgressSlow || v.tindak_lanjut === 'Lulus Terseleksi')
    )
    .sort((a, b) => b.dur_days - a.dur_days)
    .slice(0, limit);

  const summarize = (arr: VendorRow[]) => ({
    total: arr.length,
    lulus: arr.filter((x) => x.tindak_lanjut === 'Lulus Terseleksi').length,
    avgPassDays: avg(arr.filter((x) => x.clean_pass_dur_days !== null).map((x) => x.clean_pass_dur_days!)),
    avgAllDays: avg(arr.map((x) => x.dur_days)),
  });

  return {
    limit,
    includeInProgressSlow,
    buStats: summarize(vList.filter((v) => v.tipe_rekanan === 'Badan Usaha')),
    mandorStats: summarize(vList.filter((v) => v.tipe_rekanan === 'Mandor')),
    buFastest,
    buSlowest,
    mandorFastest,
    mandorSlowest,
  };
}

export async function browserGetVendors(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  tipe?: string;
  divisi?: string;
  tindakLanjut?: string;
  revisionBand?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}) {
  const ds = await ensureDataset();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize || 25));
  const search = String(params.search || '').trim().toLowerCase();

  let list = ds.vendors.filter((v) => {
    if (search) {
      const hit =
        v.nama_perusahaan.toLowerCase().includes(search) ||
        String(v.id_vendor).includes(search) ||
        v.last_act.toLowerCase().includes(search);
      if (!hit) return false;
    }
    if (params.tipe && params.tipe !== 'ALL' && v.tipe_rekanan !== params.tipe) return false;
    if (params.divisi && params.divisi !== 'ALL' && v.divisi !== params.divisi) return false;
    if (params.tindakLanjut && params.tindakLanjut !== 'ALL' && v.tindak_lanjut !== params.tindakLanjut) return false;
    if (params.revisionBand && params.revisionBand !== 'ALL') {
      if (params.revisionBand === '0' && v.revision_count !== 0) return false;
      if (params.revisionBand === '1-3' && (v.revision_count < 1 || v.revision_count > 3)) return false;
      if (params.revisionBand === '4-10' && (v.revision_count < 4 || v.revision_count > 10)) return false;
      if (params.revisionBand === '10+' && v.revision_count <= 10) return false;
    }
    return true;
  });

  const sortCol = (params.sortBy || 'end_serial') as keyof VendorRow;
  const dir = params.sortDir === 'asc' ? 1 : -1;

  list = [...list].sort((a, b) => {
    const va = a[sortCol];
    const vb = b[sortCol];
    if (typeof va === 'string' && typeof vb === 'string') {
      const cmp = va.localeCompare(vb);
      return cmp !== 0 ? cmp * dir : a.id_vendor - b.id_vendor;
    }
    const diff = Number(va ?? 0) - Number(vb ?? 0);
    return diff !== 0 ? diff * dir : a.id_vendor - b.id_vendor;
  });

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    items: list.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function browserGetVendorDetail(idVendor: number) {
  const ds = await ensureDataset();
  const vendor = ds.vendors.find((v) => v.id_vendor === idVendor);
  if (!vendor) throw new Error('Rekanan tidak ditemukan.');

  const logs = ds.logs
    .filter((l) => l.id_vendor === idVendor)
    .sort((a, b) => (a.serial_date - b.serial_date) || (a.seq_no - b.seq_no));

  const bidangMap = new Map<string, any>();
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
      else if (l.kategori_aktor === 'SLA Rekanan' || l.kategori_aktor === 'Aktivitas Rekanan')
        b.rekananSlaDays += l.sla_days;
      else b.internalSlaDays += l.sla_days;
    }
    b.lastAct = l.tipe_activity;
    b.lastStatus = l.hasil_status;
    b.lastWaktu = l.waktu_display;
  }

  const bidangBreakdown = BIDANG_ORDER.map((n) => bidangMap.get(n)).filter(Boolean);

  let maxChronoGap: LogRow | null = null;
  let maxPairedGap: LogRow | null = null;
  for (const l of logs) {
    if (l.chrono_gap_days !== null && (!maxChronoGap || l.chrono_gap_days > (maxChronoGap.chrono_gap_days ?? -1))) {
      maxChronoGap = l;
    }
    if (l.sla_days !== null && (!maxPairedGap || l.sla_days > (maxPairedGap.sla_days ?? -1))) {
      maxPairedGap = l;
    }
  }

  return {
    vendor,
    logs,
    bidangBreakdown,
    highlights: {
      maxChronoGap: maxChronoGap
        ? {
            days: maxChronoGap.chrono_gap_days!,
            hours: maxChronoGap.chrono_gap_hours!,
            fromAct: maxChronoGap.chrono_prev_act,
            toAct: maxChronoGap.tipe_activity,
            waktu: maxChronoGap.waktu_display,
          }
        : null,
      maxPairedGap: maxPairedGap
        ? {
            days: maxPairedGap.sla_days!,
            hours: maxPairedGap.sla_hours!,
            fromAct: maxPairedGap.paired_prev_act,
            toAct: maxPairedGap.tipe_activity,
            kategori: maxPairedGap.kategori_aktor,
            bidang: maxPairedGap.bidang,
            waktu: maxPairedGap.waktu_display,
          }
        : null,
    },
  };
}

export async function browserGetAnalytics(filters: GlobalFilters) {
  const ds = await ensureDataset();
  const lList = filterLogs(ds.logs, filters);
  const vList = filterVendors(ds.vendors, filters);

  const p2Map = new Map<string, any>();
  const p3Map = new Map<string, any>();
  const bmMap = new Map<string, any>();
  const bqMap = new Map<string, any>();
  const stMap = new Map<string, any>();
  const actMap = new Map<string, any>();

  const ensureBidangBucket = (map: Map<string, any>, label: string, sortKey = label) => {
    if (!map.has(label)) {
      map.set(label, {
        label,
        sortKey,
        teknikVerif: [] as number[],
        teknikRek: [] as number[],
        keuanganVerif: [] as number[],
        keuanganRek: [] as number[],
        legalVerif: [] as number[],
        legalRek: [] as number[],
        bimVerif: [] as number[],
        bimRek: [] as number[],
        cqsmsVerif: [] as number[],
        cqsmsRek: [] as number[],
        finalVerif: [] as number[],
      });
    }
    return map.get(label);
  };

  for (const l of lList) {
    // 2-Periode
    if (!p2Map.has(l.bidang)) {
      p2Map.set(l.bidang, {
        bidang: l.bidang,
        logsBefore: 0,
        logsAfter: 0,
        vB: [] as number[],
        vA: [] as number[],
        rB: [] as number[],
        rA: [] as number[],
        tB: [] as number[],
        tA: [] as number[],
        fB: [] as number[],
        fA: [] as number[],
      });
    }
    const p2 = p2Map.get(l.bidang);
    const isAfter = l.kelompok_waktu === 'Oktober 2026 - Sekarang';
    if (isAfter) p2.logsAfter++;
    else p2.logsBefore++;
    if (l.sla_days !== null) {
      if (isAfter) p2.tA.push(l.sla_days);
      else p2.tB.push(l.sla_days);
      if (l.kategori_aktor === 'SLA Verifikator') (isAfter ? p2.vA : p2.vB).push(l.sla_days);
      else if (l.kategori_aktor === 'SLA Rekanan') (isAfter ? p2.rA : p2.rB).push(l.sla_days);
      else if (l.kategori_aktor === 'SLA Final Approval') (isAfter ? p2.fA : p2.fB).push(l.sla_days);
    }

    // 3-Periode
    if (!p3Map.has(l.periode_3)) {
      p3Map.set(l.periode_3, { totalLogs: 0, v: [] as number[], r: [] as number[] });
    }
    const p3 = p3Map.get(l.periode_3);
    p3.totalLogs++;
    if (l.sla_days !== null) {
      if (l.kategori_aktor === 'SLA Verifikator') p3.v.push(l.sla_days);
      else if (l.kategori_aktor === 'SLA Rekanan') p3.r.push(l.sla_days);
    }

    // Monthly & Quarterly Per-Bidang
    const bm = ensureBidangBucket(bmMap, l.periode_bulan);
    const bq = ensureBidangBucket(bqMap, l.triwulan, l.periode_bulan);
    if (l.periode_bulan < bq.sortKey) bq.sortKey = l.periode_bulan;
    if (l.sla_days !== null) {
      for (const target of [bm, bq]) {
        if (l.kategori_aktor === 'SLA Verifikator') {
          if (l.bidang === 'Teknik') target.teknikVerif.push(l.sla_days);
          else if (l.bidang === 'Keuangan') target.keuanganVerif.push(l.sla_days);
          else if (l.bidang === 'Legal') target.legalVerif.push(l.sla_days);
          else if (l.bidang === 'BIM') target.bimVerif.push(l.sla_days);
          else if (l.bidang === 'CQSMS/QHSSE') target.cqsmsVerif.push(l.sla_days);
        } else if (l.kategori_aktor === 'SLA Rekanan') {
          if (l.bidang === 'Teknik') target.teknikRek.push(l.sla_days);
          else if (l.bidang === 'Keuangan') target.keuanganRek.push(l.sla_days);
          else if (l.bidang === 'Legal') target.legalRek.push(l.sla_days);
          else if (l.bidang === 'BIM') target.bimRek.push(l.sla_days);
          else if (l.bidang === 'CQSMS/QHSSE') target.cqsmsRek.push(l.sla_days);
        }
        if (l.bidang === 'Final Approval') target.finalVerif.push(l.sla_days);
      }
    }

    // Status Matrix
    if (!stMap.has(l.kategori_aktor)) {
      stMap.set(l.kategori_aktor, {
        kategori: l.kategori_aktor,
        totalLogs: 0,
        countApprove: 0,
        countReject: 0,
        apprDays: [] as number[],
        rejDays: [] as number[],
        allDays: [] as number[],
      });
    }
    const sm = stMap.get(l.kategori_aktor);
    sm.totalLogs++;
    if (l.status === 1) sm.countApprove++;
    if (l.status === 2) sm.countReject++;
    if (l.sla_days !== null) {
      sm.allDays.push(l.sla_days);
      if (l.status === 1) sm.apprDays.push(l.sla_days);
      if (l.status === 2) sm.rejDays.push(l.sla_days);
    }

    // Activity Summary
    if (!actMap.has(l.tipe_activity)) {
      actMap.set(l.tipe_activity, {
        tipeActivity: l.tipe_activity,
        bidang: l.bidang,
        aktor: l.aktor_login,
        totalKejadian: 0,
        countApprove: 0,
        countReject: 0,
        hrs: [] as number[],
        days: [] as number[],
        apprDays: [] as number[],
        rejDays: [] as number[],
      });
    }
    const am = actMap.get(l.tipe_activity);
    am.totalKejadian++;
    if (l.status === 1) am.countApprove++;
    if (l.status === 2) am.countReject++;
    if (l.sla_days !== null) {
      am.days.push(l.sla_days);
      am.hrs.push(l.sla_hours!);
      if (l.status === 1) am.apprDays.push(l.sla_days);
      if (l.status === 2) am.rejDays.push(l.sla_days);
    }
  }

  const period2Comparison = BIDANG_ORDER.map((b) => {
    const r = p2Map.get(b);
    if (!r) return null;
    const vB = avg(b === 'Final Approval' ? r.fB : r.vB);
    const vA = avg(b === 'Final Approval' ? r.fA : r.vA);
    const delta = vB !== null && vA !== null ? vA - vB : null;
    return {
      bidang: b,
      logsBefore: r.logsBefore,
      verifBefore: vB,
      rekBefore: avg(r.rB),
      totalBefore: avg(r.tB),
      logsAfter: r.logsAfter,
      verifAfter: vA,
      rekAfter: avg(r.rA),
      totalAfter: avg(r.tA),
      deltaVerif: delta,
      statusEval:
        delta === null ? 'Tidak Ada Data Baru' : delta < -0.05 ? 'Membaik' : delta > 0.05 ? 'Meningkat' : 'Stabil',
    };
  }).filter(Boolean);

  const p3Appr = new Map<string, number>();
  for (const v of vList) {
    if (v.tindak_lanjut === 'Lulus Terseleksi' && v.approved_period3) {
      p3Appr.set(v.approved_period3, (p3Appr.get(v.approved_period3) || 0) + 1);
    }
  }
  const period3Summary = PERIOD3_META.map((pm) => {
    const p3 = p3Map.get(pm.id) || { totalLogs: 0, v: [], r: [] };
    const approvedCount = p3Appr.get(pm.id) || 0;
    return {
      ...pm,
      totalLogs: p3.totalLogs,
      slaVerif: avg(p3.v),
      slaRekanan: avg(p3.r),
      approvedCount,
      approvedPerDay: approvedCount / pm.effectiveDays,
    };
  });

  const finalizeBucket = (x: any) => ({
    label: x.label,
    sortKey: x.sortKey,
    teknikVerif: avg(x.teknikVerif),
    teknikRek: avg(x.teknikRek),
    keuanganVerif: avg(x.keuanganVerif),
    keuanganRek: avg(x.keuanganRek),
    legalVerif: avg(x.legalVerif),
    legalRek: avg(x.legalRek),
    bimVerif: avg(x.bimVerif),
    bimRek: avg(x.bimRek),
    cqsmsVerif: avg(x.cqsmsVerif),
    cqsmsRek: avg(x.cqsmsRek),
    finalVerif: avg(x.finalVerif),
  });

  const bidangMonthly = [...bmMap.values()].sort((a, b) => a.label.localeCompare(b.label)).map(finalizeBucket);
  const bidangQuarterly = [...bqMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(finalizeBucket);

  const statusMatrix = [...stMap.values()]
    .sort((a, b) => b.totalLogs - a.totalLogs)
    .map((s) => ({
      kategori: s.kategori,
      totalLogs: s.totalLogs,
      countApprove: s.countApprove,
      countReject: s.countReject,
      avgSlaApprove: avg(s.apprDays),
      avgSlaReject: avg(s.rejDays),
      avgSlaAll: avg(s.allDays),
    }));

  const activitySummary = [...actMap.values()]
    .sort((a, b) => b.totalKejadian - a.totalKejadian)
    .map((a) => ({
      tipeActivity: a.tipeActivity,
      bidang: a.bidang,
      aktor: a.aktor,
      totalKejadian: a.totalKejadian,
      countApprove: a.countApprove,
      countReject: a.countReject,
      avgSlaHours: avg(a.hrs),
      avgSlaDays: avg(a.days),
      avgSlaApprove: avg(a.apprDays),
      avgSlaReject: avg(a.rejDays),
    }));

  const finalApprovalDiagnostic = computeFinalApprovalDiagnostic(
    lList.filter((l) => l.bidang === 'Final Approval')
  );

  return {
    period2Comparison,
    period3Summary,
    bidangMonthly,
    bidangQuarterly,
    statusMatrix,
    activitySummary,
    finalApprovalDiagnostic,
  };
}

export async function browserGetFgdDefense(filters: GlobalFilters) {
  const ds = await ensureDataset();
  const vList = filterVendors(ds.vendors, filters);
  const lList = filterLogs(ds.logs, filters);
  return computeFgdDefenseData(vList, lList, ds.meta);
}

export async function browserGetDivisionsRevisions(filters: GlobalFilters) {
  const ds = await ensureDataset();
  const vList = filterVendors(ds.vendors, filters);
  const lList = filterLogs(ds.logs, filters);

  const divMap = new Map<string, any>();
  const revBucketMap = new Map<string, any>();
  const agingMap = new Map<string, any>();

  for (const v of vList) {
    if (!divMap.has(v.divisi)) {
      divMap.set(v.divisi, {
        divisi: v.divisi,
        totalVendors: 0,
        badanUsaha: 0,
        mandor: 0,
        lulus: 0,
        antreanVerif: 0,
        revisiRekanan: 0,
        durs: [] as number[],
        dursAppr: [] as number[],
        revs: [] as number[],
      });
    }
    const d = divMap.get(v.divisi);
    d.totalVendors++;
    if (v.tipe_rekanan === 'Badan Usaha') d.badanUsaha++;
    else d.mandor++;
    if (v.tindak_lanjut === 'Lulus Terseleksi') {
      d.lulus++;
      d.dursAppr.push(v.dur_days);
    } else if (v.tindak_lanjut === 'Antrean di Verifikator') {
      d.antreanVerif++;
    } else {
      d.revisiRekanan++;
    }
    d.durs.push(v.dur_days);
    d.revs.push(v.revision_count);

    let bucket = '> 10 Revisi';
    let sortOrder = 5;
    if (v.revision_count === 0) {
      bucket = '0 Revisi (Mulus)';
      sortOrder = 1;
    } else if (v.revision_count <= 2) {
      bucket = '1 - 2 Revisi';
      sortOrder = 2;
    } else if (v.revision_count <= 5) {
      bucket = '3 - 5 Revisi';
      sortOrder = 3;
    } else if (v.revision_count <= 10) {
      bucket = '6 - 10 Revisi';
      sortOrder = 4;
    }

    if (!revBucketMap.has(bucket)) {
      revBucketMap.set(bucket, { bucket, sortOrder, vendorCount: 0, lulusCount: 0, durs: [] as number[], appr: [] as number[] });
    }
    const rb = revBucketMap.get(bucket);
    rb.vendorCount++;
    rb.durs.push(v.dur_days);
    if (v.tindak_lanjut === 'Lulus Terseleksi') {
      rb.lulusCount++;
      rb.appr.push(v.dur_days);
    }

    if (v.tindak_lanjut !== 'Lulus Terseleksi') {
      let ab = '> 180 Hari';
      let aSort = 5;
      if (v.aging_days <= 7) {
        ab = '0 - 7 Hari';
        aSort = 1;
      } else if (v.aging_days <= 30) {
        ab = '8 - 30 Hari';
        aSort = 2;
      } else if (v.aging_days <= 90) {
        ab = '31 - 90 Hari';
        aSort = 3;
      } else if (v.aging_days <= 180) {
        ab = '91 - 180 Hari';
        aSort = 4;
      }
      if (!agingMap.has(ab)) {
        agingMap.set(ab, { bucket: ab, sortOrder: aSort, antreanVerif: 0, revisiRekanan: 0, total: 0 });
      }
      const ag = agingMap.get(ab);
      ag.total++;
      if (v.tindak_lanjut === 'Antrean di Verifikator') ag.antreanVerif++;
      else ag.revisiRekanan++;
    }
  }

  const divisionStats = [...divMap.values()]
    .map((d) => ({
      divisi: d.divisi,
      totalVendors: d.totalVendors,
      badanUsaha: d.badanUsaha,
      mandor: d.mandor,
      lulus: d.lulus,
      antreanVerif: d.antreanVerif,
      revisiRekanan: d.revisiRekanan,
      avgDurDays: avg(d.durs),
      avgDurApproved: avg(d.dursAppr),
      avgRevisions: avg(d.revs),
    }))
    .sort((a, b) => {
      if (a.divisi === 'Tidak Tercantum' && b.divisi !== 'Tidak Tercantum') return 1;
      if (b.divisi === 'Tidak Tercantum' && a.divisi !== 'Tidak Tercantum') return -1;
      return b.totalVendors - a.totalVendors;
    });

  const revisionBuckets = [...revBucketMap.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => ({
      bucket: r.bucket,
      sortOrder: r.sortOrder,
      vendorCount: r.vendorCount,
      lulusCount: r.lulusCount,
      avgDurDays: avg(r.durs),
      avgDurApproved: avg(r.appr),
    }));

  const fricMap = new Map<string, any>();
  for (const l of lList) {
    if (!['Teknik', 'Keuangan', 'Legal', 'BIM', 'CQSMS/QHSSE'].includes(l.bidang)) continue;
    if (!fricMap.has(l.bidang)) {
      fricMap.set(l.bidang, { bidang: l.bidang, totalRejects: 0, totalRevisions: 0, rekDays: [] as number[] });
    }
    const f = fricMap.get(l.bidang);
    if (l.status === 2) f.totalRejects++;
    if (l.tipe_activity.startsWith('Konfirmasi Revisi Selesai')) f.totalRevisions++;
    if (l.kategori_aktor === 'SLA Rekanan' && l.sla_days !== null) f.rekDays.push(l.sla_days);
  }
  const bidangFriction = [...fricMap.values()]
    .sort((a, b) => b.totalRejects - a.totalRejects)
    .map((f) => ({
      bidang: f.bidang,
      totalRejects: f.totalRejects,
      totalRevisions: f.totalRevisions,
      avgRevisionResponseDays: avg(f.rekDays),
    }));

  const agingBuckets = [...agingMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  const stagnantVerif = vList
    .filter((v) => v.tindak_lanjut === 'Antrean di Verifikator')
    .sort((a, b) => b.aging_days - a.aging_days)
    .slice(0, 15);

  const stagnantRekanan = vList
    .filter((v) => v.tindak_lanjut === 'Revisi di Rekanan')
    .sort((a, b) => b.aging_days - a.aging_days)
    .slice(0, 15);

  return {
    divisionStats,
    revisionBuckets,
    bidangFriction,
    agingBuckets,
    stagnantVerif,
    stagnantRekanan,
  };
}

export async function browserGetVerifiers(params: GlobalFilters & { minLogs?: number; bidang?: string }) {
  const ds = await ensureDataset();
  const lList = filterLogs(ds.logs, params);
  const minLogs = params.minLogs || 5;
  const bidangFilter = params.bidang || 'ALL';

  const vMap = new Map<string, any>();
  for (const l of lList) {
    if (l.by_login !== 0 || !l.message_by) continue;
    if (!vMap.has(l.message_by)) {
      vMap.set(l.message_by, {
        verifierId: l.message_by,
        totalInternalLogs: 0,
        totalSlaVerif: 0,
        countApprove: 0,
        countReject: 0,
        within3Days: 0,
        slaHours: [] as number[],
        slaDays: [] as number[],
        bidangCounts: {} as Record<string, number>,
      });
    }
    const v = vMap.get(l.message_by);
    v.totalInternalLogs++;
    v.bidangCounts[l.bidang] = (v.bidangCounts[l.bidang] || 0) + 1;
    if (l.kategori_aktor === 'SLA Verifikator') {
      v.totalSlaVerif++;
      if (l.status === 1) v.countApprove++;
      if (l.status === 2) v.countReject++;
      if (l.sla_days !== null) {
        v.slaDays.push(l.sla_days);
        v.slaHours.push(l.sla_hours!);
        if (l.sla_days <= 3) v.within3Days++;
      }
    }
  }

  let items = [...vMap.values()]
    .filter((v) => v.totalInternalLogs >= minLogs)
    .map((v) => {
      const topBidang = Object.entries(v.bidangCounts as Record<string, number>).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Umum';
      return {
        verifierId: v.verifierId,
        totalInternalLogs: v.totalInternalLogs,
        totalSlaVerif: v.totalSlaVerif,
        countApprove: v.countApprove,
        countReject: v.countReject,
        avgSlaHours: avg(v.slaHours),
        avgSlaDays: avg(v.slaDays),
        within3Days: v.within3Days,
        bidangUtama: topBidang,
        slaComplianceRate: v.totalSlaVerif > 0 ? v.within3Days / v.totalSlaVerif : null,
        approveRate: v.totalSlaVerif > 0 ? v.countApprove / v.totalSlaVerif : null,
      };
    })
    .sort((a, b) => (b.totalSlaVerif - a.totalSlaVerif) || (b.totalInternalLogs - a.totalInternalLogs));

  if (bidangFilter !== 'ALL') {
    items = items.filter((x) => x.bidangUtama === bidangFilter);
  }

  return { items };
}

export async function browserGetVerifierLogs(verifierId: string) {
  const ds = await ensureDataset();
  const logs = ds.logs
    .filter((l) => l.by_login === 0 && l.message_by === verifierId)
    .sort((a, b) => b.serial_date - a.serial_date)
    .slice(0, 100);
  return { verifierId, logs };
}

export async function browserExportVendorsExcel(filters: GlobalFilters) {
  const ds = await ensureDataset();
  const list = filterVendors(ds.vendors, filters).sort((a, b) => b.end_serial - a.end_serial);
  const rows = list.map((v) => ({
    'ID Vendor': v.id_vendor,
    'Nama Rekanan': v.nama_perusahaan,
    'Tipe Rekanan': v.tipe_rekanan,
    Divisi: v.divisi,
    'Mulai Registrasi': v.start_iso,
    'Aktivitas Terakhir (Tgl)': v.end_iso,
    'Total Log': v.total_logs,
    'Durasi Siklus (Hari)': Number(v.dur_days.toFixed(2)),
    'Durasi Siklus (Jam)': Number(v.dur_hours.toFixed(2)),
    'Jumlah Reject': v.reject_count,
    'Jumlah Revisi': v.revision_count,
    'Akumulasi SLA Verifikator (Hari)': Number(v.verif_sla_days.toFixed(2)),
    'Akumulasi SLA Rekanan (Hari)': Number(v.rekanan_sla_days.toFixed(2)),
    'Aktivitas Terakhir': v.last_act,
    'Status Tindak Lanjut': v.tindak_lanjut,
    'Aging Antrean (Hari)': Number(v.aging_days.toFixed(2)),
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Siklus Rekanan');
  XLSX.writeFile(wb, 'Export_Pelacak_SLA_Rekanan.xlsx');
}

export async function browserExportVendorDetailExcel(idVendor: number) {
  const { vendor, logs } = await browserGetVendorDetail(idVendor);
  const rows = logs.map((l) => ({
    Waktu: l.waktu_display,
    Bidang: l.bidang,
    Aktivitas: l.tipe_activity,
    Status: l.hasil_status,
    Aktor: l.aktor_login,
    'User / ID': l.message_by,
    'Kategori SLA (Per-Bidang)': l.kategori_aktor,
    'Acuan Sebelumnya (Per-Bidang)': l.paired_prev_act,
    'SLA Per-Bidang (Jam)': l.sla_hours !== null ? Number(l.sla_hours.toFixed(2)) : null,
    'SLA Per-Bidang (Hari)': l.sla_days !== null ? Number(l.sla_days.toFixed(2)) : null,
    'Log Kronologis Sebelumnya': l.chrono_prev_act,
    'Jarak Kronologis (Jam)': l.chrono_gap_hours !== null ? Number(l.chrono_gap_hours.toFixed(2)) : null,
    'Jarak Kronologis (Hari)': l.chrono_gap_days !== null ? Number(l.chrono_gap_days.toFixed(2)) : null,
    'Kumulatif Sejak Awal (Hari)': Number(l.cumulative_days.toFixed(2)),
    'Pesan Log': l.message,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Log Rekanan');
  const safeName = vendor.nama_perusahaan.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  XLSX.writeFile(wb, `Log_${idVendor}_${safeName}.xlsx`);
}
