import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Check, Star, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";
import { getNotificationPermission, savePlayerIdForCurrentUser } from "@/lib/onesignal";

type SaveStatus = "going" | "interested";
type SaveRow = { id: string; status: SaveStatus; notify: boolean } | null;

export function SaveButtons({ eventId }: { eventId: string }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const qc = useQueryClient();
  const saveKey = ["event_save", eventId, user?.id];

  const { data: save } = useQuery<SaveRow>({
    queryKey: saveKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_saves")
        .select("id, status, notify")
        .eq("event_id", eventId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as SaveRow) ?? null;
    },
  });

  const mutate = useMutation({
    mutationFn: async (next: SaveStatus | null) => {
      if (!user) throw new Error("Sign in first");
      if (next === null) {
        const { error } = await supabase
          .from("event_saves")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase
        .from("event_saves")
        .upsert(
          { event_id: eventId, user_id: user.id, status: next },
          { onConflict: "event_id,user_id" },
        );
      if (error) throw error;
      return next;
    },
    // Optimistic update so the button state flips immediately on tap.
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: saveKey });
      const prev = qc.getQueryData<SaveRow>(saveKey);
      qc.setQueryData<SaveRow>(saveKey, () => {
        if (next === null) return null;
        return {
          id: prev?.id ?? "optimistic",
          status: next,
          notify: prev?.notify ?? true,
        };
      });
      return { prev };
    },
    onError: (e: Error, _next, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(saveKey, ctx.prev);
      toast.error(e.message || "Couldn't save. Please try again.");
    },
    onSuccess: (next) => {
      toast.success(
        next === "going"
          ? "Marked as going"
          : next === "interested"
            ? "Saved as interested"
            : "Removed from your list",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: saveKey });
      qc.invalidateQueries({ queryKey: ["my_saved_events"] });
    },
  });

  const toggleNotify = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user) throw new Error("Sign in first");
      const { error } = await supabase
        .from("event_saves")
        .update({ notify: next })
        .eq("event_id", eventId)
        .eq("user_id", user.id);
      if (error) throw error;
      return next;
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: saveKey });
      const prev = qc.getQueryData<SaveRow>(saveKey);
      if (prev) qc.setQueryData<SaveRow>(saveKey, { ...prev, notify: next });
      return { prev };
    },
    onError: (e: Error, _next, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(saveKey, ctx.prev);
      toast.error(e.message);
    },
    onSuccess: (next) => {
      toast.success(next ? "Notifications on for this event" : "Muted this event");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: saveKey });
    },
  });

  // IMPORTANT (iOS Safari): the permission prompt only appears when
  // `requestPermission` is invoked SYNCHRONOUSLY from a user-gesture event
  // handler. Any `await` before the call (e.g. mutation queue, react-query
  // promise chain) breaks the gesture context and the prompt never shows.
  // So we trigger the permission request inline in the click handler, then
  // run the DB write afterwards.
  const onNotifyClick = () => {
    if (!user) return;
    const currentNotify = save?.notify ?? true;
    const next = !currentNotify;

    if (!next) {
      toggleNotify.mutate(false);
      return;
    }

    const perm = getNotificationPermission();
    if (perm === "denied") {
      toast.error(
        "Notifications are blocked. Enable them in your browser or phone settings.",
      );
      return;
    }
    if (perm === "granted") {
      toggleNotify.mutate(true);
      return;
    }

    // perm === "default" → ask SYNCHRONOUSLY inside this gesture.
    const OneSignal = (window as unknown as { OneSignal?: any }).OneSignal;
    let req: Promise<unknown>;
    try {
      req = OneSignal?.Notifications?.requestPermission
        ? OneSignal.Notifications.requestPermission()
        : Notification.requestPermission();
    } catch (err) {
      console.error("requestPermission failed", err);
      toast.error("Couldn't ask for notification permission.");
      return;
    }
    Promise.resolve(req).then(() => {
      if (Notification.permission === "granted") {
        try {
          OneSignal?.User?.PushSubscription?.optIn?.();
        } catch {}
        // Persist the OneSignal player id for this user so server-side
        // reminders can target this device.
        void savePlayerIdForCurrentUser();
        toggleNotify.mutate(true);
      } else {
        toast.message(
          "Notifications not enabled. You can turn them on later in settings.",
        );
      }
    });
  };

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Button variant="outline" onClick={() => setSignInOpen(true)} className="w-full sm:w-auto">
          <Check className="h-4 w-4" />
          Going
        </Button>
        <Button variant="outline" onClick={() => setSignInOpen(true)} className="w-full sm:w-auto">
          <Star className="h-4 w-4" />
          Interested
        </Button>
        <MagicLinkDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          title="Enter your email to save this event"
        />
      </div>
    );
  }

  const current = save?.status as SaveStatus | undefined;
  const notify = save?.notify ?? true;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Button
          variant={current === "going" ? "default" : "outline"}
          onClick={() => mutate.mutate(current === "going" ? null : "going")}
          disabled={mutate.isPending}
          className="w-full sm:w-auto"
        >
          <Check className="h-4 w-4" />
          Going
        </Button>
        <Button
          variant={current === "interested" ? "default" : "outline"}
          onClick={() =>
            mutate.mutate(current === "interested" ? null : "interested")
          }
          disabled={mutate.isPending}
          className="w-full sm:w-auto"
        >
          <Star className="h-4 w-4" />
          Interested
        </Button>
      </div>
      {current && (
        <Button
          variant={notify ? "default" : "outline"}
          onClick={onNotifyClick}
          disabled={toggleNotify.isPending}
          className="w-full sm:w-auto"
        >
          {notify ? (
            <>
              <Bell className="h-4 w-4" /> 🔔 Notify me
            </>
          ) : (
            <>
              <BellOff className="h-4 w-4" /> 🔕 Muted
            </>
          )}
        </Button>
      )}
    </div>
  );
}
