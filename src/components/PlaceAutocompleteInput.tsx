import { useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<any>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let cancelled = false;

    loadGooglePlaces()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const places = window.google?.maps?.places;
        if (!places?.PlaceAutocompleteElement) {
          console.error("PlaceAutocompleteElement is not available");
          return;
        }

        const el = new places.PlaceAutocompleteElement({
          includedRegionCodes: ["de"],
        });

        // Match the surrounding form input styling.
        el.className = "w-full";
        el.style.width = "100%";

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(el);
        elementRef.current = el;

        // Apply shadcn-like styles to the internal input once rendered.
        const styleInternalInput = () => {
          const input = el.querySelector("input") as HTMLInputElement | null;
          if (!input) return;
          input.className =
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
          if (placeholder) input.placeholder = placeholder;
          if (required) input.required = true;
          if (maxLength) input.maxLength = maxLength;
          input.autocomplete = "off";
          if (valueRef.current && !input.value) {
            input.value = valueRef.current;
          }
          input.addEventListener("input", () => {
            onChange(input.value);
          });
        };
        // The internal input mounts asynchronously inside the custom element.
        setTimeout(styleInternalInput, 0);
        setTimeout(styleInternalInput, 100);

        el.addEventListener("gmp-select", async (event: any) => {
          try {
            const prediction = event.placePrediction;
            if (!prediction) return;
            const place = prediction.toPlace();
            await place.fetchFields({
              fields: ["displayName", "formattedAddress", "location"],
            });
            const displayName = place.displayName || "";
            const address = place.formattedAddress || "";
            const name =
              displayName && address
                ? displayName === address
                  ? address
                  : `${displayName}, ${address}`
                : displayName || address;
            const loc = place.location;
            const lat = loc ? loc.lat() : null;
            const lng = loc ? loc.lng() : null;
            if (name) {
              onChange(name);
              const input = el.querySelector("input") as HTMLInputElement | null;
              if (input) input.value = name;
            }
            onPlaceSelected({ name, lat, lng });
          } catch (err) {
            console.error("Failed to resolve selected place", err);
          }
        });
      })
      .catch((err) => console.error(err));

    return () => {
      cancelled = true;
      if (elementRef.current) {
        elementRef.current.remove();
        elementRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="w-full" />;
}
