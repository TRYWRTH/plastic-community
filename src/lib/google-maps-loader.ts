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
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loaderPromise) return loaderPromise;

  const key =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
    "AIzaSyCFb9w0HHhcjTQGRtdo3NPJH5diOmnXSp4";
  if (!key) return Promise.reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY"));

  loaderPromise = new Promise((resolve, reject) => {
    window.__initGoogleMapsCallback = () => {
      resolve(window.google);
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}
