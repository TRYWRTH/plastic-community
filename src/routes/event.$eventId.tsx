import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  MapPin,
  Calendar,
  ExternalLink,
  Trash2,
  Pencil,
  ArrowLeft,
  Check,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { SaveButtons } from "@/components/SaveButtons";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { SaveCountsLine } from "@/components/SaveCountsLine";
import { GoingInitialsLine } from "@/components/GoingInitialsLine";
import { ShareButton } from "@/components/ShareButton";
import { useEventSaveCounts } from "@/lib/use-event-save-counts";
import { useEventGoingInitials } from "@/lib/use-event-going-initials";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { eventTypeMeta, neighborhoodMeta } from "@/lib/constants";
import { cleanPlace } from "@/lib/clean-place";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      return { meta: [{ title: "Event — Whisperer Ring by Plastic Productions" }] };
    }
    const when = ev.event_date
      ? format(new Date(ev.event_date), "EEE, MMM d · HH:mm")
      : "";
    const title = `${ev.title} — Whisperer Ring by Plastic Productions`;

    const desc = [
      [ev.place, ev.neighborhood].filter(Boolean).join(", "),
      when,
      ev.description ?? "",
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 200);
    const url = `https://plastic-community.vercel.app/event/${params.eventId}`;
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
  const [savedBannerVisible, setSavedBannerVisible] = useState(false);
  const [savedBannerFading, setSavedBannerFading] = useState(false);

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem("event-just-saved");
      if (flag && flag === eventId) {
        sessionStorage.removeItem("event-just-saved");
        setSavedBannerVisible(true);
        const fade = setTimeout(() => setSavedBannerFading(true), 1700);
        const hide = setTimeout(() => setSavedBannerVisible(false), 2200);
        return () => {
          clearTimeout(fade);
          clearTimeout(hide);
        };
      }
    } catch {}
  }, [eventId]);

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
  const { data: goingInitials } = useEventGoingInitials(eventId);

  const { data: nearby } = useQuery({
    queryKey: ["events", "nearby", event?.neighborhood, eventId],
    enabled: !!event?.neighborhood,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,place,neighborhood,event_date,event_type")
        .eq("neighborhood", event!.neighborhood)
        .neq("id", eventId)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async () => {
    setDeleting(true);
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    setDeleting(false);
    if (error) return toast.error(error.message);
    setConfirmDeleteOpen(false);
    toast.success("Event deleted");
    navigate({ to: "/" });
  };

  const removeAllFuture = async () => {
    if (!event) return;
    setDeleting(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { error, count } = await supabase
      .from("events")
      .delete({ count: "exact" })
      .eq("title", event.title)
      .eq("created_by", event.created_by)
      .gte("event_date", today.toISOString());
    setDeleting(false);
    if (error) return toast.error(error.message);
    setConfirmDeleteOpen(false);
    toast.success(`Deleted ${count ?? 0} event${count === 1 ? "" : "s"}`);
    navigate({ to: "/" });
  };

  const isRecurring = !!event && event.repeats && event.repeats !== "none";

  const isCreator = !!event && user?.id === event.created_by;
  const neighborhoodLabel = event ? neighborhoodMeta(event.neighborhood).label : "";

  return (
    <div className="min-h-screen bg-paper">
      {savedBannerVisible && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-x-0 top-0 z-50 border-b-2 border-foreground bg-foreground text-primary shadow-stamp transition-opacity duration-500 ${
            savedBannerFading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-4 py-3 font-brand text-sm uppercase tracking-widest sm:text-base">
            <Check className="h-4 w-4" aria-hidden="true" />
            Changes saved
          </div>
        </div>
      )}
      <Header />
      <main className="mx-auto max-w-2xl px-3 py-3 sm:px-4 sm:py-8">
        <div className="flex items-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-foreground hover:text-primary sm:text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-6 h-48 animate-pulse border-0 bg-card sm:mt-8 sm:border-2 sm:border-foreground" />
        ) : !event ? (
          <p className="mt-6 font-mono text-sm uppercase tracking-wide text-foreground">
            Event not found.
          </p>
        ) : (
          <>
            <article className="mt-6 sm:mt-8 sm:border-2 sm:border-foreground sm:bg-card sm:shadow-stamp">
              <div className="pb-4 sm:border-b-2 sm:border-foreground sm:p-8 sm:pb-8">
                <div className="flex items-center justify-between gap-3">
                  {(() => {
                    const meta = eventTypeMeta(event.event_type);
                    return (
                      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground sm:text-xs">
                        <meta.Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{meta.label}</span>
                      </div>
                    );
                  })()}
                  {isCreator && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label="Event actions"
                          className="-mr-2 grid h-10 w-10 place-items-center rounded-none text-foreground hover:text-primary"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="min-w-[12rem] rounded-none border-2 border-foreground bg-card p-0"
                      >
                        <DropdownMenuItem asChild className="rounded-none">
                          <Link
                            to="/event/$eventId/edit"
                            params={{ eventId: event!.id }}
                            className="cursor-pointer gap-3 px-4 py-4 font-mono text-sm uppercase tracking-widest text-link"
                          >
                            <Pencil className="h-4 w-4" /> Edit event
                          </Link>
                        </DropdownMenuItem>
                        <div className="h-px bg-foreground/20" />
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setConfirmDeleteOpen(true);
                          }}
                          className="cursor-pointer gap-3 rounded-none px-4 py-4 font-mono text-sm uppercase tracking-widest text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" /> Delete event
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <h1 className="mt-2 font-brand text-2xl uppercase text-balance text-foreground sm:mt-3 sm:text-5xl">
                  {event.title}
                </h1>
                <div className="mt-3 grid gap-2 font-mono text-sm uppercase tracking-wide text-foreground sm:mt-5 sm:grid-cols-2 sm:text-xs">
                  <div className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-primary" />
                    {format(new Date(event.event_date), "EEE, MMM d · HH:mm")}
                  </div>
                  <div className="inline-flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(cleanPlace(event.place))}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-words text-link underline-offset-2 hover:underline"
                    >
                      {stripNeighborhoodSuffix(event.place, neighborhoodLabel)}
                      {" · "}
                      <span className="text-neighborhood">{neighborhoodLabel}</span>
                    </a>
                  </div>
                </div>
                <SaveCountsLine
                  counts={counts}
                  className="mt-3 inline-block font-mono text-[11px] uppercase tracking-widest text-foreground sm:mt-4"
                />
                <GoingInitialsLine
                  data={goingInitials}
                  className="mt-1 block font-mono text-[11px] uppercase tracking-widest text-foreground"
                />
              </div>
              <div className="space-y-4 pt-4 sm:space-y-5 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <SaveButtons eventId={event.id} />
                </div>
                {event.event_date && (
                  <div>
                    <AddToCalendarButton
                      title={event.title}
                      start={event.event_date}
                      location={[event.place, neighborhoodLabel]
                        .filter(Boolean)
                        .join(", ")}
                      description={event.description ?? undefined}
                      uid={`${event.id}@whisperer-ring`}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <ShareButton
                    title={event.title}
                    url={
                      typeof window !== "undefined"
                        ? window.location.href
                        : `https://plastic-community.vercel.app/event/${event.id}`
                    }
                  />
                </div>
                {event.link && (
                  <div>
                    <a
                      href={event.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 text-sm font-medium text-link underline underline-offset-4 hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      Website
                    </a>
                  </div>
                )}
                {event.description && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-base">
                    {event.description}
                  </p>
                )}
              </div>
            </article>

            {nearby && nearby.length > 0 && (
              <section className="mt-8 sm:mt-10">
                <h2 className="font-mono text-[11px] uppercase tracking-widest text-foreground sm:text-xs">
                  More in <span className="text-neighborhood">{neighborhoodLabel}</span>
                </h2>
                <ul className="mt-3 grid gap-3">
                  {nearby.map((e) => {
                    const t = eventTypeMeta(e.event_type);
                    const d = e.event_date ? new Date(e.event_date) : null;
                    const valid = d && !isNaN(d.getTime()) ? d : null;
                    return (
                      <li key={e.id}>
                        <Link
                          to="/event/$eventId"
                          params={{ eventId: e.id }}
                          className="group flex items-start gap-3 border-2 border-foreground bg-card p-3 transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-stamp"
                        >
                          <div className="grid h-12 w-12 shrink-0 place-items-center border-2 border-foreground bg-background">
                            <div className="text-center leading-tight">
                              <div className="font-mono text-[9px] uppercase tracking-wider text-foreground">
                                {valid ? format(valid, "MMM") : "—"}
                              </div>
                              <div className="font-brand text-lg text-foreground">
                                {valid ? format(valid, "d") : "?"}
                              </div>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground">
                              <t.Icon className="h-3 w-3" aria-hidden="true" />
                              <span>{t.label}</span>
                            </div>
                            <h3 className="mt-0.5 truncate font-brand text-base uppercase text-foreground group-hover:text-primary">
                              {e.title}
                            </h3>
                            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-foreground">
                              {valid ? format(valid, "EEE, HH:mm") : "Date TBA"}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRecurring ? "Delete recurring event?" : "Delete this event?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRecurring
                ? "This is a recurring event. Choose whether to delete only this occurrence or this and all future occurrences."
                : "Are you sure you want to delete this event? This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRecurring ? "flex-col gap-2 sm:flex-col sm:space-x-0" : undefined}>
            {isRecurring ? (
              <>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void remove();
                  }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting…" : "Delete this event only"}
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void removeAllFuture();
                  }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting…" : "Delete all future occurrences"}
                </AlertDialogAction>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              </>
            ) : (
              <>
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
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function stripNeighborhoodSuffix(place: string, neighborhood: string) {
  const cleaned = cleanPlace(place);
  const suffix = ` · ${neighborhood}`;
  return cleaned.endsWith(suffix) ? cleaned.slice(0, -suffix.length) : cleaned;
}
