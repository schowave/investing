import Link from "next/link";
import { hurdleRate, PROFILE_FOCUSED } from "../../calc/index.ts";
import { BOND_KEY } from "../../valuation/portfolioRun.ts";
import { STRATEGY_VERSION } from "../../valuation/run.ts";
import { strategyHead, withoutHead } from "../../valuation/strategyDocument.ts";
import { STRATEGY_CLAIM } from "../brand.ts";
import { readDocument } from "../documents.ts";
import { isoDate, percent } from "../format.ts";
import { renderMarkdown } from "../markdown.ts";
import { database } from "../server.ts";
import { DocumentBody } from "./documentBody.tsx";
import { PrintButton } from "./printButton.tsx";

export const dynamic = "force-dynamic";

// Die Seite zeigt `docs/STRATEGIE.md`, die maßgebliche Beschreibung der Strategie. Eigener Text steht hier nur im Kasten mit den
// Tageswerten, die nicht ins Dokument gehören.
export default function Strategy() {
  const markdown = readDocument("STRATEGIE.md");
  // Version und Datum stehen in der Titelzeile (auch im Druck), deshalb nicht noch einmal im Text.
  const doc = renderMarkdown(withoutHead(markdown));
  const head = strategyHead(markdown);
  const bond = database().referenceRateEntry(BOND_KEY);

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{doc.title}</h1>
          <p className="finding">{STRATEGY_CLAIM}</p>
          <p className="meta">
            Version {STRATEGY_VERSION}
            {head ? ` vom ${isoDate(head.date)}` : ""}
            <span className="no-print">
              {" · "}
              <Link href="/strategie/aenderungen">Änderungsprotokoll</Link>
            </span>
          </p>
        </div>
        <div className="title-actions no-print">
          <PrintButton />
        </div>
      </div>
      <section className="card card-body daily no-print" aria-label="Tageswerte">
        <h2>Tageswerte</h2>
        <p className="hint">Sie ändern sich täglich und gehören deshalb nicht ins Dokument.</p>
        <dl>
          <div>
            <dt>Rendite der zehnjährigen Euro-Staatsanleihe</dt>
            <dd>{bond ? `${percent(bond.value, 2)} (Stand ${isoDate(bond.date)})` : "noch nicht geladen"}</dd>
          </div>
          <div>
            <dt>
              Hürde für Kandidaten (<a href="#abschnitt-7-1">7.1</a>)
            </dt>
            <dd>
              {bond ? percent(hurdleRate(bond.value), 2) : `${percent(PROFILE_FOCUSED.minReturn, 0)}, Ersatzwert ohne Anleiherendite`}
            </dd>
          </div>
        </dl>
      </section>
      <DocumentBody doc={doc} />
    </>
  );
}
