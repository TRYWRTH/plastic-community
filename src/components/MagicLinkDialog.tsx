import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";

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
  description = "We'll email you a 6-digit code to sign in.",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const { isAuthenticated } = useAuth();

  // Auto-close when a session is detected.
  useEffect(() => {
    if (open && isAuthenticated) {
      setStep("email");
      setEmail("");
      setCode("");
      onOpenChange(false);
    }
  }, [open, isAuthenticated, onOpenChange]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep("code");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    // The useEffect above will close the dialog when isAuthenticated flips.
  };

  const reset = (v: boolean) => {
    if (!v) {
      setStep("email");
      setEmail("");
      setCode("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="rounded-none border-2 border-foreground">
        <DialogHeader>
          <DialogTitle className="font-brand text-2xl uppercase">
            {step === "code" ? "Enter your code" : title}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase tracking-wide">
            {step === "code" ? (
              <>We sent a 6-digit code to {email}. Enter it below.</>
            ) : (
              description
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={sendCode} className="space-y-4">
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
            <Button type="submit" disabled={busy} className="w-full rounded-none">
              {busy ? "Sending…" : "Send code"}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs uppercase tracking-wide">
                6-digit code
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoComplete="one-time-code"
                placeholder="123456"
                className="rounded-none border-2 border-foreground text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <Button
              type="submit"
              disabled={busy || code.length < 6}
              className="w-full rounded-none"
            >
              {busy ? "Verifying…" : "Verify & sign in"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
              }}
              className="w-full font-mono text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              ← Use a different email
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
