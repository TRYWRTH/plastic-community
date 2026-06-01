import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";
import { getPushOptedIn, setPushOptIn } from "@/lib/onesignal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REMINDER_HOURS_OPTIONS = [
  { value: 2, label: "2 hours before" },
  { value: 6, label: "6 hours before" },
  { value: 24, label: "24 hours before" },
  { value: 48, label: "48 hours before" },
];

export const Route = createFileRoute("/settings/notifications")({
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const qc = useQueryClient();
  const [signInOpen, setSignInOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    getPushOptedIn().then(setPushOn).catch(() => setPushOn(false));
  }, [isAuthenticated]);

  const { data: prefs } = useQuery({
    queryKey: ["user_preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("reminder_hours")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? { reminder_hours: 24 };
    },
  });

  const updateReminderHours = useMutation({
    mutationFn: async (hours: number) => {
      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          { user_id: user!.id, reminder_hours: hours },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      return hours;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_preferences", user?.id] });
      toast.success("Reminder timing updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: saves = [], isLoading } = useQuery({
    queryKey: ["my_saved_events_with_notify", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_saves")
        .select("id, notify, status, event:events(id, title, event_date, place)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? [])
        .filter((r) => r.event)
        .sort(
          (a, b) =>
            new Date(a.event!.event_date).getTime() -
            new Date(b.event!.event_date).getTime(),
        );
    },
  });

  const toggleNotify = useMutation({
    mutationFn: async ({ saveId, next }: { saveId: string; next: boolean }) => {
      const { error } = await supabase
        .from("event_saves")
        .update({ notify: next })
        .eq("id", saveId);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_saved_events_with_notify", user?.id] });
      qc.invalidateQueries({ queryKey: ["event_save"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleMasterToggle = async (next: boolean) => {
    setPushBusy(true);
    try {
      const result = await setPushOptIn(next);
      setPushOn(result);
      if (next && !result) {
        toast.error(
          "Notifications are blocked. Enable them in your browser or phone settings.",
        );
      } else {
        toast.success(result ? "Notifications enabled" : "Notifications disabled");
      }
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-brand text-3xl uppercase text-foreground sm:text-5xl">
          Notification settings
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground">
          Control which events ping your device.
        </p>

        {!loading && !isAuthenticated && (
          <div className="mt-6 border-2 border-dashed border-foreground bg-background p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-foreground">
              Sign in to manage your notifications.
            </p>
            <Button className="mt-4" onClick={() => setSignInOpen(true)}>
              Enter your email
            </Button>
            <MagicLinkDialog
              open={signInOpen}
              onOpenChange={setSignInOpen}
              title="Enter your email to manage notifications"
            />
          </div>
        )}

        {isAuthenticated && (
          <>
            <section className="mt-6 border-2 border-foreground bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-brand text-xl uppercase text-foreground">
                    Enable all notifications
                  </h2>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    Master switch for push notifications on this device.
                  </p>
                </div>
                <Switch
                  checked={pushOn}
                  disabled={pushBusy}
                  onCheckedChange={handleMasterToggle}
                  aria-label="Enable all notifications"
                />
              </div>
            </section>

            <section className="mt-6 border-2 border-foreground bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-brand text-xl uppercase text-foreground">
                    Remind me before event
                  </h2>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    Applies to all your saved events with notifications on.
                  </p>
                </div>
                <Select
                  value={String(prefs?.reminder_hours ?? 24)}
                  onValueChange={(v) => updateReminderHours.mutate(Number(v))}
                  disabled={updateReminderHours.isPending}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_HOURS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>


            <section className="mt-6">
              <h2 className="font-brand text-xl uppercase text-foreground">
                Per-event notifications
              </h2>
              {isLoading ? (
                <div className="mt-3 grid gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse border-2 border-foreground bg-card"
                    />
                  ))}
                </div>
              ) : saves.length === 0 ? (
                <div className="mt-3 border-2 border-dashed border-foreground bg-background p-8 text-center">
                  <p className="font-mono text-xs uppercase tracking-wide text-foreground">
                    No saved events yet.
                  </p>
                  <Button asChild className="mt-4">
                    <Link to="/">Browse events</Link>
                  </Button>
                </div>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {saves.map((s) => {
                    const ev = s.event!;
                    const d = new Date(ev.event_date);
                    return (
                      <li
                        key={s.id}
                        className="flex items-start justify-between gap-3 border-2 border-foreground bg-card p-4"
                      >
                        <Link
                          to="/event/$eventId"
                          params={{ eventId: ev.id }}
                          className="min-w-0 flex-1"
                        >
                          <h3 className="font-brand text-base uppercase text-foreground break-words sm:text-lg">
                            {ev.title}
                          </h3>
                          <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground break-words">
                            {format(d, "EEE, MMM d · HH:mm")} · {ev.place}
                          </p>
                        </Link>
                        <Switch
                          checked={s.notify}
                          disabled={toggleNotify.isPending}
                          onCheckedChange={(next) =>
                            toggleNotify.mutate({ saveId: s.id, next })
                          }
                          aria-label={`Notifications for ${ev.title}`}
                          className="mt-1 shrink-0"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
