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
  { value: "Prenzlauer Berg", label: "Prenzlauer Berg" },
  { value: "Friedrichshain", label: "Friedrichshain" },
  { value: "Kreuzberg", label: "Kreuzberg" },
  { value: "Neukölln", label: "Neukölln" },
  { value: "Tempelhof", label: "Tempelhof" },
  { value: "Schöneberg", label: "Schöneberg" },
  { value: "Charlottenburg", label: "Charlottenburg" },
  { value: "Marzahn", label: "Marzahn" },
  { value: "Spandau", label: "Spandau" },
  { value: "Pankow", label: "Pankow" },
  { value: "Lichtenberg", label: "Lichtenberg" },
  { value: "Steglitz-Zehlendorf", label: "Steglitz-Zehlendorf" },
{ value: "Reinickendorf", label: "Reinickendorf" },
{ value: "Treptow-Köpenick", label: "Treptow-Köpenick" },
  
];

export const eventTypeMeta = (v: EventType) =>
  EVENT_TYPES.find((t) => t.value === v) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
export const neighborhoodMeta = (v: Neighborhood) =>
  NEIGHBORHOODS.find((n) => n.value === v) ?? { value: v, label: v };
