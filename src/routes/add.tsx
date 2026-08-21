import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { QrScanButton } from "@/components/QrScanButton";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendNewEventNotification } from "@/lib/notifications";
import { cleanDescription } from "@/lib/clean-description";
import {
  EVENT_TYPES,
  PRICE_TYPES,
  type EventType,
  type Neighborhood,
  type PriceType,
} from "@/lib/constants";
import { REPEAT_OPTIONS, type RepeatOption, createRecurringInstances } from "@/lib/recurrence";
import { cleanPlace } from "@/lib/clean-place";
import { geocodeAddress } from "@/lib/geocode";
import { nearestBerlinDistrict } from "@/lib/district-from-coords";
import { triggerLinkPreviewUnfurl } from "@/lib/link-preview";

export const Route = createFileRoute("/add")({
  component: AddEvent,
});

type Step = 1 | 2 | 3;

type LocationMode = "public" | "secret" | "tba";

const LOCATION_MODES: { value: LocationMode; label: string; hint: string }[] = [
  { value: "public", label: "PUBLIC ADDRESS", hint: "Address shown on the event page." },
  {
    value: "secret",
    label: "SECRET",
    hint: "Address hidden — guests contact you via the link.",
  },
  {
    value: "tba",
    label: "TBA",
    hint: "Address not set yet — announce it closer to the date.",
  },
];

