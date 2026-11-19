import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, SearchX, Database, Upload, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardContent, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function ErrorState({
  title = 'Gagal memuat data dashboard',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20">
      <CardContent className="flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {message || 'Server API lokal tidak merespons. Pastikan backend lokal aktif di port 3001.'}
            </p>
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={onRetry}>
          <RotateCcw className="size-3.5" />
          Coba Lagi
        </Button>
      </CardContent>
    </Card>
  );
}

export function EmptyFilterState({
  title = 'Tidak ada rekanan yang cocok dengan filter',
  description = 'Coba ubah kata kunci pencarian atau reset filter untuk melihat seluruh data registrasi rekanan.',
  actionLabel = 'Reset Semua Filter',
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <SearchX className="size-5" />
      </div>
      <h4 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      <p className="mt-1 max-w-md text-xs text-slate-500 text-pretty dark:text-slate-400">{description}</p>
      <Button variant="primary" size="sm" className="mt-4" onClick={onAction}>
        <RotateCcw className="size-3.5" />
        {actionLabel}
      </Button>
    </div>
  );
}

export function EmptyDatabaseState({
  onImported,
  onGoToImport,
}: {
  onImported?: () => void;
  onGoToImport: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exclude2024, setExclude2024] = useState(true);
  const [excludeDummies, setExcludeDummies] = useState(true);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      await api.importExcel(file, { exclude2024, excludeDummies });
      onImported?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal membaca file Excel.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-10 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[#0F2744]/10 text-[#0F2744] dark:bg-sky-900/40 dark:text-sky-300">
        <Database className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
        Muat Data History Registrasi Rekanan (.xlsx)
      </h3>
      <p className="mx-auto mt-1.5 max-w-lg text-xs text-slate-500 text-pretty dark:text-slate-400">
        Pilih file <code className="font-mono-data">history_registrasi_rekanan*.xlsx</code> dari komputer Anda untuk
        langsung menampilkan seluruh KPI, Top 10 Tercepat/Terlama, analisa bidang, dan pelacak jarak antar-log.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs text-slate-700 dark:text-slate-300">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={exclude2024}
            onChange={(e) => setExclude2024(e.target.checked)}
            className="size-3.5 rounded accent-[#0F2744]"
          />
          Khusus rekanan 2025+ (standar SLA)
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={excludeDummies}
            onChange={(e) => setExcludeDummies(e.target.checked)}
            className="size-3.5 rounded accent-[#0F2744]"
          />
          Bersihkan 18 ID Dummy / Testing
        </label>
      </div>

      <label
        className={cn(
          'mt-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 transition-colors cursor-pointer hover:border-[#0F2744] hover:bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-sky-500',
          importing && 'pointer-events-none opacity-60'
        )}
      >
        <Upload className="size-7 text-[#0F2744] dark:text-sky-400" />
        <span className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {importing
            ? 'Sedang memproses & menyimpan ke IndexedDB browser...'
            : 'Klik untuk memilih file Excel (.xlsx)'}
        </span>
        <span className="mt-1 text-[11px] text-slate-500">
          Data tersimpan permanen di IndexedDB browser sehingga tidak perlu unggah ulang saat refresh
        </span>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" disabled={importing} />
      </label>

      {errorMsg && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
          {errorMsg}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
          <ShieldCheck className="size-4 shrink-0" />
          100% Lokal di Browser — file Excel Anda tidak pernah diunggah ke server eksternal.
        </span>
        <button
          type="button"
          onClick={onGoToImport}
          className="font-medium text-slate-600 hover:underline cursor-pointer dark:text-slate-300"
        >
          Pengaturan Impor Lengkap →
        </button>
      </div>
    </div>
  );
}

export function KpiSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="size-7 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-2.5 h-3 w-44" />
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 'h-72' }: { height?: string }) {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-52" />
      <Skeleton className="mt-1.5 h-3 w-72" />
      <Skeleton className={`mt-5 w-full rounded-lg ${height}`} />
    </Card>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}
