import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_SIZE,
  parseConcentration,
  parseFilters,
  readDonorName,
  type ArchiveMeta,
  type AmountBucket,
  type ConcentrationDonor,
  type ConcentrationHit,
  type ConcentrationParams,
  type ConcentrationReport,
  type Donation,
  type DonorChoice,
  type DonorProfile,
  type Filters,
  type Mining,
  type MonthOption,
  type PageResult,
  type PeriodPoint,
  type WordTerm,
} from "./archive";
import { STOP_WORDS } from "./stopwords";
import { messageLinks } from "./links";
import { canonicalKey } from "./identities";
import { KICK_GIFTS } from "./chat-board";
import { classifyMessage, CONDUCT_ORDER, hasLaugh, hasLink, youtubeIds, type ConductKey } from "./conduct";
import {
  fold,
  formatYmd,
  isoToYmd,
  looksUsdOriginal,
  matchText,
  monthLabel,
  parseTextQuery,
  resolveDateRange,
  ymdParts,
} from "./query";

type RawDonation = Omit<Donation, "devuelta" | "devolucion">;

type ArchiveFile = {
  source: string;
  username: string;
  scraped_at: string;
  count: number;
  total_ars: number;
  total_usd: number;
  note: string;
  donations: RawDonation[];
};

type RefundFile = {
  note: string;
  refunds: { id: number; reason: string }[];
};

export type IndexedDonation = Donation & {
  nameKey: string;
  period: string;
  month: string;
  ytIds: string[];
  sites: string[];
  links: { url: string; site: string }[];
  haystack: string;
  day: number | null;
  hasLink: boolean;
  hasYoutube: boolean;
  blank: boolean;
  conduct: ConductKey;
  usdOriginal: boolean;
  donorUsd: number;
  donorLabel: string;
};

type Cache = {
  rows: IndexedDonation[];
  meta: ArchiveMeta;
  donors: Map<string, DonorProfile>;
  months: MonthOption[];
  donorChoices: DonorChoice[];
  lastDay: number | null;
};

const TOKEN = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]{3,}/g;
const URL_CHUNK = /https?:\/\/\S+|www\.\S+/gi;

export const BRACKETS: { label: string; min: number; max: number | null }[] = [
  { label: "Menos de $500", min: 0, max: 500 },
  { label: "$500 a $1.999", min: 500, max: 2000 },
  { label: "$2.000 a $9.999", min: 2000, max: 10000 },
  { label: "$10.000 a $49.999", min: 10000, max: 50000 },
  { label: "$50.000 o más", min: 50000, max: null },
];

const PERIOD_ORDER = [
  "hace-anos",
  "hace-8-meses",
  "hace-7-meses",
  "hace-6-meses",
  "hace-5-meses",
  "hace-4-meses",
  "hace-3-meses",
  "hace-2-meses",
  "hace-1-mes",
  "este-mes",
  "esta-semana",
  "ayer",
  "ultimas-horas",
  "otras",
];

function resolveDataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "data"),
    join(here, "../data"),
    join(here, "../../data"),
    join(process.cwd(), "data"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "donations.json"))) return dir;
  }
  throw new Error("No se encontró data/donations.json junto al servidor.");
}

function readJsonFile<T>(name: string): T {
  return JSON.parse(readFileSync(join(resolveDataDir(), name), "utf8")) as T;
}

let cache: Cache | null = null;

export { fold };

export const PERIOD_KEYS = PERIOD_ORDER;

export function periodOf(label: string): { key: string; label: string } {
  const match = /^Hace\s+(\d+)\s+(\S+)$/i.exec(label.trim());
  if (!match) return { key: "otras", label: "Otras" };
  const amount = Number(match[1]);
  const unit = fold(match[2]);
  if (unit.startsWith("hora")) return { key: "ultimas-horas", label: "Últimas horas" };
  if (unit.startsWith("dia")) {
    return amount <= 1 ? { key: "ayer", label: "Ayer" } : { key: "esta-semana", label: "Esta semana" };
  }
  if (unit.startsWith("semana")) return { key: "este-mes", label: "Este mes" };
  if (unit.startsWith("mes")) {
    return {
      key: amount === 1 ? "hace-1-mes" : `hace-${amount}-meses`,
      label: amount === 1 ? "Hace 1 mes" : `Hace ${amount} meses`,
    };
  }
  if (unit.startsWith("ano")) return { key: "hace-anos", label: "Hace años" };
  return { key: "otras", label: "Otras" };
}

