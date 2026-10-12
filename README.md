# Water Tracker BD 💧

A fully offline, bilingual (English / বাংলা) daily hydration tracker. Log drinks with one tap,
watch an SVG progress ring fill toward your daily goal, keep a streak alive, review the last
7 days as a bar chart, and export/import your data as JSON. No accounts, no servers, no network.

## Problem

Most water-tracker apps require sign-ups, show ads, or quietly phone home with health data.
People in Bangladesh who just want a simple, private, Bengali-friendly way to track daily
water intake get either English-only apps or overbuilt fitness platforms. Water Tracker BD
is a single static page that does one job well and keeps all data in the browser.

## Features

- **Quick-add drinks** — one-tap +250 ml / +500 ml buttons, plus a custom amount field
  (1–2000 ml) with validation and clear error messages
- **Daily goal** — default 2000 ml, adjustable (500–10000 ml), persisted
- **SVG progress ring** — fills with % of goal; turns green when the goal is met
- **7-day history bar chart** — per-day totals with a dashed goal line; empty state included
- **Streak counter** — consecutive goal-met days; a missed day resets it (today counts as
  "pending" until met, so an unfinished today doesn't kill yesterday's streak)
- **Today's log** — timestamped entries with per-entry remove
- **EN/বাংলা toggle** — full UI translation, Bengali digits (০১২৩৪৫৬৭৮৯) in every number
- **JSON export / import** — download a backup, restore it through the real file picker
- **Honest reminders note** — the UI states plainly that reminders need the tab open;
  the app never claims background notifications it can't send
- **Mobile responsive** — verified at 390 px with no horizontal overflow

## Stack

- Plain HTML + CSS + vanilla JavaScript — **zero dependencies, zero network requests**
- `localStorage` for persistence (key `wtbd.v1`)
- Node's built-in `node:assert` for unit tests; `puppeteer-core` + system Chromium for
  browser tests

## Prerequisites

- Any modern browser (Chrome, Edge, Firefox, Safari) — just open `index.html`
- For running the tests: **Node.js 18+** and a Chromium binary
  (`/opt/meta-chromium/chrome` in this workspace; any Chromium works via the `CHROME`
  constant at the top of `tests/browser.test.js`)
- `puppeteer-core` resolvable via `NODE_PATH` (no install needed if a sibling factory
  build already has it in `node_modules`)

## Install

No install. Copy the folder (or serve it) and open `index.html`:

```sh
# option 1: open directly
xdg-open index.html        # Linux
open index.html            # macOS

# option 2: serve locally (any static server)
npx serve .
# then visit the printed URL
```

## Dev commands

```sh
node tests/unit.test.js        # 24 pure-logic checks (progress %, streak, history, i18n digits, validation, export/import)

NODE_PATH=/path/to/dir/with/puppeteer-core/node_modules \
  node tests/browser.test.js   # 19 headless-Chrome checks (add drink, goal change,
                               # persistence, BN toggle, streak incl. missed-day reset,
                               # export/import round-trip, 390px mobile, 0 console errors,
                               # 0 network requests)
```

`?asof=YYYY-MM-DD` query param freezes "today" for deterministic testing
(e.g. `index.html?asof=2026-10-12`).

## Env

**None.** There is no backend, no API key, no `.env`, no build step. The app makes zero
network requests by design (asserted in the browser test suite).

## Testing

- `tests/unit.test.js` — **24 checks**, all passing: progress % rounding, ring clamping,
  streak logic (3-in-a-row → 3, today-pending continuation, missed-day reset to 0),
  7-day aggregation with gaps, amount/goal validation (incl. Bengali-digit input),
  add/remove entries, Bengali digits, weekday labels, export/import round-trip and
  rejection of malformed files.
- `tests/browser.test.js` — **19 checks**, all passing in headless Chromium: page load,
  quick-add updates total + ring, invalid custom input blocked, custom add, goal change
  + invalid goal blocked, persistence across reload, EN↔বাংলা toggle with Bengali digits,
  streak 3, streak reset on missed day, export → wipe → import round-trip, invalid import
  rejected, entry removal, empty states, 390 px mobile with no horizontal overflow,
  **0 console errors, 0 page errors, 0 network requests**.

Total: **43 checks, 0 failures.**

## Deployment

GitHub Pages compatible — it's a static site:

1. Push this folder to a repo (or copy its contents to `docs/`).
2. Repo → Settings → Pages → Deploy from branch → `main` / root (or `/docs`).
3. Open the `https://<user>.github.io/<repo>/` URL. Done — no build, no secrets.

## Limitations

- **No real reminders/notifications** — the Web Notification API can't fire reliably
  from a closed static page; the UI says so honestly instead of faking it.
- **Data lives in one browser** — `localStorage` isn't synced; clearing site data or
  switching browsers/devices loses history unless you export JSON first.
- **Day boundaries use the device's local date** — travel across timezones can shift
  which bucket a late-night drink lands in.
- Imported files replace current data (no merge); only files previously exported by
  this app (same `app` + `version`) are accepted.

## Status

✅ Complete and verified — 2026-10-12. 43/43 tests green, zero console/page errors,
zero network requests. Ready to publish (static hosting only).
