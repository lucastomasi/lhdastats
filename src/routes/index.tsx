import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { ArchiveDetails, ArchiveSummary, KickBanner, LedgerBoards, MiningReport, PeriodChart, PodcastShelf, RefundNote, SiteFooter, WordCloud } from "@/components/archive-view";
import { BrowserSkeleton, DonationBrowser } from "@/components/donation-browser";
import { EMPTY_SEARCH, parseListSearch, toFilters, type ListSearch } from "@/lib/archive";
import { getArchivePage, getKick, getPodcast } from "@/lib/archive.functions";
import { formatCount, formatScraped } from "@/lib/format";

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
            datos: quién concentra, quién vuelve, qué se escribe. Dos aportes se devolvieron —pesos confundidos con
            dólares— y no entran en los totales.
          </p>
          <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium">
            <a href="#hallazgos" className="text-primary underline-offset-2 hover:underline">
              Hallazgos
            </a>
            <a href="#tiempo" className="text-primary underline-offset-2 hover:underline">
              Cuándo
            </a>
            <a href="#lenguaje" className="text-primary underline-offset-2 hover:underline">
              Lenguaje
            </a>
            <a href="#podcast" className="text-primary underline-offset-2 hover:underline">
              En vivo
            </a>
            <a href="#cuentas" className="text-primary underline-offset-2 hover:underline">
              Cuentas
            </a>
            <a href="#archivo" className="text-primary underline-offset-2 hover:underline">
              Archivo
            </a>
          </nav>
          <KickBanner kick={kick} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 md:py-10">
        <ArchiveSummary meta={meta} />
        <MiningReport meta={meta} />
        <RefundNote meta={meta} />
        <div id="tiempo">
          <PeriodChart meta={meta} />
        </div>
        <div id="lenguaje">
          <WordCloud meta={meta} />
        </div>
        <PodcastShelf videos={podcast} kick={kick} />
        <LedgerBoards />
        <div id="archivo" className="scroll-mt-6 space-y-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Archivo</p>
            <h2 className="text-3xl tracking-tight">Buscar donación por donación</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Nombre o mensaje, monto mínimo y orden. El CSV baja exactamente lo que el filtro deja.
            </p>
          </div>
          <DonationBrowser filters={filters} result={result} mode="home" />
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
