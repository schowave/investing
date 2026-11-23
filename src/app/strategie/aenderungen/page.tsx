import Link from "next/link";
import { STRATEGY_VERSION } from "../../../valuation/run.ts";
import { readDocument } from "../../documents.ts";
import { renderMarkdown } from "../../markdown.ts";
import { DocumentBody } from "../documentBody.tsx";
import { PrintButton } from "../printButton.tsx";

export const dynamic = "force-dynamic";

// Zeigt `docs/STRATEGIE-AENDERUNGEN.md`: jede geprüfte Änderung an der Strategie, angenommen oder verworfen.
export default function StrategyChanges() {
  const doc = renderMarkdown(readDocument("STRATEGIE-AENDERUNGEN.md"));
  return (
    <>
      <Link href="/strategie" className="crumb no-print">
        ← Strategie
      </Link>
      <div className="title-row">
        <div>
          <h1>{doc.title}</h1>
          <p className="finding">
            Was an der Strategie geprüft wurde, mit Kennzahlen und Entscheidung. Geltende Version {STRATEGY_VERSION}.
          </p>
        </div>
        <div className="title-actions no-print">
          <PrintButton />
        </div>
      </div>
      <DocumentBody doc={doc} nested={false} />
    </>
  );
}
