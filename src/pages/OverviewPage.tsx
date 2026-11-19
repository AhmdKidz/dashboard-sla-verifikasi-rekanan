import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  ReferenceLine,
} from 'recharts';
import {
  Users,
  CheckCircle2,
  Clock,
  RefreshCcw,
  AlertTriangle,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { api, type GlobalFilters, type VendorRow } from '@/lib/api';
import {
  formatDaysSmart,
  formatDecimal,
  formatDeltaDays,
  formatMonthShort,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import { ChartSkeleton, ErrorState, KpiSkeletonGrid } from '@/components/StateViews';
import type { NavPage } from '@/components/Layout';
import { cn } from '@/lib/utils';

export function OverviewPage({
  filters,
  onSelectVendor,
  onNavigate,
  onQuickFilterQueue,
}: {
  filters: GlobalFilters;
  onSelectVendor: (idVendor: number) => void;
  onNavigate: (page: NavPage) => void;
  onQuickFilterQueue: (tindakLanjut: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [leaders, setLeaders] = useState<{ buFastest: VendorRow[]; mandorFastest: VendorRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<'monthly' | 'quarterly'>('monthly');

  const fetchAll = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getOverview(filters),
      api.getLeaderboard({ limit: 5, divisi: filters.divisi }),
    ])
      .then(([ov, lb]) => {
        setData(ov);
        setLeaders({ buFastest: lb.buFastest, mandorFastest: lb.mandorFastest });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, [filters.tipe, filters.divisi, filters.periode]);

  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <KpiSkeletonGrid count={6} />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <ChartSkeleton height="h-80" />
          </div>
          <div className="xl:col-span-4">
            <ChartSkeleton height="h-80" />
          </div>
        </div>
      </div>
    );
  }

  const vs = data.vendorSummary;
  const ls = data.logSummary;
  const lulusRate = vs.totalVendors > 0 ? vs.totalLulus / vs.totalVendors : 0;
  const verifSlaCompliance = ls.countSlaVerif > 0 ? ls.countVerifUnder3d / ls.countSlaVerif : 0;
  const verifDelta =
    ls.avgVerifAfterOct != null && ls.avgVerifBeforeOct != null
      ? ls.avgVerifAfterOct - ls.avgVerifBeforeOct
      : null;

  const bidangChartData = (data.bidangSummary || [])
    .filter((b: any) => ['Teknik', 'Keuangan', 'Legal', 'BIM', 'CQSMS/QHSSE'].includes(b.bidang))
    .map((b: any) => ({
      bidang: b.bidang,
      verifikator: Number((b.avgSlaVerif || 0).toFixed(2)),
      rekanan: Number((b.avgSlaRekanan || 0).toFixed(2)),
      approveRate: b.countVerif > 0 ? Math.round((b.countApprove / b.countVerif) * 100) : 0,
      rejectCount: b.countReject || 0,
    }));

  const slowestBidang = [...bidangChartData].sort((a, b) => b.verifikator - a.verifikator)[0];
  const highestRejectBidang = [...bidangChartData].sort((a, b) => b.rejectCount - a.rejectCount)[0];

  const monthlyData = (data.monthlyTrend || []).map((m: any) => ({
    label: formatMonthShort(m.bulan),
    rawBulan: m.bulan,
    totalLogs: m.totalLogs,
    slaVerifikator: m.slaVerifikator != null ? Number(m.slaVerifikator.toFixed(2)) : null,
    slaRekanan: m.slaRekanan != null ? Number(m.slaRekanan.toFixed(2)) : null,
  }));

  const quarterlyData = (data.quarterly || []).map((q: any) => ({
    label: q.triwulan,
    totalLogs: q.totalLogs,
    slaVerifikator: q.slaVerifikator != null ? Number(q.slaVerifikator.toFixed(2)) : null,
    slaRekanan: q.slaRekanan != null ? Number(q.slaRekanan.toFixed(2)) : null,
    approvedCount: q.approvedCount,
    approvedPerDay: Number((q.approvedPerDay || 0).toFixed(2)),
  }));

  const activeTrend = trendMode === 'monthly' ? monthlyData : quarterlyData;

  return (
    <div className="space-y-5">
      {/* 6 Headline KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {/* KPI 1 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Rekanan Terdaftar
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0F2744]/8 text-[#0F2744] dark:bg-sky-950/60 dark:text-sky-300">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono-data text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber(vs.totalVendors)}
            </span>
            <span className="font-mono-data text-xs text-slate-500 dark:text-slate-400">
              {formatNumber(ls.totalLogs)} log bersih
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Badan Usaha: <strong className="font-mono-data text-slate-900 dark:text-slate-200">{formatNumber(vs.totalBadanUsaha)}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span>
              Mandor: <strong className="font-mono-data text-slate-900 dark:text-slate-200">{formatNumber(vs.totalMandor)}</strong>
            </span>
          </div>
        </Card>

        {/* KPI 2 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Lulus Terseleksi (Approved Penuh)
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono-data text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber(vs.totalLulus)}
            </span>
            <Badge tone="emerald">{formatPercent(lulusRate)} kelulusan</Badge>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${Math.min(100, lulusRate * 100)}%` }}
            />
          </div>
        </Card>

        {/* KPI 3 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Dalam Proses &amp; Antrean Aktif
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono-data text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber((vs.totalAntreanVerif || 0) + (vs.totalRevisiRekanan || 0))}
            </span>
            <span className="font-mono-data text-xs text-rose-600 dark:text-rose-400">
              {formatNumber(vs.stagnantOver30)} stagnan &gt;30h
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <button
              onClick={() => onQuickFilterQueue('Antrean di Verifikator')}
              className="hover:underline cursor-pointer"
            >
              Verifikator: <strong className="font-mono-data text-blue-700 dark:text-blue-400">{formatNumber(vs.totalAntreanVerif)}</strong>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => onQuickFilterQueue('Revisi di Rekanan')}
              className="hover:underline cursor-pointer"
            >
              Revisi: <strong className="font-mono-data text-amber-700 dark:text-amber-400">{formatNumber(vs.totalRevisiRekanan)}</strong>
            </button>
          </div>
        </Card>

        {/* KPI 4 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Rata-rata SLA Verifikator
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono-data text-2xl font-bold text-slate-900 dark:text-white">
              {formatDecimal(ls.avgSlaVerif, 2)} <span className="text-sm font-semibold text-slate-500">hari</span>
            </span>
            {verifDelta !== null && (
              <Badge tone={verifDelta <= 0 ? 'emerald' : 'rose'}>
                {verifDelta <= 0 ? <TrendingDown className="size-3" /> : <TrendingUp className="size-3" />}
                {formatDeltaDays(verifDelta)} Okt 26
              </Badge>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Kepatuhan ≤ 3 hari:{' '}
            <strong className="font-mono-data text-slate-900 dark:text-slate-200">
              {formatPercent(verifSlaCompliance)}
            </strong>{' '}
            ({formatNumber(ls.countVerifUnder3d)}/{formatNumber(ls.countSlaVerif)})
          </div>
        </Card>

        {/* KPI 5 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Rata-rata SLA Revisi Rekanan
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              <RefreshCcw className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono-data text-2xl font-bold text-slate-900 dark:text-white">
              {formatDecimal(ls.avgSlaRekanan, 2)} <span className="text-sm font-semibold text-slate-500">hari</span>
            </span>
            <Badge tone="amber">Bottleneck Utama</Badge>
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Rata-rata <strong className="font-mono-data text-slate-900 dark:text-slate-200">{formatDecimal(vs.avgRejectPerVendor, 1)}</strong> reject &amp;{' '}
            <strong className="font-mono-data text-slate-900 dark:text-slate-200">{formatDecimal(vs.avgRevisionPerVendor, 1)}</strong> revisi/rekanan
          </div>
        </Card>

        {/* KPI 6 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Durasi Siklus End-to-End (Lulus)
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="font-mono-data text-2xl font-bold text-slate-900 dark:text-white">
              {formatDecimal(vs.avgCycleApprovedDays, 1)} <span className="text-sm font-semibold text-slate-500">hari</span>
            </span>
            <span className="font-mono-data text-xs text-slate-500 dark:text-slate-400">
              Semua: {formatDecimal(vs.avgCycleAllDays, 1)}h
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            Rentang:{' '}
            <strong className="font-mono-data text-teal-700 dark:text-teal-400">
              {formatDaysSmart(vs.minCycleApprovedDays)}
            </strong>{' '}
            s.d.{' '}
            <strong className="font-mono-data text-rose-600 dark:text-rose-400">
              {formatDaysSmart(vs.maxCycleDays)}
            </strong>
          </div>
        </Card>
      </div>

      {/* Real Operational Alert Strip */}
      {(slowestBidang || highestRejectBidang) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {slowestBidang && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200/80 bg-rose-50/60 px-4 py-3 text-xs dark:border-rose-900/50 dark:bg-rose-950/25">
              <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="text-slate-700 dark:text-slate-200">
                <strong>Bidang Terlama:</strong> Verifikasi <strong>{slowestBidang.bidang}</strong> rata-rata{' '}
                <span className="font-mono-data font-bold text-rose-700 dark:text-rose-300">
                  {formatDecimal(slowestBidang.verifikator, 2)} hari
                </span>
                .
              </div>
            </div>
          )}
          {highestRejectBidang && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/25">
              <RefreshCcw className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-slate-700 dark:text-slate-200">
                <strong>Reject Tertinggi:</strong> Bidang <strong>{highestRejectBidang.bidang}</strong> mencatat{' '}
                <span className="font-mono-data font-bold text-amber-800 dark:text-amber-300">
                  {formatNumber(highestRejectBidang.rejectCount)} reject
                </span>{' '}
                (approve {highestRejectBidang.approveRate}%).
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/60 px-4 py-3 text-xs dark:border-blue-900/50 dark:bg-blue-950/25">
            <div className="text-slate-700 dark:text-slate-200">
              <strong>Final Approval:</strong> Rata-rata{' '}
              <span className="font-mono-data font-bold text-blue-800 dark:text-blue-300">
                {formatDecimal(ls.avgSlaFinalAppr, 2)} hari
              </span>{' '}
              setelah bidang selesai.
            </div>
            <button
              onClick={() => onNavigate('divisions')}
              className="shrink-0 font-semibold text-blue-700 hover:underline cursor-pointer dark:text-blue-300"
            >
              Cek Antrean →
            </button>
          </div>
        </div>
      )}

      {/* Row 2: Asymmetric Bento — Monthly/Quarterly Trend (8 cols) + Queue Donut (4 cols) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader>
            <div>
              <CardTitle>Tren Volume Aktivitas vs SLA Verifikator &amp; Revisi Rekanan</CardTitle>
              <CardDescription>
                Komparasi beban log verifikasi terhadap durasi respons tim internal vs revisi rekanan (hari)
              </CardDescription>
            </div>
            <Tabs value={trendMode} onValueChange={(v) => setTrendMode(v as 'monthly' | 'quarterly')}>
              <TabsList>
                <TabsTrigger value="monthly">Bulanan (23 Bln)</TabsTrigger>
                <TabsTrigger value="quarterly">Triwulanan</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="h-[310px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activeTrend} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    unit="h"
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                    }}
                    formatter={(val: any, name: string) => {
                      if (name === 'Volume Log') return [formatNumber(Number(val)), name];
                      return [`${formatDecimal(Number(val), 2)} hari`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar
                    yAxisId="right"
                    dataKey="totalLogs"
                    name="Volume Log"
                    fill="#CBD5E1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="slaVerifikator"
                    name="SLA Verifikator"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="slaRekanan"
                    name="Revisi Rekanan"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4 flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Distribusi Status &amp; Antrean Rekanan</CardTitle>
              <CardDescription>Klik kategori untuk langsung melacak daftar rekanan</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between">
            <div className="relative h-[205px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.queueDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={2}
                    isAnimationActive={false}
                    onClick={(entry) => entry?.name && onQuickFilterQueue(entry.name)}
                    className="cursor-pointer outline-none"
                  >
                    {data.queueDistribution.map((entry: any) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: string) => [
                      `${formatNumber(Number(val))} rekanan (${formatPercent(
                        vs.totalVendors > 0 ? Number(val) / vs.totalVendors : 0
                      )})`,
                      name,
                    ]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono-data text-2xl font-bold text-slate-900 dark:text-white">
                  {formatNumber(vs.totalVendors)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Rekanan</span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {data.queueDistribution.map((q: any) => {
                const pct = vs.totalVendors > 0 ? q.value / vs.totalVendors : 0;
                return (
                  <button
                    key={q.name}
                    onClick={() => onQuickFilterQueue(q.name)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs transition-colors hover:bg-slate-50 cursor-pointer dark:border-slate-800 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: q.color }} />
                      <span className="font-medium text-slate-700 dark:text-slate-200">{q.name}</span>
                    </div>
                    <div className="font-mono-data flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(q.value)}</span>
                      <span className="w-11 text-right text-slate-500">{formatPercent(pct)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Bidang Bottleneck Chart (7 cols) + Quarterly Approved Throughput (5 cols) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Bottleneck Durasi per Bidang: Verifikator vs Revisi Rekanan</CardTitle>
              <CardDescription>
                Garis putus-putus menandai acuan target SLA 3 hari (berdasarkan pairing per-bidang)
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('analytics')}>
              Analisa Lengkap →
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bidangChartData} layout="vertical" margin={{ top: 4, right: 20, left: 12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} unit="h" axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="bidang"
                    width={96}
                    tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: any, name: string) => [`${formatDecimal(Number(val), 2)} hari`, name]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine x={3} stroke="#0D9488" strokeDasharray="4 4" label={{ value: '3h', position: 'top', fontSize: 10, fill: '#0D9488' }} />
                  <Bar dataKey="verifikator" name="SLA Verifikator" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
                  <Bar dataKey="rekanan" name="SLA Revisi Rekanan" fill="#D97706" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Output Rekanan Approved per Triwulan</CardTitle>
              <CardDescription>Total rekanan lulus penuh &amp; rata-rata kelulusan per hari efektif</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={quarterlyData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#0D9488' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(val: any, name: string) =>
                      name === 'Approved / Hari' ? [`${formatDecimal(Number(val), 2)} / hari`, name] : [`${formatNumber(Number(val))} rekanan`, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="approvedCount" name="Rekanan Approved" fill="#0F2744" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="approvedPerDay"
                    name="Approved / Hari"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    dot={{ r: 3.5 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Quick Teaser — Top 5 Tercepat Badan Usaha & Mandor */}
      {leaders && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Rekanan Badan Usaha Tercepat (Lulus Penuh)</CardTitle>
                <CardDescription>Klik baris untuk membuka timeline log lengkap rekanan</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate('leaderboard')}>
                Lihat Top 10 →
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaders.buFastest.map((v, i) => (
                  <button
                    key={v.id_vendor}
                    onClick={() => onSelectVendor(v.id_vendor)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          'font-mono-data flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                          i === 0
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {v.nama_perusahaan}
                        </div>
                        <div className="font-mono-data text-[11px] text-slate-500">
                          ID {v.id_vendor} · {v.total_logs} log · {v.divisi}
                        </div>
                      </div>
                    </div>
                    <Badge tone="emerald" className="font-mono-data shrink-0">
                      {formatDaysSmart(v.clean_pass_dur_days ?? v.dur_days)}
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Rekanan Mandor Tercepat (Lulus Penuh)</CardTitle>
                <CardDescription>Klik baris untuk menelusuri jarak antar-log mandor</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate('leaderboard')}>
                Lihat Top 10 →
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaders.mandorFastest.map((v, i) => (
                  <button
                    key={v.id_vendor}
                    onClick={() => onSelectVendor(v.id_vendor)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          'font-mono-data flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
                          i === 0
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {v.nama_perusahaan}
                        </div>
                        <div className="font-mono-data text-[11px] text-slate-500">
                          ID {v.id_vendor} · {v.total_logs} log · {v.revision_count} revisi
                        </div>
                      </div>
                    </div>
                    <Badge tone="emerald" className="font-mono-data shrink-0">
                      {formatDaysSmart(v.clean_pass_dur_days ?? v.dur_days)}
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
