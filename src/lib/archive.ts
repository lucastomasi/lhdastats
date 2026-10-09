export type Donation = {
  id: number;
  nombre: string;
  mensaje: string;
  monto_usd: number;
  monto_ars: number;
  privado: boolean;
  fecha_relativa: string;
  fecha_aprox: string | null;
  devuelta: boolean;
  devolucion: string | null;
};

export type DonorStat = {
  nombre: string;
  aliases: string[];
  count: number;
  ars: number;
  usd: number;
  kickGiftUsd: number;
};

export type Bracket = {
  label: string;
  count: number;
};

export type PeriodPoint = {
  key: string;
  label: string;
  count: number;
  ars: number;
  usd: number;
};

export type WordTerm = {
  key: string;
  label: string;
  count: number;
};

export type DonorProfile = DonorStat & {
  nameKey: string;
  first: Donation;
  last: Donation;
  biggest: Donation;
  refundedCount: number;
  refundedArs: number;
  refundedUsd: number;
};

export type ParetoStep = {
  label: string;
  donors: number;
  usdShare: number;
};

export type ConductRow = {
  key: string;
  label: string;
  texts: number;
  textShare: number;
  usdShare: number;
  meanArs: number;
};

export type NamedRow = {
  key: string;
  nombre: string;
  count: number;
};

export type LaughHabit = {
  key: string;
  nombre: string;
  share: number;
  texts: number;
};

export type YoutubeClip = {
  id: string;
  count: number;
  usd: number;
  href: string;
};

export type Mining = {
  medianArs: number;
  meanArs: number;
  repeatDonors: number;
  repeatDonorShare: number;
  repeatDonationShare: number;
  topPercentCount: number;
  topPercentUsdShare: number;
  top10UsdShare: number;
  rawNames: number;
  modeArs: number;
  modeCount: number;
  pareto: ParetoStep[];
  halfUsdDonors: number;
  eightyUsdDonors: number;
  typicalAmountsShare: number;
  under200TextShare: number;
  under200UsdShare: number;
  from5000TextShare: number;
  from5000UsdShare: number;
  heavyDonorShare: number;
  heavyUsdShare: number;
  modalFx: number;
  modalFxShare: number;
  conduct: ConductRow[];
  clipHabitDonors: number;
  storyHabitDonors: number;
  regularWriters: number;
  namedByOthers: NamedRow[];
  namedWithLaugh: NamedRow[];
  ownLaugh: LaughHabit[];
  youtube: YoutubeClip[];
  youtubeLinks: number;
  youtubeUnique: number;
  youtubeOnce: number;
};

export type ArchiveMeta = {
  source: string;
  username: string;
  scrapedAt: string;
  count: number;
  totalArs: number;
  totalUsd: number;
  donorCount: number;
  privateCount: number;
  note: string;
  listedCount: number;
  refundedCount: number;
  refundedArs: number;
  refundedUsd: number;
  refundNote: string;
  refunds: Donation[];
  topByUsd: DonorStat[];
  topByCount: DonorStat[];
  brackets: Bracket[];
  periods: PeriodPoint[];
  words: WordTerm[];
  mining: Mining;
};

export type SortKey = "reciente" | "antigua" | "mayor" | "menor" | "donante" | "aporte";

export type RefundMode = "in" | "out" | "only";

export type CurrencyMode = "" | "ars" | "usd";

export type Filters = {
  q: string;
  donor: string;
  sort: SortKey;
  minArs: number | null;
  maxArs: number | null;
  minUsd: number | null;
  maxUsd: number | null;
  from: string;
  to: string;
  when: string;
  conduct: string;
  hasLink: boolean;
  hasYoutube: boolean;
  empty: boolean;
  priv: boolean;
  refunds: RefundMode;
  currency: CurrencyMode;
  page: number;
};

export type ListSearch = {
  q?: string;
  donor?: string;
  sort?: SortKey;
  page?: number;
  min?: number;
  max?: number;
  minusd?: number;
  maxusd?: number;
  from?: string;
  to?: string;
  when?: string;
  conduct?: string;
  has?: string;
  dev?: string;
  cur?: string;
};

export type PageResult = {
  total: number;
  pages: number;
  page: number;
  rows: Donation[];
  ars: number;
  usd: number;
};

export type MonthOption = {
  key: string;
  label: string;
  count: number;
};

