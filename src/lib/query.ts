/** Argentina stays UTC−3 all year. Calendar filters use this civil day. */
export const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

export const MONTH_LABELS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export type TextQuery = {
  active: boolean;
  terms: string[];
  phrases: string[];
  exclude: string[];
};

export type DateRange = {
  from: number;
  to: number;
};

export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function ymd(year: number, month: number, day: number) {
  return year * 10000 + month * 100 + day;
}

export function ymdParts(value: number) {
  return {
    year: Math.floor(value / 10000),
    month: Math.floor((value % 10000) / 100),
    day: value % 100,
  };
}

export function formatYmd(value: number) {
  const { year, month, day } = ymdParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseYmd(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return ymd(year, month, day);
}

export function parseYearMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export function artYmdFromMs(ms: number) {
  const shifted = new Date(ms - ART_OFFSET_MS);
  return ymd(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function isoToYmd(iso: string | null): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return artYmdFromMs(date.getTime());
}

export function addDays(value: number, days: number) {
  const { year, month, day } = ymdParts(value);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return ymd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function mondayOf(value: number) {
  const { year, month, day } = ymdParts(value);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = (dow + 6) % 7;
  return addDays(value, -mondayOffset);
}

export function monthStart(year: number, month: number) {
  return ymd(year, month, 1);
}

export function monthEnd(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0));
  return ymd(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate());
}

export function monthGrid(year: number, month: number) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const pad = (firstDow + 6) % 7;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= lastDay; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthLabel(year: number, month: number) {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export function parseTextQuery(raw: string): TextQuery {
  const terms: string[] = [];
  const phrases: string[] = [];
  const exclude: string[] = [];
  const token = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(raw))) {
    if (match[1] != null) {
      const phrase = fold(match[1]).replace(/\s+/g, " ").trim();
      if (phrase) phrases.push(phrase);
      continue;
    }
    const piece = match[2] ?? "";
    if (piece.startsWith("-") && piece.length > 1) {
      const skipped = fold(piece.slice(1));
      if (skipped) exclude.push(skipped);
      continue;
    }
    const term = fold(piece);
    if (term) terms.push(term);
  }
  return {
    active: terms.length + phrases.length + exclude.length > 0,
    terms,
    phrases,
    exclude,
  };
}

export function matchText(haystack: string, query: TextQuery) {
  if (!query.active) return true;
  for (const phrase of query.phrases) {
    if (!haystack.includes(phrase)) return false;
  }
  for (const term of query.terms) {
    if (!haystack.includes(term)) return false;
  }
  for (const skipped of query.exclude) {
    if (haystack.includes(skipped)) return false;
  }
  return true;
}

export function looksUsdOriginal(usd: number) {
  if (usd < 1) return false;
  return Math.abs(usd - Math.round(usd)) < 0.009;
}

export function resolveDateRange(
  input: { when: string; from: string; to: string },
  nowMs: number,
  lastArchiveDay: number | null = null,
): DateRange | null {
  const today = artYmdFromMs(nowMs);
  const when = input.when.trim();
  if (when === "hoy") return { from: today, to: today };
  if (when === "ayer") {
    const yesterday = addDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (when === "semana") return { from: mondayOf(today), to: addDays(mondayOf(today), 6) };
  if (when === "mes") {
    const { year, month } = ymdParts(today);
    return { from: monthStart(year, month), to: monthEnd(year, month) };
  }
  if (when === "ultimo") {
    if (lastArchiveDay == null) return null;
    return { from: lastArchiveDay, to: lastArchiveDay };
  }
  const ym = parseYearMonth(when);
  if (ym) return { from: monthStart(ym.year, ym.month), to: monthEnd(ym.year, ym.month) };

  const from = parseYmd(input.from);
  const to = parseYmd(input.to);
  if (from == null && to == null) return null;
  if (from != null && to == null) return { from, to: from };
  if (from == null && to != null) return { from: to, to };
  if (from != null && to != null) return from <= to ? { from, to } : { from: to, to: from };
  return null;
}