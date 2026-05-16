import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, isAfter, isBefore, startOfDay, endOfDay, addDays } from "date-fns";
import { MapPin, Calendar, ExternalLink } from "lucide-react";

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
    <div className="min-h-screen bg-paper">
      <Header />

      {/* Hero */}
      <section className="border-b-2 border-foreground">
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:pt-16">
          <div className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
            Plastic Productions · Berlin
          </div>
          <h1 className="mt-6 font-brand text-6xl uppercase leading-[0.95] text-foreground text-balance sm:text-[7.5rem]">
            The poster
            <br />
            said so.
          </h1>
          <p className="mt-6 max-w-xl text-balance font-mono text-sm uppercase tracking-wide text-foreground sm:text-base">
            Spot a poster, add the event, share it.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-14 z-30 border-b-2 border-foreground bg-background">
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
          <div className="ml-auto font-mono text-xs uppercase tracking-widest text-foreground">
            {filtered.length} / {events.length}
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
              const d = new Date(e.event_date);
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
                            {format(d, "MMM")}
                          </div>
                          <div className="font-brand text-2xl text-foreground">
                            {format(d, "d")}
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
      <SelectTrigger className="h-9 w-auto min-w-[8rem] rounded-none border-2 border-foreground bg-background font-mono text-xs uppercase tracking-wider">
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