export type DonorChoice = {
  nombre: string;
  count: number;
};

export const PAGE_SIZE = 40;

export const SORTS: SortKey[] = ["reciente", "antigua", "mayor", "menor", "donante", "aporte"];

const HAS_FLAGS = ["link", "yt", "empty", "priv"] as const;
const REFUNDS: RefundMode[] = ["in", "out", "only"];
const CURRENCIES: CurrencyMode[] = ["ars", "usd"];
const CONDUCT = ["link", "story", "question", "politics", "greet", "laugh", "curse", "cheer", "short"];
const WHEN = /^(hoy|ayer|semana|mes|ultimo|\d{4}-\d{2})$/;

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function clip(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function sortOf(value: string): SortKey {
  return SORTS.includes(value as SortKey) ? (value as SortKey) : "reciente";
}

function pageOf(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(str(value) || "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), 100_000);
}

function amountOf(value: unknown, allowZero = false): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "number" ? String(value) : str(value);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  if (!allowZero && n <= 0) return null;
  return Math.min(n, 1_000_000_000);
}

function dateOf(value: unknown) {
  const raw = clip(str(value), 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function whenOf(value: unknown) {
  const raw = clip(str(value), 7);
  return WHEN.test(raw) ? raw : "";
}

function hasOf(value: unknown) {
  const raw = clip(str(value), 40).toLowerCase();
  const bits = new Set(raw.split(",").map((part) => part.trim()).filter(Boolean));
  return {
    hasLink: bits.has("link"),
    hasYoutube: bits.has("yt"),
    empty: bits.has("empty"),
    priv: bits.has("priv"),
  };
}

function hasParam(filters: Filters) {
  const bits: string[] = [];
  if (filters.hasLink) bits.push("link");
  if (filters.hasYoutube) bits.push("yt");
  if (filters.empty) bits.push("empty");
  if (filters.priv) bits.push("priv");
  return bits.join(",");
}

function refundsOf(value: unknown): RefundMode {
  const raw = str(value);
  return REFUNDS.includes(raw as RefundMode) ? (raw as RefundMode) : "in";
}

function currencyOf(value: unknown): CurrencyMode {
  const raw = str(value);
  return CURRENCIES.includes(raw as CurrencyMode) ? (raw as CurrencyMode) : "";
}

function conductOf(value: unknown) {
  const raw = clip(str(value), 20);
  return CONDUCT.includes(raw) ? raw : "";
}

function flagsFrom(raw: Record<string, unknown>) {
  if (typeof raw.hasLink === "boolean" || typeof raw.hasYoutube === "boolean") {
    return {
      hasLink: Boolean(raw.hasLink),
      hasYoutube: Boolean(raw.hasYoutube),
      empty: Boolean(raw.empty),
      priv: Boolean(raw.priv),
    };
  }
  return hasOf(raw.has);
}

export function parseListSearch(raw: Record<string, unknown>): ListSearch {
  const flags = flagsFrom(raw);
  const search: ListSearch = {
    q: clip(str(raw.q), 240),
    donor: clip(str(raw.donor), 160),
    sort: sortOf(str(raw.sort)),
    page: pageOf(raw.page),
    from: dateOf(raw.from),
    to: dateOf(raw.to),
    when: whenOf(raw.when),
    conduct: conductOf(raw.conduct),
    has: [
      flags.hasLink ? "link" : "",
      flags.hasYoutube ? "yt" : "",
      flags.empty ? "empty" : "",
      flags.priv ? "priv" : "",
    ]
      .filter(Boolean)
      .join(","),
    dev: refundsOf(raw.dev ?? raw.refunds),
    cur: currencyOf(raw.cur ?? raw.currency),
  };
  const min = amountOf(raw.min ?? raw.minArs);
  const max = amountOf(raw.max ?? raw.maxArs, true);
  const minusd = amountOf(raw.minusd ?? raw.minUsd);
  const maxusd = amountOf(raw.maxusd ?? raw.maxUsd, true);
  if (min !== null) search.min = min;
  if (max !== null) search.max = max;
  if (minusd !== null) search.minusd = minusd;
  if (maxusd !== null) search.maxusd = maxusd;
  return search;
}

export function parseFilters(input: unknown): Filters {
  return toFilters(parseListSearch(asRecord(input)));
}

export function toFilters(search: ListSearch, donorOverride?: string): Filters {
  const flags = hasOf(search.has);
  return {
    q: search.q ?? "",
    donor: donorOverride ?? search.donor ?? "",
    sort: search.sort ?? "reciente",
    minArs: search.min ?? null,
    maxArs: search.max ?? null,
    minUsd: search.minusd ?? null,
    maxUsd: search.maxusd ?? null,
    from: search.from ?? "",
    to: search.to ?? "",
    when: search.when ?? "",
    conduct: search.conduct ?? "",
    hasLink: flags.hasLink,
    hasYoutube: flags.hasYoutube,
    empty: flags.empty,
    priv: flags.priv,
    refunds: refundsOf(search.dev),
    currency: currencyOf(search.cur),
    page: search.page && search.page > 0 ? search.page : 1,
  };
}

export function filtersToListSearch(filters: Filters, page?: number, includeDonor = true): ListSearch {
  const search: ListSearch = {};
  if (filters.q) search.q = filters.q;
  if (includeDonor && filters.donor) search.donor = filters.donor;
  if (filters.sort !== "reciente") search.sort = filters.sort;
  if (filters.minArs !== null) search.min = filters.minArs;
  if (filters.maxArs !== null) search.max = filters.maxArs;
  if (filters.minUsd !== null) search.minusd = filters.minUsd;
  if (filters.maxUsd !== null) search.maxusd = filters.maxUsd;
  if (filters.from) search.from = filters.from;
  if (filters.to) search.to = filters.to;
  if (filters.when) search.when = filters.when;
  if (filters.conduct) search.conduct = filters.conduct;
  const has = hasParam(filters);
  if (has) search.has = has;
  if (filters.refunds !== "in") search.dev = filters.refunds;
  if (filters.currency) search.cur = filters.currency;
  const nextPage = page ?? filters.page;
  if (nextPage > 1) search.page = nextPage;
  return search;
}

export function filtersActive(filters: Filters, includeDonor = true) {
  return Boolean(
    filters.q ||
      (includeDonor && filters.donor) ||
      filters.minArs !== null ||
      filters.maxArs !== null ||
      filters.minUsd !== null ||
      filters.maxUsd !== null ||
      filters.from ||
      filters.to ||
      filters.when ||
      filters.conduct ||
      filters.hasLink ||
      filters.hasYoutube ||
      filters.empty ||
      filters.priv ||
      filters.refunds !== "in" ||
      filters.currency ||
      filters.sort !== "reciente" ||
      filters.page > 1,
  );
}

export function readDonorName(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function donorHref(name: string) {
  return `/donante/${encodeURIComponent(name)}`;
}

export function formatAliases(aliases: string[], primary?: string) {
  return aliases.filter((name) => name !== primary).join(" · ");
}

function searchParamsOf(filters: Filters, page?: number, includeDonor = true) {
  const search = filtersToListSearch(filters, page, includeDonor);
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.donor) params.set("donor", search.donor);
  if (search.sort) params.set("sort", search.sort);
  if (search.min != null) params.set("min", String(search.min));
  if (search.max != null) params.set("max", String(search.max));
  if (search.minusd != null) params.set("minusd", String(search.minusd));
  if (search.maxusd != null) params.set("maxusd", String(search.maxusd));
  if (search.from) params.set("from", search.from);
  if (search.to) params.set("to", search.to);
  if (search.when) params.set("when", search.when);
  if (search.conduct) params.set("conduct", search.conduct);
  if (search.has) params.set("has", search.has);
  if (search.dev) params.set("dev", search.dev);
  if (search.cur) params.set("cur", search.cur);
  if (search.page && search.page > 1) params.set("page", String(search.page));
  return params;
}

export function filtersToSearch(filters: Filters, page?: number, basePath = "/") {
  const params = searchParamsOf(filters, page, basePath === "/");
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function exportHref(filters: Filters) {
  const params = searchParamsOf(filters, 1, true);
  params.delete("page");
  const query = params.toString();
  return query ? `/api/export?${query}` : "/api/export";
}

export const EMPTY_SEARCH: ListSearch = {
  q: "",
  donor: "",
  sort: "reciente",
  page: 1,
  from: "",
  to: "",
  when: "",
  conduct: "",
  has: "",
  dev: "in",
  cur: "",
};

export const EMPTY_FILTERS: Filters = toFilters(EMPTY_SEARCH);

