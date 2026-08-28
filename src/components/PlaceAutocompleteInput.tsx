import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { useGooglePlacesAutocomplete } from "@/lib/use-google-places-autocomplete";
import { fetchPlaceDetails } from "@/lib/google-places";

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
  const [resolving, setResolving] = useState(false);

  const { suggestions, loading, error, sessionToken, resetSession } = useGooglePlacesAutocomplete(
    open ? query : "",
  );

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

  const selectSuggestion = async (placeId: string, fallbackLabel: string) => {
    if (!sessionToken) return;
    setResolving(true);
    // Place Details (New) call, using the same session token as the
    // preceding autocomplete keystrokes — this is what terminates the
    // session for billing purposes.
    const details = await fetchPlaceDetails(placeId, sessionToken);
    setResolving(false);
    resetSession();
    setOpen(false);

    const label = details?.formattedAddress || fallbackLabel;
    onChange(label);
    setQuery(label);
    onPlaceSelected({
      name: label,
      lat: details?.lat ?? null,
      lng: details?.lng ?? null,
      // The Details field mask is deliberately minimal (id/displayName/
      // formattedAddress/location only) and doesn't include address
      // components, so callers fall back to coordinate-based district
      // matching (nearestBerlinDistrict) when this is null.
      neighborhood: null,
    });
    setSelected(true);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setSelected(false);
    setOpen(false);
    resetSession();
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
      {query && !resolving && (
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
        <Command
          shouldFilter={false}
          className="absolute inset-x-0 top-full z-10 mt-1 rounded-2xl border border-border bg-popover shadow-lg"
        >
          <CommandList className="max-h-64">
            {loading || resolving ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {resolving ? "Loading address…" : "Searching…"}
              </div>
            ) : error ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Address search isn't available — type the address manually.
              </div>
            ) : (
              <>
                <CommandEmpty className="px-4 py-3 text-left text-sm text-muted-foreground">
                  No matches found.
                </CommandEmpty>
                <CommandGroup>
                  {suggestions.map((s) => (
                    <CommandItem
                      key={s.placeId}
                      value={s.placeId}
                      onSelect={() => selectSuggestion(s.placeId, s.fullText)}
                      className="cursor-pointer rounded-xl px-3 py-2.5"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-foreground">{s.mainText}</span>
                        {s.secondaryText && (
                          <span className="truncate text-xs text-muted-foreground">
                            {s.secondaryText}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      )}
    </div>
  );
}