export function toPublic(row: IndexedDonation): Donation {
  return {
    id: row.id,
    nombre: row.nombre,
    mensaje: row.mensaje,
    monto_usd: row.monto_usd,
    monto_ars: row.monto_ars,
    privado: row.privado,
    fecha_relativa: row.fecha_relativa,
    fecha_aprox: row.fecha_aprox,
    devuelta: row.devuelta,
    devolucion: row.devolucion,
  };
}

export function countWords(message: string, wordMap: Map<string, Map<string, number>>) {
  const cleaned = message.replace(URL_CHUNK, " ");
  const tokens = cleaned.match(TOKEN);
  if (!tokens) return;
  for (const raw of tokens) {
    const key = fold(raw);
    if (STOP_WORDS.has(key) || /^\d+$/.test(key)) continue;
    const variants = wordMap.get(key);
    if (variants) variants.set(raw, (variants.get(raw) ?? 0) + 1);
    else wordMap.set(key, new Map([[raw, 1]]));
  }
}

export function rankWords(wordMap: Map<string, Map<string, number>>): WordTerm[] {
  return [...wordMap.entries()]
    .map(([key, variants]) => {
      const ranked = [...variants.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
      const count = ranked.reduce((sum, [, n]) => sum + n, 0);
      return { key, label: ranked[0]?.[0] ?? key, count };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function build(): Cache {
  const parsed = readJsonFile<ArchiveFile>("donations.json");
  const refunds = readJsonFile<RefundFile>("refunds.json");
  const byId = new Map(refunds.refunds.map((item) => [item.id, item.reason]));
  const rows: IndexedDonation[] = parsed.donations.map((row) => {
    const devolucion = byId.get(row.id) ?? null;
    const extra = devolucion ? " devuelta devolucion reintegro" : "";
    const message = row.mensaje ?? "";
    const day = isoToYmd(row.fecha_aprox);
    const links = messageLinks(message);
    return {
      ...row,
      period: periodOf(row.fecha_relativa).key,
      month: day == null ? "" : formatYmd(day).slice(0, 7),
      ytIds: [...new Set(youtubeIds(message))],
      sites: [...new Set(links.map((link) => link.site))],
      links,
      devuelta: Boolean(devolucion),
      devolucion,
      nameKey: canonicalKey(fold(row.nombre)),
      haystack: fold(`${row.nombre} ${message}${extra}`),
      day,
      hasLink: hasLink(message),
      hasYoutube: youtubeIds(message).length > 0,
      blank: message.trim().length === 0,
      conduct: classifyMessage(message),
      usdOriginal: looksUsdOriginal(row.monto_usd),
      donorUsd: 0,
      donorLabel: row.nombre,
    };
  });

  const donors = new Map<
    string,
    {
      variants: Map<string, number>;
      count: number;
      ars: number;
      usd: number;
      refundedCount: number;
      refundedArs: number;
      refundedUsd: number;
      first: IndexedDonation;
      last: IndexedDonation;
      biggest: IndexedDonation | null;
    }
  >();
  const brackets = BRACKETS.map((bracket) => ({ label: bracket.label, count: 0 }));
  const periodMap = new Map<string, PeriodPoint>();
  const wordMap = new Map<string, Map<string, number>>();
  const refundedRows: IndexedDonation[] = [];
  let privateCount = 0;
  let counted = 0;
  let totalArs = 0;
  let totalUsd = 0;
  let refundedArs = 0;
  let refundedUsd = 0;

  for (const row of rows) {
    if (row.devuelta) {
      refundedRows.push(row);
      refundedArs += row.monto_ars;
      refundedUsd += row.monto_usd;
    } else {
      counted += 1;
      totalArs += row.monto_ars;
      totalUsd += row.monto_usd;
      if (row.privado) privateCount += 1;
      else countWords(row.mensaje, wordMap);
      const bracket = BRACKETS.findIndex(
        (item) => row.monto_ars >= item.min && (item.max === null || row.monto_ars < item.max),
      );
      if (bracket >= 0) brackets[bracket].count += 1;
      const period = periodOf(row.fecha_relativa);
      const bucket = periodMap.get(period.key);
      if (bucket) {
        bucket.count += 1;
        bucket.ars += row.monto_ars;
        bucket.usd += row.monto_usd;
      } else {
        periodMap.set(period.key, {
          key: period.key,
          label: period.label,
          count: 1,
          ars: row.monto_ars,
          usd: row.monto_usd,
        });
      }
    }

    const current = donors.get(row.nameKey);
    if (!current) {
      donors.set(row.nameKey, {
        variants: new Map([[row.nombre, 1]]),
        count: row.devuelta ? 0 : 1,
        ars: row.devuelta ? 0 : row.monto_ars,
        usd: row.devuelta ? 0 : row.monto_usd,
        refundedCount: row.devuelta ? 1 : 0,
        refundedArs: row.devuelta ? row.monto_ars : 0,
        refundedUsd: row.devuelta ? row.monto_usd : 0,
        first: row,
        last: row,
        biggest: row.devuelta ? null : row,
      });
      continue;
    }
    if (row.devuelta) {
      current.refundedCount += 1;
      current.refundedArs += row.monto_ars;
      current.refundedUsd += row.monto_usd;
    } else {
      current.count += 1;
      current.ars += row.monto_ars;
      current.usd += row.monto_usd;
      if (!current.biggest || row.monto_usd > current.biggest.monto_usd) current.biggest = row;
    }
    current.variants.set(row.nombre, (current.variants.get(row.nombre) ?? 0) + 1);
    if (row.id < current.first.id) current.first = row;
    if (row.id > current.last.id) current.last = row;
  }

  const kickUsdByKey = new Map<string, number>();
  for (const gift of KICK_GIFTS) {
    if (!gift.archiveName) continue;
    kickUsdByKey.set(canonicalKey(fold(gift.archiveName)), gift.gifts * 5);
  }

  const donorProfiles: DonorProfile[] = [...donors.entries()].map(([nameKey, donor]) => {
    const aliases = [...donor.variants.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0], "es"))
      .map(([name]) => name);
    return {
      nameKey,
      nombre: aliases[0] ?? nameKey,
      aliases,
      count: donor.count,
      ars: donor.ars,
      usd: donor.usd,
      kickGiftUsd: kickUsdByKey.get(nameKey) ?? 0,
      first: toPublic(donor.first),
      last: toPublic(donor.last),
      biggest: toPublic(donor.biggest ?? donor.first),
      refundedCount: donor.refundedCount,
      refundedArs: donor.refundedArs,
      refundedUsd: donor.refundedUsd,
    };
  });

  const meta: ArchiveMeta = {
    source: parsed.source,
    username: parsed.username,
    scrapedAt: parsed.scraped_at,
    count: counted,
    totalArs,
    totalUsd,
    donorCount: donors.size,
    privateCount,
    note: parsed.note,
    listedCount: rows.length,
    refundedCount: refundedRows.length,
    refundedArs,
    refundedUsd,
    refundNote: refunds.note,
    refunds: refundedRows.sort((a, b) => b.monto_ars - a.monto_ars).map(toPublic),
    topByUsd: [...donorProfiles].sort((a, b) => b.usd - a.usd || b.count - a.count).slice(0, 12),
    topByCount: [...donorProfiles].sort((a, b) => b.count - a.count || b.usd - a.usd).slice(0, 12),
    brackets,
    periods: PERIOD_ORDER.flatMap((key) => {
      const point = periodMap.get(key);
      return point ? [point] : [];
    }),
    words: rankWords(wordMap).slice(0, 72),
    mining: mine(rows, donorProfiles, totalArs, totalUsd, counted),
  };

  const donorByKey = new Map(donorProfiles.map((donor) => [donor.nameKey, donor]));
  const monthCounts = new Map<string, number>();
  let lastDay: number | null = null;
  for (const row of rows) {
    const donor = donorByKey.get(row.nameKey);
    row.donorUsd = donor?.usd ?? 0;
    row.donorLabel = donor?.nombre ?? row.nombre;
    if (row.day == null) continue;
    if (lastDay == null || row.day > lastDay) lastDay = row.day;
    const { year, month } = ymdParts(row.day);
    const key = `${year}-${String(month).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const months: MonthOption[] = [...monthCounts.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, count]) => {
      const [year, month] = key.split("-").map(Number);
      return { key, label: monthLabel(year, month), count };
    });

  const donorChoices: DonorChoice[] = [...donorProfiles]
    .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, "es"))
    .map((donor) => ({ nombre: donor.nombre, count: donor.count }));

  return {
    rows,
    meta,
    donors: donorByKey,
    months,
    donorChoices,
    lastDay,
  };
}

function mine(rows: IndexedDonation[], profiles: DonorProfile[], totalArs: number, totalUsd: number, counted: number): Mining {
  const amounts: number[] = [];
  const modes = new Map<number, number>();
  const fx = new Map<number, number>();
  const typical = new Set([100, 200, 500, 1000]);
  let typicalCount = 0;
  let under200 = 0;
  let under200Usd = 0;
  let from5000 = 0;
  let from5000Usd = 0;
  const publicRows: IndexedDonation[] = [];

  for (const row of rows) {
    if (row.devuelta) continue;
    amounts.push(row.monto_ars);
    const key = Math.round(row.monto_ars);
    modes.set(key, (modes.get(key) ?? 0) + 1);
    if (typical.has(key)) typicalCount += 1;
    if (row.monto_ars <= 200) {
      under200 += 1;
      under200Usd += row.monto_usd;
    }
    if (row.monto_ars >= 5000) {
      from5000 += 1;
      from5000Usd += row.monto_usd;
    }
    if (row.monto_usd > 0) {
      const rate = Math.round(row.monto_ars / row.monto_usd);
      fx.set(rate, (fx.get(rate) ?? 0) + 1);
    }
    if (!row.privado) publicRows.push(row);
  }
  amounts.sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const medianArs =
    amounts.length === 0
      ? 0
      : amounts.length % 2 === 1
        ? amounts[mid]
        : (amounts[mid - 1] + amounts[mid]) / 2;

  let modeArs = 0;
  let modeCount = 0;
  for (const [amount, count] of modes) {
    if (count > modeCount || (count === modeCount && amount < modeArs)) {
      modeArs = amount;
      modeCount = count;
    }
  }

  let modalFx = 0;
  let modalFxCount = 0;
  for (const [rate, count] of fx) {
    if (count > modalFxCount || (count === modalFxCount && rate < modalFx)) {
      modalFx = rate;
      modalFxCount = count;
    }
  }

  let repeatDonors = 0;
  let repeatDonations = 0;
  let rawNames = 0;
  let heavyDonors = 0;
  let heavyUsd = 0;
  for (const donor of profiles) {
    rawNames += donor.aliases.length;
    if (donor.count > 1) {
      repeatDonors += 1;
      repeatDonations += donor.count;
    }
    if (donor.count >= 10) {
      heavyDonors += 1;
      heavyUsd += donor.usd;
    }
  }

  const byUsd = [...profiles].sort((a, b) => b.usd - a.usd);
  const donorsUntil = (share: number) => {
    let usd = 0;
    let n = 0;
    for (const donor of byUsd) {
      usd += donor.usd;
      n += 1;
      if (totalUsd > 0 && usd >= totalUsd * share) return n;
    }
    return n;
  };
  const shareOf = (fraction: number) => {
    const donors = Math.max(1, Math.round(profiles.length * fraction));
    let usd = 0;
    for (let i = 0; i < donors && i < byUsd.length; i += 1) usd += byUsd[i].usd;
    return { donors, usdShare: totalUsd > 0 ? usd / totalUsd : 0 };
  };
  const top = shareOf(0.01);
  const ten = byUsd.slice(0, Math.min(10, byUsd.length)).reduce((sum, donor) => sum + donor.usd, 0);

  const buckets = new Map<ConductKey, { texts: number; ars: number; usd: number }>();
  for (const item of CONDUCT_ORDER) buckets.set(item.key, { texts: 0, ars: 0, usd: 0 });
  const habit = new Map<string, Map<ConductKey, number>>();
  const laughOwn = new Map<string, { texts: number; laughs: number }>();
  const named = new Map<string, number>();
  const namedLaugh = new Map<string, number>();
  const clips = new Map<string, { count: number; usd: number }>();
  let youtubeLinks = 0;

  const aliasToKey = new Map<string, string>();
  const nameByKey = new Map<string, string>();
  for (const donor of profiles) {
    if (donor.count < 8) continue;
    nameByKey.set(donor.nameKey, donor.nombre);
    for (const alias of donor.aliases) {
      const token = fold(alias);
      if (token.length < 5) continue;
      aliasToKey.set(token, donor.nameKey);
    }
  }

  for (const row of publicRows) {
    const kind = classifyMessage(row.mensaje);
    const bucket = buckets.get(kind);
    if (bucket) {
      bucket.texts += 1;
      bucket.ars += row.monto_ars;
      bucket.usd += row.monto_usd;
    }
    const byKind = habit.get(row.nameKey) ?? new Map<ConductKey, number>();
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    habit.set(row.nameKey, byKind);

    const laughs = laughOwn.get(row.nameKey) ?? { texts: 0, laughs: 0 };
    laughs.texts += 1;
    if (hasLaugh(row.mensaje)) laughs.laughs += 1;
    laughOwn.set(row.nameKey, laughs);

    const ids = youtubeIds(row.mensaje);
    youtubeLinks += ids.length;
    for (const id of ids) {
      const clip = clips.get(id) ?? { count: 0, usd: 0 };
      clip.count += 1;
      clip.usd += row.monto_usd;
      clips.set(id, clip);
    }

    const tokens = fold(row.mensaje).match(/[a-z0-9_]{5,}/g) ?? [];
    const seen = new Set<string>();
    const laughing = hasLaugh(row.mensaje);
    for (const token of tokens) {
      const key = aliasToKey.get(token);
      if (!key || key === row.nameKey || seen.has(key)) continue;
      seen.add(key);
      named.set(key, (named.get(key) ?? 0) + 1);
      if (laughing) namedLaugh.set(key, (namedLaugh.get(key) ?? 0) + 1);
    }
  }

  const publicCount = publicRows.length;
  const conduct = CONDUCT_ORDER.map(({ key, label }) => {
    const bucket = buckets.get(key) ?? { texts: 0, ars: 0, usd: 0 };
    return {
      key,
      label,
      texts: bucket.texts,
      textShare: publicCount > 0 ? bucket.texts / publicCount : 0,
      usdShare: totalUsd > 0 ? bucket.usd / totalUsd : 0,
      meanArs: bucket.texts > 0 ? bucket.ars / bucket.texts : 0,
    };
  });

  let regularWriters = 0;
  let clipHabitDonors = 0;
  let storyHabitDonors = 0;
  for (const [, byKind] of habit) {
    let total = 0;
    let topKey: ConductKey = "story";
    let topCount = 0;
    for (const [key, n] of byKind) {
      total += n;
      if (n > topCount) {
        topKey = key;
        topCount = n;
      }
    }
    if (total < 8) continue;
    regularWriters += 1;
    if (topKey === "link") clipHabitDonors += 1;
    if (topKey === "story") storyHabitDonors += 1;
  }

  const namedRows = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([key, count]) => ({ key, nombre: nameByKey.get(key) ?? key, count }))
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 8);

  const ownLaugh = [...laughOwn.entries()]
    .filter(([, stats]) => stats.texts >= 20)
    .map(([key, stats]) => ({
      key,
      nombre: nameByKey.get(key) ?? profiles.find((donor) => donor.nameKey === key)?.nombre ?? key,
      share: stats.texts > 0 ? stats.laughs / stats.texts : 0,
      texts: stats.texts,
    }))
    .sort((a, b) => b.share - a.share || b.texts - a.texts)
    .slice(0, 8);

  const youtube = [...clips.entries()]
    .map(([id, clip]) => ({
      id,
      count: clip.count,
      usd: clip.usd,
      href: `https://www.youtube.com/watch?v=${id}`,
    }))
    .sort((a, b) => b.count - a.count || b.usd - a.usd)
    .slice(0, 12);

  return {
    medianArs,
    meanArs: counted > 0 ? totalArs / counted : 0,
    repeatDonors,
    repeatDonorShare: profiles.length > 0 ? repeatDonors / profiles.length : 0,
    repeatDonationShare: counted > 0 ? repeatDonations / counted : 0,
    topPercentCount: top.donors,
    topPercentUsdShare: top.usdShare,
    top10UsdShare: totalUsd > 0 ? ten / totalUsd : 0,
    rawNames,
    modeArs,
    modeCount,
    pareto: [
      { label: "1%", ...shareOf(0.01) },
      { label: "5%", ...shareOf(0.05) },
      { label: "10%", ...shareOf(0.1) },
      { label: "25%", ...shareOf(0.25) },
      { label: "50%", ...shareOf(0.5) },
    ].map(({ label, donors, usdShare }) => ({ label, donors, usdShare })),
    halfUsdDonors: donorsUntil(0.5),
    eightyUsdDonors: donorsUntil(0.8),
    typicalAmountsShare: counted > 0 ? typicalCount / counted : 0,
    under200TextShare: counted > 0 ? under200 / counted : 0,
    under200UsdShare: totalUsd > 0 ? under200Usd / totalUsd : 0,
    from5000TextShare: counted > 0 ? from5000 / counted : 0,
    from5000UsdShare: totalUsd > 0 ? from5000Usd / totalUsd : 0,
    heavyDonorShare: profiles.length > 0 ? heavyDonors / profiles.length : 0,
    heavyUsdShare: totalUsd > 0 ? heavyUsd / totalUsd : 0,
    modalFx,
    modalFxShare: counted > 0 ? modalFxCount / counted : 0,
    conduct,
    clipHabitDonors,
    storyHabitDonors,
    regularWriters,
    namedByOthers: namedRows(named),
    namedWithLaugh: namedRows(namedLaugh),
    ownLaugh,
    youtube,
    youtubeLinks,
    youtubeUnique: clips.size,
    youtubeOnce: [...clips.values()].filter((clip) => clip.count === 1).length,
  };
}

