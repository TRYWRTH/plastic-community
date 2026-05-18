// Client-side OneSignal initialization helper.
// Loads the v16 Web SDK from CDN and initializes it once.

const ONESIGNAL_APP_ID = "d208ae10-4afe-4f51-9bd6-f07041c51fe6";

let initPromise: Promise<void> | null = null;

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: any[];
  }
}

export function initOneSignal(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (initPromise) return initPromise;

  // Skip inside Lovable preview iframes — service workers are unreliable there.
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("lovableproject.com") || host.includes("id-preview--");
  if (inIframe || isPreviewHost) return Promise.resolve();

  initPromise = new Promise<void>((resolve) => {
    // Inject SDK script if not already present
    if (!document.querySelector('script[data-onesignal-sdk]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      script.setAttribute("data-onesignal-sdk", "true");
      document.head.appendChild(script);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false },
          autoResubscribe: true,
        });
      } catch (err) {
        console.error("OneSignal init failed", err);
      } finally {
        resolve();
      }
    });
  });

  return initPromise;
}

// Associate the current Supabase user id with OneSignal as the external_id
// so we can target notifications to specific users.
export function setOneSignalExternalId(userId: string | null) {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      if (userId) await OneSignal.login(userId);
      else await OneSignal.logout();
    } catch (err) {
      console.error("OneSignal login/logout failed", err);
    }
  });
}
