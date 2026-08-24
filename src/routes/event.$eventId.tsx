import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, MapPin, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SaveButtons } from "@/components/SaveButtons";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { ShareButton } from "@/components/ShareButton";
import { useEventSaveCounts } from "@/lib/use-event-save-counts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { eventTypeMeta, neighborhoodMeta, priceTypeMeta } from "@/lib/constants";
import { resolveCardImage } from "@/lib/event-card-image";
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
  const cleanedPlace = event ? cleanPlace(event.place) : "";
  const locationDisplay =
    districtLabel && !cleanedPlace.toLowerCase().includes(districtLabel.toLowerCase())
      ? `${cleanedPlace} · ${districtLabel}`
      : cleanedPlace;
  const totalSaved = counts?.saved_count ?? 0;
  const addedByLabel = creator?.username ? `@${creator.username}` : "a member";
  const savedByLabel = `${totalSaved} ${totalSaved === 1 ? "person" : "people"}`;

  return (
    <div className="min-h-screen bg-background">
      {savedBannerVisible && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-3">
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
            {(() => {
              const cardImage = resolveCardImage(event);
              if (!cardImage) return null;
              const img = (
                <img
                  src={cardImage.url}
                  alt=""
                  className="h-[220px] w-full rounded-[22px] object-cover"
                />
              );
              const badge = cardImage.kind === "preview" && (
                <span className="absolute bottom-2.5 left-2.5 rounded-full bg-shell-deep/[0.72] px-2.5 py-1 font-mono text-[9px] tracking-[0.14em] text-muted-2">
                  VIA {(cardImage.siteName ?? "LINK").toUpperCase()}
                </span>
              );
              if (cardImage.kind === "preview" && event.link) {
                return (
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="relative block"
                  >
                    {img}
                    {badge}
                  </a>
                );
              }
              return (
                <div className="relative">
                  {img}
                  {badge}
                </div>
              );
            })()}

            <h1 className="font-brand text-[34px] uppercase leading-[1.04] tracking-[0.01em] text-foreground">
              {event.title}
            </h1>

            {/* Unified info card: date/time, tags, location, external link */}
            <div className="flex flex-col gap-3.5 rounded-[22px] bg-foreground/[0.05] p-4">
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
                    <span className="font-brand text-xl text-link">
                      {format(validDate, "HH:mm")}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                      {districtShort}
                    </span>
                    {isRecurring && (
                      <span className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground">
                        ↻ {String(event.repeats).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 font-mono text-[10px] tracking-[0.12em]">
                <span className="rounded-full bg-primary px-[11px] py-[5px] text-primary-foreground">
                  {eventTypeMeta(event.event_type).label.toUpperCase()}
                </span>
                <span className="rounded-full border border-border px-[11px] py-[5px] text-muted-2">
                  {districtLabel}
                </span>
                {event.price_type === "paid" && event.ticket_url && (
                  <a
                    href={event.ticket_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full bg-hot px-[11px] py-[5px] text-shell-deep"
                  >
                    {priceTypeMeta(event.price_type).label.toUpperCase()} ↗
                  </a>
                )}
                {event.price_type && !(event.price_type === "paid" && event.ticket_url) && (
                  <span
                    className={`rounded-full border px-[11px] py-[5px] ${
                      event.price_type === "paid"
                        ? "border-hot text-hot"
                        : "border-border text-muted-2"
                    }`}
                  >
                    {priceTypeMeta(event.price_type).label.toUpperCase()}
                  </span>
                )}
              </div>

              {event.is_secret ? (
                <div className="flex items-start gap-2 rounded-2xl bg-foreground/[0.07] px-4 py-3 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-[13px] leading-snug">
                    Secret location — contact the organiser
                  </span>
                </div>
              ) : event.location_tba ? (
                <div className="flex items-start gap-2 rounded-2xl bg-foreground/[0.07] px-4 py-3 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-[13px] leading-snug">
                    Location to be announced — check back closer to the date
                  </span>
                </div>
              ) : (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(cleanPlace(event.place))}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2.5 rounded-2xl border border-link/30 bg-link/[0.08] px-4 py-3 text-foreground transition-colors hover:bg-link/[0.14]"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-link/20">
                    <MapPin className="h-3.5 w-3.5 text-link" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground underline decoration-link/40 underline-offset-2">
                    {stripNeighborhoodSuffix(event.place, districtLabel)}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-link" />
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
              {event.link && !isImageUrl(event.link) && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex w-fit items-center gap-1.5 self-start rounded-full border border-border px-[13px] py-2 font-mono text-[10px] tracking-[0.12em] text-link"
                >
                  ↗ {linkLabel(event.link)}
                </a>
              )}
            </div>

            {/* Action buttons, inline in the flow right below the info card */}
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
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

            {event.description && (
              <p className="text-[15px] leading-[1.6] text-body">
                {renderDescription(event.description)}
              </p>
            )}

            {/* Subtle footer: added by / saved by */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
              {isAdmin && <span>ADDED BY {addedByLabel}</span>}
              <span>SAVED BY {savedByLabel}</span>
            </div>
          </div>
        )}
      </div>

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

/** Short label for the source-link chip, e.g. "instagram.com" -> "INSTAGRAM.COM". */
function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return url.replace(/^https?:\/\//, "").toUpperCase();
  }
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
