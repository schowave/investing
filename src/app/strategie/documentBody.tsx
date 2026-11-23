import type { RenderedDocument } from "../markdown.ts";

/**
 * Inhaltsverzeichnis und Text eines Dokuments aus `docs/`. Das HTML stammt aus `renderMarkdown`, das rohes HTML im Markdown
 * als Text ausgibt; deshalb darf es hier unverändert eingesetzt werden.
 */
export function DocumentBody({ doc, nested = true }: { doc: RenderedDocument; nested?: boolean }) {
  const sections = doc.headings.filter((h) => h.level === 2);
  return (
    <>
      <nav className="card card-body toc" aria-label="Inhalt">
        <h2>Inhalt</h2>
        <ol>
          {sections.map((section) => {
            const start = doc.headings.indexOf(section);
            const next = doc.headings.findIndex((h, i) => i > start && h.level === 2);
            const children = nested ? doc.headings.slice(start + 1, next < 0 ? undefined : next) : [];
            return (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.text}</a>
                {children.length > 0 && (
                  <ol>
                    {children.map((child) => (
                      <li key={child.id}>
                        <a href={`#${child.id}`}>{child.text}</a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <article className="card card-body document">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown gibt rohes HTML nur als Text aus (html: false). */}
        <div className="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>
    </>
  );
}
