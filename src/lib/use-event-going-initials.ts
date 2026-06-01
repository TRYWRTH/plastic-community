import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventGoingInitials = {
  /**
   * Display names (usernames from the profiles table) of people marked
   * Going for the event, ordered by save time ascending. Users without a
   * username set are omitted from this list (they still contribute to the
   * Going count). Avatar renders first letter; full name shown on hover.
   */
  names: string[];
};

export function useEventGoingNamesBulk(eventIds: string[]) {
  const sorted = [...eventIds].sort();
  return useQuery({
    queryKey: ["event_going_initials", sorted],
    enabled: sorted.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      // Step 1: fetch all "going" saves for the requested events.
      const { data: saves, error: savesError } = await supabase
        .from("event_saves")
        .select("event_id, user_id, created_at")
        .eq("status", "going")
        .in("event_id", sorted)
        .order("created_at", { ascending: true });
      if (savesError) throw savesError;

      const rows = saves ?? [];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

      // Step 2: fetch usernames from profiles for those users.
      const usernameByUser = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", userIds);
        if (profilesError) throw profilesError;
        for (const p of profiles ?? []) {
          const u = (p.username ?? "").trim();
          if (u) usernameByUser.set(p.user_id, u);
        }
      }

      const map = new Map<string, EventGoingInitials>();
      for (const r of rows) {
        const name = usernameByUser.get(r.user_id);
        if (!name) continue;
        const entry = map.get(r.event_id) ?? { names: [] };
        entry.names.push(name);
        map.set(r.event_id, entry);
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
