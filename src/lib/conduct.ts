export type ConductKey =
  | "link"
  | "story"
  | "question"
  | "politics"
  | "greet"
  | "laugh"
  | "curse"
  | "cheer"
  | "short";

export const CONDUCT_ORDER: { key: ConductKey; label: string }[] = [
  { key: "link", label: "Trae un link" },
  { key: "story", label: "Cuenta algo" },
  { key: "question", label: "Pregunta" },
  { key: "politics", label: "Habla de política" },
  { key: "greet", label: "Saluda" },
  { key: "laugh", label: "Se ríe" },
  { key: "curse", label: "Putea" },
  { key: "cheer", label: "Alienta" },
  { key: "short", label: "Casi no escribe" },
];

const URL_RE = /https?:\/\/\S+|www\.\S+|youtu\.be\/\S+|youtube\.com\/\S+|x\.com\/\S+|twitter\.com\/\S+|tiktok\.com\/\S+|instagram\.com\/\S+/i;
const LAUGH_RE = /a?ja(ja)+|je(je)+|ji(ji)+|ajo+a|lol+|lmao|jaja|ajaj/;
const CURSE_RE =
  /\b(put[oa]|puto|puta|forro|forra|pelotud[oa]|bolud[oa]|mierda|carajo|concha|coger|cojer|orto|culiado|la concha|la puta|hijo de|hdp|forros)\b/;
const POLITICS_RE =
  /\b(milei|macri|kirchner|cristina|peron|peronismo|kuka|zurdo|zurda|libertar|libertad avanza|massa|bullrich|vidal|lali|kicillof|cfk|nestor|menem|alfonsin|uxp|juntos por|la casta)\b/;
const GREET_RE = /^(hola|buen[oa]s|buen dia|buenas tardes|buenas noches|que tal|q tal|saludos|hello|hi)\b/;
const CHEER_RE = /\b(vamos|aguante|fuerza|grande palan|te amo|te banko|a bankar|bankando|vamos palan)\b/;
const QUESTION_START = /^(que|qué|como|cómo|por que|porque|cuando|cuándo|donde|dónde|quien|quién|cual|cuál)\b/;
const YT_ID = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/gi;

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function hasLink(message: string) {
  return URL_RE.test(message);
}

export function hasLaugh(message: string) {
  return LAUGH_RE.test(fold(message));
}

export function youtubeIds(message: string): string[] {
  const ids: string[] = [];
  YT_ID.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = YT_ID.exec(message))) {
    if (match[1]) ids.push(match[1]);
  }
  return ids;
}

export function classifyMessage(message: string): ConductKey {
  const raw = message.trim();
  if (URL_RE.test(raw)) return "link";
  const folded = fold(raw.replace(URL_RE, " ").replace(/\s+/g, " ").trim());
  if (folded.length <= 2) return "short";
  if (/\?/.test(raw) || QUESTION_START.test(folded)) return "question";
  if (LAUGH_RE.test(folded)) return "laugh";
  if (CURSE_RE.test(folded)) return "curse";
  if (POLITICS_RE.test(folded)) return "politics";
  if (GREET_RE.test(folded)) return "greet";
  if (CHEER_RE.test(folded)) return "cheer";
  if (folded.split(/\s+/).filter(Boolean).length <= 2) return "short";
  return "story";
}