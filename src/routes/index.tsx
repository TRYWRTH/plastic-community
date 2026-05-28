import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, isAfter, isBefore, startOfDay, endOfDay, addDays } from "date-fns";
import { MapPin, Calendar, ExternalLink, Search, X, List, Map as MapIcon } from "lucide-react";
import { EventsMap } from "@/components/EventsMap";

import { Header } from "@/components/Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { EnablePushBanner } from "@/components/EnablePushBanner";
import { SaveCountsLine } from "@/components/SaveCountsLine";
import { GoingInitialsLine } from "@/components/GoingInitialsLine";
import { useAllEventSaveCounts } from "@/lib/use-event-save-counts";
import { useAllEventGoingInitials } from "@/lib/use-event-going-initials";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_TYPES,
  NEIGHBORHOODS,
  eventTypeMeta,
  neighborhoodMeta,
  type EventType,
  type Neighborhood,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cleanPlace } from "@/lib/clean-place";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DATE_FILTERS = ["all", "today", "tomorrow", "week", "upcoming", "past"] as const;
type DateFilter = (typeof DATE_FILTERS)[number];

const NEIGHBORHOOD_VALUES = NEIGHBORHOODS.map((n) => n.value) as [Neighborhood, ...Neighborhood[]];
const EVENT_TYPE_VALUES = EVENT_TYPES.map((t) => t.value) as [EventType, ...EventType[]];

const searchSchema = z.object({
  date: fallback(z.enum(DATE_FILTERS), "upcoming").default("upcoming"),
  neighborhood: fallback(
    z.union([z.literal("all"), z.enum(NEIGHBORHOOD_VALUES)]),
    "all",
  ).default("all"),
  type: fallback(
    z.union([z.literal("all"), z.enum(EVENT_TYPE_VALUES)]),
    "all",
  ).default("all"),
});

type HomeSearch = z.infer<typeof searchSchema>;

