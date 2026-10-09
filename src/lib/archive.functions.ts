import { createServerFn } from "@tanstack/react-start";
import { DRILL_KINDS, parseConcentration, parseFilters, parseScope, scopeFrom, type DrillInput, type DrillKind, type Filters } from "./archive";

export const getArchivePage = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const scope = parseScope(input);
    return {
      filters: parseFilters(input),
      scope,
      concentration: parseConcentration(input, scope),
    };
  })
  .handler(async ({ data }) => {
    const { homePayload } = await import("./donations.server");
    const { statsFor } = await import("./stats.server");
    const [page, stats] = await Promise.all([
      homePayload(data.filters, data.concentration),
      statsFor(data.scope),
    ]);
    return { ...page, stats, scope: data.scope };
  });

export const getDrill = createServerFn({ method: "GET" })
  .validator((input: unknown): DrillInput => {
    const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    const kind = DRILL_KINDS.includes(raw.kind as DrillKind) ? (raw.kind as DrillKind) : "donor";
    const page = Number(raw.page);
    return {
      kind,
      key: typeof raw.key === "string" ? raw.key.slice(0, 200) : "",
      page: Number.isFinite(page) && page > 0 ? Math.min(Math.floor(page), 10_000) : 1,
      sort: raw.sort === "mayor" ? "mayor" : "reciente",
      scope: scopeFrom(raw.scope),
    };
  })
  .handler(async ({ data }) => {
    const { drill } = await import("./stats.server");
    return drill(data);
  });

export const getKick = createServerFn({ method: "GET" }).handler(async () => {
  const { kickPayload } = await import("./kick.server");
  return kickPayload();
});

export const getPodcast = createServerFn({ method: "GET" }).handler(async () => {
  const { podcastPayload } = await import("./podcast.server");
  return podcastPayload();
});

export const getDonorPage = createServerFn({ method: "GET" })
  .validator((input: { name: string; filters: Filters }) => ({
    name: typeof input?.name === "string" ? input.name.slice(0, 200) : "",
    filters: parseFilters(input?.filters),
  }))
  .handler(async ({ data }) => {
    const { donorPayload } = await import("./donations.server");
    return donorPayload(data.name, data.filters);
  });
