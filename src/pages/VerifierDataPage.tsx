import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Database,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  UserCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { api, getRuntimeMode, type GlobalFilters, type LogRow } from '@/lib/api';
import { formatBytes, formatDaysSmart, formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FilterSelect,
} from '@/components/ui/primitives';
import { ErrorState, TableSkeleton } from '@/components/StateViews';
import { cn } from '@/lib/utils';

export function VerifierDataPage({
  filters,
  datasetMeta,
  dbSizeBytes,
  onDatasetUpdated,
  onSelectVendor,
}: {
  filters: GlobalFilters;
  datasetMeta: Record<string, string>;
  dbSizeBytes: number;
  onDatasetUpdated: () => void;
  onSelectVendor: (idVendor: number) => void;
}) {
  const [verifiers, setVerifiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidangFilter, setBidangFilter] = useState('ALL');
  const [minLogs, setMinLogs] = useState('5');

  const [selectedVerifier, setSelectedVerifier] = useState<string | null>(null);
  const [verifierLogs, setVerifierLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [exclude2024, setExclude2024] = useState(true);
  const [excludeDummies, setExcludeDummies] = useState(true);
  const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getVerifiers({ ...filters, bidang: bidangFilter, minLogs: Number(minLogs) })
      .then((res) => setVerifiers(res.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filters.tipe, filters.divisi, filters.periode, bidangFilter, minLogs]);

  const openVerifierLogs = (id: string) => {
    setSelectedVerifier(id);
    setLoadingLogs(true);
    api
      .getVerifierLogs(id)
      .then((res) => setVerifierLogs(res.logs))
      .catch(() => setVerifierLogs([]))
      .finally(() => setLoadingLogs(false));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.importExcel(file, { exclude2024, excludeDummies });
      setImportResult({ type: 'success', message: res.message });
      onDatasetUpdated();
      load();
    } catch (err: any) {
      setImportResult({ type: 'error', message: err.message || 'Gagal mengimpor file Excel.' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const chartData = verifiers
    .filter((v) => v.totalSlaVerif >= 10 && v.avgSlaDays != null)
    .slice(0, 12)
    .map((v) => ({
      id: v.verifierId,
      avgDays: Number(v.avgSlaDays.toFixed(2)),
      volume: v.totalSlaVerif,
      bidang: v.bidangUtama,
    }));

  return (
    <div className="space-y-5">
      {/* Local SQLite DB & Excel Import/Export Management Panel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2744]/8 text-[#0F2744] dark:bg-sky-950/60 dark:text-sky-300">
                <Database className="size-4" />
              </div>
              <div>
                <CardTitle>
                  {getRuntimeMode() === 'server'
                    ? 'Status Database SQLite Lokal'
                    : 'Status Penyimpanan Browser (IndexedDB)'}
                </CardTitle>
                <CardDescription>
                  {getRuntimeMode() === 'server' ? (
                    <>
                      Tersimpan aman dalam satu file lokal <code className="font-mono-data">data/sla_rekanan.db</code>
                    </>
                  ) : (
                    '100% tersimpan lokal di IndexedDB browser Anda — tanpa pengiriman data ke server'
                  )}
                </CardDescription>
              </div>
            </div>
            <Badge tone="emerald">{formatBytes(dbSizeBytes)}</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500">Baris Mentah Excel</div>
                <div className="font-mono-data mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                  {formatNumber(Number(datasetMeta.rawRows || 0))}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500">Log Bersih Tersimpan</div>
                <div className="font-mono-data mt-0.5 text-base font-bold text-teal-700 dark:text-teal-400">
                  {formatNumber(Number(datasetMeta.cleanLogs || 0))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5 rounded-lg border border-slate-100 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
              <div className="flex justify-between">
                <span>File Sumber Terakhir</span>
                <span className="font-mono-data font-medium truncate max-w-[200px]" title={datasetMeta.sourceFile}>
                  {datasetMeta.sourceFile || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>ID Dummy Dibersihkan</span>
                <span className="font-mono-data font-medium">
                  {datasetMeta.dummyIdsRemoved || 0} ID ({datasetMeta.dummyRowsRemoved || 0} baris)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Duplikat Menit Dihapus</span>
                <span className="font-mono-data font-medium">{formatNumber(Number(datasetMeta.duplicatesRemoved || 0))} baris</span>
              </div>
              <div className="flex justify-between">
                <span>Vendor Pre-2025 Dikecualikan</span>
                <span className="font-mono-data font-medium">{formatNumber(Number(datasetMeta.vendors2024Excluded || 0))} rekanan</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => api.downloadVendorsExcel(filters)}
                disabled={Number(datasetMeta.cleanVendors || 0) === 0}
                className="flex-1"
              >
                <Download className="size-3.5" />
                Unduh Laporan Siklus Rekanan (.xlsx)
              </Button>
              {getRuntimeMode() === 'browser' && Number(datasetMeta.cleanVendors || 0) > 0 && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={async () => {
                    await api.clearBrowserData();
                    onDatasetUpdated();
                    load();
                  }}
                  title="Hapus cache data dari IndexedDB browser"
                >
                  Hapus Cache
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <Upload className="size-4" />
              </div>
              <div>
                <CardTitle>Impor File Excel History Registrasi Baru (.xlsx)</CardTitle>
                <CardDescription>
                  Perbarui database SQLite lokal langsung dari file ekspor terbaru tanpa mengubah rumus Excel secara manual
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exclude2024}
                  onChange={(e) => setExclude2024(e.target.checked)}
                  className="size-3.5 rounded accent-[#0F2744]"
                />
                Hanya rekanan mulai 2025+ (standar laporan SLA)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeDummies}
                  onChange={(e) => setExcludeDummies(e.target.checked)}
                  className="size-3.5 rounded accent-[#0F2744]"
                />
                Otomatis bersihkan 18 ID Dummy / Testing
              </label>
            </div>

            <label
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-7 text-center transition-colors cursor-pointer hover:border-[#0F2744] hover:bg-slate-100/60 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-sky-500',
                importing && 'pointer-events-none opacity-60'
              )}
            >
              <Upload className="size-6 text-slate-400" />
              <span className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {importing ? 'Memproses & mengindeks ke SQLite...' : 'Klik untuk memilih file history_registrasi_rekanan*.xlsx'}
              </span>
              <span className="mt-1 text-[11px] text-slate-500">
                Mendukung format ekspor mentah maupun sheet Log Registrasi (maks. 50 MB)
              </span>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={importing} />
            </label>

            {importResult && (
              <div
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-xs',
                  importResult.type === 'success'
                    ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                )}
              >
                {importResult.type === 'success' ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0" />
                )}
                <span>{importResult.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verifier Performance Chart + Table */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Rata-rata SLA Verifikator Teraktif (Hari)</CardTitle>
              <CardDescription>12 verifikator dengan volume verifikasi tertinggi dibanding target 3 hari</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="id" interval={0} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} unit="h" />
                  <Tooltip
                    formatter={(val: any, _n: string, props: any) => [
                      `${formatDecimal(Number(val), 2)} hari (${formatNumber(props?.payload?.volume)} verifikasi · ${props?.payload?.bidang})`,
                      'Rata-rata SLA',
                    ]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <ReferenceLine y={3} stroke="#0D9488" strokeDasharray="4 4" />
                  <Bar dataKey="avgDays" name="Rata-rata SLA (Hari)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.id}
                        fill={entry.avgDays <= 3 ? '#0D9488' : entry.avgDays > 7 ? '#E11D48' : '#0F2744'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verifiers Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-3.5 dark:border-slate-800">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <UserCheck className="size-4" />
            </div>
            <div>
              <CardTitle>Ringkasan Kinerja SLA Verifikator ({verifiers.length} User)</CardTitle>
              <CardDescription>Klik baris verifikator untuk melihat 100 aktivitas verifikasi terakhir</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              ariaLabel="Filter Bidang Verifikator"
              value={bidangFilter}
              onValueChange={setBidangFilter}
              options={[
                { value: 'ALL', label: 'Semua Bidang' },
                { value: 'Teknik', label: 'Teknik' },
                { value: 'Keuangan', label: 'Keuangan' },
                { value: 'Legal', label: 'Legal' },
                { value: 'BIM', label: 'BIM' },
                { value: 'CQSMS/QHSSE', label: 'CQSMS/QHSSE' },
                { value: 'Final Approval', label: 'Final Approval' },
              ]}
            />
            <FilterSelect
              ariaLabel="Minimal Log Verifikator"
              value={minLogs}
              onValueChange={setMinLogs}
              options={[
                { value: '1', label: 'Min. 1 Log' },
                { value: '5', label: 'Min. 5 Log' },
                { value: '25', label: 'Min. 25 Log' },
                { value: '100', label: 'Min. 100 Log' },
              ]}
            />
          </div>
        </CardHeader>

        {error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <th className="px-4 py-2.5">ID Verifikator</th>
                  <th className="px-3 py-2.5">Bidang Utama</th>
                  <th className="px-3 py-2.5 text-right">Total Log Int.</th>
                  <th className="px-3 py-2.5 text-right">SLA Verif</th>
                  <th className="px-3 py-2.5 text-right">Avg SLA (Hari)</th>
                  <th className="px-3 py-2.5 text-right">Selesai ≤ 3h</th>
                  <th className="px-3 py-2.5">Kepatuhan ≤ 3 Hari</th>
                  <th className="px-4 py-2.5 text-right">Rasio Approve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {verifiers.map((v) => {
                  const pct = v.slaComplianceRate != null ? v.slaComplianceRate * 100 : 0;
                  return (
                    <tr
                      key={v.verifierId}
                      onClick={() => openVerifierLogs(v.verifierId)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                        selectedVerifier === v.verifierId && 'bg-blue-50/60 dark:bg-blue-950/30'
                      )}
                    >
                      <td className="font-mono-data px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                        {v.verifierId}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone="neutral">{v.bidangUtama}</Badge>
                      </td>
                      <td className="font-mono-data px-3 py-2.5 text-right">{formatNumber(v.totalInternalLogs)}</td>
                      <td className="font-mono-data px-3 py-2.5 text-right font-semibold">{formatNumber(v.totalSlaVerif)}</td>
                      <td
                        className={cn(
                          'font-mono-data px-3 py-2.5 text-right font-bold',
                          v.avgSlaDays != null && v.avgSlaDays <= 3
                            ? 'text-teal-700 dark:text-teal-400'
                            : v.avgSlaDays != null && v.avgSlaDays > 7
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-slate-100'
                        )}
                      >
                        {v.avgSlaDays != null ? formatDaysSmart(v.avgSlaDays) : '—'}
                      </td>
                      <td className="font-mono-data px-3 py-2.5 text-right">{formatNumber(v.within3Days)}</td>
                      <td className="px-3 py-2.5 min-w-[150px]">
                        {v.slaComplianceRate != null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  pct >= 70 ? 'bg-teal-600' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                )}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="font-mono-data w-10 text-right text-[11px] font-semibold">
                              {formatPercent(v.slaComplianceRate, 0)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="font-mono-data px-4 py-2.5 text-right">
                        {v.approveRate != null ? formatPercent(v.approveRate) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Selected Verifier Recent Logs Panel */}
      {selectedVerifier && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <CardTitle>
                100 Aktivitas Terakhir Verifikator <span className="font-mono-data">{selectedVerifier}</span>
              </CardTitle>
              <CardDescription>Klik nama rekanan untuk membuka detail siklus lengkap rekanan tersebut</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedVerifier(null)}>
              <X className="size-3.5" />
              Tutup
            </Button>
          </CardHeader>
          {loadingLogs ? (
            <TableSkeleton rows={5} />
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 dark:border-slate-700">
                    <th className="px-4 py-2">Waktu</th>
                    <th className="px-3 py-2">Rekanan</th>
                    <th className="px-3 py-2">Bidang &amp; Aktivitas</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-4 py-2 text-right">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {verifierLogs.map((l) => (
                    <tr
                      key={l.seq_no}
                      onClick={() => onSelectVendor(l.id_vendor)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="font-mono-data whitespace-nowrap px-4 py-2 text-[11px] text-slate-500">
                        {l.waktu_display}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">
                        <span className="inline-flex items-center gap-1">
                          {l.nama_perusahaan}
                          <ExternalLink className="size-3 text-slate-400" />
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{l.tipe_activity}</span>
                        <span className="ml-1.5 text-[11px] text-slate-500">({l.bidang})</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={l.status === 2 ? 'rose' : 'emerald'}>{l.hasil_status}</Badge>
                      </td>
                      <td className="font-mono-data whitespace-nowrap px-4 py-2 text-right font-semibold">
                        {l.sla_days != null ? formatDaysSmart(l.sla_days) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
