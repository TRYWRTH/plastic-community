import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { FeedbackButton } from "@/components/FeedbackButton";
import type { Database } from "@/integrations/supabase/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export const Route = createFileRoute("/settings/profile")({
  component: MePage,
});

const MY_EVENTS_PREVIEW_COUNT = 3;

function MePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [showAllMine, setShowAllMine] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/settings/profile" } });
    }
  }, [loading, isAuthenticated, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: saved = [], isLoading: savedLoading } = useQuery({
    queryKey: ["my_saved_events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_saves")
        .select("status, event:events(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const today = startOfDay(new Date());
      return (data ?? [])
        .filter((r) => r.event && !isBefore(new Date(r.event.event_date), today))
        .sort(
          (a, b) =>
            new Date(a.event!.event_date).getTime() - new Date(b.event!.event_date).getTime(),
        );
    },
  });

  const { data: mine = [], isLoading: mineLoading } = useQuery({
    queryKey: ["my_created_events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Recurring series share a title (same creator) — show one row per
  // series, using its nearest upcoming occurrence (or the most recent past
  // one if it's finished), instead of one row per generated instance.
  const mineGrouped = useMemo(() => {
    const groups = new Map<string, EventRow[]>();
    for (const e of mine) {
      const arr = groups.get(e.title) ?? [];
      arr.push(e);
      groups.set(e.title, arr);
    }
    const now = new Date();
    return [...groups.values()]
      .map((group) => {
        const sorted = [...group].sort(
          (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
        );
        const upcoming = sorted.find((e) => new Date(e.event_date) >= now);
        const earliestCreatedAt = Math.min(...group.map((e) => new Date(e.created_at).getTime()));
        return {
          event: upcoming ?? sorted[sorted.length - 1],
          count: group.length,
          sortKey: earliestCreatedAt,
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [mine]);

  const { data: wentCount = 0 } = useQuery({
    queryKey: ["went_count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_saves")
        .select("event:events(event_date)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const now = new Date();
      return (data ?? []).filter((r) => r.event && new Date(r.event.event_date) < now).length;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
    toast.success("SIGNED OUT");
  };

  if (loading || !isAuthenticated || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  const displayName = profile?.username || "Guest";
  const initials = (profile?.username || "—").trim().slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[430px] flex-col gap-5 px-5 pb-28 pt-5 lg:max-w-[640px]">
        <Link
          to="/"
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-border px-[14px] font-mono text-[10px] tracking-[0.14em] text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> BACK
        </Link>

        <div className="flex items-center gap-3.5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-primary font-brand text-[22px] text-primary-foreground">
            {initials}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-brand text-[26px] uppercase tracking-[0.02em] text-foreground">
              {displayName}
            </span>
            <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
              {user.email}
            </span>
            <Link
              to="/login"
              search={{ edit: "1" }}
              className="mt-0.5 w-fit rounded-full border border-border px-[11px] py-1.5 font-mono text-[9px] tracking-[0.14em] text-foreground"
            >
              EDIT NAME
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatTile n={saved.length} label="SAVED" />
          <StatTile n={mine.length} label="ADDED" />
          <StatTile n={wentCount} label="WENT" />
        </div>

        <section className="flex flex-col gap-2.5">
          <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-link">
            MY LIST
          </span>
          {savedLoading ? null : saved.length === 0 ? (
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
              NOTHING SAVED YET — TAP ☆ ON ANY EVENT.
            </span>
          ) : (
            saved.map(({ event }) => {
              if (!event) return null;
              const d = new Date(event.event_date);
              return (
                <Link
                  key={event.id}
                  to="/event/$eventId"
                  params={{ eventId: event.id }}
                  className="flex items-center gap-3.5 rounded-[22px] bg-foreground/[0.07] px-4 py-3.5"
                >
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary leading-[1.05] text-primary-foreground">
                    <span className="font-brand text-[15px]">{format(d, "dd")}</span>
                    <span className="font-mono text-[8px] tracking-[0.1em] uppercase">
                      {format(d, "MMM")}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-medium text-foreground">
                      {event.title}
                    </span>
                    <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                      {format(d, "HH:mm")} · {(event.neighborhood as string).split("-")[0]}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">→</span>
                </Link>
              );
            })
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-link">
            MY EVENTS
          </span>
          {mineLoading ? null : mineGrouped.length === 0 ? (
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
              YOU HAVEN'T ADDED ANY EVENTS YET.
            </span>
          ) : (
            <>
              {(showAllMine ? mineGrouped : mineGrouped.slice(0, MY_EVENTS_PREVIEW_COUNT)).map(
                ({ event, count }) => {
                  const d = new Date(event.event_date);
                  return (
                    <Link
                      key={event.id}
                      to="/event/$eventId"
                      params={{ eventId: event.id }}
                      className="flex items-center gap-3.5 rounded-[22px] bg-foreground/[0.07] px-4 py-3.5"
                    >
                      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-hot leading-[1.05] text-shell-deep">
                        <span className="font-brand text-[15px]">{format(d, "dd")}</span>
                        <span className="font-mono text-[8px] tracking-[0.1em] uppercase">
                          {format(d, "MMM")}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          <span className="truncate text-[15px] font-medium text-foreground">
                            {event.title}
                          </span>
                          {count > 1 && (
                            <span className="shrink-0 font-mono text-[9px] tracking-[0.1em] text-link">
                              ↻ RECURRING
                            </span>
                          )}
                        </span>
                        <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                          {format(d, "HH:mm")} · {(event.neighborhood as string).split("-")[0]}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                        EDIT
                      </span>
                    </Link>
                  );
                },
              )}
              {mineGrouped.length > MY_EVENTS_PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllMine((v) => !v)}
                  className="w-fit rounded-full border border-border px-[13px] py-2 font-mono text-[9px] tracking-[0.14em] text-foreground"
                >
                  {showAllMine
                    ? "SHOW LESS"
                    : `SHOW ${mineGrouped.length - MY_EVENTS_PREVIEW_COUNT} MORE`}
                </button>
              )}
            </>
          )}
        </section>

        <FeedbackButton />

        <button
          type="button"
          onClick={signOut}
          className="rounded-full border border-border py-[15px] font-mono text-[10px] tracking-[0.16em] text-foreground"
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}

function StatTile({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[22px] bg-foreground/[0.07] px-3.5 py-4">
      <span className="font-brand text-[28px] leading-none text-foreground">{n}</span>
      <span className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">{label}</span>
    </div>
  );
}
