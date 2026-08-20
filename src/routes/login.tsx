import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, refreshAuthSession } from "@/lib/use-auth";

const searchSchema = z.object({
  redirect: z.string().optional(),
  edit: z.string().optional(),
});

type AuthStep = "email" | "code" | "name";

// A profile created within this window of signing up is treated as a brand
// new signup (regular "step 3 of 3" copy); anything older is an existing
// account that just never set a name ("one last thing" copy).
const NEW_SIGNUP_WINDOW_MS = 2 * 60 * 1000;

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, edit } = Route.useSearch();
  const { user, isAuthenticated, loading } = useAuth();

  const editing = !!edit && isAuthenticated;
  const [step, setStep] = useState<AuthStep>(editing ? "name" : "email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameOnly, setNameOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  // Only bounce away for someone who lands on /login already signed in —
  // not mid-flow, where isAuthenticated flips true right after verifyOtp
  // succeeds but before the mandatory name step (if any) has run.
  useEffect(() => {
    if (!loading && isAuthenticated && !editing && step === "email") {
      navigate({ to: redirect || "/" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, editing]);

  const finish = async (message: string) => {
    toast.success(message);
    await navigate({ to: editing ? "/settings/profile" : redirect || "/" });
  };

  const sendCode = async () => {
    if (!/.+@.+\..+/.test(email.trim())) {
      toast.error("ENTER A VALID EMAIL");
      return;
    }
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
    setCode("");
    setStep("code");
    toast.success(`CODE SENT TO ${email.trim().toUpperCase()}`);
  };

  const verifyCode = async () => {
    if (code.replace(/\D/g, "").length !== 6) {
      toast.error("ENTER THE 6-DIGIT CODE");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const session = await refreshAuthSession();
    const authedUser = session?.user;
    if (!authedUser) {
      setBusy(false);
      toast.error("Something went wrong — try again.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", authedUser.id)
      .maybeSingle();
    setBusy(false);
    if (profile?.username) {
      await finish(`WELCOME BACK, ${profile.username.toUpperCase()}`);
      return;
    }
    const createdAt = authedUser.created_at ? new Date(authedUser.created_at).getTime() : 0;
    setNameOnly(Date.now() - createdAt > NEW_SIGNUP_WINDOW_MS);
    setName("");
    setStep("name");
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("ADD A NAME OR NICKNAME");
      return;
    }
    const userId = editing ? user?.id : (await refreshAuthSession())?.user?.id;
    if (!userId) {
      toast.error("Something went wrong — try again.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, username: trimmed }, { onConflict: "user_id" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const handle = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    await finish(editing ? "NAME UPDATED" : `SIGNED IN AS @${handle}`);
  };

  const stepLine = editing
    ? "ACCOUNT"
    : step === "email"
      ? "STEP 1 OF 3"
      : step === "code"
        ? "STEP 2 OF 3"
        : nameOnly
          ? "ONE LAST THING"
          : "STEP 3 OF 3";

  const title = editing
    ? "Change your name"
    : step === "email"
      ? "Sign in"
      : step === "code"
        ? "Check your inbox"
        : "What should we call you?";

  const blurb = editing
    ? "This is the name shown on events you add."
    : step === "email"
      ? "You only need an account to add events. Browsing is open to everyone."
      : step === "code"
        ? `We sent a 6-digit code to ${email || "your email"}. No password to remember.`
        : nameOnly
          ? "You already have an account — we just never asked for a name. Set it once and you're done; it lands on the events you've already added."
          : "This is the name shown on events you add. A nickname is fine.";

  const backLabel = editing || step === "email" ? "NOT NOW" : "BACK";
  const nextLabel = editing
    ? "SAVE NAME"
    : step === "email"
      ? "SEND CODE"
      : step === "code"
        ? "VERIFY"
        : nameOnly
          ? "SAVE AND CONTINUE"
          : "START USING WHISPER RING";

  const goBack = () => {
    if (editing) {
      navigate({ to: "/settings/profile" });
    } else if (step === "email") {
      navigate({ to: "/" });
    } else {
      setStep(step === "name" ? "code" : "email");
    }
  };

  const submit = () => {
    if (editing || step === "name") return void saveName();
    if (step === "email") return void sendCode();
    return void verifyCode();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[430px] flex-col gap-5 px-5 pb-4 pt-2 lg:max-w-[520px]">
        <Link
          to="/"
          className="inline-flex h-11 w-fit items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-foreground hover:text-link"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
            {stepLine}
          </span>
          <h1 className="font-brand text-4xl uppercase leading-none tracking-[0.02em] text-foreground">
            {title}
          </h1>
          <p className="text-sm leading-[1.55] text-body">{blurb}</p>
        </div>

        {!editing && step === "email" && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
              EMAIL
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
              className="h-12 rounded-full border border-border bg-input px-4 text-[15px] text-foreground outline-none placeholder:text-dim"
            />
          </label>
        )}

        {!editing && step === "code" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
                6-DIGIT CODE
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                inputMode="numeric"
                placeholder="· · · · · ·"
                autoFocus
                className="h-14 rounded-full border border-border bg-input px-[18px] font-mono text-[22px] tracking-[0.32em] text-foreground outline-none placeholder:text-dim"
              />
            </label>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="w-fit rounded-full border border-border px-3.5 py-2.5 font-mono text-[9px] tracking-[0.14em] text-foreground"
            >
              RESEND CODE
            </button>
          </div>
        )}

        {(editing || step === "name") && (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
              NAME OR NICKNAME
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Mira, or raw_cuts"
              autoFocus
              maxLength={30}
              className="h-12 rounded-full border border-border bg-input px-4 text-[15px] text-foreground outline-none placeholder:text-dim"
            />
          </label>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={goBack}
            className="shrink-0 rounded-full border border-border px-[18px] py-4 font-mono text-[10px] tracking-[0.14em] text-foreground"
          >
            {backLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-full bg-primary py-4 font-mono text-[10px] font-bold tracking-[0.16em] text-primary-foreground disabled:opacity-60"
          >
            {busy ? "…" : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
