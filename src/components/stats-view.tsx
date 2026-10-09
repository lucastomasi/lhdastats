import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { MessageText } from "@/components/message-text";
import { Badge, buttonClass, Card, fieldClass } from "@/components/ui";
import {
  scopeActive,
  scopeToSearch,
  type DonorLine,
  type DrillKind,
  type DrillResult,
  type ListSearch,
  type MonthOption,
  type RankRow,
  type StatsReport,
  type StatsScope,
  type WordTerm,
} from "@/lib/archive";
import { getDrill } from "@/lib/archive.functions";
import { formatArs, formatCount, formatPct, formatUsd, formatWhen } from "@/lib/format";
import { domainLabel } from "@/lib/links";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type Cur = StatsScope["cur"];

function moneyFor(cur: Cur) {
  return cur === "usd" ? formatUsd : formatArs;
}

function pick(cur: Cur, row: { ars: number; usd: number }) {
  return cur === "usd" ? row.usd : row.ars;
}

function other(cur: Cur, row: { ars: number; usd: number }) {
  return cur === "usd" ? formatArs(row.ars) : formatUsd(row.usd);
}

function scopeLabel(stats: StatsReport) {
  if (!stats.range) return "todo el archivo";
  return stats.range.from === stats.range.to ? stats.range.from : `${stats.range.from} → ${stats.range.to}`;
}

const SCOPE_KEYS = ["sw", "sfrom", "sto", "scur"] as const;

function withoutScope(search: ListSearch): ListSearch {
  const next: ListSearch = { ...search };
  for (const key of SCOPE_KEYS) delete next[key];
  return next;
}

/* ------------------------------------------------------------------ */
/* Disclosure primitive: native details/summary, lazy body             */
/* ------------------------------------------------------------------ */

export function Fold({
  summary,
  children,
  className = "",
  summaryClassName = "",
  bodyClassName = "",
}: {
  summary: ReactNode;
  children: ReactNode | (() => ReactNode);
  className?: string;
  summaryClassName?: string;
  bodyClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={`fold group ${className}`}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className={`flex items-start gap-3 ${summaryClassName}`}>
        <span className="min-w-0 flex-1">{summary}</span>
        <span className="chev mt-0.5 shrink-0 text-primary" aria-hidden>
          ›
        </span>
      </summary>
      {open ? <div className={bodyClassName}>{typeof children === "function" ? children() : children}</div> : null}
    </details>
  );
}

