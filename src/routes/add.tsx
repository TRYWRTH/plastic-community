import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Header } from "@/components/Header";
import { QrScanButton } from "@/components/QrScanButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
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

export const Route = createFileRoute("/add")({
  component: AddEvent,
});

function AddEvent() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login", search: { redirect: "/add" } });
    }
  }, [loading, isAuthenticated, navigate]);

  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [neighborhood, setNeighborhood] = useState<Neighborhood>("downtown");
  const [eventType, setEventType] = useState<EventType>("music");
  const [date, setDate] = useState(format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm"));
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: title.trim(),
        place: place.trim(),
        neighborhood,
        event_type: eventType,
        event_date: new Date(date).toISOString(),
        link: link.trim() || null,
        description: description.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event added");
    navigate({ to: "/event/$eventId", params: { eventId: data.id } });
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Add an event</h1>
        <p className="mt-1 text-muted-foreground">
          Saw a poster? Drop the basics — your crew sees it instantly.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="Title" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Open-air jazz night"
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
              <Input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="Venue or address"
                required
                maxLength={120}
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
              placeholder="What makes it worth showing up?"
            />
          </Field>

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={saving} className="shadow-glow">
              {saving ? "Saving…" : "Save event"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link to="/">Cancel</Link>
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
