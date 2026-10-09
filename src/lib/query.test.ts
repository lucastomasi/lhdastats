import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  artYmdFromMs,
  formatYmd,
  matchText,
  mondayOf,
  parseTextQuery,
  parseYmd,
  resolveDateRange,
  ymd,
} from "./query.ts";
import { filtersToListSearch, parseFilters, parseListSearch, toFilters } from "./archive.ts";

test("fold-insensitive query matches phrases and exclusions", () => {
  const query = parseTextQuery('  "te amo" palán -kuka  ');
  assert.equal(query.active, true);
  assert.deepEqual(query.phrases, ["te amo"]);
  assert.deepEqual(query.terms, ["palan"]);
  assert.deepEqual(query.exclude, ["kuka"]);
  assert.equal(matchText("palan te amo al canal", query), true);
  assert.equal(matchText("palan te amo kuka", query), false);
  assert.equal(matchText("solo palan", query), false);
});

test("date presets use Argentina civil days", () => {
  const now = Date.UTC(2026, 9, 8, 15, 0, 0); // 12:00 ART on 8 Oct
  assert.equal(formatYmd(artYmdFromMs(now)), "2026-10-08");
  const hoy = resolveDateRange({ when: "hoy", from: "", to: "" }, now);
  assert.deepEqual(hoy, { from: ymd(2026, 10, 8), to: ymd(2026, 10, 8) });
  const ayer = resolveDateRange({ when: "ayer", from: "", to: "" }, now);
  assert.deepEqual(ayer, { from: ymd(2026, 10, 7), to: ymd(2026, 10, 7) });
  const semana = resolveDateRange({ when: "semana", from: "", to: "" }, now);
  assert.equal(formatYmd(mondayOf(ymd(2026, 10, 8))), "2026-10-05");
  assert.deepEqual(semana, { from: ymd(2026, 10, 5), to: ymd(2026, 10, 11) });
  const mes = resolveDateRange({ when: "mes", from: "", to: "" }, now);
  assert.deepEqual(mes, { from: ymd(2026, 10, 1), to: ymd(2026, 10, 31) });
  const sept = resolveDateRange({ when: "2026-09", from: "", to: "" }, now);
  assert.deepEqual(sept, { from: ymd(2026, 9, 1), to: ymd(2026, 9, 30) });
  const last = resolveDateRange({ when: "ultimo", from: "", to: "" }, now, parseYmd("2026-10-06"));
  assert.deepEqual(last, { from: ymd(2026, 10, 6), to: ymd(2026, 10, 6) });
  const range = resolveDateRange({ when: "", from: "2026-02-10", to: "2026-02-01" }, now);
  assert.deepEqual(range, { from: ymd(2026, 2, 1), to: ymd(2026, 2, 10) });
  assert.equal(addDays(ymd(2026, 2, 28), 1), ymd(2026, 3, 1));
});

test("URL search keeps default sort as recientes and omits it", () => {
  const parsed = parseListSearch({ q: "Messi", when: "mes", sort: "reciente", min: "1000" });
  const filters = toFilters(parsed);
  assert.equal(filters.sort, "reciente");
  assert.equal(filters.when, "mes");
  assert.equal(filters.minArs, 1000);
  const search = filtersToListSearch(filters);
  assert.equal(search.sort, undefined);
  assert.equal(search.when, "mes");
  assert.equal(search.min, 1000);
  const cleared = parseFilters({});
  assert.equal(cleared.sort, "reciente");
  assert.equal(cleared.when, "");
  assert.equal(cleared.q, "");
});