// Strip default values so the URL stays clean (e.g. `/` instead of `/?date=upcoming&...`).
function cleanSearch(s: HomeSearch): Partial<HomeSearch> {
  const out: Partial<HomeSearch> = {};
  if (s.date !== "upcoming") out.date = s.date;
  if (s.neighborhood !== "all") out.neighborhood = s.neighborhood;
  if (s.type !== "all") out.type = s.type;
  return out;
}

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
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
  const { data: initialsMap } = useAllEventGoingInitials();
  const isMobile = useIsMobile();

  const search = Route.useSearch();
  const { date: dateFilter, neighborhood, type: eventType } = search;
  const navigate = useNavigate({ from: "/" });
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const setDateFilter = (v: DateFilter) =>
    navigate({ search: cleanSearch({ ...search, date: v }), replace: true });
  const setNeighborhood = (v: Neighborhood | "all") =>
    navigate({ search: cleanSearch({ ...search, neighborhood: v }), replace: true });
  const setEventType = (v: EventType | "all") =>
    navigate({ search: cleanSearch({ ...search, type: v }), replace: true });



  const filtered = useMemo(() => {
    const now = new Date();
    const cutoffPast = addDays(startOfDay(now), -30);

    // Collapse recurring event series: for events with repeats != 'none' OR
    // copies generated from a recurring series (same title + created_by with
    // future dates), only keep the nearest upcoming instance per group.
    const todayStart = startOfDay(now);
    const hiddenIds = new Set<string>();

    // Group future events by title+created_by
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
      const hasRecurring = arr.some((e) => e.repeats && e.repeats !== "none");
      if (!hasRecurring) continue;
      const sorted = [...arr].sort(
        (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
      );
      const [, ...rest] = sorted;
      for (const e of rest) hiddenIds.add(e.id);
    }

    const result = events.filter((e) => {
      if (hiddenIds.has(e.id)) return false;
      const hasDate = !!e.event_date && !isNaN(new Date(e.event_date).getTime());
      const d = hasDate ? new Date(e.event_date) : null;


      if (dateFilter === "past") {
        if (!d) return false;
        if (!isBefore(d, startOfDay(now))) return false;
        if (isBefore(d, cutoffPast)) return false;
      } else {
        if (dateFilter === "today") {
          if (!d) return false;
          if (!(isAfter(d, startOfDay(now)) && isBefore(d, endOfDay(now)))) return false;
        }
        if (dateFilter === "tomorrow") {
          if (!d) return false;
          if (
            !(
              isAfter(d, startOfDay(addDays(now, 1))) &&
              isBefore(d, endOfDay(addDays(now, 1)))
            )
          )
            return false;
        }
      if (dateFilter === "week") {
  if (!d) return false;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  endOfWeek.setHours(23, 59, 59, 999);
  if (!(isAfter(d, now) && isBefore(d, endOfWeek))) return false;
}
        if (dateFilter === "upcoming" && d && isBefore(d, startOfDay(now))) return false;
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
  }, [events, dateFilter, neighborhood, eventType, searchText]);

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




      {/* Filters */}
      <section className="sticky top-14 z-30 border-b-2 border-foreground bg-background">
        <div className="mx-auto max-w-5xl space-y-2 px-4 py-3">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search events…"
              aria-label="Search events"
              className="h-11 w-full rounded-none border-2 border-foreground bg-background pl-9 pr-9 font-mono text-xs uppercase tracking-wider placeholder:text-foreground/50 focus:outline-none focus:ring-0 sm:h-9"
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




          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <FilterSelect
              value={dateFilter}
              onChange={(v) => setDateFilter(v as DateFilter)}
              placeholder="When"
              options={[
                { value: "upcoming", label: "Upcoming" },
                { value: "today", label: "Today" },
                { value: "tomorrow", label: "Tomorrow" },
                { value: "week", label: "This week" },
                { value: "all", label: "Any time" },
                { value: "past", label: "Past (last 30 days)" },
              ]}
            />
            <FilterSelect
              value={neighborhood}
              onChange={(v) => setNeighborhood(v as Neighborhood | "all")}
              placeholder="District"
              options={[
                { value: "all", label: "All districts" },
                ...NEIGHBORHOODS.map((n) => ({ value: n.value, label: n.label })),
              ]}
            />

            <FilterSelect
              value={eventType}
              onChange={(v) => setEventType(v as EventType | "all")}
              placeholder="Category"
              options={[
                { value: "all", label: "All categories" },
                ...EVENT_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />

            <div className="col-span-2 flex items-stretch border-2 border-foreground sm:col-span-1">
              <button
                type="button"
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={`flex h-11 flex-1 items-center justify-center px-3 font-mono text-xs uppercase tracking-wider sm:h-[34px] ${
                  viewMode === "list"
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-foreground/10"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Map view"
                aria-pressed={viewMode === "map"}
                onClick={() => setViewMode("map")}
                className={`flex h-11 flex-1 items-center justify-center border-l-2 border-foreground px-3 font-mono text-xs uppercase tracking-wider sm:h-[34px] ${
                  viewMode === "map"
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-foreground/10"
                }`}
              >
                <MapIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

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
                        <h3 className="mt-1 truncate font-brand text-xl uppercase text-foreground group-hover:text-primary">
                          {e.title}
                        </h3>
                        <div className="mt-2 flex flex-col gap-1 font-mono text-xs uppercase tracking-wide text-foreground">
                          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {d ? format(d, "EEE, HH:mm") : "Date TBA"}
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
                          {isMobile ? (
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
                          {e.link && (
                            <span className="inline-flex items-center gap-1 text-neighborhood">
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              Website
                            </span>
                          )}
                          <SaveCountsLine counts={countsMap?.get(e.id)} />
                          <GoingInitialsLine data={initialsMap?.get(e.id)} />

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
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full rounded-none border-2 border-foreground bg-background px-2 font-mono text-xs uppercase tracking-wider [&>span]:block [&>span]:truncate sm:h-9 sm:w-auto sm:min-w-[8rem] sm:max-w-[14rem] sm:px-3">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-none border-2 border-foreground">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="rounded-none font-mono text-xs uppercase">
            {o.label}
          </SelectItem>
        ))}
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
