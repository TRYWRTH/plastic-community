// Normalize a user-supplied description before saving.
// - Strip HTML tags
// - Collapse runs of spaces/tabs to one
// - Cap consecutive blank lines (max 2 line breaks = 1 blank line between paragraphs)
// - Strip UTM tracking params from URLs (utm_*), preserving other params
// - Keep markdown links [text](url) and @handles intact
export function cleanDescription(input: string): string {
  if (!input) return "";
  let s = input;

  // Strip HTML tags (but leave bracketed markdown alone)
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // Normalize line endings
  s = s.replace(/\r\n?/g, "\n");

  // Strip UTM params from URLs (in markdown links and bare URLs)
  s = s.replace(/(https?:\/\/[^\s)]+)/g, (url) => stripUtm(url));

  // Collapse horizontal whitespace (spaces/tabs) to one, but preserve line breaks
  s = s.replace(/[ \t]+/g, " ");

  // Trim trailing spaces on each line
  s = s.replace(/ +\n/g, "\n");

  // Max 2 consecutive line breaks (= one blank line between paragraphs)
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

function stripUtm(url: string): string {
  try {
    const qIdx = url.indexOf("?");
    if (qIdx === -1) return url;
    const base = url.slice(0, qIdx);
    const rest = url.slice(qIdx + 1);
    // Separate fragment if present
    const hashIdx = rest.indexOf("#");
    const query = hashIdx === -1 ? rest : rest.slice(0, hashIdx);
    const frag = hashIdx === -1 ? "" : rest.slice(hashIdx);
    const kept = query
      .split("&")
      .filter((p) => p && !/^utm_/i.test(p.split("=")[0]));
    return base + (kept.length ? "?" + kept.join("&") : "") + frag;
  } catch {
    return url;
  }
}
