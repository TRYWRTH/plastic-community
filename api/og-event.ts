// Vercel Edge Function — serves pre-rendered HTML with correct Open Graph /
// Twitter meta tags for a single event, specifically for social-media link
// unfurlers (WhatsApp, Telegram, iMessage, Twitter/X, Facebook, Slack,
// Discord, …). This app deploys as a static SPA (see vite.config.ts's
// `spa.enabled` comment), so those tags injected client-side via the route's
// `head()` never reach crawlers, which don't execute JavaScript. vercel.json
// routes crawler user-agents hitting /event/:id here first; everyone else
// still gets the normal static app shell.
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { extractIdFromSlug } from "@/lib/slug";
import { resolveCardImage } from "@/lib/event-card-image";
import { neighborhoodMeta } from "@/lib/constants";

export const config = { runtime: "edge" };

const SITE_ORIGIN = "https://plastic-community.vercel.app";
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/icons/icon-512.png`;
const SITE_NAME = "Whisper Ring by Plastic Productions";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export default async function handler(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const rawEventId = requestUrl.searchParams.get("eventId") ?? "";
  const id = extractIdFromSlug(rawEventId);
  const pageUrl = `${SITE_ORIGIN}/event/${rawEventId || id}`;

  const { data: event } = await supabase
    .from("events")
    .select(
      "id,title,place,neighborhood,event_date,description,image_url,link_preview_image_url,link_preview_site_name",
    )
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return new Response(
      renderHtml({
        title: `Event — ${SITE_NAME}`,
        description: "Discover underground events in Berlin.",
        image: DEFAULT_OG_IMAGE,
        url: pageUrl,
      }),
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  // "Tue 25 Aug at 18:30 • Neukölln" — date, time, and district only, so the
  // preview stays short and legible in a chat bubble.
  const d = new Date(event.event_date);
  const when = !isNaN(d.getTime()) ? format(d, "EEE d MMM 'at' HH:mm") : "";
  const districtLabel = event.neighborhood ? neighborhoodMeta(event.neighborhood).label : "";
  const description = [when, districtLabel].filter(Boolean).join(" • ").slice(0, 200);

  const cardImage = resolveCardImage(event);
  const rawImageUrl = cardImage?.url ?? DEFAULT_OG_IMAGE;
  const image = rawImageUrl.startsWith("http") ? rawImageUrl : `${SITE_ORIGIN}${rawImageUrl}`;

  return new Response(
    renderHtml({
      title: `${event.title} — ${SITE_NAME}`,
      description,
      image,
      url: pageUrl,
    }),
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
