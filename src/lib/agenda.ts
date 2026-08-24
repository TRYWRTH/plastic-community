import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import type { Neighborhood } from "@/lib/constants";

// Matches EVENT_LIST_COLUMNS in src/routes/index.tsx — the trimmed set of
// columns the home/radar agenda actually needs, not the full events row.
export type EventRow = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  | "id"
  | "created_by"
  | "title"
  | "description"
  | "place"
  | "neighborhood"
  | "event_date"
  | "end_date"
  | "end_time"
  | "event_type"
  | "is_secret"
  | "location_tba"
  | "image_url"
  | "link_preview_image_url"
  | "link_preview_site_name"
>;

export type TimeFilter = "all" | "tonight" | "weekend";

export type AgendaEvent = EventRow & {
  /** 1 on the event's own start day, 2 the day after, etc. */
  dayIndex: number;
  /** Total inclusive day span of the event, e.g. 3 for a 3-day run. */
  totalDays: number;
  /** Set only on a not-yet-started multi-day run's single teaser row, e.g. "29-30 AUG". */
  dateRangeLabel: string | null;
  /** Set only for a run's two calendar rows once it has started: its opening day and its last day. */
  edgeKind: "open" | "close" | null;
};

export type AgendaDay = {
  key: string; // ISO date, e.g. "2026-08-19"
  date: Date;
  relLabel: "TONIGHT" | "TOMORROW" | null;
  items: AgendaEvent[];
  /** Count of events happening this day — includes long-run open/close edge rows. */
  eventCount: number;
};

export type ActiveRun = {
  event: EventRow;
  start: Date;
  end: Date;
  totalDays: number;
};

