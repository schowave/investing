"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { navSection } from "./origin.ts";

export interface NavItem {
  href: string;
  label: string;
  /** Anzahl offener Aufgaben hinter diesem Punkt; 0 zeigt nichts. */
  count?: number;
  countLabel?: string;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // Eine Aktienseite gehört zu der Seite, von der man kam: aus dem Portfolio bleibt „Portfolios“ markiert.
  const section = navSection(pathname, useSearchParams().get("von"));
  const isActive = (href: string) => href === section;
  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
          {item.label}
          {item.count ? (
            <span className="count" title={item.countLabel}>
              {item.count}
              <span className="sr-only"> {item.countLabel}</span>
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
