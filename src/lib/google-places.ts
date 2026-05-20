// Lazy-loads the Google Maps JS API (Places library) on demand and resolves
// only once `window.google.maps.places` is actually available.
const GOOGLE_PLACES_API_KEY =
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY ||
  "AIzaSyA5tkm_gjsdsja-aFDatefyf33l20DT9vw";

declare global {
  interface Window {
    google?: any;
    __gmapsLoader?: Promise<void>;
    __gmapsInit?: () => void;
  }
}

export function loadGooglePlaces(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsLoader) return window.__gmapsLoader;

  window.__gmapsLoader = new Promise<void>((resolve, reject) => {
    // Poll until the places library is ready — works whether the script was
    // just injected or is already present in the document.
    const waitForPlaces = () => {
      const start = Date.now();
      const tick = () => {
        if (window.google?.maps?.places) return resolve();
        if (Date.now() - start > 15000) {
          return reject(new Error("Google Maps Places API timed out"));
        }
        setTimeout(tick, 50);
      };
      tick();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-google-maps]",
    );
    if (existing) {
      waitForPlaces();
      return;
    }

    // Use the documented `callback` param so we know when the API has
    // fully initialised (script `onload` fires too early with loading=async).
    window.__gmapsInit = () => waitForPlaces();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&loading=async&callback=__gmapsInit`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__gmapsLoader;
}
