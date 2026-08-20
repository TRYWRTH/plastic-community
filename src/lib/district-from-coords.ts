import type { Neighborhood } from "@/lib/constants";

// Approximate centroids of Berlin's 12 Bezirke. Used to resolve a district
// from real coordinates via nearest-centroid matching — far more reliable
// than guessing from street-name keywords in an address string, since every
// event already has real lat/lng from geocoding or Places Autocomplete.
export const BERLIN_DISTRICT_CENTROIDS: { value: Neighborhood; lat: number; lng: number }[] = [
  { value: "Mitte", lat: 52.52, lng: 13.405 },
  { value: "Friedrichshain-Kreuzberg", lat: 52.505, lng: 13.454 },
  { value: "Pankow", lat: 52.569, lng: 13.401 },
  { value: "Charlottenburg-Wilmersdorf", lat: 52.507, lng: 13.291 },
  { value: "Spandau", lat: 52.535, lng: 13.198 },
  { value: "Steglitz-Zehlendorf", lat: 52.434, lng: 13.263 },
  { value: "Tempelhof-Schöneberg", lat: 52.468, lng: 13.385 },
  { value: "Neukölln", lat: 52.481, lng: 13.435 },
  { value: "Treptow-Köpenick", lat: 52.457, lng: 13.573 },
  { value: "Marzahn-Hellersdorf", lat: 52.537, lng: 13.573 },
  { value: "Lichtenberg", lat: 52.535, lng: 13.5 },
  { value: "Reinickendorf", lat: 52.566, lng: 13.3 },
];

// Longitude degrees are shorter than latitude degrees at this latitude —
// compress them so distance comparisons aren't skewed east-west.
const LNG_COMPRESSION = Math.cos((52.5 * Math.PI) / 180);

// Only trust the nearest centroid within Berlin's own extent — beyond that,
// a point is more likely in Brandenburg and shouldn't be forced into a
// Bezirk just because it's the closest one on paper.
const MAX_DISTANCE_DEG = 0.2;

export function nearestBerlinDistrict(lat: number, lng: number): Neighborhood | null {
  let best: Neighborhood | null = null;
  let bestDist = Infinity;
  for (const c of BERLIN_DISTRICT_CENTROIDS) {
    const dLat = lat - c.lat;
    const dLng = (lng - c.lng) * LNG_COMPRESSION;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = c.value;
    }
  }
  return bestDist <= MAX_DISTANCE_DEG * MAX_DISTANCE_DEG ? best : null;
}
