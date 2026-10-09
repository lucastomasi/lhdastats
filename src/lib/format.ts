const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

function group(value: number, digits: number) {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(digits);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = digits === 0 ? grouped : `${grouped},${frac}`;
  return negative ? `-${body}` : body;
}

function moneyDigits(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return { rounded, digits: Number.isInteger(rounded) ? 0 : 2 };
}

export function formatArs(value: number) {
  const { rounded, digits } = moneyDigits(value);
  return `$ ${group(rounded, digits)}`;
}

export function formatUsd(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return `US$ ${group(rounded, 2)}`;
}

export function formatCount(value: number) {
  return group(Math.round(value), 0);
}

export function formatPct(share: number) {
  const pct = Math.round(share * 1000) / 10;
  const digits = Number.isInteger(pct) ? 0 : 1;
  return `${group(pct, digits)}%`;
}

export function formatTimes(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const digits = Number.isInteger(rounded) ? 0 : 1;
  return `${group(rounded, digits)}×`;
}

function artParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() - ART_OFFSET_MS);
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
    hours: String(shifted.getUTCHours()).padStart(2, "0"),
    minutes: String(shifted.getUTCMinutes()).padStart(2, "0"),
  };
}

export function formatWhen(iso: string | null) {
  if (!iso) return "Sin fecha estimada";
  const parts = artParts(iso);
  if (!parts) return "Sin fecha estimada";
  return `${parts.day} ${MONTHS[parts.month]} ${parts.year}, ${parts.hours}:${parts.minutes}`;
}

export function formatScraped(iso: string) {
  const parts = artParts(iso);
  if (!parts) return iso;
  return `${parts.day} de ${MONTHS_LONG[parts.month]} de ${parts.year}`;
}
