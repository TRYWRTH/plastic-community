import { useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (next: string) => void;
  name?: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
};

export function DescriptionEditor({
  value,
  onChange,
  name,
  rows = 6,
  maxLength = 1500,
  placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const openLinkPopover = () => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    setSelection({ start, end });
    setLinkText(selected);
    setLinkUrl("");
    setOpen(true);
  };

  const cancel = () => {
    setOpen(false);
    setLinkUrl("");
    setLinkText("");
    setSelection(null);
  };

  const insert = () => {
    const u = linkUrl.trim();
    if (!u) return;
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    const display = (linkText.trim() || u);
    const md = `[${display}](${normalized})`;

    const sel = selection ?? { start: value.length, end: value.length };
    const before = value.slice(0, sel.start);
    const after = value.slice(sel.end);
    let next: string;
    let caret: number;
    if (sel.start === sel.end) {
      // No selection — append with sensible separator
      const sep = before && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
      next = (before + sep + md + after).slice(0, maxLength);
      caret = (before + sep + md).length;
    } else {
      next = (before + md + after).slice(0, maxLength);
      caret = (before + md).length;
    }
    onChange(next);
    cancel();
    // Restore focus & caret after state flush
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };

  const hasSelection = !!(selection && selection.start !== selection.end);

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-1">
        <button
          type="button"
          onClick={openLinkPopover}
          title="Insert link"
          className="inline-flex h-7 items-center gap-1 rounded px-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted hover:text-primary sm:text-xs"
        >
          <Link2 className="h-3.5 w-3.5" /> Link
        </button>
      </div>

      <Textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="min-h-0 py-1.5 text-sm sm:text-base"
      />

      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2">
          {!hasSelection && (
            <Input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Link text (e.g. Tickets)"
              maxLength={120}
              autoFocus
            />
          )}
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            type="url"
            inputMode="url"
            maxLength={500}
            autoFocus={hasSelection}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insert();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] text-muted-foreground sm:text-xs">
              {hasSelection
                ? `Wrapping "${value.slice(selection!.start, selection!.end).slice(0, 40)}"`
                : "Adds a new link at the end"}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={insert} disabled={!linkUrl.trim()}>
                Insert
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
