import type { KickChannel } from "./kick";

const API = "https://kick.com/api/v2/channels/losherederosdealberdi";
const HREF = "https://kick.com/losherederosdealberdi";

const OFFLINE: KickChannel = {
  username: "losherederosdealberdi",
  followers: 0,
  verified: true,
  live: false,
  title: null,
  viewers: 0,
  category: null,
  thumbnail: null,
  avatar: null,
  href: HREF,
};

let cache: { at: number; channel: KickChannel } | null = null;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readChannel(payload: unknown): KickChannel {
  if (!payload || typeof payload !== "object") return OFFLINE;
  const data = payload as Record<string, unknown>;
  const user = data.user && typeof data.user === "object" ? (data.user as Record<string, unknown>) : {};
  const live = data.livestream && typeof data.livestream === "object" ? (data.livestream as Record<string, unknown>) : null;
  const thumb = live?.thumbnail && typeof live.thumbnail === "object" ? (live.thumbnail as Record<string, unknown>) : null;
  const categories = Array.isArray(live?.categories) ? live.categories : [];
  const first = categories[0] && typeof categories[0] === "object" ? (categories[0] as Record<string, unknown>) : null;
  const isLive = Boolean(live?.is_live);
  return {
    username: text(user.username) ?? "losherederosdealberdi",
    followers: count(data.followers_count),
    verified: Boolean(data.verified),
    live: isLive,
    title: isLive ? text(live?.session_title) : null,
    viewers: isLive ? count(live?.viewer_count) : 0,
    category: isLive ? text(first?.name) : null,
    thumbnail: isLive ? text(thumb?.url) : null,
    avatar: text(user.profile_pic),
    href: HREF,
  };
}

export async function kickPayload(): Promise<KickChannel> {
  if (cache && Date.now() - cache.at < 60_000) return cache.channel;
  try {
    const response = await fetch(API, {
      headers: { accept: "application/json", "user-agent": "HerederosArchivo/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return cache?.channel ?? OFFLINE;
    const channel = readChannel(await response.json());
    cache = { at: Date.now(), channel };
    return channel;
  } catch {
    return cache?.channel ?? OFFLINE;
  }
}
