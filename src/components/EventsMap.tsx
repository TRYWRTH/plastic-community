import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { Neighborhood } from "@/lib/constants";

type EventLike = {
  id: string;
  title: string;
  place: string;
  event_date: string;
  neighborhood: Neighborhood;
  lat: number | null;
  lng: number | null;
  is_secret: boolean;
};

type WhenFilter = "tonight" | "week" | "all";

// Berlin's own extent (all 12 Bezirke fit inside with a small margin) —
// deliberately tighter than the wider Brandenburg region used for Places
// Autocomplete biasing, so the common case (events inside Berlin) spreads
// across the field instead of clustering in the middle. Events further out
// in Brandenburg still project sensibly, just clamped near the edge.
const BOUNDS = { minLat: 52.33, maxLat: 52.68, minLng: 13.08, maxLng: 13.77 };

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(96, Math.max(4, y)) };
}

// A representative subset of districts, labeled directly on the field —
// showing all 12 would clutter a 400px field. Positions are real
// projected coordinates, not the fixed layout points a purely abstract
// radar would use.
const DISTRICT_LABELS: { label: string; lat: number; lng: number }[] = [
  { label: "MITTE", lat: 52.52, lng: 13.405 },
  { label: "KREUZBERG", lat: 52.505, lng: 13.454 },
  { label: "NEUKÖLLN", lat: 52.481, lng: 13.435 },
  { label: "PANKOW", lat: 52.569, lng: 13.401 },
  { label: "LICHTENBERG", lat: 52.535, lng: 13.5 },
  { label: "TREPTOW", lat: 52.457, lng: 13.573 },
];

const WHEN_STEPS: { value: WhenFilter; label: string }[] = [
  { value: "tonight", label: "TONIGHT" },
  { value: "week", label: "THIS WEEK" },
  { value: "all", label: "EVERYTHING" },
];

