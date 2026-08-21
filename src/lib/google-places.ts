// Lazy-loads the Google Maps JS API script once, then lets callers pull in
// whichever library they need (places for autocomplete, maps for the radar's
// styled map view) via the dynamic-import API.
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

declare global {
  interface Window {
    google?: typeof google;
    __gmapsScriptLoader?: Promise<void>;
    __gmapsInit?: () => void;
  }
}

function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!GOOGLE_PLACES_API_KEY) return Promise.reject(new Error("Google Maps API key missing"));
  if (window.__gmapsScriptLoader) return window.__gmapsScriptLoader;

  window.__gmapsScriptLoader = new Promise<void>((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      const wait = () => {
        if (window.google?.maps) return resolve();
        setTimeout(wait, 50);
      };
      wait();
      return;
    }

    window.__gmapsInit = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&loading=async&callback=__gmapsInit&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__gmapsScriptLoader;
}

/** Ensures the Places library (Autocomplete) is loaded and ready. */
export async function loadGooglePlaces(): Promise<void> {
  await loadGoogleMapsScript();
  await window.google!.maps.importLibrary("places");
}

/** Ensures the core Maps library (Map, Marker, etc.) is loaded and ready. */
export async function loadGoogleMapsCore(): Promise<void> {
  await loadGoogleMapsScript();
  await window.google!.maps.importLibrary("maps");
}
