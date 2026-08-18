import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { format } from "date-fns";
import { ArrowLeft, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SaveButtons } from "@/components/SaveButtons";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { ShareButton } from "@/components/ShareButton";
import { useEventSaveCounts } from "@/lib/use-event-save-counts";
import { useEventSaverNames } from "@/lib/use-event-going-initials";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { eventTypeMeta, neighborhoodMeta } from "@/lib/constants";
import { cleanPlace } from "@/lib/clean-place";
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
      return { meta: [{ title: "Event — Whisper Ring by Plastic Productions" }] };
    }
    const when = ev.event_date ? format(new Date(ev.event_date), "EEE, MMM d · HH:mm") : "";
    const title = `${ev.title} — Whisper Ring by Plastic Productions`;

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
  const isAdmin = !!user && user.id === import.meta.env.VITE_ADMIN_USER_ID;
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savedBannerVisible, setSavedBannerVisible] = useState(false);

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem("event-just-saved");
      if (flag && flag === eventId) {
        sessionStorage.removeItem("event-just-saved");
        setSavedBannerVisible(true);
        const hide = setTimeout(() => setSavedBannerVisible(false), 2200);
        return () => clearTimeout(hide);
      }
    } catch {
      // sessionStorage may be unavailable (e.g. private browsing) — not critical
    }
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
  const { data: saverNames } = useEventSaverNames(eventId);

  const { data: creator } = useQuery({
    queryKey: ["profile", event?.created_by],
    enabled: !!event?.created_by && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", event!.created_by)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: nearby } = useQuery({
    queryKey: ["events", "nearby", event?.neighborhood, eventId],
    enabled: !!event?.neighborhood,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,event_date,event_type,created_by,neighborhood")
        .eq("neighborhood", event!.neighborhood)
        .neq("id", eventId)
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(30);
      if (error) throw error;
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

  // True if this event belongs to a recurring series — either it is the root
  // (repeats != 'none') or it is a copy that has siblings sharing the same
  // title + created_by (copies are stored with repeats='none').
  const { data: seriesSiblingCount } = useQuery({
    queryKey: ["events", "series-check", event?.title, event?.created_by, eventId],
    enabled: !!event?.title && !!event?.created_by && !(event?.repeats && event.repeats !== "none"),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("title", event!.title)
        .eq("created_by", event!.created_by)
        .neq("id", eventId);
      if (error) throw error;
      return count ?? 0;
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

  const isRecurring =
    !!event && ((event.repeats && event.repeats !== "none") || (seriesSiblingCount ?? 0) > 0);
  const isCreator = !!event && (user?.id === event.created_by || isAdmin);

  const d = event ? new Date(event.event_date) : null;
  const validDate = d && !isNaN(d.getTime()) ? d : null;
  const districtLabel = event ? neighborhoodMeta(event.neighborhood).label : "";
  const districtShort = event ? districtLabel.split("-")[0].toUpperCase() : "";
  const totalSaved = (counts?.going_count ?? 0) + (counts?.interested_count ?? 0);
  const addedByLabel = creator?.username ? `@${creator.username}` : "a member";
  const savedByLabel = (() => {
    if (totalSaved === 0) return "0 people";
    const names = saverNames?.names ?? [];
    const shown = names.slice(0, 6);
    const remaining = totalSaved - shown.length;
    if (shown.length === 0) return `${totalSaved} people`;
    return remaining > 0 ? `${shown.join(", ")} +${remaining} more` : shown.join(", ");
  })();

  return (
    <div className="min-h-screen bg-background">
      {savedBannerVisible && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-3">
          <span className="rounded-full bg-primary px-4 py-2.5 font-mono text-[10px] tracking-[0.14em] text-primary-foreground">
            CHANGES SAVED
          </span>
        </div>
      )}

      <div className="mx-auto max-w-[430px] px-5 pb-28 pt-2 lg:max-w-[560px]">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-[14px] font-mono text-[10px] tracking-[0.14em] text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> BACK
          </Link>
          {isCreator && event && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Event actions"
                  className="grid h-9 w-9 place-items-center rounded-full text-foreground"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/event/$eventId/edit" params={{ eventId: event.id }}>
                    <Pencil className="h-4 w-4" /> Edit event
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmDeleteOpen(true);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete event
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isLoading ? (
          <div className="mt-6 h-48 animate-pulse rounded-[22px] bg-muted" />
        ) : !event || !validDate ? (
          <p className="mt-6 font-mono text-xs uppercase tracking-wide text-foreground">
            Event not found.
          </p>
        ) : (
          <div className="mt-3.5 flex flex-col gap-4">
            {event.image_url && (
              <img
                src={event.image_url}
                alt=""
                className="h-[220px] w-full rounded-[22px] object-cover"
              />
            )}
            <div className="flex items-center gap-3.5">
              <span className="flex h-[70px] w-[70px] shrink-0 flex-col items-center justify-center rounded-[24px] bg-primary leading-[1.05] text-primary-foreground">
                <span className="font-brand text-[26px]">{format(validDate, "dd")}</span>
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase">
                  {format(validDate, "MMM")}
                </span>
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
                  {format(validDate, "EEEE, MMM d")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-brand text-xl text-link">{format(validDate, "HH:mm")}</span>
                  <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                    {districtShort}
                  </span>
                  {isRecurring && (
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground">
                      ↻ {String(event.repeats).toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
            </div>

            <h1 className="font-brand text-[34px] uppercase leading-[1.04] tracking-[0.01em] text-foreground">
              {event.title}
            </h1>

            <div className="flex flex-wrap gap-1.5 font-mono text-[10px] tracking-[0.12em]">
              <span className="rounded-full bg-primary px-[11px] py-[5px] text-primary-foreground">
                {eventTypeMeta(event.event_type).label.toUpperCase()}
              </span>
              <span className="rounded-full border border-border px-[11px] py-[5px] text-muted-2">
                {districtLabel}
              </span>
            </div>

            {upcomingOccurrences && upcomingOccurrences.length > 0 && (
              <div className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                <span className="text-link">↻ Also happening:</span>{" "}
                {upcomingOccurrences.map((o, i) => (
                  <span key={o.id}>
                    {i > 0 && " · "}
                    <Link
                      to="/event/$eventId"
                      params={{ eventId: o.id }}
                      className="text-link underline underline-offset-2"
                    >
                      {format(new Date(o.event_date), "MMM d")}
                    </Link>
                  </span>
                ))}
              </div>
            )}

            {event.description && (
              <p className="text-[15px] leading-[1.6] text-body">
                {renderDescription(event.description)}
              </p>
            )}

            <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2.5 font-mono text-[11px] text-foreground">
              <span className="pt-0.5 text-[9px] tracking-[0.16em] text-muted-foreground">
                WHERE
              </span>
              <span>
                {event.is_secret
                  ? "Secret location — contact the organiser"
                  : stripNeighborhoodSuffix(event.place, districtLabel)}
              </span>
              {isAdmin && (
                <>
                  <span className="pt-0.5 text-[9px] tracking-[0.16em] text-muted-foreground">
                    ADDED BY
                  </span>
                  <span>{addedByLabel}</span>
                </>
              )}
              <span className="pt-0.5 text-[9px] tracking-[0.16em] text-muted-foreground">
                SAVED BY
              </span>
              <span>{savedByLabel}</span>
            </div>

            {event.link && !isImageUrl(event.link) && (
              <a
                href={event.link}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-[11px] tracking-[0.08em] text-link underline underline-offset-[3px]"
              >
                ↗ {event.link.replace(/^https?:\/\//, "")}
              </a>
            )}
            {event.link && isImageUrl(event.link) && (
              <img
                src={event.link}
                alt={event.title}
                className="w-full rounded-2xl object-cover"
                loading="lazy"
              />
            )}
            {event.link && !isImageUrl(event.link) && <LinkPreviewCard url={event.link} />}

            {!event.is_secret && (
              <div className="relative h-[170px] overflow-hidden rounded-2xl bg-shell-deep">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(247,231,228,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(247,231,228,0.07) 1px, transparent 1px)",
                    backgroundSize: "30px 30px",
                  }}
                />
                <span
                  className="absolute left-0 right-0 top-[44%] h-[18px] bg-foreground/[0.05]"
                  style={{ transform: "rotate(-5deg)" }}
                />
                <span className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/[0.16]" />
                <span className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/[0.22]" />
                <span
                  className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hot"
                  style={{ boxShadow: "0 0 0 7px rgba(255,106,99,0.18)" }}
                />
                <span className="absolute left-1/2 top-[calc(50%+14px)] -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-[0.12em] text-muted-2">
                  {districtShort}
                </span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(cleanPlace(event.place))}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="absolute bottom-3 right-3 rounded-full bg-primary px-[13px] py-[9px] font-mono text-[9px] tracking-[0.12em] text-primary-foreground"
                >
                  OPEN IN MAPS
                </a>
              </div>
            )}

            {nearby && nearby.length > 0 && (
              <section className="mt-4 flex flex-col gap-2">
                <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-link">
                  MORE IN {districtShort}
                </span>
                {nearby.map((e) => {
                  const nd = new Date(e.event_date);
                  return (
                    <Link
                      key={e.id}
                      to="/event/$eventId"
                      params={{ eventId: e.id }}
                      className="flex items-center gap-3.5 rounded-[22px] bg-foreground/[0.07] px-4 py-3.5 hover:bg-foreground/[0.12]"
                    >
                      <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary leading-[1.05] text-primary-foreground">
                        <span className="font-brand text-base">{format(nd, "dd")}</span>
                        <span className="font-mono text-[8px] tracking-[0.1em] uppercase">
                          {format(nd, "MMM")}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-[16px] font-medium tracking-[-0.01em] text-foreground">
                          {e.title}
                        </span>
                        <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                          {format(nd, "HH:mm")} · {districtShort}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </section>
            )}
          </div>
        )}
      </div>

      {event && validDate && (
        <div
          className="fixed inset-x-0 bottom-[84px] z-20 grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-4 pb-2 pt-6"
          style={{ background: "linear-gradient(180deg, rgba(90,2,16,0), var(--background) 32%)" }}
        >
          <div className="col-span-4 mx-auto grid w-full max-w-[430px] grid-cols-[1fr_1fr_auto_auto] gap-2 lg:max-w-[560px]">
            <SaveButtons eventId={event.id} />
            <AddToCalendarButton
              title={event.title}
              start={event.event_date}
              location={[event.place, districtLabel].filter(Boolean).join(", ")}
              description={event.description ?? undefined}
              uid={`${event.id}@whisper-ring`}
              className="rounded-full bg-primary px-3 py-[15px] font-mono text-[10px] font-bold tracking-[0.14em] text-primary-foreground"
            >
              + CAL
            </AddToCalendarButton>
            <ShareButton
              title={event.title}
              url={
                typeof window !== "undefined"
                  ? window.location.href
                  : `https://plastic-community.vercel.app/event/${event.id}`
              }
              className="rounded-full border border-border px-4 py-[15px] font-mono text-[11px] text-foreground"
            >
              ↗
            </ShareButton>
          </div>
        </div>
      )}

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
          <AlertDialogFooter
            className={isRecurring ? "flex-col gap-2 sm:flex-col sm:space-x-0" : undefined}
          >
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

function LinkFallback({ url, domain }: { url: string; domain: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex w-full items-center gap-3 rounded-2xl bg-foreground/[0.07] px-4 py-3"
    >
      <div className="min-w-0">
        <div className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">{domain}</div>
        <div className="truncate font-mono text-xs text-foreground">{url}</div>
      </div>
    </a>
  );
}

function LinkPreviewCard({ url }: { url: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: async () => {
      const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
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
      <div className="w-full overflow-hidden rounded-2xl bg-foreground/[0.07]">
        <div className="h-[200px] w-full animate-pulse bg-muted" />
        <div className="space-y-2 p-3">
          <div className="h-2 w-20 animate-pulse bg-muted" />
          <div className="h-4 w-3/4 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();

  if (isError || !data) return <LinkFallback url={url} domain={domain} />;
  const title = data.title || data.publisher;
  if (!title && !data.image?.url) return <LinkFallback url={url} domain={domain} />;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="block w-full overflow-hidden rounded-2xl bg-foreground/[0.07]"
    >
      {data.image?.url && <LinkPreviewImage src={data.image.url} />}
      <div className="space-y-1 p-3">
        {data.publisher && (
          <div className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
            {data.publisher}
          </div>
        )}
        {title && (
          <div className="font-brand text-base uppercase leading-tight text-foreground">
            {title}
          </div>
        )}
        {data.description && <p className="line-clamp-2 text-xs text-body">{data.description}</p>}
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
      className={`relative flex w-full items-center justify-center overflow-hidden bg-muted ${
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
          isPortrait ? "max-h-[300px] w-auto object-contain" : "h-full w-full object-cover"
        }
      />
    </div>
  );
}

const LINK_CLASS = "text-link underline underline-offset-2";

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={LINK_CLASS}>
      {children}
    </a>
  );
}

function isImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp)$/.test(path);
  } catch {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }
}

function renderDescription(text: string): React.ReactNode {
  // Convert @handles (at start or after whitespace) to markdown links to Instagram,
  // so react-markdown renders them as clickable links alongside [text](url) and bare URLs.
  const withHandles = text.replace(
    /(^|\s)@([A-Za-z0-9_.]+)/g,
    (_, pre, handle) => `${pre}[@${handle}](https://www.instagram.com/${handle}/)`,
  );
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a: ({ href, children }) => <ExtLink href={href ?? "#"}>{children}</ExtLink>,
        p: ({ children }) => <p className="mt-0 mb-2 last:mb-0">{children}</p>,
        img: ({ src, alt }) => (
          <img
            src={src ?? ""}
            alt={alt ?? ""}
            className="my-2 w-full rounded-2xl object-cover"
            loading="lazy"
          />
        ),
      }}
    >
      {withHandles}
    </ReactMarkdown>
  );
}
