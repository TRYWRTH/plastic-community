import type { Database } from "@/integrations/supabase/types";

export type EventType = Database["public"]["Enums"]["event_type"];
export type Neighborhood = Database["public"]["Enums"]["neighborhood"];

export const EVENT_TYPES: { value: EventType; label: string; emoji: string }[] = [
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "theater", label: "Theater", emoji: "🎭" },
  { value: "food", label: "Food", emoji: "🍜" },
  { value: "art", label: "Art", emoji: "🎨" },
  { value: "film", label: "Film", emoji: "🎬" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "workshop", label: "Workshop", emoji: "🛠" },
  { value: "community", label: "Community", emoji: "🤝" },
  { value: "nightlife", label: "Nightlife", emoji: "🌙" },
  { value: "other", label: "Other", emoji: "✨" },
];

export const NEIGHBORHOODS: { value: Neighborhood; label: string }[] = [
  { value: "Mitte", label: "Mitte" },
  { value: "Friedrichshain-Kreuzberg", label: "Friedrichshain-Kreuzberg" },
  { value: "Pankow", label: "Pankow" },
  { value: "Charlottenburg-Wilmersdorf", label: "Charlottenburg-Wilmersdorf" },
  { value: "Spandau", label: "Spandau" },
  { value: "Steglitz-Zehlendorf", label: "Steglitz-Zehlendorf" },
  { value: "Tempelhof-Schöneberg", label: "Tempelhof-Schöneberg" },
  { value: "Neukölln", label: "Neukölln" },
  { value: "Treptow-Köpenick", label: "Treptow-Köpenick" },
  { value: "Marzahn-Hellersdorf", label: "Marzahn-Hellersdorf" },
  { value: "Lichtenberg", label: "Lichtenberg" },
  { value: "Reinickendorf", label: "Reinickendorf" },
];

export const eventTypeMeta = (v: EventType) =>
  EVENT_TYPES.find((t) => t.value === v) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
export const neighborhoodMeta = (v: Neighborhood) =>
  NEIGHBORHOODS.find((n) => n.value === v) ?? { value: v, label: v };
