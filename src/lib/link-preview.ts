import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: asks the unfurl-link-preview edge function to fetch the
 * event's link and re-host its og:image for card display. Never awaited by
 * the caller — publishing/saving must not block on a third-party fetch, and
 * a failure here just means the card falls back to the generated poster.
 */
export function triggerLinkPreviewUnfurl(eventId: string) {
  void supabase.functions.invoke("unfurl-link-preview", { body: { eventId } }).catch((err) => {
    console.error("[link-preview] unfurl trigger failed", err);
  });
}