export function ensure() {
  if (!cache) cache = build();
  return cache;
}

let siteChoices: { key: string; count: number }[] | null = null;

function sitesOf(rows: IndexedDonation[]) {
  if (siteChoices) return siteChoices;
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const site of row.sites) counts.set(site, (counts.get(site) ?? 0) + 1);
  }
  siteChoices = [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([key, count]) => ({ key, count }));
  return siteChoices;
}

function context() {
  const { months, donorChoices, lastDay, rows } = ensure();
  return {
    months,
    donors: donorChoices,
    sites: sitesOf(rows),
    lastDay: lastDay == null ? "" : formatYmd(lastDay),
  };
}

function select(filters: Filters) {
  const { rows, lastDay } = ensure();
  const query = parseTextQuery(filters.q);
  const donor = canonicalKey(fold(filters.donor));
  const range = resolveDateRange(filters, Date.now(), lastDay);
  const matched: IndexedDonation[] = [];
  let ars = 0;
  let usd = 0;
  for (const row of rows) {
    if (donor && row.nameKey !== donor) continue;
    if (query.active && !matchText(row.haystack, query)) continue;
    if (filters.minArs !== null && row.monto_ars < filters.minArs) continue;
    if (filters.maxArs !== null && row.monto_ars > filters.maxArs) continue;
    if (filters.minUsd !== null && row.monto_usd < filters.minUsd) continue;
    if (filters.maxUsd !== null && row.monto_usd > filters.maxUsd) continue;
    if (range && (row.day == null || row.day < range.from || row.day > range.to)) continue;
    if (filters.conduct && (row.privado || row.conduct !== filters.conduct)) continue;
    if (filters.hasLink && !row.hasLink) continue;
    if (filters.hasYoutube && !row.hasYoutube) continue;
    if (filters.empty && !row.blank) continue;
    if (filters.priv && !row.privado) continue;
    if (filters.refunds === "out" && row.devuelta) continue;
    if (filters.refunds === "only" && !row.devuelta) continue;
    if (filters.currency === "usd" && !row.usdOriginal) continue;
    if (filters.currency === "ars" && row.usdOriginal) continue;
    if (filters.domain && !row.sites.includes(filters.domain)) continue;
    if (filters.video && !row.ytIds.includes(filters.video)) continue;
    matched.push(row);
    ars += row.monto_ars;
    usd += row.monto_usd;
  }

  if (filters.sort === "antigua") matched.reverse();
  else if (filters.sort === "mayor") matched.sort((a, b) => b.monto_ars - a.monto_ars || b.id - a.id);
  else if (filters.sort === "menor") matched.sort((a, b) => a.monto_ars - b.monto_ars || b.id - a.id);
  else if (filters.sort === "donante") {
    matched.sort((a, b) => a.donorLabel.localeCompare(b.donorLabel, "es") || b.id - a.id);
  } else if (filters.sort === "aporte") {
    matched.sort((a, b) => b.donorUsd - a.donorUsd || b.monto_usd - a.monto_usd || b.id - a.id);
  }

  return { matched, ars, usd };
}

