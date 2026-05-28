import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { Header } from "@/components/Header";
import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard";
import { QrScanButton } from "@/components/QrScanButton";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendEventUpdateNotification } from "@/lib/notifications";
import {
  EVENT_TYPES,
  
  type EventType,
  type Neighborhood,
} from "@/lib/constants";
import { REPEAT_OPTIONS, type RepeatOption, createRecurringInstances } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

if (!user || (user.id !== event.created_by && user.id !== import.meta.env.VITE_ADMIN_USER_ID)) {
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
  const [place, setPlace] = useState(event.place);
  
  const [neighborhood, setNeighborhood] = useState<Neighborhood>(event.neighborhood);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: event.lat,
    lng: event.lng,
  });
  const [repeats, setRepeats] = useState<RepeatOption>((event.repeats as RepeatOption) ?? "none");
  const initialDateOnly = format(new Date(event.event_date), "yyyy-MM-dd");
  const initialTimeOnly = format(new Date(event.event_date), "HH:mm");
  const [eventDay, setEventDay] = useState(initialDateOnly);
  const [multiDay, setMultiDay] = useState(!!event.end_date);
  const [endDay, setEndDay] = useState(event.end_date ?? "");
  const endDateError =
    multiDay && endDay && endDay < eventDay
      ? "End date must be on or after the start date."
      : null;

  // Dirty when any controlled field changed OR an uncontrolled form input fired.
  const [touched, setTouched] = useState(false);
  const dirty =
    touched ||
    link !== (event.link ?? "") ||
    place !== event.place ||
    neighborhood !== event.neighborhood ||
    coords.lat !== event.lat ||
    coords.lng !== event.lng ||
    repeats !== ((event.repeats as RepeatOption) ?? "none") ||
    eventDay !== initialDateOnly ||
    multiDay !== !!event.end_date ||
    endDay !== (event.end_date ?? "");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextTitle = String(form.get("title") ?? "").trim();
    const nextPlace = cleanPlace(place.trim());
    const nextNeighborhood = neighborhood;
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
    if (multiDay) {
      if (!endDay) {
        toast.error("Please pick an end date.");
        return;
      }
      if (endDateError) {
        toast.error(endDateError);
        return;
      }
    }

    setSaving(true);
    let finalCoords = coords;
    if (
      finalCoords.lat == null ||
      finalCoords.lng == null ||
      nextPlace !== cleanPlace(event.place)
    ) {
      const geo = await geocodeAddress(`${nextPlace}, ${nextNeighborhood}, Berlin`);
      if (geo) finalCoords = geo;
    }
    const { data: updated, error } = await supabase
  .from("events")
  .update({
    title: nextTitle,
    place: nextPlace,
    neighborhood: nextNeighborhood,
    event_type: nextEventType,
    event_date: parsedDate.toISOString(),
    end_date: multiDay && endDay ? endDay : null,
    link: nextLink || null,
    description: nextDescription || null,
    lat: finalCoords.lat,
    lng: finalCoords.lng,
    repeats,
  })
  .eq("id", eventId)
  .select("*")
  .maybeSingle();
    // If repeats changed from none -> something, generate future instances now.
    const initialRepeats = (event.repeats as RepeatOption) ?? "none";
    if (updated && initialRepeats === "none" && repeats !== "none") {
      await createRecurringInstances(
        {
          title: nextTitle,
          place: nextPlace,
          neighborhood: nextNeighborhood,
          event_type: nextEventType,
          link: nextLink || null,
          description: nextDescription || null,
          created_by: userId,
          lat: finalCoords.lat,
          lng: finalCoords.lng,
        },
        parsedDate,
        repeats,
      );
    }
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!updated) {
      toast.error("Couldn't save — you may not have permission to edit this event.");
      return;
    }
    try {
      sessionStorage.setItem("event-just-saved", eventId);
    } catch {}

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
      <main className="mx-auto max-w-xl px-3 py-2 sm:px-4 sm:py-6">
        <UnsavedChangesGuard when={dirty && !saving} />
        <Link
          to="/event/$eventId"
          params={{ eventId }}
          className="inline-flex h-11 items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="mt-1 font-display text-xl font-bold sm:text-3xl">Edit event</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-base">
          Update the details below.
        </p>

        <form
          onSubmit={submit}
          onInput={() => setTouched(true)}
          className="mt-3 space-y-2.5 sm:mt-6 sm:space-y-4 [&_input]:h-9 [&_input]:py-1 [&_input]:text-sm sm:[&_input]:h-10 sm:[&_input]:text-base [&_button[role=combobox]]:h-9 sm:[&_button[role=combobox]]:h-10"
        >
          <Field label="Title" required>
            <Input
              name="title"
              defaultValue={event.title}
              required
              maxLength={120}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <Field label="Date" required>
              <Input
                type="date"
                name="event_day"
                value={eventDay}
                onChange={(e) => setEventDay(e.target.value)}
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
            <Select name="event_type" defaultValue={event.event_type}>
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

          <Field
            label="Repeats"
            hint={
              ((event.repeats as RepeatOption) ?? "none") === "none" && repeats !== "none"
                ? "Future instances will be auto-created up to 3 months ahead."
                : undefined
            }
          >
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

          <Field label="Description">
            <DescriptionField defaultValue={event.description ?? ""} />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
            <Button type="button" variant="ghost" asChild size="sm" className="w-full sm:w-auto">
              <Link to="/event/$eventId" params={{ eventId }}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={saving} size="sm" className="w-full shadow-glow sm:w-auto">
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

function DescriptionField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <Textarea
        name="description"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        maxLength={1500}
        className="min-h-0 py-1.5 text-sm sm:text-base"
      />
      <p className="text-right font-mono text-[11px] text-muted-foreground sm:text-xs">
        {value.length}/1500
      </p>
    </>
  );
}


