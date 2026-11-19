export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('id-ID').format(Math.round(val));
}

export function formatDecimal(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(val);
}

export function formatPercent(val: number | null | undefined, digits = 1): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return `${formatDecimal(val * 100, digits)}%`;
}

export function formatDaysSmart(days: number | null | undefined): string {
  if (days === null || days === undefined || Number.isNaN(days)) return '—';
  if (days === 0) return '0 jam';
  if (days < 1) {
    const hours = days * 24;
    if (hours < 1) {
      const mins = Math.max(1, Math.round(hours * 60));
      return `${mins} mnt`;
    }
    return `${formatDecimal(hours, 1)} jam`;
  }
  if (days < 10) return `${formatDecimal(days, 2)} hari`;
  return `${formatDecimal(days, 1)} hari`;
}

export function formatDurationDetailed(days: number | null | undefined): string {
  if (days === null || days === undefined || Number.isNaN(days)) return '—';
  if (days < 1) {
    const hours = days * 24;
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} menit`;
    return `0 hari (${formatDecimal(hours, 1)} jam)`;
  }
  const wholeDays = Math.floor(days);
  const remHours = Math.round((days - wholeDays) * 24);
  if (remHours === 0) return `${formatNumber(wholeDays)} hari`;
  return `${formatNumber(wholeDays)} hari ${remHours} jam`;
}

export function formatDeltaDays(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return '—';
  const sign = delta > 0 ? '+' : '';
  if (Math.abs(delta) < 1) {
    const h = Math.round(delta * 24);
    return `${sign}${h} jam`;
  }
  return `${sign}${formatDecimal(delta, 2)} hari`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMonthShort(ym: string): string {
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${names[idx]} ${y.slice(2)}`;
}
