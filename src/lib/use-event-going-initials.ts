import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventGoingInitials = {
  /**
   * Display names (username if set, otherwise email prefix) of people marked Going,
   * ordered by save time ascending. Avatar renders first letter; full name shown on hover.
   */
  names: string[];
};

type Row = { event_id: string; initials: string[] | null };

export function useEventGoingNamesBulk(eventIds: string[]) {
  const sorted = [...eventIds].sort();
  return useQuery({
    queryKey: ["event_going_initials", sorted],
    enabled: sorted.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (
        supabase as unknown as {
          rpc: (
            name: string,
            params: { event_ids: string[] },
          ) => Promise<{ data: Row[] | null; error: Error | null }>;
        }
      ).rpc("get_event_going_initials", { event_ids: sorted });
      if (error) throw error;
      const map = new Map<string, EventGoingInitials>();
      for (const r of data ?? []) {
        map.set(r.event_id, {
          names: (r.initials ?? []).filter((s): s is string => Boolean(s)),
        });
      }
      return map;
    },
  });
}

export function useEventGoingNames(eventId: string) {
  const q = useEventGoingNamesBulk(eventId ? [eventId] : []);
  return {
    ...q,
    data: q.data?.get(eventId),
  };
}
