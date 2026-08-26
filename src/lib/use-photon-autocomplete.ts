import { useEffect, useRef, useState } from "react";

export type PhotonSuggestion = {
  label: string;
  street: string | null;
  housenumber: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  lat: number;
  lon: number;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    postcode?: string;
    country?: string;
    state?: string;
  };
};

type PhotonResponse = {
  features: PhotonFeature[];
};

// Bias results toward Berlin without hard-restricting to it.
const BERLIN_LAT = 52.52;
const BERLIN_LON = 13.405;
const LOCATION_BIAS_SCALE = 0.2;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 5;

function buildLabel(p: PhotonFeature["properties"]): string {
  const streetLine = [p.street, p.housenumber].filter(Boolean).join(" ");
  const parts = [streetLine || p.name, p.postcode, p.city].filter(Boolean);
  return parts.join(", ");
}

function toSuggestion(feature: PhotonFeature): PhotonSuggestion {
  const { properties: p, geometry } = feature;
  const [lon, lat] = geometry.coordinates;
  return {
    label: buildLabel(p),
    street: p.street ?? (p.name && !p.housenumber ? p.name : null) ?? null,
    housenumber: p.housenumber ?? null,
    city: p.city ?? null,
    postcode: p.postcode ?? null,
    country: p.country ?? null,
    lat,
    lon,
  };
}

/**
 * Debounced, cancellation-safe address autocomplete against Photon
 * (https://photon.komoot.io/api/) — an OSM-based geocoder with no API key
 * and no billing, replacing Google Places Autocomplete.
 */
export function usePhotonAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<PhotonSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}` +
        `&limit=${RESULT_LIMIT}&lat=${BERLIN_LAT}&lon=${BERLIN_LON}` +
        `&location_bias_scale=${LOCATION_BIAS_SCALE}`;

      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Photon request failed (${res.status})`);
          return res.json() as Promise<PhotonResponse>;
        })
        .then((data) => {
          setSuggestions((data.features ?? []).map(toSuggestion));
          setLoading(false);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Address search failed");
          setSuggestions([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [query]);

  return { suggestions, loading, error };
}
