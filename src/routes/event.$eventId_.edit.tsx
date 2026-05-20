import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

import { Header } from "@/components/Header";
import { QrScanButton } from "@/components/QrScanButton";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
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

export const Route = createFileRoute("/event/$eventId_/edit")({
  component: EditEvent,
});

function EditEvent() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ["events", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [neighborhood, setNeighborhood] = useState<Neighborhood>("Mitte");
  const [eventType, setEventType] = useState<EventType>("music");
  const [date, setDate] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setTitle(event.title);
    setPlace(event.place);
    setCoords({ lat: (event as any).lat ?? null, lng: (event as any).lng ?? null });
    setNeighborhood(event.neighborhood as Neighborhood);
    setEventType(event.event_type as EventType);
    setDate(format(new Date(event.event_date), "yyyy-MM-dd'T'HH:mm"));
    setLink(event.link ?? "");
    setDescription(event.description ?? "");
  }, [event]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event) return;
    setSaving(true);
    const { data: updated, error } = await supabase
      .from("events")
      .update({
        title: title.trim(),
        place: place.trim(),
        neighborhood,
        event_type: eventType,
        event_date: new Date(date).toISOString(),
        link: link.trim() || null,
        description: description.trim() || null,
        lat: coords.lat,
        lng: coords.lng,
      })
      .eq("id", eventId)
      .select()
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

    // Refresh cached event data so the detail page shows the new values.
    await queryClient.invalidateQueries({ queryKey: ["events", eventId] });
    await queryClient.invalidateQueries({ queryKey: ["events"] });


    // Notify only saved users who opted in (notify=true), excluding the editor.
    const { data: saves } = await supabase
      .from("event_saves")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("notify", true);
    const externalUserIds = (saves ?? [])
      .map((s) => s.user_id)
      .filter((id) => id !== user.id);
    const eventUrl = `${window.location.origin}/event/${eventId}`;
    void sendEventUpdateNotification({
      title: "Event updated",
      message: `${title.trim()} — ${place.trim()}, ${neighborhood}`,
      url: eventUrl,
      externalUserIds,
    });

    navigate({ to: "/event/$eventId", params: { eventId } });
  };

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

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-8">
        <Link
          to="/event/$eventId"
          params={{ eventId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Edit event</h1>
        <p className="mt-1 text-muted-foreground">Update the details below.</p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Title" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Date & time" required>
              <Input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Type" required>
              <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
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
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Place" required>
              <PlaceAutocompleteInput
                value={place}
                onChange={(v) => {
                  setPlace(v);
                  setCoords({ lat: null, lng: null });
                }}
                onPlaceSelected={(p) => setCoords({ lat: p.lat, lng: p.lng })}
                required
                maxLength={200}
              />
            </Field>
            <Field label="Area" required>
              <Select
                value={neighborhood}
                onValueChange={(v) => setNeighborhood(v as Neighborhood)}
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

          <Field label="Link" hint="Paste a URL or scan a QR code from the poster">
            <div className="flex gap-2">
              <Input
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
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
