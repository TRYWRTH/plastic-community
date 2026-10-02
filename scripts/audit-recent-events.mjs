#!/usr/bin/env node
/**
 * Lists every event added in the last N days and whether it shows on Home.
 * Nothing is changed — read only.
 *
 *   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node scripts/audit-recent-events.mjs 14
 */

const DAYS = Number(process.argv[2] || process.env.DAYS || 14);
const SB_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SITE_URL = (process.env.SITE_URL || "https://plastic-community.vercel.app").replace(/\/$/, "");
const MAX_DAYS = 60; // src/lib/agenda.ts

if (!SB_URL || !SB_KEY) {
  console.error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  process.exit(1);
}

async function sb(path) {
  const res = await fetch(`${SB_URL}${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

const ymd = (d) => d.toISOString().slice(0, 10);
const today = ymd(new Date());
const yesterday = ymd(new Date(Date.now() - 864e5));

const cols = "id,created_by,title,place,neighborhood,event_date,end_date,repeats,created_at";
const recent = await sb(
  `/rest/v1/events?select=${cols}&created_at=gte.${new Date(Date.now() - DAYS * 864e5).toISOString()}&order=created_at.desc`,
);
// Everything Home could show, to apply the same hide rules it does.
const upcoming = await sb(
  `/rest/v1/events?select=${cols}&or=(event_date.gte.${yesterday},end_date.gte.${yesterday})&order=event_date.asc`,
);

// Same-creator + same-title → only the earliest is shown (dedupeRecurring).
const earliest = new Map();
for (const e of upcoming) {
  const k = `${e.created_by}::${e.title}`;
  if (!earliest.has(k)) earliest.set(k, e);
}
// Only the first 60 distinct days with events are shown.
const shownDays = [...new Set(upcoming.map((e) => e.event_date.slice(0, 10)))].sort().slice(0, MAX_DAYS);
const lastShownDay = shownDays.at(-1);

const rows = recent.map((e) => {
  const day = e.event_date.slice(0, 10);
  const end = e.end_date || day;
  let status;
  if (end < today) status = "past — already over";
  else if (earliest.get(`${e.created_by}::${e.title}`)?.id !== e.id) {
    const first = earliest.get(`${e.created_by}::${e.title}`);
    status = `HIDDEN — same title as their event on ${first.event_date.slice(0, 10)}`;
  } else if (lastShownDay && day > lastShownDay) status = `HIDDEN — beyond the ${MAX_DAYS}-day window`;
  else status = "visible";
  return { ...e, day, status };
});

console.log(`Events added in the last ${DAYS} days: ${rows.length}\n`);
for (const r of rows) {
  const mark = r.status === "visible" ? "✅" : r.status.startsWith("past") ? "⏹️ " : "❌";
  console.log(`${mark} ${r.title}  |  ${r.day}  |  ${r.neighborhood}  |  added ${r.created_at.slice(0, 16)}`);
  console.log(`   ${r.status}  →  ${SITE_URL}/event/${r.id}`);
}
const hidden = rows.filter((r) => r.status.startsWith("HIDDEN"));
console.log(`\n${hidden.length} upcoming event(s) are in the database but not shown on Home.`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Events added in the last ${DAYS} days (${rows.length}) — ${hidden.length} hidden\n\n` +
      `| Status | Title | Date | Area | Added | Link |\n|---|---|---|---|---|---|\n` +
      rows
        .map(
          (r) =>
            `| ${esc(r.status)} | ${esc(r.title)} | ${r.day} | ${esc(r.neighborhood)} | ${r.created_at.slice(0, 16)} | [open](${SITE_URL}/event/${r.id}) |`,
        )
        .join("\n") +
      "\n",
  );
}
