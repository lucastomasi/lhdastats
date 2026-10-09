import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Badge, buttonClass, fieldClass } from "@/components/ui";
import {
  concentrationActive,
  concentrationBandSearch,
  concentrationToSearch,
  DEFAULT_CONCENTRATION,
  type ConcentrationDonor,
  type ConcentrationHit,
  type ConcentrationParams,
  type ConcentrationReport,
  type ListSearch,
  type MonthOption,
  type StatsScope,
} from "@/lib/archive";
import { AmountFolds } from "@/components/stats-view";
import { formatArs, formatCount, formatPct, formatUsd, formatWhen } from "@/lib/format";
import { formatYmd, parseYmd, resolveDateRange } from "@/lib/query";

const PRESETS = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "ultimo", label: "Último día" },
];

const PREVIEW = 12;

export function ConcentrationBoard({
  report,
  scope,
  baseSearch,
  months,
  lastDay,
}: {
  report: ConcentrationReport;
  /** Global period/currency; the board follows it unless overridden here. */
  scope: StatsScope;
  /** Buscador filters + global scope, preserved when the board changes. */
  baseSearch: ListSearch;
  months: MonthOption[];
  lastDay: string;
}) {
  const navigate = useNavigate();
  const params = report.params;
  const money = params.cur === "usd" ? formatUsd : formatArs;
  const range = resolveDateRange(params, Date.now(), parseYmd(lastDay));
  const active = concentrationActive(params, scope);
  const drillScope: StatsScope = { when: params.when === "todo" ? "" : params.when, from: params.from, to: params.to, cur: params.cur };
  const rangeLabel = range
    ? formatYmd(range.from) === formatYmd(range.to)
      ? formatYmd(range.from)
      : `${formatYmd(range.from)} → ${formatYmd(range.to)}`
    : "todo el archivo";
  const summary = [
    `cortes ${params.cuts.join("/")} %`,
    `hasta ${money(params.under)}`,
    `desde ${money(params.over)}`,
    `recurrentes ${params.reps}+`,
    params.cur === "usd" ? "US$" : "pesos",
    rangeLabel,
  ].join(" · ");

  function apply(next: ConcentrationParams) {
    const search: ListSearch = { ...baseSearch, ...concentrationToSearch(next, scope) };
    navigate({ to: "/", search, hash: "concentracion", resetScroll: false });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cur = String(data.get("ccur") ?? params.cur) === "usd" ? "usd" : "ars";
    const refunds = String(data.get("cdev") ?? "out");
    const from = String(data.get("cfrom") ?? "").trim();
    const to = String(data.get("cto") ?? "").trim();
    apply({
      cuts: parseCuts(String(data.get("cut") ?? "")),
      typical: parseTips(String(data.get("tips") ?? "")),
      under: numberOr(data.get("upto"), DEFAULT_CONCENTRATION.under),
      over: numberOr(data.get("over"), DEFAULT_CONCENTRATION.over),
      reps: Math.max(1, Math.round(numberOr(data.get("reps"), DEFAULT_CONCENTRATION.reps))),
      when: from || to ? "" : params.when,
      from,
      to,
      cur,
      refunds: refunds === "in" || refunds === "only" ? refunds : "out",
    });
  }

  const moreSearch: ListSearch = {
    ...scopeKeep(baseSearch),
    sort: "aporte",
    dev: params.refunds === "in" ? "in" : params.refunds,
    ...(params.when && params.when !== "todo" ? { when: params.when } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  };
  const underSearch = { ...concentrationBandSearch(params, "under", scope), ...scopeKeep(baseSearch) };
  const overSearch = { ...concentrationBandSearch(params, "over", scope), ...scopeKeep(baseSearch) };

  return (
    <section id="concentracion" className="scroll-mt-6 space-y-4">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Concentración</p>
        <h2 className="text-3xl tracking-tight">Quién sostiene el archivo</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Cada tarjeta se abre y muestra de quién o de qué está hecha. Sigue el período y la moneda de la barra de
          arriba; en «Parámetros» se cambian cortes, umbrales, recurrentes, montos típicos, fechas y moneda solo para
          este bloque. Todo queda en la URL. Nombres unificados; las devoluciones, por defecto, no entran.
        </p>
      </div>

      <details className="fold group rounded-2xl bg-card ring-1 ring-foreground/10" open={false}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              Parámetros{active ? <span className="ml-2 align-middle"><Badge>cambiados</Badge></span> : null}
            </span>
            <span className="block text-xs text-muted-foreground">{summary}</span>
          </span>
          <span className="chev text-muted-foreground" aria-hidden="true">›</span>
        </summary>
      <form
        key={`${params.cuts.join(",")}-${params.typical.join(",")}-${params.under}-${params.over}-${params.reps}-${params.cur}-${params.refunds}-${params.from}-${params.to}`}
        onSubmit={onSubmit}
        className="space-y-4 border-t border-border/80 p-3 md:p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {formatCount(report.scopedCount)} aportes · {formatCount(report.donorCount)} personas ·{" "}
            {formatArs(report.scopedArs)} · {formatUsd(report.scopedUsd)} · {rangeLabel}
          </p>
          {active ? (
            <Link
              to="/"
              search={baseSearch}
              hash="concentracion"
              resetScroll={false}
              className={buttonClass("outline", "h-9 px-3")}
            >
              Valores por defecto
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() =>
                apply({ ...params, when: params.when === preset.key ? "" : preset.key, from: "", to: "" })
              }
              className={chipClass(params.when === preset.key)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Mes
            <select
              value={/^\d{4}-\d{2}$/.test(params.when) ? params.when : ""}
              onChange={(event) => apply({ ...params, when: event.target.value, from: "", to: "" })}
              className={fieldClass}
            >
              <option value="">Todo el archivo</option>
              {months.map((month) => (
                <option key={month.key} value={month.key}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Desde
            <input type="date" name="cfrom" defaultValue={params.from} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Hasta
            <input type="date" name="cto" defaultValue={params.to} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Moneda
            <select
              name="ccur"
              value={params.cur}
              onChange={(event) => apply({ ...params, cur: event.target.value === "usd" ? "usd" : "ars" })}
              className={fieldClass}
            >
              <option value="ars">Pesos</option>
              <option value="usd">Dólares</option>
            </select>
          </label>
        </div>

        <CutSliders cuts={params.cuts} onCommit={(cuts) => apply({ ...params, cuts })} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Montos típicos
            <input name="tips" defaultValue={params.typical.join(", ")} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Recurrentes, mínimo de aportes
            <input name="reps" inputMode="numeric" defaultValue={params.reps} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Hasta (inclusive)
            <input name="upto" inputMode="decimal" defaultValue={params.under} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Desde (inclusive)
            <input name="over" inputMode="decimal" defaultValue={params.over} className={fieldClass} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Devoluciones
            <select
              name="cdev"
              value={params.refunds}
              onChange={(event) => {
                const refunds = event.target.value;
                apply({ ...params, refunds: refunds === "in" || refunds === "only" ? refunds : "out" });
              }}
              className={fieldClass}
            >
              <option value="out">Excluirlas</option>
              <option value="in">Incluirlas</option>
              <option value="only">Solo devoluciones</option>
            </select>
          </label>
        </div>

        <button type="submit" className={buttonClass("primary")}>
          Recalcular
        </button>
      </form>
      </details>

      <div className="grid gap-3 lg:grid-cols-2">
        {report.cuts.map((cut) => (
          <Disclosure
            key={cut.pct}
            kicker={`${cut.pct}% del monto`}
            value={formatCount(cut.donorCount)}
            text="personas, de mayor a menor aporte, con el % acumulado"
          >
            <DonorTable donors={cut.donors} total={cut.donorCount} money={money} more={moreSearch} />
          </Disclosure>
        ))}

        <Disclosure
          kicker={`Montos ${params.typical.map((n) => formatCount(n)).join(", ")}`}
          value={formatPct(report.typicalShare)}
          text="de los aportes en la moneda elegida"
        >
          {report.typical.every((row) => row.count === 0) ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Ningún aporte cae en esos montos.</p>
          ) : (
            <div className="px-3 py-2 md:px-5">
              <AmountFolds rows={report.typical} cur={params.cur} scope={drillScope} />
            </div>
          )}
        </Disclosure>

        <Disclosure
          kicker={`Hasta ${money(params.under)}`}
          value={formatPct(report.under.textShare)}
          text={`${formatPct(report.under.amountShare)} del monto · ${formatCount(report.under.count)} aportes`}
        >
          <HitList
            rows={report.under.rows}
            cur={params.cur}
            search={underSearch}
            total={report.under.count}
          />
        </Disclosure>

        <Disclosure
          kicker={`Desde ${money(params.over)}`}
          value={formatPct(report.over.textShare)}
          text={`${formatPct(report.over.amountShare)} del monto · ${formatCount(report.over.count)} aportes`}
        >
          <HitList
            rows={report.over.rows}
            cur={params.cur}
            search={overSearch}
            total={report.over.count}
            bigger
          />
        </Disclosure>

        <Disclosure
          kicker={`Recurrentes, ${formatCount(params.reps)} o más`}
          value={formatPct(report.recurrent.donorShare)}
          text={`${formatPct(report.recurrent.amountShare)} del monto · ${formatCount(report.recurrent.donorCount)} personas`}
        >
          <DonorTable donors={report.recurrent.donors} total={report.recurrent.donorCount} money={money} more={moreSearch} byCount />
        </Disclosure>

        <Disclosure
          kicker="Mediana / moda"
          value={money(report.median)}
          text={`moda ${money(report.mode)} (${formatCount(report.modeCount)} veces)`}
        >
          {report.histogram.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No hay montos para armar la distribución.</p>
          ) : (
            <div className="space-y-2 px-3 py-3 md:px-5">
              <p className="text-xs text-muted-foreground">
                Los {formatCount(report.histogram.length)} montos que más se repiten (moda {money(report.mode)}, mediana{" "}
                {money(report.median)}). Cada uno se abre con sus aportes.
              </p>
              <AmountFolds rows={report.histogram} cur={params.cur} scope={drillScope} />
            </div>
          )}
        </Disclosure>

        <Disclosure
          kicker="Tipo de cambio modal"
          value={formatArs(report.modalFx)}
          text={`${formatPct(report.modalFxShare)} de las filas con US$ > 0`}
        >
          {report.fx.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No hay tipos de cambio en este recorte.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="px-5 py-2 font-medium">ARS por US$</th>
                    <th className="px-3 py-2 font-medium">Filas</th>
                    <th className="px-5 py-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.fx.map((row) => (
                    <tr key={row.rate} className="border-t border-border/80">
                      <td className="px-5 py-2 font-medium tabular-nums">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {formatArs(row.rate)}
                          {row.rate === report.modalFx ? <Badge>modal</Badge> : null}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatCount(row.count)}</td>
                      <td className="px-5 py-2 tabular-nums">{formatPct(row.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Disclosure>
      </div>
    </section>
  );
}

function Disclosure({
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
    <details className="rounded-2xl bg-card ring-1 ring-foreground/10 open:ring-primary/30">
      <summary className="cursor-pointer list-none px-5 py-5 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">{kicker}</p>
            <p className="font-heading text-3xl tracking-tight tabular-nums">{value}</p>
            <p className="text-sm leading-6 text-muted-foreground">{text}</p>
          </div>
          <span className="mt-1 shrink-0 text-sm text-primary" aria-hidden>
            +
          </span>
        </div>
      </summary>
      <div className="border-t border-border/80 pb-2">{children}</div>
    </details>
  );
}

function DonorTable({
  donors,
  total,
  more,
  byCount,
}: {
  donors: ConcentrationDonor[];
  total: number;
  more: ListSearch;
  money: (value: number) => string;
  byCount?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (donors.length === 0) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">Nadie entra en este corte.</p>;
  }
  const shown = open ? donors : donors.slice(0, PREVIEW);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-5 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Donante</th>
              <th className="px-3 py-2 font-medium">Aportes</th>
              <th className="px-3 py-2 font-medium">ARS</th>
              <th className="px-3 py-2 font-medium">US$</th>
              <th className="px-5 py-2 font-medium">{byCount ? "% del monto" : "Acumulado"}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr key={row.nombre} className="border-t border-border/80">
                <td className="px-5 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                <td className="px-3 py-2 font-medium">
                  <Link to="/donante/$nombre" params={{ nombre: row.nombre }} className="hover:text-primary">
                    {row.nombre}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatCount(row.count)}</td>
                <td className="px-3 py-2 tabular-nums">{formatArs(row.ars)}</td>
                <td className="px-3 py-2 tabular-nums">{formatUsd(row.usd)}</td>
                <td className="px-5 py-2 tabular-nums">{formatPct(byCount ? row.share : row.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {donors.length > PREVIEW || total > donors.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          {donors.length > PREVIEW ? (
            <button type="button" className={buttonClass("ghost", "h-9 px-3")} onClick={() => setOpen((value) => !value)}>
              {open
                ? "Ver menos"
                : total > donors.length
                  ? `Ver los primeros ${formatCount(donors.length)} de ${formatCount(total)}`
                  : `Ver los ${formatCount(donors.length)}`}
            </button>
          ) : null}
          {total > donors.length ? (
            <Link
              to="/"
              search={more}
              hash="archivo"
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Resto en el buscador (quienes más aportaron) →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HitList({
  rows,
  cur,
  search,
  total,
  bigger,
}: {
  rows: ConcentrationHit[];
  cur: "ars" | "usd";
  search: ListSearch;
  total: number;
  bigger?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">Ningún aporte en este umbral.</p>;
  }
  return (
    <div>
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 border-t border-border/80 px-5 py-3">
            <div className="min-w-0">
              <Link to="/donante/$nombre" params={{ nombre: row.nombre }} className="font-medium hover:text-primary">
                {row.nombre}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatWhen(row.fecha_aprox)} · {row.fecha_relativa}
              </p>
            </div>
            <p className="shrink-0 text-right font-medium tabular-nums">
              {cur === "usd" ? formatUsd(row.usd) : formatArs(row.ars)}
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {formatArs(row.ars)} · {formatUsd(row.usd)}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {bigger ? "Los de mayor monto" : "Los más recientes"} · {formatCount(rows.length)} de {formatCount(total)}
        </p>
        <Link to="/" search={search} hash="archivo" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          Ver todos en el buscador
        </Link>
      </div>
    </div>
  );
}

function CutSliders({ cuts, onCommit }: { cuts: number[]; onCommit: (cuts: number[]) => void }) {
  const [draft, setDraft] = useState(cuts);
  const draftRef = useRef(cuts);
  const publishedRef = useRef(cuts);
  draftRef.current = draft;

  function sameCuts(a: number[], b: number[]) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function publish(next: number[]) {
    const clean = [...new Set(next.filter((n) => n >= 1 && n <= 99))].sort((a, b) => a - b).slice(0, 4);
    const resolved = clean.length ? clean : [...DEFAULT_CONCENTRATION.cuts];
    draftRef.current = resolved;
    setDraft(resolved);
    if (sameCuts(resolved, publishedRef.current)) return;
    publishedRef.current = resolved;
    onCommit(resolved);
  }

  function setAt(index: number, raw: number) {
    const value = Math.min(99, Math.max(1, Math.round(Number.isFinite(raw) ? raw : 1)));
    const next = draftRef.current.map((cut, i) => (i === index ? value : cut));
    draftRef.current = next;
    setDraft(next);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-medium text-muted-foreground">Cortes del monto (%)</legend>
      <p className="text-xs text-muted-foreground">Hasta 4 cortes. El slider aplica al soltar; el número, al salir del campo.</p>
      <input type="hidden" name="cut" value={draft.join(",")} />
      {draft.map((cut, index) => (
        <div key={`${index}-${draft.length}`} className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={99}
            value={cut}
            aria-label={`Corte ${index + 1}`}
            onChange={(event) => setAt(index, Number(event.target.value))}
            onPointerUp={() => publish(draftRef.current)}
            onBlur={() => publish(draftRef.current)}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <input
            type="number"
            min={1}
            max={99}
            value={cut}
            aria-label={`Porcentaje del corte ${index + 1}`}
            onChange={(event) => setAt(index, Number(event.target.value))}
            onBlur={() => publish(draftRef.current)}
            className={`${fieldClass} w-20 px-2 text-center`}
          />
          {draft.length > 1 ? (
            <button
              type="button"
              className={buttonClass("ghost", "h-9 w-9")}
              aria-label={`Quitar corte ${cut}%`}
              onClick={() => publish(draftRef.current.filter((_, i) => i !== index))}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {draft.length < 4 ? (
        <button
          type="button"
          className={buttonClass("ghost", "h-9 px-3")}
          onClick={() => publish([...draftRef.current, nextCut(draftRef.current)])}
        >
          Agregar corte
        </button>
      ) : null}
    </fieldset>
  );
}

function nextCut(existing: number[]) {
  for (const candidate of [90, 70, 60, 40, 30, 20, 10, 95, 80, 50]) {
    if (!existing.includes(candidate)) return candidate;
  }
  return Math.min(99, Math.max(1, (existing.at(-1) ?? 50) + 5));
}

function chipClass(on: boolean) {
  return [
    "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium",
    on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80",
  ].join(" ");
}

function parseCuts(raw: string) {
  const list = raw
    .split(/[,\s]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 99)
    .map((n) => Math.round(n));
  return list.length ? [...new Set(list)].sort((a, b) => a - b).slice(0, 4) : [...DEFAULT_CONCENTRATION.cuts];
}

function parseTips(raw: string) {
  const list = raw
    .split(/[,\s]+/)
    .map((part) => Number(part.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
  return list.length ? [...new Set(list)].sort((a, b) => a - b).slice(0, 12) : [...DEFAULT_CONCENTRATION.typical];
}

function numberOr(value: FormDataEntryValue | null, fallback: number) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const SCOPE_KEYS = ["sw", "sfrom", "sto", "scur"] as const;

function scopeKeep(search: ListSearch): ListSearch {
  const next: ListSearch = {};
  for (const key of SCOPE_KEYS) if (search[key]) next[key] = search[key] as never;
  return next;
}
