import { Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1440px] flex-col items-center gap-2 px-5 pb-8 pt-10 text-center lg:px-9">
      <p className="font-mono text-[10px] tracking-[0.14em] text-dim">
        © {new Date().getFullYear()} PLASTIC PRODUCTIONS. ALL RIGHTS RESERVED.
      </p>
      <a
        href="https://www.instagram.com/plastic_productions_/"
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-link underline underline-offset-2"
      >
        <Instagram className="h-3 w-3" />
        PLASTIC PRODUCTIONS
      </a>
    </footer>
  );
}
