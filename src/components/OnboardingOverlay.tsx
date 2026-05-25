import { useEffect, useState } from "react";
import { Sparkles, Smartphone, CalendarClock, X } from "lucide-react";

const STORAGE_KEY = "onboarded";

function isStandalonePWA() {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error - non-standard
  if (window.navigator.standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function useOnboarding() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // small delay so first paint isn't blocked
        const t = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return {
    open,
    show: () => setOpen(true),
    close: () => {
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        /* ignore */
      }
      setOpen(false);
    },
  };
}

export function OnboardingOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const installed = isStandalonePWA();
  const platform = detectPlatform();

  type Step = { icon: React.ReactNode; title: string; body: React.ReactNode };

  const steps: Step[] = [
    {
      icon: <Sparkles className="h-10 w-10" strokeWidth={2.5} />,
      title: "Welcome to Whisper Ring",
      body: (
        <p>
          A living index of performance events in Berlin. Spot a poster, add the event,
          share it with the community.
        </p>
      ),
    },
    ...(installed
      ? []
      : [
          {
            icon: <Smartphone className="h-10 w-10" strokeWidth={2.5} />,
            title: "Add it to your home screen",
            body:
              platform === "ios" ? (
                <p>
                  In Safari, tap the <span className="font-bold">Share</span> icon, then
                  <span className="font-bold"> "Add to Home Screen"</span>. Opens instantly,
                  works offline.
                </p>
              ) : platform === "android" ? (
                <p>
                  Tap the <span className="font-bold">⋮</span> menu, then
                  <span className="font-bold"> "Add to Home Screen"</span>. Opens instantly,
                  works offline.
                </p>
              ) : (
                <p>
                  Open this page on your phone and add it to your home screen for instant
                  access.
                </p>
              ),
          } as Step,
        ]),
    {
      icon: <CalendarClock className="h-10 w-10" strokeWidth={2.5} />,
      title: "How it works",
      body: (
        <p>
          Spot an event → Add it → Get reminded the day before. Save the ones you care about
          to your list.
        </p>
      ),
    },
  ];

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding walkthrough"
    >
      <button
        onClick={onClose}
        aria-label="Skip walkthrough"
        className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center border-2 border-foreground bg-background text-foreground hover:bg-foreground hover:text-background transition"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative w-full max-w-md border-2 border-foreground bg-background p-6 sm:p-8 shadow-[6px_6px_0_0_hsl(var(--foreground))]">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Step {step + 1} / {steps.length}
          </span>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-6 border border-foreground ${
                  i <= step ? "bg-foreground" : "bg-background"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mb-5 inline-flex items-center justify-center border-2 border-foreground bg-background p-3">
          {current.icon}
        </div>

        <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight leading-tight">
          {current.title}
        </h2>

        <div className="mt-3 text-base text-foreground/80 leading-relaxed">
          {current.body}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition"
          >
            Skip
          </button>
          <button
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            className="inline-flex items-center justify-center border-2 border-foreground bg-foreground px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] text-background hover:bg-background hover:text-foreground transition"
          >
            {isLast ? "Let's go" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
