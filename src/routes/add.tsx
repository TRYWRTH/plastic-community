import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { Header } from "@/components/Header";
import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard";
import { DescriptionEditor } from "@/components/DescriptionEditor";

import { QrScanButton } from "@/components/QrScanButton";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { MagicLinkDialog } from "@/components/MagicLinkDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendNewEventNotification } from "@/lib/notifications";
import { cleanDescription } from "@/lib/clean-description";
import {
  EVENT_TYPES,
  
  type EventType,
  type Neighborhood,
} from "@/lib/constants";
import { REPEAT_OPTIONS, type RepeatOption, createRecurringInstances } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cleanPlace } from "@/lib/clean-place";
import { geocodeAddress } from "@/lib/geocode";

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
  const [multiDay, setMultiDay] = useState(false);
  const [endDay, setEndDay] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [repeats, setRepeats] = useState<RepeatOption>("none");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const endDateError =
    multiDay && endDay && endDay < eventDay
      ? "End date must be on or after the start date."
      : null;

  const dirty =
    title !== "" ||
    place !== "" ||
    link !== "" ||
    description !== "" ||
    neighborhood !== "Mitte" ||
    eventType !== "music" ||
    eventTime !== "20:00" ||
    multiDay ||
    repeats !== "none";

  const submit = async (e: React.FormEvent) => {
    setSaved(true);
    e.preventDefault();
    if (!user) {
      setSaved(false);
      return;
    }
    const parsedDate = new Date(`${eventDay}T${eventTime}`);
    if (Number.isNaN(parsedDate.getTime())) {
      setSaved(false);
      toast.error("Please choose a valid date and time.");
      return;
    }
    if (multiDay) {
      if (!endDay) {
        setSaved(false);
        toast.error("Please pick an end date.");
        return;
      }
      if (endDateError) {
        setSaved(false);
        toast.error(endDateError);
        return;
      }
    }
    setSaving(true);
    let finalCoords = coords;
    if (finalCoords.lat == null || finalCoords.lng == null) {
      const geo = await geocodeAddress(`${place.trim()}, ${neighborhood}, Berlin`);
      if (geo) finalCoords = geo;
    }
    const basePayload = {
      title: title.trim(),
      place: cleanPlace(place.trim()),
      neighborhood,
      event_type: eventType,
      link: link.trim() || null,
      description: cleanDescription(description) || null,
      
      created_by: user.id,
      lat: finalCoords.lat,
      lng: finalCoords.lng,
    };
    const { data, error } = await supabase
      .from("events")
      .insert({
        ...basePayload,
        event_date: parsedDate.toISOString(),
        end_date: multiDay && endDay ? endDay : null,
        repeats,
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      setSaved(false);
      toast.error(error.message);
      return;
    }

    const extraCount = await createRecurringInstances(basePayload, parsedDate, repeats);
    setSaving(false);
    toast.success(
      extraCount > 0
        ? `Event added (+${extraCount} repeats)`
        : "Event added",
    );

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
        <UnsavedChangesGuard when={dirty && !saving && !saved} />
        <Link
          to="/"
          className="inline-flex h-11 items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[3fr_2fr] sm:gap-4">
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

          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <input
                type="checkbox"
                checked={multiDay}
                onChange={(e) => {
                  setMultiDay(e.target.checked);
                  if (!e.target.checked) setEndDay("");
                  else if (!endDay) setEndDay(eventDay);
                }}
                className="h-4 w-4 accent-primary"
              />
              Multi-day event
            </label>
            <div
              className={`grid overflow-hidden transition-all duration-300 ease-out ${
                multiDay ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-[3fr_2fr]">
                  <Field label="End date" required={multiDay}>
                    <Input
                      type="date"
                      value={endDay}
                      min={eventDay}
                      onChange={(ev) => setEndDay(ev.target.value)}
                    />
                    {endDateError && (
                      <p className="mt-1 text-[11px] text-destructive sm:text-xs">
                        {endDateError}
                      </p>
                    )}
                  </Field>
                </div>
              </div>
            </div>
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

          <Field label="Category">
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="inline-flex items-center gap-2">
                      <t.Icon className="h-4 w-4" aria-hidden="true" />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}

              </SelectContent>
            </Select>
          </Field>

          <Field label="Repeats" hint={repeats !== "none" ? "Future instances auto-created up to 3 months ahead." : undefined}>
            <Select value={repeats} onValueChange={(v) => setRepeats(v as RepeatOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
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
            <DescriptionEditor
              value={description}
              onChange={setDescription}
              maxLength={1500}
              placeholder="What makes it worth showing up?"
            />
            <div className="flex items-center justify-end gap-2">
              <p className="font-mono text-[11px] text-muted-foreground sm:text-xs">
                {description.length}/1500
              </p>
            </div>
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

