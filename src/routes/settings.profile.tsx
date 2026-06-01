import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";

export const Route = createFileRoute("/settings/profile")({
  component: ProfileSettingsPage,
});

const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

function ProfileSettingsPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const qc = useQueryClient();
  const [signInOpen, setSignInOpen] = useState(false);
  const [username, setUsername] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? { username: null };
    },
  });

  useEffect(() => {
    setUsername(profile?.username ?? "");
  }, [profile?.username]);

  const save = useMutation({
    mutationFn: async (nextRaw: string) => {
      const next = nextRaw.trim();
      if (next.length > 0) {
        if (next.length > 30) throw new Error("Username must be 30 characters or fewer.");
        if (!USERNAME_RE.test(next))
          throw new Error("Use letters, numbers, dots, dashes, or underscores only.");
      }
      const { error } = await supabase
        .from("profiles")
        .upsert(
          { user_id: user!.id, username: next.length === 0 ? null : next },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["event_going_initials"] });
      toast.success("Username updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-brand text-3xl uppercase text-foreground sm:text-5xl">
          Profile
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground">
          Choose how your name appears to other people.
        </p>

        {!loading && !isAuthenticated && (
          <div className="mt-6 border-2 border-dashed border-foreground bg-background p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-foreground">
              Sign in to edit your profile.
            </p>
            <Button className="mt-4" onClick={() => setSignInOpen(true)}>
              Enter your email
            </Button>
            <MagicLinkDialog
              open={signInOpen}
              onOpenChange={setSignInOpen}
              title="Enter your email to edit your profile"
            />
          </div>
        )}

        {isAuthenticated && (
          <section className="mt-6 border-2 border-foreground bg-card p-4 sm:p-5">
            <label
              htmlFor="username"
              className="font-brand text-xl uppercase text-foreground"
            >
              Username
            </label>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Shown on your avatar instead of your email. Max 30 characters, letters/numbers/_-. allowed.
            </p>
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(username);
              }}
            >
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                placeholder="yourname"
                autoComplete="off"
                className="sm:flex-1"
              />
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </form>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Signed in as {user?.email}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
