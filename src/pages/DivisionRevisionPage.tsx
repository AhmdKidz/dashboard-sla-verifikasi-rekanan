import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { AlertCircle, Clock, ExternalLink, GitFork, RefreshCcw } from 'lucide-react';
import { api, type GlobalFilters, type VendorRow } from '@/lib/api';
import { formatDaysSmart, formatDecimal, formatNumber, formatPercent } from '@/lib/format';
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
import { TipePill } from '@/components/VendorDrawer';
import { ChartSkeleton, ErrorState, TableSkeleton } from '@/components/StateViews';

export function DivisionRevisionPage({
  filters,
  onSelectVendor,
}: {
  filters: GlobalFilters;
  onSelectVendor: (idVendor: number) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stagnantTab, setStagnantTab] = useState<'verif' | 'rekanan'>('verif');

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getDivisionsRevisions(filters)
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ChartSkeleton height="h-72" />
          <ChartSkeleton height="h-72" />
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  const shortenUnit = (name: string) => {
    if (name === 'PT. Hutama Karya Infrastruktur') return 'HKI';
    if (name === 'Unit Pengadaan Jalan Tol') return 'UPJT';
    if (name === 'PT HK Realtindo') return 'HKR';
    if (name === 'PT. HAKAASTON') return 'Hakaaston';
    if (name === 'Divisi Infrastruktur I') return 'Infra I';
    if (name === 'Divisi Infrastruktur II') return 'Infra II';
    return name.replace('Divisi ', '');
  };

  const divChartData = (data.divisionStats || [])
    .filter((d: any) => d.divisi !== 'Tidak Tercantum')
    .map((d: any) => ({
      name: shortenUnit(d.divisi),
      fullName: d.divisi,
      lulus: d.lulus,
      antreanVerif: d.antreanVerif,
      revisiRekanan: d.revisiRekanan,
      avgDurApproved: d.avgDurApproved != null ? Number(d.avgDurApproved.toFixed(1)) : 0,
      avgRevisions: Number((d.avgRevisions || 0).toFixed(1)),
    }));

  const revBucketData = (data.revisionBuckets || []).map((b: any) => ({
    bucket: b.bucket,
    vendorCount: b.vendorCount,
    avgDurDays: Number((b.avgDurDays || 0).toFixed(1)),
    avgDurApproved: b.avgDurApproved != null ? Number(b.avgDurApproved.toFixed(1)) : null,
  }));

  const bidangFrictionData = (data.bidangFriction || []).map((b: any) => ({
    bidang: b.bidang,
    totalRejects: b.totalRejects,
    totalRevisions: b.totalRevisions,
    avgRevisionResponseDays: Number((b.avgRevisionResponseDays || 0).toFixed(1)),
  }));

  const activeStagnantList: VendorRow[] =
    stagnantTab === 'verif' ? data.stagnantVerif || [] : data.stagnantRekanan || [];

  return (
    <div className="space-y-5">
      {/* Row 1: Division Performance Breakdown */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2744]/8 text-[#0F2744] dark:bg-sky-950/60 dark:text-sky-300">
                <GitFork className="size-4" />
              </div>
              <div>
                <CardTitle>Distribusi Status Rekanan per Divisi &amp; Entitas Tujuan</CardTitle>
                <CardDescription>
                  Diekstrak otomatis dari pesan pendaftaran rekanan (Divisi HK, Kantor Pusat &amp; Anak Perusahaan)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={divChartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="lulus" stackId="a" name="Lulus Terseleksi" fill="#0D9488" maxBarSize={36} isAnimationActive={false} />
                  <Bar dataKey="antreanVerif" stackId="a" name="Antrean Verifikator" fill="#2563EB" maxBarSize={36} isAnimationActive={false} />
                  <Bar
                    dataKey="revisiRekanan"
                    stackId="a"
                    name="Revisi di Rekanan"
                    fill="#D97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5 overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Ringkasan Metrik per Divisi</CardTitle>
              <CardDescription>Rasio kelulusan, rata-rata siklus lulus &amp; frekuensi revisi</CardDescription>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <th className="px-4 py-2.5">Divisi</th>
                  <th className="px-2.5 py-2.5 text-right">Total</th>
                  <th className="px-2.5 py-2.5 text-right">Lulus %</th>
                  <th className="px-2.5 py-2.5 text-right">Durasi Lulus</th>
                  <th className="px-4 py-2.5 text-right">Avg Revisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data.divisionStats || []).map((d: any) => {
                  const rate = d.totalVendors > 0 ? d.lulus / d.totalVendors : 0;
                  return (
                    <tr key={d.divisi} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{d.divisi}</td>
                      <td className="font-mono-data px-2.5 py-2.5 text-right">{formatNumber(d.totalVendors)}</td>
                      <td className="font-mono-data px-2.5 py-2.5 text-right text-teal-700 dark:text-teal-400 font-semibold">
                        {formatPercent(rate)}
                      </td>
                      <td className="font-mono-data px-2.5 py-2.5 text-right">
                        {d.avgDurApproved != null ? `${formatDecimal(d.avgDurApproved, 1)}h` : '—'}
                      </td>
                      <td className="font-mono-data px-4 py-2.5 text-right text-amber-700 dark:text-amber-400 font-semibold">
                        {formatDecimal(d.avgRevisions, 1)}x
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Row 2: Revision Friction Analysis */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <CardHeader>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                <RefreshCcw className="size-4" />
              </div>
              <div>
                <CardTitle>Dampak Jumlah Revisi terhadap Lama Siklus Kelulusan</CardTitle>
                <CardDescription>
                  Semakin banyak putaran revisi dokumen, durasi siklus end-to-end melonjak eksponensial
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={revBucketData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#C81E2B' }}
                    tickLine={false}
                    axisLine={false}
                    unit="h"
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(val: any, name: string) =>
                      name === 'Jumlah Rekanan'
                        ? [`${formatNumber(Number(val))} rekanan`, name]
                        : [`${formatDecimal(Number(val), 1)} hari`, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="vendorCount" name="Jumlah Rekanan" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgDurApproved"
                    name="Rata-rata Durasi Lulus (Hari)"
                    stroke="#C81E2B"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-6">
          <CardHeader>
            <div>
              <CardTitle>Sumber Reject &amp; Revisi Terbesar per Bidang</CardTitle>
              <CardDescription>Total kejadian Reject (St=2) vs Konfirmasi Revisi Selesai per bidang</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bidangFrictionData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="bidang" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                    formatter={(val: any, name: string) => [formatNumber(Number(val)), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalRejects" name="Total Reject (St=2)" fill="#E11D48" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                  <Bar dataKey="totalRevisions" name="Total Revisi Rekanan" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Aging Queue Distribution + Actionable Stagnant Queue List */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                <Clock className="size-4" />
              </div>
              <div>
                <CardTitle>Distribusi Aging Antrean Aktif</CardTitle>
                <CardDescription>Lama rekanan belum bergerak sejak aktivitas terakhir s.d. 10 Nov 2026</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[290px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.agingBuckets || []} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="antreanVerif" stackId="q" name="Antrean Verifikator" fill="#2563EB" maxBarSize={36} isAnimationActive={false} />
                  <Bar
                    dataKey="revisiRekanan"
                    stackId="q"
                    name="Revisi di Rekanan"
                    fill="#D97706"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-7 overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-3.5 dark:border-slate-800">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                <AlertCircle className="size-4" />
              </div>
              <div>
                <CardTitle>Antrean Stagnan Terlama (Perlu Tindak Lanjut)</CardTitle>
                <CardDescription>Klik rekanan untuk membuka log terakhir &amp; menelusuri titik hambatan</CardDescription>
              </div>
            </div>
            <Tabs value={stagnantTab} onValueChange={(v) => setStagnantTab(v as 'verif' | 'rekanan')}>
              <TabsList>
                <TabsTrigger value="verif">Di Verifikator</TabsTrigger>
                <TabsTrigger value="rekanan">Revisi Rekanan</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <div className="max-h-[340px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-4 py-2">Rekanan</th>
                  <th className="px-3 py-2">Tipe</th>
                  <th className="px-3 py-2">Aktivitas Terakhir</th>
                  <th className="px-3 py-2 text-right">Aging</th>
                  <th className="px-4 py-2 text-right">Log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeStagnantList.map((v) => (
                  <tr
                    key={v.id_vendor}
                    onClick={() => onSelectVendor(v.id_vendor)}
                    className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-2.5 max-w-[210px]">
                      <div className="truncate font-semibold text-slate-900 dark:text-slate-100" title={v.nama_perusahaan}>
                        {v.nama_perusahaan}
                      </div>
                      <div className="font-mono-data text-[10px] text-slate-500">
                        ID {v.id_vendor} · {v.divisi}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <TipePill tipe={v.tipe_rekanan} />
                    </td>
                    <td className="px-3 py-2.5 max-w-[170px]">
                      <div className="truncate text-slate-700 dark:text-slate-300" title={v.last_act}>
                        {v.last_act}
                      </div>
                      <div className="font-mono-data text-[10px] text-slate-400">{v.end_iso}</div>
                    </td>
                    <td className="font-mono-data whitespace-nowrap px-3 py-2.5 text-right">
                      <Badge tone="rose">{formatDaysSmart(v.aging_days)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ExternalLink className="inline size-3.5 text-slate-400 group-hover:text-[#0F2744] dark:group-hover:text-sky-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
