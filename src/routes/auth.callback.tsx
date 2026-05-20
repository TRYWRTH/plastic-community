import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { refreshAuthSession } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

const APP_URL = "https://plastic-community.vercel.app";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDescription =
          url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }

        await refreshAuthSession();
        if (cancelled) return;
        setStatus("ok");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Sign-in failed");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-none border-2 border-foreground bg-card p-6 text-center sm:p-8">
        <h1 className="font-brand text-2xl uppercase">
          {status === "working" && "Signing you in…"}
          {status === "ok" && "You're in"}
          {status === "error" && "Sign-in failed"}
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {status === "working" && "Finishing the magic link round trip."}
          {status === "ok" && "Tap the button below to open the app."}
          {status === "error" && (error ?? "Please try requesting a new magic link.")}
        </p>

        {status === "ok" && (
          <Button asChild className="mt-6 w-full rounded-none" size="lg">
            <a href={APP_URL}>Open The Poster Said So</a>
          </Button>
        )}

        {status === "error" && (
          <Button
            className="mt-6 w-full rounded-none"
            onClick={() => navigate({ to: "/login" })}
          >
            Back to sign in
          </Button>
        )}
      </div>
    </div>
  );
}
