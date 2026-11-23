import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { strategyHead } from "../valuation/strategyDocument.ts";
import { readDocument } from "./documents.ts";
import { headingId, renderMarkdown } from "./markdown.ts";

describe("Markdown der Dokumente", () => {
  it("nimmt die erste Überschrift als Titel und verankert die Abschnitte", () => {
    const doc = renderMarkdown("# Titel\n\nText\n\n## 1. Kurzfassung\n\n### 4.5 Quote\n\n## Ohne Nummer\n\n## Ohne Nummer\n");
    expect(doc.title).toBe("Titel");
    expect(doc.html).not.toContain("<h1");
    expect(doc.html).toContain('<h2 id="abschnitt-1">1. Kurzfassung</h2>');
    expect(doc.html).toContain('<h3 id="abschnitt-4-5">4.5 Quote</h3>');
    expect(doc.headings).toEqual([
      { level: 2, text: "1. Kurzfassung", id: "abschnitt-1" },
      { level: 3, text: "4.5 Quote", id: "abschnitt-4-5" },
      { level: 2, text: "Ohne Nummer", id: "ohne-nummer" },
      { level: 2, text: "Ohne Nummer", id: "ohne-nummer-2" },
    ]);
  });

  it("gibt Überschriften im Inhaltsverzeichnis ohne Markdown-Zeichen aus", () => {
    const doc = renderMarkdown("## 3. Rückfluss `R0` und **Deckel**\n");
    expect(doc.headings).toEqual([{ level: 2, text: "3. Rückfluss R0 und Deckel", id: "abschnitt-3" }]);
    expect(doc.html).toContain("<code>R0</code>");
  });

  it("bildet Anker aus Datumsüberschriften ohne sie für Abschnittsnummern zu halten", () => {
    expect(headingId("22.11.2026 · Version 1.0 · Ausgangsfassung")).toBe("22-11-2026-version-1-0-ausgangsfassung");
    expect(headingId("Änderungen für Größe")).toBe("aenderungen-fuer-groesse");
    expect(headingId("···")).toBe("abschnitt");
  });

  it("gibt rohes HTML als Text aus und lässt keine gefährlichen Links durch", () => {
    const doc = renderMarkdown('<script>alert(1)</script>\n\n[Klick](javascript:alert(1)) <b onclick="x">fett</b>');
    expect(doc.html).not.toContain("<script>");
    expect(doc.html).toContain("&lt;script&gt;");
    expect(doc.html).not.toContain('href="javascript:');
    expect(doc.html).not.toContain("<b ");
    expect(doc.title).toBeNull();
  });

  it("setzt Tabellen in einen scrollbaren Rahmen und Formeln in Formelblöcke", () => {
    const doc = renderMarkdown("| A | B |\n| - | - |\n| 1 | 2 |\n\n```\nr = a < b\n```\n");
    expect(doc.html).toContain('<div class="scroll"><table>');
    expect(doc.html).toContain("</table></div>");
    expect(doc.html).toContain('<pre class="formula"><code>r = a &lt; b\n</code></pre>');
  });

  it("liest die Strategie aus docs/ und rendert sie mit Titel, Version und Inhaltsverzeichnis", () => {
    const markdown = readDocument("STRATEGIE.md", join(import.meta.dirname, "..", ".."));
    const doc = renderMarkdown(markdown);
    expect(doc.title).toContain("Rückflussrendite");
    expect(strategyHead(markdown)).not.toBeNull();
    expect(doc.headings.filter((h) => h.level === 2).map((h) => h.id)).toEqual(Array.from({ length: 11 }, (_, i) => `abschnitt-${i + 1}`));
  });
});
