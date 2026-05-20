import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  start: string | Date;
  durationMinutes?: number;
  location?: string;
  description?: string;
  uid?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIcsUtc(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function AddToCalendarButton({
  title,
  start,
  durationMinutes = 120,
  location,
  description,
  uid,
}: Props) {
  const onClick = () => {
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) return;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
    const dtstamp = toIcsUtc(new Date());
    const id = uid ?? `${dtstamp}-${Math.random().toString(36).slice(2, 10)}@whisperer-ring`;

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Whisperer Ring//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${id}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(startDate)}`,
      `DTEND:${toIcsUtc(endDate)}`,
      `SUMMARY:${escapeIcs(title)}`,
      location ? `LOCATION:${escapeIcs(location)}` : null,
      description ? `DESCRIPTION:${escapeIcs(description)}` : null,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(title)}`,
      "TRIGGER:-PT60M",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean);

    const ics = lines.join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "event";
    a.download = `${slug}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Button variant="outline" onClick={onClick} className="w-full sm:w-auto">
      <CalendarPlus className="h-4 w-4" />
      Add to calendar
    </Button>
  );
}
