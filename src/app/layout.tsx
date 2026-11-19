import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { EXCLUSION_SCORE } from "../calc/index.ts";
import { computeValuation } from "../valuation/run.ts";
import { STRATEGY_NAME } from "./brand.ts";
import { isoDate } from "./format.ts";
import "./globals.css";
import type { NavItem } from "./nav.tsx";
import { Nav } from "./nav.tsx";
import { database, today } from "./server.ts";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = { title: STRATEGY_NAME, description: "Aktien nach innerer Rendite und Risiko ordnen" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const db = database();
  const watchlist = db.stocks();
  // Dieselbe Zählung wie auf der Rangliste: unvollständig bewertet und nicht wegen des Risikos ausgeschlossen.
  const open = watchlist.filter((stock) => {
    const { valuation } = computeValuation(db, stock, today());
    return !valuation.complete && valuation.riskScore < EXCLUSION_SCORE;
  }).length;
  const lastSync = db.latestSyncRun();
  const items: NavItem[] = [
    { href: "/", label: "Rangliste", count: open, countLabel: "offene Bewertungen" },
    { href: "/portfolio", label: "Portfolios" },
    { href: "/vorrat", label: "Datenvorrat" },
    { href: "/abgleich", label: "Abgleich", count: db.activeJobs().length, countLabel: "laufende oder wartende Läufe" },
    { href: "/strategie", label: "Strategie" },
  ];
  const scope = `Watchlist mit ${watchlist.length} ${watchlist.length === 1 ? "Titel" : "Titeln"}`;

  return (
    <html lang="de" className={geist.variable}>
      <body>
        <details className="topbar">
          <summary>
            {STRATEGY_NAME} <span>Menü</span>
          </summary>
          <Nav items={items} />
        </details>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              {STRATEGY_NAME}
            </Link>
            <span className="scope">{scope}</span>
            <Nav items={items} />
            <p className="sidebar-foot">
              <strong>Letzter Abgleich</strong>
              {lastSync ? `${isoDate(lastSync.finishedAt.slice(0, 10))}${lastSync.ok ? "" : ", unvollständig"}` : "noch keiner"}
            </p>
          </aside>
          <main className="canvas">
            {children}
            <p className="legal">
              Eigene Rechnung auf Basis von Anbieterdaten. Keine Anlageberatung. Wechselkurse: EZB, ergänzt um{" "}
              <a href="https://www.exchangerate-api.com">Rates By Exchange Rate API</a>.
            </p>
          </main>
        </div>
      </body>
    </html>
  );
}
