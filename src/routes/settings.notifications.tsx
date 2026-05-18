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
                        className="flex items-center justify-between gap-3 border-2 border-foreground bg-card p-3 sm:p-4"
                      >
                        <Link
                          to="/event/$eventId"
                          params={{ eventId: ev.id }}
                          className="min-w-0 flex-1"
                        >
                          <h3 className="truncate font-brand text-base uppercase text-foreground sm:text-lg">
                            {ev.title}
                          </h3>
                          <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
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
