// One-off backfill: re-fetch link previews for existing events that are
// still showing the generated poster fallback (no uploaded photo, and no
// link preview image ever successfully fetched). Re-uses the same
// unfurl-link-preview edge function the app calls after publish/edit, so
// this just replays that call for every event that predates the feature
// (or whose fetch previously failed/was never triggered).
//
// Usage:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... node scripts/backfill-link-previews.mjs
//   (add --dry-run to only list affected events without calling the function)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 1500; // be gentle with Microlink's rate limits

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY) env vars.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, link, image_url, link_preview_image_url")
    .is("image_url", null)
    .is("link_preview_image_url", null)
    .not("link", "is", null);

  if (error) {
    console.error("Failed to query events:", error.message);
    process.exit(1);
  }

  const targets = events.filter((e) => e.link && e.link.trim().length > 0);

  console.log(`Found ${targets.length} event(s) still on the generated poster fallback.`);
  if (targets.length === 0) return;

  if (DRY_RUN) {
    for (const e of targets) console.log(`  - [${e.id}] ${e.title} -> ${e.link}`);
    return;
  }

  let ok = 0;
  let noImage = 0;
  let failed = 0;

  for (const [i, event] of targets.entries()) {
    process.stdout.write(`[${i + 1}/${targets.length}] ${event.title}... `);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("unfurl-link-preview", {
        body: { eventId: event.id },
      });
      if (fnError) {
        failed++;
        console.log(`ERROR (${fnError.message})`);
      } else if (data?.status === "ok") {
        ok++;
        console.log("OK (photo re-hosted)");
      } else {
        noImage++;
        console.log(`no image (status: ${data?.status ?? "unknown"})`);
      }
    } catch (err) {
      failed++;
      console.log(`ERROR (${err.message})`);
    }
    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nDone. ok=${ok} no_image=${noImage} failed=${failed} total=${targets.length}`);
}

main();
