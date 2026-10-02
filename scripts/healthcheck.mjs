#!/usr/bin/env node
/**
 * Live health check for the production site. Runs on a schedule in GitHub
 * Actions (.github/workflows/healthcheck.yml) and can be run locally:
 *
 *   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node scripts/healthcheck.mjs
 *
 * Env:
 *   SITE_URL                    default https://plastic-community.vercel.app
 *   SUPABASE_URL                required
 *   SUPABASE_PUBLISHABLE_KEY    required (public anon key — same one the app ships)
 *   HEALTHCHECK_EMAIL/PASSWORD  optional test account; enables the
 *                               "add an event and make sure it shows up" round trip
 *   SKIP_BROWSER=1              skip the Playwright check
 *
 * Exits 1 if any check fails, so the workflow goes red and GitHub emails you.
 */

const SITE_URL = (process.env.SITE_URL || "https://plastic-community.vercel.app").replace(/\/$/, "");
const SB_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const TEST_EMAIL = process.env.HEALTHCHECK_EMAIL;
const TEST_PASSWORD = process.env.HEALTHCHECK_PASSWORD;
const TEST_TITLE_PREFIX = "[healthcheck]";

// Same columns + filter the Home page uses (src/routes/index.tsx fetchEvents).
const EVENT_LIST_COLUMNS =
  "id,created_by,title,description,place,neighborhood,event_date,end_date,end_time,event_type,is_secret,location_tba,image_url,link_preview_image_url,link_preview_site_name";

const results = [];
const record = (status, name, detail = "") => {
  results.push({ status, name, detail });
  const icon = { pass: "✅", warn: "⚠️ ", fail: "❌" }[status];
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function check(name, fn) {
  try {
    const detail = await fn();
    record("pass", name, detail || "");
  } catch (err) {
    record("fail", name, err?.message || String(err));
  }
}

const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5);

