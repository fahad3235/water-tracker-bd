/* water-tracker-bd — pure logic (no DOM). Shared by the browser app and Node unit tests. */
"use strict";

/* ---------- constants ---------- */
var BN_DIGITS = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
var MAX_CUSTOM_ML = 2000;
var MIN_GOAL_ML = 500;
var MAX_GOAL_ML = 10000;
var DEFAULT_GOAL_ML = 2000;
var EXPORT_VERSION = 1;

/* ---------- numbers ---------- */
function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
}
function fmtNum(n, lang) {
  var s = String(n);
  return lang === "bn" ? toBnDigits(s) : s;
}
/* percent of goal, rounded to whole number for display */
function progressPct(totalMl, goalMl) {
  if (!goalMl || goalMl <= 0) return 0;
  return Math.round((totalMl / goalMl) * 100);
}
/* ring fill fraction, clamped to [0,1] so over-goal doesn't overflow the SVG ring */
function ringFraction(totalMl, goalMl) {
  if (!goalMl || goalMl <= 0) return 0;
  return Math.min(1, Math.max(0, totalMl / goalMl));
}

/* ---------- dates (YYYY-MM-DD, UTC arithmetic to avoid DST drift) ---------- */
function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}
function shiftISO(iso, days) {
  var t = Date.parse(iso + "T00:00:00Z") + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
function weekdayIndex(iso) { /* 0=Sun..6=Sat */
  return new Date(Date.parse(iso + "T00:00:00Z")).getUTCDay();
}

/* ---------- validation ---------- */
function parseWhole(v) {
  if (typeof v === "number") return Number.isInteger(v) ? v : null;
  if (typeof v !== "string") return null;
  var t = v.trim().replace(/[০-৯]/g, function (d) { return String(BN_DIGITS.indexOf(d)); });
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}
function validateAmount(v) {
  var n = parseWhole(v);
  if (n === null || n < 1 || n > MAX_CUSTOM_ML) return { ok: false, value: null };
  return { ok: true, value: n };
}
function validateGoal(v) {
  var n = parseWhole(v);
  if (n === null || n < MIN_GOAL_ML || n > MAX_GOAL_ML) return { ok: false, value: null };
  return { ok: true, value: n };
}

/* ---------- day totals ---------- */
function dayTotal(days, iso) {
  var d = days && days[iso];
  return (d && typeof d.total === "number" && d.total > 0) ? d.total : 0;
}
function addDrink(days, iso, ml) {
  var d = days[iso] || { total: 0, log: [] };
  d.total += ml;
  d.log.push({ ml: ml, ts: Date.now() });
  days[iso] = d;
  return days;
}
function removeDrink(days, iso, index) {
  var d = days[iso];
  if (!d || !Array.isArray(d.log) || index < 0 || index >= d.log.length) return false;
  var removed = d.log.splice(index, 1)[0];
  d.total = Math.max(0, d.total - removed.ml);
  return true;
}

/* ---------- streak ----------
 * Consecutive goal-met days. If today is not met yet, the streak can still
 * continue from yesterday (today is "pending", not a miss). Any fully past
 * day below goal breaks the chain and resets to 0. */
function calcStreak(days, goalMl, todayISO) {
  var streak = 0;
  for (var i = 0; i < 730; i++) {
    var key = shiftISO(todayISO, -i);
    if (dayTotal(days, key) >= goalMl) { streak++; continue; }
    if (i === 0) continue; /* today pending — look at yesterday */
    break;
  }
  return streak;
}

/* ---------- 7-day history ---------- */
function last7(days, todayISO) {
  var out = [];
  for (var i = 6; i >= 0; i--) {
    var key = shiftISO(todayISO, -i);
    out.push({ iso: key, total: dayTotal(days, key) });
  }
  return out;
}

/* ---------- export / import ---------- */
function buildExport(goalMl, days) {
  var clean = {};
  Object.keys(days || {}).forEach(function (k) {
    if (!isISODate(k)) return;
    var t = dayTotal(days, k);
    if (t > 0) clean[k] = { total: t, log: [] };
  });
  return { app: "water-tracker-bd", version: EXPORT_VERSION, goalMl: goalMl, days: clean };
}
function parseImport(text) {
  var obj;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: "not-json" }; }
  if (!obj || typeof obj !== "object" || obj.app !== "water-tracker-bd" || obj.version !== EXPORT_VERSION)
    return { ok: false, error: "bad-shape" };
  var g = validateGoal(obj.goalMl);
  if (!g.ok) return { ok: false, error: "bad-goal" };
  var days = {};
  var src = obj.days || {};
  for (var k of Object.keys(src)) {
    if (!isISODate(k)) return { ok: false, error: "bad-day" };
    var t = src[k] && src[k].total;
    if (typeof t !== "number" || t < 0 || t > 100000) return { ok: false, error: "bad-total" };
    if (t > 0) days[k] = { total: Math.round(t), log: [] };
  }
  return { ok: true, data: { goalMl: g.value, days: days } };
}

/* ---------- weekday labels ---------- */
var WD_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var WD_BN = ["রবি","সোম","মঙ্গল","বুধ","বৃহস্পতি","শুক্র","শনি"];
function weekdayLabel(iso, lang) {
  var i = weekdayIndex(iso);
  return lang === "bn" ? WD_BN[i] : WD_EN[i];
}

var API = {
  BN_DIGITS: BN_DIGITS, MAX_CUSTOM_ML: MAX_CUSTOM_ML, MIN_GOAL_ML: MIN_GOAL_ML,
  MAX_GOAL_ML: MAX_GOAL_ML, DEFAULT_GOAL_ML: DEFAULT_GOAL_ML, EXPORT_VERSION: EXPORT_VERSION,
  toBnDigits: toBnDigits, fmtNum: fmtNum, progressPct: progressPct, ringFraction: ringFraction,
  isISODate: isISODate, shiftISO: shiftISO, weekdayIndex: weekdayIndex,
  parseWhole: parseWhole, validateAmount: validateAmount, validateGoal: validateGoal,
  dayTotal: dayTotal, addDrink: addDrink, removeDrink: removeDrink,
  calcStreak: calcStreak, last7: last7,
  buildExport: buildExport, parseImport: parseImport,
  weekdayLabel: weekdayLabel, WD_EN: WD_EN, WD_BN: WD_BN
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
if (typeof window !== "undefined") window.__wtLogic = API;
