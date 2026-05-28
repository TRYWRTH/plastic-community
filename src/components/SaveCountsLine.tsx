import type { EventSaveCounts } from "@/lib/use-event-save-counts";
import { cn } from "@/lib/utils";

export function SaveCountsLine({
  counts,
  className,
}: {
  counts: EventSaveCounts | undefined;
  className?: string;
}) {
  const going = counts?.going_count ?? 0;
  const interested = counts?.interested_count ?? 0;
  if (going === 0 && interested === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-foreground/70",
        className,
      )}
    >
      {going > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-[oklch(0.78_0.18_145)]"
          />
          {going} going
        </span>
      )}
      {interested > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-foreground/40"
          />
          {interested} interested
        </span>
      )}
    </span>
  );
}