function sbHeaders(token) {
  return {
    apikey: SB_KEY,
    Authorization: `Bearer ${token || SB_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sb(path, { token, ...init } = {}) {
  const res = await fetch(`${SB_URL}${path}`, {
    ...init,
    headers: { ...sbHeaders(token), ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/** Exactly what an anonymous visitor's Home page asks Supabase for. */
async function fetchHomeEvents(token) {
  const cutoff = ymd(daysAgo(1));
  const q = new URLSearchParams({
    select: EVENT_LIST_COLUMNS,
    or: `(event_date.gte.${cutoff},end_date.gte.${cutoff})`,
    order: "event_date.asc",
  });
  return sb(`/rest/v1/events?${q}`, { token });
}

// Mirrors dedupeRecurring() in src/lib/agenda.ts: only the earliest event per
// (creator + title) is shown on Home; the rest are hidden.
function hiddenByDedupe(events) {
  const groups = new Map();
  for (const e of events) {
    const k = `${e.created_by}::${e.title}`;
    groups.set(k, [...(groups.get(k) || []), e]);
  }
  const hidden = [];
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
    hidden.push(...arr.slice(1));
  }
  return hidden;
}

// ─── 1. Site is up ──────────────────────────────────────────────────────────
async function siteChecks() {
  let html = "";
  await check("Home page loads", async () => {
    const res = await fetch(SITE_URL, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
    if (!/<script[^>]+src=/.test(html)) throw new Error("No <script> tag in HTML — build looks broken");
    return `HTTP ${res.status}`;
  });

  await check("JS bundle loads", async () => {
    const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
    if (!src) throw new Error("No script src found");
    const res = await fetch(new URL(src, SITE_URL));
    if (!res.ok) throw new Error(`${src} → HTTP ${res.status}`);
    return src;
  });

  for (const path of ["/add", "/login", "/saved"]) {
    await check(`Route ${path} loads`, async () => {
      const res = await fetch(SITE_URL + path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
  }
}

// ─── 2. Data is healthy and visible ─────────────────────────────────────────
async function dataChecks() {
  let homeEvents = [];
  await check("Supabase: Home event query works", async () => {
    homeEvents = await fetchHomeEvents();
    return `${homeEvents.length} upcoming events`;
  });

  await check("Every recently added upcoming event is returned to visitors", async () => {
    // Events created in the last 14 days, read by created_at instead of by date.
    const q = new URLSearchParams({
      select: "id,title,event_date,end_date,created_at",
      created_at: `gte.${daysAgo(14).toISOString()}`,
      order: "created_at.desc",
    });
    const recent = await sb(`/rest/v1/events?${q}`);
    const cutoff = ymd(daysAgo(1));
    const upcoming = recent.filter(
      (e) => e.event_date.slice(0, 10) >= cutoff || (e.end_date && e.end_date >= cutoff),
    );
    const homeIds = new Set(homeEvents.map((e) => e.id));
    const missing = upcoming.filter((e) => !homeIds.has(e.id));
    if (missing.length) {
      throw new Error(`missing from Home query: ${missing.map((e) => `"${e.title}" (${e.id})`).join(", ")}`);
    }
    return `${recent.length} added in last 14 days, all upcoming ones visible`;
  });

  // Records that would make the Home page crash or silently skip an event.
  const bad = [];
  for (const e of homeEvents) {
    const problems = [];
    if (!e.title?.trim()) problems.push("empty title");
    if (Number.isNaN(new Date(e.event_date).getTime())) problems.push("bad event_date");
    if (e.end_date && Number.isNaN(new Date(e.end_date).getTime())) problems.push("bad end_date");
    if (!e.place?.trim() && !e.location_tba && !e.is_secret) problems.push("no place");
    if (!e.neighborhood) problems.push("no neighborhood");
    if (problems.length) bad.push(`"${e.title}" (${e.id}): ${problems.join(", ")}`);
  }
  if (bad.length) record("fail", "Event records are well-formed", bad.join("; "));
  else record("pass", "Event records are well-formed", `${homeEvents.length} checked`);

  const hidden = hiddenByDedupe(homeEvents).filter(
    (e) => !e.title.startsWith(TEST_TITLE_PREFIX),
  );
  if (hidden.length) {
    record(
      "warn",
      "Events hidden on Home because creator reused a title",
      hidden.map((e) => `"${e.title}" on ${e.event_date.slice(0, 10)} (${e.id})`).join(", "),
    );
  }

  return homeEvents;
}

// ─── 3. Round trip: add an event → it shows up → clean up ───────────────────
async function roundTrip() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    record("warn", "Add-event round trip skipped", "set HEALTHCHECK_EMAIL / HEALTHCHECK_PASSWORD to enable");
    return;
  }
  let token, userId, eventId;
  await check("Add event → visible to visitors → delete", async () => {
    const auth = await sb("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    token = auth.access_token;
    userId = auth.user.id;

    // Far-future date so it sits at the very end of the list for the few
    // seconds it exists. Inserted via the API, so no push notification fires.
    const when = new Date(Date.now() + 300 * 864e5);
    const [created] = await sb("/rest/v1/events?select=id", {
      method: "POST",
      token,
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        title: `${TEST_TITLE_PREFIX} ${new Date().toISOString()}`,
        place: "Healthcheck, Berlin",
        neighborhood: "Mitte",
        event_type: "other",
        event_date: when.toISOString(),
        created_by: userId,
        repeats: "none",
      }),
    });
    eventId = created.id;

    const anonView = await fetchHomeEvents();
    if (!anonView.some((e) => e.id === eventId)) throw new Error("new event not returned to anonymous visitors");

    const detail = await sb(`/rest/v1/events?id=eq.${eventId}&select=id`);
    if (detail.length !== 1) throw new Error("event detail lookup failed");

    const page = await fetch(`${SITE_URL}/event/${eventId}`);
    if (!page.ok) throw new Error(`/event/${eventId} → HTTP ${page.status}`);
    return "created, seen, deleted";
  });

  if (eventId) {
    await check("Cleanup test event", async () => {
      await sb(`/rest/v1/events?id=eq.${eventId}`, { method: "DELETE", token });
    });
  }
  // Leftovers from earlier runs that crashed before cleanup.
  if (token && userId) {
    try {
      const q = new URLSearchParams({ created_by: `eq.${userId}`, title: `like.${TEST_TITLE_PREFIX}*` });
      await sb(`/rest/v1/events?${q}`, { method: "DELETE", token });
    } catch {}
  }
}

// ─── 4. Real browser: events actually render on screen ──────────────────────
async function browserCheck(homeEvents) {
  if (process.env.SKIP_BROWSER) return;
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    record("warn", "Browser check skipped", "playwright not installed (npm i --no-save playwright)");
    return;
  }

  await check("Home page renders events in a real browser", async () => {
    const browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
    );
    try {
      // Mobile viewport: the mobile list uses real <a href="/event/..."> links.
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(SITE_URL, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForSelector('a[href*="/event/"]', { timeout: 30_000 }).catch(() => {});

      const hrefs = await page.$$eval('a[href*="/event/"]', (as) => as.map((a) => a.getAttribute("href")));
      const shown = new Set(hrefs.map((h) => h.match(/[0-9a-f-]{36}$/i)?.[0]).filter(Boolean));

      // Events that should definitely be on screen: today → next 14 days,
      // not hidden by the recurring-dedupe rule.
      const hiddenIds = new Set(hiddenByDedupe(homeEvents).map((e) => e.id));
      const today = ymd(new Date());
      const horizon = ymd(new Date(Date.now() + 14 * 864e5));
      const expected = homeEvents.filter((e) => {
        const start = e.event_date.slice(0, 10);
        return start >= today && start <= horizon && !hiddenIds.has(e.id);
      });
      const missing = expected.filter((e) => !shown.has(e.id));

      if (errors.length) throw new Error(`JS errors on page: ${errors.slice(0, 3).join(" | ")}`);
      if (homeEvents.length && !shown.size) throw new Error("No event cards rendered at all");
      if (missing.length) {
        throw new Error(`not on screen: ${missing.map((e) => `"${e.title}" (${e.event_date.slice(0, 10)})`).join(", ")}`);
      }
      return `${shown.size} events on screen, ${expected.length} expected in next 14 days all present`;
    } finally {
      await browser.close();
    }
  });
}

// ─── Run ────────────────────────────────────────────────────────────────────
console.log(`Health check for ${SITE_URL} at ${new Date().toISOString()}\n`);
if (!SB_URL || !SB_KEY) {
  console.error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  process.exit(1);
}

await siteChecks();
const homeEvents = await dataChecks();
await roundTrip();
await browserCheck(homeEvents);

const failed = results.filter((r) => r.status === "fail");
const warned = results.filter((r) => r.status === "warn");
console.log(`\n${results.length - failed.length - warned.length} passed, ${warned.length} warnings, ${failed.length} failed`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  const icon = { pass: "✅", warn: "⚠️", fail: "❌" };
  const rows = results.map((r) => `| ${icon[r.status]} | ${r.name} | ${r.detail.replace(/\|/g, "\\|")} |`);
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Health check — ${SITE_URL}\n\n| | Check | Detail |\n|---|---|---|\n${rows.join("\n")}\n`,
  );
}

process.exit(failed.length ? 1 : 0);
