/* water-tracker-bd — UI wiring. Depends on js/logic.js (global `W` via module.exports guard fallback). */
"use strict";
(function () {
  var L = (typeof module !== "undefined" && module.exports) ? module.exports : null;
  /* In the browser, logic.js sets no global; re-require its functions via a shim: */
  if (!L && typeof window !== "undefined" && window.__wtLogic) L = window.__wtLogic;

  /* logic.js only sets module.exports in Node. In browser, load it as classic script
     and grab the export object through a tiny eval-free bridge: */
  function logic() {
    if (L) return L;
    throw new Error("logic.js not loaded");
  }

  var STORE_KEY = "wtbd.v1";

  /* ---------------- i18n ---------------- */
  var STR = {
    en: {
      appTitle: "Water Tracker BD",
      subtitle: "Track your daily hydration, offline.",
      today: "Today",
      streakLabel: "day streak",
      ofGoal: "of goal",
      unit: "ml", unit2: "ml", unit3: "ml", unit4: "ml",
      goalOf: "of", goalWord: "goal",
      customPh: "Custom amount (ml)",
      add: "Add",
      goal: "Daily goal",
      save: "Save",
      logTitle: "Today's log",
      emptyLog: "Nothing logged today yet.",
      history: "Last 7 days",
      emptyHistory: "No drinks logged yet — add your first glass!",
      dataTitle: "Data",
      export: "Export JSON",
      import: "Import JSON",
      footNote: "100% offline — your data stays in this browser.",
      reminderNote: "Reminders need this tab open — this app cannot send notifications in the background.",
      invalidAmount: "Enter a whole amount between 1 and 2000 ml.",
      invalidGoal: "Goal must be a whole number between 500 and 10000 ml.",
      goalSaved: "Goal updated.",
      added: "added",
      removed: "Entry removed.",
      remove: "Remove",
      importOk: "Data imported.",
      importFail: "Import failed: not a valid Water Tracker BD file.",
      noTime: ""
    },
    bn: {
      appTitle: "ওয়াটার ট্র্যাকার বিডি",
      subtitle: "আপনার দৈনিক পানির হিসাব রাখুন, অফলাইনে।",
      today: "আজ",
      streakLabel: "দিনের ধারাবাহিকতা",
      ofGoal: "লক্ষ্যের",
      unit: "মি.লি.", unit2: "মি.লি.", unit3: "মি.লি.", unit4: "মি.লি.",
      goalOf: "/", goalWord: "লক্ষ্য",
      customPh: "নিজের পরিমাণ (মি.লি.)",
      add: "যোগ করুন",
      goal: "দৈনিক লক্ষ্য",
      save: "সংরক্ষণ",
      logTitle: "আজকের তালিকা",
      emptyLog: "আজ এখনো কিছু যোগ করা হয়নি।",
      history: "গত ৭ দিন",
      emptyHistory: "এখনো পানি যোগ করা হয়নি — প্রথম গ্লাস যোগ করুন!",
      dataTitle: "ডেটা",
      export: "JSON ডাউনলোড",
      import: "JSON আমদানি",
      footNote: "১০০% অফলাইন — আপনার তথ্য এই ব্রাউজারেই থাকে।",
      reminderNote: "স্মরণ করানোর জন্য এই ট্যাব খোলা থাকতে হবে — অ্যাপটি ব্যাকগ্রাউন্ডে নোটিফিকেশন পাঠাতে পারে না।",
      invalidAmount: "১ থেকে ২০০০ মি.লি.-এর মধ্যে পূর্ণ সংখ্যা দিন।",
      invalidGoal: "লক্ষ্য ৫০০ থেকে ১০০০০ মি.লি.-এর মধ্যে পূর্ণ সংখ্যা হতে হবে।",
      goalSaved: "লক্ষ্য আপডেট হয়েছে।",
      added: "যোগ হয়েছে",
      removed: "এন্ট্রি মুছে ফেলা হয়েছে।",
      remove: "মুছুন",
      importOk: "ডেটা আমদানি হয়েছে।",
      importFail: "আমদানি ব্যর্থ: এটি বৈধ Water Tracker BD ফাইল নয়।",
      noTime: ""
    }
  };

  /* ---------------- state ---------------- */
  function defaultState() {
    return { goalMl: L.DEFAULT_GOAL_ML, days: {}, lang: "en" };
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      if (!s || typeof s !== "object") return defaultState();
      var g = L.validateGoal(s.goalMl);
      var days = {};
      Object.keys(s.days || {}).forEach(function (k) {
        if (L.isISODate(k)) {
          var t = L.dayTotal(s.days, k);
          days[k] = { total: t, log: Array.isArray(s.days[k].log) ? s.days[k].log.filter(function(e){return e && typeof e.ml==="number";}) : [] };
        }
      });
      return { goalMl: g.ok ? g.value : L.DEFAULT_GOAL_ML, days: days, lang: s.lang === "bn" ? "bn" : "en" };
    } catch (e) { return defaultState(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked: app still works in-memory */ }
  }

  function todayISO() {
    var q = null;
    try { q = new URLSearchParams(location.search).get("asof"); } catch (e) {}
    if (q && L.isISODate(q)) return q;
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------------- dom ---------------- */
  function $(id) { return document.getElementById(id); }
  var state = null, TODAY = null;
  var RING_C = 2 * Math.PI * 70;

  function t(key) { return STR[state.lang][key] || STR.en[key] || key; }
  function n(x) { return L.fmtNum(x, state.lang); }

  function applyLang() {
    document.documentElement.lang = state.lang === "bn" ? "bn" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });
    $("langToggle").textContent = state.lang === "bn" ? "English" : "বাংলা";
  }

  function render() {
    applyLang();
    var total = L.dayTotal(state.days, TODAY);
    var goal = state.goalMl;

    /* ring */
    var frac = L.ringFraction(total, goal);
    var fg = $("ringFg");
    fg.style.strokeDasharray = String(RING_C);
    fg.style.strokeDashoffset = String(RING_C * (1 - frac));
    fg.classList.toggle("done", total >= goal);
    $("ringPct").textContent = n(L.progressPct(total, goal)) + "%";

    $("totalMl").textContent = n(total);
    $("goalMl").textContent = n(goal);
    $("streakN").textContent = n(L.calcStreak(state.days, goal, TODAY));

    /* log */
    var log = (state.days[TODAY] && state.days[TODAY].log) || [];
    var list = $("logList");
    list.innerHTML = "";
    log.forEach(function (e, i) {
      var li = document.createElement("li");
      var tm = e.ts ? new Date(e.ts) : null;
      var hh = tm ? String(tm.getHours()).padStart(2, "0") + ":" + String(tm.getMinutes()).padStart(2, "0") : "";
      var span = document.createElement("span");
      span.textContent = (hh ? n(hh) + " · " : "") + "+" + n(e.ml) + " " + t("unit");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "del";
      btn.textContent = t("remove");
      btn.setAttribute("data-del", String(i));
      li.appendChild(span);
      li.appendChild(btn);
      list.appendChild(li);
    });
    $("logEmpty").hidden = log.length > 0;

    /* chart */
    var hist = L.last7(state.days, TODAY);
    var chart = $("chart");
    chart.innerHTML = "";
    var maxV = Math.max.apply(null, hist.map(function (h) { return h.total; }).concat([goal, 1]));
    var anyData = hist.some(function (h) { return h.total > 0; });
    hist.forEach(function (h) {
      var col = document.createElement("div");
      col.className = "bar-col";
      var isToday = h.iso === TODAY;
      var bar = document.createElement("div");
      bar.className = "bar" + (isToday ? " today" : "") + (h.total >= goal && h.total > 0 ? " met" : "");
      bar.style.height = Math.max(3, Math.round((h.total / maxV) * 100)) + "%";
      bar.title = h.iso + ": " + h.total + " ml";
      var val = document.createElement("div");
      val.className = "bar-val";
      val.textContent = h.total > 0 ? n(h.total) : "";
      var lab = document.createElement("div");
      lab.className = "bar-lab";
      lab.textContent = L.weekdayLabel(h.iso, state.lang);
      col.appendChild(val);
      col.appendChild(bar);
      col.appendChild(lab);
      chart.appendChild(col);
    });
    /* goal marker */
    var gm = document.createElement("div");
    gm.className = "goal-marker";
    gm.style.bottom = "calc(" + Math.round((goal / maxV) * 100) + "% + 22px)";
    gm.title = t("goal") + ": " + goal + " ml";
    chart.appendChild(gm);
    $("histEmpty").hidden = anyData;

    if (document.activeElement !== $("goalInput")) $("goalInput").value = n(goal);
  }

  function flash(el, msg, ok) {
    el.textContent = msg;
    el.hidden = false;
    el.className = ok ? "ok" : "err";
    if (ok) setTimeout(function () { el.hidden = true; }, 2500);
  }

  function addAmount(ml) {
    L.addDrink(state.days, TODAY, ml);
    save(); render();
  }

  function wire() {
    document.querySelectorAll("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () { addAmount(parseInt(b.getAttribute("data-add"), 10)); });
    });
    function submitCustom() {
      var v = L.validateAmount($("customMl").value);
      if (!v.ok) { flash($("amountErr"), t("invalidAmount"), false); return; }
      $("amountErr").hidden = true;
      $("customMl").value = "";
      addAmount(v.value);
    }
    $("customAdd").addEventListener("click", submitCustom);
    $("customMl").addEventListener("keydown", function (e) { if (e.key === "Enter") submitCustom(); });

    $("goalSave").addEventListener("click", function () {
      var v = L.validateGoal($("goalInput").value);
      if (!v.ok) { flash($("goalErr"), t("invalidGoal"), false); return; }
      $("goalErr").hidden = true;
      state.goalMl = v.value;
      save(); render();
      flash($("goalOk"), t("goalSaved"), true);
    });

    $("logList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-del]");
      if (!b) return;
      if (L.removeDrink(state.days, TODAY, parseInt(b.getAttribute("data-del"), 10))) {
        save(); render();
        flash($("ioMsg"), t("removed"), true);
      }
    });

    $("langToggle").addEventListener("click", function () {
      state.lang = state.lang === "bn" ? "en" : "bn";
      save(); render();
    });

    $("exportBtn").addEventListener("click", function () {
      var blob = new Blob([exportText()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "water-tracker-bd.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });

    $("importFile").addEventListener("change", function () {
      var f = $("importFile").files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var res = L.parseImport(String(r.result || ""));
        if (!res.ok) { flash($("ioMsg"), t("importFail"), false); }
        else {
          state.goalMl = res.data.goalMl;
          state.days = res.data.days;
          save(); render();
          flash($("ioMsg"), t("importOk"), true);
        }
        $("importFile").value = "";
      };
      r.readAsText(f);
    });
  }

  function exportText() {
    return JSON.stringify(L.buildExport(state.goalMl, state.days), null, 2);
  }

  function init() {
    L = logic();
    state = load();
    TODAY = todayISO();
    /* normalize today's bucket */
    if (!state.days[TODAY]) state.days[TODAY] = { total: 0, log: [] };
    wire();
    render();
    /* test hook (no network, no secrets): lets automated checks drive export round-trips */
    window.__wt = {
      todayISO: function () { return TODAY; },
      exportText: exportText,
      getState: function () { return JSON.parse(JSON.stringify(state)); }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
