import type { Database } from "@/integrations/supabase/types";
import {
  IconVinyl,
  IconMasksTheater,
  IconToolsKitchen2,
  IconPalette,
  IconMovie,
  IconBallFootball,
  IconTools,
  IconUsersGroup,
  IconGlassFull,
  IconDots,
  type Icon,
} from "@tabler/icons-react";

export type EventType = Database["public"]["Enums"]["event_type"];
export type Neighborhood = Database["public"]["Enums"]["neighborhood"];

export const EVENT_TYPES: { value: EventType; label: string; Icon: Icon }[] = [
  { value: "music", label: "Music", Icon: IconVinyl },
  { value: "theater", label: "Theater", Icon: IconMasksTheater },
  { value: "food", label: "Food", Icon: IconToolsKitchen2 },
  { value: "art", label: "Art", Icon: IconPalette },
  { value: "film", label: "Film", Icon: IconMovie },
  { value: "sports", label: "Sports", Icon: IconBallFootball },
  { value: "workshop", label: "Workshop", Icon: IconTools },
  { value: "community", label: "Community", Icon: IconUsersGroup },
  { value: "nightlife", label: "Nightlife", Icon: IconGlassFull },
  { value: "other", label: "Other", Icon: IconDots },
];


export const NEIGHBORHOODS: { value: Neighborhood; label: string }[] = [
  { value: "Brandenburg", label: "Brandenburg" },
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
