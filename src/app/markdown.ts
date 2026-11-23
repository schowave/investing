// Markdown der Dokumente (Strategie, Änderungsprotokoll) für die Oberfläche. Rohes HTML im Markdown wird nicht durchgereicht,
// sondern als Text ausgegeben; Links prüft markdown-it (kein `javascript:` und Ähnliches). Formeln stehen in Codeblöcken.

import MarkdownIt from "markdown-it";

interface Heading {
  level: 2 | 3;
  text: string;
  /** Anker; für nummerierte Abschnitte stabil, z. B. `abschnitt-4-5` für „4.5 …“. */
  id: string;
}

export interface RenderedDocument {
  /** Text der ersten Überschrift erster Ordnung; sie steht nicht in `html`, die Seite setzt sie als Titel. */
  title: string | null;
  html: string;
  /** Überschriften der zweiten und dritten Ordnung für das Inhaltsverzeichnis. */
  headings: Heading[];
}

const TRANSLITERATION: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** Anker einer Überschrift: Abschnittsnummer, wenn sie mit einer beginnt, sonst der Text in Kleinbuchstaben. */
export function headingId(text: string): string {
  const number = /^(\d{1,2}(?:\.\d{1,2})?)\.?\s/.exec(text);
  if (number) return `abschnitt-${number[1]!.replace(".", "-")}`;
  const slug = text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => TRANSLITERATION[c]!)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "abschnitt";
}

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
md.renderer.rules.table_open = () => '<div class="scroll"><table>\n';
md.renderer.rules.table_close = () => "</table></div>\n";
md.renderer.rules.fence = (tokens, idx) => `<pre class="formula"><code>${md.utils.escapeHtml(tokens[idx]!.content)}</code></pre>\n`;

export function renderMarkdown(markdown: string): RenderedDocument {
  const tokens = md.parse(markdown, {});
  // Die erste Überschrift erster Ordnung (Anfang, Text, Ende) wird zum Titel der Seite.
  const titleAt = tokens.findIndex((token) => token.type === "heading_open" && token.tag === "h1");
  const title = titleAt >= 0 ? tokens[titleAt + 1]!.content : null;
  const body = titleAt >= 0 ? tokens.filter((_, i) => i < titleAt || i > titleAt + 2) : tokens;
  const headings: Heading[] = [];
  const used = new Set<string>();
  body.forEach((token, i) => {
    if (token.type !== "heading_open" || (token.tag !== "h2" && token.tag !== "h3")) return;
    // Für Anker und Inhaltsverzeichnis der reine Text, ohne Markdown-Zeichen (`code`, **fett**).
    const text = (body[i + 1]!.children ?? [])
      .filter((child) => child.type === "text" || child.type === "code_inline")
      .map((child) => child.content)
      .join("");
    let id = headingId(text);
    for (let n = 2; used.has(id); n++) id = `${headingId(text)}-${n}`;
    used.add(id);
    token.attrSet("id", id);
    headings.push({ level: token.tag === "h2" ? 2 : 3, text, id });
  });
  return { title, html: md.renderer.render(body, md.options, {}), headings };
}
