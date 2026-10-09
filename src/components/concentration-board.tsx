import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { Badge, buttonClass, fieldClass } from "@/components/ui";
import {
  concentrationActive,
  concentrationToSearch,
  DEFAULT_CONCENTRATION,
  filtersToListSearch,
  filtersToSearch,
  type ConcentrationDonor,
  type ConcentrationHit,
  type ConcentrationParams,
  type ConcentrationReport,
  type Filters,
  type ListSearch,
  type MonthOption,
} from "@/lib/archive";
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
  filters,
  months,
  lastDay,
}: {
  report: ConcentrationReport;
  filters: Filters;
  months: MonthOption[];
  lastDay: string;
}) {
  const navigate = useNavigate();
  const params = report.params;
  const money = params.cur === "usd" ? formatUsd : formatArs;
  const archiveSearch = filtersToListSearch(filters);
  const range = resolveDateRange(params, Date.now(), parseYmd(lastDay));

  function apply(next: ConcentrationParams) {
    const search: ListSearch = { ...archiveSearch, ...concentrationToSearch(next) };
    navigate({ to: "/", search });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cur = String(data.get("ccur") ?? "ars") === "usd" ? "usd" : "ars";
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

  const underHref = bandHref(params, "under", archiveSearch);
  const overHref = bandHref(params, "over", archiveSearch);

  return (
    <section id="concentracion" className="scroll-mt-6 space-y-4">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Concentración</p>
        <h2 className="text-3xl tracking-tight">Quién sostiene el archivo</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Cada tarjeta se abre y muestra de quién o de qué está hecha. Los cortes, umbrales y la moneda se eligen acá
          arriba y quedan en la URL. Nombres unificados; las devoluciones, por defecto, no entran.
        </p>
      </div>

      <form
        key={`${params.cuts.join(",")}-${params.typical.join(",")}-${params.under}-${params.over}-${params.reps}-${params.cur}-${params.refunds}-${params.from}-${params.to}`}
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl bg-card p-3 ring-1 ring-foreground/10 md:p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {formatCount(report.scopedCount)} aportes · {formatCount(report.donorCount)} personas ·{" "}
            {formatArs(report.scopedArs)} · {formatUsd(report.scopedUsd)}
            {range ? ` · ${formatYmd(range.from) === formatYmd(range.to) ? formatYmd(range.from) : `${formatYmd(range.from)} → ${formatYmd(range.to)}`}` : ""}
          </p>
          {concentrationActive(params) ? (
            <Link to="/" search={archiveSearch} className={buttonClass("outline", "h-9 px-3")}>
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
            <select name="ccur" defaultValue={params.cur} className={fieldClass}>
              <option value="ars">Pesos</option>
              <option value="usd">Dólares</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Cortes del monto (%)
            <input name="cut" defaultValue={params.cuts.join(", ")} className={fieldClass} />
          </label>
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
            <select name="cdev" defaultValue={params.refunds} className={fieldClass}>
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

      <div className="grid gap-3 lg:grid-cols-2">
        {report.cuts.map((cut) => (
          <Disclosure
            key={cut.pct}
            kicker={`${cut.pct}% del monto`}
            value={formatCount(cut.donorCount)}
            text="personas, de mayor a menor aporte, con el % acumulado"
          >
            <DonorTable donors={cut.donors} money={money} />
          </Disclosure>
        ))}

        <Disclosure
          kicker={`Montos ${params.typical.map((n) => formatCount(n)).join(", ")}`}
          value={formatPct(report.typicalShare)}
          text="de los aportes en la moneda elegida"
        >
          <AmountTable rows={report.typical} money={money} empty="Ningún aporte cae en esos montos." />
        </Disclosure>

        <Disclosure
          kicker={`Hasta ${money(params.under)}`}
          value={formatPct(report.under.textShare)}
          text={`${formatPct(report.under.amountShare)} del monto · ${formatCount(report.under.count)} aportes`}
        >
          <HitList
            rows={report.under.rows}
            cur={params.cur}
            href={underHref}
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
            href={overHref}
            total={report.over.count}
            bigger
          />
        </Disclosure>

        <Disclosure
          kicker={`Recurrentes, ${formatCount(params.reps)} o más`}
          value={formatPct(report.recurrent.donorShare)}
          text={`${formatPct(report.recurrent.amountShare)} del monto · ${formatCount(report.recurrent.donors.length)} personas`}
        >
          <DonorTable donors={report.recurrent.donors} money={money} byCount />
        </Disclosure>

        <Disclosure
          kicker="Mediana / moda"
          value={money(report.median)}
          text={`moda ${money(report.mode)} (${formatCount(report.modeCount)} veces)`}
        >
          <Histogram rows={report.histogram} money={money} mode={report.mode} median={report.median} />
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
  money,
  byCount,
}: {
  donors: ConcentrationDonor[];
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
      {donors.length > PREVIEW ? (
        <div className="px-5 py-3">
          <button type="button" className={buttonClass("ghost", "h-9 px-3")} onClick={() => setOpen((value) => !value)}>
            {open ? "Ver menos" : `Ver los ${formatCount(donors.length)}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AmountTable({
  rows,
  money,
  empty,
}: {
  rows: { amount: number; count: number; share: number }[];
  money: (value: number) => string;
  empty: string;
}) {
  if (rows.every((row) => row.count === 0)) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <th className="px-5 py-2 font-medium">Monto</th>
            <th className="px-3 py-2 font-medium">Aportes</th>
            <th className="px-5 py-2 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.amount} className="border-t border-border/80">
              <td className="px-5 py-2 font-medium tabular-nums">{money(row.amount)}</td>
              <td className="px-3 py-2 tabular-nums">{formatCount(row.count)}</td>
              <td className="px-5 py-2 tabular-nums">{formatPct(row.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HitList({
  rows,
  cur,
  href,
  total,
  bigger,
}: {
  rows: ConcentrationHit[];
  cur: "ars" | "usd";
  href: string;
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
        <Link to={href} className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          Ver todos en el buscador
        </Link>
      </div>
    </div>
  );
}

function Histogram({
  rows,
  money,
  mode,
  median,
}: {
  rows: { amount: number; count: number; share: number }[];
  money: (value: number) => string;
  mode: number;
  median: number;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-4 text-sm text-muted-foreground">No hay montos para armar la distribución.</p>;
  }
  const peak = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="space-y-3 px-5 py-4">
      <p className="text-xs text-muted-foreground">
        Los {formatCount(rows.length)} montos que más se repiten. La mediana es {money(median)}.
      </p>
      <ol className="space-y-2">
        {rows.map((row) => (
          <li key={row.amount} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium tabular-nums">
                {money(row.amount)}
                {row.amount === mode ? (
                  <span className="ml-2 text-xs font-semibold tracking-wide text-primary uppercase">moda</span>
                ) : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatCount(row.count)} · {formatPct(row.share)}
              </span>
            </div>
            <span className="block h-2 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, (row.count / peak) * 100)}%` }}
              />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function bandHref(params: ConcentrationParams, band: "under" | "over", archive: ListSearch) {
  const scoped: Filters = {
    q: "",
    donor: "",
    sort: band === "over" ? "mayor" : "reciente",
    minArs: null,
    maxArs: null,
    minUsd: null,
    maxUsd: null,
    from: params.from,
    to: params.to,
    when: params.when,
    conduct: "",
    hasLink: false,
    hasYoutube: false,
    empty: false,
    priv: false,
    refunds: params.refunds === "in" ? "in" : params.refunds,
    currency: "",
    page: 1,
  };
  if (params.cur === "usd") {
    if (band === "under") scoped.maxUsd = params.under;
    else scoped.minUsd = params.over;
  } else if (band === "under") scoped.maxArs = params.under;
  else scoped.minArs = params.over;
  const href = filtersToSearch(scoped);
  const extra = new URLSearchParams();
  for (const [key, value] of Object.entries(archive)) {
    if (value == null || value === "" || key === "min" || key === "max" || key === "minusd" || key === "maxusd") {
      continue;
    }
    extra.set(key, String(value));
  }
  extra.delete("page");
  extra.delete("sort");
  extra.delete("when");
  extra.delete("from");
  extra.delete("to");
  extra.delete("dev");
  const joined = extra.toString();
  if (!joined) return href;
  return href.includes("?") ? `${href}&${joined}` : `${href}?${joined}`;
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