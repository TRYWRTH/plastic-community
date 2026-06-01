import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share ===
      "function";

  const handleClick = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title, url });
      } catch (err) {
        // user cancelled — ignore
        if ((err as DOMException)?.name !== "AbortError") {
          console.error(err);
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 border-2 border-foreground bg-background px-4 py-2 font-mono text-xs uppercase tracking-widest text-foreground hover:bg-primary hover:text-primary-foreground sm:text-sm"
    >
      {canNativeShare ? (
        <>
          <Share2 className="h-4 w-4 shrink-0" />
          Share
        </>
      ) : copied ? (
        <>
          <Check className="h-4 w-4 shrink-0" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4 shrink-0" />
          Copy link
        </>
      )}
    </button>
  );
}
