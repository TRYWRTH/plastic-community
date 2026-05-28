import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, Italic, Link2 } from "lucide-react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (next: string) => void;
  name?: string;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
};

/** Check whether any part of the current selection contains a link mark,
 *  and return the first href found. */
function selectionContainsLink(editor: Editor): { hasLink: boolean; href: string } {
  const { from, to } = editor.state.selection;
  let href = "";
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.marks) {
      const linkMark = node.marks.find((m) => m.type.name === "link");
      if (linkMark) {
        href = linkMark.attrs.href as string;
        return false; // stop traversing
      }
    }
    return true;
  });
  return { hasLink: !!href, href };
}

export function DescriptionEditor({
  value,
  onChange,
  name,
  maxLength = 1500,
  placeholder,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const hadSelectionRef = useRef(false);
  const linkInfoRef = useRef({ hasLink: false, href: "" });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: true,
        transformPastedText: true,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "tiptap-editor min-h-[7.5rem] w-full whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const md = (editor.storage as any).markdown.getMarkdown() as string;
      const truncated = md.length > maxLength ? md.slice(0, maxLength) : md;
      onChange(truncated);
    },
  });

  // Sync external value changes (e.g. reset, async load) without breaking caret on every keystroke.
  useEffect(() => {
    if (!editor) return;
    const current = (editor.storage as any).markdown.getMarkdown() as string;
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[7.5rem] w-full rounded-md border border-input bg-background" />
    );
  }

  const openLink = () => {
    const { from, to, empty } = editor.state.selection;
    hadSelectionRef.current = !empty;
    const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, " ");
    const { hasLink, href } = selectionContainsLink(editor);
    linkInfoRef.current = { hasLink, href };
    setLinkText(selectedText);
    setLinkUrl(href);
    setLinkOpen(true);
  };

  const cancelLink = () => {
    setLinkOpen(false);
    setLinkText("");
    setLinkUrl("");
  };

  const insertLink = () => {
    const u = linkUrl.trim();
    if (!u) return;
    const normalized = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    const chain = editor.chain().focus();
    if (hadSelectionRef.current) {
      chain
        .extendMarkRange("link")
        .setLink({ href: normalized })
        .run();
    } else {
      const display = linkText.trim() || u;
      chain
        .insertContent({
          type: "text",
          text: display,
          marks: [{ type: "link", attrs: { href: normalized } }],
        })
        .run();
    }
    cancelLink();
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/40 px-1 py-1">
        <ToolbarBtn
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <span className="mx-1 h-4 w-px bg-border/70" aria-hidden />
        <ToolbarBtn
          label="Link"
          active={editor.isActive("link")}
          onClick={openLink}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>

      {linkOpen && (
        <div className="mb-1 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2">
          {!hadSelectionRef.current && !editor.isActive("link") && (
            <Input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Link text (e.g. Tickets)"
              maxLength={120}
              autoFocus
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              type="url"
              inputMode="url"
              maxLength={500}
              autoFocus={hadSelectionRef.current || editor.isActive("link")}
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
            {editor.isActive("link") && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  cancelLink();
                }}
              >
                Remove
              </Button>
            )}
            <Button type="button" size="sm" onClick={insertLink} disabled={!linkUrl.trim()}>
              {editor.isActive("link") ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      )}

      <EditorContent editor={editor} />

      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors " +
        (active
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:bg-background hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

// Suppress unused export warning for Editor type
export type { Editor };
