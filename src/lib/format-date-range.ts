import { format } from "date-fns";

/**
 * Format a single-day or multi-day event date range.
 * Examples:
 *   - single day → "FRI, MAY 29 · 20:00"
 *   - same month → "29–31 MAY"
 *   - cross-month → "29 MAY–2 JUN"
 */
export function formatEventDateRange(
  start: Date,
  endDateOnly: string | null | undefined,
  opts: { withTime?: boolean; withWeekday?: boolean } = {},
): string {
  const { withTime = false, withWeekday = false } = opts;

  if (!endDateOnly) {
    const parts: string[] = [];
    if (withWeekday) parts.push(format(start, "EEE, "));
    parts.push(format(start, withWeekday ? "MMM d" : "EEE, MMM d"));
    if (withTime) parts.push(` · ${format(start, "HH:mm")}`);
    // simpler:
    return withTime
      ? format(start, "EEE, MMM d · HH:mm")
      : format(start, "EEE, MMM d");
  }

  // end is "yyyy-MM-dd"
  const [ey, em, ed] = endDateOnly.split("-").map(Number);
  const end = new Date(ey, em - 1, ed);

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, "d")}–${format(end, "d MMM").toUpperCase()}`;
  }
  return `${format(start, "d MMM").toUpperCase()}–${format(end, "d MMM").toUpperCase()}`;
}

/** Parse "yyyy-MM-dd" end_date into a local Date at end-of-day (23:59:59.999). */
export function parseEndDateEod(endDateOnly: string): Date {
  const [y, m, d] = endDateOnly.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
