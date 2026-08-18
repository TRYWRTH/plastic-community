import { format } from "date-fns";
import { eventTypeMeta, type EventType } from "@/lib/constants";

// Category tints for the generated no-image fallback poster. "sports" isn't
// part of the original palette spec (which only covered 9 of our 10 event
// types) — picked to sit tonally between food and workshop.
const CATEGORY_TINTS: Record<EventType, string> = {
  music: "#8C0A1E",
  theater: "#6E0412",
  food: "#B01426",
  art: "#A80D18",
  film: "#320309",
  sports: "#9C1B12",
  workshop: "#7A0316",
  community: "#5A0210",
  nightlife: "#2A0206",
  other: "#4A020C",
};

function posterTitleSize(title: string): number {
  if (title.length > 30) return 24;
  if (title.length > 18) return 30;
  return 38;
}

export function EventPoster({
  eventType,
  districtLabel,
  title,
  date,
  className = "",
}: {
  eventType: EventType;
  districtLabel: string;
  title: string;
  date: Date;
  className?: string;
}) {
  const tint = CATEGORY_TINTS[eventType] ?? CATEGORY_TINTS.other;
  const category = eventTypeMeta(eventType).label.toUpperCase();

  return (
    <div
      className={`flex aspect-[16/10] w-full flex-col justify-between p-4 ${className}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(118deg, rgba(247,231,228,0.05) 0 2px, transparent 2px 11px), " +
          `linear-gradient(152deg, ${tint}, #3E0109)`,
      }}
    >
      <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-foreground/[0.65]">
        <span>{category}</span>
        <span>·</span>
        <span className="truncate">{districtLabel}</span>
      </div>
      <div
        className="line-clamp-3 font-brand uppercase text-foreground"
        style={{ fontSize: posterTitleSize(title), lineHeight: 0.94, overflowWrap: "anywhere" }}
      >
        {title}
      </div>
      <div className="flex items-end justify-between">
        <span className="font-mono text-[9px] tracking-[0.14em] text-foreground/[0.65]">
          {format(date, "EEE d MMM").toUpperCase()}
        </span>
        <span className="font-brand text-foreground/[0.16]" style={{ fontSize: 44 }}>
          {format(date, "d")}
        </span>
      </div>
    </div>
  );
}
