import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Shown after a magic-link round trip when the link was started inside the
 * installed PWA but iOS opened the callback in Safari instead. iOS does not
 * give web apps a true deep link back into the standalone PWA, so we tell the
 * user clearly what to do: open the app from the home screen — the session
 * is already stored against the same origin and will be there when they do.
 */
export function OpenInAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const flagged = url.searchParams.get("pwa") === "1";
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    // Only nudge if we're outside the PWA. If we ARE in the PWA, the session
    // is here already — strip the marker silently.
    if (flagged && !isStandalone) {
      setShow(true);
    }
    if (flagged && isStandalone) {
      url.searchParams.delete("pwa");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (!show) return null;

  const onDismiss = () => {
    setShow(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("pwa");
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b-2 border-foreground bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 py-3">
        <div className="flex-1">
          <p className="font-mono text-xs uppercase tracking-wide">
            You're signed in here in Safari.
          </p>
          <p className="mt-1 text-xs opacity-90">
            To use the home-screen app, open <strong>The Poster Said So</strong>{" "}
            from your home screen — your session will be waiting.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
