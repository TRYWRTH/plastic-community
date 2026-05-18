import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { MapPin, Calendar, ExternalLink, Trash2, Pencil, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { SaveButtons } from "@/components/SaveButtons";
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
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {isLoading ? (
          <div className="mt-6 h-48 animate-pulse border-2 border-foreground bg-card" />
        ) : !event ? (
          <p className="mt-6 font-mono text-sm uppercase tracking-wide text-foreground">
            Event not found.
          </p>
        ) : (
          <article className="mt-6 border-2 border-foreground bg-card shadow-stamp">
            <div className="border-b-2 border-foreground p-5 sm:p-8">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground">
                <span className="text-base">{eventTypeMeta(event.event_type).emoji}</span>
                <span>{eventTypeMeta(event.event_type).label}</span>
              </div>
              <h1 className="mt-3 font-brand text-2xl uppercase text-balance text-foreground sm:text-5xl">
                {event.title}
              </h1>
              <div className="mt-4 grid gap-2 font-mono text-[11px] uppercase tracking-wide text-foreground sm:mt-5 sm:grid-cols-2 sm:text-xs">
                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-primary" />
                  {format(new Date(event.event_date), "EEEE, MMM d · HH:mm")}
                </div>
                <div className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="break-words">{event.place} · {neighborhoodMeta(event.neighborhood).label}</span>
                </div>
              </div>
            </div>
            <div className="space-y-5 p-5 sm:p-8">
              <SaveButtons eventId={event.id} />
              {event.description && (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {event.description}
                </p>
              )}
              {event.link && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 break-all font-mono text-xs uppercase tracking-wide text-primary underline underline-offset-4"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  {event.link}
                </a>
              )}
              {user?.id === event.created_by && (
                <div className="grid grid-cols-1 gap-2 border-t-2 border-foreground pt-4 sm:flex sm:flex-wrap">
                  <Button variant="outline" asChild className="w-full sm:w-auto">
                    <Link to="/event/$eventId/edit" params={{ eventId: event.id }}>
                      <Pencil className="h-4 w-4" /> Edit event
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={remove}
                    className="w-full text-destructive sm:w-auto"
                  >
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
