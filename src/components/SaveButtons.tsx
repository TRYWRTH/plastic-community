import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Check, Star } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";

type SaveStatus = "going" | "interested";

export function SaveButtons({ eventId }: { eventId: string }) {
  const { user, isAuthenticated, loading } = useAuth();
  const qc = useQueryClient();

  const { data: save } = useQuery({
    queryKey: ["event_save", eventId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_saves")
        .select("id, status")
        .eq("event_id", eventId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutate = useMutation({
    mutationFn: async (next: SaveStatus | null) => {
      if (!user) throw new Error("Sign in first");
      if (next === null) {
        const { error } = await supabase
          .from("event_saves")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase
        .from("event_saves")
        .upsert(
          { event_id: eventId, user_id: user.id, status: next },
          { onConflict: "event_id,user_id" },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["event_save", eventId, user?.id] });
      qc.invalidateQueries({ queryKey: ["my_saved_events"] });
      toast.success(
        next === "going"
          ? "Marked as going"
          : next === "interested"
            ? "Saved as interested"
            : "Removed from your list",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link to="/login">Sign in to save</Link>
        </Button>
      </div>
    );
  }

  const current = save?.status as SaveStatus | undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={current === "going" ? "default" : "outline"}
        size="sm"
        onClick={() => mutate.mutate(current === "going" ? null : "going")}
        disabled={mutate.isPending}
      >
        <Check className="h-4 w-4" />
        Going
      </Button>
      <Button
        variant={current === "interested" ? "default" : "outline"}
        size="sm"
        onClick={() =>
          mutate.mutate(current === "interested" ? null : "interested")
        }
        disabled={mutate.isPending}
      >
        <Star className="h-4 w-4" />
        Interested
      </Button>
    </div>
  );
}
