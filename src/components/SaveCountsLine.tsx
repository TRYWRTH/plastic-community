import type { EventSaveCounts } from "@/lib/use-event-save-counts";
import { cn } from "@/lib/utils";

export function SaveCountsLine({
  counts,
  className,
}: {
  counts: EventSaveCounts | undefined;
  className?: string;
}) {
  const saved = counts?.saved_count ?? 0;
  if (saved === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-foreground/70",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full bg-[oklch(0.78_0.18_145)]"
      />
      {saved} {saved === 1 ? "saved" : "saved"}
    </span>
  );
}
