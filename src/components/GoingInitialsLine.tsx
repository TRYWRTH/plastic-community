import type { EventGoingInitials } from "@/lib/use-event-going-initials";
import { cn } from "@/lib/utils";

export function GoingInitialsLine({
  data,
  className,
}: {
  data: EventGoingInitials | undefined;
  className?: string;
}) {
  const initials = data?.initials ?? [];
  const total = data?.going_count ?? 0;
  if (total === 0 || initials.length === 0) return null;

  const shown = initials.slice(0, 3);
  const remaining = Math.max(0, total - shown.length);

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1">
        {shown.map((letter, i) => (
          <span
            key={`${letter}-${i}`}
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-full bg-foreground font-mono text-[10px] font-bold uppercase leading-none text-[oklch(0.78_0.18_145)]"
          >
            {letter}
          </span>
        ))}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-widest text-foreground">
        {remaining > 0
          ? `+ ${remaining} more going`
          : total === 1
            ? "going"
            : "going"}
      </span>
    </span>
  );
}
