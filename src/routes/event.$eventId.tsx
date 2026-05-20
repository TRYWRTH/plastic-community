import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { MapPin, Calendar, ExternalLink, Trash2, Pencil, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { SaveButtons } from "@/components/SaveButtons";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { SaveCountsLine } from "@/components/SaveCountsLine";
import { useEventSaveCounts } from "@/lib/use-event-save-counts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { eventTypeMeta, neighborhoodMeta } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/event/$eventId")({
  component: EventDetail,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select("id,title,place,neighborhood,event_date,description")
      .eq("id", params.eventId)
      .maybeSingle();
    return { event: data };
  },
  head: ({ loaderData, params }) => {
    const ev = loaderData?.event;
    if (!ev) {
      return { meta: [{ title: "Event — Whisperer Ring" }] };
    }
    const when = ev.event_date
      ? format(new Date(ev.event_date), "EEE, MMM d · HH:mm")
      : "";
    const title = `${ev.title} — Whisperer Ring`;
    const desc = [
      [ev.place, ev.neighborhood].filter(Boolean).join(", "),
      when,
      ev.description ?? "",
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 200);
    const url = `https://plastic-community.lovable.app/event/${params.eventId}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: ev.title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "event" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: ev.title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const { data: counts } = useEventSaveCounts(eventId);

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    setDeleting(false);
    if (error) return toast.error(error.message);
    setConfirmDeleteOpen(false);
    toast.success("Event deleted");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-paper pb-28 sm:pb-0">
      <Header />
      <main className="mx-auto max-w-2xl px-3 py-3 sm:px-4 sm:py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-foreground hover:text-primary sm:text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        {isLoading ? (
          <div className="mt-4 h-48 animate-pulse border-2 border-foreground bg-card sm:mt-6" />
        ) : !event ? (
          <p className="mt-6 font-mono text-sm uppercase tracking-wide text-foreground">
            Event not found.
          </p>
        ) : (
          <article className="mt-3 border-2 border-foreground bg-card shadow-stamp sm:mt-6">
            <div className="border-b-2 border-foreground p-4 sm:p-8">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground sm:text-[11px]">
                <span className="text-base">{eventTypeMeta(event.event_type).emoji}</span>
                <span>{eventTypeMeta(event.event_type).label}</span>
              </div>
              <h1 className="mt-2 font-brand text-xl uppercase text-balance text-foreground sm:mt-3 sm:text-5xl">
                {event.title}
              </h1>
              <div className="mt-3 grid gap-1.5 font-mono text-[10px] uppercase tracking-wide text-foreground sm:mt-5 sm:grid-cols-2 sm:gap-2 sm:text-xs">
                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                  {format(new Date(event.event_date), "EEE, MMM d · HH:mm")}
                </div>
                <div className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                  <span className="break-words">{event.place} · {neighborhoodMeta(event.neighborhood).label}</span>
                </div>
              </div>
              <SaveCountsLine
                counts={counts}
                className="mt-3 inline-block font-mono text-[10px] uppercase tracking-widest text-foreground sm:mt-4 sm:text-[11px]"
              />
            </div>
            <div className="space-y-4 p-4 sm:space-y-5 sm:p-8">
              {/* On desktop the save buttons live inline; on mobile they're pinned at the bottom for thumb reach. */}
              <div className="hidden sm:block">
                <SaveButtons eventId={event.id} />
              </div>
              {event.event_date && (
                <AddToCalendarButton
                  title={event.title}
                  start={event.event_date}
                  location={[event.place, neighborhoodMeta(event.neighborhood).label]
                    .filter(Boolean)
                    .join(", ")}
                  description={event.description ?? undefined}
                  uid={`${event.id}@whisperer-ring`}
                />
              )}
              {event.description && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground sm:text-sm">
                  {event.description}
                </p>
              )}
              {event.link && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 text-sm font-medium text-link underline underline-offset-4 hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  Website
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
                    onClick={() => setConfirmDeleteOpen(true)}
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

      {/* Sticky save bar — mobile only. Sits above the iOS safe area. */}
      {event && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-foreground bg-card px-3 py-3 shadow-stamp sm:hidden"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <SaveButtons eventId={event.id} />
        </div>
      )}

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
