// Fetches the og:image/title/description for an event's link (typically an
// Instagram post) and re-hosts the image in our own storage, so event cards
// without an uploaded photo can still show something real instead of a
// blank box. Runs out-of-band (invoked fire-and-forget after publish/edit),
// never on the request that creates or updates the event.
//
// Why this can't run in the browser: Instagram doesn't send CORS headers on
// its post pages, and its CDN image URLs are signed + expire, so hotlinking
// them breaks within hours/days — we have to download the image once and
// keep our own copy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import { decode as decodeImage, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const HTML_FETCH_TIMEOUT_MS = 8000;
const HTML_SIZE_CAP = 512_000; // 512 KB — the tags we need are in <head>
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_SIZE_CAP = 5_000_000; // 5 MB
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 80;
const BUCKET = "event-images";

type PreviewResult = {
  status: "ok" | "no_image" | "blocked" | "error";
  title?: string | null;
  description?: string | null;
  siteName?: string | null;
  imageBytes?: Uint8Array;
};

// supabase.functions.invoke() sends a CORS preflight OPTIONS request before
// the real POST — without these headers the browser blocks the POST from
// ever being sent and the function never sees real invocations.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

/** Strips tracking params and rejects anything that isn't a plain http(s) URL to a public host. */
function normaliseUrl(raw: string): URL | null {
  let candidate = raw.trim();
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  if (candidate.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  const isPrivateHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^169\.254\./.test(host);
  if (isPrivateHost) return null;

  for (const param of [...url.searchParams.keys()]) {
    if (param === "igsh" || param.startsWith("utm_") || param === "fbclid") {
      url.searchParams.delete(param);
    }
  }
  return url;
}

async function fetchCapped(
  url: string,
  cap: number,
  headers: HeadersInit,
  timeoutMs: number,
): Promise<{
  ok: boolean;
  status: number;
  contentType: string | null;
  bytes: Uint8Array | null;
  finalUrl: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    const contentType = res.headers.get("content-type");
    if (!res.ok || !res.body) {
      return { ok: res.ok, status: res.status, contentType, bytes: null, finalUrl: res.url };
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > cap) {
        await reader.cancel();
        return { ok: true, status: res.status, contentType, bytes: null, finalUrl: res.url };
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return { ok: true, status: res.status, contentType, bytes: merged, finalUrl: res.url };
  } catch {
    return { ok: false, status: 0, contentType: null, bytes: null, finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

const isLoginWall = (title?: string | null) =>
  !!title && /^(instagram|login\s*[•·]\s*instagram|log in to instagram)$/i.test(title.trim());

async function unfurl(rawUrl: string): Promise<PreviewResult> {
  const url = normaliseUrl(rawUrl);
  if (!url) return { status: "error" };

  const page = await fetchCapped(
    url.toString(),
    HTML_SIZE_CAP,
    { "user-agent": UA, "accept-language": "en", accept: "text/html,application/xhtml+xml" },
    HTML_FETCH_TIMEOUT_MS,
  );
  if (!page.ok || !page.bytes) {
    return {
      status:
        page.status === 429 || page.status === 401 || page.status === 403 ? "blocked" : "error",
    };
  }

  const doc = new DOMParser().parseFromString(new TextDecoder().decode(page.bytes), "text/html");
  if (!doc) return { status: "error" };

  const meta = (selector: string) =>
    doc.querySelector(selector)?.getAttribute("content")?.trim() || null;

  const image =
    meta('meta[property="og:image:secure_url"]') ??
    meta('meta[property="og:image"]') ??
    meta('meta[name="twitter:image"]');
  const title =
    meta('meta[property="og:title"]') ?? doc.querySelector("title")?.textContent?.trim() ?? null;
  const description = meta('meta[property="og:description"]') ?? meta('meta[name="description"]');
  const siteName =
    meta('meta[property="og:site_name"]') ?? new URL(page.finalUrl).hostname.replace(/^www\./, "");

  if (!image || isLoginWall(title)) {
    return { status: image ? "blocked" : "no_image", title, description, siteName };
  }

  let absoluteImageUrl: string;
  try {
    absoluteImageUrl = new URL(image, page.finalUrl).toString();
  } catch {
    return { status: "no_image", title, description, siteName };
  }

  const img = await fetchCapped(
    absoluteImageUrl,
    IMAGE_SIZE_CAP,
    { "user-agent": UA, referer: page.finalUrl },
    IMAGE_FETCH_TIMEOUT_MS,
  );
  if (!img.bytes || !img.contentType?.startsWith("image/")) {
    return { status: "no_image", title, description, siteName };
  }

  return { status: "ok", title, description, siteName, imageBytes: img.bytes };
}

async function reencodeForCard(bytes: Uint8Array): Promise<Uint8Array> {
  const decoded = await decodeImage(bytes);
  const image = decoded instanceof Image ? decoded : decoded.frames[0];
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  if (scale < 1) {
    image.resize(Math.round(image.width * scale), Math.round(image.height * scale));
  }
  return await image.encodeJPEG(JPEG_QUALITY);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let eventId: string | undefined;
  try {
    ({ eventId } = await req.json());
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!eventId) return jsonResponse({ error: "eventId is required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: event, error: fetchError } = await admin
    .from("events")
    .select("id, link, image_url, link_preview_status")
    .eq("id", eventId)
    .maybeSingle();
  if (fetchError || !event) return jsonResponse({ error: "Event not found" }, 404);

  // An uploaded photo always wins — don't waste a fetch/overwrite it.
  if (event.image_url || !event.link) {
    return jsonResponse({ status: "skipped" });
  }

  const result = await unfurl(event.link);

  let previewImageUrl: string | null = null;
  if (result.status === "ok" && result.imageBytes) {
    try {
      const jpeg = await reencodeForCard(result.imageBytes);
      const path = `previews/${eventId}.jpg`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;
      previewImageUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch (err) {
      console.error("[unfurl-link-preview] re-host failed", err);
      result.status = "error";
    }
  }

  await admin
    .from("events")
    .update({
      link_preview_image_url: previewImageUrl,
      link_preview_title: result.title ?? null,
      link_preview_description: result.description ?? null,
      link_preview_site_name: result.siteName ?? null,
      link_preview_fetched_at: new Date().toISOString(),
      link_preview_status: result.status,
    })
    .eq("id", eventId);

  return jsonResponse({ status: result.status });
});
