import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
        aria-label="Send feedback"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs uppercase tracking-widest text-background shadow-stamp transition-transform hover:-translate-y-[2px]"
      >
        <MessageCircle className="h-4 w-4" />
        Feedback
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none border-2 border-foreground">
          <DialogHeader>
            <DialogTitle className="font-brand uppercase">Feedback</DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase tracking-wide">
              What do you think? What's missing?
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your feedback…"
              rows={5}
              className="rounded-none border-2 border-foreground"
              required
            />
            <Button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full"
            >
              {submitting ? "Sending…" : "Send feedback"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
