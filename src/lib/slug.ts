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
  const match = slugOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return match ? match[0] : slugOrId;
}
