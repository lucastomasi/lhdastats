import {
  DRILL_PAGE_SIZE,
  scopeToSearch,
  type BracketStat,
  type ClipStat,
  type ConductStat,
  type DomainStat,
  type DonorLine,
  type DrillInput,
  type DrillResult,
  type ListSearch,
  type MentionStat,
  type PeriodStat,
  type RankRow,
  type StatsReport,
  type StatsScope,
} from "./archive";
import { CONDUCT_ORDER, hasLaugh, type ConductKey } from "./conduct";
import { BRACKETS, countWords, ensure, fold, PERIOD_KEYS, periodOf, rankWords, toPublic, type IndexedDonation } from "./donations.server";
import { canonicalKey } from "./identities";
import { formatYmd, monthLabel, resolveDateRange } from "./query";

type Cur = "ars" | "usd";

const USD_BRACKETS: { label: string; min: number; max: number | null }[] = [
  { label: "Menos de US$ 0,50", min: 0, max: 0.5 },
  { label: "US$ 0,50 a 1,99", min: 0.5, max: 2 },
  { label: "US$ 2 a 9,99", min: 2, max: 10 },
  { label: "US$ 10 a 49,99", min: 10, max: 50 },
  { label: "US$ 50 o más", min: 50, max: null },
];

const RANK_LIMIT = 50;
const TOP_LIMIT = 6;
const CLIP_LIMIT = 30;
const DOMAIN_LIMIT = 20;

function amountOf(row: IndexedDonation, cur: Cur) {
  return cur === "usd" ? row.monto_usd : row.monto_ars;
}

function roundAmount(value: number, cur: Cur) {
  return cur === "usd" ? Math.round(value * 100) / 100 : Math.round(value);
}

function bracketsFor(cur: Cur) {
  return cur === "usd" ? USD_BRACKETS : BRACKETS;
}

type Agg = { key: string; nombre: string; count: number; ars: number; usd: number };

class DonorAgg {
  map = new Map<string, Agg>();
  add(row: IndexedDonation) {
    const current = this.map.get(row.nameKey);
    if (current) {
      current.count += 1;
      current.ars += row.monto_ars;
      current.usd += row.monto_usd;
    } else {
      this.map.set(row.nameKey, {
        key: row.nameKey,
        nombre: row.donorLabel,
        count: 1,
        ars: row.monto_ars,
        usd: row.monto_usd,
      });
    }
  }
  get size() {
    return this.map.size;
  }
  sorted(cur: Cur) {
    return [...this.map.values()].sort(
      (a, b) => (cur === "usd" ? b.usd - a.usd : b.ars - a.ars) || b.count - a.count || a.nombre.localeCompare(b.nombre, "es"),
    );
  }
  top(cur: Cur, limit = TOP_LIMIT): DonorLine[] {
    return this.sorted(cur).slice(0, limit).map(line);
  }
}

function line(agg: Agg): DonorLine {
  return { nombre: agg.nombre, count: agg.count, ars: agg.ars, usd: agg.usd };
}

function scopeKey(scope: StatsScope) {
  const today = formatYmd(resolveDateRange({ when: "hoy", from: "", to: "" }, Date.now())!.from);
  return `${scope.when}|${scope.from}|${scope.to}|${scope.cur}|${today}`;
}

function scoped(scope: StatsScope) {
  const { rows, lastDay } = ensure();
  const range = resolveDateRange(scope, Date.now(), lastDay);
  const kept: IndexedDonation[] = [];
  const refunded: IndexedDonation[] = [];
  for (const row of rows) {
    if (range && (row.day == null || row.day < range.from || row.day > range.to)) continue;
    if (row.devuelta) refunded.push(row);
    else kept.push(row);
  }
  return { rows: kept, refunded, range };
}

/* ---------------- YouTube titles (oEmbed, cached in memory) ---------------- */

type ClipMeta = { title: string; channel: string } | null;
const clipMeta = new Map<string, ClipMeta>();
const clipPending = new Map<string, Promise<void>>();

