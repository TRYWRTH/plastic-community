import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, isAfter, isBefore, startOfDay, endOfDay, addDays, isSameDay } from "date-fns";
import { MapPin, Calendar, ExternalLink, Search, X, List, Map as MapIcon } from "lucide-react";
import { Calendar as CalendarPicker, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DayButton } from "react-day-picker";
import { EventsMap } from "@/components/EventsMap";

import { Header } from "@/components/Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { EnablePushBanner } from "@/components/EnablePushBanner";
import { SaveCountsLine } from "@/components/SaveCountsLine";
import { useAllEventSaveCounts } from "@/lib/use-event-save-counts";

import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_TYPES,
  BERLIN_DISTRICTS,
  GERMAN_STATES,
  eventTypeMeta,
  neighborhoodMeta,
  type EventType,
  type Neighborhood,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cleanPlace } from "@/lib/clean-place";
import { formatEventDateRange, parseEndDateEod } from "@/lib/format-date-range";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DATE_FILTERS = ["all", "today", "tomorrow", "week", "next_week", "upcoming", "past"] as const;
type DateFilter = (typeof DATE_FILTERS)[number];

export const Route = createFileRoute("/")({
  component: Home,
});

async function fetchEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw error;
  return data;
}

function Home() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });
  const { data: countsMap } = useAllEventSaveCounts();

  const isMobile = useIsMobile();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [calOpenDesktop, setCalOpenDesktop] = useState(false);
  const [calOpenMobile, setCalOpenMobile] = useState(false);
  const [neighborhood, setNeighborhood] = useState<Neighborhood | "all">("all");
  const [eventType, setEventType] = useState<EventType | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Fetch all distinct event dates for calendar highlighting — separate lightweight query.
  const { data: rawEventDates } = useQuery({
    queryKey: ["event-dates-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("event_date")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0, // always fresh — lightweight query, just dates
  });

  const eventDates = useMemo(() => {
    const now = new Date();
    const s = new Set<string>();
    for (const row of rawEventDates ?? []) {
      if (!row.event_date) continue;
      const d = new Date(row.event_date);
      if (isNaN(d.getTime())) continue;
      // Only include upcoming events (matching the feed's real-time cutoff).
      // Use local date for consistency with isSameDay() in the filter.
      if (d > now) s.add(format(d, "yyyy-MM-dd"));
    }
    return s;
  }, [rawEventDates]);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const open = () => setMobileSearchOpen(true);
    window.addEventListener("whisperring:open-search", open);
    return () => window.removeEventListener("whisperring:open-search", open);
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    mobileSearchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSearchOpen]);




  const filtered = useMemo(() => {
    const cutoffPast = addDays(startOfDay(now), -30);

    const todayStart = startOfDay(now);
    const hiddenIds = new Set<string>();

    // Group future events by title+created_by to detect recurring series copies.
    const futureByKey = new Map<string, typeof events>();
    for (const e of events) {
      if (!e.event_date) continue;
      const d = new Date(e.event_date);
      if (isNaN(d.getTime()) || isBefore(d, todayStart)) continue;
      const key = `${e.created_by}::${e.title}`;
      const arr = futureByKey.get(key) ?? [];
      arr.push(e);
      futureByKey.set(key, arr);
    }
    for (const arr of futureByKey.values()) {
      if (arr.length < 2) continue;
      const sorted = [...arr].sort(
        (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
      );
      if (pickedDate) {
        // A specific date is selected — skip dedup entirely so every occurrence
        // on that day is visible. The isSameDay check below handles narrowing.
        continue;
      } else {
        // Show only the nearest upcoming occurrence of recurring series.
        const [, ...rest] = sorted;
        for (const e of rest) hiddenIds.add(e.id);
      }
    }

    const result = events.filter((e) => {
      if (hiddenIds.has(e.id)) return false;
      const hasDate = !!e.event_date && !isNaN(new Date(e.event_date).getTime());
      const d = hasDate ? new Date(e.event_date) : null;
      const endD = e.end_date ? parseEndDateEod(e.end_date) : null;
      // Effective range end for "is this event active on day X" checks
      const rangeEnd = endD && d && endD > d ? endD : d;


      if (dateFilter === "past") {
        if (!d) return false;
        if (!isBefore(d, startOfDay(now))) return false;
        if (isBefore(d, cutoffPast)) return false;
      } else {
        if (dateFilter === "today") {
          if (!d || !rangeEnd) return false;
          // Today falls within [start, end]
          if (isAfter(d, endOfDay(now))) return false;
          if (isBefore(rangeEnd, startOfDay(now))) return false;
        }
        if (dateFilter === "tomorrow") {
          if (!d || !rangeEnd) return false;
          const tStart = startOfDay(addDays(now, 1));
          const tEnd = endOfDay(addDays(now, 1));
          if (isAfter(d, tEnd)) return false;
          if (isBefore(rangeEnd, tStart)) return false;
        }
        if (dateFilter === "week") {
          if (!d || !rangeEnd) return false;
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
          endOfWeek.setHours(23, 59, 59, 999);
          if (isAfter(d, endOfWeek)) return false;
          if (isBefore(rangeEnd, now)) return false;
        }
        if (dateFilter === "next_week") {
          if (!d || !rangeEnd) return false;
          const startOfNextWeek = new Date(now);
          startOfNextWeek.setDate(now.getDate() - now.getDay() + 1 + 7); // Next Monday
          startOfNextWeek.setHours(0, 0, 0, 0);
          const endOfNextWeek = new Date(startOfNextWeek);
          endOfNextWeek.setDate(startOfNextWeek.getDate() + 6); // Following Sunday
          endOfNextWeek.setHours(23, 59, 59, 999);
          if (isAfter(d, endOfNextWeek)) return false;
          if (isBefore(rangeEnd, startOfNextWeek)) return false;
        }
        // upcoming: exclude events whose exact start time has already passed
        if (dateFilter === "upcoming" && d && isBefore(d, now)) return false;
        // upcoming: include multi-day events still running (end hasn't passed)
        if (dateFilter === "upcoming" && rangeEnd && !d && isBefore(rangeEnd, now)) return false;

      }

      // Date-picker filter: compare as local YYYY-MM-DD strings to avoid timezone mismatch
      if (pickedDate) {
        if (!d) return false;
        if (format(d, "yyyy-MM-dd") !== format(pickedDate, "yyyy-MM-dd")) return false;
      }

      if (neighborhood !== "all" && e.neighborhood !== neighborhood) return false;
      if (eventType !== "all" && e.event_type !== eventType) return false;

      const q = searchText.trim().toLowerCase();
      if (q) {
        const hay = `${e.title ?? ""} ${e.place ?? ""} ${e.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (dateFilter === "past") {
      return [...result].sort(
        (a, b) =>
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
      );
    }
    // Dated ascending, undated at the bottom
    return [...result].sort((a, b) => {
      const ta = a.event_date ? new Date(a.event_date).getTime() : NaN;
      const tb = b.event_date ? new Date(b.event_date).getTime() : NaN;
      const aBad = isNaN(ta);
      const bBad = isNaN(tb);
      if (aBad && bBad) return 0;
      if (aBad) return 1;
      if (bBad) return -1;
      return ta - tb;
    });
  }, [events, dateFilter, pickedDate, neighborhood, eventType, searchText, now]);

  const recurringByKey = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const groups = new Map<string, typeof events>();
    for (const e of events) {
      if (!e.event_date) continue;
      const d = new Date(e.event_date);
      if (isNaN(d.getTime()) || isBefore(d, todayStart)) continue;
      const key = `${e.created_by}::${e.title}`;
      const arr = groups.get(key) ?? [];
      arr.push(e);
      groups.set(key, arr);
    }
    const map = new Map<string, string>();
    for (const [key, arr] of groups.entries()) {
      const parent = arr.find((e) => e.repeats && e.repeats !== "none");
      if (parent) map.set(key, parent.repeats as string);
      else if (arr.length > 1) map.set(key, "weekly");
    }
    return map;
  }, [events]);

  // Build district filter options: all Berlin districts always shown,
  // non-Berlin states only when at least one event uses them.
  const districtOptions = useMemo(() => {
    const usedStates = new Set(
      events
        .map((e) => e.neighborhood)
        .filter((n): n is Neighborhood => !!n && GERMAN_STATES.some((s) => s.value === n)),
    );
    const stateOptions = GERMAN_STATES.filter((s) => usedStates.has(s.value));
    return [
      { value: "all" as const, label: "ALL DISTRICTS" },
      ...BERLIN_DISTRICTS.map((n) => ({ value: n.value, label: n.label })),
      ...stateOptions.map((n) => ({ value: n.value, label: n.label, isState: true as const })),
    ];
  }, [events]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper">
      <Header />
      {/* Notifications hidden temporarily — feature kept for later testing */}
      {false && <EnablePushBanner />}

      {/* Hero */}
      <section>
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-3 sm:pb-4 sm:pt-4">
          <a
            href="https://www.instagram.com/plastic_productions_/"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-primary hover:text-primary-foreground sm:text-[11px]"
          >
            Brought to you by Plastic Productions
          </a>
          <h1 className="mt-3 font-brand text-[3rem] uppercase leading-[0.95] text-foreground text-balance sm:text-[7.5rem]">
            Whisper
            <br />
            Ring
          </h1>
          <p className="mt-2 max-w-xl text-balance font-mono text-xs uppercase tracking-wide text-foreground sm:mt-3 sm:text-sm">
            if you know, you know
          </p>
        </div>
      </section>




      {/* Mobile search overlay */}
      {mobileSearchOpen && (
        <div className="fixed inset-x-0 top-0 z-50 border-b-2 border-foreground bg-background sm:hidden">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3">
            <Search className="h-4 w-4 shrink-0 text-foreground" />
            <input
              ref={mobileSearchRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search events…"
              aria-label="Search events"
              className="h-9 w-full rounded-none border-0 bg-transparent font-mono text-xs uppercase tracking-wider placeholder:text-foreground/50 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
              }}
              aria-label="Close search"
              className="grid h-8 w-8 shrink-0 place-items-center border-2 border-foreground bg-background hover:bg-foreground hover:text-background"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <section className="sticky top-0 z-30 border-b-2 border-foreground bg-background">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
          {/* Desktop-only search bar */}
          <div className="relative hidden w-full sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search events…"
              aria-label="Search events"
              className="h-9 w-full rounded-none border-2 border-foreground bg-background pl-9 pr-9 font-mono text-xs uppercase tracking-wider placeholder:text-foreground/50 focus:outline-none focus:ring-0"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center border border-foreground bg-background hover:bg-foreground hover:text-background"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <FilterSelect
              value={dateFilter}
              onChange={(v) => setDateFilter(v as DateFilter)}
              shortLabel="WHEN"
              defaultValue="upcoming"
              options={[
                { value: "upcoming", label: "UPCOMING" },
                { value: "today", label: "Today" },
                { value: "tomorrow", label: "Tomorrow" },
                { value: "week", label: "This week" },
                { value: "next_week", label: "Next week" },
                { value: "all", label: "Any time" },
                { value: "past", label: "Past (last 30 days)" },
              ]}
            />
            <FilterSelect
              value={neighborhood}
              onChange={(v) => setNeighborhood(v as Neighborhood | "all")}
              shortLabel="DISTRICT"
              defaultValue="all"
              options={districtOptions}
            />

            <FilterSelect
              value={eventType}
              onChange={(v) => setEventType(v as EventType | "all")}
              shortLabel="CATEGORY"
              defaultValue="all"
              options={[
                { value: "all", label: "ALL CATEGORIES" },
                ...EVENT_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />


            {(dateFilter !== "upcoming" || neighborhood !== "all" || eventType !== "all" || pickedDate) && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter("upcoming");
                  setNeighborhood("all");
                  setEventType("all");
                  setPickedDate(undefined);
                }}
                className="col-span-3 flex h-9 items-center gap-1 px-1 font-mono text-[10px] uppercase tracking-widest text-foreground/50 hover:text-foreground sm:col-span-1 sm:h-auto"
              >
                <X className="h-3 w-3" />
                Reset
              </button>
            )}

            {/* Desktop view toggle + calendar */}
            <div className="hidden items-stretch border-2 border-foreground sm:flex">
              <Popover open={calOpenDesktop} onOpenChange={setCalOpenDesktop}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Filter by date"
                    className={`flex h-9 items-center justify-center px-3 ${
                      pickedDate
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-foreground/10"
                    }`}
                  >
                    <Calendar className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-none border-2 border-foreground p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={pickedDate}
                    onSelect={(d) => {
                      if (d && pickedDate && isSameDay(d, pickedDate)) {
                        setPickedDate(undefined);
                      } else {
                        setPickedDate(d);
                      }
                      setCalOpenDesktop(false);
                    }}
                    modifiers={{ hasEvents: (d) => eventDates.has(format(d, "yyyy-MM-dd")) }}
                    modifiersClassNames={{ hasEvents: "bg-primary text-primary-foreground rounded-md" }}
                    components={{
                      DayButton: ({ day, modifiers, children, ...props }: React.ComponentProps<typeof DayButton>) => (
                        <CalendarDayButton
                          day={day}
                          modifiers={modifiers}
                          {...props}
                          className={[props.className, modifiers.today ? "font-bold" : ""].filter(Boolean).join(" ")}
                        >
                          {children}
                        </CalendarDayButton>
                      ),
                    }}
                    className="p-3"
                  />
                  {pickedDate && (
                    <div className="border-t-2 border-foreground px-3 py-2">
                      <button
                        type="button"
                        onClick={() => { setPickedDate(undefined); setCalOpenDesktop(false); }}
                        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-foreground/50 hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                        Clear date
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={`flex h-[42px] items-center justify-center border-l-2 border-foreground px-3 ${
                  viewMode === "list"
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-foreground/10"
                }`}
              >
                <List className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Map view"
                aria-pressed={viewMode === "map"}
                onClick={() => setViewMode("map")}
                className={`flex h-[42px] items-center justify-center border-l-2 border-foreground px-3 ${
                  viewMode === "map"
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-foreground/10"
                }`}
              >
                <MapIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Results header (count + view toggle). Toggle is mobile-only; count shows on all sizes. */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-3 sm:pt-4">
        <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/60">
          {isLoading ? "…" : `${filtered.length} event${filtered.length === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-0.5 sm:hidden">
          {/* Mobile calendar picker */}
          <Popover open={calOpenMobile} onOpenChange={setCalOpenMobile}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Filter by date"
                className={`grid h-10 w-10 place-items-center ${
                  pickedDate ? "text-primary" : "text-foreground/40 hover:text-foreground"
                }`}
              >
                <Calendar className="h-[22px] w-[22px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-none border-2 border-foreground p-0" align="end">
              <CalendarPicker
                mode="single"
                selected={pickedDate}
                onSelect={(d) => {
                  if (d && pickedDate && isSameDay(d, pickedDate)) {
                    setPickedDate(undefined);
                  } else {
                    setPickedDate(d);
                  }
                  setCalOpenMobile(false);
                }}
                modifiers={{ hasEvents: (d) => eventDates.has(format(d, "yyyy-MM-dd")) }}
                modifiersClassNames={{ hasEvents: "bg-primary text-primary-foreground rounded-md" }}
                components={{
                  DayButton: ({ day, modifiers, children, ...props }: React.ComponentProps<typeof DayButton>) => (
                    <CalendarDayButton
                      day={day}
                      modifiers={modifiers}
                      {...props}
                      className={[props.className, modifiers.today ? "font-bold" : ""].filter(Boolean).join(" ")}
                    >
                      {children}
                    </CalendarDayButton>
                  ),
                }}
                className="p-3"
              />
              {pickedDate && (
                <div className="border-t-2 border-foreground px-3 py-2">
                  <button
                    type="button"
                    onClick={() => { setPickedDate(undefined); setCalOpenMobile(false); }}
                    className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-foreground/50 hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Clear date
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={`grid h-10 w-10 place-items-center ${
              viewMode === "list" ? "text-primary" : "text-foreground/40 hover:text-foreground"
            }`}
          >
            <List className="h-[22px] w-[22px]" />
          </button>
          <button
            type="button"
            aria-label="Map view"
            aria-pressed={viewMode === "map"}
            onClick={() => setViewMode("map")}
            className={`grid h-10 w-10 place-items-center ${
              viewMode === "map" ? "text-primary" : "text-foreground/40 hover:text-foreground"
            }`}
          >
            <MapIcon className="h-[22px] w-[22px]" />
          </button>
        </div>
      </div>

      {viewMode === "map" ? (
        <main className="mx-auto w-full max-w-5xl px-4 py-4">
          <EventsMap events={filtered as any} />
        </main>
      ) : (
      /* List */
      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse border-2 border-foreground bg-card"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid w-full gap-4">
            {filtered.map((e) => {
              const t = eventTypeMeta(e.event_type);
              const n = neighborhoodMeta(e.neighborhood);
              const rawDate = e.event_date ? new Date(e.event_date) : null;
              const d = rawDate && !isNaN(rawDate.getTime()) ? rawDate : null;
              return (
                <li key={e.id} className="min-w-0 w-full max-w-full">
                  <Link
                    to="/event/$eventId"
                    params={{ eventId: e.id }}
                    className="group block w-full max-w-full overflow-hidden border-2 border-foreground bg-card p-4 transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-stamp"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-16 w-16 shrink-0 place-items-center border-2 border-foreground bg-background">
                        <div className="text-center leading-tight">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-foreground">
                            {d ? format(d, "MMM") : "—"}
                          </div>
                          <div className="font-brand text-2xl text-foreground">
                            {d ? format(d, "d") : "?"}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground">
                          <t.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{t.label}</span>
                        </div>
                        <h3 className="mt-1 line-clamp-2 sm:truncate sm:line-clamp-none font-brand text-xl uppercase text-foreground group-hover:text-primary">
                          {e.title}
                        </h3>
                        <div className="mt-2 flex flex-col gap-1 font-mono text-xs uppercase tracking-wide text-foreground">
                          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {d
                                ? e.end_date
                                  ? formatEventDateRange(d, e.end_date)
                                  : format(d, "EEE, HH:mm")
                                : "Date TBA"}
                            </span>
                            {(() => {
                              const rep = recurringByKey.get(`${e.created_by}::${e.title}`);
                              return rep ? (
                                <span className="inline-flex items-center gap-1 border border-foreground/40 px-1.5 py-0.5 text-[10px] tracking-widest text-foreground">
                                  ↻ {rep.toUpperCase()}
                                </span>
                              ) : null;
                            })()}
                          </span>
                          {e.is_secret ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="border border-foreground/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-foreground/70">
                                Secret
                              </span>
                            </span>
                          ) : isMobile ? (
                            <span className="inline-flex min-w-0 max-w-full items-start gap-1 self-start text-left">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 break-words">
                                {stripNeighborhoodSuffix(e.place, n.label)}
                                {" · "}
                                <span className="text-neighborhood">{n.label}</span>
                              </span>
                            </span>
                          ) : (
                            <span
                              role="link"
                              tabIndex={0}
                              onClick={(ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();
                                window.open(
                                  `https://maps.google.com/?q=${encodeURIComponent(cleanPlace(e.place))}`,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              }}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter" || ev.key === " ") {
                                  ev.preventDefault();
                                  ev.stopPropagation();
                                  window.open(
                                    `https://maps.google.com/?q=${encodeURIComponent(cleanPlace(e.place))}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }
                              }}
                              className="inline-flex min-w-0 max-w-full items-start gap-1 self-start text-left hover:text-link cursor-pointer"
                            >
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 break-words underline-offset-2 hover:underline">
                                {stripNeighborhoodSuffix(e.place, n.label)}
                                {" · "}
                                <span className="text-neighborhood">{n.label}</span>
                              </span>
                            </span>
                          )}
                          <SaveCountsLine counts={countsMap?.get(e.id)} className="mt-1" />


                        </div>

                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      )}
    </div>
  );
}

function stripNeighborhoodSuffix(place: string, neighborhood: string) {
  const cleaned = cleanPlace(place);
  const suffix = ` · ${neighborhood}`;
  return cleaned.endsWith(suffix) ? cleaned.slice(0, -suffix.length) : cleaned;
}



function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  shortLabel: string;
  defaultValue: string;
  options: { value: string; label: string; isState?: boolean }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full rounded-none border-2 border-foreground bg-background px-1.5 font-mono text-[10px] uppercase tracking-tight sm:h-9 sm:w-auto sm:min-w-[8rem] sm:max-w-[14rem] sm:px-3 sm:text-xs sm:tracking-wider">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-none border-2 border-foreground">
        {options.map((o, i) => {
          const isFirstState = o.isState && !options[i - 1]?.isState;
          return (
            <React.Fragment key={o.value}>
              {isFirstState && <div className="mx-2 my-1 border-t border-foreground/30" />}
              <SelectItem
                value={o.value}
                className={[
                  "rounded-none font-mono text-xs uppercase",
                  o.isState ? "italic opacity-70" : "",
                ].filter(Boolean).join(" ")}
              >
                {o.label}
              </SelectItem>
            </React.Fragment>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-foreground bg-background p-10 text-center">
      <div className="mx-auto inline-block border-2 border-foreground bg-primary px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary-foreground">
        Nothing here
      </div>
      <h3 className="mt-4 font-brand text-2xl uppercase text-foreground">
        Nothing matches yet
      </h3>
      <p className="mt-2 font-mono text-xs uppercase tracking-wide text-foreground">
        Widen your filters, or be the first to add something.
      </p>
      <Button asChild className="mt-6">
        <Link to="/add">Add an event</Link>
      </Button>
    </div>
  );
}
