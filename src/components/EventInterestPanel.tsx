import type { EventGoingInitials } from "@/lib/use-event-going-initials";
import type { EventSaveCounts } from "@/lib/use-event-save-counts";
import { cn } from "@/lib/utils";

const MAX_AVATARS = 5;

function InitialsRow({ initials, total }: { initials: string[]; total: number }) {
  const shown = initials.slice(0, MAX_AVATARS);
  const remaining = Math.max(0, total - shown.length);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {shown.map((letter, i) => (
          <span
            key={`${letter}-${i}`}
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-foreground font-mono text-[11px] font-bold uppercase leading-none text-[oklch(0.78_0.18_145)]"
          >
            {letter}
          </span>
        ))}
      </div>
      {remaining > 0 && (
        <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/70">
          + {remaining} more
        </span>
      )}
    </div>
  );
}

export function EventInterestPanel({
  counts,
  goingInitials,
  className,
}: {
  counts: EventSaveCounts | undefined;
  goingInitials: EventGoingInitials | undefined;
  className?: string;
}) {
  const going = counts?.going_count ?? 0;
  const interested = counts?.interested_count ?? 0;
  const initials = goingInitials?.initials ?? [];

  if (going === 0 && interested === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "space-y-3 border-2 border-foreground bg-background p-4",
        className,
      )}
    >
      {going > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-[oklch(0.78_0.18_145)]"
            />
            {going} {going === 1 ? "person" : "people"} going
          </div>
          {initials.length > 0 && <InitialsRow initials={initials} total={going} />}
        </div>
      )}
      {interested > 0 && (
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-foreground/40"
          />
          {interested} {interested === 1 ? "person" : "people"} interested
        </div>
      )}
    </div>
  );
}
