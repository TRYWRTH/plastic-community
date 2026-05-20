import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { loadGooglePlaces } from "@/lib/google-places";

export type PlaceResult = {
  name: string;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
};

export function PlaceAutocompleteInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  required,
  maxLength,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  useEffect(() => {
    let cancelled = false;
    let listener: any = null;

    loadGooglePlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const places = window.google?.maps?.places;
        if (!places?.Autocomplete) {
          console.error("google.maps.places.Autocomplete is not available");
          return;
        }

        // Berlin bounding box (SW / NE corners)
        const berlinBounds = new window.google.maps.LatLngBounds(
          { lat: 52.3382, lng: 13.0883 },
          { lat: 52.6755, lng: 13.7612 },
        );
        const ac = new places.Autocomplete(inputRef.current, {
          fields: ["name", "formatted_address", "geometry", "address_components"],
          componentRestrictions: { country: "de" },
          types: ["establishment", "geocode"],
          bounds: berlinBounds,
          strictBounds: true,
        });
        autocompleteRef.current = ac;

        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place) return;
          const displayName: string = place.name || "";
          const address: string = place.formatted_address || "";
          // If the name is already part of the address (typical for street addresses),
          // just use the address. Otherwise prepend the venue name.
          const name = address
            ? displayName && !address.toLowerCase().includes(displayName.toLowerCase())
              ? `${displayName}, ${address}`
              : address
            : displayName;

          const loc = place.geometry?.location;
          const lat = loc ? loc.lat() : null;
          const lng = loc ? loc.lng() : null;
      const neighborhoodMap: Record<string, string> = {
  "mitte": "Mitte", "prenzlauer berg": "Prenzlauer Berg",
  "friedrichshain": "Friedrichshain", "kreuzberg": "Kreuzberg",
  "neukölln": "Neukölln", "neukolln": "Neukölln",
  "tempelhof": "Tempelhof", "schöneberg": "Schöneberg",
  "schoneberg": "Schöneberg", "charlottenburg": "Charlottenburg",
  "marzahn": "Marzahn", "spandau": "Spandau",
  "pankow": "Pankow", "lichtenberg": "Lichtenberg",
  "bezirk neukölln": "Neukölln", "bezirk neukolln": "Neukölln",
  "bezirk mitte": "Mitte",
  "bezirk friedrichshain-kreuzberg": "Friedrichshain",
  "bezirk pankow": "Pankow",
  "bezirk charlottenburg-wilmersdorf": "Charlottenburg",
  "bezirk spandau": "Spandau",
  "bezirk steglitz-zehlendorf": "Tempelhof",
  "bezirk tempelhof-schöneberg": "Schöneberg",
  "bezirk tempelhof-schoneberg": "Schöneberg",
  "bezirk lichtenberg": "Lichtenberg",
  "bezirk marzahn-hellersdorf": "Marzahn",
  "bezirk treptow-köpenick": "Lichtenberg",
};
let detectedNeighborhood: string | null = null;
const components: any[] = place.address_components || [];
          console.log("Address components:", components.map((c: any) => c.long_name));

for (const component of components) {
  const longName = component.long_name.toLowerCase();
  if (neighborhoodMap[longName]) {
    detectedNeighborhood = neighborhoodMap[longName];
    break;
  }
}
if (!detectedNeighborhood && address) {
  const addressLower = address.toLowerCase();
  for (const [key, val] of Object.entries(neighborhoodMap)) {
    if (addressLower.includes(key)) { detectedNeighborhood = val; break; }
  }
}
const finalName = detectedNeighborhood ? `${name} · ${detectedNeighborhood}` : name;
if (finalName && inputRef.current) inputRef.current.value = finalName;
if (finalName) onChangeRef.current(finalName);
onPlaceSelectedRef.current({ name: finalName, lat, lng, neighborhood: detectedNeighborhood });

          inputRef.current?.blur();
          (document.activeElement as HTMLElement | null)?.blur?.();
        });
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      if (listener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listener);
      }
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value ?? "";
    }
  }, [value]);

  return (
    <Input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      autoComplete="off"
    />
  );
}
