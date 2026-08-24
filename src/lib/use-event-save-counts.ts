import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventSaveCounts = {
  saved_count: number;
};

/**
 * Fetches unified save counts for every event by querying
 * event_saves directly and aggregating client-side.
 * Counts all saves regardless of status (going or interested).
 */
export function useAllEventSaveCounts() {
  return useQuery({
    queryKey: ["event_save_counts", "all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_saves").select("event_id, status");
      if (error) throw error;
      const map = new Map<string, EventSaveCounts>();
      for (const row of data ?? []) {
        const current = map.get(row.event_id) ?? { saved_count: 0 };
        current.saved_count += 1;
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
    data: all.data?.get(eventId) ?? { saved_count: 0 },
  };
}
