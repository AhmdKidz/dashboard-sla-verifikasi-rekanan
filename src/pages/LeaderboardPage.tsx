import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Building2, HardHat, Zap, Hourglass, ExternalLink } from 'lucide-react';
import { api, type VendorRow } from '@/lib/api';
import { formatDaysSmart, formatDecimal, formatDurationDetailed, formatNumber, formatPercent } from '@/lib/format';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FilterSelect,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives';
import { StatusPill } from '@/components/VendorDrawer';
import { EmptyFilterState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { cn } from '@/lib/utils';

type LeaderboardData = Awaited<ReturnType<typeof api.getLeaderboard>>;

function RankTable({
  title,
  subtitle,
  rows,
  mode,
  onSelectVendor,
}: {
  title: string;
  subtitle: string;
  rows: VendorRow[];
  mode: 'fast' | 'slow';
  onSelectVendor: (id: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
              mode === 'fast'
                ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300'
            )}
          >
            {mode === 'fast' ? <Zap className="size-4" /> : <Hourglass className="size-4" />}
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
        </div>
        <Badge tone={mode === 'fast' ? 'emerald' : 'rose'}>Top {rows.length}</Badge>
      </CardHeader>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          Tidak ada data yang memenuhi kriteria filter divisi/status saat ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <th className="px-4 py-2.5 w-12">Rank</th>
                <th className="px-3 py-2.5">Nama Rekanan &amp; ID</th>
                <th className="px-3 py-2.5 text-right">Log</th>
                <th className="px-3 py-2.5 text-right">Revisi</th>
                <th className="px-3 py-2.5 text-right">Durasi Siklus</th>
                {mode === 'slow' && <th className="px-3 py-2.5">Status</th>}
                <th className="px-4 py-2.5 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((v, i) => {
                const displayDays =
                  mode === 'fast' ? (v.clean_pass_dur_days ?? v.dur_days) : v.dur_days;
                return (
                  <tr
                    key={v.id_vendor}
                    onClick={() => onSelectVendor(v.id_vendor)}
                    className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'font-mono-data inline-flex size-6 items-center justify-center rounded-md text-[11px] font-bold',
                          i < 3
                            ? mode === 'fast'
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[240px]">
                      <div
                        className="truncate font-semibold text-slate-900 group-hover:text-[#0F2744] dark:text-slate-100 dark:group-hover:text-sky-400"
                        title={v.nama_perusahaan}
                      >
                        {v.nama_perusahaan}
                      </div>
                      <div className="font-mono-data text-[11px] text-slate-500 truncate">
                        ID {v.id_vendor} · {v.divisi}
                      </div>
                    </td>
                    <td className="font-mono-data px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">
                      {v.total_logs}
                    </td>
                    <td className="font-mono-data px-3 py-2.5 text-right">
                      {v.revision_count > 0 ? (
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          {v.revision_count}x
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="font-mono-data whitespace-nowrap px-3 py-2.5 text-right font-bold">
                      <span
                        className={
                          mode === 'fast'
                            ? 'text-teal-700 dark:text-teal-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                        title={formatDurationDetailed(displayDays)}
                      >
                        {formatDaysSmart(displayDays)}
                      </span>
                    </td>
                    {mode === 'slow' && (
                      <td className="px-3 py-2.5">
                        <StatusPill status={v.tindak_lanjut} />
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-[#0F2744] dark:group-hover:text-sky-400">
                        Log <ExternalLink className="size-3" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function LeaderboardPage({
  divisiOptions,
  onSelectVendor,
}: {
  divisiOptions: { divisi: string; count: number }[];
  onSelectVendor: (idVendor: number) => void;
}) {
  const [tab, setTab] = useState<'bu' | 'mandor'>('bu');
  const [divisi, setDivisi] = useState('ALL');
  const [includeInProgress, setIncludeInProgress] = useState(true);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getLeaderboard({ limit: 10, includeInProgress, divisi })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [divisi, includeInProgress]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  const activeFast = tab === 'bu' ? data?.buFastest || [] : data?.mandorFastest || [];
  const activeSlow = tab === 'bu' ? data?.buSlowest || [] : data?.mandorSlowest || [];
  const activeStats = tab === 'bu' ? data?.buStats : data?.mandorStats;

  const slowChartData = activeSlow.map((v, idx) => ({
    name: `#${idx + 1} ${v.nama_perusahaan.length > 18 ? v.nama_perusahaan.slice(0, 18) + '…' : v.nama_perusahaan}`,
    fullName: v.nama_perusahaan,
    days: Number(v.dur_days.toFixed(1)),
    idVendor: v.id_vendor,
    revisions: v.revision_count,
  }));

  const fastChartData = activeFast.map((v, idx) => ({
    name: `#${idx + 1} ${v.nama_perusahaan.length > 18 ? v.nama_perusahaan.slice(0, 18) + '…' : v.nama_perusahaan}`,
    fullName: v.nama_perusahaan,
    hours: Number(((v.clean_pass_dur_days ?? v.dur_days) * 24).toFixed(1)),
    idVendor: v.id_vendor,
  }));

  return (
    <div className="space-y-5">
      {/* Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'bu' | 'mandor')}>
          <TabsList>
            <TabsTrigger value="bu">
              <Building2 className="size-3.5" />
              Badan Usaha ({formatNumber(data?.buStats.total)})
            </TabsTrigger>
            <TabsTrigger value="mandor">
              <HardHat className="size-3.5" />
              Mandor ({formatNumber(data?.mandorStats.total)})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect
            ariaLabel="Filter Divisi Peringkat"
            value={divisi}
            onValueChange={setDivisi}
            options={[
              { value: 'ALL', label: 'Semua Divisi' },
              ...divisiOptions.map((d) => ({ value: d.divisi, label: `${d.divisi} (${d.count})` })),
            ]}
          />
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer dark:border-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeInProgress}
              onChange={(e) => setIncludeInProgress(e.target.checked)}
              className="size-3.5 rounded accent-[#0F2744]"
            />
            Sertakan &ldquo;Dalam Proses&rdquo; di Top 10 Terlama
          </label>
        </div>
      </div>

      {/* Category Summary Strip */}
      {activeStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total {tab === 'bu' ? 'Badan Usaha' : 'Mandor'}
            </div>
            <div className="font-mono-data mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {formatNumber(activeStats.total)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Lulus Terseleksi</div>
            <div className="font-mono-data mt-1 text-xl font-bold text-teal-700 dark:text-teal-400">
              {formatNumber(activeStats.lulus)}{' '}
              <span className="text-xs font-medium text-slate-500">
                ({formatPercent(activeStats.total > 0 ? activeStats.lulus / activeStats.total : 0)})
              </span>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Rata-rata Siklus Lulus</div>
            <div className="font-mono-data mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {formatDaysSmart(activeStats.avgPassDays)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Rata-rata Semua Rekanan</div>
            <div className="font-mono-data mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {formatDaysSmart(activeStats.avgAllDays)}
            </div>
          </Card>
        </div>
      )}

      {loading || !data ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <TableSkeleton rows={10} />
          <TableSkeleton rows={10} />
        </div>
      ) : activeFast.length === 0 && activeSlow.length === 0 ? (
        <EmptyFilterState
          title="Belum ada rekanan di kategori dan divisi ini"
          description="Khusus Mandor umumnya tidak mencantumkan Divisi pada pesan awal. Pilih 'Semua Divisi' untuk melihat seluruh Top 10."
          actionLabel="Tampilkan Semua Divisi"
          onAction={() => setDivisi('ALL')}
        />
      ) : (
        <>
          {/* Visual Bar Comparison */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>
                    Visualisasi Top 10 {tab === 'bu' ? 'Badan Usaha' : 'Mandor'} Tercepat (Jam)
                  </CardTitle>
                  <CardDescription>Durasi bersih dari Konfirmasi Selesai s.d. Approve Rekanan Terseleksi</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[270px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fastChartData} layout="vertical" margin={{ top: 2, right: 16, left: 6, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} unit="j" axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={170}
                        tick={{ fontSize: 11, fill: '#334155' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: any) => [`${formatDecimal(Number(val), 1)} jam`, 'Durasi Lulus']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                        contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                      />
                      <Bar
                        dataKey="hours"
                        radius={[0, 4, 4, 0]}
                        barSize={15}
                        isAnimationActive={false}
                        className="cursor-pointer"
                        onClick={(d: any) => d?.idVendor && onSelectVendor(d.idVendor)}
                      >
                        {fastChartData.map((_, i) => (
                          <Cell key={i} fill={i < 3 ? '#0D9488' : '#14B8A6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>
                    Visualisasi Top 10 {tab === 'bu' ? 'Badan Usaha' : 'Mandor'} Terlama (Hari)
                  </CardTitle>
                  <CardDescription>Klik batang grafik untuk menginspeksi log revisi &amp; penyebab keterlambatan</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[270px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={slowChartData} layout="vertical" margin={{ top: 2, right: 16, left: 6, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} unit="h" axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={170}
                        tick={{ fontSize: 11, fill: '#334155' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: any) => [`${formatDecimal(Number(val), 1)} hari`, 'Durasi Siklus']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                        contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                      />
                      <Bar
                        dataKey="days"
                        radius={[0, 4, 4, 0]}
                        barSize={15}
                        isAnimationActive={false}
                        className="cursor-pointer"
                        onClick={(d: any) => d?.idVendor && onSelectVendor(d.idVendor)}
                      >
                        {slowChartData.map((_, i) => (
                          <Cell key={i} fill={i < 3 ? '#C81E2B' : '#F43F5E'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top 10 Tables */}
          {tab === 'mandor' && activeFast.length < 10 && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
              <strong>Catatan Data Mandor:</strong> Dari {formatNumber(data.mandorStats.total)} Mandor terdaftar (2025–2026), saat ini baru{' '}
              <strong className="font-mono-data">{activeFast.length}</strong> Mandor yang mencapai status akhir{' '}
              <em>Approve Rekanan Terseleksi</em>. Seluruhnya ditampilkan pada daftar Tercepat di bawah.
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            <RankTable
              title={`Top 10 ${tab === 'bu' ? 'Badan Usaha' : 'Mandor'} Tercepat`}
              subtitle={
                tab === 'bu'
                  ? 'ID diawali 1/2, siklus penuh (≥ 7 log) dari Konfirmasi Selesai s.d. Lulus Terseleksi'
                  : 'ID diawali 8, siklus lengkap (≥ 3 log) dari Konfirmasi Selesai Mandor s.d. Lulus Terseleksi'
              }
              rows={activeFast}
              mode="fast"
              onSelectVendor={onSelectVendor}
            />
            <RankTable
              title={`Top 10 ${tab === 'bu' ? 'Badan Usaha' : 'Mandor'} Terlama`}
              subtitle={
                includeInProgress
                  ? 'Mencakup rekanan Lulus Approved maupun yang masih Dalam Proses / Revisi'
                  : 'Khusus rekanan yang telah selesai Lulus Terseleksi dengan durasi siklus terpanjang'
              }
              rows={activeSlow}
              mode="slow"
              onSelectVendor={onSelectVendor}
            />
          </div>
        </>
      )}
    </div>
  );
}
