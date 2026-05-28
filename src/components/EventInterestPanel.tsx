import type { EventGoingInitials } from "@/lib/use-event-going-initials";
import type { EventSaveCounts } from "@/lib/use-event-save-counts";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

const MAX_AVATARS = 5;

function NamesRow({ names, total }: { names: string[]; total: number }) {
  const shown = names.slice(0, MAX_AVATARS);
  const remaining = Math.max(0, total - shown.length);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {shown.map((name, i) => (
          <UserAvatar key={`${name}-${i}`} name={name} />
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
  const names = goingInitials?.names ?? [];

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
          {names.length > 0 && <NamesRow names={names} total={going} />}
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
