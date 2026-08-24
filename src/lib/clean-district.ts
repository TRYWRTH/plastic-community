/**
 * Strip redundant Google/administrative noise from a district or address
 * string (e.g. "10999 Berlin-Bezirk Friedrichshain-Kreuzberg, Berlin").
 *
 * Removes:
 *   - "Berlin-Bezirk " → ""
 *   - "Bezirk " → ""
 *   - ", Berlin" → ""
 *   - German 5-digit postal codes (e.g. "10999 ")
 */
export function cleanDistrictName(district: string | null | undefined): string {
  if (!district) return "";
  let s = String(district);

  s = s.replace(/\bBerlin-Bezirk\s+/gi, "");
  s = s.replace(/\bBezirk\s+/gi, "");
  s = s.replace(/,\s*Berlin\b/gi, "");
  s = s.replace(/\b\d{5}\b\s*/g, "");

  s = s
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/^[,\s-]+|[,\s-]+$/g, "")
    .trim();

  return s;
}

/**
 * Shorten a compound Berlin district name (e.g. "Friedrichshain-Kreuzberg")
 * to its primary segment for tight UI contexts like event cards and map pins.
 */
export function shortDistrictLabel(district: string | null | undefined): string {
  const cleaned = cleanDistrictName(district);
  if (!cleaned) return "";
  return cleaned.split("-")[0].trim();
}
