import type { Adapter, RawCandidate } from './types.js';
import { cleanText, normalizeDigits, parseInteger, validSolarYear } from './text.js';

const MAX_LINE = 500;

function intOpt(options: Readonly<Record<string, string>>, key: string, fallback: number): number {
  const v = options[key];
  return v !== undefined && /^\d+$/.test(v) ? Number(v) : fallback;
}

/** Prices are stored in rials; sources often list toman, so a multiplier option (10) converts. */
function rialsOf(raw: bigint, options: Readonly<Record<string, string>>): bigint {
  return raw * BigInt(intOpt(options, 'price_multiplier', 1));
}

function build(cells: { name: string; year: string | number | undefined; price: string; unit?: string }, options: Readonly<Record<string, string>>, excerpt: string): RawCandidate | null {
  const name = cleanText(cells.name);
  if (name.length < 2 || name.length > 200) return null;
  const yearRaw = cells.year ?? options.default_year;
  const year = typeof yearRaw === 'number' ? yearRaw : Number(normalizeDigits(String(yearRaw ?? '')).replace(/\D/g, ''));
  if (!validSolarYear(year)) return null;
  const price = parseInteger(cells.price);
  if (price === null || price <= 0n) return null;
  const month = options.month && /^\d+$/.test(options.month) ? Number(options.month) : null;
  return {
    productNameFa: name,
    unitFa: cells.unit ? cleanText(cells.unit) || null : null,
    categoryGuess: options.category ?? null,
    year,
    month: month !== null && month >= 1 && month <= 12 ? month : null,
    priceRials: rialsOf(price, options),
    excerpt: excerpt.slice(0, 400),
  };
}

function tableRows(html: string, tableIndex: number): string[][] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const table = tables[tableIndex];
  if (!table) return [];
  const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows.map((r) => (r.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map((c) => cleanText(c)));
}

/** Table rows with a name column, a price column and (optionally) a year column. */
export const htmlTableAdapter: Adapter = ({ body, options }) => {
  const nameCol = intOpt(options, 'name_col', 0);
  const priceCol = intOpt(options, 'price_col', 1);
  const yearCol = options.year_col !== undefined ? intOpt(options, 'year_col', -1) : -1;
  const unitCol = options.unit_col !== undefined ? intOpt(options, 'unit_col', -1) : -1;
  const skip = intOpt(options, 'skip_rows', 1);
  const rows = tableRows(body, intOpt(options, 'table_index', 0)).slice(skip);
  const out: RawCandidate[] = [];
  for (const cells of rows) {
    const c = build({ name: cells[nameCol] ?? '', year: yearCol >= 0 ? cells[yearCol] : undefined, price: cells[priceCol] ?? '', unit: unitCol >= 0 ? cells[unitCol] : undefined }, options, cells.join(' | '));
    if (c) out.push(c);
  }
  return out;
};

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export const csvAdapter: Adapter = ({ body, options }) => {
  const delimiter = options.delimiter && options.delimiter.length === 1 ? options.delimiter : ',';
  const nameCol = intOpt(options, 'name_col', 0);
  const priceCol = intOpt(options, 'price_col', 1);
  const yearCol = options.year_col !== undefined ? intOpt(options, 'year_col', -1) : -1;
  const unitCol = options.unit_col !== undefined ? intOpt(options, 'unit_col', -1) : -1;
  const lines = body.split(/\r?\n/).filter((l) => l.trim() !== '').slice(intOpt(options, 'skip_rows', 1));
  const out: RawCandidate[] = [];
  for (const line of lines) {
    if (line.length > MAX_LINE) continue;
    const cells = splitCsvLine(line, delimiter);
    const c = build({ name: cells[nameCol] ?? '', year: yearCol >= 0 ? cells[yearCol] : undefined, price: cells[priceCol] ?? '', unit: unitCol >= 0 ? cells[unitCol] : undefined }, options, line);
    if (c) out.push(c);
  }
  return out;
};

/**
 * Free text: a regular expression with the named groups `name`, `price` and optionally `year` / `unit` is run on every
 * visible line. Meant for pages that list «نان سنگک ۱۳۷۵: ۵۰ ریال» as prose.
 */
export const textLinesAdapter: Adapter = ({ body, options }) => {
  const pattern = options.pattern;
  if (!pattern || pattern.length > 300) return [];
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'u');
  } catch {
    return [];
  }
  const lines = body.replace(/<(br|\/p|\/li|\/tr|\/h\d|\/div)[^>]*>/gi, '\n').split(/\n+/).map((l) => cleanText(l));
  const out: RawCandidate[] = [];
  for (const line of lines) {
    if (line.length < 4 || line.length > MAX_LINE) continue;
    const m = re.exec(line);
    const g = m?.groups;
    if (!g?.name || !g.price) continue;
    const c = build({ name: g.name, year: g.year, price: g.price, unit: g.unit }, options, line);
    if (c) out.push(c);
  }
  return out;
};

export const ADAPTERS: Record<'html_table' | 'csv' | 'text_lines', Adapter> = {
  html_table: htmlTableAdapter,
  csv: csvAdapter,
  text_lines: textLinesAdapter,
};
