import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { neighborhoodMeta } from "@/lib/constants";

type EventLike = {
  id: string;
  title: string;
  event_date: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
};

export function EventsMap({ events }: { events: EventLike[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: 52.52, lng: 13.405 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoRef.current = new google.maps.InfoWindow();
        renderMarkers();
      })
      .catch(() => {
        /* fail silently */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers when events change
  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  function renderMarkers() {
    const google = window.google;
    const map = mapRef.current;
    if (!google || !map) return;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    for (const e of events) {
      if (typeof e.lat !== "number" || typeof e.lng !== "number") continue;
      const marker = new google.maps.Marker({
        position: { lat: e.lat, lng: e.lng },
        map,
        title: e.title,
      });
      marker.addListener("click", () => {
        const d = e.event_date ? new Date(e.event_date) : null;
        const when = d && !isNaN(d.getTime()) ? format(d, "EEE d MMM, HH:mm") : "Date TBA";
        const n = neighborhoodMeta(e.neighborhood as any);
        const html = `
          <div style="font-family: ui-monospace, monospace; max-width: 220px;">
            <div style="font-weight: 700; text-transform: uppercase; font-size: 14px; margin-bottom: 4px;">
              ${escapeHtml(e.title)}
            </div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px;">
              ${escapeHtml(when)}
            </div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; color: #2f7a3a;">
              ${escapeHtml(n.label)}
            </div>
            <a href="/event/${encodeURIComponent(e.id)}"
               style="display:inline-block; border:2px solid #000; padding:4px 8px; text-decoration:none; color:#000; font-size:11px; text-transform:uppercase; letter-spacing:0.08em;">
              View event →
            </a>
          </div>
        `;
        infoRef.current.setContent(html);
        infoRef.current.open({ anchor: marker, map });
      });
      markersRef.current.push(marker);
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full border-2 border-foreground bg-muted"
      style={{ height: "calc(100vh - 220px)", minHeight: 400 }}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
