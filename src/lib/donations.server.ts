import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_SIZE,
  parseFilters,
  readDonorName,
  type ArchiveMeta,
  type Donation,
  type DonorProfile,
  type Filters,
  type Mining,
  type PageResult,
  type PeriodPoint,
  type WordTerm,
} from "./archive";
import { STOP_WORDS } from "./stopwords";
import { canonicalKey } from "./identities";

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

type IndexedDonation = Donation & {
  nameKey: string;
  haystack: string;
};

type Cache = {
  rows: IndexedDonation[];
  meta: ArchiveMeta;
  donors: Map<string, DonorProfile>;
};

const TOKEN = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_]{3,}/g;
const URL_CHUNK = /https?:\/\/\S+|www\.\S+/gi;

const BRACKETS: { label: string; min: number; max: number | null }[] = [
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

export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function periodOf(label: string): { key: string; label: string } {
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

function toPublic(row: IndexedDonation): Donation {
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

function countWords(message: string, wordMap: Map<string, Map<string, number>>) {
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

function rankWords(wordMap: Map<string, Map<string, number>>): WordTerm[] {
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
    return {
      ...row,
      devuelta: Boolean(devolucion),
      devolucion,
      nameKey: canonicalKey(fold(row.nombre)),
      haystack: fold(`${row.nombre} ${row.mensaje}${extra}`),
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

  return {
    rows,
    meta,
    donors: new Map(donorProfiles.map((donor) => [donor.nameKey, donor])),
  };
}

function mine(rows: IndexedDonation[], profiles: DonorProfile[], totalArs: number, totalUsd: number, counted: number): Mining {
  const amounts: number[] = [];
  const modes = new Map<number, number>();
  for (const row of rows) {
    if (row.devuelta) continue;
    amounts.push(row.monto_ars);
    const key = Math.round(row.monto_ars);
    modes.set(key, (modes.get(key) ?? 0) + 1);
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

  let repeatDonors = 0;
  let repeatDonations = 0;
  let rawNames = 0;
  for (const donor of profiles) {
    rawNames += donor.aliases.length;
    if (donor.count > 1) {
      repeatDonors += 1;
      repeatDonations += donor.count;
    }
  }

  const byUsd = [...profiles].sort((a, b) => b.usd - a.usd);
  const shareOf = (fraction: number) => {
    const donors = Math.max(1, Math.round(profiles.length * fraction));
    let usd = 0;
    for (let i = 0; i < donors && i < byUsd.length; i += 1) usd += byUsd[i].usd;
    return { donors, usdShare: totalUsd > 0 ? usd / totalUsd : 0 };
  };
  const top = shareOf(0.01);
  const ten = byUsd.slice(0, Math.min(10, byUsd.length)).reduce((sum, donor) => sum + donor.usd, 0);

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
  };
}

function ensure() {
  if (!cache) cache = build();
  return cache;
}

function select(filters: Filters) {
  const { rows } = ensure();
  const q = fold(filters.q);
  const donor = canonicalKey(fold(filters.donor));
  let matched = rows.filter((row) => {
    if (donor && row.nameKey !== donor) return false;
    if (q && !row.haystack.includes(q)) return false;
    if (filters.min !== null && row.monto_ars < filters.min) return false;
    return true;
  });
  if (filters.sort === "antigua") matched = [...matched].reverse();
  else if (filters.sort === "mayor") {
    matched = [...matched].sort((a, b) => b.monto_ars - a.monto_ars || b.id - a.id);
  } else if (filters.sort === "menor") {
    matched = [...matched].sort((a, b) => a.monto_ars - b.monto_ars || b.id - a.id);
  }
  return matched;
}

function paginate(filters: Filters): PageResult {
  const matched = select(filters);
  const total = matched.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const start = (page - 1) * PAGE_SIZE;
  return {
    total,
    pages,
    page,
    rows: matched.slice(start, start + PAGE_SIZE).map(toPublic),
  };
}

export function homePayload(filters: Filters) {
  const result = paginate(filters);
  return {
    meta: ensure().meta,
    result,
    filters: { ...filters, page: result.page },
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
  };
}

function csvCell(value: string | number | boolean) {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsv(url: URL) {
  const filters = parseFilters(Object.fromEntries(url.searchParams.entries()));
  const rows = select(filters).map(toPublic);
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
