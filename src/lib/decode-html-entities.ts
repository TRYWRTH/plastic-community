// Named entities that show up in stored descriptions — HTML tags are
// stripped on save (see clean-description.ts), but named entities like
// "&gt;" pass through as literal characters and render as-is in plain text.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decode HTML entities in plain text (e.g. "&gt;" -> ">", "&amp;" -> "&"),
 * so previews built from stored descriptions render correctly instead of
 * showing the raw entity string. Safe to run on already-decoded text.
 */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    const lower = code.toLowerCase();
    return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : match;
  });
}
