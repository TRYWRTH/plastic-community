// Vercel Node.js Serverless Function — serves pre-rendered HTML with correct
// Open Graph / Twitter meta tags for a single event, specifically for
// social-media link unfurlers (WhatsApp, Telegram, iMessage, Twitter/X,
// Facebook, Slack, Discord, …). This app deploys as a static SPA (see
// vite.config.ts's `spa.enabled` comment), so tags injected client-side via
// the route's `head()` never reach crawlers, which don't execute JavaScript.
// vercel.json routes crawler user-agents hitting /event/:id here first;
// everyone else still gets the normal static app shell.
//
// Deliberately self-contained: no `@/...` imports from the frontend app.
// Vercel's Edge runtime can't bundle those aliases, and Node Serverless
// Functions are built independently of the Vite app anyway — so this file
// re-implements the handful of small helpers it needs (slug ID extraction,
// image fallback, HTML escaping) and talks to Supabase over its REST API
// with plain `fetch`, rather than importing the app's supabase-js client.
import type { IncomingMessage, ServerResponse } from "http";

const SITE_ORIGIN = "https://plastic-community.vercel.app";
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/icons/icon-512.png`;
const SITE_NAME = "Whisper Ring by Plastic Productions";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

type EventRow = {
  id: string;
  title: string;
  neighborhood: string | null;
  event_date: string;
  image_url: string | null;
  link_preview_image_url: string | null;
};

/** Extract the trailing UUID from a "slug-uuid" route param, or return it as-is if it's already a bare UUID. */
function extractIdFromSlug(slugOrId: string): string {
  const match = slugOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? match[0] : slugOrId;
}

/** An organiser-uploaded photo wins; a re-hosted link-preview image is the fallback. */
function resolveCardImageUrl(event: EventRow): string | null {
  return event.image_url || event.link_preview_image_url || null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Tue 25 Aug at 18:30" — no external date library, just Intl. */
function formatEventWhen(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const datePart = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Berlin",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(d);
  return `${datePart} at ${timePart}`;
}

function renderHtml(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description);
  const image = escapeHtml(opts.image);
  const url = escapeHtml(opts.url);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:type" content="event" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
<link rel="canonical" href="${url}" />
</head>
<body>
<p><a href="${url}">${title}</a></p>
</body>
</html>`;
}

async function fetchEvent(id: string): Promise<EventRow | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !id) return null;

  const columns = "id,title,neighborhood,event_date,image_url,link_preview_image_url";
  const restUrl =
    `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}` + `&select=${columns}&limit=1`;

  const response = await fetch(restUrl, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!response.ok) return null;

  const rows = (await response.json()) as EventRow[];
  return rows[0] ?? null;
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[] | undefined> },
  res: ServerResponse,
): Promise<void> {
  const parsedUrl = new URL(req.url ?? "", "http://localhost");
  const rawEventId = parsedUrl.searchParams.get("eventId") ?? "";
  const id = extractIdFromSlug(rawEventId);
  const pageUrl = `${SITE_ORIGIN}/event/${rawEventId || id}`;

  const event = await fetchEvent(id);

  if (!event) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(
      renderHtml({
        title: `Event — ${SITE_NAME}`,
        description: "Discover underground events in Berlin.",
        image: DEFAULT_OG_IMAGE,
        url: pageUrl,
      }),
    );
    return;
  }

  // "Tue 25 Aug at 18:30 • Neukölln" — date, time, and district only, so the
  // preview stays short and legible in a chat bubble.
  const when = formatEventWhen(event.event_date);
  const description = [when, event.neighborhood ?? ""].filter(Boolean).join(" • ").slice(0, 200);

  const rawImageUrl = resolveCardImageUrl(event) ?? DEFAULT_OG_IMAGE;
  const image = rawImageUrl.startsWith("http") ? rawImageUrl : `${SITE_ORIGIN}${rawImageUrl}`;

  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(
    renderHtml({
      title: `${event.title} — ${SITE_NAME}`,
      description,
      image,
      url: pageUrl,
    }),
  );
}
