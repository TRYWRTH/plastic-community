import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { loadGooglePlaces } from "@/lib/google-places";
import { BERLIN_DISTRICTS } from "@/lib/constants";

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

// Only nag once per session — every mount of this component would otherwise
// re-fire the same cached rejection from loadGooglePlaces().
let hasWarnedAboutLoadFailure = false;

export function PlaceAutocompleteInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  required,
  maxLength,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  // "selected" = show read-only multi-line view; otherwise show typing input.
  const [selected, setSelected] = useState<boolean>(() => Boolean(value));

  useEffect(() => {
    if (selected) return;
    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    loadGooglePlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const places = window.google?.maps?.places;
        if (!places?.Autocomplete) {
          console.error("google.maps.places.Autocomplete is not available");
          return;
        }

        // Bias towards Berlin + Brandenburg region (soft bias, not a hard restriction).
        // strictBounds is omitted so results outside the box are still returned.
        const brandenburgBounds = new window.google.maps.LatLngBounds(
          { lat: 51.36, lng: 11.27 }, // SW corner of Brandenburg
          { lat: 53.56, lng: 14.77 }, // NE corner of Brandenburg
        );
        const ac = new places.Autocomplete(inputRef.current, {
          fields: ["name", "formatted_address", "geometry", "address_components", "types"],
          componentRestrictions: { country: "de" },
          types: ["establishment", "geocode"],
          bounds: brandenburgBounds,
        });
        autocompleteRef.current = ac;

        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place) return;

          // Use Google's exact formatted address or name
          const address: string = place.formatted_address || place.name || "";

          const loc = place.geometry?.location;
          const lat = loc ? loc.lat() : null;
          const lng = loc ? loc.lng() : null;

          // Extract borough/district directly from Google's address components
          let detectedNeighborhood: string | null = null;
          const components: google.maps.GeocoderAddressComponent[] = place.address_components || [];

          // Look for Google's sublocality (borough/district) component
          const subComponent = components.find(
            (c) =>
              c.types?.includes("sublocality_level_1") ||
              c.types?.includes("administrative_area_level_3"),
          );

          if (subComponent) {
            const districtName = subComponent.long_name;
            // Normalize Berlin district names to match our constants
            const match = BERLIN_DISTRICTS.find(
              (d) => d.label.toLowerCase() === districtName.toLowerCase(),
            );
            detectedNeighborhood = match ? match.value : districtName;
          }

          if (address && inputRef.current) inputRef.current.value = address;
          if (address) onChangeRef.current(address);
          onPlaceSelectedRef.current({
            name: address,
            lat,
            lng,
            neighborhood: detectedNeighborhood,
          });

          setSelected(true);
          inputRef.current?.blur();
          (document.activeElement as HTMLElement | null)?.blur?.();
        });
      })
      .catch((err) => {
        console.error(err);
        if (!hasWarnedAboutLoadFailure) {
          hasWarnedAboutLoadFailure = true;
          toast.error("Address search isn't available — type the address manually.");
        }
      });

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
  }, [selected]);

  useEffect(() => {
    if (!selected && inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value ?? "";
    }
  }, [value, selected]);

  const handleClear = () => {
    onChange("");
    setSelected(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleEdit = () => {
    setSelected(false);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);
  };

  if (selected) {
    return (
      <div className="relative w-full">
        <Input
          type="text"
          value={value}
          readOnly
          onClick={handleEdit}
          onFocus={handleEdit}
          aria-label="Selected place"
          className="pr-8 cursor-text"
        />
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear place"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {required && (
          <input
            type="text"
            value={value}
            required
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={() => {}}
          />
        )}
      </div>
    );
  }

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
        className="pr-8"
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
