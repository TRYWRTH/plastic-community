import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Check, Star } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";

type SaveStatus = "going" | "interested";

export function SaveButtons({ eventId }: { eventId: string }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
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
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Button variant="outline" onClick={() => setSignInOpen(true)} className="w-full sm:w-auto">
          <Check className="h-4 w-4" />
          Going
        </Button>
        <Button variant="outline" onClick={() => setSignInOpen(true)} className="w-full sm:w-auto">
          <Star className="h-4 w-4" />
          Interested
        </Button>
        <MagicLinkDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          title="Enter your email to save this event"
        />
      </div>
    );
  }

  const current = save?.status as SaveStatus | undefined;

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <Button
        variant={current === "going" ? "default" : "outline"}
        onClick={() => mutate.mutate(current === "going" ? null : "going")}
        disabled={mutate.isPending}
        className="w-full sm:w-auto"
      >
        <Check className="h-4 w-4" />
        Going
      </Button>
      <Button
        variant={current === "interested" ? "default" : "outline"}
        onClick={() =>
          mutate.mutate(current === "interested" ? null : "interested")
        }
        disabled={mutate.isPending}
        className="w-full sm:w-auto"
      >
        <Star className="h-4 w-4" />
        Interested
      </Button>
    </div>
  );
}

