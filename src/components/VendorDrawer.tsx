import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Download,
  Clock,
  Building2,
  HardHat,
  CheckCircle2,
  XCircle,
  AlertCircle,
  GitCommitHorizontal,
  ArrowRight,
  Layers,
  List,
  GitBranch,
} from 'lucide-react';
import { api, type LogRow, type VendorRow } from '@/lib/api';
import { formatDaysSmart, formatDecimal, formatDurationDetailed, formatNumber } from '@/lib/format';
import { Badge, Button, Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives';
import { ErrorState } from '@/components/StateViews';
import { cn } from '@/lib/utils';

type DetailData = Awaited<ReturnType<typeof api.getVendorDetail>>;

export function StatusPill({ status }: { status: VendorRow['tindak_lanjut'] | string }) {
  if (status === 'Lulus Terseleksi') {
    return (
      <Badge tone="emerald">
        <CheckCircle2 className="size-3" />
        Lulus Terseleksi
      </Badge>
    );
  }
  if (status === 'Antrean di Verifikator') {
    return (
      <Badge tone="cobalt">
        <Clock className="size-3" />
        Antrean di Verifikator
      </Badge>
    );
  }
  return (
    <Badge tone="amber">
      <AlertCircle className="size-3" />
      Revisi di Rekanan
    </Badge>
  );
}

export function TipePill({ tipe }: { tipe: string }) {
  if (tipe === 'Mandor') {
    return (
      <Badge tone="amber">
        <HardHat className="size-3" />
        Mandor
      </Badge>
    );
  }
  return (
    <Badge tone="navy">
      <Building2 className="size-3" />
      Badan Usaha
    </Badge>
  );
}

function kategoriTone(kat: string) {
  if (kat === 'SLA Verifikator') return 'cobalt' as const;
  if (kat === 'SLA Rekanan' || kat === 'Aktivitas Rekanan') return 'amber' as const;
  if (kat === 'SLA Final Approval' || kat === 'Internal Approval Bidang') return 'emerald' as const;
  if (kat === 'Internal Review') return 'rose' as const;
  return 'neutral' as const;
}

export function VendorDrawer({
  vendorId,
  onClose,
}: {
  vendorId: number | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gapMode, setGapMode] = useState<'paired' | 'chrono'>('paired');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [bidangFilter, setBidangFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | '1' | '2'>('ALL');

  const loadDetail = (id: number) => {
    setLoading(true);
    setError(null);
    api
      .getVendorDetail(id)
      .then((res) => {
        setData(res);
        setBidangFilter('ALL');
        setStatusFilter('ALL');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (vendorId !== null) loadDetail(vendorId);
    else setData(null);
  }, [vendorId]);

  const filteredLogs: LogRow[] = (data?.logs || []).filter((l) => {
    if (bidangFilter !== 'ALL' && l.bidang !== bidangFilter) return false;
    if (statusFilter !== 'ALL' && String(l.status) !== statusFilter) return false;
    return true;
  });

  const totalSlaSum = data
    ? data.vendor.verif_sla_days + data.vendor.rekanan_sla_days + data.vendor.internal_sla_days
    : 0;
  const verifPct = totalSlaSum > 0 && data ? (data.vendor.verif_sla_days / totalSlaSum) * 100 : 0;
  const rekPct = totalSlaSum > 0 && data ? (data.vendor.rekanan_sla_days / totalSlaSum) * 100 : 0;
  const intPct = totalSlaSum > 0 && data ? (data.vendor.internal_sla_days / totalSlaSum) * 100 : 0;

  return (
    <Dialog.Root open={vendorId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[1px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-4xl flex-col border-l border-slate-200 bg-[#F6F7F9] shadow-2xl focus:outline-none dark:border-slate-800 dark:bg-[#0B1120]"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-bold text-slate-900 dark:text-white">
                {loading && !data ? 'Memuat Detail Rekanan...' : data?.vendor.nama_perusahaan || 'Detail Rekanan'}
              </Dialog.Title>
              {data && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono-data rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    ID {data.vendor.id_vendor}
                  </span>
                  <TipePill tipe={data.vendor.tipe_rekanan} />
                  <StatusPill status={data.vendor.tindak_lanjut} />
                  <Badge tone="neutral">{data.vendor.divisi}</Badge>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {data && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => api.downloadVendorDetailExcel(data.vendor.id_vendor)}
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Ekspor Log (.xlsx)</span>
                </Button>
              )}
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Tutup panel detail rekanan">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading && !data && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            )}

            {error && vendorId !== null && (
              <ErrorState
                title="Gagal memuat riwayat log rekanan"
                message={error}
                onRetry={() => loadDetail(vendorId)}
              />
            )}

            {data && (
              <>
                {/* Headline Metrics */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Total Durasi Siklus
                    </div>
                    <div className="font-mono-data mt-1 text-lg font-bold text-slate-900 dark:text-white">
                      {formatDaysSmart(data.vendor.dur_days)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDecimal(data.vendor.dur_hours, 1)} jam end-to-end
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Aktivitas &amp; Revisi
                    </div>
                    <div className="font-mono-data mt-1 text-lg font-bold text-slate-900 dark:text-white">
                      {formatNumber(data.vendor.total_logs)} log
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {data.vendor.reject_count} reject · {data.vendor.revision_count} revisi
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Rentang Tanggal
                    </div>
                    <div className="font-mono-data mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                      {data.vendor.start_iso}
                    </div>
                    <div className="font-mono-data mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      s.d. {data.vendor.end_iso}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {data.vendor.tindak_lanjut === 'Lulus Terseleksi' ? 'Siklus Bersih Lulus' : 'Aging Antrean'}
                    </div>
                    <div
                      className={cn(
                        'font-mono-data mt-1 text-lg font-bold',
                        data.vendor.tindak_lanjut === 'Lulus Terseleksi'
                          ? 'text-teal-700 dark:text-teal-400'
                          : data.vendor.aging_days > 30
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {data.vendor.tindak_lanjut === 'Lulus Terseleksi'
                        ? formatDaysSmart(data.vendor.clean_pass_dur_days ?? data.vendor.dur_days)
                        : formatDaysSmart(data.vendor.aging_days)}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400" title={data.vendor.last_act}>
                      Terakhir: {data.vendor.last_act}
                    </div>
                  </div>
                </div>

                {/* Time Split Bar + Largest Gap Callout */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <span>Proporsi Akumulasi Waktu (Per-Bidang)</span>
                      <span className="font-mono-data text-slate-500">{formatDaysSmart(totalSlaSum)} total</span>
                    </div>
                    <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div style={{ width: `${verifPct}%` }} className="bg-blue-600" title={`SLA Verifikator: ${formatDaysSmart(data.vendor.verif_sla_days)}`} />
                      <div style={{ width: `${rekPct}%` }} className="bg-amber-500" title={`SLA Rekanan: ${formatDaysSmart(data.vendor.rekanan_sla_days)}`} />
                      <div style={{ width: `${intPct}%` }} className="bg-teal-600" title={`Internal Approval: ${formatDaysSmart(data.vendor.internal_sla_days)}`} />
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="inline-block size-2 rounded-full bg-blue-600 mr-1.5" />
                        <span className="text-slate-500 dark:text-slate-400">Verifikator</span>
                        <div className="font-mono-data font-semibold text-slate-900 dark:text-slate-100">
                          {formatDaysSmart(data.vendor.verif_sla_days)}
                        </div>
                      </div>
                      <div>
                        <span className="inline-block size-2 rounded-full bg-amber-500 mr-1.5" />
                        <span className="text-slate-500 dark:text-slate-400">Revisi Rekanan</span>
                        <div className="font-mono-data font-semibold text-slate-900 dark:text-slate-100">
                          {formatDaysSmart(data.vendor.rekanan_sla_days)}
                        </div>
                      </div>
                      <div>
                        <span className="inline-block size-2 rounded-full bg-teal-600 mr-1.5" />
                        <span className="text-slate-500 dark:text-slate-400">Internal/Final</span>
                        <div className="font-mono-data font-semibold text-slate-900 dark:text-slate-100">
                          {formatDaysSmart(data.vendor.internal_sla_days)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Jeda Waktu Terlama (Bottleneck Rekanan Ini)
                    </div>
                    {data.highlights.maxPairedGap ? (
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                          <div className="min-w-0 pr-2">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Pairing Per-Bidang ({data.highlights.maxPairedGap.bidang} · {data.highlights.maxPairedGap.kategori})
                            </div>
                            <div className="truncate font-medium text-slate-800 dark:text-slate-200">
                              {data.highlights.maxPairedGap.fromAct} → {data.highlights.maxPairedGap.toAct}
                            </div>
                          </div>
                          <span className="font-mono-data shrink-0 font-bold text-rose-600 dark:text-rose-400">
                            {formatDurationDetailed(data.highlights.maxPairedGap.days)}
                          </span>
                        </div>
                        {data.highlights.maxChronoGap && (
                          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                            <div className="min-w-0 pr-2">
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Jeda Kronologis Log-ke-Log Terpanjang
                              </div>
                              <div className="truncate font-medium text-slate-800 dark:text-slate-200">
                                {data.highlights.maxChronoGap.fromAct} → {data.highlights.maxChronoGap.toAct}
                              </div>
                            </div>
                            <span className="font-mono-data shrink-0 font-bold text-slate-900 dark:text-slate-100">
                              {formatDurationDetailed(data.highlights.maxChronoGap.days)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">Hanya terdapat 1 aktivitas awal untuk rekanan ini.</p>
                    )}
                  </div>
                </div>

                {/* Per-Bidang Matrix */}
                {data.bidangBreakdown.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Ringkasan Progres &amp; Revisi Per Bidang
                      </span>
                      <span className="text-[11px] text-slate-500">Klik bidang untuk memfilter log di bawah</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <th className="px-4 py-2">Bidang</th>
                            <th className="px-3 py-2 text-right">Log</th>
                            <th className="px-3 py-2 text-right">Reject</th>
                            <th className="px-3 py-2 text-right">Revisi</th>
                            <th className="px-3 py-2 text-right">SLA Verif</th>
                            <th className="px-3 py-2 text-right">SLA Rekanan</th>
                            <th className="px-4 py-2">Status Terakhir</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {data.bidangBreakdown.map((b) => {
                            const active = bidangFilter === b.bidang;
                            return (
                              <tr
                                key={b.bidang}
                                onClick={() => setBidangFilter(active ? 'ALL' : b.bidang)}
                                className={cn(
                                  'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60',
                                  active && 'bg-blue-50/70 dark:bg-blue-950/30'
                                )}
                              >
                                <td className="px-4 py-2 font-semibold text-slate-900 dark:text-slate-100">
                                  {b.bidang}
                                </td>
                                <td className="font-mono-data px-3 py-2 text-right">{b.totalLogs}</td>
                                <td className="font-mono-data px-3 py-2 text-right">
                                  {b.rejects > 0 ? (
                                    <span className="font-semibold text-rose-600 dark:text-rose-400">{b.rejects}</span>
                                  ) : (
                                    <span className="text-slate-400">0</span>
                                  )}
                                </td>
                                <td className="font-mono-data px-3 py-2 text-right">
                                  {b.revisions > 0 ? (
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">{b.revisions}</span>
                                  ) : (
                                    <span className="text-slate-400">0</span>
                                  )}
                                </td>
                                <td className="font-mono-data px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                                  {b.verifSlaDays > 0 ? formatDaysSmart(b.verifSlaDays) : '—'}
                                </td>
                                <td className="font-mono-data px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                                  {b.rekananSlaDays > 0 ? formatDaysSmart(b.rekananSlaDays) : '—'}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={cn(
                                        'inline-block size-1.5 rounded-full',
                                        b.lastStatus === 'Approve'
                                          ? 'bg-teal-500'
                                          : b.lastStatus === 'Reject'
                                          ? 'bg-rose-500'
                                          : 'bg-slate-400'
                                      )}
                                    />
                                    <span className="truncate max-w-[180px] text-slate-700 dark:text-slate-300" title={b.lastAct}>
                                      {b.lastAct}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Log Timeline Controls */}
                <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Riwayat Log ({filteredLogs.length}/{data.logs.length})
                      </span>
                      {bidangFilter !== 'ALL' && (
                        <button
                          onClick={() => setBidangFilter('ALL')}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 cursor-pointer hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
                        >
                          Bidang: {bidangFilter} <X className="size-3" />
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        {(['ALL', '1', '2'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors',
                              statusFilter === st
                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            )}
                          >
                            {st === 'ALL' ? 'Semua Status' : st === '1' ? 'Approve' : 'Reject'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Tabs value={gapMode} onValueChange={(v) => setGapMode(v as 'paired' | 'chrono')}>
                        <TabsList>
                          <TabsTrigger value="paired">
                            <GitBranch className="size-3" />
                            Jarak Per-Bidang
                          </TabsTrigger>
                          <TabsTrigger value="chrono">
                            <GitCommitHorizontal className="size-3" />
                            Jarak Kronologis
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'timeline' | 'table')}>
                        <TabsList>
                          <TabsTrigger value="timeline" aria-label="Tampilan Timeline">
                            <Layers className="size-3" />
                          </TabsTrigger>
                          <TabsTrigger value="table" aria-label="Tampilan Tabel">
                            <List className="size-3" />
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>

                  {/* Timeline View */}
                  {viewMode === 'timeline' ? (
                    <div className="p-4">
                      {filteredLogs.length === 0 ? (
                        <p className="py-8 text-center text-xs text-slate-500">
                          Tidak ada log untuk filter bidang/status yang dipilih.
                        </p>
                      ) : (
                        <ol className="relative space-y-3 border-l border-slate-200 pl-5 ml-2 dark:border-slate-700">
                          {filteredLogs.map((l, idx) => {
                            const activeGapDays = gapMode === 'paired' ? l.sla_days : l.chrono_gap_days;
                            const activeGapHours = gapMode === 'paired' ? l.sla_hours : l.chrono_gap_hours;
                            const activePrevAct = gapMode === 'paired' ? l.paired_prev_act : l.chrono_prev_act;
                            const isSlow = activeGapDays !== null && activeGapDays > 3;
                            const isVerySlow = activeGapDays !== null && activeGapDays > 10;

                            return (
                              <li key={l.seq_no} className="relative">
                                <span
                                  className={cn(
                                    'absolute -left-[25px] top-2.5 flex size-2.5 rounded-full ring-4 ring-white dark:ring-slate-900',
                                    l.status === 2
                                      ? 'bg-rose-500'
                                      : l.tipe_activity === 'Approve Rekanan Terseleksi'
                                      ? 'bg-teal-500'
                                      : l.by_login === 1
                                      ? 'bg-amber-500'
                                      : 'bg-blue-600'
                                  )}
                                />
                                <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 dark:hover:bg-slate-800/60">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-mono-data text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                        #{idx + 1} · {l.waktu_display}
                                      </span>
                                      <Badge tone="neutral">{l.bidang}</Badge>
                                      <Badge tone={l.status === 2 ? 'rose' : l.status === 1 ? 'emerald' : 'neutral'}>
                                        {l.status === 2 ? (
                                          <XCircle className="size-3" />
                                        ) : (
                                          <CheckCircle2 className="size-3" />
                                        )}
                                        {l.hasil_status}
                                      </Badge>
                                      <Badge tone={kategoriTone(l.kategori_aktor)}>{l.kategori_aktor}</Badge>
                                    </div>

                                    {/* Time Gap Badge */}
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono-data text-[11px] text-slate-400">
                                        T+{formatDaysSmart(l.cumulative_days)}
                                      </span>
                                      {activeGapDays !== null ? (
                                        <span
                                          className={cn(
                                            'font-mono-data inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold',
                                            isVerySlow
                                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                              : isSlow
                                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                              : 'bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300'
                                          )}
                                          title={
                                            activeGapHours !== null
                                              ? `${formatDecimal(activeGapHours, 2)} jam`
                                              : undefined
                                          }
                                        >
                                          <Clock className="size-3" />Δ {formatDaysSmart(activeGapDays)}
                                        </span>
                                      ) : (
                                        <span className="font-mono-data text-[11px] text-slate-400">Titik Awal</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                                    {l.tipe_activity}
                                  </div>
                                  {l.message && (
                                    <p className="mt-0.5 text-xs text-slate-600 text-pretty dark:text-slate-300">
                                      {l.message}
                                    </p>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-1.5 text-[11px] text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                                    <span>
                                      Aktor: <strong className="font-medium text-slate-700 dark:text-slate-200">{l.aktor_login}</strong>{' '}
                                      (<span className="font-mono-data">{l.message_by || '-'}</span>)
                                    </span>
                                    {activePrevAct && activePrevAct !== '-' && (
                                      <span className="inline-flex items-center gap-1">
                                        Dari <span className="font-medium text-slate-700 dark:text-slate-200">{activePrevAct}</span>
                                        <ArrowRight className="size-3" />
                                        <span className="font-mono-data">
                                          {activeGapHours !== null ? `${formatDecimal(activeGapHours, 1)} jam` : '-'}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  ) : (
                    /* Compact Audit Table View */
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <th className="px-3 py-2">Waktu</th>
                            <th className="px-3 py-2">Bidang</th>
                            <th className="px-3 py-2">Aktivitas</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">User</th>
                            <th className="px-3 py-2">Acuan ({gapMode === 'paired' ? 'Bidang' : 'Kronologis'})</th>
                            <th className="px-3 py-2 text-right">Jarak (Jam)</th>
                            <th className="px-3 py-2 text-right">Jarak (Hari)</th>
                            <th className="px-3 py-2 text-right">Kumulatif</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredLogs.map((l) => {
                            const gH = gapMode === 'paired' ? l.sla_hours : l.chrono_gap_hours;
                            const gD = gapMode === 'paired' ? l.sla_days : l.chrono_gap_days;
                            const prevA = gapMode === 'paired' ? l.paired_prev_act : l.chrono_prev_act;
                            return (
                              <tr key={l.seq_no} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="font-mono-data whitespace-nowrap px-3 py-2 text-[11px]">{l.waktu_display}</td>
                                <td className="whitespace-nowrap px-3 py-2">{l.bidang}</td>
                                <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100" title={l.message}>
                                  {l.tipe_activity}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <Badge tone={l.status === 2 ? 'rose' : 'emerald'}>{l.hasil_status}</Badge>
                                </td>
                                <td className="font-mono-data whitespace-nowrap px-3 py-2 text-[11px]">{l.message_by}</td>
                                <td className="max-w-[160px] truncate px-3 py-2 text-[11px] text-slate-500" title={prevA}>
                                  {prevA}
                                </td>
                                <td className="font-mono-data whitespace-nowrap px-3 py-2 text-right">
                                  {gH !== null ? formatDecimal(gH, 1) : '—'}
                                </td>
                                <td
                                  className={cn(
                                    'font-mono-data whitespace-nowrap px-3 py-2 text-right font-semibold',
                                    gD !== null && gD > 10
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : gD !== null && gD > 3
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-700 dark:text-slate-200'
                                  )}
                                >
                                  {gD !== null ? formatDecimal(gD, 2) : '—'}
                                </td>
                                <td className="font-mono-data whitespace-nowrap px-3 py-2 text-right text-slate-500">
                                  +{formatDecimal(l.cumulative_days, 1)}h
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
