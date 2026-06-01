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

  // end_date may be "yyyy-MM-dd" or "yyyy-MM-ddTHH:mm"
  const endDate = parseEndDateEod(endDateOnly);
  const endTimeStr = endDateOnly.includes("T") ? ` · ${format(endDate, "HH:mm")}` : "";

  if (start.getMonth() === endDate.getMonth() && start.getFullYear() === endDate.getFullYear()) {
    return `${format(start, "d")}–${format(endDate, "d MMM").toUpperCase()}${endTimeStr}`;
  }
  return `${format(start, "d MMM").toUpperCase()}–${format(endDate, "d MMM").toUpperCase()}${endTimeStr}`;
}

/**
 * Parse end_date value into a local Date.
 * Accepts "yyyy-MM-dd" (end-of-day) or "yyyy-MM-ddTHH:mm" (exact time).
 */
export function parseEndDateEod(endDate: string): Date {
  if (endDate.includes("T")) {
    const [datePart, timePart] = endDate.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  const [y, m, d] = endDate.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
