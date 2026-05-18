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

// Returns the current browser notification permission ("granted" | "denied" | "default" | "unsupported").
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// Read whether the user is currently opted in to OneSignal push subscription.
export async function getPushOptedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  await initOneSignal();
  return new Promise<boolean>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        const optedIn = OneSignal?.User?.PushSubscription?.optedIn;
        resolve(Boolean(optedIn));
      } catch {
        resolve(false);
      }
    });
    setTimeout(() => resolve(false), 3000);
  });
}

// Opt the user in/out of OneSignal push subscription globally.
export async function setPushOptIn(next: boolean): Promise<boolean> {
  if (typeof window === "undefined") return false;
  await initOneSignal();
  return new Promise<boolean>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        if (next) {
          if (Notification.permission !== "granted") {
            await OneSignal.Notifications.requestPermission();
            if ((Notification.permission as string) !== "granted") {
              resolve(false);
              return;
            }
          }
          await OneSignal.User.PushSubscription.optIn();
          resolve(true);
        } else {
          await OneSignal.User.PushSubscription.optOut();
          resolve(false);
        }
      } catch (err) {
        console.error("setPushOptIn failed", err);
        resolve(false);
      }
    });
    setTimeout(() => resolve(next), 5000);
  });
}

// Prompt the user via OneSignal for push permission. Resolves to true if granted.
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;

  // Ensure SDK initialized
  await initOneSignal();

  return new Promise<boolean>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        const current = Notification.permission;
        if (current === "granted") {
          try { await OneSignal.User?.PushSubscription?.optIn?.(); } catch {}
          resolve(true);
          return;
        }
        if (current === "denied") {
          resolve(false);
          return;
        }
        // Use native browser prompt via OneSignal
        await OneSignal.Notifications.requestPermission();
        const granted = Notification.permission === "granted";
        if (granted) {
          try { await OneSignal.User?.PushSubscription?.optIn?.(); } catch {}
        }
        resolve(granted);
      } catch (err) {
        console.error("Push permission request failed", err);
        resolve(false);
      }
    });

    // Fallback if SDK didn't load (e.g. preview iframe): native prompt
    setTimeout(async () => {
      if (!window.OneSignal) {
        try {
          const result = await Notification.requestPermission();
          resolve(result === "granted");
        } catch {
          resolve(false);
        }
      }
    }, 3000);
  });
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
