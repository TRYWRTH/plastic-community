import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, isAfter, isBefore, startOfDay, endOfDay, addDays } from "date-fns";
import { MapPin, Calendar, ExternalLink } from "lucide-react";

import { Header } from "@/components/Header";
import { EnablePushBanner } from "@/components/EnablePushBanner";
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

  const search = Route.useSearch();
  const { date: dateFilter, neighborhood, type: eventType } = search;
  const navigate = useNavigate({ from: "/" });

  const setDateFilter = (v: DateFilter) =>
    navigate({ search: cleanSearch({ ...search, date: v }), replace: true });
  const setNeighborhood = (v: Neighborhood | "all") =>
    navigate({ search: cleanSearch({ ...search, neighborhood: v }), replace: true });
  const setEventType = (v: EventType | "all") =>
    navigate({ search: cleanSearch({ ...search, type: v }), replace: true });



  const filtered = useMemo(() => {
    const now = new Date();
    const cutoffPast = addDays(startOfDay(now), -30);
    const result = events.filter((e) => {
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
          if (!(isAfter(d, now) && isBefore(d, addDays(now, 7)))) return false;
        }
        if (dateFilter === "upcoming" && d && isBefore(d, startOfDay(now))) return false;
      }

      if (neighborhood !== "all" && e.neighborhood !== neighborhood) return false;
      if (eventType !== "all" && e.event_type !== eventType) return false;
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
  }, [events, dateFilter, neighborhood, eventType]);

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <EnablePushBanner />


      {/* Hero */}
      <section className="border-b-2 border-foreground">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-8 sm:pb-10 sm:pt-16">
          <a
            href="https://www.instagram.com/plastic_productions_/"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-primary hover:text-primary-foreground sm:text-[11px]"
          >
            Brought to you by Plastic Productions
          </a>
          <h1 className="mt-5 font-brand text-[3rem] uppercase leading-[0.95] text-foreground text-balance sm:mt-6 sm:text-[7.5rem]">
            Whisper
            <br />
            Ring
          </h1>
          <p className="mt-5 max-w-xl text-balance font-mono text-xs uppercase tracking-wide text-foreground sm:mt-6 sm:text-base">
            if you know, you know
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-14 z-30 border-b-2 border-foreground bg-background">
        <div className="mx-auto max-w-5xl px-4 py-3">
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
              placeholder="Area"
              options={[
                { value: "all", label: "All areas" },
                ...NEIGHBORHOODS.map((n) => ({ value: n.value, label: n.label })),
              ]}
            />
            <FilterSelect
              value={eventType}
              onChange={(v) => setEventType(v as EventType | "all")}
              placeholder="Type"
              options={[
                { value: "all", label: "All types" },
                ...EVENT_TYPES.map((t) => ({ value: t.value, label: `${t.emoji}  ${t.label}` })),
              ]}
            />
          </div>
        </div>
      </section>

      {/* List */}
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
          <ul className="grid gap-4">
            {filtered.map((e) => {
              const t = eventTypeMeta(e.event_type);
              const n = neighborhoodMeta(e.neighborhood);
              const rawDate = e.event_date ? new Date(e.event_date) : null;
              const d = rawDate && !isNaN(rawDate.getTime()) ? rawDate : null;
              return (
                <li key={e.id}>
                  <Link
                    to="/event/$eventId"
                    params={{ eventId: e.id }}
                    className="group block border-2 border-foreground bg-card p-4 transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-stamp"
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
                          <span>{t.emoji}</span>
                          <span>{t.label}</span>
                        </div>
                        <h3 className="mt-1 truncate font-brand text-xl uppercase text-foreground group-hover:text-primary">
                          {e.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wide text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {e.place} · {n.label}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {d ? format(d, "EEE, HH:mm") : "Date TBA"}
                          </span>
                          {e.link && (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <ExternalLink className="h-3.5 w-3.5" />
                              link
                            </span>
                          )}
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
    </div>
  );
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
      <SelectTrigger className="h-11 w-full rounded-none border-2 border-foreground bg-background font-mono text-xs uppercase tracking-wider sm:h-9 sm:w-auto sm:min-w-[8rem]">
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