function fetchClipMeta(id: string): Promise<void> {
  if (clipMeta.has(id)) return Promise.resolve();
  const pending = clipPending.get(id);
  if (pending) return pending;
  const job = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
        { signal: controller.signal },
      );
      clearTimeout(timer);
      if (!res.ok) {
        clipMeta.set(id, null);
        return;
      }
      const data = (await res.json()) as { title?: string; author_name?: string };
      clipMeta.set(id, data.title ? { title: data.title, channel: data.author_name ?? "" } : null);
    } catch {
      // network hiccup: leave uncached so a later request can retry
    } finally {
      clipPending.delete(id);
    }
  })();
  clipPending.set(id, job);
  return job;
}

async function withTitles(clips: ClipStat[]): Promise<ClipStat[]> {
  const missing = clips.filter((clip) => !clipMeta.has(clip.id));
  if (missing.length > 0) {
    await Promise.race([
      Promise.all(missing.map((clip) => fetchClipMeta(clip.id))),
      new Promise((resolve) => setTimeout(resolve, 1800)),
    ]);
  }
  return clips.map((clip) => {
    const meta = clipMeta.get(clip.id);
    return meta ? { ...clip, title: meta.title, channel: meta.channel || null } : clip;
  });
}

/* ---------------- Mentions (aliases of regular donors) ---------------- */

let aliasCache: { aliasToKey: Map<string, string>; nameByKey: Map<string, string> } | null = null;

function aliasIndex() {
  if (aliasCache) return aliasCache;
  const aliasToKey = new Map<string, string>();
  const nameByKey = new Map<string, string>();
  for (const donor of ensure().donors.values()) {
    if (donor.count < 8) continue;
    nameByKey.set(donor.nameKey, donor.nombre);
    for (const alias of donor.aliases) {
      const token = fold(alias);
      if (token.length < 5) continue;
      aliasToKey.set(token, donor.nameKey);
    }
  }
  aliasCache = { aliasToKey, nameByKey };
  return aliasCache;
}

function mentionedKeys(row: IndexedDonation): string[] {
  const { aliasToKey } = aliasIndex();
  const tokens = fold(row.mensaje).match(/[a-z0-9_]{5,}/g) ?? [];
  const keys: string[] = [];
  for (const token of tokens) {
    const key = aliasToKey.get(token);
    if (!key || key === row.nameKey || keys.includes(key)) continue;
    keys.push(key);
  }
  return keys;
}

/* ---------------- Stats report ---------------- */

const reportCache = new Map<string, StatsReport>();

export async function statsFor(scope: StatsScope): Promise<StatsReport> {
  const key = scopeKey(scope);
  const cached = reportCache.get(key);
  if (cached) return cached;
  const report = build(scope);
  report.youtube.clips = await withTitles(report.youtube.clips);
  if (reportCache.size > 24) reportCache.delete(reportCache.keys().next().value!);
  // Only cache once titles resolved (or confirmed missing) so later visits get them.
  if (report.youtube.clips.every((clip) => clipMeta.has(clip.id))) reportCache.set(key, report);
  return report;
}

