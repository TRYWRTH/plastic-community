import type { EventSaveCounts } from "@/lib/use-event-save-counts";

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
    <span className={className}>
      {going} going · {interested} interested
    </span>
  );
}
