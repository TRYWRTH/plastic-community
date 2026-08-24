import { ArrowLeft } from "lucide-react";

/**
 * Standard `< BACK` affordance used across every page's top-left corner
 * (Radar, Event Details, Edit Event, Profile, …) so navigation looks and
 * behaves identically everywhere instead of each page rolling its own
 * button markup/classes.
 */
export function BackButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 w-fit shrink-0 items-center gap-1.5 self-start rounded-full border border-border px-[14px] font-mono text-[10px] tracking-[0.14em] text-foreground ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5" /> BACK
    </button>
  );
}
