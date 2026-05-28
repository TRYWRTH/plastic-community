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
import { formatEventDateRange } from "@/lib/format-date-range";
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
        .select("id,title,place,neighborhood,event_date,event_type,created_by")
        .eq("neighborhood", event!.neighborhood)
        .neq("id", eventId)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(30);
      if (error) throw error;
      // Collapse recurring series: only keep the earliest upcoming instance
      // per (title + created_by) group.
      const seen = new Set<string>();
      const deduped: typeof data = [];
      for (const e of data ?? []) {
        const key = `${e.created_by}::${e.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(e);
        if (deduped.length >= 3) break;
      }
      return deduped;
    },
  });

  const { data: upcomingOccurrences } = useQuery({
    queryKey: ["events", "occurrences", event?.title, event?.created_by, eventId],
    enabled: !!event?.title && !!event?.created_by,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,event_date")
        .eq("title", event!.title)
        .eq("created_by", event!.created_by)
        .neq("id", eventId)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(4);
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

const isCreator = !!event && (
  user?.id === event.created_by || 
user?.id === import.meta.env.VITE_ADMIN_USER_ID
);
  const neighborhoodLabel = event ? neighborhoodMeta(event.neighborhood).label : "";

  return (
    <div className="min-h-screen bg-paper">
      {savedBannerVisible && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed inset-x-0 top-0 z-50 border-b-2 border-foreground bg-foreground text-neighborhood shadow-stamp transition-opacity duration-500 ${
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
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex h-11 items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
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
                          className="-mr-2 grid h-10 w-10 place-items-center rounded-none text-foreground hover:text-neighborhood"
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
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0 text-neighborhood" />
                    <span>{format(new Date(event.event_date), "EEE, MMM d · HH:mm")}</span>
                    {isRecurring && (
                      <span className="inline-flex items-center gap-1 border border-foreground/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-neighborhood">
                        ↻ {String(event.repeats).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="inline-flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neighborhood" />
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
                {(() => {
                  const now = new Date();
                  const eventDate = new Date(event.event_date);
                  const isPastOrToday =
                    eventDate.toDateString() === now.toDateString() ||
                    eventDate < now;

                  const next = upcomingOccurrences?.[0];
                  if (isPastOrToday && next) {
                    return (
                      <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-foreground sm:text-xs">
                        <span className="text-neighborhood">↻ Next occurrence:</span>{" "}
                        <Link
                          to="/event/$eventId"
                          params={{ eventId: next.id }}
                          className="text-link underline underline-offset-2 hover:text-neighborhood"
                        >
                          {format(new Date(next.event_date), "EEE, MMM d · HH:mm")}
                        </Link>
                      </div>
                    );
                  }
                  return null;
                })()}
                {upcomingOccurrences && upcomingOccurrences.length > 0 && (
                  <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-foreground sm:text-xs">
                    <span className="text-neighborhood">↻ Also happening:</span>{" "}
                    {upcomingOccurrences.map((o, i) => (
                      <span key={o.id}>
                        {i > 0 && " · "}
                        <Link
                          to="/event/$eventId"
                          params={{ eventId: o.id }}
                          className="text-link underline underline-offset-2 hover:text-neighborhood"
                        >
                          {format(new Date(o.event_date), "MMM d")}
                        </Link>
                      </span>
                    ))}
                  </div>
                )}

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
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 text-sm font-medium text-neighborhood underline underline-offset-4 hover:opacity-80"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    Website
                  </a>
                )}
                {event.description && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-base">
                    {renderDescription(event.description)}
                  </p>
                )}
                {event.link && <LinkPreviewCard url={event.link} />}
              </div>
            </article>

            <div className="border-t-2 border-foreground/15" />

            {nearby && nearby.length > 0 && (
              <section className="mt-10 sm:mt-12">
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-foreground sm:text-sm">
                  More in{" "}
                  <Link
                    to="/"
                    search={{ neighborhood: event.neighborhood }}
                    className="text-neighborhood hover:underline"
                  >
                    {neighborhoodLabel}
                  </Link>
                </h2>
                <ul className="mt-3 grid gap-3">
                  {nearby.map((e) => {
                    const t = eventTypeMeta(e.event_type);
                    const d = e.event_date ? new Date(e.event_date) : null;
                    const valid = d && !isNaN(d.getTime()) ? d : null;
                    return (
                      <li key={e.id} className="min-w-0 w-full max-w-full">
                        <Link
                          to="/event/$eventId"
                          params={{ eventId: e.id }}
                          className="group flex w-full max-w-full items-start gap-3 overflow-hidden border-2 border-foreground bg-card p-3 transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-stamp"
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
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground">
                              <t.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{t.label}</span>
                            </div>
                            <h3 className="mt-0.5 truncate font-brand text-base uppercase text-foreground group-hover:text-neighborhood">
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

function LinkPreviewCard({ url }: { url: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: async () => {
      const res = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
      );
      if (!res.ok) throw new Error("preview failed");
      const json = (await res.json()) as {
        status?: string;
        data?: {
          title?: string;
          description?: string;
          image?: { url?: string };
          publisher?: string;
          url?: string;
        };
      };
      if (json.status !== "success" || !json.data) throw new Error("no data");
      return json.data;
    },
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="block w-full overflow-hidden border-2 border-foreground bg-card">
        <div className="h-[200px] w-full animate-pulse bg-muted" />
        <div className="space-y-2 p-3">
          <div className="h-2 w-20 animate-pulse bg-muted" />
          <div className="h-4 w-3/4 animate-pulse bg-muted" />
          <div className="h-3 w-full animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (isError || !data) return null;
  const title = data.title || data.publisher;
  if (!title && !data.image?.url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="group block w-full overflow-hidden border-2 border-foreground bg-card transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-stamp"
    >
      {data.image?.url && <LinkPreviewImage src={data.image.url} />}
      <div className="space-y-1 p-3">
        {data.publisher && (
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/70">
            {data.publisher}
          </div>
        )}
        {title && (
          <div className="font-brand text-base uppercase leading-tight text-foreground group-hover:text-neighborhood">
            {title}
          </div>
        )}
        {data.description && (
          <p className="line-clamp-2 text-xs text-foreground/80">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}

function LinkPreviewImage({ src }: { src: string }) {
  const [orientation, setOrientation] = useState<"landscape" | "portrait" | null>(null);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const isPortrait = orientation === "portrait";
  return (
    <div
      className={`relative flex w-full items-center justify-center overflow-hidden border-b-2 border-foreground bg-muted ${
        isPortrait ? "max-h-[300px]" : "h-[200px]"
      }`}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          setOrientation(img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait");
        }}
        onError={() => setHidden(true)}
        className={
          isPortrait
            ? "max-h-[300px] w-auto object-contain"
            : "h-full w-full object-cover"
        }
      />
    </div>
  );
}



const LINK_CLASS = "text-neighborhood underline underline-offset-2 hover:opacity-80";

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
      {children}
    </a>
  );
}

function renderTextSegment(text: string, keyPrefix: string): React.ReactNode[] {
  // @handle only when at start or after whitespace (not part of an email)
  const re = /(https?:\/\/[^\s)]+)|(?:^|(?<=\s))(@[A-Za-z0-9_.]+)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1]) {
      out.push(<ExtLink key={key} href={m[1]}>{m[1]}</ExtLink>);
    } else if (m[2]) {
      const handle = m[2].slice(1);
      out.push(
        <ExtLink key={key} href={`https://www.instagram.com/${handle}/`}>
          {m[2]}
        </ExtLink>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderDescription(text: string): React.ReactNode[] {
  const md = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = md.exec(text)) !== null) {
    if (m.index > last) {
      out.push(...renderTextSegment(text.slice(last, m.index), `t${i}`));
    }
    out.push(<ExtLink key={`md-${i}`} href={m[2]}>{m[1]}</ExtLink>);
    i++;
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderTextSegment(text.slice(last), `t${i}`));
  return out;
}