function build(scope: StatsScope): StatsReport {
  const cur = scope.cur;
  const { rows, refunded, range } = scoped(scope);
  const profiles = ensure().donors;
  const amt = (row: IndexedDonation) => amountOf(row, cur);

  let ars = 0;
  let usd = 0;
  let total = 0;
  let privateCount = 0;
  const donors = new DonorAgg();
  const variants = new Map<string, Set<string>>();
  const amounts: number[] = [];
  const modes = new Map<number, number>();
  const publicRows: IndexedDonation[] = [];
  const bracketSet = bracketsFor(cur);
  const brackets: BracketStat[] = bracketSet.map((bracket, index) => ({
    key: String(index),
    label: bracket.label,
    min: bracket.min,
    max: bracket.max,
    count: 0,
    ars: 0,
    usd: 0,
  }));
  const periodMap = new Map<string, { label: string; rows: number; ars: number; usd: number; from: number; to: number; donors: DonorAgg }>();
  const monthMap = new Map<string, { rows: number; ars: number; usd: number; from: number; to: number; donors: DonorAgg }>();

  for (const row of rows) {
    const value = amt(row);
    ars += row.monto_ars;
    usd += row.monto_usd;
    total += value;
    donors.add(row);
    const names = variants.get(row.nameKey) ?? new Set<string>();
    names.add(row.nombre);
    variants.set(row.nameKey, names);
    amounts.push(value);
    const rounded = roundAmount(value, cur);
    modes.set(rounded, (modes.get(rounded) ?? 0) + 1);
    if (row.privado) privateCount += 1;
    else publicRows.push(row);
    const bracket = bracketSet.findIndex((item) => value >= item.min && (item.max === null || value < item.max));
    if (bracket >= 0) {
      brackets[bracket].count += 1;
      brackets[bracket].ars += row.monto_ars;
      brackets[bracket].usd += row.monto_usd;
    }
    const day = row.day ?? 0;
    const period = periodMap.get(row.period) ?? {
      label: periodOf(row.fecha_relativa).label,
      rows: 0,
      ars: 0,
      usd: 0,
      from: day || Number.MAX_SAFE_INTEGER,
      to: day,
      donors: new DonorAgg(),
    };
    period.rows += 1;
    period.ars += row.monto_ars;
    period.usd += row.monto_usd;
    if (day) {
      period.from = Math.min(period.from, day);
      period.to = Math.max(period.to, day);
    }
    period.donors.add(row);
    periodMap.set(row.period, period);
    if (row.month) {
      const month = monthMap.get(row.month) ?? {
        rows: 0,
        ars: 0,
        usd: 0,
        from: day,
        to: day,
        donors: new DonorAgg(),
      };
      month.rows += 1;
      month.ars += row.monto_ars;
      month.usd += row.monto_usd;
      month.from = Math.min(month.from, day);
      month.to = Math.max(month.to, day);
      month.donors.add(row);
      monthMap.set(row.month, month);
    }
  }

  const count = rows.length;
  const ranked = donors.sorted(cur);
  const byCount = [...ranked].sort((a, b) => b.count - a.count || (cur === "usd" ? b.usd - a.usd : b.ars - a.ars));
  const share = (value: number) => (total > 0 ? value / total : 0);
  const curOf = (agg: Agg) => (cur === "usd" ? agg.usd : agg.ars);
  const rankRow = (agg: Agg): RankRow => {
    const profile = profiles.get(agg.key);
    return {
      ...line(agg),
      aliases: [...(variants.get(agg.key) ?? [])],
      kickGiftUsd: profile?.kickGiftUsd ?? 0,
      share: share(curOf(agg)),
    };
  };

  // findings
  amounts.sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median = amounts.length === 0 ? 0 : amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
  let mode = 0;
  let modeCount = 0;
  for (const [amount, n] of modes) {
    if (n > modeCount || (n === modeCount && amount < mode)) {
      mode = amount;
      modeCount = n;
    }
  }
  let repeatDonors = 0;
  let repeatDonations = 0;
  let rawNames = 0;
  for (const agg of ranked) {
    if (agg.count > 1) {
      repeatDonors += 1;
      repeatDonations += agg.count;
    }
    rawNames += variants.get(agg.key)?.size ?? 0;
  }
  const pareto = [0.01, 0.05, 0.1, 0.25, 0.5].map((fraction) => {
    const n = Math.max(1, Math.round(ranked.length * fraction));
    let sum = 0;
    for (let i = 0; i < n && i < ranked.length; i += 1) sum += curOf(ranked[i]);
    return {
      label: `${Math.round(fraction * 100)}%`,
      donors: Math.min(n, ranked.length),
      share: share(sum),
      list: ranked.slice(0, Math.min(n, RANK_LIMIT)).map(line),
    };
  });
  const top10 = ranked.slice(0, 10).reduce((sum, agg) => sum + curOf(agg), 0);
  const aliasTop = [...variants.entries()]
    .filter(([, names]) => names.size > 1)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 12)
    .map(([key, names]) => ({ nombre: profiles.get(key)?.nombre ?? key, aliases: [...names] }));
  const modeRows = [...modes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 12)
    .map(([amount, n]) => ({ amount, count: n, share: count > 0 ? n / count : 0 }));

  // conduct, words, youtube, domains, mentions (public messages only)
  const conductBuckets = new Map<ConductKey, { texts: number; amount: number; ars: number; usd: number; donors: DonorAgg }>();
  for (const item of CONDUCT_ORDER) {
    conductBuckets.set(item.key, { texts: 0, amount: 0, ars: 0, usd: 0, donors: new DonorAgg() });
  }
  const habit = new Map<string, Map<ConductKey, number>>();
  const wordMap = new Map<string, Map<string, number>>();
  const clips = new Map<string, { count: number; ars: number; usd: number; donors: Set<string> }>();
  let ytLinks = 0;
  const domains = new Map<
    string,
    { links: number; messages: number; ars: number; usd: number; donors: DonorAgg; urls: Map<string, number> }
  >();
  const named = new Map<string, number>();
  const namedLaugh = new Map<string, number>();
  const laughOwn = new Map<string, { texts: number; laughs: number }>();

  for (const row of publicRows) {
    const bucket = conductBuckets.get(row.conduct);
    if (bucket) {
      bucket.texts += 1;
      bucket.amount += amt(row);
      bucket.ars += row.monto_ars;
      bucket.usd += row.monto_usd;
      bucket.donors.add(row);
    }
    const byKind = habit.get(row.nameKey) ?? new Map<ConductKey, number>();
    byKind.set(row.conduct, (byKind.get(row.conduct) ?? 0) + 1);
    habit.set(row.nameKey, byKind);

    countWords(row.mensaje, wordMap);

    for (const id of row.ytIds) {
      ytLinks += 1;
      const clip = clips.get(id) ?? { count: 0, ars: 0, usd: 0, donors: new Set<string>() };
      clip.count += 1;
      clip.ars += row.monto_ars;
      clip.usd += row.monto_usd;
      clip.donors.add(row.nameKey);
      clips.set(id, clip);
    }

    if (row.links.length > 0) {
      for (const site of row.sites) {
        const entry = domains.get(site) ?? {
          links: 0,
          messages: 0,
          ars: 0,
          usd: 0,
          donors: new DonorAgg(),
          urls: new Map<string, number>(),
        };
        entry.messages += 1;
        entry.ars += row.monto_ars;
        entry.usd += row.monto_usd;
        entry.donors.add(row);
        domains.set(site, entry);
      }
      for (const link of row.links) {
        const entry = domains.get(link.site);
        if (!entry) continue;
        entry.links += 1;
        const url = link.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/[?&](si|feature|igsh|utm_[a-z]+|s|t)=[^&]*$/i, "");
        entry.urls.set(url, (entry.urls.get(url) ?? 0) + 1);
      }
    }

    const laughing = hasLaugh(row.mensaje);
    const own = laughOwn.get(row.nameKey) ?? { texts: 0, laughs: 0 };
    own.texts += 1;
    if (laughing) own.laughs += 1;
    laughOwn.set(row.nameKey, own);
    for (const key of mentionedKeys(row)) {
      named.set(key, (named.get(key) ?? 0) + 1);
      if (laughing) namedLaugh.set(key, (namedLaugh.get(key) ?? 0) + 1);
    }
  }

  const publicCount = publicRows.length;
  const conduct: ConductStat[] = CONDUCT_ORDER.map(({ key, label }) => {
    const bucket = conductBuckets.get(key)!;
    return {
      key,
      label,
      texts: bucket.texts,
      textShare: publicCount > 0 ? bucket.texts / publicCount : 0,
      amountShare: share(bucket.amount),
      meanArs: bucket.texts > 0 ? bucket.ars / bucket.texts : 0,
      meanUsd: bucket.texts > 0 ? bucket.usd / bucket.texts : 0,
      top: bucket.donors.top(cur),
    };
  });

  let regularWriters = 0;
  let clipHabitDonors = 0;
  let storyHabitDonors = 0;
  for (const byKind of habit.values()) {
    let texts = 0;
    let topKey: ConductKey = "story";
    let topCount = 0;
    for (const [kind, n] of byKind) {
      texts += n;
      if (n > topCount) {
        topKey = kind;
        topCount = n;
      }
    }
    if (texts < 8) continue;
    regularWriters += 1;
    if (topKey === "link") clipHabitDonors += 1;
    if (topKey === "story") storyHabitDonors += 1;
  }

  const periods: PeriodStat[] = PERIOD_KEYS.flatMap((key) => {
    const point = periodMap.get(key);
    if (!point) return [];
    return [
      {
        key,
        label: point.label,
        count: point.rows,
        ars: point.ars,
        usd: point.usd,
        from: point.to ? formatYmd(point.from) : "",
        to: point.to ? formatYmd(point.to) : "",
        top: point.donors.top(cur),
      },
    ];
  });

  const months: PeriodStat[] = [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, point]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        key,
        label: monthLabel(year, month),
        count: point.rows,
        ars: point.ars,
        usd: point.usd,
        from: formatYmd(point.from),
        to: formatYmd(point.to),
        top: point.donors.top(cur),
      };
    });

  const clipRows: ClipStat[] = [...clips.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].usd - a[1].usd)
    .slice(0, CLIP_LIMIT)
    .map(([id, clip]) => ({
      id,
      count: clip.count,
      ars: clip.ars,
      usd: clip.usd,
      donors: clip.donors.size,
      href: `https://www.youtube.com/watch?v=${id}`,
      title: null,
      channel: null,
    }));

  const domainRows: DomainStat[] = [...domains.entries()]
    .sort((a, b) => b[1].messages - a[1].messages || b[1].usd - a[1].usd)
    .slice(0, DOMAIN_LIMIT)
    .map(([key, entry]) => ({
      key,
      links: entry.links,
      messages: entry.messages,
      ars: entry.ars,
      usd: entry.usd,
      donors: entry.donors.size,
      top: entry.donors.top(cur),
      urls: [...entry.urls.entries()]
        .filter(([, n]) => n > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([url, n]) => ({ url, count: n })),
    }));

  const { nameByKey } = aliasIndex();
  const mentionRows = (map: Map<string, number>): MentionStat[] =>
    [...map.entries()]
      .map(([key, n]) => ({ key, nombre: nameByKey.get(key) ?? key, count: n }))
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 10);
  const minTexts = range ? 8 : 20;
  const ownLaugh = [...laughOwn.entries()]
    .filter(([, stats]) => stats.texts >= minTexts)
    .map(([key, stats]) => ({
      key,
      nombre: profiles.get(key)?.nombre ?? key,
      count: stats.texts,
      share: stats.texts > 0 ? stats.laughs / stats.texts : 0,
    }))
    .sort((a, b) => b.share - a.share || b.count - a.count)
    .slice(0, 10);

  return {
    scope,
    range: range ? { from: formatYmd(range.from), to: formatYmd(range.to) } : null,
    summary: {
      count,
      ars,
      usd,
      donors: donors.size,
      publicCount,
      privateCount,
      refundedCount: refunded.length,
      refundedArs: refunded.reduce((sum, row) => sum + row.monto_ars, 0),
      refundedUsd: refunded.reduce((sum, row) => sum + row.monto_usd, 0),
    },
    findings: {
      median,
      mean: count > 0 ? total / count : 0,
      mode,
      modeCount,
      repeatDonors,
      repeatDonorShare: ranked.length > 0 ? repeatDonors / ranked.length : 0,
      repeatDonationShare: count > 0 ? repeatDonations / count : 0,
      topPercentCount: pareto[0].donors,
      topPercentShare: pareto[0].share,
      top10Share: share(top10),
      rawNames,
      pareto,
      repeatTop: byCount.slice(0, 20).map(line),
      aliasTop,
      modes: modeRows,
    },
    conduct,
    habits: { regularWriters, clipHabitDonors, storyHabitDonors },
    periods,
    months,
    ranking: {
      byAmount: ranked.slice(0, RANK_LIMIT).map(rankRow),
      byCount: byCount.slice(0, RANK_LIMIT).map(rankRow),
    },
    words: rankWords(wordMap).slice(0, 72),
    youtube: {
      clips: clipRows,
      links: ytLinks,
      unique: clips.size,
      once: [...clips.values()].filter((clip) => clip.count === 1).length,
    },
    domains: domainRows,
    brackets,
    mentions: { named: mentionRows(named), namedLaugh: mentionRows(namedLaugh), ownLaugh },
  };
}

