import type XLSX from 'xlsx';

export interface ParseOptions {
  exclude2024?: boolean;
  excludeDummies?: boolean;
}

export interface ParsedWorkbookResult {
  meta: {
    exportTimestamp: string;
    rawRows: number;
    dummyIdsRemoved: number;
    dummyRowsRemoved: number;
    vendors2024Excluded: number;
    rows2024Excluded: number;
    duplicatesRemoved: number;
    cleanVendors: number;
    cleanLogs: number;
    maxDatasetSerial: number;
    maxDatasetDate: string;
  };
  vendors: any[];
  logs: any[];
}

export function parseRegistrationWorkbookObject(
  wb: XLSX.WorkBook,
  options?: ParseOptions
): ParsedWorkbookResult;

export function computeFinalApprovalDiagnostic(faLogs: any[]): any;

export function computeFgdDefenseData(vendors: any[], logs: any[], meta?: Record<string, string>): any;
