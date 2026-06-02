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


export const BERLIN_DISTRICTS: { value: Neighborhood; label: string }[] = [
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

export const GERMAN_STATES: { value: Neighborhood; label: string }[] = [
  { value: "Baden-Württemberg", label: "Baden-Württemberg" },
  { value: "Bayern", label: "Bayern" },
  { value: "Brandenburg", label: "Brandenburg" },
  { value: "Bremen", label: "Bremen" },
  { value: "Hamburg", label: "Hamburg" },
  { value: "Hessen", label: "Hessen" },
  { value: "Mecklenburg-Vorpommern", label: "Mecklenburg-Vorpommern" },
  { value: "Niedersachsen", label: "Niedersachsen" },
  { value: "Nordrhein-Westfalen", label: "Nordrhein-Westfalen" },
  { value: "Rheinland-Pfalz", label: "Rheinland-Pfalz" },
  { value: "Saarland", label: "Saarland" },
  { value: "Sachsen", label: "Sachsen" },
  { value: "Sachsen-Anhalt", label: "Sachsen-Anhalt" },
  { value: "Schleswig-Holstein", label: "Schleswig-Holstein" },
  { value: "Thüringen", label: "Thüringen" },
];

// All neighborhoods = Berlin districts + German states (Brandenburg treated as a state)
export const NEIGHBORHOODS: { value: Neighborhood; label: string }[] = [
  ...BERLIN_DISTRICTS,
  ...GERMAN_STATES,
];

export const eventTypeMeta = (v: EventType) =>
  EVENT_TYPES.find((t) => t.value === v) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
export const neighborhoodMeta = (v: Neighborhood) =>
  NEIGHBORHOODS.find((n) => n.value === v) ?? { value: v, label: v };
