import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Header } from "@/components/Header";
import { QrScanButton } from "@/components/QrScanButton";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendNewEventNotification } from "@/lib/notifications";
import {
  EVENT_TYPES,
  
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

export const Route = createFileRoute("/add")({
  component: AddEvent,
});

function AddEvent() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const [signInOpen, setSignInOpen] = useState(!loading && !isAuthenticated);

  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [neighborhood, setNeighborhood] = useState<Neighborhood>("Mitte");
  const [eventType, setEventType] = useState<EventType>("music");
  const [eventDay, setEventDay] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [eventTime, setEventTime] = useState("20:00");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsedDate = new Date(`${eventDay}T${eventTime}`);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error("Please choose a valid date and time.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: title.trim(),
        place: place.trim(),
        neighborhood,
        event_type: eventType,
        event_date: parsedDate.toISOString(),
        link: link.trim() || null,
        description: description.trim() || null,
        created_by: user.id,
        lat: coords.lat,
        lng: coords.lng,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event added");

    // Fire-and-forget push broadcast to all subscribers (client-side OneSignal call)
    const eventUrl = `${window.location.origin}/event/${data.id}`;
    void sendNewEventNotification({
      title: "New event posted",
      message: `${title.trim()} — ${place.trim()}, ${neighborhood}`,
      url: eventUrl,
    });

    navigate({ to: "/event/$eventId", params: { eventId: data.id } });
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-xl px-4 py-12 text-center">
          <h1 className="font-brand text-3xl uppercase">Sign in to add events</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            We'll email you a magic link — no password needed.
          </p>
          <Button className="mt-6" onClick={() => setSignInOpen(true)}>
            Enter your email
          </Button>
        </main>
        <MagicLinkDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          title="Enter your email to add an event"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-3 py-2 sm:px-4 sm:py-6">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground sm:text-sm">
          ← Back
        </Link>
        <h1 className="mt-1 font-display text-xl font-bold sm:text-3xl">Add an event</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-base">
          Saw a poster or heard a whisper? Add it here.
        </p>

        <form
          onSubmit={submit}
          className="mt-3 space-y-2.5 sm:mt-6 sm:space-y-4 [&_input]:h-9 [&_input]:py-1 [&_input]:text-sm sm:[&_input]:h-10 sm:[&_input]:text-base [&_button[role=combobox]]:h-9 sm:[&_button[role=combobox]]:h-10"
        >
          <Field label="Title" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Open-air jazz night"
              required
              maxLength={120}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <Field label="Date" required>
              <Input
                type="date"
                value={eventDay}
                onChange={(e) => setEventDay(e.target.value)}
                required
              />
            </Field>
            <Field label="Time" required>
              <Input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Place" required>
            <PlaceAutocompleteInput
              value={place}
              onChange={(v) => {
                setPlace(v);
                setCoords({ lat: null, lng: null });
              }}
              onPlaceSelected={(p) => {
                setCoords({ lat: p.lat, lng: p.lng });
                setNeighborhood((p.neighborhood as Neighborhood) ?? "Mitte");
              }}
              placeholder="Venue or address"
              required
              maxLength={200}
            />
          </Field>

          <Field label="Type">
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

          <Field label="Link">
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

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What makes it worth showing up?"
              className="min-h-0 py-1.5 text-sm sm:text-base"
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
            <Button type="button" variant="ghost" asChild size="sm" className="w-full sm:w-auto">
              <Link to="/">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving} size="sm" className="w-full shadow-glow sm:w-auto">
              {saving ? "Saving…" : "Save event"}
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
    <div className="space-y-1">
      <Label className="text-xs font-medium sm:text-sm">
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground sm:text-xs">{hint}</p>}
    </div>
  );
}

