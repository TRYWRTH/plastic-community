import type { Database } from "@/integrations/supabase/types";

export type EventType = Database["public"]["Enums"]["event_type"];
export type Neighborhood = Database["public"]["Enums"]["neighborhood"];

export const EVENT_TYPES: { value: EventType; label: string; icon: string }[] = [
  { value: "music", label: "Music", icon: "ti-vinyl" },
  { value: "theater", label: "Theater", icon: "ti-masks-theater" },
  { value: "food", label: "Food", icon: "ti-tools-kitchen-2" },
  { value: "art", label: "Art", icon: "ti-palette" },
  { value: "film", label: "Film", icon: "ti-movie" },
  { value: "sports", label: "Sports", icon: "ti-ball-football" },
  { value: "workshop", label: "Workshop", icon: "ti-tools" },
  { value: "community", label: "Community", icon: "ti-users-group" },
  { value: "nightlife", label: "Nightlife", icon: "ti-glass-full" },
  { value: "other", label: "Other", icon: "ti-dots" },
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
