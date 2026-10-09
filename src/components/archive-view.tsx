import { Link } from "@tanstack/react-router";
import { Badge, Card } from "@/components/ui";
import type { ArchiveMeta } from "@/lib/archive";
import { DISCORD_HREF, KICK_GIFTS, POINT_BOARD } from "@/lib/chat-board";
import { formatArs, formatCount, formatScraped, formatUsd } from "@/lib/format";
import type { KickChannel } from "@/lib/kick";
import type { PodcastVideo } from "@/lib/podcast";

export function RefundNote({ meta }: { meta: ArchiveMeta }) {
  if (meta.refundedCount === 0) return null;
  return (
    <Card>
      <header className="space-y-1 px-5 pt-5">
        <h2 className="text-xl tracking-tight">Devoluciones descontadas</h2>
        <p className="text-sm leading-6 text-muted-foreground">{meta.refundNote}</p>
      </header>
      <div className="space-y-4 px-5 py-5">
        <p className="text-sm text-muted-foreground">
          {formatCount(meta.refundedCount)} aportes · {formatArs(meta.refundedArs)} · {formatUsd(meta.refundedUsd)}.
          Siguen en el listado de Ceneka, con la etiqueta «Devuelta», y no entran en totales ni rankings.
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {meta.refunds.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/donante/$nombre"
                    params={{ nombre: row.nombre }}
                    className="font-medium hover:text-primary"
                  >
                    {row.nombre}
                  </Link>
                  <Badge tone="danger">Devuelta</Badge>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.devolucion}</p>
              </div>
              <div className="shrink-0 sm:text-right">
                <p className="font-heading text-lg leading-none line-through decoration-foreground/40">
                  {formatArs(row.monto_ars)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground line-through">{formatUsd(row.monto_usd)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function ArchiveDetails({ meta }: { meta: ArchiveMeta }) {
  return (
    <section className="space-y-6">
      <Card>
        <header className="space-y-1 px-5 pt-5">
          <h2 className="text-xl tracking-tight">Cómo leer las fechas</h2>
          <p className="text-sm text-muted-foreground">Descarga del {formatScraped(meta.scrapedAt)}.</p>
        </header>
        <div className="space-y-3 px-5 py-5 text-sm leading-6 text-muted-foreground">
          <p>
            Ceneka no publica la fecha exacta. Devuelve textos como «Hace 5 horas» o «Hace 8 meses». La fecha estimada
            de cada fila sale de ese texto en el momento de la descarga: un mes cuenta como 30 días y un año como 365.
          </p>
          <p>
            El propio canal lo llama «superchats devaluados en pesos» y manda a esta descarga. Dos aportes de alrededor
            de 450 mil y 500 mil pesos se devolvieron: eran unos 300 dólares donados por error, no 300 pesos. Ceneka no
            los borra; acá no entran en los totales.
          </p>
          <p>
            Fuente:{" "}
            <a
              href={meta.source}
              className="font-medium text-primary underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {meta.source.replace("https://", "")}
            </a>
          </p>
        </div>
      </Card>
    </section>
  );
}

function RankTable({
  title,
  text,
  unit,
  rows,
}: {
  title: string;
  text: string;
  unit: string;
  rows: { name: string; value: number; archiveName: string | null; note?: string }[];
}) {
  return (
    <Card>
      <header className="space-y-1 px-5 pt-5 pb-3">
        <h2 className="text-xl tracking-tight">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{text}</p>
      </header>
      <ol>
        {rows.map((row, index) => {
          const body = (
            <>
              <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.name}</span>
                {row.note ? (
                  <span className="block truncate text-xs text-muted-foreground">{row.note}</span>
                ) : (
                  <span className="block truncate text-xs text-muted-foreground">
                    {row.archiveName ? "Tiene ficha en el archivo" : "No está en la descarga"}
                  </span>
                )}
              </span>
              <span className="text-right text-sm font-medium tabular-nums">
                {formatCount(row.value)}
                <span className="block text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
            </>
          );
          return (
            <li key={row.name} className="border-t border-border/80">
              {row.archiveName ? (
                <Link
                  to="/donante/$nombre"
                  params={{ nombre: row.archiveName }}
                  className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-muted/70"
                >
                  {body}
                </Link>
              ) : (
                <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function LedgerBoards() {
  return (
    <section id="cuentas" className="scroll-mt-6 space-y-4">
      <div className="max-w-2xl space-y-2">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Otras cuentas</p>
        <h2 className="text-3xl tracking-tight">No se mezclan con los pesos</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          El chat publica dos rankings aparte. Los palancoins son los puntos de Streamlabs. En Kick, el número es de
          suscripciones regaladas. Ninguno entra en los totales de Ceneka.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RankTable
          title="Palancoins"
          text="Streamlabs los muestra como «principales por puntos». De estos diez, cuatro tienen ficha."
          unit="palancoins"
          rows={POINT_BOARD.map((row) => ({
            name: row.name,
            value: row.points,
            archiveName: row.archiveName,
            note: row.note,
          }))}
        />
        <RankTable
          title="Regalos en Kick"
          text="Suscripciones regaladas en el canal. raffsody es soylucastomasi."
          unit="regalos"
          rows={KICK_GIFTS.map((row) => ({
            name: row.name,
            value: row.gifts,
            archiveName: row.archiveName,
            note: row.note,
          }))}
        />
      </div>
    </section>
  );
}

export function KickBanner({ kick }: { kick: KickChannel }) {
  if (!kick.live) return null;
  return (
    <a
      href={kick.href}
      target="_blank"
      rel="noreferrer"
      className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm hover:bg-muted/60"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
      </span>
      <span className="min-w-0">
        <span className="font-medium">En vivo en Kick</span>
        <span className="text-muted-foreground">
          {" "}
          · {kick.title ?? kick.username}
          {kick.viewers > 0 ? ` · ${formatCount(kick.viewers)} mirando` : ""}
        </span>
      </span>
    </a>
  );
}

export function PodcastShelf({ videos, kick }: { videos: PodcastVideo[]; kick: KickChannel }) {
  return (
    <section id="podcast" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Canales</p>
          <h2 className="text-3xl tracking-tight">Dónde están en el aire</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            El stream en{" "}
            <a href={kick.href} className="font-medium text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
              kick.com/{kick.username}
            </a>{" "}
            y los programas en{" "}
            <a
              href="https://www.youtube.com/@lhdapodcast"
              className="font-medium text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              youtube.com/@lhdapodcast
            </a>
            . La comunidad está en{" "}
            <a href={DISCORD_HREF} className="font-medium text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
              Discord
            </a>
            .
          </p>
        </div>
      </div>
      <a
        href={kick.href}
        target="_blank"
        rel="noreferrer"
        className="grid overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-muted/50 sm:grid-cols-[16rem_1fr]"
      >
        {kick.thumbnail ? (
          <img src={kick.thumbnail} alt="" width={640} height={360} className="aspect-video w-full bg-muted object-cover" />
        ) : (
          <span className="flex aspect-video items-center justify-center bg-muted text-sm text-muted-foreground">Kick</span>
        )}
        <span className="flex flex-col justify-center gap-2 px-5 py-4">
          <span className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
            {kick.live ? (
              <span className="text-destructive">En vivo</span>
            ) : (
              <span className="text-muted-foreground">Fuera de línea</span>
            )}
            {kick.category ? <span className="text-muted-foreground">{kick.category}</span> : null}
          </span>
          <span className="text-lg leading-6 font-medium tracking-tight">
            {kick.live ? (kick.title ?? "Están en vivo") : "Los Herederos de Alberdi"}
          </span>
          <span className="text-sm text-muted-foreground">
            kick.com/{kick.username}
            {kick.followers > 0 ? ` · ${formatCount(kick.followers)} seguidores` : ""}
            {kick.live && kick.viewers > 0 ? ` · ${formatCount(kick.viewers)} mirando` : ""}
          </span>
        </span>
      </a>
      {videos.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {videos.map((video) => (
            <li key={video.id}>
              <a
                href={video.href}
                target="_blank"
                rel="noreferrer"
                className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-muted/50"
              >
                <img
                  src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                  alt=""
                  width={480}
                  height={360}
                  className="aspect-video w-full bg-muted object-cover"
                />
                <span className="flex flex-1 flex-col gap-1 px-4 py-3">
                  <span className="line-clamp-2 text-sm leading-5 font-medium">{video.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatScraped(video.published)}
                    {video.views > 0 ? ` · ${formatCount(video.views)} vistas` : ""}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function SiteFooter({ source }: { source: string }) {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Archivo público de Los Herederos de Alberdi.</p>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={DISCORD_HREF}
            className="font-medium text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Discord
          </a>
          <a
            href="https://kick.com/losherederosdealberdi"
            className="font-medium text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            kick.com/losherederosdealberdi
          </a>
          <a
            href="https://www.youtube.com/@lhdapodcast"
            className="font-medium text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            youtube.com/@lhdapodcast
          </a>
          <a href={source} className="font-medium text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
            {source.replace("https://", "")}
          </a>
        </span>
      </div>
    </footer>
  );
}