function AddEvent() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/add" } });
    }
  }, [loading, isAuthenticated, navigate]);

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [neighborhood, setNeighborhood] = useState<Neighborhood>("Mitte");
  // True once a Places suggestion has set `neighborhood` from Google's own
  // sublocality data — that's far more accurate than the nearest-centroid
  // guess, so it should never be overridden by it at submit time.
  const [neighborhoodFromPlace, setNeighborhoodFromPlace] = useState(false);
  const [eventType, setEventType] = useState<EventType>("music");
  const [eventDay, setEventDay] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [eventTime, setEventTime] = useState("20:00");
  const [multiDay, setMultiDay] = useState(false);
  const [endDay, setEndDay] = useState("");
  const [endTime, setEndTime] = useState("");
  const [link, setLink] = useState("");
  const [priceType, setPriceType] = useState<PriceType | null>(null);
  const [ticketUrl, setTicketUrl] = useState("");
  const [description, setDescription] = useState("");
  const [repeats, setRepeats] = useState<RepeatOption>("none");
  const [locationMode, setLocationMode] = useState<LocationMode>("public");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const dirty =
    title !== "" ||
    place !== "" ||
    link !== "" ||
    description !== "" ||
    neighborhood !== "Mitte" ||
    eventType !== "music" ||
    eventTime !== "20:00" ||
    endTime !== "" ||
    multiDay ||
    repeats !== "none" ||
    priceType !== null ||
    ticketUrl !== "" ||
    locationMode !== "public";

  const publish = async () => {
    setSaved(true);
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
    if (locationMode === "public" && (finalCoords.lat == null || finalCoords.lng == null)) {
      const geo = await geocodeAddress(`${place.trim()}, ${neighborhood}, Berlin`);
      if (geo) finalCoords = geo;
    }
    // Google's own sublocality data (set via onPlaceSelected) is far more
    // accurate than nearest-centroid matching, especially near a district
    // border — only fall back to the coordinate guess when the place was
    // typed by hand and never resolved through Places Autocomplete.
    const resolvedNeighborhood = neighborhoodFromPlace
      ? neighborhood
      : ((finalCoords.lat != null && finalCoords.lng != null
          ? nearestBerlinDistrict(finalCoords.lat, finalCoords.lng)
          : null) ?? neighborhood);
    const basePayload = {
      title: title.trim(),
      place: cleanPlace(place.trim()),
      neighborhood: resolvedNeighborhood,
      event_type: eventType,
      link: link.trim() || null,
      description: cleanDescription(description) || null,
      created_by: user.id,
      lat: finalCoords.lat,
      lng: finalCoords.lng,
      image_url: null,
      price_type: priceType,
      ticket_url: priceType === "paid" ? ticketUrl.trim() || null : null,
    };
    const { data, error } = await supabase
      .from("events")
      .insert({
        ...basePayload,
        event_date: parsedDate.toISOString(),
        end_date: multiDay && endDay ? endDay : null,
        end_time: endTime || null,
        repeats,
        is_secret: locationMode === "secret",
        location_tba: locationMode === "tba",
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
    toast.success(extraCount > 0 ? `EVENT PUBLISHED (+${extraCount} repeats)` : "EVENT PUBLISHED");

    if (link.trim()) {
      triggerLinkPreviewUnfurl(data.id);
    }

    // Fire-and-forget push broadcast to all subscribers (client-side OneSignal call)
    const eventUrl = `${window.location.origin}/event/${data.id}`;
    void sendNewEventNotification({
      title: "New event posted",
      message: `${title.trim()} — ${place.trim()}, ${neighborhood}`,
      url: eventUrl,
    });

    navigate({ to: "/event/$eventId", params: { eventId: data.id } });
  };

  const nextStep = () => {
    if (step === 1) {
      if (!title.trim()) {
        toast.error("GIVE IT A TITLE FIRST");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const parsedDate = new Date(`${eventDay}T${eventTime}`);
      if (Number.isNaN(parsedDate.getTime())) {
        toast.error("Please choose a valid date and time.");
        return;
      }
      if (multiDay && (!endDay || endDateError)) {
        toast.error(endDateError ?? "Please pick an end date.");
        return;
      }
      setStep(3);
      return;
    }
    if (locationMode === "public" && !place.trim()) {
      toast.error("Please add a place, or mark it Secret or TBA.");
      return;
    }
    void publish();
  };

  const prevStep = () => {
    if (step === 1) {
      navigate({ to: "/" });
      return;
    }
    setStep((step - 1) as Step);
  };

  if (loading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const stepTitle = step === 1 ? "What is it?" : step === 2 ? "When" : "Where";
  const nextLabel = step === 3 ? "PUBLISH EVENT" : "CONTINUE";
  const prevLabel = step === 1 ? "CANCEL" : "BACK";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <UnsavedChangesGuard when={dirty && !saving && !saved} />
      <RadarSweepBand />
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-5 pb-6 pt-8 lg:max-w-[560px]">
        <div className="flex flex-col gap-2.5">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground">
            STEP {step} OF 3
          </span>
          <h1 className="font-brand text-4xl uppercase leading-none tracking-[0.02em] text-foreground">
            {stepTitle}
          </h1>
          <div className="flex gap-1">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-foreground/20"}`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <FieldLabel label="TITLE">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Basement noise set"
                maxLength={120}
                className="h-12 rounded-full border border-border bg-input px-4 text-[15px] text-foreground outline-none placeholder:text-dim"
              />
            </FieldLabel>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
                CATEGORY
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((t) => {
                  const active = eventType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setEventType(t.value)}
                      className={`rounded-full border px-3.5 py-2.5 font-mono text-[10px] tracking-[0.1em] ${
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border/[0.22] text-muted-2"
                      }`}
                    >
                      {t.label.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2.5">
              <FieldLabel label="DATE">
                <input
                  type="date"
                  value={eventDay}
                  onChange={(e) => setEventDay(e.target.value)}
                  className="h-12 rounded-full border border-border bg-input px-3.5 font-mono text-xs text-foreground outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </FieldLabel>
              <FieldLabel label="START">
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="h-12 rounded-full border border-border bg-input px-3.5 font-mono text-xs text-foreground outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </FieldLabel>
              <FieldLabel label="END (OPTIONAL)">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-12 rounded-full border border-border bg-input px-3.5 font-mono text-xs text-foreground outline-none"
                  style={{ colorScheme: "dark" }}
                />
              </FieldLabel>
            </div>

            <CompactToggle
              label="RUNS OVER MULTIPLE DAYS"
              checked={multiDay}
              onChange={(v) => {
                setMultiDay(v);
                if (!v) setEndDay("");
                else if (!endDay) setEndDay(eventDay);
              }}
            />

            {multiDay && (
              <FieldLabel label="END DATE">
                <input
                  type="date"
                  value={endDay}
                  min={eventDay}
                  onChange={(e) => setEndDay(e.target.value)}
                  className="h-12 max-w-[220px] rounded-full border border-border bg-input px-3.5 font-mono text-xs text-foreground outline-none"
                  style={{ colorScheme: "dark" }}
                />
                {endDateError && <p className="text-[11px] text-destructive">{endDateError}</p>}
              </FieldLabel>
            )}

            {isMultiDayRange && (
              <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                Multi-day events aren't repeated every day — they show in "On now" once they start.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
                REPEATS
              </span>
              <div className="flex flex-wrap gap-1.5">
                {REPEAT_OPTIONS.map((o) => {
                  const active = repeats === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setRepeats(o.value)}
                      className={`rounded-full border px-3.5 py-2.5 font-mono text-[10px] tracking-[0.1em] ${
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border/[0.22] text-muted-2"
                      }`}
                    >
                      {o.label.toUpperCase()}
                    </button>
                  );
                })}
              </div>
              {repeats !== "none" && (
                <p className="font-mono text-[9px] text-muted-foreground">
                  Future instances auto-created up to 3 months ahead.
                </p>
              )}
            </div>

            <FieldLabel label="DESCRIPTION — LINKS BECOME CLICKABLE">
              <DescriptionEditor
                value={description}
                onChange={setDescription}
                maxLength={2500}
                placeholder="Doors 20:00. Cash only. instagram.com/…"
              />
            </FieldLabel>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <FieldLabel label={locationMode === "public" ? "PLACE" : "PLACE (OPTIONAL)"}>
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
                placeholder="Sameheads, Richardstr. 20"
                maxLength={200}
              />
            </FieldLabel>
            <FieldLabel label="LINK — INSTAGRAM, SIGN-UP, MORE INFO">
              <div className="flex gap-2">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="instagram.com/plastic_productions_"
                  type="text"
                  inputMode="url"
                  className="h-12 min-w-0 flex-1 rounded-full border border-border bg-input px-4 text-[15px] text-foreground outline-none placeholder:text-dim"
                />
                <QrScanButton
                  onResult={(text) => {
                    setLink(text);
                    toast.success("QR captured");
                  }}
                />
              </div>
            </FieldLabel>
            {!link.trim() && (
              <p className="-mt-2.5 font-mono text-[9px] tracking-[0.1em] text-muted-foreground">
                Tip: an Instagram post link helps people trust the event is real.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
                PRICE — OPTIONAL
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRICE_TYPES.map((p) => {
                  const active = priceType === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriceType(active ? null : p.value)}
                      className={`rounded-full border px-3.5 py-2.5 font-mono text-[10px] tracking-[0.1em] ${
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border/[0.22] text-muted-2"
                      }`}
                    >
                      {p.label.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {priceType === "paid" && (
              <FieldLabel label="TICKET LINK (OPTIONAL)">
                <input
                  value={ticketUrl}
                  onChange={(e) => setTicketUrl(e.target.value)}
                  placeholder="ra.co/events/…"
                  type="text"
                  inputMode="url"
                  className="h-12 w-full rounded-full border border-border bg-input px-4 text-[15px] text-foreground outline-none placeholder:text-dim"
                />
              </FieldLabel>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
                LOCATION
              </span>
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_MODES.map((m) => {
                  const active = locationMode === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setLocationMode(m.value)}
                      className={`rounded-full border px-3.5 py-2.5 font-mono text-[10px] tracking-[0.1em] ${
                        active
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border/[0.22] text-muted-2"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <span className="font-mono text-[9px] text-muted-foreground">
                {LOCATION_MODES.find((m) => m.value === locationMode)?.hint}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[430px] gap-2 px-5 pb-28 pt-1 lg:max-w-[560px]">
        <button
          type="button"
          onClick={prevStep}
          className="shrink-0 rounded-full border border-border px-[18px] py-4 font-mono text-[10px] tracking-[0.14em] text-foreground"
        >
          {prevLabel}
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={saving}
          className="flex-1 rounded-full bg-primary py-4 font-mono text-[10px] font-bold tracking-[0.16em] text-primary-foreground disabled:opacity-60"
        >
          {saving ? "…" : nextLabel}
        </button>
      </div>
    </div>
  );
}

/** Decorative radar sweep matching the Radar tab's visual identity — rings
    and a rotating blip sweep anchored just below the visible band. */
function RadarSweepBand() {
  return (
    <div
      className="relative h-40 shrink-0 overflow-hidden lg:h-48"
      style={{ background: "radial-gradient(circle at 50% 118%, #7A0417 0%, #5A0210 62%)" }}
    >
      <span className="absolute left-1/2 bottom-[-160px] h-[320px] w-[320px] -ml-[160px] rounded-full border border-foreground/[0.14]" />
      <span className="absolute left-1/2 bottom-[-108px] h-[216px] w-[216px] -ml-[108px] rounded-full border border-foreground/[0.12]" />
      <span className="absolute left-1/2 bottom-[-56px] h-[112px] w-[112px] -ml-[56px] rounded-full border border-foreground/10" />
      <span
        className="absolute left-1/2 bottom-[-160px] h-[320px] w-[320px] -ml-[160px] rounded-full animate-[rdSweep_6s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,59,48,0) 0deg, rgba(255,59,48,0) 292deg, rgba(255,59,48,0.42) 356deg, rgba(255,106,99,0.85) 360deg)",
        }}
      />
      <span
        className="absolute h-[7px] w-[7px] animate-[wrBlip_6s_ease-in-out_infinite] rounded-full bg-hot"
        style={{ left: "32%", bottom: "38%", boxShadow: "0 0 12px rgba(255,106,99,0.9)" }}
      />
      <span
        className="absolute h-[7px] w-[7px] animate-[wrBlip_6s_ease-in-out_infinite] rounded-full bg-hot"
        style={{
          left: "68%",
          bottom: "22%",
          animationDelay: "2s",
          boxShadow: "0 0 12px rgba(255,106,99,0.9)",
        }}
      />
      <span
        className="absolute h-[7px] w-[7px] animate-[wrBlip_6s_ease-in-out_infinite] rounded-full bg-foreground"
        style={{
          left: "50%",
          bottom: "62%",
          animationDelay: "4s",
          boxShadow: "0 0 12px rgba(247,231,228,0.7)",
        }}
      />
      <span className="absolute left-5 top-4 font-mono text-[10px] font-bold tracking-[0.2em] text-link">
        SCANNING
      </span>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CompactToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-2.5 rounded-full border border-border/[0.22] px-4 py-2 text-left text-foreground"
    >
      <span className="font-mono text-[10px] tracking-[0.12em] text-muted-2">{label}</span>
      <span
        className={`flex h-5 w-9 shrink-0 items-center rounded-full p-[3px] ${
          checked ? "justify-end bg-primary" : "justify-start bg-foreground/[0.18]"
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full ${checked ? "bg-primary-foreground" : "bg-foreground"}`}
        />
      </span>
    </button>
  );
}
