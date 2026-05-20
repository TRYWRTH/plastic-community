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

        const ac = new places.Autocomplete(inputRef.current, {
        fields: ["name", "formatted_address", "geometry", "address_components"],
          componentRestrictions: { country: "de" },
          types: ["establishment", "geocode"],
        });
        autocompleteRef.current = ac;

        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place) return;
          const displayName: string = place.name || "";
          const address: string = place.formatted_address || "";
          const name =
            displayName && address
              ? displayName === address
                ? address
                : `${displayName}, ${address}`
              : displayName || address;
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
};
let detectedNeighborhood: string | null = null;
const components = place.address_components || [];
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
if (name && inputRef.current) inputRef.current.value = name;
if (name) onChangeRef.current(name);
onPlaceSelectedRef.current({ name, lat, lng, neighborhood: detectedNeighborhood });
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
