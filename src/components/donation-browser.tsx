import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MessageText } from "@/components/message-text";
import { Badge, buttonClass, fieldClass } from "@/components/ui";
import {
  PAGE_SIZE,
  donorHref,
  exportHref,
  filtersActive,
  filtersToListSearch,
  filtersToSearch,
  type DonorChoice,
  type Filters,
  type ListSearch,
  type MonthOption,
  type PageResult,
} from "@/lib/archive";
import { getDonorChoices } from "@/lib/archive.functions";
import { CONDUCT_ORDER } from "@/lib/conduct";
import { formatArs, formatCount, formatUsd, formatWhen } from "@/lib/format";
import {
  WEEKDAY_LABELS,
  addDays,
  fold,
  formatYmd,
  monthGrid,
  monthLabel,
  parseYearMonth,
  parseYmd,
  resolveDateRange,
  ymd,
  ymdParts,
} from "@/lib/query";

const PRESETS: { key: string; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "ultimo", label: "Último día del archivo" },
];

let donorChoicesPromise: Promise<DonorChoice[]> | null = null;

export function DonationBrowser({
  filters,
  result,
  mode,
  donorName,
  months = [],
  donors = [],
  lastDay = "",
  sites = [],
  extraSearch = {},
}: {
  filters: Filters;
  result: PageResult;
  mode: "home" | "donor";
  donorName?: string;
  months?: MonthOption[];
  donors?: DonorChoice[];
  lastDay?: string;
  sites?: { key: string; count: number }[];
  extraSearch?: ListSearch;
}) {
  const navigate = useNavigate();
  const includeDonor = mode === "home";
  const action = mode === "donor" && donorName ? donorHref(donorName) : "/";
  const active = filtersActive(filters, includeDonor);
  const from = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);
  const lastArchiveDay = parseYmd(lastDay);
  const range = resolveDateRange(filters, Date.now(), lastArchiveDay);
  const [donorDraft, setDonorDraft] = useState(filters.donor);
  const [donorOpen, setDonorOpen] = useState(false);
  const [donorPool, setDonorPool] = useState<DonorChoice[]>(donors);

  function loadDonors() {
    if (donorPool.length > 0 || !includeDonor) return;
    if (!donorChoicesPromise) donorChoicesPromise = getDonorChoices().catch(() => [] as DonorChoice[]);
    void donorChoicesPromise.then((list) => setDonorPool(list));
  }

  const suggestions = useMemo(() => {
    const needle = fold(donorDraft);
    const pool = needle ? donorPool.filter((row) => fold(row.nombre).includes(needle)) : donorPool;
    return pool.slice(0, 8);
  }, [donorDraft, donorPool]);

  function go(next: Filters, page = 1) {
    const search: ListSearch = {
      ...(includeDonor ? extraSearch : {}),
      ...filtersToListSearch({ ...next, page }, page, includeDonor),
    };
    if (mode === "donor" && donorName) {
      navigate({ to: "/donante/$nombre", params: { nombre: donorName }, search });
    } else {
      navigate({ to: "/", search, hash: "archivo", resetScroll: false });
    }
  }

  function patch(partial: Partial<Filters>) {
    go({ ...filters, ...partial, page: 1 });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const sort = String(data.get("sort") ?? "reciente");
    go({
      ...filters,
      q: String(data.get("q") ?? "").trim(),
      donor: includeDonor ? String(data.get("donor") ?? "").trim() : filters.donor,
      sort: (["reciente", "antigua", "mayor", "menor", "donante", "aporte"] as const).includes(
        sort as Filters["sort"],
      )
        ? (sort as Filters["sort"])
        : "reciente",
      minArs: amountFrom(data.get("min")),
      maxArs: amountFrom(data.get("max"), true),
      minUsd: amountFrom(data.get("minusd")),
      maxUsd: amountFrom(data.get("maxusd"), true),
      from: String(data.get("from") ?? "").trim(),
      to: String(data.get("to") ?? "").trim(),
      when: filters.when,
      conduct: String(data.get("conduct") ?? ""),
      refunds: refundFrom(data.get("dev")),
      currency: currencyFrom(data.get("cur")),
      domain: String(data.get("dom") ?? "").trim(),
      page: 1,
    });
  }

  return (
    <section className="space-y-4">
      <form action={action} method="get" onSubmit={onSubmit} className="space-y-3">
        <DatePanel
          filters={filters}
          months={months}
          range={range}
          lastDay={lastDay}
          onPreset={(when) => patch({ when, from: "", to: "" })}
          onMonth={(when) => patch({ when, from: "", to: "" })}
          onDay={(day) => {
            const clicked = formatYmd(day);
            if (!filters.from || filters.when || (filters.from && filters.to && filters.from === filters.to)) {
              patch({ when: "", from: clicked, to: clicked });
              return;
            }
            if (filters.from && !filters.to) {
              patch({ when: "", from: filters.from, to: clicked });
              return;
            }
            patch({ when: "", from: clicked, to: clicked });
          }}
          onRange={(fromDay, toDay) => patch({ when: "", from: fromDay, to: toDay })}
        />

        <div className="space-y-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10 md:p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Texto en nombre o mensaje
              <input
                name="q"
                defaultValue={filters.q}
                placeholder='palan, "te amo", -kuka'
                className={fieldClass}
              />
              <span className="font-normal">
                Sin mayúsculas ni acentos. Frase exacta entre comillas. Restá con -palabra.
              </span>
            </label>
            {includeDonor ? (
              <label className="relative grid gap-1 text-xs font-medium text-muted-foreground">
                Donante
                <input
                  name="donor"
                  value={donorDraft}
                  autoComplete="off"
                  placeholder="Nombre unificado…"
                  className={fieldClass}
                  onChange={(event) => {
                    setDonorDraft(event.target.value);
                    setDonorOpen(true);
                    loadDonors();
                  }}
                  onFocus={() => {
                    setDonorOpen(true);
                    loadDonors();
                  }}
                  onBlur={() => window.setTimeout(() => setDonorOpen(false), 120)}
                />
                {donorOpen && suggestions.length > 0 ? (
                  <ul className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl bg-card py-1 text-sm text-foreground shadow-lg ring-1 ring-foreground/10">
                    {suggestions.map((row) => (
                      <li key={row.nombre}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setDonorDraft(row.nombre);
                            setDonorOpen(false);
                            patch({ donor: row.nombre });
                          }}
                        >
                          <span className="truncate">{row.nombre}</span>
                          <span className="tabular-nums text-muted-foreground">{formatCount(row.count)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </label>
            ) : (
              <input type="hidden" name="donor" value={filters.donor} />
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField name="min" label="Mínimo ARS" defaultValue={filters.minArs} placeholder="1000" />
            <NumberField name="max" label="Máximo ARS" defaultValue={filters.maxArs} placeholder="50000" />
            <NumberField name="minusd" label="Mínimo US$" defaultValue={filters.minUsd} placeholder="1" />
            <NumberField name="maxusd" label="Máximo US$" defaultValue={filters.maxUsd} placeholder="20" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Conducta
              <select name="conduct" defaultValue={filters.conduct} className={fieldClass}>
                <option value="">Todas</option>
                {CONDUCT_ORDER.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Devoluciones
              <select name="dev" defaultValue={filters.refunds} className={fieldClass}>
                <option value="in">Incluirlas</option>
                <option value="out">Excluirlas</option>
                <option value="only">Solo devoluciones</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Moneda original
              <select name="cur" defaultValue={filters.currency} className={fieldClass}>
                <option value="">Todas</option>
                <option value="ars">Parece pesos</option>
                <option value="usd">Parece dólares enteros</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Orden
              <select name="sort" defaultValue={filters.sort} className={fieldClass}>
                <option value="reciente">Más recientes</option>
                <option value="antigua">Más antiguas</option>
                <option value="mayor">Mayor monto</option>
                <option value="menor">Menor monto</option>
                <option value="donante">Donante A–Z</option>
                <option value="aporte">Quienes más aportaron</option>
              </select>
            </label>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-xs font-medium text-muted-foreground">En el mensaje</legend>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                Sitio del link
                <select
                  name="dom"
                  value={filters.domain}
                  onChange={(event) => patch({ domain: event.target.value })}
                  className={`${fieldClass} h-9 w-auto`}
                >
                  <option value="">Cualquiera</option>
                  {filters.domain && !sites.some((site) => site.key === filters.domain) ? (
                    <option value={filters.domain}>{filters.domain}</option>
                  ) : null}
                  {sites.map((site) => (
                    <option key={site.key} value={site.key}>
                      {site.key} ({formatCount(site.count)})
                    </option>
                  ))}
                </select>
              </label>
              {filters.video ? (
                <FlagChip label={`Video ${filters.video} ×`} on onToggle={() => patch({ video: "" })} />
              ) : null}
              <FlagChip
                label="Tiene link"
                on={filters.hasLink}
                onToggle={() => patch({ hasLink: !filters.hasLink })}
              />
              <FlagChip
                label="Tiene YouTube"
                on={filters.hasYoutube}
                onToggle={() => patch({ hasYoutube: !filters.hasYoutube })}
              />
              <FlagChip
                label="Sin mensaje"
                on={filters.empty}
                onToggle={() => patch({ empty: !filters.empty })}
              />
              <FlagChip
                label="Mensaje privado"
                on={filters.priv}
                onToggle={() => patch({ priv: !filters.priv })}
              />
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="submit" className={buttonClass("primary", "w-full sm:w-auto")}>
              Aplicar filtros
            </button>
            {active ? (
              mode === "donor" && donorName ? (
                <Link
                  to="/donante/$nombre"
                  params={{ nombre: donorName }}
                  search={{}}
                  className={buttonClass("outline", "w-full sm:w-auto")}
                >
                  Limpiar filtros
                </Link>
              ) : (
                <Link to="/" search={extraSearch} className={buttonClass("outline", "w-full sm:w-auto")}>
                  Limpiar filtros
                </Link>
              )
            ) : null}
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {result.total === 0
              ? "Sin resultados"
              : `${formatCount(from)}–${formatCount(to)} de ${formatCount(result.total)}`}
          </p>
          {result.total > 0 ? (
            <p className="font-medium">
              {formatArs(result.ars)} · {formatUsd(result.usd)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {includeDonor && filters.donor ? (
              <Link to="/donante/$nombre" params={{ nombre: filters.donor }}>
                <Badge tone="outline">Donante: {filters.donor}</Badge>
              </Link>
            ) : null}
            {range ? (
              <Badge tone="outline">
                {formatYmd(range.from) === formatYmd(range.to)
                  ? formatYmd(range.from)
                  : `${formatYmd(range.from)} → ${formatYmd(range.to)}`}
              </Badge>
            ) : null}
          </div>
        </div>
        <a href={exportHref(filters)} className={buttonClass("outline")}>
          Descargar CSV ({formatCount(result.total)})
        </a>
      </div>

      {result.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="font-heading text-2xl">Ninguna donación coincide</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Probá otro día, sacá un filtro o limpiá todo. Al limpiar el listado vuelve a los más recientes.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 md:hidden">
            {result.rows.map((row) => (
              <li key={row.id} className="space-y-2 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to="/donante/$nombre"
                    params={{ nombre: row.nombre }}
                    className="font-medium hover:text-primary"
                  >
                    {row.nombre}
                  </Link>
                  <Amount row={row} compact />
                </div>
                <DonationMessage row={row} />
                <p className="text-xs text-muted-foreground">
                  {formatWhen(row.fecha_aprox)} · {row.fecha_relativa}
                </p>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Cuándo</th>
                  <th className="px-4 py-3 font-medium">Donante</th>
                  <th className="px-4 py-3 font-medium">Mensaje</th>
                  <th className="px-4 py-3 text-right font-medium">Pesos</th>
                  <th className="px-4 py-3 text-right font-medium">Dólares</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                    <td className="px-4 py-3 align-top whitespace-normal">
                      <p>{formatWhen(row.fecha_aprox)}</p>
                      <p className="text-xs text-muted-foreground">{row.fecha_relativa}</p>
                    </td>
                    <td className="px-4 py-3 align-top font-medium whitespace-normal">
                      <Link to="/donante/$nombre" params={{ nombre: row.nombre }} className="hover:text-primary">
                        {row.nombre}
                      </Link>
                    </td>
                    <td className="max-w-xl px-4 py-3 align-top text-sm leading-6 whitespace-normal">
                      <DonationMessage row={row} />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Amount row={row} />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Amount row={row} usd />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            filters={filters}
            page={result.page}
            pages={result.pages}
            includeDonor={includeDonor}
            donorName={donorName}
            onPage={(page) => go(filters, page)}
          />
        </>
      )}
    </section>
  );
}

function DatePanel({
  filters,
  months,
  range,
  lastDay,
  onPreset,
  onMonth,
  onDay,
  onRange,
}: {
  filters: Filters;
  months: MonthOption[];
  range: { from: number; to: number } | null;
  lastDay: string;
  onPreset: (when: string) => void;
  onMonth: (when: string) => void;
  onDay: (day: number) => void;
  onRange: (from: string, to: string) => void;
}) {
  const initial = viewMonth(filters, range, months);
  const [view, setView] = useState(initial);
  useEffect(() => {
    setView(viewMonth(filters, range, months));
  }, [filters.when, filters.from, filters.to, range?.from, range?.to, months]);
  const cells = monthGrid(view.year, view.month);
  const today = resolveDateRange({ when: "hoy", from: "", to: "" }, Date.now(), parseYmd(lastDay));

  function shift(delta: number) {
    const next = addDays(ymd(view.year, view.month, 1), delta * 32);
    setView(ymdParts(next));
  }

  return (
    <div className="rounded-2xl bg-card p-3 ring-2 ring-primary/25 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Fecha</p>
          <h3 className="mt-1 text-2xl tracking-tight">Qué día o qué rango</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            Un clic elige el día. El segundo clic cierra el rango. Los atajos y el calendario se combinan con el resto
            de filtros. Las fechas son las estimadas del archivo, en hora argentina.
          </p>
        </div>
        {range ? (
          <p className="text-sm font-medium">
            {formatYmd(range.from) === formatYmd(range.to)
              ? formatYmd(range.from)
              : `${formatYmd(range.from)} → ${formatYmd(range.to)}`}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onPreset(filters.when === preset.key ? "" : preset.key)}
            className={chipClass(filters.when === preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Mes del archivo
          <select
            value={parseYearMonth(filters.when)?.year ? filters.when : ""}
            onChange={(event) => onMonth(event.target.value)}
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
          <input
            type="date"
            name="from"
            value={range ? formatYmd(range.from) : filters.from}
            onChange={(event) => onRange(event.target.value, (range ? formatYmd(range.to) : filters.to) || event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Hasta
          <input
            type="date"
            name="to"
            value={range ? formatYmd(range.to) : filters.to}
            onChange={(event) => onRange((range ? formatYmd(range.from) : filters.from) || event.target.value, event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" className={buttonClass("ghost")} onClick={() => shift(-1)} aria-label="Mes anterior">
            ←
          </button>
          <p className="text-sm font-medium capitalize">{monthLabel(view.year, view.month)}</p>
          <button type="button" className={buttonClass("ghost")} onClick={() => shift(1)} aria-label="Mes siguiente">
            →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="py-1 font-medium">
              {label}
            </span>
          ))}
          {cells.map((day, index) => {
            if (day == null) return <span key={`e-${index}`} />;
            const value = ymd(view.year, view.month, day);
            const selected = range != null && value >= range.from && value <= range.to;
            const ends = range != null && (value === range.from || value === range.to);
            const isToday = today != null && value === today.from;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onDay(value)}
                className={[
                  "h-9 rounded-lg text-sm tabular-nums",
                  selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  ends ? "font-semibold" : "",
                  !selected && isToday ? "ring-1 ring-primary" : "",
                ].join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function viewMonth(filters: Filters, range: { from: number; to: number } | null, months: MonthOption[]) {
  const fromWhen = parseYearMonth(filters.when);
  if (fromWhen) return fromWhen;
  if (range) return ymdParts(range.to);
  const from = parseYmd(filters.from);
  if (from != null) return ymdParts(from);
  const newest = months[0]?.key;
  const parsed = newest ? parseYearMonth(newest) : null;
  if (parsed) return parsed;
  const now = ymdParts(resolveDateRange({ when: "hoy", from: "", to: "" }, Date.now())!.from);
  return { year: now.year, month: now.month };
}

function FlagChip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onToggle} className={chipClass(on)}>
      {label}
    </button>
  );
}

function chipClass(on: boolean) {
  return [
    "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium",
    on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/80",
  ].join(" ");
}

function NumberField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
  placeholder: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        name={name}
        inputMode="decimal"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  );
}

function amountFrom(value: FormDataEntryValue | null, allowZero = false) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (!allowZero && n <= 0) return null;
  return n;
}

function refundFrom(value: FormDataEntryValue | null): Filters["refunds"] {
  const raw = String(value ?? "in");
  return raw === "out" || raw === "only" ? raw : "in";
}

function currencyFrom(value: FormDataEntryValue | null): Filters["currency"] {
  const raw = String(value ?? "");
  return raw === "ars" || raw === "usd" ? raw : "";
}

function DonationMessage({ row }: { row: PageResult["rows"][number] }) {
  return (
    <div className="space-y-2">
      {row.devuelta ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="danger">Devuelta</Badge>
          {row.devolucion ? <span className="text-xs text-muted-foreground">{row.devolucion}</span> : null}
        </div>
      ) : null}
      {row.privado ? <Badge tone="outline">Mensaje privado</Badge> : <MessageText text={row.mensaje} />}
    </div>
  );
}

function Amount({
  row,
  usd,
  compact,
}: {
  row: PageResult["rows"][number];
  usd?: boolean;
  compact?: boolean;
}) {
  const value = usd ? formatUsd(row.monto_usd) : formatArs(row.monto_ars);
  return (
    <div className={compact ? "text-right" : undefined}>
      <p
        className={
          usd
            ? `text-xs tabular-nums text-muted-foreground ${row.devuelta ? "line-through" : ""}`
            : `font-heading leading-none font-medium tabular-nums ${compact ? "text-lg" : ""} ${row.devuelta ? "line-through decoration-foreground/40" : ""}`
        }
      >
        {value}
      </p>
      {compact && !usd ? (
        <p className={`mt-1 text-xs tabular-nums text-muted-foreground ${row.devuelta ? "line-through" : ""}`}>
          {formatUsd(row.monto_usd)}
        </p>
      ) : null}
    </div>
  );
}

function Pagination({
  filters,
  page,
  pages,
  includeDonor,
  donorName,
  onPage,
}: {
  filters: Filters;
  page: number;
  pages: number;
  includeDonor: boolean;
  donorName?: string;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(pages, page + 2);
  const numbers = [];
  for (let current = windowStart; current <= windowEnd; current += 1) numbers.push(current);
  const href = (n: number) =>
    filtersToSearch(filters, n, includeDonor ? "/" : donorName ? donorHref(donorName) : "/");

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Páginas">
      <a
        href={href(Math.max(1, page - 1))}
        onClick={(event) => {
          if (page === 1) return;
          event.preventDefault();
          onPage(page - 1);
        }}
        aria-disabled={page === 1}
        className={buttonClass("outline", page === 1 ? "pointer-events-none opacity-40" : "")}
      >
        Anterior
      </a>
      <div className="flex items-center gap-1">
        {windowStart > 1 ? <PageLink n={1} current={page} href={href(1)} onPage={onPage} /> : null}
        {windowStart > 2 ? <span className="px-1 text-muted-foreground">…</span> : null}
        {numbers.map((number) => (
          <PageLink key={number} n={number} current={page} href={href(number)} onPage={onPage} />
        ))}
        {windowEnd < pages - 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
        {windowEnd < pages ? <PageLink n={pages} current={page} href={href(pages)} onPage={onPage} /> : null}
      </div>
      <a
        href={href(Math.min(pages, page + 1))}
        onClick={(event) => {
          if (page === pages) return;
          event.preventDefault();
          onPage(page + 1);
        }}
        aria-disabled={page === pages}
        className={buttonClass("outline", page === pages ? "pointer-events-none opacity-40" : "")}
      >
        Siguiente
      </a>
    </nav>
  );
}

function PageLink({
  n,
  current,
  href,
  onPage,
}: {
  n: number;
  current: number;
  href: string;
  onPage: (page: number) => void;
}) {
  const active = n === current;
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        onPage(n);
      }}
      className={buttonClass(active ? "primary" : "ghost", "h-9 min-w-9 px-2 tabular-nums")}
    >
      {n}
    </a>
  );
}

export function BrowserSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
