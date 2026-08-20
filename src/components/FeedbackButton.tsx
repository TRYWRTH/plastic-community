import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;
      const { error } = await supabase
        .from("feedback")
        .insert({ message: trimmed, user_id: userId });
      if (error) throw error;
      toast.success("Thanks!");
      setMessage("");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send feedback. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between gap-2.5 rounded-full border border-border px-4 py-[15px] text-left text-foreground"
      >
        <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em]">
          <MessageCircle className="h-3.5 w-3.5" />
          SEND FEEDBACK
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">→</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-brand uppercase">Feedback</DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase tracking-wide">
              What do you think? What's missing?
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your feedback…"
              rows={5}
              required
              className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-[15px] text-foreground outline-none placeholder:text-dim"
            />
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full rounded-full bg-primary py-4 font-mono text-[10px] font-bold tracking-[0.16em] text-primary-foreground disabled:opacity-60"
            >
              {submitting ? "SENDING…" : "SEND FEEDBACK"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