/* ---------------- Drill-down: the rows behind one stat ---------------- */

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function predicateFor(input: DrillInput): ((row: IndexedDonation) => boolean) | null {
  const { kind, key } = input;
  const cur = input.scope.cur;
  switch (kind) {
    case "conduct":
      return (row) => !row.privado && row.conduct === key;
    case "period":
      return (row) => row.period === key;
    case "month":
      return (row) => row.month === key;
    case "yt":
      return (row) => row.ytIds.includes(key);
    case "domain":
      return (row) => !row.privado && row.sites.includes(key);
    case "donor": {
      const nameKey = canonicalKey(fold(key));
      return (row) => row.nameKey === nameKey;
    }
    case "word": {
      const needle = fold(key).trim();
      if (!needle) return null;
      const re = new RegExp(`(^|[^a-z0-9_])${escapeRe(needle)}($|[^a-z0-9_])`);
      return (row) => !row.privado && re.test(fold(row.mensaje.replace(/https?:\/\/\S+|www\.\S+/gi, " ")));
    }
    case "mention": {
      const target = canonicalKey(fold(key));
      return (row) => !row.privado && mentionedKeys(row).includes(target);
    }
    case "bracket": {
      const bracket = bracketsFor(cur)[Number(key)];
      if (!bracket) return null;
      return (row) => {
        const value = amountOf(row, cur);
        return value >= bracket.min && (bracket.max === null || value < bracket.max);
      };
    }
    case "amount": {
      const target = Number(key);
      if (!Number.isFinite(target)) return null;
      return (row) => roundAmount(amountOf(row, cur), cur) === roundAmount(target, cur);
    }
    default:
      return null;
  }
}

