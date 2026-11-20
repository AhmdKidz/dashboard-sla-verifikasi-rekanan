import React, { useState } from 'react';
import {
  LayoutDashboard,
  Trophy,
  SearchCheck,
  BarChart3,
  GitFork,
  UserCheck,
  ShieldAlert,
  Download,
  Moon,
  Sun,
  Menu,
  X,
  RotateCcw,
} from 'lucide-react';
import { api, getRuntimeMode, type GlobalFilters } from '@/lib/api';
import { Button, FilterSelect } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export type NavPage = 'overview' | 'leaderboard' | 'tracker' | 'analytics' | 'divisions' | 'fgd' | 'verifiers';

const NAV_ITEMS: { id: NavPage; label: string; shortDesc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Ringkasan Eksekutif', shortDesc: 'KPI, tren & bottleneck utama', icon: LayoutDashboard },
  { id: 'leaderboard', label: 'Top 10 Tercepat & Terlama', shortDesc: 'Badan Usaha & Mandor', icon: Trophy },
  { id: 'tracker', label: 'Pelacak Rekanan & Log', shortDesc: 'Lacak siklus & jarak antar-log', icon: SearchCheck },
  { id: 'analytics', label: 'Analisa Bidang & Periode', shortDesc: 'Bulanan, triwulan & 3 periode', icon: BarChart3 },
  { id: 'divisions', label: 'Divisi, Revisi & Antrean', shortDesc: 'Performa divisi & aging queue', icon: GitFork },
  { id: 'fgd', label: 'Antisipasi Q&A FGD', shortDesc: 'Bukti audit, median & auto-drop', icon: ShieldAlert },
  { id: 'verifiers', label: 'Verifikator & Data Lokal', shortDesc: 'SLA verifikator & impor Excel', icon: UserCheck },
];

export function Layout({
  activePage,
  onNavigate,
  filters,
  onChangeFilters,
  divisiOptions,
  datasetMeta,
  darkMode,
  onToggleDarkMode,
  children,
}: {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  filters: GlobalFilters;
  onChangeFilters: (next: GlobalFilters) => void;
  divisiOptions: { divisi: string; count: number }[];
  datasetMeta: Record<string, string>;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hasActiveFilter = filters.tipe !== 'ALL' || filters.divisi !== 'ALL' || filters.periode !== 'ALL';
  const currentNav = NAV_ITEMS.find((n) => n.id === activePage) || NAV_ITEMS[0];

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-[#0F2744] text-slate-100">
      {/* Brand */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
            <img
              src="./logo-hk.png"
              alt="Logo Hutama Karya"
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-tight text-white">SLA Verifikasi</div>
            <div className="truncate text-[11px] text-slate-300">Command Center Rekanan</div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Navigasi utama" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMobileMenuOpen(false);
              }}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 cursor-pointer',
                isActive
                  ? 'bg-white/14 text-white'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#C81E2B]" />
              )}
              <Icon
                className={cn(
                  'size-4 shrink-0',
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight">{item.label}</div>
                <div className="truncate text-[11px] text-slate-400 leading-tight mt-0.5">
                  {item.shortDesc}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Local DB Freshness Footer */}
      <div className="border-t border-white/10 p-3.5 text-[11px] text-slate-300">
        <div className="rounded-lg bg-white/7 px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-white">
              {getRuntimeMode() === 'server' ? 'SQLite Lokal Aktif' : 'IndexedDB Browser Aktif'}
            </span>
            <span className="inline-flex size-2 rounded-full bg-emerald-400" />
          </div>
          <div className="font-mono-data text-slate-300">
            {Number(datasetMeta.cleanVendors || 0).toLocaleString('id-ID')} rekanan ·{' '}
            {Number(datasetMeta.cleanLogs || 0).toLocaleString('id-ID')} log
          </div>
          {datasetMeta.maxDatasetDate && (
            <div className="text-[10px] text-slate-400">Data s.d. {datasetMeta.maxDatasetDate}</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#F6F7F9] dark:bg-[#0B1120]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{renderSidebarContent()}</aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw]">{renderSidebarContent()}</aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="outline"
                size="icon"
                aria-label="Buka menu navigasi"
                className="lg:hidden shrink-0"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-slate-900 text-balance sm:text-lg dark:text-white">
                  {currentNav.label}
                </h1>
              </div>
            </div>

            {/* Global Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {activePage !== 'leaderboard' && activePage !== 'tracker' && (
                <>
                  <FilterSelect
                    ariaLabel="Filter Tipe Rekanan"
                    value={filters.tipe}
                    onValueChange={(val) => onChangeFilters({ ...filters, tipe: val as GlobalFilters['tipe'] })}
                    options={[
                      { value: 'ALL', label: 'Semua Rekanan' },
                      { value: 'Badan Usaha', label: 'Badan Usaha' },
                      { value: 'Mandor', label: 'Mandor' },
                    ]}
                  />
                  <FilterSelect
                    ariaLabel="Filter Divisi"
                    value={filters.divisi}
                    onValueChange={(val) => onChangeFilters({ ...filters, divisi: val })}
                    options={[
                      { value: 'ALL', label: 'Semua Divisi' },
                      ...divisiOptions.map((d) => ({
                        value: d.divisi,
                        label: `${d.divisi} (${d.count})`,
                      })),
                    ]}
                  />
                  <FilterSelect
                    ariaLabel="Filter Periode"
                    value={filters.periode}
                    onValueChange={(val) =>
                      onChangeFilters({ ...filters, periode: val as GlobalFilters['periode'] })
                    }
                    options={[
                      { value: 'ALL', label: 'Semua Periode (2025–2026)' },
                      { value: 'Periode 1', label: 'Periode 1 (Jan 25–Mar 26)' },
                      { value: 'Periode 2', label: 'Periode 2 (Apr–Sep 26)' },
                      { value: 'Periode 3', label: 'Periode 3 (Okt–Nov 26)' },
                    ]}
                  />
                  {hasActiveFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onChangeFilters({ tipe: 'ALL', divisi: 'ALL', periode: 'ALL' })}
                    >
                      <RotateCcw className="size-3.5" />
                      Reset
                    </Button>
                  )}
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => api.downloadVendorsExcel(filters)}
                disabled={Number(datasetMeta.cleanVendors || 0) === 0}
                title="Ekspor data siklus rekanan sesuai filter ke Excel (.xlsx)"
                className="h-9"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Ekspor .xlsx</span>
              </Button>

              <Button
                variant="outline"
                size="icon"
                aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
                onClick={onToggleDarkMode}
              >
                {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </div>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-7">
          <div className="mx-auto max-w-[1440px] space-y-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
