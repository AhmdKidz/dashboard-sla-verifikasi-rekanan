import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Calendar, ExternalLink, GitBranch, Microscope, Users } from 'lucide-react';
import { api, type GlobalFilters } from '@/lib/api';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import { ChartSkeleton, ErrorState, TableSkeleton } from '@/components/StateViews';
import { cn } from '@/lib/utils';

type StudioMode =
  | 'compare_verif'
  | 'compare_rek'
  | 'Teknik'
  | 'Keuangan'
  | 'Legal'
  | 'BIM'
  | 'CQSMS/QHSSE'
  | 'Final Approval';

const BIDANG_COLORS: Record<string, string> = {
  Teknik: '#0D9488',
  Keuangan: '#E11D48',
  Legal: '#D97706',
  BIM: '#2563EB',
  'CQSMS/QHSSE': '#7C3AED',
  'Final Approval': '#0F2744',
};

const STUDIO_TABS: { id: StudioMode; label: string }[] = [
  { id: 'compare_verif', label: 'Komparasi 6 Bidang (Verif)' },
  { id: 'compare_rek', label: 'Komparasi 5 Bidang (Revisi)' },
  { id: 'Teknik', label: 'Teknik' },
  { id: 'Keuangan', label: 'Keuangan' },
  { id: 'Legal', label: 'Legal' },
  { id: 'BIM', label: 'BIM' },
  { id: 'CQSMS/QHSSE', label: 'CQSMS' },
  { id: 'Final Approval', label: 'Final Approval' },
];