function SectionHead({ id, kicker, title, text }: { id?: string; kicker: string; title: string; text: ReactNode }) {
  return (
    <div id={id} className="max-w-2xl scroll-mt-24 space-y-2">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">{kicker}</p>
      <h2 className="text-3xl tracking-tight">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function Bar({ value, peak }: { value: number; peak: number }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-muted">
      <span
        className="block h-full rounded-full bg-primary"
        style={{ width: `${Math.max(3, peak > 0 ? (value / peak) * 100 : 0)}%` }}
      />
    </span>
  );
}

export function DonorLines({ rows, cur, empty = "Nadie en este recorte." }: { rows: DonorLine[]; cur: Cur; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const money = moneyFor(cur);
  return (
    <ol className="divide-y divide-border/70 overflow-hidden rounded-xl bg-background/60 ring-1 ring-foreground/5">
      {rows.map((row, index) => (
        <li key={row.nombre} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm">
          <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
          <Link to="/donante/$nombre" params={{ nombre: row.nombre }} className="truncate font-medium hover:text-primary">
            {row.nombre}
          </Link>
          <span className="text-right tabular-nums">
            {money(pick(cur, row))}
            <span className="block text-xs text-muted-foreground">{formatCount(row.count)} aportes</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Drill-down: the actual donations behind a number                    */
/* ------------------------------------------------------------------ */

export function DrillPanel({
  kind,
  drillKey,
  scope,
  showTop = true,
  intro,
}: {
  kind: DrillKind;
  drillKey: string;
  scope: StatsScope;
  showTop?: boolean;
  intro?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"reciente" | "mayor">("reciente");
  const [data, setData] = useState<DrillResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const scopeKey = `${scope.when}|${scope.from}|${scope.to}|${scope.cur}`;

  useEffect(() => {
    setPage(1);
  }, [kind, drillKey, scopeKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    getDrill({ data: { kind, key: drillKey, page, sort, scope } })
      .then((result) => {
        if (!alive) return;
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // scope is captured through scopeKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, drillKey, page, sort, scopeKey]);

  const money = moneyFor(scope.cur);

  if (error) {
    return <p className="text-sm text-destructive">No se pudieron traer los aportes. Probá de nuevo.</p>;
  }
  if (!data) {
    return (
      <div className="space-y-2" aria-busy="true">
        <p className="text-xs text-muted-foreground">Cargando aportes…</p>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
      {intro}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium">{formatCount(data.total)} aportes</span>
          <span className="text-muted-foreground">
            {" "}
            · {formatArs(data.ars)} · {formatUsd(data.usd)}
          </span>
        </p>
        <div className="flex items-center gap-1 text-xs" role="group" aria-label="Orden">
          {(["reciente", "mayor"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => {
                setSort(value);
                setPage(1);
              }}
              className={`rounded-full px-2.5 py-1 font-medium ${sort === value ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              {value === "reciente" ? "Recientes" : "Mayor monto"}
            </button>
          ))}
        </div>
      </div>

      {showTop && data.top.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Quiénes más aportaron acá</p>
          <ul className="flex flex-wrap gap-1.5">
            {data.top.map((row) => (
              <li key={row.nombre}>
                <Link
                  to="/donante/$nombre"
                  params={{ nombre: row.nombre }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/70"
                >
                  <span className="max-w-[10rem] truncate">{row.nombre}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(pick(scope.cur, row))} · {formatCount(row.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún aporte en este recorte.</p>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl bg-background/60 ring-1 ring-foreground/5">
          {data.rows.map((row) => (
            <li key={row.id} className="space-y-1 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/donante/$nombre"
                    params={{ nombre: row.nombre }}
                    className="font-medium break-words hover:text-primary"
                  >
                    {row.nombre}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(row.fecha_aprox)} · {row.fecha_relativa}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-medium tabular-nums">
                  {money(pick(scope.cur, { ars: row.monto_ars, usd: row.monto_usd }))}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {other(scope.cur, { ars: row.monto_ars, usd: row.monto_usd })}
                  </span>
                </p>
              </div>
              <div className="text-sm leading-6">
                {row.privado ? <Badge tone="outline">Mensaje privado</Badge> : <MessageText text={row.mensaje} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {data.pages > 1 ? (
          <nav className="flex items-center gap-1" aria-label="Páginas de este desplegable">
            <button
              type="button"
              className={buttonClass("ghost", "h-8 px-2 text-xs")}
              disabled={data.page <= 1}
              onClick={() => setPage(Math.max(1, data.page - 1))}
            >
              ← Anterior
            </button>
            <span className="px-1 text-xs tabular-nums text-muted-foreground">
              {formatCount(data.page)} / {formatCount(data.pages)}
            </span>
            <button
              type="button"
              className={buttonClass("ghost", "h-8 px-2 text-xs")}
              disabled={data.page >= data.pages}
              onClick={() => setPage(Math.min(data.pages, data.page + 1))}
            >
              Siguiente →
            </button>
          </nav>
        ) : (
          <span />
        )}
        {data.total > 0 ? (
          <Link
            to="/"
            search={data.search}
            hash="archivo"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Ver los {formatCount(data.total)} en el buscador →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Global scope bar                                                    */
/* ------------------------------------------------------------------ */

const SCOPE_PRESETS = [
  { key: "", label: "Todo" },
  { key: "ultimo", label: "Último día" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "ayer", label: "Ayer" },
  { key: "hoy", label: "Hoy" },
];

export function ScopeBar({
  stats,
  months,
  search,
}: {
  stats: StatsReport;
  months: MonthOption[];
  search: ListSearch;
}) {
  const navigate = useNavigate();
  const scope = stats.scope;
  const formId = useId();

  function apply(next: StatsScope) {
    navigate({ to: "/", search: { ...withoutScope(search), ...scopeToSearch(next) }, resetScroll: false });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = String(data.get("sfrom") ?? "");
    const to = String(data.get("sto") ?? "");
    apply({ ...scope, when: from || to ? "" : scope.when, from, to });
  }

  const isPreset = (key: string) => scope.when === key && !scope.from && !scope.to;

  return (
    <div className="sticky top-0 z-30 border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-6xl">
        <details className="fold">
          <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">Estadísticas de</span>
            <span className="text-sm font-medium">{scopeLabel(stats)}</span>
            <span className="text-sm text-muted-foreground">en {scope.cur === "usd" ? "dólares" : "pesos"}</span>
            <span className="text-xs text-muted-foreground">
              · {formatCount(stats.summary.count)} aportes · {formatCount(stats.summary.donors)} personas
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
              Cambiar <span className="chev" aria-hidden>›</span>
            </span>
          </summary>
          <form id={formId} onSubmit={onSubmit} className="space-y-3 pt-2 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {SCOPE_PRESETS.map((preset) => (
                <button
                  key={preset.key || "todo"}
                  type="button"
                  aria-pressed={isPreset(preset.key)}
                  onClick={() => apply({ ...scope, when: preset.key, from: "", to: "" })}
                  className={chipClass(isPreset(preset.key))}
                >
                  {preset.label}
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-border" aria-hidden />
              <div className="inline-flex rounded-full bg-muted p-0.5" role="group" aria-label="Moneda">
                {(["ars", "usd"] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    aria-pressed={scope.cur === cur}
                    onClick={() => apply({ ...scope, cur })}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${scope.cur === cur ? "bg-primary text-primary-foreground" : "hover:bg-background"}`}
                  >
                    {cur === "ars" ? "Pesos" : "US$"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Mes
                <select
                  value={/^\d{4}-\d{2}$/.test(scope.when) ? scope.when : ""}
                  onChange={(event) => apply({ ...scope, when: event.target.value, from: "", to: "" })}
                  className={fieldClass}
                >
                  <option value="">Elegí un mes</option>
                  {months.map((month) => (
                    <option key={month.key} value={month.key}>
                      {month.label} ({formatCount(month.count)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Desde
                <input type="date" name="sfrom" defaultValue={scope.from} key={`f-${scope.from}`} className={fieldClass} />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Hasta
                <input type="date" name="sto" defaultValue={scope.to} key={`t-${scope.to}`} className={fieldClass} />
              </label>
              <div className="flex gap-2">
                <button type="submit" className={buttonClass("primary")}>
                  Aplicar
                </button>
                {scopeActive(scope) || scope.cur !== "ars" ? (
                  <button
                    type="button"
                    className={buttonClass("outline")}
                    onClick={() => apply({ when: "", from: "", to: "", cur: "ars" })}
                  >
                    Todo
                  </button>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Afecta a todas las estadísticas de la página (resumen, concentración, conducta, períodos, ranking, palabras,
              links). El buscador de abajo tiene su propio filtro. Fechas estimadas, hora argentina.
            </p>
          </form>
        </details>
      </div>
    </div>
  );
}

function chipClass(on: boolean) {
  return [
    "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium",
    on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80",
  ].join(" ");
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export function ScopedSummary({ stats }: { stats: StatsReport }) {
  const s = stats.summary;
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryStat
        label="Donaciones"
        value={formatCount(s.count)}
        detail={`${formatCount(s.publicCount)} con mensaje público · ${formatCount(s.refundedCount)} devueltas aparte`}
      />
      <SummaryStat
        label="En pesos"
        value={formatArs(s.ars)}
        detail={s.refundedCount ? `Sin ${formatArs(s.refundedArs)} devueltos` : "Sin devoluciones en el recorte"}
      />
      <SummaryStat
        label="Equivalente en dólares"
        value={formatUsd(s.usd)}
        detail={s.refundedCount ? `Sin ${formatUsd(s.refundedUsd)} devueltos` : "Campo interno de Ceneka"}
      />
      <SummaryStat
        label="Donantes"
        value={formatCount(s.donors)}
        detail={`${formatCount(s.privateCount)} aportes con mensaje privado`}
      />
    </section>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <div className="space-y-2 px-5 py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl leading-none tracking-tight tabular-nums sm:text-3xl">{value}</p>
        <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Hallazgos                                                           */
/* ------------------------------------------------------------------ */

export function FindingsSection({ stats }: { stats: StatsReport }) {
  const f = stats.findings;
  const cur = stats.scope.cur;
  const money = moneyFor(cur);
  const peak = Math.max(...f.pareto.map((step) => step.share), 0.01);
  return (
    <section className="space-y-4">
      <SectionHead
        id="hallazgos"
        kicker="Minería"
        title="Qué se lee en los datos"
        text={`Nombres unificados, montos sin las devoluciones. Recorte: ${scopeLabel(stats)}. Cada tarjeta se abre y muestra de quién o de qué está hecha.`}
      />
      <div className="grid items-start gap-3 md:grid-cols-2">
        <FindingFold
          kicker="Concentración"
          value={formatPct(f.topPercentShare)}
          text={`El 1% de los donantes —${formatCount(f.topPercentCount)} personas— concentra eso del monto. Los 10 primeros llegan a ${formatPct(f.top10Share)}.`}
        >
          <DonorLines rows={f.pareto[0]?.list ?? []} cur={cur} />
        </FindingFold>
        <FindingFold
          kicker="Cola larga"
          value={money(f.median)}
          text={`Esa es la mediana. El promedio sube a ${money(f.mean)}. El monto que más se repite es ${money(f.mode)} (${formatCount(f.modeCount)} veces).`}
        >
          <AmountFolds rows={f.modes} cur={cur} scope={stats.scope} />
        </FindingFold>
        <FindingFold
          kicker="Vuelven"
          value={formatPct(f.repeatDonorShare)}
          text={`${formatCount(f.repeatDonors)} donantes aportaron más de una vez y explican ${formatPct(f.repeatDonationShare)} de las donaciones.`}
        >
          <p className="mb-2 text-xs text-muted-foreground">Los 20 que más veces aportaron en el recorte.</p>
          <DonorLines rows={f.repeatTop} cur={cur} />
        </FindingFold>
        <FindingFold
          kicker="La misma persona"
          value={formatCount(stats.summary.donors)}
          text={`${formatCount(f.rawNames)} grafías se pliegan en ese total: mayúsculas y acentos no parten a nadie.`}
        >
          {f.aliasTop.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie usó más de una grafía en este recorte.</p>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl bg-background/60 ring-1 ring-foreground/5">
              {f.aliasTop.map((row) => (
                <li key={row.nombre} className="px-3 py-2 text-sm">
                  <Link to="/donante/$nombre" params={{ nombre: row.nombre }} className="font-medium hover:text-primary">
                    {row.nombre}
                  </Link>
                  <span className="block text-xs break-words text-muted-foreground">{row.aliases.join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </FindingFold>
      </div>
      <Card>
        <header className="space-y-1 px-5 pt-5">
          <h3 className="text-xl tracking-tight">Cuánto aporta cada franja</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Donantes ordenados de mayor a menor aporte en {cur === "usd" ? "dólares" : "pesos"}. Abrí una franja para
            ver quiénes son.
          </p>
        </header>
        <div className="divide-y divide-border/70 px-5 py-3">
          {f.pareto.map((step) => (
            <Fold
              key={step.label}
              summaryClassName="py-3"
              bodyClassName="pb-4"
              summary={
                <span className="block space-y-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {step.label} · {formatCount(step.donors)} donantes
                    </span>
                    <span className="font-medium tabular-nums">{formatPct(step.share)}</span>
                  </span>
                  <Bar value={step.share} peak={peak} />
                </span>
              }
            >
              <DonorLines rows={step.list} cur={cur} />
              {step.donors > step.list.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Se muestran los primeros {formatCount(step.list.length)} de {formatCount(step.donors)}. La lista
                  completa está en Concentración.
                </p>
              ) : null}
            </Fold>
          ))}
        </div>
      </Card>
    </section>
  );
}

function FindingFold({
  kicker,
  value,
  text,
  children,
}: {
  kicker: string;
  value: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <Fold
      className="rounded-2xl bg-card ring-1 ring-foreground/10 open:ring-primary/30"
      summaryClassName="px-5 py-5"
      bodyClassName="border-t border-border/70 px-5 py-4"
      summary={
        <span className="block space-y-2">
          <span className="block text-xs font-semibold tracking-widest text-primary uppercase">{kicker}</span>
          <span className="block font-heading text-3xl tracking-tight tabular-nums">{value}</span>
          <span className="block text-sm leading-6 text-muted-foreground">{text}</span>
        </span>
      }
    >
      {children}
    </Fold>
  );
}

export function AmountFolds({
  rows,
  cur,
  scope,
}: {
  rows: { amount: number; count: number; share: number }[];
  cur: Cur;
  scope: StatsScope;
}) {
  const money = moneyFor(cur);
  const peak = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="divide-y divide-border/70">
      {rows.map((row) => (
        <Fold
          key={row.amount}
          summaryClassName="py-2"
          bodyClassName="pb-3"
          summary={
            <span className="block space-y-1">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium tabular-nums">{money(row.amount)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatCount(row.count)} · {formatPct(row.share)}
                </span>
              </span>
              <Bar value={row.count} peak={peak} />
            </span>
          }
        >
          <DrillPanel kind="amount" drillKey={String(row.amount)} scope={scope} />
        </Fold>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conducta                                                            */
/* ------------------------------------------------------------------ */

export function ConductSection({ stats }: { stats: StatsReport }) {
  const cur = stats.scope.cur;
  const money = moneyFor(cur);
  const peak = Math.max(...stats.conduct.map((row) => row.textShare), 0.01);
  return (
    <section className="space-y-4">
      <SectionHead
        id="conducta"
        kicker="Conducta"
        title="Qué hace la audiencia cuando escribe"
        text="Cada mensaje público entra en una sola categoría. Abrí una para leer los mensajes reales que la forman, con quién los mandó, cuándo y cuánto."
      />
      <Card>
        <div className="hidden grid-cols-[minmax(0,1fr)_5rem_5rem_7rem_1rem] gap-3 border-b border-border px-5 py-3 text-xs tracking-wide text-muted-foreground uppercase sm:grid">
          <span>Conducta</span>
          <span className="text-right">Textos</span>
          <span className="text-right">Del monto</span>
          <span className="text-right">Promedio</span>
          <span />
        </div>
        <div className="divide-y divide-border/70">
          {stats.conduct.map((row) => (
            <Fold
              key={row.key}
              summaryClassName="px-5 py-3 hover:bg-muted/40"
              bodyClassName="space-y-4 bg-muted/20 px-5 py-4"
              summary={
                <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_5rem_5rem_7rem]">
                  <span className="min-w-0">
                    <span className="block font-medium">{row.label}</span>
                    <span className="mt-1 block max-w-xs">
                      <Bar value={row.textShare} peak={peak} />
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {formatPct(row.textShare)}
                    <span className="block text-xs text-muted-foreground sm:hidden">
                      {formatCount(row.texts)} textos · {formatPct(row.amountShare)} del monto
                    </span>
                  </span>
                  <span className="hidden text-right text-sm tabular-nums sm:block">{formatPct(row.amountShare)}</span>
                  <span className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                    {money(cur === "usd" ? row.meanUsd : row.meanArs)}
                  </span>
                </span>
              }
            >
              <p className="text-sm text-muted-foreground">
                {formatCount(row.texts)} mensajes · {formatPct(row.amountShare)} del monto · promedio{" "}
                {money(cur === "usd" ? row.meanUsd : row.meanArs)}
              </p>
              <DrillPanel kind="conduct" drillKey={row.key} scope={stats.scope} />
            </Fold>
          ))}
        </div>
        <p className="border-t border-border/70 px-5 py-4 text-sm leading-6 text-muted-foreground">
          De {formatCount(stats.habits.regularWriters)} personas que escriben seguido en el recorte,{" "}
          {formatCount(stats.habits.clipHabitDonors)} se dedican a mandar links y{" "}
          {formatCount(stats.habits.storyHabitDonors)} a contar.
        </p>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Menciones                                                           */
/* ------------------------------------------------------------------ */

export function MentionsSection({ stats }: { stats: StatsReport }) {
  const m = stats.mentions;
  return (
    <section className="space-y-4">
      <SectionHead
        id="menciones"
        kicker="Menciones"
        title="A quién nombran"
        text="Nombres del archivo que aparecen en mensajes de otros. Abrí un nombre para leer esos mensajes."
      />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <MentionList title="Nombrado por otros" rows={m.named} unit="veces" kind="mention" scope={stats.scope} />
        <MentionList title="Nombrado con risa" rows={m.namedLaugh} unit="veces" kind="mention" scope={stats.scope} />
        <MentionList
          title="Texto propio con risa"
          rows={m.ownLaugh.map((row) => ({ ...row, label: formatPct(row.share) }))}
          unit=""
          kind="donor"
          scope={stats.scope}
        />
      </div>
    </section>
  );
}

function MentionList({
  title,
  rows,
  unit,
  kind,
  scope,
}: {
  title: string;
  rows: { key: string; nombre: string; count: number; label?: string }[];
  unit: string;
  kind: DrillKind;
  scope: StatsScope;
}) {
  return (
    <Card>
      <header className="px-5 pt-5 pb-3">
        <h3 className="text-xl tracking-tight">{title}</h3>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Nadie en este recorte.</p>
      ) : (
        <ol className="divide-y divide-border/70 border-t border-border/70">
          {rows.map((row, index) => (
            <li key={row.key}>
              <Fold
                summaryClassName="px-5 py-3 hover:bg-muted/40"
                bodyClassName="space-y-3 bg-muted/20 px-5 py-4"
                summary={
                  <span className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    <span className="truncate font-medium">{row.nombre}</span>
                    <span className="text-sm font-medium tabular-nums">
                      {row.label ?? formatCount(row.count)}
                      {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
                    </span>
                  </span>
                }
              >
                <Link
                  to="/donante/$nombre"
                  params={{ nombre: row.nombre }}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ficha de {row.nombre} →
                </Link>
                <DrillPanel kind={kind} drillKey={kind === "mention" ? row.key : row.nombre} scope={scope} />
              </Fold>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Período                                                             */
/* ------------------------------------------------------------------ */

export function PeriodSection({ stats }: { stats: StatsReport }) {
  const cur = stats.scope.cur;
  const [allMonths, setAllMonths] = useState(false);
  const months = allMonths ? stats.months : stats.months.slice(0, 12);
  return (
    <section className="space-y-4">
      <SectionHead
        id="tiempo"
        kicker="Período"
        title="Cuándo llegaron"
        text="Por el texto que publicó Ceneka («Hace 3 meses») y por mes estimado. Cada tramo se abre con sus aportes y quiénes más pusieron."
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <header className="space-y-1 px-5 pt-5 pb-2">
            <h3 className="text-xl tracking-tight">Por tramo de Ceneka</h3>
            <p className="text-sm text-muted-foreground">No es una fecha exacta: es el texto relativo del listado.</p>
          </header>
          <PeriodList rows={stats.periods} cur={cur} kind="period" scope={stats.scope} />
        </Card>
        <Card>
          <header className="space-y-1 px-5 pt-5 pb-2">
            <h3 className="text-xl tracking-tight">Por mes estimado</h3>
            <p className="text-sm text-muted-foreground">Fecha aproximada: un mes son 30 días antes de la descarga.</p>
          </header>
          <PeriodList rows={months} cur={cur} kind="month" scope={stats.scope} />
          {stats.months.length > 12 ? (
            <div className="px-5 pb-4">
              <button type="button" className={buttonClass("ghost", "h-9 px-3")} onClick={() => setAllMonths((v) => !v)}>
                {allMonths ? "Ver menos meses" : `Ver los ${formatCount(stats.months.length)} meses`}
              </button>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}

function PeriodList({
  rows,
  cur,
  kind,
  scope,
}: {
  rows: StatsReport["periods"];
  cur: Cur;
  kind: DrillKind;
  scope: StatsScope;
}) {
  const money = moneyFor(cur);
  const peak = Math.max(...rows.map((row) => row.count), 1);
  if (rows.length === 0) return <p className="px-5 pb-5 text-sm text-muted-foreground">Sin aportes en este recorte.</p>;
  return (
    <div className="divide-y divide-border/70 px-5 pb-3">
      {rows.map((row) => (
        <Fold
          key={row.key}
          summaryClassName="py-3"
          bodyClassName="space-y-3 pb-4"
          summary={
            <span className="block space-y-1.5">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="capitalize text-muted-foreground">{row.label}</span>
                <span className="text-right">
                  <span className="font-medium tabular-nums">{formatCount(row.count)}</span>
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">{money(pick(cur, row))}</span>
                </span>
              </span>
              <Bar value={row.count} peak={peak} />
            </span>
          }
        >
          {row.from ? (
            <p className="text-xs text-muted-foreground">
              Fechas estimadas: {row.from === row.to ? row.from : `${row.from} → ${row.to}`}
            </p>
          ) : null}
          <DrillPanel kind={kind} drillKey={row.key} scope={scope} />
        </Fold>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

export function RankingSection({ stats }: { stats: StatsReport }) {
  const cur = stats.scope.cur;
  const money = moneyFor(cur);
  return (
    <section className="space-y-4">
      <SectionHead
        id="ranking"
        kicker="Ranking"
        title="Quién más aportó"
        text="Nombres unificados sin distinguir mayúsculas ni acentos, sin devoluciones. Abrí a cualquiera para ver sus aportes del recorte."
      />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <RankBoard
          title={`Por monto en ${cur === "usd" ? "dólares" : "pesos"}`}
          rows={stats.ranking.byAmount}
          scope={stats.scope}
          metric={(row) =>
            row.kickGiftUsd > 0 && cur === "usd" ? `${money(row.usd)} +${formatUsd(row.kickGiftUsd)}` : money(pick(cur, row))
          }
          extra={(row) => `${formatCount(row.count)} aportes · ${formatPct(row.share)} · ${other(cur, row)}`}
        />
        <RankBoard
          title="Por cantidad de aportes"
          rows={stats.ranking.byCount}
          scope={stats.scope}
          metric={(row) => formatCount(row.count)}
          extra={(row) => `${formatArs(row.ars)} · ${formatUsd(row.usd)}`}
        />
      </div>
    </section>
  );
}

function RankBoard({
  title,
  rows,
  scope,
  metric,
  extra,
}: {
  title: string;
  rows: RankRow[];
  scope: StatsScope;
  metric: (row: RankRow) => string;
  extra: (row: RankRow) => string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 15);
  return (
    <Card>
      <header className="px-5 pt-5 pb-3">
        <h3 className="text-xl tracking-tight">{title}</h3>
      </header>
      <ol className="divide-y divide-border/70 border-t border-border/70">
        {shown.map((row, index) => (
          <li key={row.nombre}>
            <Fold
              summaryClassName="px-5 py-3 hover:bg-muted/40"
              bodyClassName="space-y-3 bg-muted/20 px-5 py-4"
              summary={
                <span className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{row.nombre}</span>
                    {row.aliases.length > 1 ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.aliases.filter((name) => name !== row.nombre).join(" · ")}
                      </span>
                    ) : null}
                    <span className="block truncate text-xs text-muted-foreground">{extra(row)}</span>
                  </span>
                  <Badge>{metric(row)}</Badge>
                </span>
              }
            >
              <Link
                to="/donante/$nombre"
                params={{ nombre: row.nombre }}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Ficha completa de {row.nombre} →
              </Link>
              <DrillPanel kind="donor" drillKey={row.nombre} scope={scope} showTop={false} />
            </Fold>
          </li>
        ))}
      </ol>
      {rows.length > 15 ? (
        <div className="border-t border-border/70 px-5 py-3">
          <button type="button" className={buttonClass("ghost", "h-9 px-3")} onClick={() => setAll((v) => !v)}>
            {all ? "Ver menos" : `Ver los ${formatCount(rows.length)}`}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Lenguaje: nube de palabras                                          */
/* ------------------------------------------------------------------ */

function sizeFor(count: number, min: number, max: number) {
  if (max <= min) return 1.1;
  const t = (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return 0.85 + t * 1.85;
}

function scatter(words: WordTerm[]) {
  return [...words].sort((a, b) => {
    const ha = a.key.length + a.key.charCodeAt(0) + a.count;
    const hb = b.key.length + b.key.charCodeAt(0) + b.count;
    return (ha % 7) - (hb % 7) || b.count - a.count;
  });
}

export function WordsSection({ stats }: { stats: StatsReport }) {
  const [selected, setSelected] = useState<WordTerm | null>(null);
  const panelId = useId();
  const ranked = stats.words;
  useEffect(() => {
    setSelected(null);
  }, [stats.scope.when, stats.scope.from, stats.scope.to]);
  if (ranked.length === 0) {
    return (
      <section className="space-y-4">
        <SectionHead id="lenguaje" kicker="Lenguaje" title="Nube de palabras" text="No hay mensajes públicos en este recorte." />
      </section>
    );
  }
  const min = ranked[ranked.length - 1]?.count ?? 1;
  const max = ranked[0]?.count ?? 1;
  return (
    <section className="space-y-4">
      <SectionHead
        id="lenguaje"
        kicker="Lenguaje"
        title="Nube de palabras"
        text="Lo que más se repite en los mensajes. Mayúsculas y acentos cuentan juntas. Tocá una palabra para leer los mensajes que la usan."
      />
      <Card>
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-5 py-6 text-center">
          {scatter(ranked).map((word) => {
            const on = selected?.key === word.key;
            return (
              <li key={word.key}>
                <button
                  type="button"
                  aria-expanded={on}
                  aria-controls={panelId}
                  title={`${formatCount(word.count)} veces`}
                  onClick={() => setSelected(on ? null : word)}
                  className={`inline-block rounded-md px-1 font-heading leading-none transition-colors ${on ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:text-primary"}`}
                  style={{ fontSize: `${sizeFor(word.count, min, max)}rem` }}
                >
                  {word.label}
                </button>
              </li>
            );
          })}
        </ul>
        <div id={panelId} className="border-t border-border/70 px-5 py-4" aria-live="polite">
          {selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-xl tracking-tight">
                  «{selected.label}» <span className="text-sm text-muted-foreground">{formatCount(selected.count)} veces</span>
                </h3>
                <button type="button" className={buttonClass("ghost", "h-8 px-2 text-xs")} onClick={() => setSelected(null)}>
                  Cerrar
                </button>
              </div>
              <DrillPanel kind="word" drillKey={selected.label} scope={stats.scope} />
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Lo más repetido es «{ranked[0].label}»: {formatCount(ranked[0].count)} veces. El tamaño sigue esa frecuencia.
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* YouTube y enlaces                                                   */
/* ------------------------------------------------------------------ */

export function LinksSection({ stats }: { stats: StatsReport }) {
  const cur = stats.scope.cur;
  const money = moneyFor(cur);
  const yt = stats.youtube;
  const [allClips, setAllClips] = useState(false);
  const clips = allClips ? yt.clips : yt.clips.slice(0, 12);
  return (
    <section className="space-y-4">
      <SectionHead
        id="youtube"
        kicker="YouTube y enlaces"
        title="Qué links viajan en los aportes"
        text={`${formatCount(yt.links)} enlaces de YouTube · ${formatCount(yt.once)} de ${formatCount(yt.unique)} videos aparecen una sola vez. Abrí un video o un sitio para ver quién lo mandó, cuándo y cuánto.`}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <header className="px-5 pt-5 pb-3">
            <h3 className="text-xl tracking-tight">Videos más mandados</h3>
          </header>
          {clips.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No hay videos en este recorte.</p>
          ) : (
            <ol className="divide-y divide-border/70 border-t border-border/70">
              {clips.map((clip, index) => (
                <li key={clip.id}>
                  <Fold
                    summaryClassName="px-5 py-3 hover:bg-muted/40"
                    bodyClassName="space-y-3 bg-muted/20 px-5 py-4"
                    summary={
                      <span className="grid grid-cols-[1.5rem_4.5rem_minmax(0,1fr)_auto] items-center gap-3">
                        <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                        <img
                          src={`https://i.ytimg.com/vi/${clip.id}/mqdefault.jpg`}
                          alt=""
                          width={72}
                          height={40}
                          loading="lazy"
                          className="aspect-video w-[4.5rem] rounded bg-muted object-cover"
                        />
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm leading-5 font-medium">{clip.title ?? clip.id}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {clip.channel ? `${clip.channel} · ` : ""}
                            {formatCount(clip.count)} veces · {formatCount(clip.donors)} personas
                          </span>
                        </span>
                        <span className="text-right text-sm font-medium tabular-nums">{money(pick(cur, clip))}</span>
                      </span>
                    }
                  >
                    <a
                      href={clip.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Abrir en YouTube ↗
                    </a>
                    <DrillPanel kind="yt" drillKey={clip.id} scope={stats.scope} />
                  </Fold>
                </li>
              ))}
            </ol>
          )}
          {yt.clips.length > 12 ? (
            <div className="border-t border-border/70 px-5 py-3">
              <button type="button" className={buttonClass("ghost", "h-9 px-3")} onClick={() => setAllClips((v) => !v)}>
                {allClips ? "Ver menos" : `Ver los ${formatCount(yt.clips.length)}`}
              </button>
            </div>
          ) : null}
        </Card>
        <Card>
          <header className="space-y-1 px-5 pt-5 pb-3">
            <h3 className="text-xl tracking-tight">Por sitio</h3>
            <p className="text-sm text-muted-foreground">Mensajes con al menos un link a cada sitio.</p>
          </header>
          {stats.domains.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No hay links en este recorte.</p>
          ) : (
            <ol className="divide-y divide-border/70 border-t border-border/70">
              {stats.domains.map((site) => (
                <li key={site.key}>
                  <Fold
                    summaryClassName="px-5 py-3 hover:bg-muted/40"
                    bodyClassName="space-y-3 bg-muted/20 px-5 py-4"
                    summary={
                      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{domainLabel(site.key)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {site.key} · {formatCount(site.messages)} mensajes · {formatCount(site.donors)} personas
                          </span>
                        </span>
                        <span className="text-right text-sm font-medium tabular-nums">{money(pick(cur, site))}</span>
                      </span>
                    }
                  >
                    {site.urls.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Links repetidos</p>
                        <ul className="space-y-1 text-sm">
                          {site.urls.map((url) => (
                            <li key={url.url} className="flex items-baseline justify-between gap-3">
                              <a
                                href={`https://${url.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 truncate text-primary underline-offset-2 hover:underline"
                              >
                                {url.url}
                              </a>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{url.count}×</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <DrillPanel kind="domain" drillKey={site.key} scope={stats.scope} />
                  </Fold>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tamaño del aporte                                                   */
/* ------------------------------------------------------------------ */

export function BracketsSection({ stats }: { stats: StatsReport }) {
  const cur = stats.scope.cur;
  const peak = Math.max(...stats.brackets.map((row) => row.count), 1);
  return (
    <section className="space-y-4">
      <SectionHead
        id="tamano"
        kicker="Tamaño"
        title="Por tamaño del aporte"
        text={`Cada donación según su monto en ${cur === "usd" ? "dólares" : "pesos"}. Abrí una franja para ver los aportes.`}
      />
      <Card>
        <div className="divide-y divide-border/70 px-5 py-2">
          {stats.brackets.map((row) => (
            <Fold
              key={row.key}
              summaryClassName="py-3"
              bodyClassName="pb-4"
              summary={
                <span className="block space-y-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="text-right">
                      <span className="font-medium tabular-nums">{formatCount(row.count)}</span>
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                        {formatArs(row.ars)} · {formatUsd(row.usd)}
                      </span>
                    </span>
                  </span>
                  <Bar value={row.count} peak={peak} />
                </span>
              }
            >
              <DrillPanel kind="bracket" drillKey={row.key} scope={stats.scope} />
            </Fold>
          ))}
        </div>
      </Card>
    </section>
  );
}
