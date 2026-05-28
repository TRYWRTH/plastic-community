import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { MapPin, Calendar, Check, Star, X } from "lucide-react";

import { Header } from "@/components/Header";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { eventTypeMeta, neighborhoodMeta } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/saved")({
  component: SavedPage,
});

function SavedPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
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
            new Date(a.event!.event_date).getTime() -
            new Date(b.event!.event_date).getTime(),
        );
    },
  });

  return (
    <div className="min-h-screen bg-paper">
      <Header />
     <main className="mx-auto max-w-3xl px-4 py-8">
  <Link to="/" className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-foreground hover:text-primary">
    ← Back
  </Link>
  <h1 className="mt-4 font-brand text-4xl uppercase text-foreground sm:text-5xl">
    Your list
  </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground">
          Upcoming events you marked Going or Interested.
        </p>

        {!loading && !isAuthenticated && (
          <div className="mt-6 border-2 border-dashed border-foreground bg-background p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-foreground">
              Sign in to save events.
            </p>
            <Button className="mt-4" onClick={() => setSignInOpen(true)}>
              Enter your email
            </Button>
            <MagicLinkDialog
              open={signInOpen}
              onOpenChange={setSignInOpen}
              title="Enter your email to view your list"
            />
          </div>
        )}

        {isAuthenticated && (
          <section className="mt-6">
            {isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse border-2 border-foreground bg-card"
                  />
                ))}
              </div>
            ) : data.length === 0 ? (
              <div className="border-2 border-dashed border-foreground bg-background p-8 text-center">
                <p className="font-mono text-xs uppercase tracking-wide text-foreground">
                  Nothing saved yet. Open an event and tap Going or Interested.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/">Browse events</Link>
                </Button>
              </div>
            ) : (
              <ul className="grid gap-4">
                {data.map(({ status, event }) => {
                  if (!event) return null;
                  const t = eventTypeMeta(event.event_type);
                  const n = neighborhoodMeta(event.neighborhood);
                  const d = new Date(event.event_date);
                  return (
                    <li key={event.id}>
                      <Link
                        to="/event/$eventId"
                        params={{ eventId: event.id }}
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
                              <span
                                className="inline-flex items-center gap-1 border-2 border-foreground bg-primary px-2 py-0.5 text-primary-foreground"
                              >
                                {status === "going" ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Star className="h-3 w-3" />
                                )}
                                {status}
                              </span>
                              <t.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{t.label}</span>
                            </div>
                            <h3 className="mt-1 truncate font-brand text-xl uppercase text-foreground group-hover:text-primary">
                              {event.title}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wide text-foreground">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {event.place} · {n.label}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(d, "EEE, HH:mm")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
