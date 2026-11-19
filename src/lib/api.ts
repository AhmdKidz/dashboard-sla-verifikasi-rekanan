export interface GlobalFilters {
  tipe: 'ALL' | 'Badan Usaha' | 'Mandor';
  divisi: string;
  periode: 'ALL' | 'Periode 1' | 'Periode 2' | 'Periode 3';
}

export interface VendorRow {
  id_vendor: number;
  nama_perusahaan: string;
  tipe_rekanan: 'Badan Usaha' | 'Mandor';
  divisi: string;
  total_logs: number;
  start_serial: number;
  end_serial: number;
  start_iso: string;
  end_iso: string;
  start_month: string;
  end_month: string;
  dur_days: number;
  dur_hours: number;
  first_act: string;
  last_act: string;
  last_status: number;
  last_by_login: number;
  status_kelulusan: string;
  tindak_lanjut: 'Lulus Terseleksi' | 'Antrean di Verifikator' | 'Revisi di Rekanan';
  clean_pass_dur_days: number | null;
  has_valid_start: number;
  reject_count: number;
  revision_count: number;
  verif_sla_days: number;
  rekanan_sla_days: number;
  internal_sla_days: number;
  aging_days: number;
  approved_quarter: string;
  approved_period3: string;
}

export interface LogRow {
  seq_no: number;
  log_id: number;
  id_vendor: number;
  nama_perusahaan: string;
  tipe_rekanan: string;
  divisi: string;
  message: string;
  status: number;
  hasil_status: string;
  message_by: string;
  serial_date: number;
  waktu_iso: string;
  waktu_display: string;
  periode_bulan: string;
  triwulan: string;
  kelompok_waktu: string;
  periode_3: string;
  tipe_sub_modul: string;
  tipe_activity: string;
  bidang: string;
  dari_modul: string;
  by_login: number;
  aktor_login: string;
  paired_prev_act: string;
  paired_prev_waktu: string;
  sla_hours: number | null;
  sla_days: number | null;
  kategori_aktor: string;
  chrono_prev_act: string;
  chrono_gap_hours: number | null;
  chrono_gap_days: number | null;
  cumulative_days: number;
}

function toParams(obj: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  return sp.toString();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `Permintaan gagal (${res.status})`;
    try {
      const err = await res.json();
      if (err?.error) msg = err.error;
    } catch {
      // ignore non-json
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  getMeta: () =>
    fetchJson<{
      meta: Record<string, string>;
      dbSizeBytes: number;
      divisiList: { divisi: string; count: number }[];
      bidangList: string[];
    }>('/api/meta'),

  getOverview: (filters: GlobalFilters) =>
    fetchJson<any>(`/api/overview?${toParams(filters as any)}`),

  getLeaderboard: (params: { limit?: number; includeInProgress?: boolean; divisi?: string }) =>
    fetchJson<{
      limit: number;
      includeInProgressSlow: boolean;
      buStats: { total: number; lulus: number; avgPassDays: number | null; avgAllDays: number | null };
      mandorStats: { total: number; lulus: number; avgPassDays: number | null; avgAllDays: number | null };
      buFastest: VendorRow[];
      buSlowest: VendorRow[];
      mandorFastest: VendorRow[];
      mandorSlowest: VendorRow[];
    }>(`/api/leaderboard?${toParams(params)}`),

  getVendors: (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    tipe?: string;
    divisi?: string;
    tindakLanjut?: string;
    revisionBand?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) =>
    fetchJson<{
      items: VendorRow[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/api/vendors?${toParams(params)}`),

  getVendorDetail: (idVendor: number) =>
    fetchJson<{
      vendor: VendorRow;
      logs: LogRow[];
      bidangBreakdown: {
        bidang: string;
        totalLogs: number;
        rejects: number;
        revisions: number;
        approves: number;
        verifSlaDays: number;
        rekananSlaDays: number;
        internalSlaDays: number;
        lastAct: string;
        lastStatus: string;
        lastWaktu: string;
      }[];
      highlights: {
        maxChronoGap: { days: number; hours: number; fromAct: string; toAct: string; waktu: string } | null;
        maxPairedGap: {
          days: number;
          hours: number;
          fromAct: string;
          toAct: string;
          kategori: string;
          bidang: string;
          waktu: string;
        } | null;
      };
    }>(`/api/vendors/${idVendor}`),

  getAnalytics: (filters: GlobalFilters) =>
    fetchJson<any>(`/api/analytics?${toParams(filters as any)}`),

  getDivisionsRevisions: (filters: GlobalFilters) =>
    fetchJson<any>(`/api/divisions-revisions?${toParams(filters as any)}`),

  getVerifiers: (params: GlobalFilters & { minLogs?: number; bidang?: string }) =>
    fetchJson<{ items: any[] }>(`/api/verifiers?${toParams(params as any)}`),

  getVerifierLogs: (verifierId: string) =>
    fetchJson<{ verifierId: string; logs: LogRow[] }>(`/api/verifiers/${encodeURIComponent(verifierId)}/logs`),

  importExcel: async (file: File, options: { exclude2024: boolean; excludeDummies: boolean }) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('exclude2024', String(options.exclude2024));
    fd.append('excludeDummies', String(options.excludeDummies));
    return fetchJson<{ success: boolean; message: string; meta: Record<string, any> }>('/api/import', {
      method: 'POST',
      body: fd,
    });
  },

  exportVendorsUrl: (filters: GlobalFilters) => `/api/export/vendors?${toParams(filters as any)}`,
  exportVendorDetailUrl: (idVendor: number) => `/api/export/vendors/${idVendor}`,
};
