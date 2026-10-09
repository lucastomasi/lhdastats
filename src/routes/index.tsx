import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { ArchiveDetails, KickBanner, LedgerBoards, PodcastShelf, RefundNote, SiteFooter } from "@/components/archive-view";
import { ConcentrationBoard } from "@/components/concentration-board";
import { BrowserSkeleton, DonationBrowser } from "@/components/donation-browser";
import {
  BracketsSection,
  ConductSection,
  FindingsSection,
  LinksSection,
  MentionsSection,
  PeriodSection,
  RankingSection,
  ScopeBar,
  ScopedSummary,
  WordsSection,
} from "@/components/stats-view";
import {
  concentrationToSearch,
  EMPTY_SEARCH,
  filtersToListSearch,
  parseListSearch,
  scopeToSearch,
  type ListSearch,
} from "@/lib/archive";
import { getArchivePage, getKick, getPodcast } from "@/lib/archive.functions";
import { formatCount, formatScraped } from "@/lib/format";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): ListSearch => parseListSearch(search),
  search: {
    middlewares: [stripSearchParams<ListSearch>(EMPTY_SEARCH)],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [page, podcast, kick] = await Promise.all([getArchivePage({ data: deps }), getPodcast(), getKick()]);
    return { ...page, podcast, kick };
  },
  pendingComponent: HomePending,
  pendingMs: 180,
  component: Home,
});

const NAV = [
  ["concentracion", "Concentración"],
  ["hallazgos", "Hallazgos"],
  ["conducta", "Conducta"],
  ["tiempo", "Período"],
  ["ranking", "Ranking"],
  ["lenguaje", "Palabras"],
  ["youtube", "YouTube y links"],
  ["menciones", "Menciones"],
  ["tamano", "Tamaño"],
  ["podcast", "En vivo"],
  ["cuentas", "Cuentas"],
  ["archivo", "Buscador"],
] as const;

function Home() {
  const { meta, result, filters, podcast, kick, months, donors, sites, lastDay, concentration, stats, scope } =
    Route.useLoaderData();
  const search = Route.useSearch();
  const scopeSearch = scopeToSearch(scope);
  const keepForBrowser: ListSearch = { ...concentrationToSearch(concentration.params, scope), ...scopeSearch };
  const baseForConcentration: ListSearch = { ...filtersToListSearch(filters), ...scopeSearch };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/80 bg-card/70">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Ceneka · minería del archivo</p>
          <h1 className="mt-3 max-w-3xl text-4xl tracking-tight text-balance sm:text-5xl md:text-6xl">
            Los Herederos de Alberdi
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            {formatCount(meta.count)} donaciones públicas, bajadas el {formatScraped(meta.scrapedAt)} y leídas como
            datos: quién concentra, quién vuelve, qué se escribe. Cada número se abre y muestra los aportes que lo
            forman. Dos aportes se devolvieron —pesos confundidos con dólares— y no entran en los totales.
          </p>
          <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium" aria-label="Secciones">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-primary underline-offset-2 hover:underline">
                {label}
              </a>
            ))}
          </nav>
          <KickBanner kick={kick} />
        </div>
      </header>
      <ScopeBar stats={stats} months={months} search={search} />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-12 px-4 py-8 md:py-10">
        <ScopedSummary stats={stats} />
        <ConcentrationBoard
          report={concentration}
          scope={scope}
          baseSearch={baseForConcentration}
          months={months}
          lastDay={lastDay}
        />
        <FindingsSection stats={stats} />
        <ConductSection stats={stats} />
        <PeriodSection stats={stats} />
        <RankingSection stats={stats} />
        <WordsSection stats={stats} />
        <LinksSection stats={stats} />
        <MentionsSection stats={stats} />
        <BracketsSection stats={stats} />
        <RefundNote meta={meta} />
        <PodcastShelf videos={podcast} kick={kick} />
        <LedgerBoards />
        <div id="archivo" className="scroll-mt-16 space-y-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Archivo</p>
            <h2 className="text-3xl tracking-tight">Buscar donación por donación</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Empezá por la fecha: un día, un rango o un mes. Después combiná texto, donante, monto, conducta, sitio
              del link y devoluciones. Todo queda en la URL para compartir. El CSV baja exactamente lo que el filtro
              deja. El orden por defecto es más recientes.
            </p>
          </div>
          <DonationBrowser
            filters={filters}
            result={result}
            mode="home"
            months={months}
            donors={donors}
            sites={sites}
            lastDay={lastDay}
            extraSearch={keepForBrowser}
          />
        </div>
        <ArchiveDetails meta={meta} />
      </main>
      <SiteFooter source={meta.source} />
    </div>
  );
}

function HomePending() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-12 w-full max-w-xl animate-pulse rounded bg-muted" />
      <div className="mt-8">
        <BrowserSkeleton />
      </div>
    </main>
  );
}
