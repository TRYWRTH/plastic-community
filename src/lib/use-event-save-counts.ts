import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventSaveCounts = {
  going_count: number;
  interested_count: number;
};

type Row = { event_id: string; going_count: number; interested_count: number };

/**
 * Fetches Going / Interested counts for every event in one call.
 * Backed by a SECURITY DEFINER RPC so it bypasses the per-user RLS on event_saves
 * while only exposing aggregate counts (never user_ids).
 */
export function useAllEventSaveCounts() {
  return useQuery({
    queryKey: ["event_save_counts", "all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        rpc: (name: string) => Promise<{ data: Row[] | null; error: Error | null }>;
      }).rpc("get_event_save_counts");
      if (error) throw error;
      const map = new Map<string, EventSaveCounts>();
      for (const r of data ?? []) {
        map.set(r.event_id, {
          going_count: Number(r.going_count) || 0,
          interested_count: Number(r.interested_count) || 0,
        });
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
