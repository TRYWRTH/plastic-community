import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  format,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import type { Neighborhood } from "@/lib/constants";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type TimeFilter = "all" | "tonight" | "weekend";

/** 4+ days: pinned to the ON NOW shelf, never repeated across its middle days. */
export const LONG_RUN_MIN_DAYS = 4;

export type AgendaEvent = EventRow & {
  /** 1 on the event's own start day, 2 the day after, etc. */
  dayIndex: number;
  /** Total inclusive day span of the event, e.g. 3 for a 3-day run. */
  totalDays: number;
  /** True for 2-3 day runs (gets the "DAY N OF M" tag on every day). */
  isMultiDay: boolean;
  /** Set only for a long run's two calendar rows: its opening day and its last day. */
  edgeKind: "open" | "close" | null;
};

export type AgendaDay = {
  key: string; // ISO date, e.g. "2026-08-19"
  date: Date;
  relLabel: "TONIGHT" | "TOMORROW" | null;
  items: AgendaEvent[];
  /** Count of normal rows only (excludes long-run open/close edge rows). */
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

export function isLongRun(days: number): boolean {
  return days >= LONG_RUN_MIN_DAYS;
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

    if (isLongRun(totalDays)) {
      // Never expand across the middle days — only the opening day and the
      // last day get a row; everything in between lives in the shelf only.
      const openKey = toISODate(start);
      const closeKey = toISODate(end);
      pushOccurrence(openKey, {
        ...e,
        dayIndex: 1,
        totalDays,
        isMultiDay: false,
        edgeKind: "open",
      });
      if (closeKey !== openKey) {
        pushOccurrence(closeKey, {
          ...e,
          dayIndex: totalDays,
          totalDays,
          isMultiDay: false,
          edgeKind: "close",
        });
      }
    } else {
      for (const day of eachDayOfInterval({ start, end })) {
        pushOccurrence(toISODate(day), {
          ...e,
          dayIndex: differenceInCalendarDays(day, start) + 1,
          totalDays,
          isMultiDay: totalDays > 1,
          edgeKind: null,
        });
      }
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
      eventCount: items.filter((i) => !i.edgeKind).length,
    };
  });
}

/** Long runs currently active (today falls within their [start, end] range). */
export function getActiveRuns(events: EventRow[], opts: FilterOpts, now = new Date()): ActiveRun[] {
  const candidates = applyFilters(events, opts);
  const out: ActiveRun[] = [];
  for (const e of candidates) {
    const start = new Date(e.event_date);
    if (Number.isNaN(start.getTime())) continue;
    const rawEnd = parseEndDate(e);
    const end = rawEnd && !isBefore(rawEnd, start) ? rawEnd : start;
    const totalDays = spanDays(start, end);
    if (!isLongRun(totalDays)) continue;
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
