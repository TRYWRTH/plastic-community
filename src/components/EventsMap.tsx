import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isBefore, isSameDay, startOfDay } from "date-fns";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { EventType, Neighborhood } from "@/lib/constants";
import { loadGoogleMapsCore } from "@/lib/google-places";
import { createEventSlug } from "@/lib/slug";
import { cleanPlace } from "@/lib/clean-place";
import { shortDistrictLabel } from "@/lib/clean-district";
import { decodeHtmlEntities } from "@/lib/decode-html-entities";
import { resolveCardImage } from "@/lib/event-card-image";
import { EventThumbPoster } from "@/components/EventPoster";

type EventLike = {
  id: string;
  title: string;
  place: string;
  event_date: string;
  end_date: string | null;
  neighborhood: Neighborhood;
  lat: number | null;
  lng: number | null;
  is_secret: boolean;
  location_tba: boolean;
  event_type: EventType;
  description: string | null;
  image_url: string | null;
  link_preview_image_url: string | null;
  link_preview_site_name: string | null;
};

/** Inclusive end instant: the event's own end_date, or its start if it's a single-day event. */
function effectiveEnd(e: EventLike, start: Date): Date {
  if (!e.end_date) return start;
  const end = new Date(e.end_date);
  return isNaN(end.getTime()) || end < start ? start : end;
}

type WhenFilter = "tonight" | "week" | "all";

const WHEN_STEPS: { value: WhenFilter; label: string }[] = [
  { value: "all", label: "EVERYTHING" },
  { value: "tonight", label: "TONIGHT" },
  { value: "week", label: "THIS WEEK" },
];

// Berlin city center — the radar's default view.
const BERLIN_CENTER = { lat: 52.5065, lng: 13.3947 };
const DEFAULT_ZOOM = 12;
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;

// A dark red/black theme so the base map reads as part of the app rather
// than a bolted-on embed — streets stay legible (brighter = bigger road),
// everything else recedes.
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#3e0109" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#c98a86" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#2a0206" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#ff9e96" }],
  },
  {
    featureType: "administrative.neighborhood",
    elementType: "labels.text.fill",
    stylers: [{ color: "#e2a19d" }],
  },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#3e0109" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#360108" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1a0004" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#7a1420" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#5a0210" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#a8283a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#8a1c2a" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#6b1119" }] },
];

// Coral/peach brand accent — used as the marker's glow ring so dots pop
// against the dark map, regardless of the dot's own fill color.
const MARKER_RING_COLOR = "#FF6A63";

// Persists the last selection + viewport across unmounts within this tab's
// session (e.g. navigating to an event's details and back), so returning to
// Radar picks up where the user left off instead of resetting to the
// default Berlin view.
const RADAR_MAP_STATE_KEY = "radar-map-state";

type StoredMapState = {
  selectedId: string | null;
  center: { lat: number; lng: number } | null;
  zoom: number | null;
};

function loadMapState(): StoredMapState | null {
  try {
    const raw = sessionStorage.getItem(RADAR_MAP_STATE_KEY);
    return raw ? (JSON.parse(raw) as StoredMapState) : null;
  } catch {
    return null;
  }
}

function saveMapState(state: StoredMapState): void {
  try {
    sessionStorage.setItem(RADAR_MAP_STATE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing) — not critical
  }
}

/**
 * Small circular marker icon rendered as an inline SVG data URI — a coral
 * glow ring behind a solid dot. When `pulse` is set (selected marker), an
 * animated ring expands and fades outward via SMIL, giving the selected pin
 * a prominent, unmistakable highlight.
 */
