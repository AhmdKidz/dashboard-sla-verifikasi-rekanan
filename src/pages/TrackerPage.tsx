import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { api, type VendorRow } from '@/lib/api';
import { formatDaysSmart, formatNumber } from '@/lib/format';
import { Button, Card, FilterSelect } from '@/components/ui/primitives';
import { StatusPill, TipePill } from '@/components/VendorDrawer';
import { EmptyFilterState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { cn } from '@/lib/utils';

const columnHelper = createColumnHelper<VendorRow>();

export function TrackerPage({
  divisiOptions,
  initialQueueFilter,
  onClearInitialQueue,
  onSelectVendor,
}: {
  divisiOptions: { divisi: string; count: number }[];
  initialQueueFilter: string | null;
  onClearInitialQueue: () => void;
  onSelectVendor: (idVendor: number) => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [tipe, setTipe] = useState('ALL');
  const [divisi, setDivisi] = useState('ALL');
  const [tindakLanjut, setTindakLanjut] = useState(initialQueueFilter || 'ALL');
  const [revisionBand, setRevisionBand] = useState('ALL');
  const [sortBy, setSortBy] = useState('dur_days');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [rows, setRows] = useState<VendorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQueueFilter) {
      setTindakLanjut(initialQueueFilter);
      setPage(1);
      onClearInitialQueue();
    }
  }, [initialQueueFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadVendors = () => {
    setLoading(true);
    setError(null);
    api
      .getVendors({
        page,
        pageSize,
        search,
        tipe,
        divisi,
        tindakLanjut,
        revisionBand,
        sortBy,
        sortDir,
      })
      .then((res) => {
        setRows(res.items);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVendors();
  }, [page, pageSize, search, tipe, divisi, tindakLanjut, revisionBand, sortBy, sortDir]);

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const resetAll = () => {
    setSearchInput('');
    setSearch('');
    setTipe('ALL');
    setDivisi('ALL');
    setTindakLanjut('ALL');
    setRevisionBand('ALL');
    setSortBy('dur_days');
    setSortDir('desc');
    setPage(1);
  };

  const hasFilter =
    search !== '' || tipe !== 'ALL' || divisi !== 'ALL' || tindakLanjut !== 'ALL' || revisionBand !== 'ALL';

  const columns = useMemo(
    () => [
      columnHelper.accessor('nama_perusahaan', {
        header: 'Rekanan & ID',
        cell: (info) => {
          const v = info.row.original;
          return (
            <div className="max-w-[260px]">
              <div className="truncate font-semibold text-slate-900 dark:text-slate-100" title={v.nama_perusahaan}>
                {v.nama_perusahaan}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="font-mono-data">ID {v.id_vendor}</span>
                <span>·</span>
                <span className="truncate">{v.divisi}</span>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('tipe_rekanan', {
        header: 'Tipe',
        cell: (info) => <TipePill tipe={info.getValue()} />,
      }),
      columnHelper.accessor('tindak_lanjut', {
        header: 'Status Siklus',
        cell: (info) => {
          const v = info.row.original;
          return (
            <div>
              <StatusPill status={info.getValue()} />
              <div className="mt-0.5 max-w-[190px] truncate text-[11px] text-slate-500" title={v.last_act}>
                {v.last_act}
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('total_logs', {
        header: 'Log',
        cell: (info) => <span className="font-mono-data font-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('reject_count', {
        header: 'Reject / Revisi',
        cell: (info) => {
          const v = info.row.original;
          return (
            <div className="font-mono-data text-xs">
              <span className={v.reject_count > 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
                {v.reject_count}R
              </span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
              <span className={v.revision_count > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-400'}>
                {v.revision_count} rev
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('verif_sla_days', {
        header: 'Akum. Verif',
        cell: (info) => (
          <span className="font-mono-data text-blue-700 dark:text-blue-400">
            {info.getValue() > 0 ? formatDaysSmart(info.getValue()) : '—'}
          </span>
        ),
      }),
      columnHelper.accessor('rekanan_sla_days', {
        header: 'Akum. Revisi',
        cell: (info) => (
          <span className="font-mono-data text-amber-700 dark:text-amber-400">
            {info.getValue() > 0 ? formatDaysSmart(info.getValue()) : '—'}
          </span>
        ),
      }),
      columnHelper.accessor('dur_days', {
        header: 'Durasi Total',
        cell: (info) => {
          const v = info.row.original;
          return (
            <div>
              <div className="font-mono-data font-bold text-slate-900 dark:text-white">
                {formatDaysSmart(v.dur_days)}
              </div>
              <div className="font-mono-data text-[10px] text-slate-400">
                {v.start_iso.slice(0, 10)} → {v.end_iso.slice(0, 10)}
              </div>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'action',
        header: '',
        cell: (info) => (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectVendor(info.row.original.id_vendor);
            }}
          >
            <Eye className="size-3.5" />
            Lacak Log
          </Button>
        ),
      }),
    ],
    [onSelectVendor]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
  });

  const sortableCols = new Set([
    'nama_perusahaan',
    'total_logs',
    'reject_count',
    'verif_sla_days',
    'rekanan_sla_days',
    'dur_days',
  ]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama perusahaan, nama mandor, ID vendor, atau aktivitas terakhir..."
              aria-label="Cari rekanan"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F2744] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <FilterSelect
            ariaLabel="Filter Tipe Rekanan"
            value={tipe}
            onValueChange={(v) => {
              setTipe(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Tipe' },
              { value: 'Badan Usaha', label: 'Badan Usaha' },
              { value: 'Mandor', label: 'Mandor' },
            ]}
          />

          <FilterSelect
            ariaLabel="Filter Divisi"
            value={divisi}
            onValueChange={(v) => {
              setDivisi(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Divisi' },
              ...divisiOptions.map((d) => ({ value: d.divisi, label: `${d.divisi} (${d.count})` })),
            ]}
          />

          <FilterSelect
            ariaLabel="Filter Status Tindak Lanjut"
            value={tindakLanjut}
            onValueChange={(v) => {
              setTindakLanjut(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Status' },
              { value: 'Lulus Terseleksi', label: 'Lulus Terseleksi' },
              { value: 'Antrean di Verifikator', label: 'Antrean di Verifikator' },
              { value: 'Revisi di Rekanan', label: 'Revisi di Rekanan' },
            ]}
          />

          <FilterSelect
            ariaLabel="Filter Frekuensi Revisi"
            value={revisionBand}
            onValueChange={(v) => {
              setRevisionBand(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Revisi' },
              { value: '0', label: 'Tanpa Revisi (0)' },
              { value: '1-3', label: '1 – 3x Revisi' },
              { value: '4-10', label: '4 – 10x Revisi' },
              { value: '10+', label: '> 10x Revisi' },
            ]}
          />

          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>
            Menampilkan <strong className="font-mono-data text-slate-900 dark:text-white">{formatNumber(total)}</strong> rekanan
            {hasFilter ? ' sesuai filter' : ''}. Klik baris mana pun untuk membuka timeline jarak antar-log.
          </span>
          <div className="flex items-center gap-2">
            <span>Urutkan:</span>
            <FilterSelect
              ariaLabel="Urutkan rekanan"
              value={`${sortBy}:${sortDir}`}
              onValueChange={(v) => {
                const [col, dir] = v.split(':');
                setSortBy(col);
                setSortDir(dir as 'asc' | 'desc');
                setPage(1);
              }}
              options={[
                { value: 'dur_days:desc', label: 'Durasi Terlama' },
                { value: 'dur_days:asc', label: 'Durasi Tercepat' },
                { value: 'aging_days:desc', label: 'Aging Antrean Terlama' },
                { value: 'reject_count:desc', label: 'Reject Terbanyak' },
                { value: 'revision_count:desc', label: 'Revisi Terbanyak' },
                { value: 'total_logs:desc', label: 'Aktivitas Log Terbanyak' },
                { value: 'end_serial:desc', label: 'Aktivitas Terbaru' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Main TanStack Table */}
      {error ? (
        <ErrorState message={error} onRetry={loadVendors} />
      ) : loading ? (
        <TableSkeleton rows={10} />
      ) : rows.length === 0 ? (
        <EmptyFilterState onAction={resetAll} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300"
                  >
                    {hg.headers.map((header) => {
                      const colId = header.column.id;
                      const isSortable = sortableCols.has(colId);
                      return (
                        <th key={header.id} className="whitespace-nowrap px-4 py-3">
                          {isSortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(colId)}
                              className={cn(
                                'inline-flex items-center gap-1 cursor-pointer hover:text-slate-900 dark:hover:text-white',
                                sortBy === colId && 'text-[#0F2744] dark:text-sky-400'
                              )}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ArrowUpDown className="size-3" />
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onSelectVendor(row.original.id_vendor)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span>Baris per halaman:</span>
              <FilterSelect
                ariaLabel="Jumlah baris per halaman"
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
                options={[
                  { value: '15', label: '15' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-slate-600 dark:text-slate-400">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
