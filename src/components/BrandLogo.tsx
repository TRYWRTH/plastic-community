import { Link } from "@tanstack/react-router";

/**
 * The "Whisper Ring" wordmark, linked to Home from every page so it works
 * as a consistent way back regardless of where the user currently is.
 */
export function BrandLogo({
  className = "",
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <Link
      to="/"
      aria-label="Whisper Ring — home"
      className={`inline-flex w-fit cursor-pointer flex-col gap-1.5 transition-opacity hover:opacity-80 active:opacity-70 ${className}`}
    >
      <span className="font-brand uppercase leading-none text-foreground">Whisper Ring</span>
      {showTagline && (
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          BROUGHT TO YOU BY PLASTIC PRODUCTIONS
        </span>
      )}
    </Link>
  );
}
