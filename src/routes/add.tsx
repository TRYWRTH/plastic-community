import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

import { UnsavedChangesGuard } from "@/components/UnsavedChangesGuard";
import { DescriptionEditor } from "@/components/DescriptionEditor";
import { QrScanButton } from "@/components/QrScanButton";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { EventImageUpload } from "@/components/EventImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { sendNewEventNotification } from "@/lib/notifications";
import { cleanDescription } from "@/lib/clean-description";
import { EVENT_TYPES, type EventType, type Neighborhood } from "@/lib/constants";
import { REPEAT_OPTIONS, type RepeatOption, createRecurringInstances } from "@/lib/recurrence";
import { cleanPlace } from "@/lib/clean-place";
import { geocodeAddress } from "@/lib/geocode";
import { nearestBerlinDistrict } from "@/lib/district-from-coords";
import { triggerLinkPreviewUnfurl } from "@/lib/link-preview";

export const Route = createFileRoute("/add")({
  component: AddEvent,
});

type Step = 1 | 2 | 3;

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
  const [eventType, setEventType] = useState<EventType>("music");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [eventDay, setEventDay] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd"));
  const [eventTime, setEventTime] = useState("20:00");
  const [multiDay, setMultiDay] = useState(false);
  const [endDay, setEndDay] = useState("");
  const [endTime, setEndTime] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [repeats, setRepeats] = useState<RepeatOption>("none");
  const [isSecret, setIsSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const endDateError =
    multiDay && endDay && endDay < eventDay ? "End date must be on or after the start date." : null;

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
    if (finalCoords.lat == null || finalCoords.lng == null) {
      const geo = await geocodeAddress(`${place.trim()}, ${neighborhood}, Berlin`);
      if (geo) finalCoords = geo;
    }
    // Coordinates are ground truth — prefer the nearest Bezirk to the final
    // geocoded point over the (possibly stale or defaulted) form state.
    const resolvedNeighborhood =
      (finalCoords.lat != null && finalCoords.lng != null
        ? nearestBerlinDistrict(finalCoords.lat, finalCoords.lng)
        : null) ?? neighborhood;
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
      image_url: imageUrl,
    };
    const { data, error } = await supabase
      .from("events")
      .insert({
        ...basePayload,
        event_date: parsedDate.toISOString(),
        end_date: multiDay && endDay ? (endTime ? `${endDay}T${endTime}` : endDay) : null,
        repeats,
        is_secret: isSecret,
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

    if (link.trim() && !imageUrl) {
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
    if (!place.trim()) {
      toast.error("Please add a place, or turn on NO PUBLIC ADDRESS.");
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
    <div className="min-h-screen bg-background">
      <UnsavedChangesGuard when={dirty && !saving && !saved} />
      <div className="mx-auto flex max-w-[430px] flex-col gap-4 px-5 pb-28 pt-2 lg:max-w-[560px]">
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
                autoFocus
                className="h-12 rounded-full border border-border bg-input px-4 text-[15px] text-foreground outline-none placeholder:text-dim"
              />
            </FieldLabel>
            {user && <EventImageUpload value={imageUrl} onChange={setImageUrl} userId={user.id} />}
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
            <div className="grid grid-cols-2 gap-2.5">
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
            </div>

            <ToggleRow
              label="ADD END DATE"
              sublabel="FOR MULTI-DAY EVENTS"
              checked={multiDay}
              onChange={(v) => {
                setMultiDay(v);
                if (!v) {
                  setEndDay("");
                  setEndTime("");
                } else if (!endDay) setEndDay(eventDay);
              }}
            />

            {multiDay && (
              <div className="grid grid-cols-2 gap-2.5">
                <FieldLabel label="END DATE">
                  <input
                    type="date"
                    value={endDay}
                    min={eventDay}
                    onChange={(e) => setEndDay(e.target.value)}
                    className="h-12 rounded-full border border-border bg-input px-3.5 font-mono text-xs text-foreground outline-none"
                    style={{ colorScheme: "dark" }}
                  />
                  {endDateError && <p className="text-[11px] text-destructive">{endDateError}</p>}
                </FieldLabel>
                <FieldLabel label="END TIME (OPTIONAL)">
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-12 rounded-full border border-border bg-input px-3.5 font-mono text-xs text-foreground outline-none"
                    style={{ colorScheme: "dark" }}
                  />
                </FieldLabel>
              </div>
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
                maxLength={1500}
                placeholder="Doors 20:00. Cash only. instagram.com/…"
              />
            </FieldLabel>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <FieldLabel label="PLACE">
              <PlaceAutocompleteInput
                value={place}
                onChange={(v) => {
                  setPlace(v);
                  setCoords({ lat: null, lng: null });
                }}
                onPlaceSelected={(p) => {
                  setCoords({ lat: p.lat, lng: p.lng });
                  const fallback =
                    p.lat != null && p.lng != null ? nearestBerlinDistrict(p.lat, p.lng) : null;
                  setNeighborhood((p.neighborhood as Neighborhood) ?? fallback ?? "Mitte");
                }}
                placeholder="Sameheads, Richardstr. 20"
                maxLength={200}
              />
            </FieldLabel>
            <FieldLabel label="LINK — INSTAGRAM, TICKETS, SIGN-UP">
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
            <ToggleRow
              label="NO PUBLIC ADDRESS"
              sublabel="GUESTS REGISTER OR ASK VIA THE LINK"
              checked={isSecret}
              onChange={setIsSecret}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
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

function ToggleRow({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-2.5 rounded-2xl bg-foreground/[0.07] px-4 py-3.5 text-left text-foreground"
    >
      <span className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-[0.14em]">{label}</span>
        <span className="font-mono text-[9px] text-muted-foreground">{sublabel}</span>
      </span>
      <span
        className={`flex h-[26px] w-[46px] shrink-0 items-center rounded-full p-[3px] ${
          checked ? "justify-end bg-primary" : "justify-start bg-foreground/[0.18]"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full ${checked ? "bg-primary-foreground" : "bg-foreground"}`}
        />
      </span>
    </button>
  );
}
