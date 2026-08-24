import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { EventsMap } from "@/components/EventsMap";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/radar")({
  component: RadarPage,
});

const RADAR_EVENT_COLUMNS =
  "id, title, place, event_date, end_date, neighborhood, lat, lng, is_secret, location_tba";

async function fetchUpcomingEvents() {
  // A one-day-back cutoff (not a strict event_date >= now filter) keeps a
  // multi-day event that started in the past but is still running (end_date
  // in the future) eligible — EventsMap does the actual relevance filtering
  // client-side, same as Home.
  const cutoff = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("events")
    .select(RADAR_EVENT_COLUMNS)
    .or(`event_date.gte.${cutoff},end_date.gte.${cutoff}`)
    .order("event_date", { ascending: true });
  if (error) throw error;
  return data;
}

function RadarPage() {
  const { data: events = [] } = useQuery({
    queryKey: ["events", "radar"],
    queryFn: fetchUpcomingEvents,
  });

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col overflow-hidden bg-background pt-4">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col px-4 lg:max-w-3xl lg:px-8">
        <Link
          to="/"
          className="mb-3 inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full border border-border px-[14px] font-mono text-[10px] tracking-[0.14em] text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> BACK
        </Link>
        <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col lg:max-w-none">
          <EventsMap events={events} />
        </div>
      </div>
    </div>
  );
}
