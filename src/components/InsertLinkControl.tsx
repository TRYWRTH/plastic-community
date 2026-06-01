import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InsertLinkControl({
  onInsert,
}: {
  onInsert: (markdown: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const insert = () => {
    const u = url.trim();
    const t = text.trim() || u;
    if (!u) return;
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    onInsert(`[${t}](${normalized})`);
    setUrl("");
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary sm:text-xs"
      >
        <Link2 className="h-3.5 w-3.5" /> Insert link
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Link text (e.g. Tickets)"
        maxLength={120}
      />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        type="url"
        inputMode="url"
        maxLength={500}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            insert();
          }
        }}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={insert} disabled={!url.trim()}>
          Insert
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setUrl("");
            setText("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
