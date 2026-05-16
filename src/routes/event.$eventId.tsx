import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Calendar, ExternalLink, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { eventTypeMeta, neighborhoodMeta } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/event/$eventId")({
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: event, isLoading } = useQuery({
    queryKey: ["events", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const remove = async () => {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return toast.error(error.message);
    toast.success("Event deleted");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to events
        </Link>

        {isLoading ? (
          <div className="mt-6 h-48 animate-pulse rounded-2xl border border-border bg-card/50" />
        ) : !event ? (
          <p className="mt-6 text-muted-foreground">Event not found.</p>
        ) : (
          <article className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="bg-aurora p-6 sm:p-8">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">{eventTypeMeta(event.event_type).emoji}</span>
                <span className="uppercase tracking-wider text-muted-foreground">
                  {eventTypeMeta(event.event_type).label}
                </span>
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold text-balance sm:text-4xl">
                {event.title}
              </h1>
              <div className="mt-4 grid gap-2 text-sm text-foreground/90 sm:grid-cols-2">
                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(new Date(event.event_date), "EEEE, MMM d · HH:mm")}
                </div>
                <div className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {event.place} · {neighborhoodMeta(event.neighborhood).label}
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6 sm:p-8">
              {event.description && (
                <p className="whitespace-pre-wrap text-foreground/90">{event.description}</p>
              )}
              {event.link && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 text-primary hover:underline break-all"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  {event.link}
                </a>
              )}
              {user?.id === event.created_by && (
                <div className="border-t border-border pt-4">
                  <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" /> Delete event
                  </Button>
                </div>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
