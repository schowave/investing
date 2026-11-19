import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "Yield Investing", description: "Rangliste nach innerer Rendite" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <header className="masthead">
          <Link href="/" className="brand">
            Yield Investing
          </Link>
          <nav>
            <Link href="/">Rangliste</Link>
            <Link href="/portfolio">Portfolios</Link>
            <Link href="/vorrat">Datenvorrat</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>Eigene Rechnung auf Basis von Anbieterdaten. Keine Anlageberatung.</footer>
      </body>
    </html>
  );
}