const MAX_DAYS = 60;

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseEndDate(event: EventRow): Date | null {
  if (!event.end_date) return null;
  const d = new Date(event.end_date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Inclusive day span between a start and end instant, e.g. same-day = 1. */
export function spanDays(start: Date, end: Date): number {
  return Math.max(1, differenceInCalendarDays(startOfDay(end), startOfDay(start)) + 1);
}

/** e.g. "29-30 AUG" for a same-month run, "29 AUG - 2 SEP" across months. */
function formatDateRangeLabel(start: Date, end: Date): string {
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${format(start, "d")}-${format(end, "d MMM")}`;
  }
  return `${format(start, "d MMM")} - ${format(end, "d MMM")}`;
}

/** Recurring series: only the nearest upcoming occurrence of each (creator + title) survives. */
function dedupeRecurring(events: EventRow[]): EventRow[] {
  const byKey = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = `${e.created_by}::${e.title}`;
    const arr = byKey.get(key) ?? [];
    arr.push(e);
    byKey.set(key, arr);
  }
  const hiddenIds = new Set<string>();
  for (const arr of byKey.values()) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
    );
    const [, ...rest] = sorted;
    for (const e of rest) hiddenIds.add(e.id);
  }
  return events.filter((e) => !hiddenIds.has(e.id));
}

/** Upcoming (or current) Saturday + Sunday, per how people actually mean "this weekend". */
function weekendDates(today: Date): Date[] {
  const dow = today.getDay();
  if (dow === 0) return [today];
  if (dow === 6) return [today, addDays(today, 1)];
  const sat = addDays(today, 6 - dow);
  return [sat, addDays(sat, 1)];
}

type FilterOpts = { district: Neighborhood | "all"; search: string };

/** District + text filter shared by the day list and the ON NOW shelf. */
function applyFilters(events: EventRow[], opts: FilterOpts): EventRow[] {
  const q = opts.search.trim().toLowerCase();
  const today = startOfDay(new Date());
  const candidates = events.filter((e) => {
    if (!e.event_date) return false;
    const start = new Date(e.event_date);
    if (Number.isNaN(start.getTime())) return false;
    const end = parseEndDate(e) ?? start;
    if (isBefore(end, today) && !isSameDay(end, today)) return false;
    if (opts.district !== "all" && e.neighborhood !== opts.district) return false;
    if (q) {
      const hay = `${e.title} ${e.place} ${e.neighborhood} ${e.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return dedupeRecurring(candidates);
}

/**
 * How many upcoming events match the current search + WHEN filter, broken
 * down by district — powers the WHERE dropdown's counts. Ignores the
 * district filter itself so every district's count reflects what picking
 * it would show.
 */
export function getDistrictCounts(
  events: EventRow[],
  opts: { search: string; timeFilter: TimeFilter },
): { total: number; byDistrict: Partial<Record<Neighborhood, number>> } {
  const today = startOfDay(new Date());
  const todayISO = toISODate(today);
  const weekendKeys = [...weekendDates(today)].map(toISODate);
  const candidates = applyFilters(events, { district: "all", search: opts.search });

  let total = 0;
  const byDistrict: Partial<Record<Neighborhood, number>> = {};
  for (const e of candidates) {
    const start = startOfDay(new Date(e.event_date));
    const rawEnd = parseEndDate(e);
    const end = rawEnd && !isBefore(rawEnd, start) ? startOfDay(rawEnd) : start;
    const startKey = toISODate(start);
    const endKey = toISODate(end);

    if (opts.timeFilter === "tonight" && (startKey > todayISO || endKey < todayISO)) continue;
    if (opts.timeFilter === "weekend" && !weekendKeys.some((k) => k >= startKey && k <= endKey)) {
      continue;
    }

    total += 1;
    byDistrict[e.neighborhood] = (byDistrict[e.neighborhood] ?? 0) + 1;
  }
  return { total, byDistrict };
}

export function buildAgendaDays(
  events: EventRow[],
  opts: FilterOpts & { timeFilter: TimeFilter },
): AgendaDay[] {
  const now = new Date();
  const today = startOfDay(now);
  const todayISO = toISODate(today);
  const candidates = applyFilters(events, opts);
  const weekendKeys = new Set(weekendDates(today).map(toISODate));

  const dayMap = new Map<string, AgendaEvent[]>();
  const pushOccurrence = (key: string, item: AgendaEvent) => {
    if (key < todayISO) return;
    if (opts.timeFilter === "tonight" && key !== todayISO) return;
    if (opts.timeFilter === "weekend" && !weekendKeys.has(key)) return;
    const arr = dayMap.get(key) ?? [];
    arr.push(item);
    dayMap.set(key, arr);
  };

  for (const e of candidates) {
    const start = startOfDay(new Date(e.event_date));
    const rawEnd = parseEndDate(e);
    const end = rawEnd && !isBefore(rawEnd, start) ? startOfDay(rawEnd) : start;
    const totalDays = spanDays(start, end);

    if (totalDays > 1 && isBefore(today, start)) {
      // Entirely future multi-day run: a single teaser row with the date
      // range in brackets, not repeated across every day.
      pushOccurrence(toISODate(start), {
        ...e,
        dayIndex: 1,
        totalDays,
        dateRangeLabel: formatDateRangeLabel(start, end),
        edgeKind: null,
      });
    } else if (totalDays > 1) {
      // Already started (or starting today): never expand across the middle
      // days — only the opening day and the last day get a row; everything
      // in between lives in the ON NOW shelf only.
      const openKey = toISODate(start);
      const closeKey = toISODate(end);
      pushOccurrence(openKey, {
        ...e,
        dayIndex: 1,
        totalDays,
        dateRangeLabel: null,
        edgeKind: "open",
      });
      if (closeKey !== openKey) {
        pushOccurrence(closeKey, {
          ...e,
          dayIndex: totalDays,
          totalDays,
          dateRangeLabel: null,
          edgeKind: "close",
        });
      }
    } else {
      pushOccurrence(toISODate(start), {
        ...e,
        dayIndex: 1,
        totalDays,
        dateRangeLabel: null,
        edgeKind: null,
      });
    }
  }

  const dayKeys = [...dayMap.keys()].sort().slice(0, MAX_DAYS);
  const tomorrow = addDays(today, 1);

  return dayKeys.map((key) => {
    const date = new Date(`${key}T00:00:00`);
    const items = (dayMap.get(key) ?? []).sort((a, b) => {
      // Edge rows (flag pills) lead the day, then normal rows by start time.
      if (!!a.edgeKind !== !!b.edgeKind) return a.edgeKind ? -1 : 1;
      const ta = new Date(a.event_date);
      const tb = new Date(b.event_date);
      return ta.getHours() * 60 + ta.getMinutes() - (tb.getHours() * 60 + tb.getMinutes());
    });
    return {
      key,
      date,
      relLabel: isSameDay(date, today) ? "TONIGHT" : isSameDay(date, tomorrow) ? "TOMORROW" : null,
      items,
      eventCount: items.length,
    };
  });
}

/** Multi-day runs currently active (today falls within their [start, end] range). */
export function getActiveRuns(events: EventRow[], opts: FilterOpts, now = new Date()): ActiveRun[] {
  const candidates = applyFilters(events, opts);
  const out: ActiveRun[] = [];
  for (const e of candidates) {
    const start = new Date(e.event_date);
    if (Number.isNaN(start.getTime())) continue;
    const rawEnd = parseEndDate(e);
    const end = rawEnd && !isBefore(rawEnd, start) ? rawEnd : start;
    const totalDays = spanDays(start, end);
    if (totalDays < 2) continue;
    if (now < startOfDay(start) || now > endOfDay(end)) continue;
    out.push({ event: e, start, end, totalDays });
  }
  return out;
}

/** Elapsed share of a run, 0-100, clamped. */
export function runProgressPct(now: Date, start: Date, end: Date): number {
  const days = spanDays(start, end);
  const elapsed = differenceInCalendarDays(startOfDay(now), startOfDay(start)) + 1;
  return Math.max(0, Math.min(100, Math.round((elapsed / days) * 100)));
}

/** Days remaining until (and including) the run's last day. */
export function daysRemaining(now: Date, end: Date): number {
  return Math.max(0, differenceInCalendarDays(startOfDay(end), startOfDay(now)));
}

export function runDurationLabel(days: number): string {
  if (days >= 26) return "RUNS ALL MONTH";
  if (days >= 13) return `RUNS ${Math.round(days / 7)} WEEKS`;
  return `RUNS ${days} DAYS`;
}

export function runUrgencyLabel(now: Date, end: Date): string {
  const left = daysRemaining(now, end);
  if (left === 0) return "LAST DAY";
  if (left === 1) return "LAST DAY TOMORROW";
  return `${left} DAYS LEFT`;
}

/**
 * Hours label for a run/event, e.g. "17:00 – 21:00" or "FROM 20:00" when no
 * end time was set. Never falls back to a literal "LATE".
 */
export function hoursRangeLabel(
  start: Date,
  endTime: string | null,
  opts: { daily?: boolean } = {},
): string {
  const startStr = format(start, "HH:mm");
  const suffix = opts.daily ? " DAILY" : "";
  if (endTime) {
    return `${startStr} – ${endTime.slice(0, 5)}${suffix}`;
  }
  return `FROM ${startStr}${suffix}`;
}
