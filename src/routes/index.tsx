import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { DonationBrowser } from "@/components/donation-browser";
import { POINT_BOARD, KICK_GIFTS } from "@/lib/chat-board";
import { EMPTY_SEARCH, ladderOf, paramSearch, parseListSearch, toFilters, type ListSearch } from "@/lib/archive";
import { getArchivePage, getKick, getPodcast } from "@/lib/archive.functions";
import { formatArs, formatCount, formatPct, formatTimes, formatUsd } from "@/lib/format";
import type { KickChannel } from "@/lib/kick";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): ListSearch => parseListSearch(search),
  search: {
    middlewares: [stripSearchParams<ListSearch>(EMPTY_SEARCH)],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [page, podcast, kick] = await Promise.all([
      getArchivePage({ data: toFilters(deps) }),
      getPodcast(),
      getKick(),
    ]);
    return { ...page, podcast, kick };
  },
  pendingComponent: HomePending,
  pendingMs: 180,
  component: Home,
});

function Home() {
  const { meta, result, filters, podcast, kick } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const mining = meta.mining;
  const cuts = filters.cuts;
  const habits = filters.habits;
  const limits = filters.limits;
  const keep = paramSearch(filters);
  const periods = meta.periods.filter((point) => point.count >= limits.periodMin);
  const peakPeriod = Math.max(...periods.map((point) => point.count), 1);

  function tune(patch: Partial<ListSearch>) {
    const next = { ...search, ...patch };
    const changed = (Object.keys(patch) as (keyof ListSearch)[]).some((key) => next[key] !== search[key]);
    if (!changed) return;
    navigate({ to: "/", search: next });
  }

  function commitShare(which: "p1" | "p2", raw: string) {
    const n = rounded(raw);
    if (n === null) return;
    let p1 = which === "p1" ? n : (search.p1 ?? cuts.lowShare);
    let p2 = which === "p2" ? n : (search.p2 ?? cuts.highShare);
    p1 = clamp(p1, 1, 98);
    p2 = clamp(p2, 2, 99);
    if (p1 >= p2) {
      if (which === "p1") p2 = Math.min(99, p1 + 1);
      else p1 = Math.max(1, p2 - 1);
    }
    tune({ p1, p2 });
  }

  function commitMoney(which: "bajo" | "alto", raw: string) {
    const n = rounded(raw);
    if (n === null || n <= 0) return;
    const value = clamp(n, 1, 1_000_000_000);
    let bajo = which === "bajo" ? value : (search.bajo ?? cuts.smallArs);
    let alto = which === "alto" ? value : (search.alto ?? cuts.largeArs);
    if (alto <= bajo) {
      if (which === "alto") bajo = Math.max(1, alto - 1);
      else alto = Math.min(1_000_000_000, bajo + 1);
    }
    tune({ bajo, alto });
  }

  function commitLimit(key: "top" | "vids" | "filas" | "coins" | "kicks" | "regalo" | "piso", raw: string, min: number, max: number) {
    const n = rounded(raw);
    if (n === null) return;
    tune({ [key]: clamp(n, min, max) });
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-4 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-widest text-primary uppercase">Ceneka</p>
          <h1 className="truncate text-base leading-tight tracking-tight sm:text-lg">Los Herederos de Alberdi</h1>
        </div>
        <dl className="ml-auto flex shrink-0 gap-4">
          <Stat label="Aportes" value={formatCount(meta.count)} />
          <Stat label="Donantes" value={formatCount(meta.donorCount)} />
        </dl>
        <LivePill kick={kick} />
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-2 p-2 lg:grid-cols-4 lg:grid-rows-2">
        <Panel title="Concentración" hint="Enter aplica el corte.">
          <ul>
            <Tune
              label={`${cuts.lowShare} por ciento del monto`}
              text="% del monto"
              value={String(cuts.lowShare)}
              normalize={intKey}
              onCommit={(raw) => commitShare("p1", raw)}
              valueText={formatCount(mining.halfUsdDonors)}
              note="personas"
            />
            <Tune
              label={`${cuts.highShare} por ciento del monto`}
              text="% del monto"
              value={String(cuts.highShare)}
              normalize={intKey}
              onCommit={(raw) => commitShare("p2", raw)}
              valueText={formatCount(mining.eightyUsdDonors)}
              note="personas"
            />
            <li className="border-b border-border/70 py-1">
              <div className="flex items-center justify-between gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
                  <span className="shrink-0">Montos</span>
                  <Cut
                    value={cuts.ladder.join(", ")}
                    label="Montos exactos en pesos"
                    width="min-w-0 flex-1"
                    normalize={(raw) => ladderOf(raw).join(",")}
                    onCommit={(raw) => tune({ montos: ladderOf(raw).join(",") })}
                  />
                </label>
                <Result value={formatPct(mining.ladderShare)} note="de los aportes" />
              </div>
            </li>
            <Tune
              label="Hasta este monto"
              before="Hasta $"
              value={String(cuts.smallArs)}
              normalize={intKey}
              width="w-16"
              onCommit={(raw) => commitMoney("bajo", raw)}
              valueText={formatPct(mining.smallCountShare)}
              note={`${formatPct(mining.smallUsdShare)} del monto`}
            />
            <Tune
              label="Desde este monto"
              before="Desde $"
              value={String(cuts.largeArs)}
              normalize={intKey}
              width="w-16"
              onCommit={(raw) => commitMoney("alto", raw)}
              valueText={formatPct(mining.largeCountShare)}
              note={`${formatPct(mining.largeUsdShare)} del monto`}
            />
            <Tune
              label="Mínimo de aportes para contar como recurrente"
              before="Recurrentes"
              text="o más"
              value={String(cuts.loyalMin)}
              normalize={intKey}
              onCommit={(raw) => {
                const n = rounded(raw);
                if (n !== null) tune({ veces: clamp(n, 2, 500) });
              }}
              valueText={formatPct(mining.loyalDonorShare)}
              note={`${formatPct(mining.loyalUsdShare)} del monto`}
            />
            <Metric label="Mediana" value={formatArs(mining.medianArs)} note={`moda ${formatArs(mining.modeArs)}`} />
            <Metric label="Tipo de cambio modal" value={formatArs(mining.fxMode)} note={`${formatPct(mining.fxModeShare)} de las filas`} />
          </ul>
        </Panel>
        <Panel
          title="Conducta"
          hint="Un texto puede ser varias cosas. El ? de un link no cuenta como pregunta."
        >
          <ol className="space-y-1.5">
            {meta.conducta.rows.map((row) => (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="shrink-0 tabular-nums">{formatTimes(row.lift)}</span>
                </div>
                <p className="text-[10px] leading-4 text-muted-foreground">
                  {formatPct(row.share)} de los textos · promedio {formatArs(row.avgArs)}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Cut
                value={String(habits.minTexts)}
                label="Mínimo de textos para contar el hábito"
                normalize={intKey}
                onCommit={(raw) => {
                  const n = rounded(raw);
                  if (n !== null) tune({ textos: clamp(n, 2, 500) });
                }}
              />
              textos
            </span>
            <span className="inline-flex items-center gap-1">
              <Cut
                value={String(habits.habitShare)}
                label="Parte del texto que cuenta como hábito"
                normalize={intKey}
                onCommit={(raw) => {
                  const n = rounded(raw);
                  if (n !== null) tune({ habito: clamp(n, 5, 95) });
                }}
              />
              % hábito
            </span>
            <span className="inline-flex items-center gap-1">
              <Cut
                value={String(habits.politicsShare)}
                label="Parte del texto que cuenta como política"
                normalize={intKey}
                onCommit={(raw) => {
                  const n = rounded(raw);
                  if (n !== null) tune({ poli: clamp(n, 5, 95) });
                }}
              />
              % política
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
            De {formatCount(meta.conducta.habituales)} con al menos {formatCount(habits.minTexts)} textos,{" "}
            {formatCount(meta.conducta.deClip)} traen un link en el {habits.habitShare}% o más y{" "}
            {formatCount(meta.conducta.deShow)} le hablan al programa. {formatCount(meta.conducta.mixtos)} no llegan a
            ese corte. La política llega al {habits.politicsShare}% en {formatCount(meta.conducta.dePolitica)}.
          </p>
        </Panel>
        <Panel title="Período" hint="Enter aplica el mínimo.">
          <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>Desde</span>
            <Cut
              value={String(limits.periodMin)}
              label="Mínimo de aportes para mostrar el período"
              normalize={intKey}
              onCommit={(raw) => commitLimit("piso", raw, 1, 100000)}
            />
            <span>aportes</span>
          </div>
          <ul className="space-y-1">
            {periods.map((point) => (
              <li key={point.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground">{point.label}</span>
                <span className="tabular-nums">{formatCount(point.count)}</span>
                <span className="col-span-2 h-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (point.count / peakPeriod) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Ranking por monto" hint="Nombres unificados. El regalo de Kick suma dólares aparte de Ceneka.">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Cut
                value={String(limits.rank)}
                label="Cuántos del ranking"
                normalize={intKey}
                onCommit={(raw) => commitLimit("top", raw, 1, 40)}
              />
              primeros
            </span>
            <span className="inline-flex items-center gap-1">
              <Cut
                value={String(limits.giftUsd)}
                label="Dólares por regalo de Kick"
                normalize={intKey}
                onCommit={(raw) => commitLimit("regalo", raw, 1, 100)}
              />
              US$ por regalo
            </span>
          </div>
          <ol className="space-y-1">
            {meta.topByUsd.map((row, index) => (
              <li key={row.nombre}>
                <Link
                  to="/donante/$nombre"
                  params={{ nombre: row.nombre }}
                  search={keep}
                  className="flex items-baseline justify-between gap-2 text-sm hover:text-primary"
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-1.5 text-[10px] text-muted-foreground tabular-nums">{index + 1}</span>
                    {row.nombre}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {formatUsd(row.usd)}
                    {row.giftUsd ? (
                      <span className="text-[10px] text-muted-foreground"> +{formatUsd(row.giftUsd)}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="YouTube" hint="US$ asociado: suma de los aportes que incluyeron el video.">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] leading-4 text-muted-foreground">
            <p>
              {formatCount(meta.youtubeLinks)} de {formatCount(meta.linkTotal)} enlaces · {formatCount(meta.youtubeOnce)}{" "}
              de {formatCount(meta.youtubeUnique)} una sola vez
            </p>
            <span className="inline-flex shrink-0 items-center gap-1">
              <Cut
                value={String(limits.videos)}
                label="Cuántos videos"
                normalize={intKey}
                onCommit={(raw) => commitLimit("vids", raw, 1, 40)}
              />
              videos
            </span>
          </div>
          <ol className="space-y-1">
            {meta.videos.map((video) => (
              <li key={video.id}>
                <a
                  href={video.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-baseline justify-between gap-2 text-xs hover:text-primary"
                >
                  <span className="min-w-0 truncate">
                    {video.title || video.id}
                    {video.author ? <span className="text-muted-foreground"> · {video.author}</span> : null}
                  </span>
                  <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                    <span className="block">{formatCount(video.count)}</span>
                    <span className="block text-[10px]">{formatUsd(video.usd)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Otras cuentas">
          <div className="flex h-full min-h-0 flex-col gap-2">
            {podcast[0] ? (
              <a href={podcast[0].href} target="_blank" rel="noreferrer" className="truncate text-xs text-primary">
                YouTube · {podcast[0].title}
              </a>
            ) : null}
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              <MiniRank
                title="Palancoins"
                count={limits.coins}
                onCount={(raw) => commitLimit("coins", raw, 1, 20)}
                rows={POINT_BOARD.slice(0, limits.coins).map((row) => ({ name: row.name, value: formatCount(row.points), href: row.archiveName }))}
                search={keep}
              />
              <KickGiftRank search={keep} limit={limits.gifts} each={limits.giftUsd} onCount={(raw) => commitLimit("kicks", raw, 1, 20)} />
            </div>
          </div>
        </Panel>
        <Panel title="Archivo" className="col-span-2" scroll={false}>
          <DonationBrowser filters={filters} result={result} mode="home" dense />
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-border pl-4 text-right">
      <dt className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</dt>
      <dd className="font-heading text-lg leading-none tabular-nums">{value}</dd>
    </div>
  );
}

function LivePill({ kick }: { kick: KickChannel }) {
  return (
    <a href={kick.href} target="_blank" rel="noreferrer" className="flex max-w-36 shrink-0 items-center gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kick.live ? "bg-destructive" : "bg-muted-foreground/40"}`} />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-primary">{kick.live ? "En vivo" : "Kick"}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{kick.live ? kick.title : "kick.com"}</span>
      </span>
    </a>
  );
}

function Panel({
  title,
  hint,
  children,
  className = "",
  scroll = true,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  scroll?: boolean;
}) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 ${className}`}>
      <h2 className="shrink-0 border-b border-border/80 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{title}</h2>
      {hint ? <p className="shrink-0 px-2.5 text-[10px] leading-4 text-muted-foreground">{hint}</p> : null}
      <div className={`min-h-0 flex-1 px-2.5 pt-1.5 pb-2 ${scroll ? "overflow-auto" : "overflow-hidden"}`}>{children}</div>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-border/70 py-1 last:border-0">
      <p className="min-w-0 truncate text-xs text-muted-foreground">{label}</p>
      <Result value={value} note={note} />
    </li>
  );
}

function Tune({
  label,
  before,
  text,
  value,
  note,
  valueText,
  width,
  normalize,
  onCommit,
}: {
  label: string;
  before?: string;
  text?: string;
  value: string;
  note: string;
  valueText: string;
  width?: string;
  normalize?: (raw: string) => string;
  onCommit: (raw: string) => void;
}) {
  return (
    <li className="border-b border-border/70 py-1 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {before ? <span className="shrink-0">{before}</span> : null}
          <Cut value={value} label={label} width={width} normalize={normalize} onCommit={onCommit} />
          {text ? <span className="truncate">{text}</span> : null}
        </label>
        <Result value={valueText} note={note} />
      </div>
    </li>
  );
}

function Result({ value, note }: { value: string; note: string }) {
  return (
    <p className="shrink-0 text-right">
      <span className="font-heading text-sm tabular-nums">{value}</span>
      <span className="ml-1.5 text-[10px] text-muted-foreground">{note}</span>
    </p>
  );
}

function Cut({
  value,
  label,
  width = "w-12",
  normalize,
  onCommit,
}: {
  value: string;
  label: string;
  width?: string;
  normalize?: (raw: string) => string;
  onCommit: (raw: string) => void;
}) {
  function commit(raw: string, input: HTMLInputElement) {
    const current = normalize ? normalize(value) : value.trim();
    const next = normalize ? normalize(raw) : raw.trim();
    if (!next || next === current) {
      input.value = value;
      return;
    }
    onCommit(raw);
  }

  return (
    <input
      aria-label={label}
      key={value}
      defaultValue={value}
      inputMode="numeric"
      onBlur={(event) => commit(event.currentTarget.value, event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        commit(event.currentTarget.value, event.currentTarget);
      }}
      className={`${width} h-7 rounded-md border border-input bg-background px-1 text-right text-xs tabular-nums outline-none focus-visible:border-ring`}
    />
  );
}

function rounded(raw: string) {
  const n = Number(raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace("%", ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function intKey(raw: string) {
  const n = rounded(raw);
  return n === null ? "" : String(n);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function KickGiftRank({
  search,
  limit,
  each,
  onCount,
}: {
  search: ListSearch;
  limit: number;
  each: number;
  onCount: (raw: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1 text-[10px] tracking-wide text-muted-foreground uppercase">
        <Cut value={String(limit)} label="Cuántos regalos de Kick" normalize={intKey} onCommit={onCount} />
        Regalos
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_1.25rem_auto] gap-x-1 text-[10px] text-muted-foreground">
        <span>Usuario</span>
        <span className="text-right">N</span>
        <span className="text-right">US$</span>
      </div>
      <ol className="mt-0.5 space-y-0.5">
        {KICK_GIFTS.slice(0, limit).map((row) => {
          const dollars = formatUsd(row.gifts * each);
          const name = row.archiveName ? (
            <Link to="/donante/$nombre" params={{ nombre: row.archiveName }} search={search} className="truncate hover:text-primary">
              {row.name}
            </Link>
          ) : (
            <span className="truncate">{row.name}</span>
          );
          return (
            <li key={row.name} className="grid grid-cols-[minmax(0,1fr)_1.25rem_auto] items-baseline gap-x-1 text-xs">
              {name}
              <span className="text-right tabular-nums">{formatCount(row.gifts)}</span>
              <span className="text-right tabular-nums">{dollars}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MiniRank({
  title,
  rows,
  search,
  count,
  onCount,
}: {
  title: string;
  rows: { name: string; value: string; href: string | null }[];
  search: ListSearch;
  count: number;
  onCount: (raw: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1 text-[10px] tracking-wide text-muted-foreground uppercase">
        <Cut value={String(count)} label={`Cuántos de ${title}`} normalize={intKey} onCommit={onCount} />
        {title}
      </p>
      <ol className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.name} className="flex items-baseline justify-between gap-1 text-xs">
            {row.href ? (
              <Link to="/donante/$nombre" params={{ nombre: row.href }} search={search} className="truncate hover:text-primary">
                {row.name}
              </Link>
            ) : (
              <span className="truncate">{row.name}</span>
            )}
            <span className="shrink-0 tabular-nums text-muted-foreground">{row.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HomePending() {
  return <main className="h-dvh animate-pulse bg-muted/40" />;
}
