import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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

// Berlin's 12 official districts — match Google Places address components.
const NEIGHBORHOOD_MAP: Record<string, string> = {
  "mitte": "Mitte",
  "bezirk mitte": "Mitte",
  "friedrichshain-kreuzberg": "Friedrichshain-Kreuzberg",
  "bezirk friedrichshain-kreuzberg": "Friedrichshain-Kreuzberg",
  "friedrichshain": "Friedrichshain-Kreuzberg",
  "kreuzberg": "Friedrichshain-Kreuzberg",
  "pankow": "Pankow",
  "bezirk pankow": "Pankow",
  "prenzlauer berg": "Pankow",
  "charlottenburg-wilmersdorf": "Charlottenburg-Wilmersdorf",
  "bezirk charlottenburg-wilmersdorf": "Charlottenburg-Wilmersdorf",
  "charlottenburg": "Charlottenburg-Wilmersdorf",
  "wilmersdorf": "Charlottenburg-Wilmersdorf",
  "spandau": "Spandau",
  "bezirk spandau": "Spandau",
  "steglitz-zehlendorf": "Steglitz-Zehlendorf",
  "bezirk steglitz-zehlendorf": "Steglitz-Zehlendorf",
  "steglitz": "Steglitz-Zehlendorf",
  "zehlendorf": "Steglitz-Zehlendorf",
  "tempelhof-schöneberg": "Tempelhof-Schöneberg",
  "tempelhof-schoneberg": "Tempelhof-Schöneberg",
  "bezirk tempelhof-schöneberg": "Tempelhof-Schöneberg",
  "bezirk tempelhof-schoneberg": "Tempelhof-Schöneberg",
  "tempelhof": "Tempelhof-Schöneberg",
  "schöneberg": "Tempelhof-Schöneberg",
  "schoneberg": "Tempelhof-Schöneberg",
  "neukölln": "Neukölln",
  "neukolln": "Neukölln",
  "bezirk neukölln": "Neukölln",
  "bezirk neukolln": "Neukölln",
  "treptow-köpenick": "Treptow-Köpenick",
  "treptow-kopenick": "Treptow-Köpenick",
  "bezirk treptow-köpenick": "Treptow-Köpenick",
  "bezirk treptow-kopenick": "Treptow-Köpenick",
  "treptow": "Treptow-Köpenick",
  "köpenick": "Treptow-Köpenick",
  "kopenick": "Treptow-Köpenick",
  "marzahn-hellersdorf": "Marzahn-Hellersdorf",
  "bezirk marzahn-hellersdorf": "Marzahn-Hellersdorf",
  "marzahn": "Marzahn-Hellersdorf",
  "hellersdorf": "Marzahn-Hellersdorf",
  "lichtenberg": "Lichtenberg",
  "bezirk lichtenberg": "Lichtenberg",
  "reinickendorf": "Reinickendorf",
  "bezirk reinickendorf": "Reinickendorf",
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
          const name = address
            ? displayName && !address.toLowerCase().includes(displayName.toLowerCase())
              ? `${displayName}, ${address}`
              : address
            : displayName;

          const loc = place.geometry?.location;
          const lat = loc ? loc.lat() : null;
          const lng = loc ? loc.lng() : null;

          let detectedNeighborhood: string | null = null;
          const components: any[] = place.address_components || [];

          for (const component of components) {
            const longName = (component.long_name || "").toLowerCase();
            if (NEIGHBORHOOD_MAP[longName]) {
              detectedNeighborhood = NEIGHBORHOOD_MAP[longName];
              break;
            }
          }
          if (!detectedNeighborhood && address) {
            const addressLower = address.toLowerCase();
            for (const [key, val] of Object.entries(NEIGHBORHOOD_MAP)) {
              if (addressLower.includes(key)) {
                detectedNeighborhood = val;
                break;
              }
            }
          }

          const finalName = detectedNeighborhood ? `${name} · ${detectedNeighborhood}` : name;
          if (finalName && inputRef.current) inputRef.current.value = finalName;
          if (finalName) onChangeRef.current(finalName);
          onPlaceSelectedRef.current({
            name: finalName,
            lat,
            lng,
            neighborhood: detectedNeighborhood,
          });

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

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = "";
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <Input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        title={value || undefined}
        className="pr-8 text-ellipsis"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear place"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
