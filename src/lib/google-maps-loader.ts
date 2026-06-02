// Minimal typing — we use the API dynamically via `any` to avoid a @types dep.
type GoogleNS = any;

let loaderPromise: Promise<GoogleNS> | null = null;

declare global {
  interface Window {
    google?: GoogleNS;
    __initGoogleMapsCallback?: () => void;
  }
}

export function loadGoogleMaps(): Promise<GoogleNS> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const bootstrap = async () => {
      try {
        await window.google.maps.importLibrary("maps");
        await window.google.maps.importLibrary("marker");
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    // If another loader (e.g. Places) already put the API on the page, just
    // import the libraries we need and resolve.
    if (window.google?.maps?.importLibrary) {
      bootstrap();
      return;
    }

    const key =
      (import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined) ||
      "AIzaSyA5tkm_gjsdsja-aFDatefyf33l20DT9vw";

    window.__initGoogleMapsCallback = () => bootstrap();

    // Reuse an existing script tag if Places already added one.
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      const wait = () => {
        if (window.google?.maps?.importLibrary) return bootstrap();
        setTimeout(wait, 50);
      };
      wait();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  }).then(() => window.google);

  return loaderPromise;
}
