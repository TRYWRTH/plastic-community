import { NEIGHBORHOODS } from "@/lib/constants";

// Neighborhood names sorted longest first so multi-word/hyphenated ones
// (e.g. "Treptow-Köpenick") match before shorter prefixes.
const NEIGHBORHOOD_NAMES = NEIGHBORHOODS.map((n) => n.label).sort(
  (a, b) => b.length - a.length,
);

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip district/Bezirk noise from a Google-formatted address.
 *
 * Removes:
 *   - "Berlin-<Neighborhood>" → "Berlin"
 *   - "-Bezirk <Neighborhood>" → ""
 *   - "Bezirk <Neighborhood>" → ""
 *   - Bare ", <Neighborhood>" segments
 *
 * Safe to run on already-clean strings.
 */
export function cleanPlace(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);

  for (const name of NEIGHBORHOOD_NAMES) {
    const n = escapeRegExp(name);
    // "Berlin-Neukölln" / "Berlin-Treptow-Köpenick" → "Berlin"
    s = s.replace(new RegExp(`Berlin-${n}\\b`, "gi"), "Berlin");
    // "-Bezirk Treptow-Köpenick" → ""
    s = s.replace(new RegExp(`\\s*-\\s*Bezirk\\s+${n}\\b`, "gi"), "");
    // "Bezirk Treptow-Köpenick" → ""
    s = s.replace(new RegExp(`\\bBezirk\\s+${n}\\b`, "gi"), "");
    // ", Neukölln," / ", Neukölln" trailing/middle segments
    s = s.replace(new RegExp(`,\\s*${n}(?=,|$)`, "gi"), "");
  }

  // Generic "Bezirk <Word>" leftover (just in case)
  s = s.replace(/\bBezirk\s+[A-Za-zÄÖÜäöüß-]+\b/g, "");

  // Tidy whitespace, stray commas, double separators
  s = s
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/,\s*·/g, " ·")
    .replace(/^[,\s-]+|[,\s-]+$/g, "")
    .trim();

  return s;
}
