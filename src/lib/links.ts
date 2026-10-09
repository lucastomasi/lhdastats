/** Links inside donation messages, grouped by site. Shared by server stats and the UI. */

const LINK_RE = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi;

/** Hosts that are the same site for a reader of the chat. */
const SAME_SITE: Record<string, string> = {
  "youtu.be": "youtube.com",
  "music.youtube.com": "youtube.com",
  "m.youtube.com": "youtube.com",
  "twitter.com": "x.com",
  "mobile.twitter.com": "x.com",
  "pbs.twimg.com": "x.com",
  "t.co": "x.com",
  "fxtwitter.com": "x.com",
  "vxtwitter.com": "x.com",
  "fixupx.com": "x.com",
  "vt.tiktok.com": "tiktok.com",
  "vm.tiktok.com": "tiktok.com",
  "i.redd.it": "reddit.com",
  "v.redd.it": "reddit.com",
  "instagr.am": "instagram.com",
  "fb.watch": "facebook.com",
  "open.spotify.com": "spotify.com",
  "clips.twitch.tv": "twitch.tv",
  "cdn.discordapp.com": "discord.com",
  "media.discordapp.net": "discord.com",
  "discord.gg": "discord.com",
};

const SECOND_LEVEL = new Set(["com", "net", "org", "gob", "gov", "edu", "co", "mil", "tur", "int"]);

export const DOMAIN_LABELS: Record<string, string> = {
  "youtube.com": "YouTube",
  "x.com": "X / Twitter",
  "instagram.com": "Instagram",
  "tiktok.com": "TikTok",
  "facebook.com": "Facebook",
  "reddit.com": "Reddit",
  "kick.com": "Kick",
  "twitch.tv": "Twitch",
  "spotify.com": "Spotify",
  "discord.com": "Discord",
  "imgur.com": "Imgur",
  "tinyurl.com": "TinyURL",
  "google.com": "Google",
};

export function domainLabel(key: string) {
  return DOMAIN_LABELS[key] ?? key;
}

function trimUrl(raw: string) {
  let url = raw;
  while (url.length > 0 && /[),.;!?\]]$/.test(url)) url = url.slice(0, -1);
  return url;
}

export function siteOf(url: string): string | null {
  const host = url
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/, 1)[0]
    ?.split("@")
    .pop()
    ?.split(":", 1)[0]
    ?.toLowerCase()
    .replace(/\.$/, "");
  if (!host || !host.includes(".")) return null;
  const clean = host.replace(/^(www\d*|m|mobile)\./, "");
  if (SAME_SITE[clean]) return SAME_SITE[clean];
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const keep = tld.length === 2 && SECOND_LEVEL.has(sld) ? 3 : 2;
  const base = parts.slice(-keep).join(".");
  return SAME_SITE[base] ?? base;
}

/** Every link in a message with its grouped site. */
export function messageLinks(message: string): { url: string; site: string }[] {
  if (!message) return [];
  const out: { url: string; site: string }[] = [];
  for (const match of message.matchAll(LINK_RE)) {
    const url = trimUrl(match[0]);
    const site = siteOf(url);
    if (site) out.push({ url, site });
  }
  return out;
}
