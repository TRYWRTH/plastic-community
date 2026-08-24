/**
 * Convert an event title into a URL-safe slug and append the UUID.
 * E.g., "Fuck Season is Back!" + "be249f6c-f2ba-43dc-bbc8-bb1fa1dccbe1"
 * -> "fuck-season-is-back-be249f6c-f2ba-43dc-bbc8-bb1fa1dccbe1"
 */
export function createEventSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens

  return `${slug}-${id}`;
}

/**
 * Extract the UUID from a slug-id param, or return the raw string if it's already just a UUID.
 * E.g., "fuck-season-is-back-be249f6c-f2ba-43dc-bbc8-bb1fa1dccbe1" -> "be249f6c-f2ba-43dc-bbc8-bb1fa1dccbe1"
 * E.g., "be249f6c-f2ba-43dc-bbc8-bb1fa1dccbe1" -> "be249f6c-f2ba-43dc-bbc8-bb1fa1dccbe1"
 */
export function extractIdFromSlug(slugOrId: string): string {
  // UUID v4 format: 8-4-4-4-12 hex digits with hyphens
  const uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
  const match = slugOrId.match(uuidRegex);
  return match ? match[1] : slugOrId;
}
