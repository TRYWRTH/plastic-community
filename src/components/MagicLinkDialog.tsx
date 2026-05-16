import { useState } from "react";
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.href,
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
            {sent
              ? `We sent a magic link to ${email}. Open it on this device to continue.`
              : description}
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
