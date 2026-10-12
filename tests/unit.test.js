/* water-tracker-bd — Node unit tests (node:assert, no deps).
 * Run: node tests/unit.test.js */
"use strict";
const assert = require("node:assert/strict");
const L = require("../js/logic.js");

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log("  PASS " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + " :: " + e.message); }
}

/* 1. progress math */
check("progressPct 750/2000 = 38 (rounded)", () => assert.equal(L.progressPct(750, 2000), 38));
check("progressPct 250/2000 = 13 (rounded)", () => assert.equal(L.progressPct(250, 2000), 13));
check("progressPct over-goal 2500/2000 = 125", () => assert.equal(L.progressPct(2500, 2000), 125));
check("progressPct zero goal = 0", () => assert.equal(L.progressPct(500, 0), 0));
check("ringFraction clamps over-goal to 1", () => assert.equal(L.ringFraction(2500, 2000), 1));
check("ringFraction 1000/2000 = 0.5", () => assert.equal(L.ringFraction(1000, 2000), 0.5));

/* 2. streak logic — today = 2026-10-12, goal 2000 */
const T = "2026-10-12", G = 2000;
const mk = (pairs) => { const d = {}; for (const [k, t] of pairs) d[k] = { total: t, log: [] }; return d; };
check("streak: 3 goal-met days in a row -> 3", () => {
  const d = mk([["2026-10-10", 2000], ["2026-10-11", 2100], ["2026-10-12", 2500]]);
  assert.equal(L.calcStreak(d, G, T), 3);
});
check("streak: today pending, 3 met before -> 3", () => {
  const d = mk([["2026-10-09", 2000], ["2026-10-10", 2000], ["2026-10-11", 2000]]);
  assert.equal(L.calcStreak(d, G, T), 3);
});
check("streak: missed yesterday resets -> 0", () => {
  const d = mk([["2026-10-08", 2000], ["2026-10-09", 2000], ["2026-10-10", 2000], ["2026-10-11", 500], ["2026-10-12", 2000]]);
  assert.equal(L.calcStreak(d, G, T), 1); /* only today counts; yesterday broke the chain */
});
check("streak: yesterday missed, today pending -> 0", () => {
  const d = mk([["2026-10-10", 2000], ["2026-10-11", 100]]);
  assert.equal(L.calcStreak(d, G, T), 0);
});
check("streak: empty history -> 0", () => assert.equal(L.calcStreak({}, G, T), 0));
check("streak: exactly goal counts as met", () => {
  const d = mk([["2026-10-12", 2000]]);
  assert.equal(L.calcStreak(d, G, T), 1);
});

/* 3. history aggregation */
check("last7 returns 7 entries ending today, gaps = 0", () => {
  const d = mk([["2026-10-12", 750], ["2026-10-10", 500]]);
  const h = L.last7(d, T);
  assert.equal(h.length, 7);
  assert.equal(h[6].iso, "2026-10-12"); assert.equal(h[6].total, 750);
  assert.equal(h[5].iso, "2026-10-11"); assert.equal(h[5].total, 0);
  assert.equal(h[4].iso, "2026-10-10"); assert.equal(h[4].total, 500);
  assert.equal(h[0].iso, "2026-10-06");
});
check("shiftISO crosses month boundary", () => assert.equal(L.shiftISO("2026-10-01", -1), "2026-09-30"));

/* 4. validation */
check("validateAmount accepts 250 / '500' / bn digits '২৫০'", () => {
  assert.deepEqual(L.validateAmount(250), { ok: true, value: 250 });
  assert.deepEqual(L.validateAmount("500"), { ok: true, value: 500 });
  assert.deepEqual(L.validateAmount("২৫০"), { ok: true, value: 250 });
});
check("validateAmount rejects 0, -5, 'abc', 2001, 2.5", () => {
  for (const v of [0, -5, "abc", "", 2001, 2.5, "12x"]) assert.equal(L.validateAmount(v).ok, false, String(v));
});
check("validateGoal accepts 2000, rejects 100 / 20000 / 'x'", () => {
  assert.deepEqual(L.validateGoal("2000"), { ok: true, value: 2000 });
  for (const v of [100, 20000, "x", 0]) assert.equal(L.validateGoal(v).ok, false, String(v));
});

/* 5. add/remove drink */
check("addDrink accumulates total and log entries", () => {
  const d = {};
  L.addDrink(d, T, 250); L.addDrink(d, T, 500);
  assert.equal(L.dayTotal(d, T), 750);
  assert.equal(d[T].log.length, 2);
});
check("removeDrink subtracts and returns true; bad index false", () => {
  const d = {}; L.addDrink(d, T, 250); L.addDrink(d, T, 500);
  assert.equal(L.removeDrink(d, T, 0), true);
  assert.equal(L.dayTotal(d, T), 500);
  assert.equal(L.removeDrink(d, T, 9), false);
});

/* 6. Bengali digits */
check("toBnDigits converts 0-9", () => assert.equal(L.toBnDigits("0123456789"), "০১২৩৪৫৬৭৮৯"));
check("fmtNum bn/en", () => {
  assert.equal(L.fmtNum(1050, "bn"), "১০৫০");
  assert.equal(L.fmtNum(1050, "en"), "1050");
});
check("weekdayLabel 2026-10-12 (Mon) en/bn", () => {
  assert.equal(L.weekdayLabel("2026-10-12", "en"), "Mon");
  assert.equal(L.weekdayLabel("2026-10-12", "bn"), "সোম");
});

/* 7. export / import */
check("export/import round-trip preserves goal and totals", () => {
  const d = {}; L.addDrink(d, "2026-10-11", 2000); L.addDrink(d, T, 750);
  const txt = JSON.stringify(L.buildExport(2500, d));
  const res = L.parseImport(txt);
  assert.equal(res.ok, true);
  assert.equal(res.data.goalMl, 2500);
  assert.equal(L.dayTotal(res.data.days, T), 750);
  assert.equal(L.dayTotal(res.data.days, "2026-10-11"), 2000);
});
check("parseImport rejects garbage / wrong app / bad goal", () => {
  assert.equal(L.parseImport("not json").ok, false);
  assert.equal(L.parseImport(JSON.stringify({ app: "other", version: 1, goalMl: 2000, days: {} })).ok, false);
  assert.equal(L.parseImport(JSON.stringify({ app: "water-tracker-bd", version: 1, goalMl: 50, days: {} })).ok, false);
  assert.equal(L.parseImport(JSON.stringify({ app: "water-tracker-bd", version: 1, goalMl: 2000, days: { "xx": { total: 5 } } })).ok, false);
});

console.log(`\nunit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
