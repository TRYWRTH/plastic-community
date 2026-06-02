// Normalize a user-supplied description before saving.
// - Strip HTML tags
// - Collapse runs of spaces/tabs to one
// - Strip UTM tracking params from URLs (in markdown links and bare URLs)
// - Keep markdown links [text](url), @handles, and emojis intact
// - Even paragraph spacing: exactly one blank line between paragraphs
// - Group consecutive "Key: value" info lines together with no blank gap
// - Separator lines (— or ---) sit on their own line with blank line above/below
const INFO_KEYWORDS = [
  "location",
  "price",
  "tickets",
  "ticket",
  "starting time",
  "start time",
  "start",
  "time",
  "date",
  "doors",
  "sign up",
  "signup",
  "rsvp",
  "where",
  "when",
  "cost",
  "entry",
  "address",
  "venue",
  "info",
];

const INFO_RE = new RegExp(
  `^\\s*(?:${INFO_KEYWORDS.map((k) => k.replace(/ /g, "\\s+")).join("|")})\\s*:`,
  "i",
);

const SEP_RE = /^\s*(?:[—–-]{1,}|\*{3,}|_{3,})\s*$/;

const PUNCT_END_RE = /[.!?,:;…]["')\]]*\s*$/;

export function cleanDescription(input: string): string {
  if (!input) return "";
  let s = input;

  // Strip HTML tags but preserve markdown autolinks like <https://...> and <email@...>.
  // HTML tag names are [a-zA-Z][a-zA-Z0-9-]* (no colon/dot), so <https://...> won't match.
  s = s.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?\/?>/g, "");

  // Normalize line endings
  s = s.replace(/\r\n?/g, "\n");

  // Strip UTM params from URLs (in markdown links and bare URLs)
  s = s.replace(/(https?:\/\/[^\s)]+)/g, (url) => stripUtm(url));

  // Collapse horizontal whitespace (spaces/tabs) to one, preserve line breaks
  s = s.replace(/[ \t]+/g, " ");

  // Trim trailing spaces on each line
  s = s.replace(/ +\n/g, "\n");

  // Split into lines for structural pass
  const rawLines = s.split("\n").map((l) => l.trim());

  // Build "blocks": each block is either a paragraph (group of consecutive
  // non-empty lines) or a separator. We then rejoin with blank lines.
  type Block = { kind: "para" | "sep"; lines: string[] };
  const blocks: Block[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) {
      blocks.push({ kind: "para", lines: cur });
      cur = [];
    }
  };
  for (const line of rawLines) {
    if (!line) {
      flush();
      continue;
    }
    if (SEP_RE.test(line)) {
      flush();
      blocks.push({ kind: "sep", lines: ["—"] });
      continue;
    }
    cur.push(line);
  }
  flush();

  // Within each paragraph, decide whether consecutive lines should merge into
  // one logical line (regular prose) or stay on separate lines (info block).
  // Info lines (matching INFO_RE) always stay on their own line. A non-info
  // line directly before an info line also stays on its own line (so the
  // intro stays attached to the info block without a blank gap).
  const renderedBlocks: string[] = blocks.map((b) => {
    if (b.kind === "sep") return "—";
    const lines = b.lines;
    const out: string[] = [];
    let buf = "";
    const pushBuf = () => {
      if (buf) {
        out.push(buf);
        buf = "";
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const next = lines[i + 1];
      const isInfo = INFO_RE.test(line);
      const nextIsInfo = next ? INFO_RE.test(next) : false;

      if (isInfo) {
        pushBuf();
        out.push(line);
        continue;
      }

      // If the next line is an info line, end this line here (no merge).
      if (nextIsInfo) {
        if (buf) {
          buf += " " + line;
          out.push(buf);
          buf = "";
        } else {
          out.push(line);
        }
        continue;
      }

      // Regular prose: merge soft-wrapped lines into one paragraph unless
      // the current line clearly ends a sentence — even then we keep it as
      // one paragraph (paragraphs are separated by blank lines, which were
      // already used to split blocks above).
      buf = buf ? buf + " " + line : line;
      // Avoid void warning
      void PUNCT_END_RE;
    }
    pushBuf();
    return out.join("\n");
  });

  // Join blocks with exactly one blank line between them.
  return renderedBlocks.join("\n\n").trim();
}

function stripUtm(url: string): string {
  try {
    const qIdx = url.indexOf("?");
    if (qIdx === -1) return url;
    const base = url.slice(0, qIdx);
    const rest = url.slice(qIdx + 1);
    const hashIdx = rest.indexOf("#");
    const query = hashIdx === -1 ? rest : rest.slice(0, hashIdx);
    const frag = hashIdx === -1 ? "" : rest.slice(hashIdx);
    const kept = query
      .split("&")
      .filter((p) => p && !/^utm_/i.test(p.split("=")[0]));
    return base + (kept.length ? "?" + kept.join("&") : "") + frag;
  } catch {
    return url;
  }
}
