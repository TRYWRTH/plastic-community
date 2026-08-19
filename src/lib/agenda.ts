import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import type { Neighborhood } from "@/lib/constants";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type TimeFilter = "all" | "tonight" | "weekend";

export type AgendaEvent = EventRow & {
  /** 1 on the event's own start day, 2 the day after, etc. */
  dayIndex: number;
  /** True when the event's end_date resolves to a different calendar day than its start. */
  isMultiDay: boolean;
};

export type AgendaDay = {
  key: string; // ISO date, e.g. "2026-08-19"
  date: Date;
  relLabel: "TONIGHT" | "TOMORROW" | null;
  items: AgendaEvent[];
};

const MAX_DAYS = 60;

function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseEndDate(event: EventRow): Date | null {
  if (!event.end_date) return null;
  const d = new Date(event.end_date);
  return Number.isNaN(d.getTime()) ? null : d;
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

export function buildAgendaDays(
  events: EventRow[],
  opts: { district: Neighborhood | "all"; search: string; timeFilter: TimeFilter },
): AgendaDay[] {
  const now = new Date();
  const today = startOfDay(now);
  const q = opts.search.trim().toLowerCase();

  let candidates = events.filter((e) => {
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

  candidates = dedupeRecurring(candidates);

  const weekendKeys = new Set(weekendDates(today).map(toISODate));

  const dayMap = new Map<string, AgendaEvent[]>();
  for (const e of candidates) {
    const start = startOfDay(new Date(e.event_date));
    const rawEnd = parseEndDate(e);
    const end = rawEnd ? startOfDay(rawEnd) : start;
    const rangeStart = isBefore(start, today) ? today : start;
    if (isBefore(end, rangeStart)) continue;

    for (const day of eachDayOfInterval({ start: rangeStart, end })) {
      const key = toISODate(day);
      if (opts.timeFilter === "tonight" && !isSameDay(day, today)) continue;
      if (opts.timeFilter === "weekend" && !weekendKeys.has(key)) continue;
      const arr = dayMap.get(key) ?? [];
      arr.push({
        ...e,
        dayIndex: differenceInCalendarDays(day, start) + 1,
        isMultiDay: !isSameDay(start, end),
      });
      dayMap.set(key, arr);
    }
  }

  const dayKeys = [...dayMap.keys()].sort().slice(0, MAX_DAYS);
  const tomorrow = addDays(today, 1);

  return dayKeys.map((key) => {
    const date = new Date(`${key}T00:00:00`);
    const items = (dayMap.get(key) ?? []).sort((a, b) => {
      const ta = new Date(a.event_date);
      const tb = new Date(b.event_date);
      return ta.getHours() * 60 + ta.getMinutes() - (tb.getHours() * 60 + tb.getMinutes());
    });
    return {
      key,
      date,
      relLabel: isSameDay(date, today) ? "TONIGHT" : isSameDay(date, tomorrow) ? "TOMORROW" : null,
      items,
    };
  });
}
