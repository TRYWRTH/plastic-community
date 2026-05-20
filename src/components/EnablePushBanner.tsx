import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import {
  getNotificationPermission,
  initOneSignal,
  requestPushPermission,
} from "@/lib/onesignal";

/**
 * Shown on the main page to logged-in users who haven't yet decided about
 * push notifications. The browser prompt is ONLY triggered from the explicit
 * button tap below — never automatically, and never during the login flow.
 */
export function EnablePushBanner() {
  const { isAuthenticated, loading } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    const p = getNotificationPermission();
    setPerm(p);
    setPushSupported(p !== "unsupported");
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem("pps:push-banner-dismissed") === "1");
    }
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return null;
  if (!pushSupported) return null;
  if (perm !== "default") return null;
  if (dismissed) return null;

  const onEnable = async () => {
    setPending(true);
    try {
      await initOneSignal();
      const granted = await requestPushPermission();
      setPerm(getNotificationPermission());
      if (granted) toast.success("Push notifications enabled");
      else
        toast.message(
          "Notifications not enabled. You can turn them on later in your browser settings.",
        );
      // Hide permanently once the user has made a choice (grant or deny).
      localStorage.setItem("pps:push-banner-dismissed", "1");
      setDismissed(true);
    } finally {
      setPending(false);
    }
  };

  const onDismiss = () => {
    localStorage.setItem("pps:push-banner-dismissed", "1");
    setDismissed(true);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4">
      <div className="flex flex-col items-start gap-3 border-2 border-foreground bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-mono text-xs uppercase tracking-wide">
              🔔 Enable notifications to stay in the loop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You'll only be asked once. You can change this any time in
              Notification settings.
            </p>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="flex-1 sm:flex-none"
          >
            Not now
          </Button>
          <Button
            size="sm"
            onClick={onEnable}
            disabled={pending}
            className="flex-1 sm:flex-none"
          >
            <Bell className="h-4 w-4" />
            Turn on
          </Button>
        </div>
      </div>
    </div>
  );
}