function searchFor(input: DrillInput, matched: IndexedDonation[]): ListSearch {
  const { kind, key, scope } = input;
  const search: ListSearch = { ...scopeToSearch(scope), dev: "out" };
  if (scope.when && scope.when !== "todo") search.when = scope.when;
  if (scope.from) search.from = scope.from;
  if (scope.to) search.to = scope.to;
  const spanOfMatched = () => {
    let from = Number.MAX_SAFE_INTEGER;
    let to = 0;
    for (const row of matched) {
      if (row.day == null) continue;
      from = Math.min(from, row.day);
      to = Math.max(to, row.day);
    }
    if (!to) return;
    delete search.when;
    search.from = formatYmd(from);
    search.to = formatYmd(to);
  };
  switch (kind) {
    case "conduct":
      search.conduct = key;
      break;
    case "period":
    case "month":
      spanOfMatched();
      break;
    case "yt":
      search.yt = key;
      break;
    case "domain":
      search.dom = key;
      break;
    case "donor":
      search.donor = ensure().donors.get(canonicalKey(fold(key)))?.nombre ?? key;
      break;
    case "word":
      search.q = key;
      break;
    case "mention": {
      const donor = ensure().donors.get(canonicalKey(fold(key)));
      const alias = donor?.aliases.find((name) => fold(name).length >= 5) ?? key;
      search.q = alias;
      break;
    }
    case "bracket": {
      const bracket = bracketsFor(scope.cur)[Number(key)];
      if (!bracket) break;
      if (scope.cur === "usd") {
        if (bracket.min > 0) search.minusd = bracket.min;
        if (bracket.max !== null) search.maxusd = Math.round((bracket.max - 0.01) * 100) / 100;
      } else {
        if (bracket.min > 0) search.min = bracket.min;
        if (bracket.max !== null) search.max = bracket.max - 0.01;
      }
      break;
    }
    case "amount": {
      const value = Number(key);
      if (scope.cur === "usd") {
        search.minusd = value;
        search.maxusd = value;
      } else {
        search.min = value;
        search.max = value;
      }
      break;
    }
  }
  return search;
}

