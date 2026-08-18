import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";

import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BERLIN_DISTRICTS, GERMAN_STATES, eventTypeMeta, type Neighborhood } from "@/lib/constants";

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
  const { isAuthenticated } = useAuth();
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
  });

  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState<Neighborhood | "all">("all");

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

  const groups = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    // Recurring series: only the nearest upcoming occurrence of each
    // (creator + title) group is shown; siblings stay reachable from
    // the detail page's "also happening" list.
    const byKey = new Map<string, typeof events>();
    for (const e of events) {
      if (!e.event_date) continue;
      const d = new Date(e.event_date);
      if (isNaN(d.getTime()) || isBefore(d, todayStart)) continue;
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

    const q = search.trim().toLowerCase();
    const filtered = events
      .filter((e) => {
        if (hiddenIds.has(e.id)) return false;
        if (!e.event_date) return false;
        const d = new Date(e.event_date);
        if (isNaN(d.getTime()) || isBefore(d, todayStart)) return false;
        if (district !== "all" && e.neighborhood !== district) return false;
        if (q) {
          const hay =
            `${e.title} ${e.place} ${e.neighborhood} ${e.description ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    const ordered: { key: string; label: string; count: number; items: typeof events }[] = [];
    const byDay = new Map<
      string,
      { key: string; label: string; count: number; items: typeof events }
    >();
    for (const e of filtered) {
      const d = new Date(e.event_date);
      const key = d.toDateString();
      let g = byDay.get(key);
      if (!g) {
        const rel = isSameDay(d, now)
          ? "TONIGHT · "
          : isSameDay(d, new Date(now.getTime() + 86400000))
            ? "TOMORROW · "
            : "";
        g = {
          key,
          label: `${rel}${format(d, "EEE d MMM").toUpperCase()}`,
          count: 0,
          items: [],
        };
        byDay.set(key, g);
        ordered.push(g);
      }
      g.items.push(e);
      g.count = g.items.length;
    }
    return ordered;
  }, [events, search, district]);

  const isEmpty = !isLoading && groups.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[430px] lg:max-w-5xl">
        {/* Brand lockup */}
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 lg:px-8 lg:pt-8">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-brand text-[44px] uppercase leading-[0.92] tracking-[0.02em] text-foreground lg:text-[64px]">
              Whisper Ring
            </h1>
            <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
              BROUGHT TO YOU BY PLASTIC PRODUCTIONS
            </span>
          </div>
          {!isAuthenticated && (
            <Link
              to="/login"
              className="mt-1.5 shrink-0 rounded-full border border-border px-[13px] py-[9px] font-mono text-[9px] tracking-[0.14em] text-foreground"
            >
              SIGN IN
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="px-5 pb-3.5 lg:px-8">
          <div className="flex h-[42px] items-center gap-2 rounded-full border border-border px-3.5 lg:max-w-md">
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

        {/* District chips */}
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-5 pb-4 lg:px-8 lg:flex-wrap lg:overflow-visible">
          {districtChips.map((c) => {
            const active = district === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setDistrict(c.value)}
                className={`shrink-0 rounded-full border px-[13px] py-[9px] font-mono text-[10px] tracking-[0.1em] ${
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

        {/* Day-grouped list */}
        <div className="flex flex-col gap-4 px-5 pb-4 lg:px-8">
          {isLoading ? (
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[74px] animate-pulse rounded-[22px] bg-muted lg:h-[260px] lg:rounded-[26px]"
                />
              ))}
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
                NO MATCHES
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDistrict("all");
                }}
                className="rounded-full bg-primary px-4 py-[11px] font-mono text-[10px] tracking-[0.14em] text-primary-foreground"
              >
                CLEAR FILTERS
              </button>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-link">
                    {g.label}
                  </span>
                  <span className="h-px flex-1 bg-border/[0.18]" />
                  <span className="font-mono text-[10px] text-muted-foreground">{g.count}</span>
                </div>
                <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-4">
                  {g.items.map((e) => {
                    const d = new Date(e.event_date);
                    const districtLabel = (e.neighborhood as string).split("-")[0].toUpperCase();
                    const category = eventTypeMeta(e.event_type);
                    return (
                      <Link
                        key={e.id}
                        to="/event/$eventId"
                        params={{ eventId: e.id }}
                        className="flex flex-col overflow-hidden rounded-[22px] bg-foreground/[0.07] hover:bg-foreground/[0.12] lg:rounded-[26px]"
                      >
                        <div className="hidden lg:block lg:aspect-[16/9] lg:w-full lg:overflow-hidden lg:bg-shell-deep">
                          {e.image_url ? (
                            <img src={e.image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <category.Icon className="h-9 w-9 text-foreground/[0.18]" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3.5 px-4 py-3.5 lg:items-start lg:gap-3 lg:p-4">
                          <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary leading-[1.05] text-primary-foreground">
                            <span className="font-brand text-base">{format(d, "dd")}</span>
                            <span className="font-mono text-[8px] tracking-[0.1em] uppercase">
                              {format(d, "MMM")}
                            </span>
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1 lg:gap-1.5">
                            <span className="truncate text-[16px] font-medium tracking-[-0.01em] text-foreground lg:text-[17px]">
                              {e.title}
                            </span>
                            <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                              {format(d, "HH:mm")} · {districtLabel}
                            </span>
                            {e.description && (
                              <span className="mt-0.5 hidden text-[12px] leading-[1.45] text-muted-2 lg:line-clamp-2">
                                {e.description}
                              </span>
                            )}
                            <span className="mt-1 hidden w-fit rounded-full bg-primary/[0.16] px-2.5 py-[3px] font-mono text-[9px] tracking-[0.1em] text-link lg:block">
                              {category.label.toUpperCase()}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[9px] tracking-[0.1em] text-link lg:hidden">
                            {districtLabel}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
