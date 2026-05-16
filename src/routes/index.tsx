import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, isAfter, isBefore, startOfDay, endOfDay, addDays } from "date-fns";
import { MapPin, Calendar, ExternalLink, Sparkles } from "lucide-react";

import { Header } from "@/components/Header";
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

export const Route = createFileRoute("/")({
  component: Home,
});

type DateFilter = "all" | "today" | "tomorrow" | "week" | "upcoming";

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

  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [neighborhood, setNeighborhood] = useState<Neighborhood | "all">("all");
  const [eventType, setEventType] = useState<EventType | "all">("all");

  const filtered = useMemo(() => {
    const now = new Date();
    return events.filter((e) => {
      const d = new Date(e.event_date);
      if (dateFilter === "today" && !(isAfter(d, startOfDay(now)) && isBefore(d, endOfDay(now))))
        return false;
      if (
        dateFilter === "tomorrow" &&
        !(
          isAfter(d, startOfDay(addDays(now, 1))) &&
          isBefore(d, endOfDay(addDays(now, 1)))
        )
      )
        return false;
      if (dateFilter === "week" && !(isAfter(d, now) && isBefore(d, addDays(now, 7))))
        return false;
      if (dateFilter === "upcoming" && isBefore(d, startOfDay(now))) return false;
      if (neighborhood !== "all" && e.neighborhood !== neighborhood) return false;
      if (eventType !== "all" && e.event_type !== eventType) return false;
      return true;
    });
  }, [events, dateFilter, neighborhood, eventType]);

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-aurora">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            What's happening around the city
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold text-balance sm:text-5xl">
            Catch every poster.
            <br />
            <span className="bg-gradient-to-r from-primary to-[color:var(--glow)] bg-clip-text text-transparent">
              Never miss a night.
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-balance text-muted-foreground">
            Snap a QR, drop the details, and your crew sees it instantly.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-16 z-30 border-y border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
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
          <div className="ml-auto text-xs text-muted-foreground">
            {filtered.length} event{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      {/* List */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-border bg-card/50"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3">
            {filtered.map((e) => {
              const t = eventTypeMeta(e.event_type);
              const n = neighborhoodMeta(e.neighborhood);
              const d = new Date(e.event_date);
              return (
                <li key={e.id}>
                  <Link
                    to="/event/$eventId"
                    params={{ eventId: e.id }}
                    className="group block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/60 hover:shadow-glow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-border bg-background/60">
                        <div className="text-center leading-tight">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {format(d, "MMM")}
                          </div>
                          <div className="font-display text-xl font-semibold">
                            {format(d, "d")}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{t.emoji}</span>
                          <span className="text-xs uppercase tracking-wider text-muted-foreground">
                            {t.label}
                          </span>
                        </div>
                        <h3 className="mt-1 truncate font-display text-lg font-semibold text-foreground group-hover:text-primary">
                          {e.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {e.place} · {n.label}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(d, "EEE, HH:mm")}
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
      <SelectTrigger className="h-9 w-auto min-w-[8rem] rounded-full border-border bg-card">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 font-display text-lg font-semibold">Nothing matches yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try widening your filters, or be the first to add something.
      </p>
      <Button asChild className="mt-4 shadow-glow">
        <Link to="/add">Add an event</Link>
      </Button>
    </div>
  );
}