export function drill(input: DrillInput): DrillResult {
  const predicate = predicateFor(input);
  const empty: DrillResult = {
    kind: input.kind,
    key: input.key,
    total: 0,
    ars: 0,
    usd: 0,
    page: 1,
    pages: 1,
    rows: [],
    top: [],
    search: {},
  };
  if (!predicate) return empty;
  const { rows } = scoped(input.scope);
  const matched: IndexedDonation[] = [];
  const donors = new DonorAgg();
  let ars = 0;
  let usd = 0;
  for (const row of rows) {
    if (!predicate(row)) continue;
    matched.push(row);
    donors.add(row);
    ars += row.monto_ars;
    usd += row.monto_usd;
  }
  if (input.sort === "mayor") {
    matched.sort((a, b) => amountOf(b, input.scope.cur) - amountOf(a, input.scope.cur) || b.id - a.id);
  }
  const pages = Math.max(1, Math.ceil(matched.length / DRILL_PAGE_SIZE));
  const page = Math.min(Math.max(1, input.page), pages);
  const start = (page - 1) * DRILL_PAGE_SIZE;
  return {
    kind: input.kind,
    key: input.key,
    total: matched.length,
    ars,
    usd,
    page,
    pages,
    rows: matched.slice(start, start + DRILL_PAGE_SIZE).map(toPublic),
    top: donors.top(input.scope.cur, 8),
    search: searchFor(input, matched),
  };
}
