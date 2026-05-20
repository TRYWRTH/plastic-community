import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

import { Header } from "@/components/Header";
import { QrScanButton } from "@/components/QrScanButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendEventUpdateNotification } from "@/lib/notifications";
import {
  EVENT_TYPES,
  NEIGHBORHOODS,
  type EventType,
  type Neighborhood,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type EventForEdit = Database["public"]["Tables"]["events"]["Row"];

export const Route = createFileRoute("/event/$eventId_/edit")({
  component: EditEvent,
});

function EditEvent() {
  const { eventId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event-edit", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      console.log("[edit-event] fetched event data before form render", data);
      return data;
    },
    refetchOnMount: "always",
    staleTime: 0,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <h1 className="font-brand text-3xl uppercase">Event not found</h1>
          <Button asChild className="mt-6">
            <Link to="/">Back to events</Link>
          </Button>
        </main>
      </div>
    );
  }

  if (!user || user.id !== event.created_by) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <h1 className="font-brand text-3xl uppercase">Not allowed</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Only the creator can edit this event.
          </p>
          <Button asChild className="mt-6">
            <Link to="/event/$eventId" params={{ eventId }}>
              Back to event
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  console.log("[edit-event] rendering form with fetched event data", {
    id: event.id,
    place: event.place,
    neighborhood: event.neighborhood,
    event_date: event.event_date,
  });

  return <EditEventForm event={event} eventId={eventId} userId={user.id} />;
}

function EditEventForm({
  event,
  eventId,
  userId,
}: {
  event: EventForEdit;
  eventId: string;
  userId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState(event.link ?? "");
  const initialDateOnly = format(new Date(event.event_date), "yyyy-MM-dd");
  const initialTimeOnly = format(new Date(event.event_date), "HH:mm");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextTitle = String(form.get("title") ?? "").trim();
    const nextPlace = String(form.get("place") ?? "").trim();
    const nextNeighborhood = String(form.get("neighborhood") ?? event.neighborhood) as Neighborhood;
    const nextEventType = String(form.get("event_type") ?? event.event_type) as EventType;
    const nextDay = String(form.get("event_day") ?? "");
    const nextTime = String(form.get("event_time") ?? "");
    const nextLink = String(form.get("link") ?? "").trim();
    const nextDescription = String(form.get("description") ?? "").trim();

    if (!nextTitle || !nextPlace || !nextDay || !nextTime) {
      toast.error("Please fill in the required fields.");
      return;
    }

    const parsedDate = new Date(`${nextDay}T${nextTime}`);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error("Please choose a valid date and time.");
      return;
    }

    setSaving(true);
    const { data: updated, error } = await supabase
      .from("events")
      .update({
        title: nextTitle,
        place: nextPlace,
        neighborhood: nextNeighborhood,
        event_type: nextEventType,
        event_date: parsedDate.toISOString(),
        link: nextLink || null,
        description: nextDescription || null,
        lat: nextPlace === event.place ? event.lat : null,
        lng: nextPlace === event.place ? event.lng : null,
      })
      .eq("id", eventId)
      .eq("created_by", userId)
      .select("*")
      .maybeSingle();
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!updated) {
      toast.error("Couldn't save — you may not have permission to edit this event.");
      return;
    }
    toast.success("Event updated");

    await queryClient.invalidateQueries({ queryKey: ["event-edit", eventId] });
    await queryClient.invalidateQueries({ queryKey: ["events", eventId] });
    await queryClient.invalidateQueries({ queryKey: ["events"] });

    const { data: saves } = await supabase
      .from("event_saves")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("notify", true);
    const externalUserIds = (saves ?? [])
      .map((s) => s.user_id)
      .filter((id) => id !== userId);
    const eventUrl = `${window.location.origin}/event/${eventId}`;
    void sendEventUpdateNotification({
      title: "Event updated",
      message: `${nextTitle} — ${nextPlace}, ${nextNeighborhood}`,
      url: eventUrl,
      externalUserIds,
    });

    navigate({ to: "/event/$eventId", params: { eventId } });
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-3 pb-24 pt-4 sm:px-4 sm:py-8">
        <Link
          to="/event/$eventId"
          params={{ eventId }}
          className="text-xs text-muted-foreground hover:text-foreground sm:text-sm"
        >
          ← Back
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold sm:mt-2 sm:text-3xl">Edit event</h1>
        <p className="mt-1 hidden text-muted-foreground sm:block">Update the details below.</p>

        <form id="edit-event-form" onSubmit={submit} className="mt-4 space-y-3.5 sm:mt-8 sm:space-y-5">
          <Field label="Title" required>
            <Input
              name="title"
              defaultValue={event.title}
              required
              maxLength={120}
            />
          </Field>

          <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-5">
            <Field label="Date" required>
              <Input
                type="date"
                name="event_day"
                defaultValue={initialDateOnly}
                required
              />
            </Field>
            <Field label="Time" required>
              <Input
                type="time"
                name="event_time"
                defaultValue={initialTimeOnly}
                required
              />
            </Field>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-5">
            <Field label="Place" required>
              <Input
                name="place"
                defaultValue={event.place}
                required
                maxLength={200}
              />
            </Field>
            <Field label="Area" required>
              <Select
                name="neighborhood"
                defaultValue={event.neighborhood}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEIGHBORHOODS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Type">
            <Select name="event_type" defaultValue={event.event_type}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.emoji} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Link" hint="Paste a URL or scan a QR code from the poster">
            <div className="flex gap-2">
              <Input
                name="link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                type="url"
                inputMode="url"
              />
              <QrScanButton
                onResult={(text) => {
                  setLink(text);
                  toast.success("QR captured");
                }}
              />
            </div>
          </Field>

          <Field label="Short description" hint="Optional — a line or two">
            <Textarea
              name="description"
              defaultValue={event.description ?? ""}
              rows={3}
              maxLength={500}
            />
          </Field>

          <div className="hidden gap-2 pt-2 sm:flex sm:flex-row sm:items-center">
            <Button type="button" variant="ghost" asChild className="w-full sm:w-auto">
              <Link to="/event/$eventId" params={{ eventId }}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={saving} className="w-full shadow-glow sm:w-auto">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-3 py-2 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-xl gap-2">
            <Button type="button" variant="ghost" asChild className="h-11 flex-1">
              <Link to="/event/$eventId" params={{ eventId }}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" form="edit-event-form" disabled={saving} className="h-11 flex-1 shadow-glow">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
