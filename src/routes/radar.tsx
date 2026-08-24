import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { EventsMap } from "@/components/EventsMap";
import { BackButton } from "@/components/BackButton";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/radar")({
  component: RadarPage,
});

const RADAR_EVENT_COLUMNS =
  "id, title, place, event_date, end_date, neighborhood, lat, lng, is_secret, location_tba, " +
  "event_type, description, image_url, link_preview_image_url, link_preview_site_name";

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
  const navigate = useNavigate();
  const { data: events = [] } = useQuery({
    queryKey: ["events", "radar"],
    queryFn: fetchUpcomingEvents,
  });

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col overflow-hidden bg-background pt-4">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col px-4 lg:max-w-3xl lg:px-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <BackButton onClick={() => navigate({ to: "/" })} />
          <BrandLogo className="text-base" />
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col lg:max-w-none">
          <EventsMap events={events} />
        </div>
      </div>
    </div>
  );
}
