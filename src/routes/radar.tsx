import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EventsMap } from "@/components/EventsMap";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/radar")({
  component: RadarPage,
});

async function fetchUpcomingEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("event_date", new Date().toISOString())
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
    <div className="min-h-screen bg-background pb-28 pt-4">
      <div className="mx-auto max-w-5xl px-4">
        <EventsMap events={events} />
      </div>
    </div>
  );
}
