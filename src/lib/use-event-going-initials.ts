import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventGoingInitials = {
  initials: string[];
  going_count: number;
};

type Row = { event_id: string; initials: string[] | null; going_count: number };

export function useAllEventGoingInitials() {
  return useQuery({
    queryKey: ["event_going_initials", "all"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        rpc: (name: string) => Promise<{ data: Row[] | null; error: Error | null }>;
      }).rpc("get_event_going_initials");
      if (error) throw error;
      const map = new Map<string, EventGoingInitials>();
      for (const r of data ?? []) {
        map.set(r.event_id, {
          initials: (r.initials ?? []).filter(Boolean),
          going_count: Number(r.going_count) || 0,
        });
      }
      return map;
    },
  });
}

export function useEventGoingInitials(eventId: string) {
  const all = useAllEventGoingInitials();
  return {
    ...all,
    data: all.data?.get(eventId),
  };
}
