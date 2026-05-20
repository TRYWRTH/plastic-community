import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// True when the app is running from the iOS/Android home screen (installed PWA),
// false when running in a regular browser tab.
function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function MagicLinkDialog({
  open,
  onOpenChange,
  title = "Enter your email to continue",
  description = "We'll send you a magic link. Click it to sign in and return here.",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const fromPWA = useMemo(() => isStandalonePWA(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    // Build a clean redirect URL on the same origin so Supabase auth accepts
    // it without extra allowlist configuration. We tag it with ?pwa=1 when
    // the request was started from the installed home-screen app, so the
    // landing page knows to nudge the user back into the PWA (iOS opens
    // links from Mail/Gmail in Safari, not in the PWA container).
    const url = new URL(window.location.href);
    if (fromPWA) url.searchParams.set("pwa", "1");
    const emailRedirectTo = url.toString();

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  const reset = (v: boolean) => {
    if (!v) {
      setSent(false);
      setEmail("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="rounded-none border-2 border-foreground">
        <DialogHeader>
          <DialogTitle className="font-brand text-2xl uppercase">
            {sent ? "Check your inbox" : title}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase tracking-wide">
            {sent ? (
              <>
                We sent a magic link to {email}.
                {fromPWA ? (
                  <>
                    {" "}
                    On iPhone the link opens in Safari first — after you tap
                    it, return to this app from your home screen to finish
                    signing in here.
                  </>
                ) : (
                  <> Open it on this device to continue.</>
                )}
              </>
            ) : (
              description
            )}
          </DialogDescription>
        </DialogHeader>
        {!sent && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wide">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                className="rounded-none border-2 border-foreground"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-none"
            >
              {busy ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
