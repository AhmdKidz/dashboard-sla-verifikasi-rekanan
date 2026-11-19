import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_DIR = path.resolve(__dirname, '..', 'data');
export const DB_PATH = path.join(DB_DIR, 'sla_rekanan.db');

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA temp_store = MEMORY;');
  initSchema(db);
  dbInstance = db;
  return db;
}

export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id_vendor INTEGER PRIMARY KEY,
      nama_perusahaan TEXT NOT NULL,
      tipe_rekanan TEXT NOT NULL,
      divisi TEXT NOT NULL,
      total_logs INTEGER NOT NULL,
      start_serial REAL NOT NULL,
      end_serial REAL NOT NULL,
      start_iso TEXT NOT NULL,
      end_iso TEXT NOT NULL,
      start_month TEXT NOT NULL,
      end_month TEXT NOT NULL,
      dur_days REAL NOT NULL,
      dur_hours REAL NOT NULL,
      first_act TEXT NOT NULL,
      last_act TEXT NOT NULL,
      last_status INTEGER NOT NULL,
      last_by_login INTEGER NOT NULL,
      status_kelulusan TEXT NOT NULL,
      tindak_lanjut TEXT NOT NULL,
      clean_pass_dur_days REAL,
      has_valid_start INTEGER NOT NULL,
      reject_count INTEGER NOT NULL,
      revision_count INTEGER NOT NULL,
      verif_sla_days REAL NOT NULL,
      rekanan_sla_days REAL NOT NULL,
      internal_sla_days REAL NOT NULL,
      aging_days REAL NOT NULL,
      approved_quarter TEXT NOT NULL,
      approved_period3 TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      seq_no INTEGER PRIMARY KEY,
      log_id INTEGER NOT NULL,
      id_vendor INTEGER NOT NULL,
      nama_perusahaan TEXT NOT NULL,
      tipe_rekanan TEXT NOT NULL,
      divisi TEXT NOT NULL,
      message TEXT NOT NULL,
      status INTEGER NOT NULL,
      hasil_status TEXT NOT NULL,
      message_by TEXT NOT NULL,
      serial_date REAL NOT NULL,
      waktu_iso TEXT NOT NULL,
      waktu_display TEXT NOT NULL,
      periode_bulan TEXT NOT NULL,
      triwulan TEXT NOT NULL,
      kelompok_waktu TEXT NOT NULL,
      periode_3 TEXT NOT NULL,
      tipe_sub_modul TEXT NOT NULL,
      tipe_activity TEXT NOT NULL,
      bidang TEXT NOT NULL,
      dari_modul TEXT NOT NULL,
      by_login INTEGER NOT NULL,
      aktor_login TEXT NOT NULL,
      paired_prev_act TEXT NOT NULL,
      paired_prev_waktu TEXT NOT NULL,
      sla_hours REAL,
      sla_days REAL,
      kategori_aktor TEXT NOT NULL,
      chrono_prev_act TEXT NOT NULL,
      chrono_gap_hours REAL,
      chrono_gap_days REAL,
      cumulative_days REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vendors_tipe ON vendors(tipe_rekanan);
    CREATE INDEX IF NOT EXISTS idx_vendors_divisi ON vendors(divisi);
    CREATE INDEX IF NOT EXISTS idx_vendors_tindak ON vendors(tindak_lanjut);
    CREATE INDEX IF NOT EXISTS idx_vendors_dur ON vendors(dur_days);
    CREATE INDEX IF NOT EXISTS idx_vendors_aging ON vendors(aging_days);

    CREATE INDEX IF NOT EXISTS idx_logs_vendor_date ON logs(id_vendor, serial_date);
    CREATE INDEX IF NOT EXISTS idx_logs_bidang ON logs(bidang);
    CREATE INDEX IF NOT EXISTS idx_logs_bulan ON logs(periode_bulan);
    CREATE INDEX IF NOT EXISTS idx_logs_kat ON logs(kategori_aktor);
    CREATE INDEX IF NOT EXISTS idx_logs_msgby ON logs(message_by);
    CREATE INDEX IF NOT EXISTS idx_logs_tipe ON logs(tipe_rekanan);
    CREATE INDEX IF NOT EXISTS idx_logs_divisi ON logs(divisi);
    CREATE INDEX IF NOT EXISTS idx_logs_periode3 ON logs(periode_3);
    CREATE INDEX IF NOT EXISTS idx_logs_triwulan ON logs(triwulan);
  `);
}

export function replaceDatabaseContents(db, parsed, sourceFileName) {
  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec('DELETE FROM logs; DELETE FROM vendors; DELETE FROM meta;');

    const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    const metaEntries = {
      ...parsed.meta,
      sourceFile: sourceFileName,
      importedAt: new Date().toISOString(),
    };
    for (const [k, v] of Object.entries(metaEntries)) {
      insertMeta.run(k, String(v ?? ''));
    }

    const insertVendor = db.prepare(`
      INSERT INTO vendors (
        id_vendor, nama_perusahaan, tipe_rekanan, divisi, total_logs,
        start_serial, end_serial, start_iso, end_iso, start_month, end_month,
        dur_days, dur_hours, first_act, last_act, last_status, last_by_login,
        status_kelulusan, tindak_lanjut, clean_pass_dur_days, has_valid_start,
        reject_count, revision_count, verif_sla_days, rekanan_sla_days,
        internal_sla_days, aging_days, approved_quarter, approved_period3
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    for (const v of parsed.vendors) {
      insertVendor.run(
        v.idVendor, v.namaPerusahaan, v.tipeRekanan, v.divisi, v.totalLogs,
        v.startSerial, v.endSerial, v.startIso, v.endIso, v.startMonth, v.endMonth,
        v.durDays, v.durHours, v.firstAct, v.lastAct, v.lastStatus, v.lastByLogin,
        v.statusKelulusan, v.tindakLanjut, v.cleanPassDurDays, v.hasValidStart,
        v.rejectCount, v.revisionCount, v.verifSlaDays, v.rekananSlaDays,
        v.internalSlaDays, v.agingDays, v.approvedQuarter, v.approvedPeriod3
      );
    }

    const insertLog = db.prepare(`
      INSERT INTO logs (
        seq_no, log_id, id_vendor, nama_perusahaan, tipe_rekanan, divisi,
        message, status, hasil_status, message_by, serial_date, waktu_iso,
        waktu_display, periode_bulan, triwulan, kelompok_waktu, periode_3,
        tipe_sub_modul, tipe_activity, bidang, dari_modul, by_login, aktor_login,
        paired_prev_act, paired_prev_waktu, sla_hours, sla_days, kategori_aktor,
        chrono_prev_act, chrono_gap_hours, chrono_gap_days, cumulative_days
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    for (const l of parsed.logs) {
      insertLog.run(
        l.seqNo, l.logId, l.idVendor, l.namaPerusahaan, l.tipeRekanan, l.divisi,
        l.message, l.status, l.hasilStatus, l.messageBy, l.serialDate, l.waktuIso,
        l.waktuDisplay, l.periodeBulan, l.triwulan, l.kelompokWaktu, l.periode3,
        l.tipeSubModul, l.tipeActivity, l.bidang, l.dariModul, l.byLogin, l.aktorLogin,
        l.pairedPrevAct, l.pairedPrevWaktu, l.slaHours, l.slaDays, l.kategoriAktor,
        l.chronoPrevAct, l.chronoGapHours, l.chronoGapDays, l.cumulativeDays
      );
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getMeta(db) {
  const rows = db.prepare('SELECT key, value FROM meta').all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}
