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
  { value: "downtown", label: "Downtown" },
  { value: "old_town", label: "Old Town" },
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "east", label: "East" },
  { value: "west", label: "West" },
  { value: "riverside", label: "Riverside" },
  { value: "university", label: "University" },
  { value: "industrial", label: "Industrial" },
  { value: "suburbs", label: "Suburbs" },
];

export const eventTypeMeta = (v: EventType) =>
  EVENT_TYPES.find((t) => t.value === v) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
export const neighborhoodMeta = (v: Neighborhood) =>
  NEIGHBORHOODS.find((n) => n.value === v) ?? { value: v, label: v };
