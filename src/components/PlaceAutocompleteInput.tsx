import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePhotonAutocomplete, type PhotonSuggestion } from "@/lib/use-photon-autocomplete";

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
  const containerRef = useRef<HTMLDivElement | null>(null);

  // "selected" = show read-only view; otherwise show the typing input with
  // its suggestions dropdown.
  const [selected, setSelected] = useState<boolean>(() => Boolean(value));
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const { suggestions, loading, error } = usePhotonAutocomplete(open ? query : "");

  useEffect(() => {
    if (!selected && query !== value) setQuery(value);
    // Only resync from the parent's `value` when we're not actively typing —
    // re-running this on every `query` change would fight the user's input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectSuggestion = (s: PhotonSuggestion) => {
    onChange(s.label);
    setQuery(s.label);
    onPlaceSelected({
      name: s.label,
      lat: s.lat,
      lng: s.lon,
      // Photon doesn't reliably return Berlin Bezirk names — callers fall
      // back to coordinate-based district matching (nearestBerlinDistrict)
      // when this is null, which is more consistent than trusting OSM's
      // inconsistent admin-boundary tagging anyway.
      neighborhood: null,
    });
    setOpen(false);
    setSelected(true);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setSelected(false);
    setOpen(false);
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
    <div ref={containerRef} className="relative w-full">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="pr-8"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear place"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && query.trim().length >= 3 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover shadow-lg">
          {loading && <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>}
          {!loading && error && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Address search isn't available — type the address manually.
            </div>
          )}
          {!loading && !error && suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No matches found.</div>
          )}
          {!loading &&
            !error &&
            suggestions.map((s, i) => (
              <button
                key={`${s.lat}-${s.lon}-${i}`}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="block w-full truncate px-4 py-2.5 text-left text-sm text-foreground hover:bg-accent"
              >
                {s.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
