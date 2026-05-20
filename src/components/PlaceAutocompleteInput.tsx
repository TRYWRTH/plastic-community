import { useEffect, useRef, useState } from "react";
import { loadGooglePlaces } from "@/lib/google-places";
import { Input } from "@/components/ui/input";

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

type Suggestion = {
  placeId: string;
  primary: string;
  secondary: string;
};

export function PlaceAutocompleteInput({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  required,
  maxLength,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const serviceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    loadGooglePlaces()
      .then(() => {
        const places = window.google?.maps?.places;
        if (!places) return;
        serviceRef.current = new places.AutocompleteService();
        // PlacesService needs a DOM node or Map; a div is fine.
        const attrEl = document.createElement("div");
        placesServiceRef.current = new places.PlacesService(attrEl);
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      })
      .catch((err) => console.error("Failed to load Google Places", err));
  }, []);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const fetchSuggestions = (q: string) => {
    if (!serviceRef.current || !q.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    serviceRef.current.getPlacePredictions(
      {
        input: q,
        sessionToken: sessionTokenRef.current,
        componentRestrictions: { country: "de" },
      },
      (preds: any[] | null) => {
        if (!preds) {
          setSuggestions([]);
          setOpen(false);
          return;
        }
        const mapped: Suggestion[] = preds.slice(0, 6).map((p) => ({
          placeId: p.place_id,
          primary: p.structured_formatting?.main_text ?? p.description,
          secondary: p.structured_formatting?.secondary_text ?? "",
        }));
        setSuggestions(mapped);
        setHighlight(0);
        setOpen(mapped.length > 0);
      },
    );
  };

  const handleChange = (v: string) => {
    onChange(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(v), 180);
  };

  const pick = (s: Suggestion) => {
    const svc = placesServiceRef.current;
    if (!svc) return;
    svc.getDetails(
      {
        placeId: s.placeId,
        fields: ["name", "formatted_address", "geometry"],
        sessionToken: sessionTokenRef.current,
      },
      (place: any, status: string) => {
        if (status !== "OK" || !place) return;
        const displayName = place.name || "";
        const address = place.formatted_address || "";
        const name =
          displayName && address
            ? displayName === address
              ? address
              : `${displayName}, ${address}`
            : displayName || address;
        const loc = place.geometry?.location;
        const lat = loc ? loc.lat() : null;
        const lng = loc ? loc.lng() : null;
        onChange(name);
        onPlaceSelected({ name, lat, lng });
        setOpen(false);
        setSuggestions([]);
        // New session for next search
        const places = window.google?.maps?.places;
        if (places) sessionTokenRef.current = new places.AutocompleteSessionToken();
        // Dismiss mobile keyboard
        inputRef.current?.blur();
      },
    );
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border border-input bg-background shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === highlight}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlight ? "bg-accent text-accent-foreground" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <div className="font-medium">{s.primary}</div>
              {s.secondary && (
                <div className="text-xs text-muted-foreground">{s.secondary}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
