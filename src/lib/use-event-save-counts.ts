import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventSaveCounts = {
  going_count: number;
  interested_count: number;
};

/**
 * Fetches Going / Interested counts for every event by querying
 * event_saves directly and aggregating client-side.
 */
export function useAllEventSaveCounts() {
  return useQuery({
    queryKey: ["event_save_counts", "all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_saves")
        .select("event_id, status");
      if (error) throw error;
      const map = new Map<string, EventSaveCounts>();
      for (const row of data ?? []) {
        const current = map.get(row.event_id) ?? {
          going_count: 0,
          interested_count: 0,
        };
        if (row.status === "going") current.going_count += 1;
        else if (row.status === "interested") current.interested_count += 1;
        map.set(row.event_id, current);
      }
      return map;
    },
  });
}

export function useEventSaveCounts(eventId: string) {
  const all = useAllEventSaveCounts();
  return {
    ...all,
    data: all.data?.get(eventId) ?? { going_count: 0, interested_count: 0 },
  };
}
