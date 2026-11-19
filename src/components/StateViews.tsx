import { AlertTriangle, RotateCcw, SearchX, Database } from 'lucide-react';
import { Button, Card, CardContent, Skeleton } from '@/components/ui/primitives';

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

export function EmptyDatabaseState({ onGoToImport }: { onGoToImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="flex size-12 items-center justify-center rounded-xl bg-[#0F2744]/10 text-[#0F2744] dark:bg-sky-900/40 dark:text-sky-300">
        <Database className="size-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        Database Lokal Belum Berisi Data Log
      </h3>
      <p className="mt-1 max-w-md text-xs text-slate-500 text-pretty dark:text-slate-400">
        Unggah file Excel history registrasi rekanan (.xlsx) untuk mulai melacak SLA verifikator, revisi rekanan, dan
        durasi siklus Badan Usaha maupun Mandor.
      </p>
      <Button variant="primary" size="md" className="mt-5" onClick={onGoToImport}>
        Impor File Excel Sekarang
      </Button>
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
