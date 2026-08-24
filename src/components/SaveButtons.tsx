import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getNotificationPermission, savePlayerIdForCurrentUser } from "@/lib/onesignal";
import { NOTIFICATIONS_ENABLED } from "@/lib/constants";

type SaveStatus = "going" | "interested";
type SaveRow = { id: string; status: SaveStatus; notify: boolean } | null;

const SEGMENT = "flex-1 py-[15px] text-center font-mono text-[10px] tracking-[0.14em]";
const SEGMENT_ACTIVE = "bg-primary text-primary-foreground";
const SEGMENT_INACTIVE = "bg-transparent text-foreground";
const NOTIFY_PILL =
  "w-full rounded-full border border-border px-2 py-[15px] text-center font-mono text-[10px] tracking-[0.14em]";

export function SaveButtons({ eventId }: { eventId: string }) {
  const { user, isAuthenticated, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
    onSuccess: () => {
      // No toast — the button state itself confirms the action.
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
      toast.error("Notifications are blocked. Enable them in your browser or phone settings.");
      return;
    }
    if (perm === "granted") {
      toggleNotify.mutate(true);
      return;
    }

    // perm === "default" → ask SYNCHRONOUSLY inside this gesture.
    const OneSignal = window.OneSignal;
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
        } catch {
          // best-effort; permission is already granted regardless
        }
        // Persist the OneSignal player id for this user so server-side
        // reminders can target this device.
        void savePlayerIdForCurrentUser();
        toggleNotify.mutate(true);
      } else {
        toast.message("Notifications not enabled. You can turn them on later in settings.");
      }
    });
  };

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex overflow-hidden rounded-full border border-border">
        <Link
          to="/login"
          search={{ redirect: pathname }}
          className={`${SEGMENT} ${SEGMENT_INACTIVE}`}
        >
          GOING
        </Link>
        <div className="w-px bg-border" />
        <Link
          to="/login"
          search={{ redirect: pathname }}
          className={`${SEGMENT} ${SEGMENT_INACTIVE}`}
        >
          INTERESTED
        </Link>
      </div>
    );
  }

  const current = save?.status as SaveStatus | undefined;
  const notify = save?.notify ?? true;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex overflow-hidden rounded-full border border-border">
        <button
          type="button"
          onClick={() => mutate.mutate(current === "going" ? null : "going")}
          disabled={mutate.isPending}
          className={`${SEGMENT} ${current === "going" ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
        >
          GOING
        </button>
        <div className="w-px bg-border" />
        <button
          type="button"
          onClick={() => mutate.mutate(current === "interested" ? null : "interested")}
          disabled={mutate.isPending}
          className={`${SEGMENT} ${current === "interested" ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
        >
          INTERESTED
        </button>
      </div>
      {NOTIFICATIONS_ENABLED && current && (
        <button
          type="button"
          onClick={onNotifyClick}
          disabled={toggleNotify.isPending}
          aria-pressed={notify}
          className={`${NOTIFY_PILL} ${notify ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
        >
          {notify ? "NOTIFICATIONS ON" : "NOTIFY ME"}
        </button>
      )}
    </div>
  );
}
