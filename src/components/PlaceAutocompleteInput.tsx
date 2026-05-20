import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { loadGooglePlaces } from "@/lib/google-places";

export type PlaceResult = {
  name: string;
  lat: number | null;
  lng: number | null;
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

  useEffect(() => {
    let cancelled = false;
    loadGooglePlaces()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["name", "formatted_address", "geometry"],
          componentRestrictions: { country: "de" },
          types: ["establishment", "geocode"],
        });
        autocompleteRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const name =
            place?.name && place?.formatted_address
              ? place.name === place.formatted_address
                ? place.formatted_address
                : `${place.name}, ${place.formatted_address}`
              : place?.name || place?.formatted_address || "";
          const loc = place?.geometry?.location;
          const lat = loc ? loc.lat() : null;
          const lng = loc ? loc.lng() : null;
          if (name) onChange(name);
          onPlaceSelected({ name, lat, lng });
        });
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      autoComplete="off"
    />
  );
}
