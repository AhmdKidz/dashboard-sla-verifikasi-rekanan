import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseRegistrationWorkbook } from '../server/parser.mjs';
import { getDb, replaceDatabaseContents, DB_PATH } from '../server/db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultExcel = path.resolve(__dirname, '..', '..', 'history_registrasi_rekanan2026-11-10.xlsx');
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultExcel;

if (!fs.existsSync(inputPath)) {
  console.error(`File Excel tidak ditemukan: ${inputPath}`);
  console.error('Gunakan: npm run seed -- "path/ke/history_registrasi_rekanan.xlsx"');
  process.exit(1);
}

console.log(`Membaca Excel sumber: ${inputPath} ...`);
const t0 = Date.now();
const parsed = parseRegistrationWorkbook(inputPath, { exclude2024: true, excludeDummies: true });
console.log(`Parsing selesai dalam ${((Date.now() - t0) / 1000).toFixed(2)}s:`, parsed.meta);

const db = getDb();
const t1 = Date.now();
replaceDatabaseContents(db, parsed, path.basename(inputPath));
console.log(`Database SQLite lokal diperbarui (${DB_PATH}) dalam ${((Date.now() - t1) / 1000).toFixed(2)}s.`);
