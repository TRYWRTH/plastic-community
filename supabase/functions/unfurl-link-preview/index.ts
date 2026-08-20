// Fetches a preview image/title/description for an event's link (typically
// an Instagram post) via Microlink's unfurl API, then re-hosts the image in
// our own storage so event cards without an uploaded photo can still show
// something real instead of a blank box. Runs out-of-band (invoked
// fire-and-forget after publish/edit), never on the request that creates or
// updates the event.
//
// Why Microlink instead of fetching the page ourselves: Instagram detects
// and blocks plain server-side fetches (even with browser-like headers) —
// it renders a login wall instead of the real post. Microlink already
// solves that on their end (this app's existing detail-page link preview
// card proves it works). Why re-host rather than link Microlink's own image
// URL directly: it's still a third-party URL outside our control:
// unpredictable caching/availability long-term, so we keep our own copy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MICROLINK_TIMEOUT_MS = 12_000;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_SIZE_CAP = 5_000_000; // 5 MB
const BUCKET = "event-images";

type PreviewResult = {
  status: "ok" | "no_image" | "blocked" | "error";
  title?: string | null;
  description?: string | null;
  siteName?: string | null;
  imageBytes?: Uint8Array;
  imageContentType?: string;
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

/** Rejects anything that isn't a plain http(s) URL to a public host, and strips tracking params. */
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
): Promise<{ ok: boolean; status: number; contentType: string | null; bytes: Uint8Array | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    const contentType = res.headers.get("content-type");
    if (!res.ok || !res.body) {
      return { ok: res.ok, status: res.status, contentType, bytes: null };
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
        return { ok: true, status: res.status, contentType, bytes: null };
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return { ok: true, status: res.status, contentType, bytes: merged };
  } catch {
    return { ok: false, status: 0, contentType: null, bytes: null };
  } finally {
    clearTimeout(timer);
  }
}

type MicrolinkResponse = {
  status?: string;
  data?: {
    title?: string | null;
    description?: string | null;
    image?: { url?: string } | null;
    publisher?: string | null;
  };
};

async function unfurl(rawUrl: string): Promise<PreviewResult> {
  const url = normaliseUrl(rawUrl);
  if (!url) return { status: "error" };

  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url.toString())}`;
  const page = await fetchCapped(
    apiUrl,
    2_000_000,
    { accept: "application/json" },
    MICROLINK_TIMEOUT_MS,
  );
  if (!page.ok || !page.bytes) {
    console.error("[unfurl-link-preview] microlink request failed", {
      status: page.status,
      ok: page.ok,
    });
    return { status: page.status === 429 ? "blocked" : "error" };
  }

  let json: MicrolinkResponse;
  try {
    json = JSON.parse(new TextDecoder().decode(page.bytes));
  } catch {
    return { status: "error" };
  }

  if (json.status !== "success" || !json.data) {
    console.error("[unfurl-link-preview] microlink returned no data", json.status);
    return { status: "no_image" };
  }

  const { title, description, publisher, image } = json.data;
  const siteName = publisher ?? url.hostname.replace(/^www\./, "");

  if (!image?.url) {
    return { status: "no_image", title, description, siteName };
  }

  const img = await fetchCapped(
    image.url,
    IMAGE_SIZE_CAP,
    { "user-agent": UA },
    IMAGE_FETCH_TIMEOUT_MS,
  );
  if (!img.bytes || !img.contentType?.startsWith("image/")) {
    return { status: "no_image", title, description, siteName };
  }

  return {
    status: "ok",
    title,
    description,
    siteName,
    imageBytes: img.bytes,
    imageContentType: img.contentType ?? "image/jpeg",
  };
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
      const bytes = result.imageBytes;
      const contentType = result.imageContentType ?? "image/jpeg";
      const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
      const path = `previews/${eventId}.${ext}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;
      previewImageUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch (err) {
      console.error("[unfurl-link-preview] re-host failed", err);
      result.status = "error";
    }
  }

  const { error: updateError } = await admin
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

  if (updateError) {
    console.error("[unfurl-link-preview] failed to write result", updateError);
    return jsonResponse({ status: result.status, writeError: updateError.message }, 500);
  }

  return jsonResponse({ status: result.status, previewImageUrl });
});
