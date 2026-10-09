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
  giftUsd?: number;
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
  giftUsd: number;
  giftCount: number;
};

export type ParetoStep = {
  label: string;
  donors: number;
  usdShare: number;
};

export type YoutubeVideo = {
  id: string;
  count: number;
  usd: number;
  donors: number;
  title: string;
  author: string;
  href: string;
};

export type ChatRank = {
  nombre: string;
  count: number;
  share: number;
};

export type ChatMine = {
  named: ChatRank[];
  funny: ChatRank[];
  witty: ChatRank[];
};

export type BehaviorRow = {
  key: string;
  label: string;
  count: number;
  share: number;
  usdShare: number;
  avgArs: number;
  lift: number;
};

export type Conducta = {
  rows: BehaviorRow[];
  habituales: number;
  deClip: number;
  deShow: number;
  mixtos: number;
  dePolitica: number;
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
  onceDonorShare: number;
  onceUsdShare: number;
  repeatUsdShare: number;
  roundHundredShare: number;
  fxMode: number;
  fxModeShare: number;
  halfUsdDonors: number;
  eightyUsdDonors: number;
  ladderShare: number;
  smallCountShare: number;
  smallUsdShare: number;
  largeCountShare: number;
  largeUsdShare: number;
  loyalDonors: number;
  loyalDonorShare: number;
  loyalUsdShare: number;
  pareto: ParetoStep[];
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
  youtubeMessages: number;
  linkMessages: number;
  linkTotal: number;
  youtubeLinks: number;
  youtubeWatch: number;
  youtubeShortlink: number;
  youtubeShorts: number;
  youtubeLive: number;
  youtubeUnique: number;
  youtubeOnce: number;
  videos: YoutubeVideo[];
  chat: ChatMine;
  conducta: Conducta;
  mining: Mining;
};

export type SortKey = "reciente" | "antigua" | "mayor" | "menor";

export type Filters = {
  q: string;
  donor: string;
  sort: SortKey;
  min: number | null;
  page: number;
  cuts: Concentration;
  habits: Habits;
  limits: Limits;
};

export type Concentration = {
  lowShare: number;
  highShare: number;
  smallArs: number;
  largeArs: number;
  loyalMin: number;
  ladder: number[];
};

export const DEFAULT_CONCENTRATION: Concentration = {
  lowShare: 50,
  highShare: 80,
  smallArs: 200,
  largeArs: 5000,
  loyalMin: 10,
  ladder: [100, 200, 500, 1000],
};

export type Habits = {
  minTexts: number;
  habitShare: number;
  politicsShare: number;
};

export const DEFAULT_HABITS: Habits = {
  minTexts: 20,
  habitShare: 50,
  politicsShare: 25,
};

export type Limits = {
  rank: number;
  videos: number;
  pageSize: number;
  coins: number;
  gifts: number;
  giftUsd: number;
  periodMin: number;
};

export const DEFAULT_LIMITS: Limits = {
  rank: 8,
  videos: 12,
  pageSize: 40,
  coins: 10,
  gifts: 10,
  giftUsd: 5,
  periodMin: 1,
};

export type ListSearch = {
  q?: string;
  donor?: string;
  sort?: SortKey;
  page?: number;
  min?: number;
  p1?: number;
  p2?: number;
  bajo?: number;
  alto?: number;
  veces?: number;
  montos?: string;
  textos?: number;
  habito?: number;
  poli?: number;
  top?: number;
  vids?: number;
  filas?: number;
  coins?: number;
  kicks?: number;
  regalo?: number;
  piso?: number;
};

export type PageResult = {
  total: number;
  pages: number;
  page: number;
  rows: Donation[];
};

export const PAGE_SIZE = 40;

const SORTS: SortKey[] = ["reciente", "antigua", "mayor", "menor"];

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

function minOf(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "number" ? String(value) : str(value);
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, 1_000_000_000);
}

