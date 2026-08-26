// One-off (non-hook) Photon lookup — used as a fallback when the user typed
// an address by hand instead of picking a suggestion from the autocomplete
// dropdown, so we still end up with coordinates to save. Same free,
// no-API-key OSM-based service as usePhotonAutocomplete.
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=1&lat=52.52&lon=13.405&location_bias_scale=0.2`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { geometry: { coordinates: [number, number] } }[];
    };
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lng: lon };
  } catch {
    return null;
  }
}
