/* water-tracker-bd — headless-Chrome browser tests (puppeteer-core + system Chromium).
 * Run: NODE_PATH=/home/hatch/workspace/muse-project-factory/builds/savings-interest-bd/node_modules \
 *      node tests/browser.test.js
 * Uses ?asof=2026-10-12 for deterministic date math. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const CHROME = "/opt/meta-chromium/chrome";
const BASE = "file://" + ROOT + "/index.html?asof=2026-10-12";

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    () => { results.push({ name, ok: true }); console.log("  PASS " + name); },
    (err) => { results.push({ name, ok: false }); console.log("  FAIL " + name + " :: " + (err && err.message || err)); }
  );
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assertion failed"); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seed(page, obj) {
  await page.evaluate((o) => localStorage.setItem("wtbd.v1", JSON.stringify(o)), obj);
}
async function fresh(page, url) {
  await page.goto(url || BASE, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#ringFg");
  await sleep(120);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
  });
  const consoleErrors = [], pageErrors = [], netUrls = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on("dialog", (d) => d.accept());
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e && e.message || e)));
  page.on("request", (r) => netUrls.push(r.url()));

  console.log("browser: water-tracker-bd @ " + BASE);
  await fresh(page);

  await check("page loads: title, ring svg, 4 cards", async () => {
    const title = await page.title();
    assert(title.includes("Water Tracker BD"), "title=" + title);
    assert(await page.$("svg.ring #ringFg"), "no ring");
    for (const id of ["#todayCard", "#logList", "#chart", "#exportBtn"])
      assert(await page.$(id), "missing " + id);
  });

  await check("quick-add 250: total + ring % update", async () => {
    await page.click('[data-add="250"]');
    await sleep(150);
    const total = await page.$eval("#totalMl", (e) => e.textContent);
    const pct = await page.$eval("#ringPct", (e) => e.textContent);
    assert(total === "250", "total=" + total);
    assert(pct === "13%", "pct=" + pct); /* 250/2000 = 12.5 -> 13 */
    const items = await page.$$eval("#logList li", (els) => els.length);
    assert(items === 1, "log items=" + items);
  });

  await check("add 500 more: total 750, pct 38%", async () => {
    await page.click('[data-add="500"]');
    await sleep(150);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "750", "total wrong");
    assert((await page.$eval("#ringPct", (e) => e.textContent)) === "38%", "pct wrong");
  });

  await check("invalid custom ('abc' / '0'): error shown, total unchanged", async () => {
    await page.evaluate(() => { document.getElementById("customMl").value = "abc"; });
    await page.click("#customAdd");
    await sleep(120);
    assert(!(await page.$eval("#amountErr", (e) => e.hidden)), "no error for abc");
    await page.evaluate(() => { document.getElementById("customMl").value = "0"; });
    await page.click("#customAdd");
    await sleep(120);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "750", "total changed on invalid");
  });

  await check("custom 300 valid: total 1050", async () => {
    await page.evaluate(() => { document.getElementById("customMl").value = "300"; });
    await page.click("#customAdd");
    await sleep(150);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "1050", "total wrong");
  });

  await check("goal change to 3000: goal text + ring update", async () => {
    await page.evaluate(() => { document.getElementById("goalInput").value = "3000"; });
    await page.click("#goalSave");
    await sleep(150);
    assert((await page.$eval("#goalMl", (e) => e.textContent)) === "3000", "goal text wrong");
    assert((await page.$eval("#ringPct", (e) => e.textContent)) === "35%", "pct wrong"); /* 1050/3000 */
    assert(!(await page.$eval("#goalOk", (e) => e.hidden)), "no saved confirmation");
  });

  await check("invalid goal (100): error shown, goal stays 3000", async () => {
    await page.evaluate(() => { document.getElementById("goalInput").value = "100"; });
    await page.click("#goalSave");
    await sleep(120);
    assert(!(await page.$eval("#goalErr", (e) => e.hidden)), "no goal error");
    assert((await page.$eval("#goalMl", (e) => e.textContent)) === "3000", "goal changed on invalid");
  });

  await check("persistence across reload: total 1050, goal 3000", async () => {
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#ringFg");
    await sleep(120);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "1050", "total lost");
    assert((await page.$eval("#goalMl", (e) => e.textContent)) === "3000", "goal lost");
    assert((await page.$$eval("#logList li", (els) => els.length)) === 3, "log lost");
  });

  await check("BN toggle: Bengali digits + bn lang attr", async () => {
    await page.click("#langToggle");
    await sleep(150);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "১০৫০", "bn total wrong");
    assert((await page.$eval("#goalMl", (e) => e.textContent)) === "৩০০০", "bn goal wrong");
    assert((await page.evaluate(() => document.documentElement.lang)) === "bn", "lang attr wrong");
    assert((await page.$eval("h1", (e) => e.textContent)).includes("ওয়াটার"), "bn title wrong");
    assert((await page.$eval("#langToggle", (e) => e.textContent)) === "English", "toggle label wrong");
    /* toggle back to EN for the rest */
    await page.click("#langToggle");
    await sleep(150);
    assert((await page.evaluate(() => document.documentElement.lang)) === "en", "did not toggle back");
  });

  await check("streak: 3 goal-met days in a row -> streak 3, chart 7 bars", async () => {
    await seed(page, { goalMl: 2000, lang: "en", days: {
      "2026-10-10": { total: 2000, log: [] },
      "2026-10-11": { total: 2200, log: [] },
      "2026-10-12": { total: 2000, log: [] },
    }});
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#ringFg");
    await sleep(150);
    assert((await page.$eval("#streakN", (e) => e.textContent)) === "3", "streak wrong");
    assert((await page.$$eval("#chart .bar-col", (els) => els.length)) === 7, "chart bars != 7");
    assert(await page.$(".goal-marker"), "no goal marker");
  });

  await check("streak: missed yesterday -> chain broken, today starts new streak of 1", async () => {
    await seed(page, { goalMl: 2000, lang: "en", days: {
      "2026-10-10": { total: 2000, log: [] },
      "2026-10-11": { total: 400, log: [] },
      "2026-10-12": { total: 2000, log: [] },
    }});
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#ringFg");
    await sleep(150);
    assert((await page.$eval("#streakN", (e) => e.textContent)) === "1", "streak should be 1 (today only)");
  });

  await check("streak: missed day with today pending -> streak 0", async () => {
    await seed(page, { goalMl: 2000, lang: "en", days: {
      "2026-10-09": { total: 2000, log: [] },
      "2026-10-10": { total: 2000, log: [] },
      "2026-10-11": { total: 400, log: [] },
    }});
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#ringFg");
    await sleep(150);
    assert((await page.$eval("#streakN", (e) => e.textContent)) === "0", "streak should reset to 0");
  });

  await check("export/import round-trip: wipe then restore", async () => {
    await seed(page, { goalMl: 2500, lang: "en", days: {
      "2026-10-12": { total: 1250, log: [{ ml: 1250, ts: 1 }] },
    }});
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#ringFg");
    await sleep(150);
    const exported = await page.evaluate(() => window.__wt.exportText());
    assert(exported.includes('"goalMl": 2500'), "export missing goal");
    const tmp = path.join(os.tmpdir(), "wtbd-roundtrip-" + Date.now() + ".json");
    fs.writeFileSync(tmp, exported);
    /* wipe */
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#ringFg");
    await sleep(120);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "0", "wipe failed");
    /* import through the real file input */
    const input = await page.$("#importFile");
    await input.uploadFile(tmp);
    await sleep(300);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "1250", "import total wrong");
    assert((await page.$eval("#goalMl", (e) => e.textContent)) === "2500", "import goal wrong");
    assert(!(await page.$eval("#ioMsg", (e) => e.hidden)), "no import ok message");
    fs.unlinkSync(tmp);
  });

  await check("import invalid file: error shown, state unchanged", async () => {
    const tmp = path.join(os.tmpdir(), "wtbd-bad-" + Date.now() + ".json");
    fs.writeFileSync(tmp, '{"nope": true}');
    const before = await page.$eval("#totalMl", (e) => e.textContent);
    const input = await page.$("#importFile");
    await input.uploadFile(tmp);
    await sleep(300);
    assert(!(await page.$eval("#ioMsg", (e) => e.hidden)), "no import error message");
    assert((await page.$eval("#ioMsg", (e) => e.className)) === "err", "msg not styled as error");
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === before, "state changed on bad import");
    fs.unlinkSync(tmp);
  });

  await check("remove log entry deletes it and lowers total", async () => {
    await seed(page, { goalMl: 2000, lang: "en", days: {
      "2026-10-12": { total: 750, log: [{ ml: 250, ts: 1 }, { ml: 500, ts: 2 }] },
    }});
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector("#ringFg");
    await sleep(150);
    await page.click('#logList [data-del="0"]');
    await sleep(150);
    assert((await page.$eval("#totalMl", (e) => e.textContent)) === "500", "total after remove wrong");
    assert((await page.$$eval("#logList li", (els) => els.length)) === 1, "log item not removed");
  });

  await check("empty states: fresh profile shows log + history empty text", async () => {
    await fresh(page);
    assert(!(await page.$eval("#logEmpty", (e) => e.hidden)), "log empty text hidden");
    assert(!(await page.$eval("#histEmpty", (e) => e.hidden)), "history empty text hidden");
    assert((await page.$$eval("#logList li", (els) => els.length)) === 0, "log should be empty");
  });

  await check("390px mobile: no horizontal overflow", async () => {
    const m = await browser.newPage();
    m.on("pageerror", (e) => pageErrors.push("mobile: " + String(e && e.message || e)));
    m.on("console", (mm) => { if (mm.type() === "error") consoleErrors.push("mobile: " + mm.text()); });
    await m.setViewport({ width: 390, height: 844, isMobile: true });
    await m.goto(BASE, { waitUntil: "load" });
    await seed(m, { goalMl: 2000, lang: "en", days: { "2026-10-12": { total: 1500, log: [{ ml: 1500, ts: 1 }] } } });
    await m.reload({ waitUntil: "load" });
    await m.waitForSelector("#ringFg");
    await sleep(200);
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, "horizontal overflow: " + overflow + "px");
    assert(await m.$('[data-add="250"]'), "quick-add missing on mobile");
    await m.close();
  });

  await check("zero console errors and zero page errors", async () => {
    assert(consoleErrors.length === 0, "console errors: " + JSON.stringify(consoleErrors.slice(0, 3)));
    assert(pageErrors.length === 0, "page errors: " + JSON.stringify(pageErrors.slice(0, 3)));
  });

  await check("zero network requests (all file:// or none)", async () => {
    const external = netUrls.filter((u) => !u.startsWith("file://") && !u.startsWith("data:") && !u.startsWith("blob:"));
    assert(external.length === 0, "network requests: " + JSON.stringify(external.slice(0, 5)));
  });

  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nbrowser: ${ok} passed, ${bad} failed`);
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