function intIn(value: unknown, min: number, max: number, fallback: number) {
  const text = typeof value === "number" ? String(value) : str(value);
  if (!text) return fallback;
  const n = Number(text.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

export function ladderOf(value: unknown) {
  const fallback = DEFAULT_CONCENTRATION.ladder;
  const text = str(value);
  if (!text) return [...fallback];
  const found = new Set<number>();
  for (const part of text.split(/[^0-9]+/)) {
    if (!part) continue;
    const n = Number(part);
    if (Number.isInteger(n) && n >= 1 && n <= 1_000_000_000) found.add(n);
    if (found.size >= 6) break;
  }
  if (found.size === 0) return [...fallback];
  return [...found].sort((a, b) => a - b);
}

function cutsOf(raw: Record<string, unknown>): Concentration {
  let lowShare = intIn(raw.p1, 1, 98, DEFAULT_CONCENTRATION.lowShare);
  let highShare = intIn(raw.p2, 2, 99, DEFAULT_CONCENTRATION.highShare);
  if (lowShare >= highShare) {
    if (raw.p1 !== undefined && raw.p2 === undefined) highShare = Math.min(99, lowShare + 1);
    else if (raw.p2 !== undefined && raw.p1 === undefined) lowShare = Math.max(1, highShare - 1);
    else {
      const smaller = Math.min(lowShare, highShare);
      const larger = Math.max(lowShare, highShare);
      lowShare = smaller;
      highShare = larger === smaller ? Math.min(99, smaller + 1) : larger;
    }
  }
  let smallArs = intIn(raw.bajo, 1, 1_000_000_000, DEFAULT_CONCENTRATION.smallArs);
  let largeArs = intIn(raw.alto, 1, 1_000_000_000, DEFAULT_CONCENTRATION.largeArs);
  if (largeArs <= smallArs) {
    if (raw.alto !== undefined && raw.bajo === undefined) smallArs = Math.max(1, largeArs - 1);
    else largeArs = Math.min(1_000_000_000, smallArs + 1);
  }
  return {
    lowShare,
    highShare,
    smallArs,
    largeArs,
    loyalMin: intIn(raw.veces, 2, 500, DEFAULT_CONCENTRATION.loyalMin),
    ladder: ladderOf(raw.montos),
  };
}

function limitsOf(raw: Record<string, unknown>): Limits {
  const nested = asRecord(raw.limits);
  return {
    rank: intIn(nested.rank ?? raw.top, 1, 40, DEFAULT_LIMITS.rank),
    videos: intIn(nested.videos ?? raw.vids, 1, 40, DEFAULT_LIMITS.videos),
    pageSize: intIn(nested.pageSize ?? raw.filas, 10, 100, DEFAULT_LIMITS.pageSize),
    coins: intIn(nested.coins ?? raw.coins, 1, 20, DEFAULT_LIMITS.coins),
    gifts: intIn(nested.gifts ?? raw.kicks, 1, 20, DEFAULT_LIMITS.gifts),
    giftUsd: intIn(nested.giftUsd ?? raw.regalo, 1, 100, DEFAULT_LIMITS.giftUsd),
    periodMin: intIn(nested.periodMin ?? raw.piso, 1, 100_000, DEFAULT_LIMITS.periodMin),
  };
}

function habitsOf(raw: Record<string, unknown>): Habits {
  return {
    minTexts: intIn(raw.textos, 2, 500, DEFAULT_HABITS.minTexts),
    habitShare: intIn(raw.habito, 5, 95, DEFAULT_HABITS.habitShare),
    politicsShare: intIn(raw.poli, 5, 95, DEFAULT_HABITS.politicsShare),
  };
}

export function parseListSearch(raw: Record<string, unknown>): ListSearch {
  const cuts = cutsOf(raw);
  const habits = habitsOf(raw);
  const limits = limitsOf(raw);
  const search: ListSearch = {
    q: clip(str(raw.q), 200),
    donor: clip(str(raw.donor), 160),
    sort: sortOf(str(raw.sort)),
    page: pageOf(raw.page),
    p1: cuts.lowShare,
    p2: cuts.highShare,
    bajo: cuts.smallArs,
    alto: cuts.largeArs,
    veces: cuts.loyalMin,
    montos: cuts.ladder.join(","),
    textos: habits.minTexts,
    habito: habits.habitShare,
    poli: habits.politicsShare,
    top: limits.rank,
    vids: limits.videos,
    filas: limits.pageSize,
    coins: limits.coins,
    kicks: limits.gifts,
    regalo: limits.giftUsd,
    piso: limits.periodMin,
  };
  const min = minOf(raw.min);
  if (min !== null) search.min = min;
  return search;
}

export function parseFilters(input: unknown): Filters {
  const raw = asRecord(input);
  if (raw.cuts && typeof raw.cuts === "object") {
    const cuts = asRecord(raw.cuts);
    const habits = asRecord(raw.habits);
    return toFilters({
      q: str(raw.q),
      donor: str(raw.donor),
      sort: sortOf(str(raw.sort)),
      page: pageOf(raw.page),
      min: minOf(raw.min) ?? undefined,
      p1: intIn(cuts.lowShare, 1, 98, DEFAULT_CONCENTRATION.lowShare),
      p2: intIn(cuts.highShare, 2, 99, DEFAULT_CONCENTRATION.highShare),
      bajo: intIn(cuts.smallArs, 1, 1_000_000_000, DEFAULT_CONCENTRATION.smallArs),
      alto: intIn(cuts.largeArs, 1, 1_000_000_000, DEFAULT_CONCENTRATION.largeArs),
      veces: intIn(cuts.loyalMin, 2, 500, DEFAULT_CONCENTRATION.loyalMin),
      montos: Array.isArray(cuts.ladder) ? cuts.ladder.join(",") : str(cuts.ladder),
      textos: intIn(habits.minTexts, 2, 500, DEFAULT_HABITS.minTexts),
      habito: intIn(habits.habitShare, 5, 95, DEFAULT_HABITS.habitShare),
      poli: intIn(habits.politicsShare, 5, 95, DEFAULT_HABITS.politicsShare),
      top: intIn(asRecord(raw.limits).rank, 1, 40, DEFAULT_LIMITS.rank),
      vids: intIn(asRecord(raw.limits).videos, 1, 40, DEFAULT_LIMITS.videos),
      filas: intIn(asRecord(raw.limits).pageSize, 10, 100, DEFAULT_LIMITS.pageSize),
      coins: intIn(asRecord(raw.limits).coins, 1, 20, DEFAULT_LIMITS.coins),
      kicks: intIn(asRecord(raw.limits).gifts, 1, 20, DEFAULT_LIMITS.gifts),
      regalo: intIn(asRecord(raw.limits).giftUsd, 1, 100, DEFAULT_LIMITS.giftUsd),
      piso: intIn(asRecord(raw.limits).periodMin, 1, 100_000, DEFAULT_LIMITS.periodMin),
    });
  }
  return toFilters(parseListSearch(raw));
}

export function toFilters(search: ListSearch, donorOverride?: string): Filters {
  const cuts = cutsOf(search as Record<string, unknown>);
  return {
    q: search.q ?? "",
    donor: donorOverride ?? search.donor ?? "",
    sort: search.sort ?? "reciente",
    min: search.min ?? null,
    page: search.page && search.page > 0 ? search.page : 1,
    cuts,
    habits: habitsOf(search as Record<string, unknown>),
    limits: limitsOf(search as Record<string, unknown>),
  };
}

export function concentrationSearch(cuts: Concentration): ListSearch {
  const search: ListSearch = {};
  const base = DEFAULT_CONCENTRATION;
  if (cuts.lowShare !== base.lowShare) search.p1 = cuts.lowShare;
  if (cuts.highShare !== base.highShare) search.p2 = cuts.highShare;
  if (cuts.smallArs !== base.smallArs) search.bajo = cuts.smallArs;
  if (cuts.largeArs !== base.largeArs) search.alto = cuts.largeArs;
  if (cuts.loyalMin !== base.loyalMin) search.veces = cuts.loyalMin;
  const ladder = cuts.ladder.join(",");
  if (ladder !== base.ladder.join(",")) search.montos = ladder;
  return search;
}

export function paramSearch(filters: Pick<Filters, "cuts" | "habits" | "limits">): ListSearch {
  const search = concentrationSearch(filters.cuts);
  if (filters.habits.minTexts !== DEFAULT_HABITS.minTexts) search.textos = filters.habits.minTexts;
  if (filters.habits.habitShare !== DEFAULT_HABITS.habitShare) search.habito = filters.habits.habitShare;
  if (filters.habits.politicsShare !== DEFAULT_HABITS.politicsShare) search.poli = filters.habits.politicsShare;
  const limits = filters.limits;
  if (limits.rank !== DEFAULT_LIMITS.rank) search.top = limits.rank;
  if (limits.videos !== DEFAULT_LIMITS.videos) search.vids = limits.videos;
  if (limits.pageSize !== DEFAULT_LIMITS.pageSize) search.filas = limits.pageSize;
  if (limits.coins !== DEFAULT_LIMITS.coins) search.coins = limits.coins;
  if (limits.gifts !== DEFAULT_LIMITS.gifts) search.kicks = limits.gifts;
  if (limits.giftUsd !== DEFAULT_LIMITS.giftUsd) search.regalo = limits.giftUsd;
  if (limits.periodMin !== DEFAULT_LIMITS.periodMin) search.piso = limits.periodMin;
  return search;
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

export function filtersToSearch(filters: Filters, page?: number, basePath = "/") {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.donor && basePath === "/") params.set("donor", filters.donor);
  if (filters.sort !== "reciente") params.set("sort", filters.sort);
  if (filters.min !== null) params.set("min", String(filters.min));
  for (const [key, value] of Object.entries(paramSearch(filters))) {
    if (value !== undefined) params.set(key, String(value));
  }
  const nextPage = page ?? filters.page;
  if (nextPage > 1) params.set("page", String(nextPage));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function exportHref(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.donor) params.set("donor", filters.donor);
  if (filters.sort !== "reciente") params.set("sort", filters.sort);
  if (filters.min !== null) params.set("min", String(filters.min));
  const query = params.toString();
  return query ? `/api/export?${query}` : "/api/export";
}

export const EMPTY_SEARCH: ListSearch = {
  q: "",
  donor: "",
  sort: "reciente",
  page: 1,
  p1: DEFAULT_CONCENTRATION.lowShare,
  p2: DEFAULT_CONCENTRATION.highShare,
  bajo: DEFAULT_CONCENTRATION.smallArs,
  alto: DEFAULT_CONCENTRATION.largeArs,
  veces: DEFAULT_CONCENTRATION.loyalMin,
  montos: DEFAULT_CONCENTRATION.ladder.join(","),
  textos: DEFAULT_HABITS.minTexts,
  habito: DEFAULT_HABITS.habitShare,
  poli: DEFAULT_HABITS.politicsShare,
  top: DEFAULT_LIMITS.rank,
  vids: DEFAULT_LIMITS.videos,
  filas: DEFAULT_LIMITS.pageSize,
  coins: DEFAULT_LIMITS.coins,
  kicks: DEFAULT_LIMITS.gifts,
  regalo: DEFAULT_LIMITS.giftUsd,
  piso: DEFAULT_LIMITS.periodMin,
};
