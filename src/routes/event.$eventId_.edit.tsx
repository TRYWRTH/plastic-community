import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { cleanDescription } from "@/lib/clean-description";
import { ArrowLeft } from "lucide-react";

import { Header } from "@/components/Header";
import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { QrScanButton } from "@/components/QrScanButton";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendEventUpdateNotification } from "@/lib/notifications";
import {
  DESCRIPTION_MAX_LENGTH,
  EVENT_TYPES,
  PRICE_TYPES,
  type EventType,
  type Neighborhood,
  type PriceType,
} from "@/lib/constants";
import { REPEAT_OPTIONS, type RepeatOption, createRecurringInstances } from "@/lib/recurrence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cleanPlace } from "@/lib/clean-place";
import { geocodeAddress } from "@/lib/geocode";
import { nearestBerlinDistrict } from "@/lib/district-from-coords";
import { triggerLinkPreviewUnfurl } from "@/lib/link-preview";

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

type LocationMode = "public" | "secret" | "tba";

const LOCATION_MODES: { value: LocationMode; label: string; hint: string }[] = [
  { value: "public", label: "Public address", hint: "Address shown on the event page." },
  { value: "secret", label: "Secret", hint: "Address hidden — guests contact you via the link." },
  { value: "tba", label: "TBA", hint: "Address not set yet — announce it closer to the date." },
];

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
  const [saved, setSaved] = useState(false);
  const [link, setLink] = useState(event.link ?? "");
  const [place, setPlace] = useState(event.place);
  const [priceType, setPriceType] = useState<PriceType | null>(event.price_type);
  const [ticketUrl, setTicketUrl] = useState(event.ticket_url ?? "");

  const [neighborhood, setNeighborhood] = useState<Neighborhood>(event.neighborhood);
  // True once a Places suggestion has set `neighborhood` from Google's own
  // sublocality data during this edit — far more accurate than the
  // nearest-centroid guess, so it should win over that at save time. Stays
  // false (and the existing neighborhood is left alone) when the place
  // isn't touched in this edit.
  const [neighborhoodFromPlace, setNeighborhoodFromPlace] = useState(false);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: event.lat,
    lng: event.lng,
  });
  const [repeats, setRepeats] = useState<RepeatOption>((event.repeats as RepeatOption) ?? "none");
  const initialLocationMode: LocationMode = event.is_secret
    ? "secret"
    : event.location_tba
      ? "tba"
      : "public";
  const [locationMode, setLocationMode] = useState<LocationMode>(initialLocationMode);
  const initialDateOnly = format(new Date(event.event_date), "yyyy-MM-dd");
  const initialTimeOnly = format(new Date(event.event_date), "HH:mm");
  const [eventDay, setEventDay] = useState(initialDateOnly);
  const [multiDay, setMultiDay] = useState(!!event.end_date);
  const initialEndDay = event.end_date ? event.end_date.split("T")[0] : "";
  const initialEndTime = event.end_time ? event.end_time.slice(0, 5) : "";
  const [endDay, setEndDay] = useState(initialEndDay);
  const [endTime, setEndTime] = useState(initialEndTime);
  const endDateError =
    multiDay && endDay && endDay < eventDay ? "End date must be on or after the start date." : null;

  const isMultiDayRange =
    multiDay &&
    endDay &&
    !endDateError &&
    Math.round(
      (new Date(`${endDay}T00:00`).getTime() - new Date(`${eventDay}T00:00`).getTime()) / 86400000,
    ) +
      1 >=
      2;

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
    endDay !== initialEndDay ||
    endTime !== initialEndTime ||
    locationMode !== initialLocationMode ||
    priceType !== event.price_type ||
    ticketUrl !== (event.ticket_url ?? "");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    setSaved(true);
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextTitle = String(form.get("title") ?? "").trim();
    const nextPlace = cleanPlace(place.trim());
    const nextNeighborhood = neighborhood;
    const nextEventType = String(form.get("event_type") ?? event.event_type) as EventType;
    const nextDay = String(form.get("event_day") ?? "");
    const nextTime = String(form.get("event_time") ?? "");
    const nextLink = String(form.get("link") ?? "").trim();
    const nextDescription = cleanDescription(String(form.get("description") ?? ""));

    if (!nextTitle || (locationMode === "public" && !nextPlace) || !nextDay || !nextTime) {
      setSaved(false);
      toast.error("Please fill in the required fields.");
      return;
    }

    const parsedDate = new Date(`${nextDay}T${nextTime}`);
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
    if (
      locationMode === "public" &&
      (finalCoords.lat == null || finalCoords.lng == null || nextPlace !== cleanPlace(event.place))
    ) {
      const geo = await geocodeAddress(`${nextPlace}, ${nextNeighborhood}, Berlin`);
      if (geo) finalCoords = geo;
    }
    // Google's own sublocality data (set via onPlaceSelected) is far more
    // accurate than nearest-centroid matching, especially near a district
    // border — only fall back to the coordinate guess when the place was
    // retyped by hand and never resolved through Places Autocomplete.
    const resolvedNeighborhood = neighborhoodFromPlace
      ? nextNeighborhood
      : ((finalCoords.lat != null && finalCoords.lng != null
          ? nearestBerlinDistrict(finalCoords.lat, finalCoords.lng)
          : null) ?? nextNeighborhood);
    const nextTicketUrl = priceType === "paid" ? ticketUrl.trim() || null : null;
    const { data: updated, error } = await supabase
      .from("events")
      .update({
        title: nextTitle,
        place: nextPlace,
        neighborhood: resolvedNeighborhood,
        event_type: nextEventType,
        event_date: parsedDate.toISOString(),
        end_date: multiDay && endDay ? endDay : null,
        end_time: endTime || null,
        link: nextLink || null,
        description: nextDescription || null,
        lat: finalCoords.lat,
        lng: finalCoords.lng,
        repeats,
        is_secret: locationMode === "secret",
        location_tba: locationMode === "tba",
        image_url: event.image_url,
        price_type: priceType,
        ticket_url: nextTicketUrl,
      })
      .eq("id", eventId)
      .select("*")
      .maybeSingle();
    const initialRepeats = (event.repeats as RepeatOption) ?? "none";

    if (updated) {
      // Cascade shared fields to all future sibling instances (same creator + original title).
      // Each sibling keeps its own event_date; only metadata is synced.
      const siblingFields: Database["public"]["Tables"]["events"]["Update"] = {
        title: nextTitle,
        place: nextPlace,
        neighborhood: resolvedNeighborhood,
        event_type: nextEventType,
        link: nextLink || null,
        description: nextDescription || null,
        lat: finalCoords.lat,
        lng: finalCoords.lng,
        is_secret: locationMode === "secret",
        location_tba: locationMode === "tba",
        image_url: event.image_url,
        price_type: priceType,
        ticket_url: nextTicketUrl,
      };
      await supabase
        .from("events")
        .update(siblingFields)
        .eq("created_by", userId)
        .eq("title", event.title)
        .neq("id", eventId)
        .gte("event_date", new Date().toISOString());

      // If repeats changed from none -> something, generate future instances now.
      if (initialRepeats === "none" && repeats !== "none") {
        await createRecurringInstances(
          {
            title: nextTitle,
            place: nextPlace,
            neighborhood: resolvedNeighborhood,
            event_type: nextEventType,
            link: nextLink || null,
            description: nextDescription || null,
            created_by: userId,
            lat: finalCoords.lat,
            lng: finalCoords.lng,
            image_url: event.image_url,
            price_type: priceType,
            ticket_url: nextTicketUrl,
          },
          parsedDate,
          repeats,
        );
      }
    }
    setSaving(false);

    if (error) {
      setSaved(false);
      toast.error(error.message);
      return;
    }
    if (!updated) {
      setSaved(false);
      toast.error("Couldn't save — you may not have permission to edit this event.");
      return;
    }
    try {
      sessionStorage.setItem("event-just-saved", eventId);
    } catch {
      // sessionStorage may be unavailable (e.g. private browsing) — not critical
    }

    if (
      nextLink &&
      !event.image_url &&
      (nextLink !== (event.link ?? "") || event.link_preview_status !== "ok")
    ) {
      triggerLinkPreviewUnfurl(eventId);
    }

    await queryClient.invalidateQueries({ queryKey: ["event-edit", eventId] });
    await queryClient.invalidateQueries({ queryKey: ["events", eventId] });
    await queryClient.invalidateQueries({ queryKey: ["events"] });

    const { data: saves } = await supabase
      .from("event_saves")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("notify", true);
    const externalUserIds = (saves ?? []).map((s) => s.user_id).filter((id) => id !== userId);
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
        <UnsavedChangesGuard when={dirty && !saving && !saved} />
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
            <Input name="title" defaultValue={event.title} required maxLength={120} />
          </Field>

          {/* Date section — all three rows grouped with even spacing */}
          <div className="space-y-2">
            {/* Row 1: Date + Time + optional end time */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1.5fr_1.5fr] sm:gap-4">
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
                <Input type="time" name="event_time" defaultValue={initialTimeOnly} required />
              </Field>
              <Field label="End time (optional)">
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </Field>
            </div>

            {/* Row 2: Runs over multiple days checkbox */}
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
              Runs over multiple days
            </label>

            {/* End date field — animated expand */}
            <div
              className={`grid overflow-hidden transition-all duration-300 ease-out ${
                multiDay ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0">
                <Field label="End date" required={multiDay}>
                  <Input
                    type="date"
                    value={endDay}
                    min={eventDay}
                    onChange={(ev) => setEndDay(ev.target.value)}
                    className="sm:max-w-xs"
                  />
                  {endDateError && (
                    <p className="mt-1 text-[11px] text-destructive sm:text-xs">{endDateError}</p>
                  )}
                </Field>
                {isMultiDayRange && (
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    Multi-day events aren't repeated every day — they show in "On now" once they
                    start.
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: Repeats */}
            <div className="space-y-1">
              <label className="text-xs font-medium sm:text-sm">Repeats</label>
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
              {((event.repeats as RepeatOption) ?? "none") === "none" && repeats !== "none" && (
                <p className="text-[11px] text-muted-foreground">
                  Future instances will be auto-created up to 3 months ahead.
                </p>
              )}
            </div>
          </div>

          <Field label="Place" required={locationMode === "public"}>
            <PlaceAutocompleteInput
              value={place}
              onChange={(v) => {
                setPlace(v);
                setCoords({ lat: null, lng: null });
                setNeighborhoodFromPlace(false);
              }}
              onPlaceSelected={(p) => {
                setCoords({ lat: p.lat, lng: p.lng });
                const fallback =
                  p.lat != null && p.lng != null ? nearestBerlinDistrict(p.lat, p.lng) : null;
                setNeighborhood((p.neighborhood as Neighborhood) ?? fallback ?? "Mitte");
                setNeighborhoodFromPlace(true);
              }}
              placeholder="Venue or address"
              required={locationMode === "public"}
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

          <Field label="Location">
            <Select value={locationMode} onValueChange={(v) => setLocationMode(v as LocationMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              {LOCATION_MODES.find((m) => m.value === locationMode)?.hint}
            </p>
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
            {!link.trim() && (
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Tip: an Instagram post link helps people trust the event is real.
              </p>
            )}
          </Field>

          <Field label="Price">
            <Select
              value={priceType ?? "unset"}
              onValueChange={(v) => setPriceType(v === "unset" ? null : (v as PriceType))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not set</SelectItem>
                {PRICE_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {priceType === "paid" && (
            <Field label="Ticket link (optional)">
              <Input
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                inputMode="url"
              />
            </Field>
          )}

          <Field label="Description">
            <DescriptionField defaultValue={event.description ?? ""} />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
            <Button type="button" variant="ghost" asChild size="sm" className="w-full sm:w-auto">
              <Link to="/event/$eventId" params={{ eventId }}>
                Cancel
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={saving}
              size="sm"
              className="w-full shadow-glow sm:w-auto"
            >
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
      <DescriptionEditor
        name="description"
        value={value}
        onChange={setValue}
        maxLength={DESCRIPTION_MAX_LENGTH}
      />
      <div className="flex items-center justify-end gap-2">
        <p className="font-mono text-[11px] text-muted-foreground sm:text-xs">
          {value.length}/{DESCRIPTION_MAX_LENGTH}
        </p>
      </div>
    </>
  );
}
