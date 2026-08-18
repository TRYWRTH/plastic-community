let loaderPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    google?: typeof google;
    __initGoogleMapsCallback?: () => void;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const bootstrap = async () => {
      try {
        // Guaranteed to be set here: called only once window.google?.maps
        // is truthy, or from the script's own load callback.
        await window.google!.maps.importLibrary("maps");
        await window.google!.maps.importLibrary("marker");
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    // If another loader (e.g. Places) already put the API on the page, just
    // import the libraries we need and resolve.
    if (window.google?.maps) {
      bootstrap();
      return;
    }

    const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
    if (!key) {
      reject(new Error("Google Maps API key missing"));
      return;
    }

    window.__initGoogleMapsCallback = () => bootstrap();

    // Reuse an existing script tag if Places already added one.
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      const wait = () => {
        if (window.google?.maps) return bootstrap();
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
  }).then(() => window.google!);

  return loaderPromise;
}
