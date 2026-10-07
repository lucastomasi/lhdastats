import type { PodcastVideo } from "./podcast";

const FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCV1WCVexFXNTq_t5Z4xgGNw";

const FALLBACK: PodcastVideo[] = [
  {
    id: "YGkNkh-7pBg",
    title: "LA DESPEDIDA DE MESSI, LOS DRONES DE SANCOR Y EL DESASTRE DE LA AFA",
    published: "2026-10-07T13:56:24+00:00",
    views: 1933,
    href: "https://www.youtube.com/watch?v=YGkNkh-7pBg",
  },
  {
    id: "xK52YaI-yBk",
    title: "LA PALABRA DE CAPUTO, CONFERENCIA DE RAVIER Y REPERCUSIONES DE BRASIL",
    published: "2026-10-06T20:52:08+00:00",
    views: 33022,
    href: "https://www.youtube.com/watch?v=xK52YaI-yBk",
  },
  {
    id: "pOGXF4mnId8",
    title: "DDL T4 #37 | EL MATRIMONIO, EL ABORTO, EL CONFINAMIENTO Y LAS ELECCIONES EN BRASIL",
    published: "2026-10-05T23:51:05+00:00",
    views: 0,
    href: "https://www.youtube.com/watch?v=pOGXF4mnId8",
  },
];

let cache: { at: number; videos: PodcastVideo[] } | null = null;

function decode(value: string) {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'");
}

function parseFeed(xml: string): PodcastVideo[] {
  const videos: PodcastVideo[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = decode(entry.match(/<media:title>([^<]*)<\/media:title>/)?.[1] ?? "").trim();
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? "";
    const views = Number(entry.match(/views="(\d+)"/)?.[1] ?? 0);
    if (!id || !title) continue;
    videos.push({
      id,
      title,
      published,
      views: Number.isFinite(views) ? views : 0,
      href: `https://www.youtube.com/watch?v=${id}`,
    });
    if (videos.length === 4) break;
  }
  return videos;
}

export async function podcastPayload(): Promise<PodcastVideo[]> {
  if (cache && Date.now() - cache.at < 30 * 60 * 1000) return cache.videos;
  try {
    const response = await fetch(FEED, {
      headers: { accept: "application/atom+xml", "user-agent": "HerederosArchivo/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return cache?.videos ?? FALLBACK;
    const videos = parseFeed(await response.text());
    if (videos.length === 0) return cache?.videos ?? FALLBACK;
    cache = { at: Date.now(), videos };
    return videos;
  } catch {
    return cache?.videos ?? FALLBACK;
  }
}
