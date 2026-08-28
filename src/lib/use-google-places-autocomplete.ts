import { useEffect, useRef, useState } from "react";
import { fetchPlacePredictions, type PlacePrediction } from "@/lib/google-places";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

/**
 * Debounced, cancellation-safe address/venue autocomplete against Google
 * Places API (New), with proper session-token handling: a fresh UUID is
 * generated the moment a new search starts (query goes empty -> non-empty)
 * and reused across every keystroke's autocomplete request in that search.
 * Call `resetSession()` after the terminating Place Details request (or on
 * clear) so the next search starts a fresh token.
 */
export function useGooglePlacesAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID();
    }
    const sessionToken = sessionTokenRef.current;

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      fetchPlacePredictions(trimmed, sessionToken, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setLoading(false);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof Error ? err.message : "Address search failed");
          setSuggestions([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [query]);

  const resetSession = () => {
    sessionTokenRef.current = null;
  };

  return {
    suggestions,
    loading,
    error,
    sessionToken: sessionTokenRef.current,
    resetSession,
  };
}
