import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import type { AgendaDay } from "@/lib/agenda";
import { hoursRangeLabel } from "@/lib/agenda";
import { eventTypeMeta } from "@/lib/constants";
import { resolveCardImage } from "@/lib/event-card-image";
import { EventThumbPoster } from "@/components/EventPoster";

export function AgendaView({
  days,
  savedIds,
  onToggleSave,
}: {
  days: AgendaDay[];
  savedIds: Set<string>;
  onToggleSave: (eventId: string) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col">
      {days.map((day) => {
        const isToday = day.relLabel === "TONIGHT";
        return (
          <div
            key={day.key}
            className="grid grid-cols-[190px_1fr] border-b border-foreground/10 last:border-b-0"
          >
            <div className="flex flex-col gap-1 border-r border-foreground/10 py-[26px] pl-9 pr-6">
              {day.relLabel && (
                <span
                  className={`font-mono text-[10px] font-bold tracking-[0.2em] ${
                    isToday ? "text-hot" : "text-dim"
                  }`}
                >
                  {day.relLabel}
                </span>
              )}
              <span className="flex items-baseline gap-2">
                <span
                  className={`font-brand text-[52px] leading-[0.86] tracking-[-0.01em] ${
                    isToday ? "text-hot" : "text-foreground"
                  }`}
                >
                  {format(day.date, "dd")}
                </span>
                <span className="font-brand text-[17px] tracking-[0.04em] text-muted-foreground">
                  {format(day.date, "MMM").toUpperCase()}
                </span>
              </span>
              <span className="font-mono text-[10px] tracking-[0.16em] text-dim">
                {format(day.date, "EEE").toUpperCase()} · {day.eventCount}{" "}
                {day.eventCount === 1 ? "EVENT" : "EVENTS"}
              </span>
            </div>

            <div className="flex flex-col">
              {day.items.map((e) => {
                const districtLabel = (e.neighborhood as string).split("-")[0].toUpperCase();

                if (e.edgeKind) {
                  const isOpen = e.edgeKind === "open";
                  return (
                    <Link
                      key={`${day.key}-${e.id}-${e.edgeKind}`}
                      to="/event/$eventId"
                      params={{ eventId: e.id }}
                      className="grid grid-cols-[150px_1fr_170px] items-center gap-5 border-b border-foreground/[0.07] bg-hot/[0.07] py-4 pl-6 pr-9 outline-none last:border-b-0 hover:bg-hot/[0.13] focus-visible:ring-2 focus-visible:ring-hot"
                    >
                      <span
                        className={`w-fit rounded font-mono text-[9px] font-bold tracking-[0.14em] ${
                          isOpen ? "bg-foreground text-shell-deep" : "bg-hot text-shell-deep"
                        }`}
                        style={{ padding: "5px 10px" }}
                      >
                        {isOpen ? (isToday ? "OPENS TODAY" : "OPENS") : "LAST DAY"}
                      </span>
                      <span className="flex min-w-0 items-baseline gap-2.5">
                        <span className="truncate text-[19px] font-semibold tracking-[-0.01em] text-foreground">
                          {e.title}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                          {hoursRangeLabel(new Date(e.event_date), e.end_time)}
                        </span>
                      </span>
                      <span className="truncate font-mono text-[10px] tracking-[0.14em] text-link">
                        {e.is_secret ? "SECRET" : districtLabel}
                      </span>
                    </Link>
                  );
                }

                const d = new Date(e.event_date);
                const category = eventTypeMeta(e.event_type);
                const cardImage = resolveCardImage(e);
                const saved = savedIds.has(e.id);
                const open = () => navigate({ to: "/event/$eventId", params: { eventId: e.id } });
                return (
                  <div
                    key={`${day.key}-${e.id}`}
                    role="link"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") open();
                    }}
                    className="grid cursor-pointer grid-cols-[74px_108px_1fr_170px_132px_44px] items-center gap-5 border-b border-foreground/[0.07] py-4 pl-6 pr-9 outline-none last:border-b-0 hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-hot"
                  >
                    <span
                      className={`font-brand text-[22px] tracking-[0.02em] ${
                        isToday ? "text-hot" : "text-foreground"
                      }`}
                    >
                      {format(d, "HH:mm")}
                    </span>

                    <span className="relative h-16 w-[108px] overflow-hidden rounded-xl">
                      {cardImage ? (
                        <img
                          src={cardImage.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <EventThumbPoster eventType={e.event_type} className="h-full w-full" />
                      )}
                    </span>

                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate text-[19px] font-semibold tracking-[-0.01em] text-foreground">
                          {e.title}
                        </span>
                        {e.dateRangeLabel && (
                          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tracking-[0.1em] text-link">
                            ({e.dateRangeLabel})
                          </span>
                        )}
                      </span>
                      <span className="truncate text-[13px] text-muted-foreground">{e.place}</span>
                    </span>

                    <span className="truncate font-mono text-[10px] tracking-[0.14em] text-link">
                      {districtLabel}
                    </span>

                    <span className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-border px-[9px] py-1 font-mono text-[9px] tracking-[0.12em] text-muted-2">
                        {category.label.toUpperCase()}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onToggleSave(e.id);
                      }}
                      aria-pressed={saved}
                      aria-label={saved ? "Unsave event" : "Save event"}
                      className={`grid h-[34px] w-[34px] place-items-center rounded-full border border-border text-[13px] ${
                        saved ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-2"
                      }`}
                    >
                      {saved ? "★" : "☆"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
