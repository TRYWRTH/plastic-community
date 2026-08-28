// Google Places API (New) — REST only, no JS SDK, no script tag, no Maps
// JavaScript API. Autocomplete (New) + Place Details (New) for address/venue
// lookup in the Add Event form. Session tokens batch an autocomplete search
// (keystrokes) together with the terminating Place Details call for billing.
const API_KEY =
  (import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined) ||
  (process.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined);

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

// Soft bias toward Berlin — not a hard restriction, results outside the
// circle can still come back.
const BERLIN_BIAS = { latitude: 52.52, longitude: 13.405 };
const BIAS_RADIUS_METERS = 20000;

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

export type PlaceDetailsResult = {
  formattedAddress: string;
  lat: number;
  lng: number;
};

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
    };
  }[];
};

type DetailsResponse = {
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
};

/**
 * Autocomplete (New) predictions for the given input, scoped to the given
 * session token. `includedPrimaryTypes` is deliberately omitted — leaving it
 * unset returns both establishments (venues) and addresses, rather than
 * restricting to one or the other.
 */
export async function fetchPlacePredictions(
  input: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  if (!API_KEY) throw new Error("Google Places API key missing");

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["de"],
      locationBias: {
        circle: { center: BERLIN_BIAS, radius: BIAS_RADIUS_METERS },
      },
    }),
  });
  if (!res.ok) throw new Error(`Autocomplete request failed (${res.status})`);

  const data = (await res.json()) as AutocompleteResponse;
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      placeId: p.placeId,
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      fullText: p.text?.text ?? "",
    }));
}

/**
 * Place Details (New) for a selected prediction — terminates the session
 * started by the autocomplete keystrokes. Field mask is deliberately
 * limited to Essentials-tier fields only (id/displayName/formattedAddress/
 * location) — no contact or atmosphere data, which would upgrade billing
 * for the whole response.
 */
export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetailsResult | null> {
  if (!API_KEY) throw new Error("Google Places API key missing");

  const url = `${DETAILS_URL}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as DetailsResponse;
  if (!data.location) return null;
  return {
    formattedAddress: data.formattedAddress || data.displayName?.text || "",
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}

/**
 * One-off fallback for a hand-typed address that never went through the
 * autocomplete dropdown (so we still end up with coordinates to save): runs
 * a throwaway session — a fresh token, one autocomplete call, Details on the
 * top hit — same Places API (New) surface as everything else, no separate
 * Geocoding API.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed || !API_KEY) return null;
  try {
    const token = crypto.randomUUID();
    const predictions = await fetchPlacePredictions(trimmed, token);
    const top = predictions[0];
    if (!top) return null;
    const details = await fetchPlaceDetails(top.placeId, token);
    return details ? { lat: details.lat, lng: details.lng } : null;
  } catch {
    return null;
  }
}
