import { Link } from "@tanstack/react-router";

import {
  daysRemaining,
  hoursRangeLabel,
  runDurationLabel,
  runProgressPct,
  runUrgencyLabel,
  type ActiveRun,
} from "@/lib/agenda";
import { resolveCardImage } from "@/lib/event-card-image";
import { EventThumbPoster } from "@/components/EventPoster";
import { createEventSlug } from "@/lib/slug";
import { shortDistrictLabel } from "@/lib/clean-district";

const MAX_CARDS = 6;

export function OnNowShelf({ runs, now }: { runs: ActiveRun[]; now: Date }) {
  if (runs.length === 0) return null;

  const shown = runs.slice(0, MAX_CARDS);
  const overflow = runs.length - shown.length;

  return (
    <div className="mx-5 mb-4 flex flex-col gap-3.5 rounded-[26px] border border-foreground/[0.14] bg-shell-deep/60 px-5 pt-[22px] pb-6 lg:mx-9 lg:mb-6 lg:px-6">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-link">
          ON NOW · {runs.length} ONGOING
        </span>
        <span className="font-mono text-[10px] tracking-[0.12em] text-dim">
          NOT TIED TO ONE NIGHT
        </span>
      </div>

      <div className="relative">
        <div className="scrollbar-hide overflow-x-auto lg:overflow-visible">
          <div
            className={`flex snap-x snap-mandatory gap-2.5 lg:grid lg:snap-none lg:grid-cols-3 lg:gap-3.5 ${
              shown.length > 1 ? "shelf-peek" : ""
            }`}
          >
            {shown.map(({ event, start, end, totalDays }) => {
              const pct = runProgressPct(now, start, end);
              const cardImage = resolveCardImage(event);
              const left = daysRemaining(now, end);
              return (
                <Link
                  key={event.id}
                  to="/event/$eventId"
                  params={{ eventId: createEventSlug(event.title, event.id) }}
                  className="grid w-[73vw] flex-none snap-start grid-cols-[64px_1fr] gap-3.5 rounded-2xl border border-foreground/[0.16] bg-foreground/[0.04] p-3.5 transition-colors hover:bg-foreground/[0.09] lg:w-auto"
                >
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[11px]">
                    {cardImage ? (
                      <img
                        src={cardImage.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <EventThumbPoster eventType={event.event_type} className="h-full w-full" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col justify-center gap-1.5">
                    <div className="truncate text-base font-semibold tracking-[-0.01em] text-foreground">
                      {event.title}
                    </div>
                    <div className="truncate font-mono text-[9px] tracking-[0.12em] text-muted-foreground">
                      {hoursRangeLabel(start, event.end_time, { daily: true })} ·{" "}
                      {event.is_secret
                        ? "SECRET"
                        : event.location_tba
                          ? "TBA"
                          : shortDistrictLabel(event.neighborhood as string).toUpperCase()}
                    </div>
                    <div className="h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.16]">
                      <div className="h-full rounded-full bg-hot" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-mono text-[9px] tracking-[0.12em] text-dim">
                        {runDurationLabel(totalDays)}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[9px] font-bold tracking-[0.12em] ${
                          left <= 3 ? "text-hot" : "text-muted-foreground"
                        }`}
                      >
                        {runUrgencyLabel(now, end)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
            {overflow > 0 && (
              <div className="grid w-[73vw] flex-none snap-start place-items-center rounded-2xl border border-dashed border-foreground/[0.16] font-mono text-[10px] font-bold tracking-[0.14em] text-muted-foreground lg:w-auto lg:min-h-16">
                +{overflow} MORE
              </div>
            )}
          </div>
        </div>
        {(shown.length > 1 || overflow > 0) && (
          <span className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-shell-deep/60 to-transparent lg:hidden" />
        )}
      </div>
    </div>
  );
}