function pinIcon(opts: {
  dotColor: string;
  ringColor?: string;
  dotSize: number;
  haloSize: number;
  pulse?: boolean;
}): google.maps.Icon {
  const { dotColor, ringColor = MARKER_RING_COLOR, dotSize, haloSize, pulse } = opts;
  const pulseReach = pulse ? dotSize / 2 + 16 : 0;
  const ringMax = Math.max(dotSize / 2 + haloSize, pulseReach);
  const total = (ringMax + 4) * 2;
  const c = total / 2;
  const pulseRing = pulse
    ? `<circle cx="${c}" cy="${c}" r="${dotSize / 2}" fill="none" stroke="${ringColor}" stroke-width="2.5" opacity="0.9">` +
      `<animate attributeName="r" values="${dotSize / 2};${pulseReach};${dotSize / 2}" dur="1.6s" repeatCount="indefinite" />` +
      `<animate attributeName="opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />` +
      `</circle>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}">` +
    `<circle cx="${c}" cy="${c}" r="${dotSize / 2 + haloSize}" fill="${ringColor}" opacity="0.28"/>` +
    pulseRing +
    `<circle cx="${c}" cy="${c}" r="${dotSize / 2}" fill="${dotColor}"/>` +
    `<circle cx="${c}" cy="${c}" r="${dotSize / 2}" fill="none" stroke="${ringColor}" stroke-width="1.5"/>` +
    `</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(total, total),
    anchor: new google.maps.Point(c, c),
  };
}

export function EventsMap({ events }: { events: EventLike[] }) {
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [when, setWhen] = useState<WhenFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => loadMapState()?.selectedId ?? null,
  );
  // Hover state (desktop rows <-> map markers) — kept separate from the
  // clicked/tapped selection so a fleeting hover never opens the overlay
  // detail card, but still lets the marker and row highlight sync live.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);

  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

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
          { event_id: eventId, user_id: user.id, status: "interested" },
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
    // Still-running multi-day events count as "upcoming" too — only their
    // end date matters, not when they started.
    const byKey = new Map<string, EventLike[]>();
    for (const e of events) {
      const d = new Date(e.event_date);
      if (isNaN(d.getTime())) continue;
      const end = effectiveEnd(e, d);
      if (isBefore(end, todayStart) && !isSameDay(end, todayStart)) continue;
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
        if (isNaN(d.getTime())) return false;
        const startDay = startOfDay(d);
        const endDay = startOfDay(effectiveEnd(e, d));
        if (isBefore(endDay, todayStart)) return false;
        if (when === "tonight")
          return !isBefore(todayStart, startDay) && !isBefore(endDay, todayStart);
        if (when === "week") return !isBefore(weekCutoff, startDay);
        return true;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    const nearWithIndex = filtered.map((e, i) => ({ ...e, pinNo: i + 1 }));
    const pinsSource = nearWithIndex.filter(
      (e) =>
        !e.is_secret && !e.location_tba && typeof e.lat === "number" && typeof e.lng === "number",
    );

    return { near: nearWithIndex, pins: pinsSource };
  }, [events, when]);

  const peek = near.find((e) => e.id === selectedId) ?? null;
  // What the map marker (and, on desktop, the list row) should visually
  // highlight — a hover takes priority over the clicked/tapped selection.
  const activeId = hoveredId ?? selectedId;

  /**
   * Select an event (from a marker click or a list row) and smoothly
   * pan/zoom the map to its coordinates when available. The map is pinned
   * at the top of the view (fixed height, always visible), so selecting
   * from the list never scrolls the list or the page — only the map's own
   * viewport moves. Selecting the already-selected event toggles it off,
   * mirroring "tap the pin again to close".
   */
  const selectEvent = (id: string, coords?: { lat: number | null; lng: number | null }) => {
    setSelectedId((cur) => {
      const next = cur === id ? null : id;
      if (next) {
        const map = mapRef.current;
        if (map && coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
          map.panTo({ lat: coords.lat, lng: coords.lng });
          if ((map.getZoom() ?? DEFAULT_ZOOM) < 14) map.setZoom(14);
        }
      }
      return next;
    });
  };

  // Create the map once, resuming the last saved viewport if this tab
  // already had one (e.g. the user is coming back from an event's details).
  useEffect(() => {
    let cancelled = false;
    const stored = loadMapState();
    loadGoogleMapsCore()
      .then(() => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;
        const map = new google.maps.Map(mapDivRef.current, {
          center: stored?.center ?? BERLIN_CENTER,
          zoom: stored?.zoom ?? DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          styles: MAP_STYLE,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          restriction: {
            latLngBounds: { north: 52.7, south: 52.3, west: 12.9, east: 13.9 },
            strictBounds: false,
          },
        });
        map.addListener("zoom_changed", () => setZoomLevel(map.getZoom() ?? DEFAULT_ZOOM));
        // Fires on clicks anywhere on the map that aren't a marker (marker
        // clicks are a separate listener and don't bubble here) — clears
        // the selected pin, same as tapping the same pin again.
        map.addListener("click", () => setSelectedId(null));
        // Persist the viewport whenever it settles (pan/zoom end), keeping
        // whatever selection was last saved — selection changes are
        // persisted separately, below.
        map.addListener("idle", () => {
          const c = map.getCenter();
          if (!c) return;
          saveMapState({
            selectedId: loadMapState()?.selectedId ?? null,
            center: { lat: c.lat(), lng: c.lng() },
            zoom: map.getZoom() ?? DEFAULT_ZOOM,
          });
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep markers in sync with the filtered pin list (and hover/selection
  // state) — hovering or clicking a desktop row highlights its marker here,
  // and hovering/clicking a marker highlights its row via setHoveredId below.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = pins.map((p) => {
      const isTonight = isSameDay(new Date(p.event_date), new Date());
      const active = p.id === activeId;
      const dotColor = isTonight ? "#FF6A63" : "#F7E7E4";
      const marker = new google.maps.Marker({
        position: { lat: p.lat as number, lng: p.lng as number },
        map,
        icon: pinIcon({
          dotColor,
          dotSize: active ? 20 : isTonight ? 13 : 10,
          haloSize: active ? 10 : isTonight ? 6 : 5,
          pulse: active,
        }),
        title: p.title,
        zIndex: active ? 999 : isTonight ? 500 : 1,
      });
      marker.addListener("click", () => {
        selectEvent(p.id, { lat: p.lat, lng: p.lng });
      });
      marker.addListener("mouseover", () => setHoveredId(p.id));
      marker.addListener("mouseout", () => setHoveredId((cur) => (cur === p.id ? null : cur)));
      return marker;
    });
  }, [pins, activeId, mapReady]);

  // Persist selection changes so returning to Radar restores the same pin.
  useEffect(() => {
    const map = mapRef.current;
    const c = map?.getCenter();
    saveMapState({
      selectedId,
      center: c ? { lat: c.lat(), lng: c.lng() } : (loadMapState()?.center ?? null),
      zoom: map?.getZoom() ?? loadMapState()?.zoom ?? null,
    });
  }, [selectedId]);

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      for (const m of markersRef.current) m.setMap(null);
    };
  }, []);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (map.getZoom() ?? DEFAULT_ZOOM) + delta));
    map.setZoom(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={mapWrapperRef}
        className="relative sticky top-0 z-10 h-[40vh] w-full shrink-0 overflow-hidden rounded-[26px] bg-shell-deep lg:h-[50vh]"
      >
        <div ref={mapDivRef} className="absolute inset-0" />

        {mapError && (
          <div className="absolute inset-0 grid place-items-center bg-shell-deep px-8 text-center">
            <span className="font-mono text-[11px] tracking-[0.12em] text-dim">
              Map unavailable right now — the event list below still works.
            </span>
          </div>
        )}

        {/* Radar HUD — a fixed decorative overlay above the live map, rings
            and sweep are semi-transparent so streets stay visible through them. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
                borderColor: `rgba(247,231,228,${0.14 + i * 0.05})`,
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
        </div>

        <span className="pointer-events-none absolute left-4 top-3 font-mono text-[9px] tracking-[0.14em] text-dim">
          {peek ? "TAP THE CARD FOR DETAILS" : "TAP A PIN OR EVENT"}
        </span>

        <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-full border border-foreground/[0.16] bg-shell-deep/80">
          <button
            type="button"
            onClick={() => zoomBy(1)}
            disabled={zoomLevel >= MAX_ZOOM}
            aria-label="Zoom in"
            className="grid h-8 w-8 place-items-center text-foreground disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <span className="h-px w-full bg-foreground/[0.16]" />
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            disabled={zoomLevel <= MIN_ZOOM}
            aria-label="Zoom out"
            className="grid h-8 w-8 place-items-center text-foreground disabled:opacity-30"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
        {peek && (
          <div className="absolute inset-x-3 bottom-3">
            <Link
              to="/event/$eventId"
              params={{ eventId: createEventSlug(peek.title, peek.id) }}
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
                  {format(new Date(peek.event_date), "EEE d MMM")} · {cleanPlace(peek.place)}
                </span>
              </span>
              <SaveDot
                saved={savedIds.has(peek.id)}
                isAuthenticated={isAuthenticated}
                onToggle={() => toggleSave(peek.id)}
                inverted
              />
              <ChevronRight
                className="h-4 w-4 shrink-0 opacity-70"
                aria-label="View event details"
              />
            </Link>
          </div>
        )}
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full gap-1.5 py-3.5">
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

        <div className="mx-auto flex w-full flex-col gap-2 pb-28 md:max-w-4xl md:gap-2.5">
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
            near.map((e) => {
              const isSelected = e.id === selectedId;
              const isActive = e.id === activeId;
              const cardImage = resolveCardImage(e);
              const eventUrl = {
                to: "/event/$eventId" as const,
                params: { eventId: createEventSlug(e.title, e.id) },
              };
              return (
                <div key={e.id}>
                  {/* Mobile: compact single-line row. */}
                  <div
                    className={`grid grid-cols-[26px_1fr_auto] items-center gap-3 border-t border-border/[0.16] py-3.5 md:hidden ${
                      isSelected ? "bg-primary/[0.06]" : ""
                    }`}
                  >
                    <span
                      className={`font-brand text-[15px] ${
                        isSameDay(new Date(e.event_date), new Date()) ? "text-hot" : "text-muted-2"
                      }`}
                    >
                      {e.pinNo}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectEvent(e.id, { lat: e.lat, lng: e.lng })}
                      aria-pressed={isSelected}
                      className="flex min-w-0 flex-col gap-1 text-left"
                    >
                      <span className="truncate text-[16px] font-medium tracking-[-0.01em] text-foreground">
                        {e.title}
                      </span>
                      <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                        {format(new Date(e.event_date), "EEE d MMM")} ·{" "}
                        {shortDistrictLabel(e.neighborhood as string).toUpperCase()}
                      </span>
                    </button>
                    <SaveDot
                      saved={savedIds.has(e.id)}
                      isAuthenticated={isAuthenticated}
                      onToggle={() => toggleSave(e.id)}
                    />
                  </div>

                  {/* Desktop (>=768px): rich horizontal row — thumbnail, title/date/district/
                      description, save + view-details. Hover or click syncs the map marker. */}
                  <div
                    onMouseEnter={() => setHoveredId(e.id)}
                    onMouseLeave={() => setHoveredId((cur) => (cur === e.id ? null : cur))}
                    className={`hidden items-center gap-4 rounded-2xl border p-3.5 transition-colors md:flex ${
                      isActive
                        ? "border-primary bg-primary/[0.08]"
                        : "border-border/[0.16] bg-transparent hover:bg-foreground/[0.04]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectEvent(e.id, { lat: e.lat, lng: e.lng })}
                      aria-pressed={isSelected}
                      className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl"
                    >
                      {cardImage ? (
                        <img
                          src={cardImage.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <EventThumbPoster eventType={e.event_type} className="h-full w-full" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => selectEvent(e.id, { lat: e.lat, lng: e.lng })}
                      aria-pressed={isSelected}
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    >
                      <span className="truncate text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                        {e.title}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                        {format(new Date(e.event_date), "EEE d MMM · HH:mm")}
                      </span>
                      <span className="inline-flex w-fit rounded-full border border-border px-[9px] py-[3px] font-mono text-[9px] tracking-[0.1em] text-muted-2">
                        {shortDistrictLabel(e.neighborhood as string).toUpperCase()}
                      </span>
                      {e.description && (
                        <span className="truncate text-[13px] text-muted-foreground">
                          {decodeHtmlEntities(e.description)}
                        </span>
                      )}
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <SaveDot
                        saved={savedIds.has(e.id)}
                        isAuthenticated={isAuthenticated}
                        onToggle={() => toggleSave(e.id)}
                      />
                      <Link
                        {...eventUrl}
                        aria-label="View event details"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-foreground"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