function paginate(filters: Filters): PageResult {
  const { matched, ars, usd } = select(filters);
  const total = matched.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const start = (page - 1) * PAGE_SIZE;
  return {
    total,
    pages,
    page,
    rows: matched.slice(start, start + PAGE_SIZE).map(toPublic),
    ars,
    usd,
  };
}

const HIT_PREVIEW = 20;
const HIST_LIMIT = 24;
const FX_LIMIT = 16;

function moneyOf(row: IndexedDonation, cur: "ars" | "usd") {
  return cur === "usd" ? row.monto_usd : row.monto_ars;
}

function roundAmount(value: number, cur: "ars" | "usd") {
  if (cur === "usd") return Math.round(value * 100) / 100;
  return Math.round(value);
}

function toHit(row: IndexedDonation): ConcentrationHit {
  return {
    id: row.id,
    nombre: row.nombre,
    ars: row.monto_ars,
    usd: row.monto_usd,
    fecha_relativa: row.fecha_relativa,
    fecha_aprox: row.fecha_aprox,
  };
}

type RankedDonor = ConcentrationDonor & { cur: number };

function donorsUntilShare(ranked: RankedDonor[], total: number, pct: number): ConcentrationDonor[] {
  const target = total * (pct / 100);
  const picked: ConcentrationDonor[] = [];
  let running = 0;
  for (const donor of ranked) {
    running += donor.cur;
    picked.push({
      nombre: donor.nombre,
      count: donor.count,
      ars: donor.ars,
      usd: donor.usd,
      share: donor.share,
      cumulative: total > 0 ? running / total : 0,
    });
    if (running >= target) break;
  }
  return picked;
}

