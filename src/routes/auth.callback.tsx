import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { refreshAuthSession } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

const CALLBACK_URL = "https://plastic-community.vercel.app/auth/callback";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const inPWA = typeof window !== "undefined" && isStandalonePWA();

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

        // PKCE / code-exchange flow
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }
        // Hash-based token flow (#access_token=...) is handled automatically
        // by supabase-js detectSessionInUrl on load.

        const session = await refreshAuthSession();
        if (cancelled) return;

        if (session) {
          setStatus("ok");
          // Small delay so the UI can paint the "signed in" state before navigating.
          setTimeout(() => navigate({ to: "/" }), 400);
        } else {
          setStatus("ok"); // session may arrive via onAuthStateChange shortly
          setTimeout(() => navigate({ to: "/" }), 600);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Sign-in failed");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

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
          {status === "ok" && "Redirecting to the app…"}
          {status === "error" && (error ?? "Please try requesting a new magic link.")}
        </p>

        {!inPWA && status !== "error" && (
          <div className="mt-6 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Installed the app to your home screen? Open it there to continue.
            </p>
            <Button asChild className="w-full rounded-none">
              <a href={CALLBACK_URL + window.location.search}>Open in app</a>
            </Button>
          </div>
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
