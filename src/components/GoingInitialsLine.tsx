import type { EventGoingInitials } from "@/lib/use-event-going-initials";

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
  const names = shown.map((i) => `${i}.`).join(", ");
  const suffix =
    remaining > 0
      ? ` + ${remaining} other${remaining === 1 ? "" : "s"} going`
      : total === 1
        ? " going"
        : " going";

  return (
    <span className={className}>
      {names}
      {suffix}
    </span>
  );
}
