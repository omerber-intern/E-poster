import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

interface ParsedRow {
  username: string;
  apiKey: string;
  userKey: string;
  gcid: string;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]+/g, '');
}

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  username: 'username',
  user: 'username',
  name: 'username',
  portfolioname: 'username',
  portfolio: 'username',
  apikey: 'apiKey',
  api_key: 'apiKey',
  userkey: 'userKey',
  user_key: 'userKey',
  gcid: 'gcid',
};

function mapHeaders(rawHeaders: string[]): Record<number, keyof ParsedRow> {
  const mapping: Record<number, keyof ParsedRow> = {};
  for (let i = 0; i < rawHeaders.length; i++) {
    const normalized = normalizeHeader(rawHeaders[i]);
    const field = HEADER_MAP[normalized];
    if (field) mapping[i] = field;
  }
  return mapping;
}

function parseRows(
  headerMapping: Record<number, keyof ParsedRow>,
  dataRows: string[][],
): ParsedRow[] {
  const results: ParsedRow[] = [];
  for (const row of dataRows) {
    const entry: ParsedRow = { username: '', apiKey: '', userKey: '', gcid: '' };
    for (let i = 0; i < row.length; i++) {
      const field = headerMapping[i];
      if (field) entry[field] = (row[i] ?? '').trim();
    }
    if (entry.username) results.push(entry);
  }
  return results;
}

async function parseCsv(text: string): Promise<ParsedRow[]> {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  if (parsed.data.length < 2) return [];

  const headerMapping = mapHeaders(parsed.data[0]);
  return parseRows(headerMapping, parsed.data.slice(1));
}

async function parseXlsx(arrayBuffer: ArrayBuffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(arrayBuffer) as never);

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];

  const headerRow = sheet.getRow(1);
  const rawHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    rawHeaders[colNumber - 1] = String(cell.value ?? '');
  });

  const headerMapping = mapHeaders(rawHeaders);
  const dataRows: string[][] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = String(cell.value ?? '');
    });
    dataRows.push(values);
  }

  return parseRows(headerMapping, dataRows);
}

/**
 * POST /api/portfolio-config/import
 *
 * Accepts a CSV or XLSX file upload via multipart form data.
 * Parses the file and returns rows as JSON for client-side review.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    let rows: ParsedRow[];

    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      rows = await parseCsv(text);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      rows = await parseXlsx(arrayBuffer);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please upload a .csv or .xlsx file.' },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid data rows found in file. Ensure the file has a header row with at least a "username" column.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ rows, total: rows.length });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to parse file' },
      { status: 500 },
    );
  }
}
