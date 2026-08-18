export type EventCardImageSource =
  | { url: string; kind: "upload" }
  | { url: string; kind: "preview"; siteName: string | null };

type EventImageFields = {
  image_url: string | null;
  link_preview_image_url: string | null;
  link_preview_site_name: string | null;
};

/**
 * Priority: an organiser-uploaded photo always wins; a re-hosted link
 * preview image is the fallback; otherwise null (render the generated
 * poster). Never returns a raw third-party URL — those images are always
 * re-hosted in our own storage before being written to the row.
 */
export function resolveCardImage(event: EventImageFields): EventCardImageSource | null {
  if (event.image_url) return { url: event.image_url, kind: "upload" };
  if (event.link_preview_image_url) {
    return {
      url: event.link_preview_image_url,
      kind: "preview",
      siteName: event.link_preview_site_name,
    };
  }
  return null;
}
