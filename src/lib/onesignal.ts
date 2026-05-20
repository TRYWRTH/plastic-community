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
  try {
    return Boolean(window.OneSignal?.User?.PushSubscription?.optedIn);
  } catch {
    return false;
  }
}

// IMPORTANT (iOS Safari / standalone PWA): permission prompts only appear
// when triggered synchronously from a user gesture. We must NOT `await`
// before calling requestPermission, and we must NOT route through the
// OneSignalDeferred queue — both break the gesture context. So we call
// OneSignal APIs directly when the SDK is loaded, and fall back to the
// native `Notification.requestPermission()` otherwise.

// Opt the user in/out of OneSignal push subscription globally.
// Must be called from a user-gesture handler.
export async function setPushOptIn(next: boolean): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;

  const OneSignal = window.OneSignal;

  if (!next) {
    try {
      if (OneSignal?.User?.PushSubscription?.optOut) {
        await OneSignal.User.PushSubscription.optOut();
      }
    } catch (err) {
      console.error("OneSignal optOut failed", err);
    }
    return false;
  }

  // Turning ON — request permission first if needed, SYNCHRONOUSLY from gesture.
  const current = Notification.permission;
  if (current === "denied") return false;

  if (current !== "granted") {
    try {
      // Call directly (no await before this point) so iOS keeps gesture context.
      const reqPromise =
        OneSignal?.Notifications?.requestPermission
          ? OneSignal.Notifications.requestPermission()
          : Notification.requestPermission();
      await reqPromise;
    } catch (err) {
      console.error("requestPermission failed", err);
      return false;
    }
    if ((Notification.permission as string) !== "granted") return false;
  }

  try {
    if (OneSignal?.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
    }
    void savePlayerIdForCurrentUser();
  } catch (err) {
    console.error("OneSignal optIn failed", err);
  }
  return true;
}

// Prompt the user via OneSignal for push permission. Resolves to true if granted.
// Must be called from a user-gesture handler.
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;

  const current = Notification.permission;
  if (current === "granted") {
    try {
      await window.OneSignal?.User?.PushSubscription?.optIn?.();
    } catch {}
    return true;
  }
  if (current === "denied") return false;

  const OneSignal = window.OneSignal;
  try {
    // Call requestPermission directly — no awaits before, no deferred queue —
    // so iOS keeps the user-gesture context and actually shows the prompt.
    const reqPromise =
      OneSignal?.Notifications?.requestPermission
        ? OneSignal.Notifications.requestPermission()
        : Notification.requestPermission();
    await reqPromise;
  } catch (err) {
    console.error("Push permission request failed", err);
    return false;
  }

  const granted = (Notification.permission as string) === "granted";
  if (granted) {
    try {
      await window.OneSignal?.User?.PushSubscription?.optIn?.();
    } catch {}
    void savePlayerIdForCurrentUser();
  }
  return granted;
}

// Associate the current Supabase user id with OneSignal as the external_id
// so we can target notifications to specific users.
export function setOneSignalExternalId(userId: string | null) {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      if (userId) {
        await OneSignal.login(userId);
        // Try to persist the device's push subscription id (OneSignal v16
        // "player id" replacement) so server-side reminders can target it.
        void savePlayerIdForCurrentUser();
      } else {
        await OneSignal.logout();
      }
    } catch (err) {
      console.error("OneSignal login/logout failed", err);
    }
  });
}

// Read the current device's OneSignal subscription id and upsert it into
// public.user_push_subscriptions for the logged-in user. Safe to call
// repeatedly; uniqueness is enforced at the DB level.
export async function savePlayerIdForCurrentUser(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // Lazy import so server bundles don't pull the browser supabase client.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    // Wait briefly for OneSignal to populate the subscription id.
    let playerId: string | undefined;
    for (let i = 0; i < 10; i++) {
      playerId = window.OneSignal?.User?.PushSubscription?.id;
      if (playerId) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!playerId) return;

    await supabase
      .from("user_push_subscriptions")
      .upsert(
        { user_id: userId, player_id: playerId },
        { onConflict: "user_id,player_id" },
      );
  } catch (err) {
    console.error("savePlayerIdForCurrentUser failed", err);
  }
}