export function AnalyticsPage({
  filters,
  onSelectVendor,
}: {
  filters: GlobalFilters;
  onSelectVendor?: (idVendor: number) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studioMode, setStudioMode] = useState<StudioMode>('compare_verif');
  const [granularity, setGranularity] = useState<'quarterly' | 'monthly'>('quarterly');
  const [periodCompareTab, setPeriodCompareTab] = useState<'verif' | 'rekanan'>('verif');

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getAnalytics(filters)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filters.tipe, filters.divisi, filters.periode]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (loading || !data) {
    return (
      <div className="space-y-5">
        <ChartSkeleton height="h-80" />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ChartSkeleton height="h-72" />
          <ChartSkeleton height="h-72" />
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  const rawSeries = granularity === 'quarterly' ? data.bidangQuarterly : data.bidangMonthly;
  const studioSeries = (rawSeries || []).map((row: any) => ({
    ...row,
    xLabel: granularity === 'monthly' ? formatMonthShort(row.label) : row.label,
    teknikVerif: row.teknikVerif != null ? Number(row.teknikVerif.toFixed(2)) : null,
    teknikRek: row.teknikRek != null ? Number(row.teknikRek.toFixed(2)) : null,
    keuanganVerif: row.keuanganVerif != null ? Number(row.keuanganVerif.toFixed(2)) : null,
    keuanganRek: row.keuanganRek != null ? Number(row.keuanganRek.toFixed(2)) : null,
    legalVerif: row.legalVerif != null ? Number(row.legalVerif.toFixed(2)) : null,
    legalRek: row.legalRek != null ? Number(row.legalRek.toFixed(2)) : null,
    bimVerif: row.bimVerif != null ? Number(row.bimVerif.toFixed(2)) : null,
    bimRek: row.bimRek != null ? Number(row.bimRek.toFixed(2)) : null,
    cqsmsVerif: row.cqsmsVerif != null ? Number(row.cqsmsVerif.toFixed(2)) : null,
    cqsmsRek: row.cqsmsRek != null ? Number(row.cqsmsRek.toFixed(2)) : null,
    finalVerif: row.finalVerif != null ? Number(row.finalVerif.toFixed(2)) : null,
  }));

  const p2ChartData = (data.period2Comparison || [])
    .filter((r: any) => !['Mandor', 'Umum'].includes(r.bidang))
    .map((r: any) => ({
      bidang: r.bidang,
      before:
        periodCompareTab === 'verif'
          ? r.verifBefore != null
            ? Number(r.verifBefore.toFixed(2))
            : 0
          : r.rekBefore != null
          ? Number(r.rekBefore.toFixed(2))
          : 0,
      after:
        periodCompareTab === 'verif'
          ? r.verifAfter != null
            ? Number(r.verifAfter.toFixed(2))
            : 0
          : r.rekAfter != null
          ? Number(r.rekAfter.toFixed(2))
          : 0,
    }));

  const singleFieldKeyMap: Record<string, { v: string; r?: string }> = {
    Teknik: { v: 'teknikVerif', r: 'teknikRek' },
    Keuangan: { v: 'keuanganVerif', r: 'keuanganRek' },
    Legal: { v: 'legalVerif', r: 'legalRek' },
    BIM: { v: 'bimVerif', r: 'bimRek' },
    'CQSMS/QHSSE': { v: 'cqsmsVerif', r: 'cqsmsRek' },
    'Final Approval': { v: 'finalVerif' },
  };

  return (
    <div className="space-y-5">
      {/* Interactive Per-Bidang Trend Studio (Replaces 14 static Excel charts!) */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Studio Tren SLA Antar-Bidang (Bulanan &amp; Triwulanan)</CardTitle>
            <CardDescription>
              Pilih mode komparasi seluruh bidang atau telusuri detail Verifikator vs Revisi Rekanan tiap bidang (hari)
            </CardDescription>
          </div>
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as 'quarterly' | 'monthly')}>
            <TabsList>
              <TabsTrigger value="quarterly">Per 3 Bulan (Triwulan)</TabsTrigger>
              <TabsTrigger value="monthly">Per Bulan (23 Bln)</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {STUDIO_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStudioMode(t.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  studioMode === t.id
                    ? 'bg-[#0F2744] text-white dark:bg-sky-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={studioSeries} margin={{ top: 10, right: 16, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="xLabel" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} unit="h" />
                <Tooltip
                  formatter={(val: any, name: string) => [`${formatDecimal(Number(val), 2)} hari`, name]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <ReferenceLine y={3} stroke="#0D9488" strokeDasharray="4 4" />

                {studioMode === 'compare_verif' && [
                  <Line key="tv" type="monotone" dataKey="teknikVerif" name="Teknik" stroke={BIDANG_COLORS.Teknik} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="kv" type="monotone" dataKey="keuanganVerif" name="Keuangan" stroke={BIDANG_COLORS.Keuangan} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="lv" type="monotone" dataKey="legalVerif" name="Legal" stroke={BIDANG_COLORS.Legal} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="bv" type="monotone" dataKey="bimVerif" name="BIM" stroke={BIDANG_COLORS.BIM} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="cv" type="monotone" dataKey="cqsmsVerif" name="CQSMS/QHSSE" stroke={BIDANG_COLORS['CQSMS/QHSSE']} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="fv" type="monotone" dataKey="finalVerif" name="Final Approval" stroke={BIDANG_COLORS['Final Approval']} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                ]}

                {studioMode === 'compare_rek' && [
                  <Line key="tr" type="monotone" dataKey="teknikRek" name="Revisi Teknik" stroke={BIDANG_COLORS.Teknik} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="kr" type="monotone" dataKey="keuanganRek" name="Revisi Keuangan" stroke={BIDANG_COLORS.Keuangan} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="lr" type="monotone" dataKey="legalRek" name="Revisi Legal" stroke={BIDANG_COLORS.Legal} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="br" type="monotone" dataKey="bimRek" name="Revisi BIM" stroke={BIDANG_COLORS.BIM} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                  <Line key="cr" type="monotone" dataKey="cqsmsRek" name="Revisi CQSMS" stroke={BIDANG_COLORS['CQSMS/QHSSE']} strokeWidth={2.2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />,
                ]}

                {studioMode !== 'compare_verif' && studioMode !== 'compare_rek' && singleFieldKeyMap[studioMode] && (
                  <Line
                    key="sv"
                    type="monotone"
                    dataKey={singleFieldKeyMap[studioMode].v}
                    name={`SLA Verifikator (${studioMode})`}
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 3.5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
                {studioMode !== 'compare_verif' &&
                  studioMode !== 'compare_rek' &&
                  singleFieldKeyMap[studioMode]?.r && (
                    <Line
                      key="sr"
                      type="monotone"
                      dataKey={singleFieldKeyMap[studioMode].r}
                      name={`SLA Revisi Rekanan (${studioMode})`}
                      stroke="#D97706"
                      strokeWidth={2.5}
                      dot={{ r: 3.5 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Row 2: Before vs After Oct 2026 + 3-Periode Summary */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <CardHeader>
            <div>
              <CardTitle>Evaluasi Sebelum vs Sesudah Oktober 2026</CardTitle>
              <CardDescription>Perbandingan durasi SLA per bidang (Hari)</CardDescription>
            </div>
            <Tabs value={periodCompareTab} onValueChange={(v) => setPeriodCompareTab(v as 'verif' | 'rekanan')}>
              <TabsList>
                <TabsTrigger value="verif">SLA Verifikator</TabsTrigger>
                <TabsTrigger value="rekanan">Revisi Rekanan</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={p2ChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="bidang" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} unit="h" />
                  <Tooltip
                    formatter={(val: any, name: string) => [`${formatDecimal(Number(val), 2)} hari`, name]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="before" name="Sebelum Okt 2026" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  <Bar
                    dataKey="after"
                    name="Okt 2026 – Skrg"
                    fill={periodCompareTab === 'verif' ? '#2563EB' : '#D97706'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Compact Delta Badges */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(data.period2Comparison || [])
                .filter((r: any) => ['Teknik', 'Keuangan', 'Legal', 'BIM', 'Final Approval'].includes(r.bidang))
                .map((r: any) => (
                  <div
                    key={r.bidang}
                    className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{r.bidang}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono-data text-[11px] text-slate-500">
                        {formatDecimal(r.verifBefore, 1)}→{formatDecimal(r.verifAfter, 1)}h
                      </span>
                      <Badge tone={r.deltaVerif != null && r.deltaVerif <= 0 ? 'emerald' : 'rose'}>
                        {formatDeltaDays(r.deltaVerif)}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 3-Periode Waktu Comparison Table */}
        <Card className="xl:col-span-6 overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Evaluasi 3 Periode Waktu (Jan 2025 – 10 Nov 2026)</CardTitle>
              <CardDescription>Evolusi kecepatan verifikasi, revisi rekanan &amp; laju kelulusan per hari</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <th className="px-4 py-2.5">Periode</th>
                    <th className="px-3 py-2.5 text-right">Log</th>
                    <th className="px-3 py-2.5 text-right">SLA Verif</th>
                    <th className="px-3 py-2.5 text-right">SLA Rekanan</th>
                    <th className="px-3 py-2.5 text-right">Approved</th>
                    <th className="px-4 py-2.5 text-right">Appr/Hari</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data.period3Summary || []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{p.id}</div>
                        <div className="text-[11px] text-slate-500">{p.label} ({p.effectiveDays}h)</div>
                      </td>
                      <td className="font-mono-data px-3 py-3 text-right">{formatNumber(p.totalLogs)}</td>
                      <td className="font-mono-data px-3 py-3 text-right font-semibold text-blue-700 dark:text-blue-400">
                        {formatDecimal(p.slaVerif, 2)}h
                      </td>
                      <td className="font-mono-data px-3 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">
                        {formatDecimal(p.slaRekanan, 2)}h
                      </td>
                      <td className="font-mono-data px-3 py-3 text-right font-semibold text-teal-700 dark:text-teal-400">
                        {formatNumber(p.approvedCount)}
                      </td>
                      <td className="font-mono-data px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatDecimal(p.approvedPerDay, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Status 1 (Approve) vs Status 2 (Reject) Matrix */}
            <div className="border-t border-slate-200 px-4 pt-4 pb-2 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Distribusi Status Approve (St=1) vs Reject (St=2) per Kategori Aktor
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                    <th className="px-4 py-2">Kategori Aktor SLA</th>
                    <th className="px-2.5 py-2 text-right">Log</th>
                    <th className="px-2.5 py-2 text-right">Approve</th>
                    <th className="px-2.5 py-2 text-right">Reject</th>
                    <th className="px-2.5 py-2 text-right">SLA Appr</th>
                    <th className="px-4 py-2 text-right">SLA Rej</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(data.statusMatrix || []).map((s: any) => (
                    <tr key={s.kategori} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{s.kategori}</td>
                      <td className="font-mono-data px-2.5 py-2 text-right">{formatNumber(s.totalLogs)}</td>
                      <td className="font-mono-data px-2.5 py-2 text-right text-teal-700 dark:text-teal-400">
                        {formatNumber(s.countApprove)}
                      </td>
                      <td className="font-mono-data px-2.5 py-2 text-right text-rose-600 dark:text-rose-400">
                        {formatNumber(s.countReject)}
                      </td>
                      <td className="font-mono-data px-2.5 py-2 text-right">
                        {s.avgSlaApprove != null ? `${formatDecimal(s.avgSlaApprove, 2)}h` : '—'}
                      </td>
                      <td className="font-mono-data px-4 py-2 text-right">
                        {s.avgSlaReject != null ? `${formatDecimal(s.avgSlaReject, 2)}h` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2b: Diagnostic Deep-Dive — Why Final Approval Slowed in Oct 2026+ */}
      {data.finalApprovalDiagnostic && data.finalApprovalDiagnostic.afterStats?.count > 0 && (() => {
        const fa = data.finalApprovalDiagnostic;
        const octTopUser = fa.byApprover.find((a: any) => a.countAfter > 0);
        const earlySlice = fa.subPeriods.find((p: any) => p.id === 'early');
        const midSlice = fa.subPeriods.find((p: any) => p.id === 'mid');
        const octSlice = fa.subPeriods.find((p: any) => p.id === 'oct');
        const wk = fa.octBreakdown?.weekdayOnly;
        const we = fa.octBreakdown?.crossWeekend;
        const fromAppr = fa.octBreakdown?.fromApproveBidang;
        const fromVer = fa.octBreakdown?.fromVerifikasi;
        const octTotal = fa.afterStats.count || 0;

        return (
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  <Microscope className="size-4" />
                </div>
                <div>
                  <CardTitle>Bedah Penyebab SLA Final Approval (Sebelum vs Okt 2026+)</CardTitle>
                  <CardDescription>
                    Analisa faktor approver tunggal, pergeseran baseline Mei–Sep, efek akhir pekan &amp; perubahan alur sistem
                  </CardDescription>
                </div>
              </div>
              <Badge tone="rose">
                {formatDecimal(fa.beforeStats?.avgDays, 2)} → {formatDecimal(fa.afterStats?.avgDays, 2)} hari
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Dynamic Root-Cause Callout */}
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-slate-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-slate-200">
                <strong>Temuan Utama:</strong> Kenaikan rata-rata Final Approval pada Okt 2026+ bukan disebabkan tim melambat
                di Oktober, melainkan{' '}
                <strong>pergantian approver sejak Mei/Juni 2026</strong>.{' '}
                {octTopUser && (
                  <>
                    Seluruh antrean Okt 2026+ (
                    <span className="font-mono-data font-semibold">
                      {formatNumber(octTopUser.countAfter)}/{formatNumber(octTotal)}
                    </span>
                    ) ditangani oleh <strong>User {octTopUser.approverId}</strong> dengan rata-rata{' '}
                    <span className="font-mono-data font-semibold">{formatDecimal(octTopUser.avgAfter, 2)} hari</span>
                    {midSlice?.avgDays != null && octSlice?.avgDays != null && (
                      <>
                        {' '}— justru{' '}
                        <strong>
                          {octSlice.avgDays < midSlice.avgDays ? 'lebih cepat' : 'berubah'} dibanding periode Mei–Sep 2026
                        </strong>{' '}
                        (<span className="font-mono-data">{formatDecimal(midSlice.avgDays, 2)} hari</span>).
                      </>
                    )}
                  </>
                )}{' '}
                {earlySlice?.avgDays != null && (
                  <>
                    Angka <em>Sebelum Okt 2026</em> terlihat sangat rendah karena periode Jan 2025–Apr 2026 (
                    <span className="font-mono-data">{formatDecimal(earlySlice.avgDays, 2)} hari</span>,{' '}
                    {formatNumber(earlySlice.count)} kasus) didominasi oleh User{' '}
                    <span className="font-mono-data font-semibold">{earlySlice.dominantApprover}</span>.
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                {/* Left: Sub-periods + Approver Table */}
                <div className="space-y-4 xl:col-span-7">
                  {/* 3 Sub-Periods */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <Calendar className="size-3.5 text-slate-500" />
                      <span>Evolusi 3 Sub-Periode Final Approval</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {fa.subPeriods.map((sp: any) => (
                        <div
                          key={sp.id}
                          className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{sp.label}</div>
                          <div className="font-mono-data mt-1 text-base font-bold text-slate-900 dark:text-white">
                            {sp.avgDays != null ? `${formatDecimal(sp.avgDays, 2)} hari` : '—'}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Med: {sp.medianDays != null ? formatDaysSmart(sp.medianDays) : '—'}</span>
                            <span className="font-mono-data">{formatNumber(sp.count)} appr</span>
                          </div>
                          <div className="mt-1.5 truncate text-[11px] text-slate-600 dark:text-slate-300">
                            Dominan: <strong className="font-mono-data">{sp.dominantApprover}</strong> (
                            {formatPercent(sp.dominantShare, 0)})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-Approver Table */}
                  <div className="overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                      <Users className="size-3.5 text-slate-500" />
                      <span>Kinerja Per Approver Final Approval (Message_by)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <th className="px-3.5 py-2">User Approver</th>
                            <th className="px-3 py-2 text-right">Jml (Sblm Okt)</th>
                            <th className="px-3 py-2 text-right">Avg (Sblm Okt)</th>
                            <th className="px-3 py-2 text-right">Med (Sblm Okt)</th>
                            <th className="px-3 py-2 text-right">Jml (Okt+)</th>
                            <th className="px-3.5 py-2 text-right">Avg (Okt+)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {fa.byApprover.map((a: any) => (
                            <tr key={a.approverId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="font-mono-data px-3.5 py-2 font-semibold text-slate-900 dark:text-slate-100">
                                {a.approverId}
                              </td>
                              <td className="font-mono-data px-3 py-2 text-right">{formatNumber(a.countBefore)}</td>
                              <td className="font-mono-data px-3 py-2 text-right">
                                {a.avgBefore != null ? `${formatDecimal(a.avgBefore, 2)}h` : '—'}
                              </td>
                              <td className="font-mono-data px-3 py-2 text-right text-slate-500">
                                {a.medianBefore != null ? formatDaysSmart(a.medianBefore) : '—'}
                              </td>
                              <td className="font-mono-data px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-400">
                                {formatNumber(a.countAfter)}
                              </td>
                              <td className="font-mono-data px-3.5 py-2 text-right font-bold text-slate-900 dark:text-white">
                                {a.avgAfter != null ? `${formatDecimal(a.avgAfter, 2)}h` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right: Weekend & Workflow Impact + Top 5 Outliers */}
                <div className="space-y-4 xl:col-span-5">
                  {/* Weekend + Workflow Split */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200/80 p-3 text-xs dark:border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Efek Akhir Pekan (Okt+)
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Hari Kerja ({wk?.count || 0})</span>
                          <span className="font-mono-data font-bold text-teal-700 dark:text-teal-400">
                            {wk?.avgDays != null ? `${formatDecimal(wk.avgDays, 2)}h` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Lewat Sab–Min ({we?.count || 0})</span>
                          <span className="font-mono-data font-bold text-rose-600 dark:text-rose-400">
                            {we?.avgDays != null ? `${formatDecimal(we.avgDays, 2)}h` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 p-3 text-xs dark:border-slate-800">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <GitBranch className="size-3" />
                        <span>Alur Sebelum Final (Okt+)</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Dari Verifikasi ({fromVer?.count || 0})</span>
                          <span className="font-mono-data font-bold text-blue-700 dark:text-blue-400">
                            {fromVer?.avgDays != null ? `${formatDecimal(fromVer.avgDays, 2)}h` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Dari Approve VP ({fromAppr?.count || 0})</span>
                          <span className="font-mono-data font-bold text-amber-700 dark:text-amber-400">
                            {fromAppr?.avgDays != null ? `${formatDecimal(fromAppr.avgDays, 2)}h` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top 5 Outliers in Oct+ */}
                  <div className="overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-800">
                    <div className="border-b border-slate-100 bg-slate-50/70 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                      Top 5 Final Approval Terlama (Okt 2026+)
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(fa.topOutliersOct || []).map((o: any) => (
                        <button
                          key={`${o.idVendor}-${o.waktuDisplay}`}
                          type="button"
                          onClick={() => onSelectVendor?.(o.idVendor)}
                          className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs transition-colors hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-800/50"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                              {o.namaPerusahaan}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">
                              {o.pairedPrevAct} → Final ({o.waktuDisplay})
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Badge tone="rose" className="font-mono-data">
                              {formatDecimal(o.slaDays, 2)}h
                            </Badge>
                            {onSelectVendor && <ExternalLink className="size-3 text-slate-400" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Row 3: Ringkasan Tipe Activity (Sheet 4) */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Ringkasan SLA Berdasarkan Tipe Activity</CardTitle>
            <CardDescription>
              Rincian frekuensi kejadian, rasio Approve vs Reject, dan rata-rata durasi SLA (Jam &amp; Hari)
            </CardDescription>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <th className="px-4 py-2.5">Tipe Activity</th>
                <th className="px-3 py-2.5">Bidang</th>
                <th className="px-3 py-2.5">Aktor</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">Approve</th>
                <th className="px-3 py-2.5 text-right">Reject</th>
                <th className="px-3 py-2.5 text-right">Rasio Appr</th>
                <th className="px-3 py-2.5 text-right">SLA (Jam)</th>
                <th className="px-4 py-2.5 text-right">SLA (Hari)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data.activitySummary || []).map((a: any) => {
                const ratio = a.totalKejadian > 0 ? a.countApprove / a.totalKejadian : 0;
                return (
                  <tr key={a.tipeActivity} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{a.tipeActivity}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone="neutral">{a.bidang}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">{a.aktor}</td>
                    <td className="font-mono-data px-3 py-2.5 text-right font-semibold">{formatNumber(a.totalKejadian)}</td>
                    <td className="font-mono-data px-3 py-2.5 text-right text-teal-700 dark:text-teal-400">
                      {formatNumber(a.countApprove)}
                    </td>
                    <td className="font-mono-data px-3 py-2.5 text-right text-rose-600 dark:text-rose-400">
                      {formatNumber(a.countReject)}
                    </td>
                    <td className="font-mono-data px-3 py-2.5 text-right">{formatPercent(ratio)}</td>
                    <td className="font-mono-data px-3 py-2.5 text-right">
                      {a.avgSlaHours != null ? formatDecimal(a.avgSlaHours, 1) : '—'}
                    </td>
                    <td className="font-mono-data px-4 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                      {a.avgSlaDays != null ? `${formatDecimal(a.avgSlaDays, 2)} h` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