export function concentrate(params: ConcentrationParams): ConcentrationReport {
  const { rows, lastDay } = ensure();
  const range = resolveDateRange(params, Date.now(), lastDay);
  const scoped: IndexedDonation[] = [];
  let scopedArs = 0;
  let scopedUsd = 0;
  for (const row of rows) {
    if (params.refunds === "out" && row.devuelta) continue;
    if (params.refunds === "only" && !row.devuelta) continue;
    if (range && (row.day == null || row.day < range.from || row.day > range.to)) continue;
    scoped.push(row);
    scopedArs += row.monto_ars;
    scopedUsd += row.monto_usd;
  }

  const total = params.cur === "usd" ? scopedUsd : scopedArs;
  const typicalSet = new Set(params.typical.map((n) => roundAmount(n, params.cur)));
  const modes = new Map<number, number>();
  const fx = new Map<number, number>();
  const amounts: number[] = [];
  let typicalCount = 0;
  const underRows: IndexedDonation[] = [];
  const overRows: IndexedDonation[] = [];
  const agg = new Map<string, { nombre: string; count: number; ars: number; usd: number }>();

  for (const row of scoped) {
    const value = moneyOf(row, params.cur);
    amounts.push(value);
    const key = roundAmount(value, params.cur);
    modes.set(key, (modes.get(key) ?? 0) + 1);
    if (typicalSet.has(key)) typicalCount += 1;
    if (value <= params.under) underRows.push(row);
    if (value >= params.over) overRows.push(row);
    if (row.monto_usd > 0) {
      const rate = Math.round(row.monto_ars / row.monto_usd);
      fx.set(rate, (fx.get(rate) ?? 0) + 1);
    }
    const current = agg.get(row.nameKey);
    if (current) {
      current.count += 1;
      current.ars += row.monto_ars;
      current.usd += row.monto_usd;
    } else {
      agg.set(row.nameKey, {
        nombre: row.donorLabel,
        count: 1,
        ars: row.monto_ars,
        usd: row.monto_usd,
      });
    }
  }

  amounts.sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median =
    amounts.length === 0
      ? 0
      : amounts.length % 2 === 1
        ? amounts[mid]
        : (amounts[mid - 1] + amounts[mid]) / 2;

  let mode = 0;
  let modeCount = 0;
  for (const [amount, count] of modes) {
    if (count > modeCount || (count === modeCount && amount < mode)) {
      mode = amount;
      modeCount = count;
    }
  }

  let modalFx = 0;
  let modalFxCount = 0;
  for (const [rate, count] of fx) {
    if (count > modalFxCount || (count === modalFxCount && rate < modalFx)) {
      modalFx = rate;
      modalFxCount = count;
    }
  }

  const ranked: RankedDonor[] = [...agg.values()]
    .map((donor) => {
      const cur = params.cur === "usd" ? donor.usd : donor.ars;
      return {
        nombre: donor.nombre,
        count: donor.count,
        ars: donor.ars,
        usd: donor.usd,
        share: total > 0 ? cur / total : 0,
        cumulative: 0,
        cur,
      };
    })
    .sort((a, b) => b.cur - a.cur || b.count - a.count || a.nombre.localeCompare(b.nombre, "es"));

  const cuts = params.cuts.map((pct) => {
    const donors = donorsUntilShare(ranked, total, pct);
    return { pct, donorCount: donors.length, donors };
  });

  const typical: AmountBucket[] = params.typical.map((amount) => {
    const key = roundAmount(amount, params.cur);
    const count = modes.get(key) ?? 0;
    return { amount: key, count, share: scoped.length > 0 ? count / scoped.length : 0 };
  });

  const histogram: AmountBucket[] = [...modes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, HIST_LIMIT)
    .map(([amount, count]) => ({
      amount,
      count,
      share: scoped.length > 0 ? count / scoped.length : 0,
    }));

  const fxRows = [...fx.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, FX_LIMIT)
    .map(([rate, count]) => ({
      rate,
      count,
      share: scoped.length > 0 ? count / scoped.length : 0,
    }));

  const recurrentSource = [...ranked.filter((donor) => donor.count >= params.reps)].sort(
    (a, b) => b.count - a.count || b.cur - a.cur || a.nombre.localeCompare(b.nombre, "es"),
  );
  let recurrentAmount = 0;
  const recurrentDonors: ConcentrationDonor[] = recurrentSource.map((donor) => {
    recurrentAmount += donor.cur;
    return {
      nombre: donor.nombre,
      count: donor.count,
      ars: donor.ars,
      usd: donor.usd,
      share: total > 0 ? donor.cur / total : 0,
      cumulative: 0,
    };
  });

  const newestThenBig = (list: IndexedDonation[]) =>
    [...list]
      .sort((a, b) => b.id - a.id || moneyOf(b, params.cur) - moneyOf(a, params.cur))
      .slice(0, HIT_PREVIEW)
      .map(toHit);

  const underAmount = underRows.reduce((sum, row) => sum + moneyOf(row, params.cur), 0);
  const overAmount = overRows.reduce((sum, row) => sum + moneyOf(row, params.cur), 0);

  return {
    params,
    scopedCount: scoped.length,
    scopedArs,
    scopedUsd,
    donorCount: ranked.length,
    cuts,
    typical,
    typicalShare: scoped.length > 0 ? typicalCount / scoped.length : 0,
    under: {
      count: underRows.length,
      textShare: scoped.length > 0 ? underRows.length / scoped.length : 0,
      amountShare: total > 0 ? underAmount / total : 0,
      rows: newestThenBig(underRows),
    },
    over: {
      count: overRows.length,
      textShare: scoped.length > 0 ? overRows.length / scoped.length : 0,
      amountShare: total > 0 ? overAmount / total : 0,
      rows: [...overRows]
        .sort((a, b) => moneyOf(b, params.cur) - moneyOf(a, params.cur) || b.id - a.id)
        .slice(0, HIT_PREVIEW)
        .map(toHit),
    },
    recurrent: {
      donors: recurrentDonors,
      donorShare: ranked.length > 0 ? recurrentDonors.length / ranked.length : 0,
      amountShare: total > 0 ? recurrentAmount / total : 0,
    },
    median,
    mode,
    modeCount,
    histogram,
    fx: fxRows,
    modalFx,
    modalFxShare: scoped.length > 0 ? modalFxCount / scoped.length : 0,
  };
}

