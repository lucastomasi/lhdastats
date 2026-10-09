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
import {
  concentrationBandSearch,
  concentrationToSearch,
  DEFAULT_CONCENTRATION,
  filtersToListSearch,
  parseConcentration,
  parseFilters,
  parseListSearch,
  toFilters,
} from "./archive.ts";

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

test("parseFilters keeps Filters-shaped loader input", () => {
  const first = parseFilters({ min: 5000, has: "yt", dev: "only", cur: "usd" });
  const again = parseFilters(first);
  assert.equal(again.minArs, 5000);
  assert.equal(again.hasYoutube, true);
  assert.equal(again.refunds, "only");
  assert.equal(again.currency, "usd");
  assert.equal(again.sort, "reciente");
});

test("concentration params default and stay in the URL only when changed", () => {
  const defaults = parseConcentration({});
  assert.deepEqual(defaults, DEFAULT_CONCENTRATION);
  assert.deepEqual(concentrationToSearch(defaults), {});
  const custom = parseConcentration({
    cut: "40, 90",
    tips: "100,250",
    upto: 150,
    over: 8000,
    reps: "15",
    cwhen: "2026-09",
    ccur: "usd",
    cdev: "in",
  });
  assert.deepEqual(custom.cuts, [40, 90]);
  assert.deepEqual(custom.typical, [100, 250]);
  assert.equal(custom.under, 150);
  assert.equal(custom.over, 8000);
  assert.equal(custom.reps, 15);
  assert.equal(custom.when, "2026-09");
  assert.equal(custom.cur, "usd");
  assert.equal(custom.refunds, "in");
  const search = concentrationToSearch(custom);
  assert.equal(search.cut, "40,90");
  assert.equal(search.tips, "100,250");
  assert.equal(search.upto, 150);
  assert.equal(search.ccur, "usd");
  assert.equal(search.cdev, "in");
  assert.equal(search.cwhen, "2026-09");
  const under = concentrationBandSearch(custom, "under");
  const over = concentrationBandSearch(custom, "over");
  assert.equal(under.maxusd, 150);
  assert.equal(under.sort, undefined);
  assert.equal(under.when, "2026-09");
  assert.equal(under.q, undefined);
  assert.equal(under.cut, "40,90");
  assert.equal(over.minusd, 8000);
  assert.equal(over.sort, "mayor");
});
test("concentration follows the global scope unless it is overridden", async () => {
  const { parseScope, scopeToSearch } = await import("./archive.ts");
  const scope = parseScope({ sw: "2026-09", scur: "usd" });
  assert.deepEqual(scopeToSearch(scope), { sw: "2026-09", scur: "usd" });

  const inherited = parseConcentration({}, scope);
  assert.equal(inherited.when, "2026-09");
  assert.equal(inherited.cur, "usd");
  assert.deepEqual(concentrationToSearch(inherited, scope), {});

  const own = parseConcentration({ cfrom: "2026-10-01", cto: "2026-10-05", ccur: "ars" }, scope);
  assert.equal(own.when, "");
  assert.equal(own.from, "2026-10-01");
  assert.deepEqual(concentrationToSearch(own, scope), { cfrom: "2026-10-01", cto: "2026-10-05", ccur: "ars" });

  const cleared = { ...inherited, when: "", from: "", to: "" };
  assert.deepEqual(concentrationToSearch(cleared, scope), { cwhen: "todo" });
  const reparsed = parseConcentration({ cwhen: "todo" }, scope);
  assert.equal(resolveDateRange(reparsed, Date.now()), null);
});

test("domain and video filters round-trip through the URL", async () => {
  const filters = parseFilters({ dom: "instagram.com", yt: "dQw4w9WgXcQ" });
  assert.equal(filters.domain, "instagram.com");
  assert.equal(filters.video, "dQw4w9WgXcQ");
  const search = filtersToListSearch(filters);
  assert.equal(search.dom, "instagram.com");
  assert.equal(search.yt, "dQw4w9WgXcQ");
});

test("message links are grouped by site", async () => {
  const { messageLinks } = await import("./links.ts");
  const links = messageLinks("mirá https://youtu.be/dQw4w9WgXcQ y https://www.instagram.com/p/abc y https://twitter.com/x/status/1");
  assert.deepEqual(
    links.map((link) => link.site),
    ["youtube.com", "instagram.com", "x.com"],
  );
});
