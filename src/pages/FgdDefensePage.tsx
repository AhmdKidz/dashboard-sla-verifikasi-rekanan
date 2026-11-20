import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  ShieldAlert,
  Filter,
  Scale,
  Clock,
  Layers,
  SlidersHorizontal,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api, type GlobalFilters } from '@/lib/api';
import {
  formatDaysSmart,
  formatDecimal,
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

type SlideFilter = 'all' | 'slide1' | 'slide2' | 'slide3';

export function FgdDefensePage({
  filters,
  onSelectVendor,
}: {
  filters: GlobalFilters;
  onSelectVendor: (idVendor: number) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideTab, setSlideTab] = useState<SlideFilter>('all');
  const [distTab, setDistTab] = useState<'verif' | 'revisi'>('verif');
  const [selectedCap, setSelectedCap] = useState<number>(60);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getFgdDefense(filters)
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
        <TableSkeleton rows={6} />
      </div>
    );
  }

  const showSlide1 = slideTab === 'all' || slideTab === 'slide1';
  const showSlide2 = slideTab === 'all' || slideTab === 'slide2';
  const showSlide3 = slideTab === 'all' || slideTab === 'slide3';

  const buSplit = (data.typeSplit || []).find((x: any) => x.tipe === 'Badan Usaha');
  const mandorSplit = (data.typeSplit || []).find((x: any) => x.tipe === 'Mandor');
  const faRec = data.faReconciliation || {};
  const cqsms = data.cqsmsSummary || { totalLogs: 0, lastDate: '', timeline: [] };
  const activeScenario =
    (data.autoDropScenarios || []).find((s: any) => s.capDays === selectedCap) ||
    data.autoDropScenarios?.[2];

  const typeChartData = (data.typeSplit || []).map((t: any) => ({
    tipe: t.tipe,
    lulus: t.lulus,
    antreanVerif: t.antreanVerif,
    revisiRekanan: t.revisiRekanan,
  }));

  const distChartData = (data.distributionByBidang || []).map((d: any) => ({
    bidang: d.bidang,
    mean:
      distTab === 'verif'
        ? Number((d.verifMean || 0).toFixed(2))
        : Number((d.revMean || 0).toFixed(2)),
    median:
      distTab === 'verif'
        ? Number((d.verifMedian || 0).toFixed(2))
        : Number((d.revMedian || 0).toFixed(2)),
    p90:
      distTab === 'verif'
        ? Number((d.verifP90 || 0).toFixed(2))
        : Number((d.revP90 || 0).toFixed(2)),
  }));

  const parallelChartData = (data.extremeVendors || []).map((v: any) => ({
    name:
      v.namaPerusahaan.length > 20 ? v.namaPerusahaan.slice(0, 20) + '…' : v.namaPerusahaan,
    fullName: v.namaPerusahaan,
    idVendor: v.idVendor,
    kalender: Number(v.wallClockDays.toFixed(1)),
    paralelVerif: Number(v.parallelVerifDays.toFixed(1)),
    paralelRekanan: Number(v.parallelRekananDays.toFixed(1)),
    overlapRatio: Number(v.overlapRatio.toFixed(2)),
  }));

  const autoDropChartData = (data.autoDropScenarios || []).map((s: any) => ({
    label: `> ${s.capDays} hr`,
    capDays: s.capDays,
    slaProyeksi: Number(s.projectedRevAvg.toFixed(2)),
    dibersihkan: s.droppedActiveVendors,
  }));

  const mandorApproveTeknik =
    (data.mandorQueueBreakdown || []).find((x: any) => x.lastAct === 'Approve Teknik')?.count || 0;

  const qaList: { slide: 'slide1' | 'slide2' | 'slide3'; q: string; a: string }[] = [
    {
      slide: 'slide1',
      q: 'Mengapa 104.227 log mentah berkurang menjadi 63.722 aktivitas? Apakah data lama/buruk disembunyikan?',
      a: `Tidak. Pengurangan 40.505 baris bersifat audit transparan: 38.898 baris milik 1.690 rekanan legacy mulai 2024 (dipisahkan agar periode 2025–2026 bersih), 142 baris milik 18 ID Dummy/Testing internal, dan 1.465 baris duplikat sistem pada menit & aktivitas yang sama.`,
    },
    {
      slide: 'slide1',
      q: 'Mengapa tingkat kelulusan di Donut hanya 37,5% dan Antrean Verifikator mencapai 1.747 rekanan?',
      a: `Angka 37,5% tertekan oleh 1.465 akun Mandor yang alurnya berhenti di Approve Teknik (${formatNumber(mandorApproveTeknik)} dari ${formatNumber(mandorSplit?.antreanVerif || 0)} antrean Mandor). Pada Badan Usaha murni (${formatNumber(buSplit?.total || 0)}), kelulusan mencapai ${formatPercent(buSplit?.lulusRate || 0)} dan antrean verifikator hanya ${formatPercent(buSplit?.antreanRate || 0)}.`,
    },
    {
      slide: 'slide1',
      q: 'Di Slide 1 ada 1.767 Lulus Terseleksi, tapi di Slide 2 Log Final Approval ada 1.784. Selisih 17 itu ke mana?',
      a: `Tercatat ${formatNumber(faRec.uniqueVendorsEverApproved)} rekanan unik pernah lulus. Selisih +${faRec.extraReapprovalLogs} log berasal dari ${faRec.multiApprovedVendorsCount} rekanan yang melakukan Unlock Edit Data lalu lulus ulang ke-2/ke-3 kalinya, dikurangi ${faRec.revertedCount} rekanan yang status terkininya kembali dalam revisi setelah pernah lulus.`,
    },
    {
      slide: 'slide2',
      q: 'Mengapa CQSMS/QHSSE pada kolom Okt+ tertulis n=0? Apakah timnya tidak bekerja?',
      a: `Bukan tidak bekerja. Log verifikasi CQSMS/QHSSE di sistem hanya berjalan Januari–Juni 2025 (total ${formatNumber(cqsms.totalLogs)} log, terakhir ${cqsms.lastDate || 'Juni 2025'}). Sejak Juli 2025 tidak ada lagi antrean masuk pada tahapan CQSMS.`,
    },
    {
      slide: 'slide2',
      q: 'Apakah rata-rata SLA (Keuangan 12,97 hr, Legal 8,15 hr, Revisi BIM 20,73 hr) terdistorsi oleh outlier?',
      a: `Ya—semua bidang memiliki distribusi miring (skewed). Median Legal hanya 1,33 hari (mean 8,15 hr), Teknik 0,83 hari, BIM 0,87 hari, dan Revisi BIM bermedian 0,98 hari (mean 20,73 hr karena segelintir berkas terbengkalai >100 hari). Itu sebabnya kebijakan auto-drop sangat krusial.`,
    },
    {
      slide: 'slide2',
      q: 'Apa isi "Internal Review (1.476 log, 11,6–15,1 hr)" di catatan kaki Slide 2?',
      a: `Internal Review adalah jeda antar-aktivitas internal tanpa ada revisi rekanan di antaranya—seperti pemeriksaan ulang internal (Verifikasi Teknik/Legal/Keuangan berulang), Unlock Edit Data, serta eskalasi Reject VP (yang rata-rata memakan 62–86 hari).`,
    },
    {
      slide: 'slide3',
      q: 'Kok di Slide 3 total siklus WIKA 582 hari, tapi rinciannya 1.112 hari revisi + 259 hari verifikasi?',
      a: `Karena 4–5 bidang verifikasi (Teknik, Keuangan, Legal, BIM, CQSMS) berjalan secara PARALEL. Ketika rekanan bersamaan menunda revisi Legal dan BIM pada minggu yang sama, akumulasi paralel per bidang (1.393 hari) melampaui durasi kalender end-to-end (582 hari; rasio paralel ~2,4x).`,
    },
    {
      slide: 'slide3',
      q: 'Jika Rencana Aksi Auto-Drop diterapkan (misal 30/60/90 hari), seberapa besar dampaknya?',
      a: `Menggunakan simulasi data riil di bawah: Auto-Drop 60 hari langsung membersihkan ${formatPercent(data.autoDropScenarios?.[2]?.droppedShare || 0)} (${formatNumber(data.autoDropScenarios?.[2]?.droppedActiveVendors || 0)}) antrean Revisi Rekanan yang menggantung dan memangkas rata-rata SLA Revisi dari ${formatDecimal(data.autoDropScenarios?.[2]?.baselineRevAvg, 2)} hari menjadi ${formatDecimal(data.autoDropScenarios?.[2]?.projectedRevAvg, 2)} hari.`,
    },
  ];

  const visibleQa = qaList.filter((item) => slideTab === 'all' || item.slide === slideTab);

  return (
    <div className="space-y-5">
      {/* Header & Slide Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2744]/10 text-[#0F2744] dark:bg-sky-950/60 dark:text-sky-300">
            <ShieldAlert className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Ruang Bukti &amp; Antisipasi Q&amp;A Ringkasan FGD (3 Slide)
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Seluruh angka dihitung langsung dari data bersih &amp; siap diklik saat sesi tanya-jawab FGD
            </div>
          </div>
        </div>

        <Tabs value={slideTab} onValueChange={(v) => setSlideTab(v as SlideFilter)}>
          <TabsList>
            <TabsTrigger value="all">Semua (3 Slide)</TabsTrigger>
            <TabsTrigger value="slide1">Slide 1</TabsTrigger>
            <TabsTrigger value="slide2">Slide 2</TabsTrigger>
            <TabsTrigger value="slide3">Slide 3</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ================= SLIDE 1 EVIDENCE ================= */}
      {showSlide1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Q1: Audit Kurasi Data (104.227 -> 63.722) */}
            <Card className="xl:col-span-5">
              <CardHeader>
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Filter className="size-4" />
                  </div>
                  <div>
                    <CardTitle>Audit Kurasi Data (104.227 → 63.722 Log)</CardTitle>
                    <CardDescription>
                      Jawaban Slide 1: ke mana selisih 40.505 baris dari file Excel mentah?
                    </CardDescription>
                  </div>
                </div>
                <Badge tone="navy">Slide 1</Badge>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {(data.curationWaterfall || []).map((row: any) => {
                  const isNeg = row.rows < 0;
                  return (
                    <div
                      key={row.step}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.step}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{row.note}</div>
                      </div>
                      <span
                        className={cn(
                          'font-mono-data shrink-0 text-sm font-bold',
                          row.tone === 'emerald'
                            ? 'text-teal-700 dark:text-teal-400'
                            : isNeg
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                        )}
                      >
                        {isNeg ? `−${formatNumber(Math.abs(row.rows))}` : formatNumber(row.rows)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Q2: Dekonstruksi Badan Usaha vs Mandor (37.5% vs 54.3% & 1.311 vs 1.173) */}
            <Card className="xl:col-span-7">
              <CardHeader>
                <div>
                  <CardTitle>Dekonstruksi Antrean: Badan Usaha vs Mandor (1.311 vs 1.173)</CardTitle>
                  <CardDescription>
                    Mengapa kelulusan gabungan terlihat 37,5% padahal Badan Usaha murni sudah 54,3%?
                  </CardDescription>
                </div>
                <Badge tone="navy">Slide 1 &amp; 3</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="h-[220px] lg:col-span-7">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={typeChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis dataKey="tipe" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          formatter={(val: any, name: string) => [`${formatNumber(Number(val))} rekanan`, name]}
                          contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="lulus" stackId="s" name="Lulus Terseleksi" fill="#0D9488" maxBarSize={64} isAnimationActive={false} />
                        <Bar dataKey="antreanVerif" stackId="s" name="Antrean Verifikator" fill="#2563EB" maxBarSize={64} isAnimationActive={false} />
                        <Bar dataKey="revisiRekanan" stackId="s" name="Revisi di Rekanan" fill="#D97706" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 lg:col-span-5">
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Rincian {formatNumber(mandorSplit?.antreanVerif || 0)} Antrean Verifikator Mandor
                    </div>
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/80 text-xs dark:divide-slate-800 dark:border-slate-800">
                      {(data.mandorQueueBreakdown || []).slice(0, 6).map((m: any) => (
                        <div key={m.lastAct} className="flex items-center justify-between gap-2 px-3 py-1.5">
                          <span className="truncate text-slate-700 dark:text-slate-300" title={m.lastAct}>
                            {m.lastAct}
                          </span>
                          <span
                            className={cn(
                              'font-mono-data shrink-0 font-bold',
                              m.lastAct === 'Approve Teknik'
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-slate-600 dark:text-slate-400'
                            )}
                          >
                            {formatNumber(m.count)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 text-pretty dark:text-slate-400">
                      <strong>1.173 akun</strong> (Slide 3) adalah Mandor yang berhenti tepat di <em>Approve Teknik</em>, bagian terbesar (89,5%) dari <strong>1.311 antrean Mandor</strong> (Slide 1).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Q3 & Q4: Rekonsiliasi 1.784 vs 1.767 + Pemicu Lonjakan Historis */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-6">
              <CardHeader>
                <div>
                  <CardTitle>Rekonsiliasi 1.784 Log Final Approval vs 1.767 Rekanan Lulus</CardTitle>
                  <CardDescription>
                    Menjawab selisih 17 angka antara Slide 1 (1.767 rekanan) dan Slide 2 (1.784 log)
                  </CardDescription>
                </div>
                <Badge tone="navy">Slide 1 &amp; 2</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                    <div className="text-[11px] text-slate-500">Total Log FA</div>
                    <div className="font-mono-data mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
                      {formatNumber(faRec.totalFaLogs)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                    <div className="text-[11px] text-slate-500">Re-Approve (+Log)</div>
                    <div className="font-mono-data mt-0.5 text-lg font-bold text-blue-700 dark:text-blue-400">
                      +{formatNumber(faRec.extraReapprovalLogs)}
                    </div>
                    <div className="text-[10px] text-slate-500">{faRec.multiApprovedVendorsCount} rekanan</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                    <div className="text-[11px] text-slate-500">Kembali Revisi</div>
                    <div className="font-mono-data mt-0.5 text-lg font-bold text-amber-700 dark:text-amber-400">
                      −{formatNumber(faRec.revertedCount)}
                    </div>
                    <div className="text-[10px] text-slate-500">Unlock pasca lulus</div>
                  </div>
                  <div className="rounded-lg bg-teal-50/80 p-3 dark:bg-teal-950/40">
                    <div className="text-[11px] text-teal-800 dark:text-teal-300">Lulus Terkini</div>
                    <div className="font-mono-data mt-0.5 text-lg font-bold text-teal-800 dark:text-teal-300">
                      {formatNumber(faRec.currentLulusVendors)}
                    </div>
                  </div>
                </div>

                {(faRec.revertedAfterApproved || []).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Rekanan pernah Lulus lalu kembali berproses pasca Unlock (klik untuk cek log):
                    </div>
                    {faRec.revertedAfterApproved.map((r: any) => (
                      <button
                        key={r.idVendor}
                        type="button"
                        onClick={() => onSelectVendor(r.idVendor)}
                        className="flex w-full items-center justify-between rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-left text-xs hover:bg-amber-50 cursor-pointer dark:border-amber-900/50 dark:bg-amber-950/20"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">{r.namaPerusahaan}</span>{' '}
                          <span className="font-mono-data text-[11px] text-slate-500">(ID {r.idVendor})</span>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            Status kini: {r.tindakLanjut} · {r.lastAct}
                          </div>
                        </div>
                        <ExternalLink className="size-3.5 text-amber-700 dark:text-amber-400" />
                      </button>
                    ))}
                  </div>
                )}

                {(faRec.reapprovedExamples || []).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Contoh rekanan Lulus &gt;1x setelah Unlock Edit Data:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {faRec.reapprovedExamples.map((r: any) => (
                        <button
                          key={r.idVendor}
                          type="button"
                          onClick={() => onSelectVendor(r.idVendor)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {r.namaPerusahaan}
                          <span className="font-mono-data font-bold text-blue-700 dark:text-blue-400">
                            {r.faCount}x
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-6 overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Pemicu Utama Lonjakan Historis (Q3 2025, Q1 &amp; Q2 2026)</CardTitle>
                  <CardDescription>
                    Identifikasi bidang pendorong lonjakan grafik tren pada Slide 1
                  </CardDescription>
                </div>
                <Badge tone="navy">Slide 1</Badge>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                      <th className="px-4 py-2.5">Bulan Puncak</th>
                      <th className="px-3 py-2.5 text-right">SLA Verif</th>
                      <th className="px-3 py-2.5 text-right">SLA Revisi</th>
                      <th className="px-3 py-2.5">Bidang Pemicu Terlama</th>
                      <th className="px-4 py-2.5 text-right">Avg Pemicu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.historicalSpikes || []).map((s: any) => (
                      <tr key={s.bulan} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="font-mono-data px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                          {formatMonthShort(s.bulan)} ({s.bulan})
                        </td>
                        <td className="font-mono-data px-3 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-400">
                          {s.verifAvg != null ? `${formatDecimal(s.verifAvg, 2)}h` : '—'}
                        </td>
                        <td className="font-mono-data px-3 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                          {s.rekAvg != null ? `${formatDecimal(s.rekAvg, 2)}h` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone="rose">{s.topDriverBidang}</Badge>
                          <span className="ml-1.5 font-mono-data text-[11px] text-slate-500">
                            (n={formatNumber(s.topDriverCount)})
                          </span>
                        </td>
                        <td className="font-mono-data px-4 py-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                          {s.topDriverAvg != null ? `${formatDecimal(s.topDriverAvg, 1)}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ================= SLIDE 2 EVIDENCE ================= */}
      {showSlide2 && (
        <div className="space-y-5">
          {/* Q7: Mean vs Median vs P90 per Bidang */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <Scale className="size-4" />
                </div>
                <div>
                  <CardTitle>Uji Skewness &amp; Outlier: Mean vs Median vs P90 Antar-Bidang</CardTitle>
                  <CardDescription>
                    Menjawab pertanyaan apakah rata-rata SLA (terutama Keuangan, Legal &amp; Revisi BIM) ditarik oleh segelintir outlier ekstrem
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="cobalt">Slide 2</Badge>
                <Tabs value={distTab} onValueChange={(v) => setDistTab(v as 'verif' | 'revisi')}>
                  <TabsList>
                    <TabsTrigger value="verif">SLA Verifikator</TabsTrigger>
                    <TabsTrigger value="revisi">SLA Revisi Rekanan</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={distChartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="bidang" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} unit="h" />
                    <Tooltip
                      formatter={(val: any, name: string) => [`${formatDecimal(Number(val), 2)} hari`, name]}
                      contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={3} stroke="#0D9488" strokeDasharray="4 4" />
                    <Bar dataKey="median" name="Median (P50)" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                    <Bar dataKey="mean" name="Rata-rata (Mean)" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                    <Bar dataKey="p90" name="Persentil 90 (P90)" fill="#E11D48" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                      <th className="px-4 py-2.5">Bidang</th>
                      <th className="px-3 py-2.5 text-right">Verif Mean</th>
                      <th className="px-3 py-2.5 text-right">Verif Median</th>
                      <th className="px-3 py-2.5 text-right">Verif ≤3h</th>
                      <th className="px-3 py-2.5 text-right">Appr vs Rej (Med)</th>
                      <th className="px-3 py-2.5 text-right">Revisi Mean</th>
                      <th className="px-3 py-2.5 text-right">Revisi Median</th>
                      <th className="px-4 py-2.5 text-right">Revisi &gt;100h</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.distributionByBidang || []).map((d: any) => (
                      <tr key={d.bidang} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">{d.bidang}</td>
                        <td className="font-mono-data px-3 py-2.5 text-right">{formatDecimal(d.verifMean, 2)}h</td>
                        <td className="font-mono-data px-3 py-2.5 text-right font-bold text-teal-700 dark:text-teal-400">
                          {formatDecimal(d.verifMedian, 2)}h
                        </td>
                        <td className="font-mono-data px-3 py-2.5 text-right">{formatPercent(d.verifUnder3Rate)}</td>
                        <td className="font-mono-data px-3 py-2.5 text-right text-slate-600 dark:text-slate-300">
                          {formatDecimal(d.apprMedian, 2)} / {formatDecimal(d.rejMedian, 2)}h
                        </td>
                        <td className="font-mono-data px-3 py-2.5 text-right text-amber-700 dark:text-amber-400 font-semibold">
                          {formatDecimal(d.revMean, 2)}h
                        </td>
                        <td className="font-mono-data px-3 py-2.5 text-right font-bold text-teal-700 dark:text-teal-400">
                          {formatDecimal(d.revMedian, 2)}h
                        </td>
                        <td className="font-mono-data px-4 py-2.5 text-right">
                          <Badge tone={d.revOver100Count > 0 ? 'rose' : 'neutral'}>
                            {formatNumber(d.revOver100Count)} kasus
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Q5 & Q8: CQSMS n=0 Timeline + Internal Review (1.476 Log) Breakdown */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <Card className="xl:col-span-5">
              <CardHeader>
                <div>
                  <CardTitle>Jejak Aktivitas CQSMS/QHSSE (Mengapa Okt+ n=0)</CardTitle>
                  <CardDescription>
                    Log CQSMS/QHSSE berakhir pada {cqsms.lastDate || 'Juni 2025'} ({formatNumber(cqsms.totalLogs)} log total)
                  </CardDescription>
                </div>
                <Badge tone="cobalt">Slide 2</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[230px] w-full">
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart
                      data={(cqsms.timeline || []).map((t: any) => ({
                        bulan: formatMonthShort(t.bulan),
                        totalLogs: t.totalLogs,
                        verifLogs: t.verifLogs,
                      }))}
                      margin={{ top: 8, right: 10, left: -14, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="totalLogs" name="Total Log CQSMS" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                      <Bar dataKey="verifLogs" name="Log Verifikator" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 text-pretty dark:text-slate-400">
                  Sejak Juli 2025 hingga November 2026 tercatat <strong>0 aktivitas</strong> pada tahapan CQSMS/QHSSE, sehingga tidak ada sampel pada kolom Okt+.
                </p>
              </CardContent>
            </Card>

            <Card className="xl:col-span-7 overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>
                    Bedah &ldquo;Internal Review&rdquo; ({formatNumber(data.internalReviewSummary?.totalLogs || 0)} Log)
                  </CardTitle>
                  <CardDescription>
                    Aktivitas internal berturut-turut tanpa revisi vendor di antaranya (catatan kaki Slide 2)
                  </CardDescription>
                </div>
                <Badge tone="cobalt">Slide 2</Badge>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                      <th className="px-4 py-2">Tipe Activity Internal</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Jumlah</th>
                      <th className="px-3 py-2 text-right">Rata-rata</th>
                      <th className="px-4 py-2 text-right">Median</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.internalReviewSummary?.breakdown || []).map((r: any) => (
                      <tr key={`${r.tipeActivity}-${r.hasilStatus}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{r.tipeActivity}</td>
                        <td className="px-3 py-2">
                          <Badge tone={r.hasilStatus === 'Reject' ? 'rose' : 'emerald'}>{r.hasilStatus}</Badge>
                        </td>
                        <td className="font-mono-data px-3 py-2 text-right font-semibold">{formatNumber(r.count)}</td>
                        <td className="font-mono-data px-3 py-2 text-right font-bold text-rose-600 dark:text-rose-400">
                          {r.avgDays != null ? `${formatDecimal(r.avgDays, 2)}h` : '—'}
                        </td>
                        <td className="font-mono-data px-4 py-2 text-right text-slate-600 dark:text-slate-300">
                          {r.medianDays != null ? formatDaysSmart(r.medianDays) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ================= SLIDE 3 EVIDENCE ================= */}
      {showSlide3 && (
        <div className="space-y-5">
          {/* Q9: Parallel Sum vs Wall-Clock Calendar Duration */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                  <Layers className="size-4" />
                </div>
                <div>
                  <CardTitle>Penjelasan Angka Paralel vs Kalender (Kasus WIKA 582h vs 1.112h)</CardTitle>
                  <CardDescription>
                    Karena 4–5 bidang berjalan bersamaan, akumulasi SLA paralel bisa mencapai 1,3x–2,9x durasi kalender (klik batang/baris untuk cek log)
                  </CardDescription>
                </div>
              </div>
              <Badge tone="amber">Slide 3</Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <div className="h-[260px] xl:col-span-6">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={parallelChartData} layout="vertical" margin={{ top: 4, right: 16, left: 6, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} unit="h" axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={155} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                      formatter={(val: any, name: string) => [`${formatDecimal(Number(val), 1)} hari`, name]}
                      contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      dataKey="kalender"
                      name="Kalender (End-to-End)"
                      fill="#0F2744"
                      radius={[0, 4, 4, 0]}
                      barSize={12}
                      isAnimationActive={false}
                      className="cursor-pointer"
                      onClick={(d: any) => d?.idVendor && onSelectVendor(d.idVendor)}
                    />
                    <Bar
                      dataKey="paralelVerif"
                      stackId="par"
                      name="Akum. Paralel Verif"
                      fill="#2563EB"
                      barSize={12}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="paralelRekanan"
                      stackId="par"
                      name="Akum. Paralel Revisi"
                      fill="#D97706"
                      radius={[0, 4, 4, 0]}
                      barSize={12}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200/80 xl:col-span-6 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                      <th className="px-3.5 py-2">Rekanan Ekstrem</th>
                      <th className="px-2.5 py-2 text-right">Kalender</th>
                      <th className="px-2.5 py-2 text-right">Σ Verif</th>
                      <th className="px-2.5 py-2 text-right">Σ Revisi</th>
                      <th className="px-3.5 py-2 text-right">Rasio Paralel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.extremeVendors || []).map((v: any) => (
                      <tr
                        key={v.idVendor}
                        onClick={() => onSelectVendor(v.idVendor)}
                        className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-3.5 py-2 max-w-[200px]">
                          <div className="truncate font-semibold text-slate-900 group-hover:text-[#0F2744] dark:text-white dark:group-hover:text-sky-400">
                            {v.namaPerusahaan}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {v.rejectCount} reject · {v.revisionCount} revisi · {v.tindakLanjut}
                          </div>
                        </td>
                        <td className="font-mono-data px-2.5 py-2 text-right font-bold text-slate-900 dark:text-white">
                          {formatDecimal(v.wallClockDays, 0)}h
                        </td>
                        <td className="font-mono-data px-2.5 py-2 text-right text-blue-700 dark:text-blue-400">
                          {formatDecimal(v.parallelVerifDays, 0)}h
                        </td>
                        <td className="font-mono-data px-2.5 py-2 text-right text-amber-700 dark:text-amber-400">
                          {formatDecimal(v.parallelRekananDays, 0)}h
                        </td>
                        <td className="font-mono-data px-3.5 py-2 text-right">
                          <Badge tone="navy">{formatDecimal(v.overlapRatio, 2)}x</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Q10: Interactive Auto-Drop Policy Simulator */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                  <SlidersHorizontal className="size-4" />
                </div>
                <div>
                  <CardTitle>Simulator Dampak Kebijakan Auto-Drop Revisi Rekanan</CardTitle>
                  <CardDescription>
                    Simulasi langsung dampak penetapan batas waktu revisi (Slide 3: Rencana Aksi Process &amp; Technology) terhadap antrean &amp; SLA
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[14, 30, 60, 90, 180].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setSelectedCap(cap)}
                    className={cn(
                      'font-mono-data rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                      selectedCap === cap
                        ? 'bg-[#0F2744] text-white dark:bg-sky-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    )}
                  >
                    Batas {cap} Hari
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeScenario && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="text-[11px] font-medium text-slate-500">Antrean Revisi Dibersihkan</div>
                    <div className="font-mono-data mt-1 text-xl font-bold text-teal-700 dark:text-teal-400">
                      {formatNumber(activeScenario.droppedActiveVendors)}{' '}
                      <span className="text-xs font-medium text-slate-500">
                        / {formatNumber(activeScenario.totalActiveRev)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      {formatPercent(activeScenario.droppedShare)} antrean menggantung &gt;{activeScenario.capDays}h
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="text-[11px] font-medium text-slate-500">Sisa Antrean Revisi Aktif</div>
                    <div className="font-mono-data mt-1 text-xl font-bold text-slate-900 dark:text-white">
                      {formatNumber(activeScenario.remainingActiveVendors)} akun
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      Benar-benar responsif ≤ {activeScenario.capDays} hari
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="text-[11px] font-medium text-slate-500">Proyeksi SLA Revisi Rekanan</div>
                    <div className="font-mono-data mt-1 text-xl font-bold text-blue-700 dark:text-blue-400">
                      {formatDecimal(activeScenario.projectedRevAvg, 2)} hari
                    </div>
                    <div className="mt-0.5 text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                      Turun −{formatDecimal(activeScenario.revReductionDays, 2)} hr dari{' '}
                      {formatDecimal(activeScenario.baselineRevAvg, 2)} hr
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="text-[11px] font-medium text-slate-500">Log Revisi Ekstrem Terpotong</div>
                    <div className="font-mono-data mt-1 text-xl font-bold text-rose-600 dark:text-rose-400">
                      {formatNumber(activeScenario.revOverCapCount)} log
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      Hanya {formatPercent(activeScenario.revOverCapShare)} dari total log revisi
                    </div>
                  </div>
                </div>
              )}

              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={autoDropChartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} unit="h" />
                    <Tooltip
                      formatter={(val: any, _n: string, props: any) => [
                        `${formatDecimal(Number(val), 2)} hari (${formatNumber(props?.payload?.dibersihkan)} antrean bersih)`,
                        'Proyeksi SLA Revisi',
                      ]}
                      contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                    />
                    <ReferenceLine
                      y={activeScenario?.baselineRevAvg || 11.7}
                      stroke="#E11D48"
                      strokeDasharray="4 4"
                      label={{ value: 'Saat Ini (11,7h)', position: 'insideTopRight', fontSize: 10, fill: '#E11D48' }}
                    />
                    <Bar
                      dataKey="slaProyeksi"
                      name="Proyeksi SLA Revisi (Hari)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                      isAnimationActive={false}
                      className="cursor-pointer"
                      onClick={(d: any) => d?.capDays && setSelectedCap(d.capDays)}
                    >
                      {autoDropChartData.map((entry: any) => (
                        <Cell
                          key={entry.capDays}
                          fill={entry.capDays === selectedCap ? '#0D9488' : '#94A3B8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= RAPID Q&A CHEAT SHEET ================= */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2744]/8 text-[#0F2744] dark:bg-sky-950/60 dark:text-sky-300">
              <HelpCircle className="size-4" />
            </div>
            <div>
              <CardTitle>Panduan Jawaban Cepat (Q&amp;A Cheat-Sheet FGD)</CardTitle>
              <CardDescription>
                Ringkasan 8 pertanyaan kritis yang paling berpotensi muncul dari tiap slide presentasi
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visibleQa.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 font-semibold text-slate-900 dark:text-white">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{item.q}</span>
                </div>
                <Badge
                  tone={item.slide === 'slide1' ? 'navy' : item.slide === 'slide2' ? 'cobalt' : 'amber'}
                  className="shrink-0"
                >
                  {item.slide === 'slide1' ? 'Slide 1' : item.slide === 'slide2' ? 'Slide 2' : 'Slide 3'}
                </Badge>
              </div>
              <div className="mt-2 flex items-start gap-2 text-slate-600 text-pretty leading-relaxed dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>{item.a}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