export function EventsMap({ events }: { events: EventLike[] }) {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [when, setWhen] = useState<WhenFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const { near, pins } = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekCutoff = new Date(todayStart.getTime() + 7 * 86400000);

    // Collapse recurring series to their nearest upcoming occurrence, same
    // as Home, so the field isn't cluttered with every future instance.
    const byKey = new Map<string, EventLike[]>();
    for (const e of events) {
      const d = new Date(e.event_date);
      if (isNaN(d.getTime()) || isBefore(d, todayStart)) continue;
      const key = `${e.neighborhood}::${e.title}`;
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
      for (const e of sorted.slice(1)) hiddenIds.add(e.id);
    }

    const filtered = events
      .filter((e) => {
        if (hiddenIds.has(e.id)) return false;
        const d = new Date(e.event_date);
        if (isNaN(d.getTime()) || isBefore(d, todayStart)) return false;
        if (when === "tonight") return isSameDay(d, now);
        if (when === "week") return d <= weekCutoff;
        return true;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    const nearWithIndex = filtered.map((e, i) => ({ ...e, pinNo: i + 1 }));
    const pinsSource = nearWithIndex
      .filter((e) => !e.is_secret && typeof e.lat === "number" && typeof e.lng === "number")
      .slice(0, 10)
      .map((e) => {
        const isTonight = isSameDay(new Date(e.event_date), now);
        const selected = e.id === selectedId;
        const { x, y } = project(e.lat as number, e.lng as number);
        return {
          ...e,
          x,
          y,
          isTonight,
          selected,
          size: selected ? 16 : isTonight ? 13 : 10,
          halo: selected ? 9 : 5,
        };
      });

    return { near: nearWithIndex, pins: pinsSource };
  }, [events, when, selectedId]);

  const peek = near.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex flex-col">
      <div
        className="relative h-[400px] overflow-hidden rounded-[26px] bg-shell-deep"
        style={{
          backgroundImage:
            "linear-gradient(rgba(247,231,228,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(247,231,228,0.06) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
        }}
      >
        <span
          className="absolute inset-x-0 top-[38%] h-[26px] bg-foreground/[0.05]"
          style={{ transform: "rotate(-4deg)" }}
        />
        <span
          className="absolute inset-y-0 left-[14%] w-5 bg-foreground/[0.04]"
          style={{ transform: "rotate(7deg)" }}
        />
        {[520, 340, 170].map((size, i) => (
          <span
            key={size}
            className="absolute rounded-full border"
            style={{
              width: size,
              height: size,
              left: "50%",
              top: "50%",
              margin: -size / 2,
              borderColor: `rgba(247,231,228,${0.08 + i * 0.03})`,
            }}
          />
        ))}
        <span
          className="absolute animate-[rdSweep_11s_linear_infinite] rounded-full"
          style={{
            width: 520,
            height: 520,
            left: "50%",
            top: "50%",
            margin: -260,
            background:
              "conic-gradient(from 0deg, rgba(255,106,99,0.16), rgba(255,106,99,0.04) 16%, transparent 30%)",
          }}
        />
        {DISTRICT_LABELS.map((d) => {
          const { x, y } = project(d.lat, d.lng);
          return (
            <span
              key={d.label}
              className="absolute whitespace-nowrap font-mono text-[9px] tracking-[0.16em] text-foreground/[0.28]"
              style={{ left: `${x + 5}%`, top: `${y + 7}%`, transform: "translate(-50%,-50%)" }}
            >
              {d.label}
            </span>
          );
        })}
        {pins.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-[7px] p-1.5"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span
              className="block rounded-full"
              style={{
                width: p.size,
                height: p.size,
                background: p.selected
                  ? "#F7E7E4"
                  : p.isTonight
                    ? "#FF6A63"
                    : "rgba(247,231,228,0.75)",
                boxShadow: `0 0 0 ${p.halo}px rgba(255,106,99,0.18)`,
              }}
            />
            {p.selected && (
              <span className="whitespace-nowrap font-mono text-[9px] tracking-[0.08em] text-foreground">
                {format(new Date(p.event_date), "HH:mm")}
              </span>
            )}
          </button>
        ))}
        <span className="absolute left-4 top-3 font-mono text-[9px] tracking-[0.14em] text-dim">
          {peek ? "TAP THE PIN AGAIN TO CLOSE" : "TAP A PIN"}
        </span>
        {peek && (
          <div className="absolute inset-x-3 bottom-3">
            <Link
              to="/event/$eventId"
              params={{ eventId: peek.id }}
              className="flex items-center gap-3.5 rounded-[22px] bg-primary p-3.5 text-primary-foreground"
            >
              <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-2xl bg-shell-deep leading-[1.05] text-foreground">
                <span className="font-brand text-base">
                  {format(new Date(peek.event_date), "dd")}
                </span>
                <span className="font-mono text-[8px] tracking-[0.1em] uppercase">
                  {format(new Date(peek.event_date), "MMM")}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[16px] font-semibold tracking-[-0.01em]">
                  {peek.title}
                </span>
                <span className="truncate font-mono text-[10px] tracking-[0.08em] opacity-70">
                  {format(new Date(peek.event_date), "EEE d MMM")} · {peek.place}
                </span>
              </span>
              <SaveDot
                saved={savedIds.has(peek.id)}
                isAuthenticated={isAuthenticated}
                onToggle={() => toggleSave(peek.id)}
                inverted
              />
            </Link>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 py-3.5">
        {WHEN_STEPS.map((w) => {
          const active = when === w.value;
          return (
            <button
              key={w.value}
              type="button"
              onClick={() => setWhen(w.value)}
              className={`flex-1 rounded-full border border-border py-[11px] font-mono text-[10px] tracking-[0.12em] ${
                active ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-2"
              }`}
            >
              {w.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col">
        {near.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-6">
            <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
              NOTHING IN THIS VIEW
            </span>
            <button
              type="button"
              onClick={() => setWhen("all")}
              className="rounded-full bg-primary px-4 py-[11px] font-mono text-[10px] tracking-[0.14em] text-primary-foreground"
            >
              SHOW ALL BERLIN
            </button>
          </div>
        ) : (
          near.map((e) => (
            <div
              key={e.id}
              className="grid grid-cols-[26px_1fr_auto] items-center gap-3 border-t border-border/[0.16] py-3.5"
            >
              <span
                className={`font-brand text-[15px] ${
                  isSameDay(new Date(e.event_date), new Date()) ? "text-hot" : "text-muted-2"
                }`}
              >
                {e.pinNo}
              </span>
              <Link
                to="/event/$eventId"
                params={{ eventId: e.id }}
                className="flex min-w-0 flex-col gap-1"
              >
                <span className="truncate text-[16px] font-medium tracking-[-0.01em] text-foreground">
                  {e.title}
                </span>
                <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                  {format(new Date(e.event_date), "EEE d MMM")} ·{" "}
                  {(e.neighborhood as string).split("-")[0].toUpperCase()}
                </span>
              </Link>
              <SaveDot
                saved={savedIds.has(e.id)}
                isAuthenticated={isAuthenticated}
                onToggle={() => toggleSave(e.id)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SaveDot({
  saved,
  isAuthenticated,
  onToggle,
  inverted,
}: {
  saved: boolean;
  isAuthenticated: boolean;
  onToggle: () => void;
  inverted?: boolean;
}) {
  const base =
    "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[13px]";
  const style = inverted
    ? saved
      ? "border border-shell-deep/40 bg-shell-deep text-foreground"
      : "border border-shell-deep/40 bg-transparent text-shell-deep"
    : saved
      ? "border border-border bg-primary text-primary-foreground"
      : "border border-border bg-transparent text-muted-2";

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        search={{ redirect: "/radar" }}
        onClick={(e) => e.stopPropagation()}
        className={`${base} ${style}`}
      >
        ☆
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`${base} ${style}`}
    >
      {saved ? "★" : "☆"}
    </button>
  );
}
