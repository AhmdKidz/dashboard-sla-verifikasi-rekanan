import { useEffect, useState } from 'react';
import { api, type GlobalFilters } from '@/lib/api';
import { Layout, type NavPage } from '@/components/Layout';
import { VendorDrawer } from '@/components/VendorDrawer';
import { EmptyDatabaseState } from '@/components/StateViews';
import { OverviewPage } from '@/pages/OverviewPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { TrackerPage } from '@/pages/TrackerPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { DivisionRevisionPage } from '@/pages/DivisionRevisionPage';
import { FgdDefensePage } from '@/pages/FgdDefensePage';
import { VerifierDataPage } from '@/pages/VerifierDataPage';

export function App() {
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [filters, setFilters] = useState<GlobalFilters>({
    tipe: 'ALL',
    divisi: 'ALL',
    periode: 'ALL',
  });
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [pendingQueueFilter, setPendingQueueFilter] = useState<string | null>(null);
  const [datasetMeta, setDatasetMeta] = useState<Record<string, string>>({});
  const [divisiOptions, setDivisiOptions] = useState<{ divisi: string; count: number }[]>([]);
  const [dbSizeBytes, setDbSizeBytes] = useState(0);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sla-theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('sla-theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  const loadMeta = () => {
    api
      .getMeta()
      .then((res) => {
        setDatasetMeta(res.meta || {});
        setDivisiOptions(res.divisiList || []);
        setDbSizeBytes(res.dbSizeBytes || 0);
      })
      .catch(() => {
        // Error states handled by individual pages
      })
      .finally(() => setMetaLoaded(true));
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const handleQuickFilterQueue = (tindakLanjut: string) => {
    setPendingQueueFilter(tindakLanjut);
    setActivePage('tracker');
  };

  const isEmptyDb = metaLoaded && Number(datasetMeta.cleanVendors || 0) === 0 && activePage !== 'verifiers';

  return (
    <>
      <Layout
        activePage={activePage}
        onNavigate={setActivePage}
        filters={filters}
        onChangeFilters={setFilters}
        divisiOptions={divisiOptions}
        datasetMeta={datasetMeta}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      >
        {isEmptyDb ? (
          <EmptyDatabaseState onImported={loadMeta} onGoToImport={() => setActivePage('verifiers')} />
        ) : (
          <>
            {activePage === 'overview' && (
              <OverviewPage
                filters={filters}
                onSelectVendor={setSelectedVendorId}
                onNavigate={setActivePage}
                onQuickFilterQueue={handleQuickFilterQueue}
              />
            )}
            {activePage === 'leaderboard' && (
              <LeaderboardPage
                divisiOptions={divisiOptions}
                onSelectVendor={setSelectedVendorId}
              />
            )}
            {activePage === 'tracker' && (
              <TrackerPage
                divisiOptions={divisiOptions}
                initialQueueFilter={pendingQueueFilter}
                onClearInitialQueue={() => setPendingQueueFilter(null)}
                onSelectVendor={setSelectedVendorId}
              />
            )}
            {activePage === 'analytics' && (
              <AnalyticsPage filters={filters} onSelectVendor={setSelectedVendorId} />
            )}
            {activePage === 'divisions' && (
              <DivisionRevisionPage
                filters={filters}
                onSelectVendor={setSelectedVendorId}
              />
            )}
            {activePage === 'fgd' && (
              <FgdDefensePage
                filters={filters}
                onSelectVendor={setSelectedVendorId}
              />
            )}
            {activePage === 'verifiers' && (
              <VerifierDataPage
                filters={filters}
                datasetMeta={datasetMeta}
                dbSizeBytes={dbSizeBytes}
                onDatasetUpdated={loadMeta}
                onSelectVendor={setSelectedVendorId}
              />
            )}
          </>
        )}
      </Layout>

      <VendorDrawer vendorId={selectedVendorId} onClose={() => setSelectedVendorId(null)} />
    </>
  );
}

export default App;
