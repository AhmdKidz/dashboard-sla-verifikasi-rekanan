import * as XLSX from 'xlsx';

// Audited dummy/test vendor IDs (matches Laporan_SLA_Verifikasi_Rekanan.xlsx curation)
export const DUMMY_IDS = new Set([
  0,        // blank ID / invalid
  1041016,  // DUMMY DATA PERUSAHAAN
  8012565,  // DUMMY HKI
  1080529,  // Hendra Coba saja
  1080822,  // Hendra Coba V2
  1080662,  // hendra hendra
  1080833,  // Hendra Corp (internal dev rapid test)
  8004443,  // Hendra Mandor (internal dev test)
  8014071,  // mandor trial
  1163922,  // Proc Trial
  1164247,  // PT Tech Performa - Testing
  1192578,  // Sumber Bahagia (Dummy)
  1201454,  // Test Bug Circle
  8014148,  // Vendor 2
  1220175,  // Vendor Coba 1
  1220181,  // Vendor Coba 3
  1220183,  // Vendor Coba 4
  1220146,  // Vendor DN Dummy
]);

export const SERIAL_2025_START = 45658; // 2025-01-01
export const SERIAL_2026_APR = 46113;   // 2026-04-01
export const SERIAL_2026_OCT = 46296;   // 2026-10-01

