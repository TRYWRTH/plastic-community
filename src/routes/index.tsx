import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BERLIN_DISTRICTS, GERMAN_STATES, type Neighborhood } from "@/lib/constants";
import { buildAgendaDays, getActiveRuns, hoursRangeLabel, type TimeFilter } from "@/lib/agenda";
import { AgendaView } from "@/components/AgendaView";
import { OnNowShelf } from "@/components/OnNowShelf";

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

const TIME_CHIPS: { value: TimeFilter; label: string }[] = [
  { value: "tonight", label: "TONIGHT" },
  { value: "weekend", label: "THIS WEEKEND" },
];

function Home() {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState<Neighborhood | "all">("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["event_save", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_saves")
        .select("event_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.event_id));
    },
  });

  const toggleSave = async (eventId: string) => {
    if (!user) return;
    if (savedIds.has(eventId)) {
      await supabase.from("event_saves").delete().eq("user_id", user.id).eq("event_id", eventId);
    } else {
      await supabase
        .from("event_saves")
        .upsert(
          { event_id: eventId, user_id: user.id, status: "going" },
          { onConflict: "event_id,user_id" },
        );
    }
    qc.invalidateQueries({ queryKey: ["event_save"] });
    qc.invalidateQueries({ queryKey: ["event_save_counts"] });
    qc.invalidateQueries({ queryKey: ["my_saved_events"] });
  };

  const districtChips = useMemo(() => {
    const usedStates = new Set(
      events
        .map((e) => e.neighborhood)
        .filter((n): n is Neighborhood => !!n && GERMAN_STATES.some((s) => s.value === n)),
    );
    const stateOptions = GERMAN_STATES.filter((s) => usedStates.has(s.value));
    return [
      { value: "all" as const, label: "ALL DISTRICTS" },
      ...[...BERLIN_DISTRICTS, ...stateOptions].map((n) => ({
        value: n.value,
        label: n.label.split("-")[0].toUpperCase(),
      })),
    ];
  }, [events]);

  const days = useMemo(
    () => buildAgendaDays(events, { district, search, timeFilter }),
    [events, search, district, timeFilter],
  );

  const activeRuns = useMemo(
    () => getActiveRuns(events, { district, search }, now),
    [events, district, search, now],
  );

  const isEmpty = !isLoading && days.length === 0;
  const clearFilters = () => {
    setSearch("");
    setDistrict("all");
    setTimeFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[430px] lg:max-w-[1280px]">
        {/* Brand lockup */}
        <div className="flex flex-col gap-3 px-5 pb-3 pt-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6 lg:px-9 lg:pb-[22px] lg:pt-[30px]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-brand text-[44px] uppercase leading-[0.92] tracking-[0.02em] text-foreground lg:text-[46px]">
              Whisper Ring
            </h1>
            <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
              BROUGHT TO YOU BY PLASTIC PRODUCTIONS
            </span>
          </div>

          {!isAuthenticated && (
            <Link
              to="/login"
              className="shrink-0 self-start rounded-full border border-border px-[13px] py-[9px] font-mono text-[9px] tracking-[0.14em] text-foreground lg:hidden"
            >
              SIGN IN
            </Link>
          )}

          {/* Desktop-only: search + primary action live in the header */}
          <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
            <div className="flex h-[42px] min-w-[280px] items-center gap-2 rounded-full border border-border px-4">
              <span className="font-mono text-[11px] text-muted-foreground">/</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SEARCH EVENTS, PLACES"
                className="h-full min-w-0 flex-1 bg-transparent font-mono text-[11px] tracking-[0.08em] text-foreground outline-none placeholder:text-dim"
              />
            </div>
            <Link
              to={isAuthenticated ? "/add" : "/login"}
              className="flex h-[42px] shrink-0 items-center rounded-full bg-primary px-[18px] font-mono text-[10px] font-bold tracking-[0.14em] text-primary-foreground"
            >
              {isAuthenticated ? "ADD EVENT" : "SIGN IN"}
            </Link>
          </div>
        </div>

        {/* Search — mobile only, desktop search lives in the header */}
        <div className="px-5 pb-3.5 lg:hidden">
          <div className="flex h-[42px] items-center gap-2 rounded-full border border-border px-3.5">
            <span className="font-mono text-[11px] text-muted-foreground">/</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH EVENTS, PLACES"
              className="h-full min-w-0 flex-1 bg-transparent font-mono text-[11px] tracking-[0.08em] text-foreground outline-none placeholder:text-dim"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-5 pb-4 lg:flex-wrap lg:overflow-visible lg:px-9">
          {districtChips.map((c) => {
            const active = district === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setDistrict(c.value)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-[13px] py-[9px] font-mono text-[10px] tracking-[0.1em] ${
                  active
                    ? "border-transparent bg-hot text-shell-deep"
                    : "border-border/[0.22] bg-transparent text-muted-2"
                }`}
              >
                {c.label}
              </button>
            );
          })}
          {TIME_CHIPS.map((c) => {
            const active = timeFilter === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setTimeFilter(active ? "all" : c.value)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-[13px] py-[9px] font-mono text-[10px] tracking-[0.1em] ${
                  active
                    ? "border-transparent bg-hot text-shell-deep"
                    : "border-border/[0.22] bg-transparent text-muted-2"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <OnNowShelf runs={activeRuns} now={now} />

        {/* Agenda */}
        {isLoading ? (
          <div className="flex flex-col gap-3 px-5 pb-4 lg:px-9">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[74px] animate-pulse rounded-[22px] bg-muted lg:h-24" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-start gap-3 px-5 py-6 lg:px-9">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              NO MATCHES
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full bg-primary px-4 py-[11px] font-mono text-[10px] tracking-[0.14em] text-primary-foreground"
            >
              CLEAR FILTERS
            </button>
          </div>
        ) : (
          <>
            {/* Mobile: compact card list */}
            <div className="flex flex-col gap-4 px-5 pb-4 lg:hidden">
              {days.map((day) => (
                <div key={day.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-link">
                      {day.relLabel ? `${day.relLabel} · ` : ""}
                      {format(day.date, "EEE d MMM").toUpperCase()}
                    </span>
                    <span className="h-px flex-1 bg-border/[0.18]" />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {day.eventCount}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {day.items.map((e) => {
                      const districtLabel = (e.neighborhood as string).split("-")[0].toUpperCase();

                      if (e.edgeKind) {
                        const isOpen = e.edgeKind === "open";
                        return (
                          <Link
                            key={`${day.key}-${e.id}-${e.edgeKind}`}
                            to="/event/$eventId"
                            params={{ eventId: e.id }}
                            className="flex flex-col gap-2 rounded-[22px] bg-hot/[0.1] px-4 py-3.5 hover:bg-hot/[0.16]"
                          >
                            <span
                              className={`w-fit rounded font-mono text-[9px] font-bold tracking-[0.14em] ${
                                isOpen ? "bg-foreground text-shell-deep" : "bg-hot text-shell-deep"
                              }`}
                              style={{ padding: "5px 10px" }}
                            >
                              {isOpen
                                ? day.relLabel === "TONIGHT"
                                  ? "OPENS TODAY"
                                  : "OPENS"
                                : "LAST DAY"}
                            </span>
                            <span className="flex min-w-0 items-baseline gap-1.5">
                              <span className="truncate text-[16px] font-medium tracking-[-0.01em] text-foreground">
                                {e.title}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                                {hoursRangeLabel(new Date(e.event_date), e.end_time)}
                              </span>
                            </span>
                            <span className="font-mono text-[9px] tracking-[0.1em] text-link">
                              {e.is_secret ? "SECRET" : districtLabel}
                            </span>
                          </Link>
                        );
                      }

                      const d = new Date(e.event_date);
                      return (
                        <Link
                          key={`${day.key}-${e.id}`}
                          to="/event/$eventId"
                          params={{ eventId: e.id }}
                          className="flex items-center gap-3.5 rounded-[22px] bg-foreground/[0.07] px-4 py-3.5 hover:bg-foreground/[0.12]"
                        >
                          <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary leading-[1.05] text-primary-foreground">
                            <span className="font-brand text-base">{format(day.date, "dd")}</span>
                            <span className="font-mono text-[8px] tracking-[0.1em] uppercase">
                              {format(day.date, "MMM")}
                            </span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex min-w-0 items-baseline gap-1.5">
                              <span className="truncate text-[16px] font-medium tracking-[-0.01em] text-foreground">
                                {e.title}
                              </span>
                              {e.dateRangeLabel && (
                                <span className="shrink-0 whitespace-nowrap font-mono text-[9px] tracking-[0.1em] text-link">
                                  ({e.dateRangeLabel})
                                </span>
                              )}
                            </span>
                            <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                              {format(d, "HH:mm")} · {districtLabel}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[9px] tracking-[0.1em] text-link">
                            {districtLabel}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: date-rail agenda */}
            <div className="hidden lg:block">
              <AgendaView days={days} savedIds={savedIds} onToggleSave={toggleSave} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
