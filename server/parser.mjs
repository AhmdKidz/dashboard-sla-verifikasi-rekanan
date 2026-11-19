import XLSX from 'xlsx';
import { parseRegistrationWorkbookObject } from '../shared/slaParser.mjs';

export function parseRegistrationWorkbook(filePath, options = {}) {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  return parseRegistrationWorkbookObject(wb, options);
}
