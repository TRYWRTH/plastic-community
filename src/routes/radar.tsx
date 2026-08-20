import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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
      <div className="mx-auto max-w-[430px] px-4 lg:max-w-3xl lg:px-8">
        <Link
          to="/"
          className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-[14px] font-mono text-[10px] tracking-[0.14em] text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> BACK
        </Link>
        <EventsMap events={events} />
      </div>
    </div>
  );
}
