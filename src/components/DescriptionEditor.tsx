import { useRef, useState } from "react";
import { Bold, Italic, Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
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

type Sel = { start: number; end: number };

export function DescriptionEditor({
  value,
  onChange,
  name,
  rows = 6,
  maxLength = 1500,
  placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selection, setSelection] = useState<Sel | null>(null);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const currentSelection = (): Sel => {
    const ta = textareaRef.current;
    return {
      start: ta?.selectionStart ?? value.length,
      end: ta?.selectionEnd ?? value.length,
    };
  };

  const applyReplacement = (sel: Sel, replacement: string, caretOffset?: number) => {
    const before = value.slice(0, sel.start);
    const after = value.slice(sel.end);
    const next = (before + replacement + after).slice(0, maxLength);
    onChange(next);
    const caret = before.length + (caretOffset ?? replacement.length);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };

  const wrap = (marker: string, placeholderText: string) => {
    const sel = currentSelection();
    const selected = value.slice(sel.start, sel.end);
    const inner = selected || placeholderText;
    const replacement = `${marker}${inner}${marker}`;
    const caret = selected
      ? sel.start + replacement.length
      : sel.start + marker.length + inner.length;
    applyReplacement(sel, replacement, caret - sel.start);
  };

  const openLink = () => {
    const sel = currentSelection();
    const selected = value.slice(sel.start, sel.end);
    setSelection(sel);
    setLinkText(selected);
    setLinkUrl("");
    setLinkOpen(true);
  };

  const cancelLink = () => {
    setLinkOpen(false);
    setLinkUrl("");
    setLinkText("");
    setSelection(null);
  };

  const insertLink = () => {
    const u = linkUrl.trim();
    if (!u) return;
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    const display = (linkText.trim() || u);
    const md = `[${display}](${normalized})`;
    const sel = selection ?? currentSelection();
    applyReplacement(sel, md);
    cancelLink();
  };

  const hasSelection = !!(selection && selection.start !== selection.end);

  return (
    <div>
      <div className="mb-1 flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/40 px-1 py-1">
        <ToolbarBtn label="Bold" onClick={() => wrap("**", "bold")}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Italic" onClick={() => wrap("*", "italic")}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-border/70" aria-hidden />
        <ToolbarBtn label="Link" onClick={openLink}>
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>

      {linkOpen && (
        <div className="mb-1 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2">
          {!hasSelection && (
            <Input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Link text (e.g. Tickets)"
              maxLength={120}
              autoFocus
            />
          )}
          <div className="flex gap-2">
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
                  insertLink();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelLink();
                }
              }}
            />
            <Button type="button" size="sm" variant="ghost" onClick={cancelLink}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={insertLink} disabled={!linkUrl.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}

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

      {value.trim() && (
        <div className="mt-2 rounded-md border border-border/60 bg-muted/20 p-2">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Preview
          </p>
          <div className="prose prose-sm max-w-none break-words text-sm [&_a]:text-primary [&_a]:underline">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
              }}
            >
              {value}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
    >
      {children}
    </button>
  );
}
