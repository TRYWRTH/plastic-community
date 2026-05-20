// Lazy-loads the Google Maps JS API and ensures the new Places library
// (including PlaceAutocompleteElement) is imported and ready.
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
  if (window.__gmapsLoader) return window.__gmapsLoader;

  window.__gmapsLoader = new Promise<void>((resolve, reject) => {
    const importPlaces = async () => {
      try {
        // The new PlaceAutocompleteElement lives in the "places" library
        // and must be imported via importLibrary before use.
        await window.google.maps.importLibrary("places");
        resolve();
      } catch (err) {
        reject(err as Error);
      }
    };

    if (window.google?.maps?.importLibrary) {
      importPlaces();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-google-maps]",
    );
    if (existing) {
      const wait = () => {
        if (window.google?.maps?.importLibrary) return importPlaces();
        setTimeout(wait, 50);
      };
      wait();
      return;
    }

    window.__gmapsInit = () => importPlaces();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&loading=async&callback=__gmapsInit&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__gmapsLoader;
}