export function homePayload(filters: Filters, concentration?: ConcentrationParams) {
  const result = paginate(filters);
  return {
    meta: ensure().meta,
    result,
    filters: { ...filters, page: result.page },
    concentration: concentrate(concentration ?? parseConcentration({})),
    ...context(),
  };
}

export function donorPayload(name: string, filters: Filters) {
  const donor = ensure().donors.get(canonicalKey(fold(readDonorName(name)))) ?? null;
  if (!donor) return { found: false as const };
  const scoped = { ...filters, donor: donor.nombre };
  const result = paginate(scoped);
  return {
    found: true as const,
    donor,
    result,
    filters: { ...scoped, page: result.page },
    ...context(),
  };
}

function csvCell(value: string | number | boolean) {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsv(url: URL) {
  const filters = parseFilters(Object.fromEntries(url.searchParams.entries()));
  const rows = select(filters).matched.map(toPublic);
  const header = [
    "id",
    "nombre",
    "mensaje",
    "monto_ars",
    "monto_usd",
    "privado",
    "devuelta",
    "devolucion",
    "fecha_relativa",
    "fecha_aprox",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        csvCell(row.nombre),
        csvCell(row.mensaje),
        row.monto_ars,
        row.monto_usd,
        row.privado ? "si" : "no",
        row.devuelta ? "si" : "no",
        csvCell(row.devolucion ?? ""),
        csvCell(row.fecha_relativa),
        csvCell(row.fecha_aprox ?? ""),
      ].join(","),
    );
  }
  const body = `\uFEFF${lines.join("\n")}\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="donaciones-losherederosdealberdi.csv"',
      "Cache-Control": "no-store",
    },
  });
}