export function serialToDateParts(serial) {
  if (!serial || Number.isNaN(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const totalSeconds = Math.round((serial - Math.floor(serial)) * 86400);
  const d = new Date((utcValue + totalSeconds) * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const quarter = Math.ceil(month / 3);
  return {
    year,
    month,
    day,
    hour,
    minute,
    iso: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`,
    display: `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(minute)}`,
    yearMonth: `${year}-${pad(month)}`,
    triwulan: `Q${quarter} ${year}`,
  };
}

export function getBidang(act) {
  if (!act) return 'Umum';
  if (act.includes('Teknik') || act.includes('Teknis')) return 'Teknik';
  if (act.includes('Keuangan')) return 'Keuangan';
  if (act.includes('Legal')) return 'Legal';
  if (act.includes('BIM')) return 'BIM';
  if (act.includes('CQSMS') || act.includes('QHSSE')) return 'CQSMS/QHSSE';
  if (act.includes('Terseleksi')) return 'Final Approval';
  if (act.includes('Mandor')) return 'Mandor';
  return 'Umum';
}

export function getStatusLabel(st) {
  if (st === 1) return 'Approve';
  if (st === 2) return 'Reject';
  if (st === 0) return 'Reset';
  return String(st);
}

export function extractDivisi(msg) {
  if (!msg) return '';
  const m = String(msg).match(/bekerja pada\s+([^\r\n]+)/i);
  if (m) {
    return m[1].trim().replace(/[.,;]+$/, '');
  }
  const m2 = String(msg).match(/Divisi\s+([A-Za-z0-9 &/\-]+)/i);
  if (m2) {
    return `Divisi ${m2[1].trim()}`.replace(/[.,;]+$/, '');
  }
  return '';
}

export function getPeriode3(serial) {
  if (serial < SERIAL_2026_APR) return 'Periode 1';
  if (serial < SERIAL_2026_OCT) return 'Periode 2';
  return 'Periode 3';
}

export function parseRegistrationWorkbookObject(wb, options = {}) {
  const { exclude2024 = true, excludeDummies = true } = options;

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  let exportTimestamp = '';
  const cellA3 = ws['A3']?.v ? String(ws['A3'].v) : '';
  const tsMatch = cellA3.match(/Tanggal Export\s*:\s*(.+)/i);
  if (tsMatch) exportTimestamp = tsMatch[1].trim();

  const cellA1 = ws['A1']?.v ? String(ws['A1'].v).trim() : '';
  const range = cellA1 === 'No' ? 0 : 4;
  const rawRows = XLSX.utils.sheet_to_json(ws, { range, defval: '' });

  const byId = new Map();
  let dummyRowsRemoved = 0;
  const dummyIdsSeen = new Set();

  for (const r of rawRows) {
    const idV = Number(r['ID Vendor']) || 0;
    let comp = String(r['Nama Perusahaan'] || '').trim().replace(/\u00A0/g, ' ');
    if (!comp) {
      const m = String(r['Message'] || '').match(/Rekanan\s+(?:Mandor\s+)?\((.*?)\)/i);
      if (m) comp = m[1].trim();
    }
    if (excludeDummies && DUMMY_IDS.has(idV)) {
      dummyRowsRemoved++;
      dummyIdsSeen.add(idV);
      continue;
    }
    const ser = Number(r['Message_Tanggal']) || 0;
    if (!ser) continue;

    if (!byId.has(idV)) {
      byId.set(idV, { idV, comp, minSer: ser, maxSer: ser, rows: [] });
    }
    const g = byId.get(idV);
    if (!g.comp && comp) g.comp = comp;
    if (ser < g.minSer) g.minSer = ser;
    if (ser > g.maxSer) g.maxSer = ser;
    g.rows.push({ ...r, _comp: comp, _ser: ser });
  }

  let vendors2024Excluded = 0;
  let rows2024Excluded = 0;
  let dupRemoved = 0;

  const cleanLogs = [];
  const cleanVendors = [];
  const sortedIds = [...byId.keys()].sort((a, b) => a - b);

  let maxDatasetSerial = 0;

  for (const idV of sortedIds) {
    const g = byId.get(idV);
    if (exclude2024 && g.minSer < SERIAL_2025_START) {
      vendors2024Excluded++;
      rows2024Excluded += g.rows.length;
      continue;
    }

    g.rows.sort((a, b) => (a._ser - b._ser) || (Number(a['ID']) - Number(b['ID'])));
    const seen = new Set();
    const ds = [];
    for (const r of g.rows) {
      const minKey = Math.round(r._ser * 1440);
      const act = String(r['Tipe Acitivity'] || r['Tipe Activity'] || '').trim();
      const st = Number(r['Status']);
      const key = `${minKey}|${act}|${st}`;
      if (seen.has(key)) {
        dupRemoved++;
        continue;
      }
      seen.add(key);
      ds.push(r);
    }

    if (ds.length === 0) continue;

    const isMandor = String(idV).startsWith('8');
    const tipeRekanan = isMandor ? 'Mandor' : 'Badan Usaha';

    let divisi = 'Tidak Tercantum';
    for (const r of ds) {
      const found = extractDivisi(r['Message']);
      if (found) {
        divisi = found;
        break;
      }
    }

    let initRow = null;
    let lastUnlockRow = null;
    let lastIntAppRow = null;
    let isLulusState = false;
    let prevRowObj = null;
    let lastByBidang = {};

    let validStartSer = null;
    let finalApproveSer = null;
    let rejectCount = 0;
    let revisionCount = 0;
    let verifSlaDays = 0;
    let rekananSlaDays = 0;
    let internalSlaDays = 0;

    const vendorFirstSer = ds[0]._ser;

    for (let i = 0; i < ds.length; i++) {
      const r = ds[i];
      const seqNo = cleanLogs.length + 1;
      const act = String(r['Tipe Acitivity'] || r['Tipe Activity'] || '').trim();
      const bidang = getBidang(act);
      const st = Number(r['Status']);
      const bl = Number(r['By Login']);
      const ser = r._ser;
      if (ser > maxDatasetSerial) maxDatasetSerial = ser;

      if (!isMandor && act === 'Konfirmasi Selesai' && validStartSer === null) validStartSer = ser;
      if (isMandor && act === 'Konfirmasi Selesai Mandor' && validStartSer === null) validStartSer = ser;
      if (act === 'Approve Rekanan Terseleksi' && st === 1 && finalApproveSer === null) finalApproveSer = ser;

      if (st === 2) rejectCount++;
      if (act.startsWith('Konfirmasi Revisi Selesai')) revisionCount++;

      let matchObj = null;
      let cat = 'Awal Aktivitas';

      if (act === 'Konfirmasi Selesai' || act === 'Konfirmasi Selesai Mandor') {
        if (isLulusState || !prevRowObj) {
          matchObj = null;
          cat = 'Awal Aktivitas';
          if (isLulusState) {
            lastByBidang = {};
            lastUnlockRow = null;
            lastIntAppRow = null;
            isLulusState = false;
          }
        } else {
          matchObj = prevRowObj;
          cat = prevRowObj.bl === 0 ? 'SLA Rekanan' : 'Aktivitas Rekanan';
        }
        initRow = { seqNo, act, st, bl, ser };
      } else if (act.startsWith('Verifikasi ')) {
        const lb = lastByBidang[bidang];
        if (lb && !(lb.bl === 0 && initRow && initRow.ser >= lb.ser)) {
          matchObj = lb;
          cat = lb.bl === 1 ? 'SLA Verifikator' : 'Internal Review';
        } else if (initRow) {
          matchObj = initRow;
          cat = 'SLA Verifikator';
        } else if (lastUnlockRow && i > 0) {
          matchObj = lastUnlockRow;
          cat = 'Internal Review';
        } else {
          matchObj = null;
          cat = 'Awal Aktivitas';
        }
        lastByBidang[bidang] = { seqNo, act, st, bl, ser };
        if (bl === 0 && st === 1) lastIntAppRow = { seqNo, act, st, bl, ser };
      } else if (act.startsWith('Approve ') && act !== 'Approve Rekanan Terseleksi') {
        const lb = lastByBidang[bidang];
        if (lb && !(!lb.act.startsWith('Verifikasi ') && lb.bl === 0 && initRow && initRow.ser >= lb.ser)) {
          matchObj = lb;
          cat = lb.bl === 1 ? 'SLA Verifikator' : 'Internal Approval Bidang';
        } else if (initRow) {
          matchObj = initRow;
          cat = 'SLA Verifikator';
        } else {
          matchObj = null;
          cat = 'Awal Aktivitas';
        }
        lastByBidang[bidang] = { seqNo, act, st, bl, ser };
        if (bl === 0 && st === 1) lastIntAppRow = { seqNo, act, st, bl, ser };
      } else if (act.startsWith('Reject VP ')) {
        const lb = lastByBidang[bidang];
        if (lb) {
          matchObj = lb;
          cat = lb.bl === 1 ? 'SLA Verifikator' : 'Internal Review';
        } else if (prevRowObj) {
          matchObj = prevRowObj;
          cat = prevRowObj.bl === 1 ? 'SLA Verifikator' : 'Internal Review';
        }
        lastByBidang[bidang] = { seqNo, act, st, bl, ser };
      } else if (act.startsWith('Konfirmasi Revisi Selesai')) {
        const lb = lastByBidang[bidang];
        if (lb) {
          matchObj = lb;
          cat = lb.bl === 0 ? 'SLA Rekanan' : 'Aktivitas Rekanan';
        } else if (
          lastUnlockRow &&
          ((prevRowObj && lastUnlockRow.ser >= prevRowObj.ser - 1e-6) ||
            !Object.values(lastByBidang).some((x) => x.ser > lastUnlockRow.ser))
        ) {
          matchObj = lastUnlockRow;
          cat = 'SLA Rekanan';
        } else if (prevRowObj) {
          matchObj = prevRowObj;
          cat = 'Aktivitas Rekanan';
        }
        lastByBidang[bidang] = { seqNo, act, st, bl, ser };
      } else if (act === 'Approve Rekanan Terseleksi') {
        if (lastIntAppRow) {
          matchObj = lastIntAppRow;
          cat = 'SLA Final Approval';
        } else if (initRow) {
          matchObj = initRow;
          cat = 'SLA Final Approval';
        } else if (prevRowObj) {
          matchObj = prevRowObj;
          cat = 'SLA Final Approval';
        }
        if (st === 1) isLulusState = true;
      } else if (act === 'Unlock Edit Data') {
        if (isLulusState || !prevRowObj) {
          matchObj = null;
          cat = 'Awal Aktivitas';
          if (isLulusState) {
            lastByBidang = {};
            initRow = null;
            lastIntAppRow = null;
            isLulusState = false;
          }
        } else {
          matchObj = prevRowObj;
          cat = 'Internal Review';
        }
        lastUnlockRow = { seqNo, act, st, bl, ser };
      } else {
        if (act.startsWith('Reset Verifikasi') && lastByBidang[bidang]) {
          matchObj = lastByBidang[bidang];
          cat = 'Internal Review';
          lastByBidang[bidang] = { seqNo, act, st, bl, ser };
        } else if (prevRowObj) {
          matchObj = prevRowObj;
          if (bl === 1) cat = prevRowObj.bl === 0 ? 'SLA Rekanan' : 'Aktivitas Rekanan';
          else cat = 'Internal Review';
        }
      }

      const slaDays = matchObj ? Math.max(0, ser - matchObj.ser) : null;
      const slaHours = slaDays !== null ? slaDays * 24 : null;

      if (slaDays !== null) {
        if (cat === 'SLA Verifikator') verifSlaDays += slaDays;
        else if (cat === 'SLA Rekanan' || cat === 'Aktivitas Rekanan') rekananSlaDays += slaDays;
        else if (cat === 'Internal Approval Bidang' || cat === 'SLA Final Approval' || cat === 'Internal Review') {
          internalSlaDays += slaDays;
        }
      }

      const chronoGapDays = prevRowObj ? Math.max(0, ser - prevRowObj.ser) : null;
      const chronoGapHours = chronoGapDays !== null ? chronoGapDays * 24 : null;
      const cumulativeDays = Math.max(0, ser - vendorFirstSer);

      const dt = serialToDateParts(ser);
      const pairedDt = matchObj ? serialToDateParts(matchObj.ser) : null;

      cleanLogs.push({
        seqNo,
        logId: Number(r['ID']) || 0,
        idVendor: idV,
        namaPerusahaan: g.comp || `(Vendor ${idV})`,
        tipeRekanan,
        divisi,
        message: String(r['Message'] || ''),
        status: st,
        hasilStatus: getStatusLabel(st),
        messageBy: String(r['Message_by'] || ''),
        serialDate: ser,
        waktuIso: dt ? dt.iso : '',
        waktuDisplay: dt ? dt.display : '',
        periodeBulan: dt ? dt.yearMonth : '',
        triwulan: dt ? dt.triwulan : '',
        kelompokWaktu: ser >= SERIAL_2026_OCT ? 'Oktober 2026 - Sekarang' : 'Sebelum Oktober 2026',
        periode3: getPeriode3(ser),
        tipeSubModul: String(r['Tipe Sub Modul'] || ''),
        tipeActivity: act,
        bidang,
        dariModul: String(r['Dari Modul'] || ''),
        byLogin: bl,
        aktorLogin: bl === 0 ? 'Internal / Verifikator' : 'Vendor / Rekanan',
        pairedPrevAct: matchObj ? matchObj.act : '-',
        pairedPrevWaktu: pairedDt ? pairedDt.display : '',
        slaHours,
        slaDays,
        kategoriAktor: cat,
        chronoPrevAct: prevRowObj ? prevRowObj.act : '-',
        chronoGapHours,
        chronoGapDays,
        cumulativeDays,
      });

      prevRowObj = { seqNo, act, st, bl, ser };
    }

    const lastRow = ds[ds.length - 1];
    const lastAct = String(lastRow['Tipe Acitivity'] || lastRow['Tipe Activity'] || '').trim();
    const lastSt = Number(lastRow['Status']);
    const lastBl = Number(lastRow['By Login']);

    let tindakLanjut = 'Revisi di Rekanan';
    if (lastAct === 'Approve Rekanan Terseleksi' && lastSt === 1) {
      tindakLanjut = 'Lulus Terseleksi';
    } else if (lastBl === 1 || (lastBl === 0 && lastSt === 1 && lastAct !== 'Unlock Edit Data')) {
      tindakLanjut = 'Antrean di Verifikator';
    }

    const startDt = serialToDateParts(ds[0]._ser);
    const endDt = serialToDateParts(lastRow._ser);
    const durDays = Math.max(0, lastRow._ser - ds[0]._ser);
    const approvedDt = tindakLanjut === 'Lulus Terseleksi' ? serialToDateParts(lastRow._ser) : null;

    cleanVendors.push({
      idVendor: idV,
      namaPerusahaan: g.comp || `(Vendor ${idV})`,
      tipeRekanan,
      divisi,
      totalLogs: ds.length,
      startSerial: ds[0]._ser,
      endSerial: lastRow._ser,
      startIso: startDt ? startDt.iso : '',
      endIso: endDt ? endDt.iso : '',
      startMonth: startDt ? startDt.yearMonth : '',
      endMonth: endDt ? endDt.yearMonth : '',
      durDays,
      durHours: durDays * 24,
      firstAct: String(ds[0]['Tipe Acitivity'] || ds[0]['Tipe Activity'] || '').trim(),
      lastAct,
      lastStatus: lastSt,
      lastByLogin: lastBl,
      statusKelulusan: tindakLanjut === 'Lulus Terseleksi' ? 'Lulus Terseleksi' : 'Dalam Proses / Revisi',
      tindakLanjut,
      cleanPassDurDays:
        validStartSer !== null && finalApproveSer !== null && finalApproveSer >= validStartSer
          ? finalApproveSer - validStartSer
          : null,
      hasValidStart: validStartSer !== null ? 1 : 0,
      rejectCount,
      revisionCount,
      verifSlaDays,
      rekananSlaDays,
      internalSlaDays,
      agingDays: 0,
      approvedQuarter: approvedDt ? approvedDt.triwulan : '',
      approvedPeriod3: tindakLanjut === 'Lulus Terseleksi' ? getPeriode3(lastRow._ser) : '',
    });
  }

  for (const v of cleanVendors) {
    v.agingDays = v.tindakLanjut === 'Lulus Terseleksi' ? 0 : Math.max(0, maxDatasetSerial - v.endSerial);
  }

  return {
    meta: {
      exportTimestamp,
      rawRows: rawRows.length,
      dummyIdsRemoved: dummyIdsSeen.size,
      dummyRowsRemoved,
      vendors2024Excluded,
      rows2024Excluded,
      duplicatesRemoved: dupRemoved,
      cleanVendors: cleanVendors.length,
      cleanLogs: cleanLogs.length,
      maxDatasetSerial,
      maxDatasetDate: serialToDateParts(maxDatasetSerial)?.display || '',
    },
    vendors: cleanVendors,
    logs: cleanLogs,
  };
}

function calcStatList(arr) {
  if (!arr.length) return { count: 0, avgDays: null, medianDays: null, p90Days: null, maxDays: null };
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((x, y) => x + y, 0);
  const pct = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return {
    count: s.length,
    avgDays: sum / s.length,
    medianDays: pct(0.5),
    p90Days: pct(0.9),
    maxDays: s[s.length - 1],
  };
}

function intervalCrossesWeekend(endSerial, slaDays) {
  if (slaDays === null || slaDays === undefined) return false;
  const startDay = Math.floor(endSerial - slaDays);
  const endDay = Math.floor(endSerial);
  for (let d = startDay; d <= endDay; d++) {
    const dow = new Date((d - 25569) * 86400 * 1000).getUTCDay();
    if (dow === 0 || dow === 6) return true;
  }
  return false;
}

/**
 * Compute deep-dive diagnostics explaining Final Approval SLA shifts
 * (approver handover, sub-period breakdown, weekend impact, workflow shift, outliers).
 */
export function computeFinalApprovalDiagnostic(faLogs) {
  const valid = (faLogs || []).filter((l) => l.sla_days !== null && l.sla_days !== undefined);
  const beforeLogs = valid.filter((l) => l.kelompok_waktu === 'Sebelum Oktober 2026');
  const afterLogs = valid.filter((l) => l.kelompok_waktu === 'Oktober 2026 - Sekarang');

  // 1. Per-Approver comparison (Before Oct vs Oct+)
  const approverMap = new Map();
  for (const l of valid) {
    const id = l.message_by || '(Kosong)';
    if (!approverMap.has(id)) {
      approverMap.set(id, { approverId: id, before: [], after: [] });
    }
    const bucket = approverMap.get(id);
    if (l.kelompok_waktu === 'Sebelum Oktober 2026') bucket.before.push(l.sla_days);
    else bucket.after.push(l.sla_days);
  }
  const byApprover = [...approverMap.values()]
    .map((a) => {
      const sb = calcStatList(a.before);
      const sa = calcStatList(a.after);
      return {
        approverId: a.approverId,
        countBefore: sb.count,
        avgBefore: sb.avgDays,
        medianBefore: sb.medianDays,
        countAfter: sa.count,
        avgAfter: sa.avgDays,
        medianAfter: sa.medianDays,
        totalCount: sb.count + sa.count,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);

  // 2. 3 Sub-periods (showing exact May/Jun approver transition)
  const subSlices = [
    { id: 'early', label: 'Jan 2025 – Apr 2026', match: (m) => m < '2026-05' },
    { id: 'mid', label: 'Mei 2026 – Sep 2026', match: (m) => m >= '2026-05' && m < '2026-10' },
    { id: 'oct', label: 'Okt 2026 – Skrg', match: (m) => m >= '2026-10' },
  ];
  const subPeriods = subSlices.map((sl) => {
    const rows = valid.filter((l) => sl.match(l.periode_bulan));
    const st = calcStatList(rows.map((r) => r.sla_days));
    const userCounts = new Map();
    for (const r of rows) {
      const u = r.message_by || '-';
      userCounts.set(u, (userCounts.get(u) || 0) + 1);
    }
    const topUser = [...userCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    return {
      id: sl.id,
      label: sl.label,
      ...st,
      dominantApprover: topUser ? topUser[0] : '-',
      dominantShare: topUser && rows.length ? topUser[1] / rows.length : 0,
    };
  });

  // 3. Oct+ Breakdown: Weekend crossing & Preceding workflow stage
  const weekdayDurs = [];
  const weekendDurs = [];
  const fromApproveDurs = [];
  const fromVerifDurs = [];
  const beforeApproveCount = beforeLogs.filter((l) => String(l.paired_prev_act || '').startsWith('Approve ')).length;
  const beforeVerifCount = beforeLogs.filter((l) => String(l.paired_prev_act || '').startsWith('Verifikasi ')).length;

  for (const l of afterLogs) {
    if (intervalCrossesWeekend(l.serial_date, l.sla_days)) weekendDurs.push(l.sla_days);
    else weekdayDurs.push(l.sla_days);

    const prev = String(l.paired_prev_act || '');
    if (prev.startsWith('Approve ')) fromApproveDurs.push(l.sla_days);
    else if (prev.startsWith('Verifikasi ')) fromVerifDurs.push(l.sla_days);
  }

  // 4. Top 5 slowest Final Approval cases in Oct+
  const topOutliersOct = [...afterLogs]
    .sort((a, b) => b.sla_days - a.sla_days)
    .slice(0, 5)
    .map((l) => ({
      idVendor: l.id_vendor,
      namaPerusahaan: l.nama_perusahaan,
      slaDays: l.sla_days,
      slaHours: l.sla_hours,
      waktuDisplay: l.waktu_display,
      messageBy: l.message_by,
      pairedPrevAct: l.paired_prev_act,
      pairedPrevWaktu: l.paired_prev_waktu,
    }));

  return {
    beforeStats: calcStatList(beforeLogs.map((l) => l.sla_days)),
    afterStats: calcStatList(afterLogs.map((l) => l.sla_days)),
    byApprover,
    subPeriods,
    octBreakdown: {
      weekdayOnly: calcStatList(weekdayDurs),
      crossWeekend: calcStatList(weekendDurs),
      fromApproveBidang: calcStatList(fromApproveDurs),
      fromVerifikasi: calcStatList(fromVerifDurs),
      beforeApproveCount,
      beforeVerifCount,
    },
    topOutliersOct,
  };
}
