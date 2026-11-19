"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  /** Anzahl offener Aufgaben hinter diesem Punkt; 0 zeigt nichts. */
  count?: number;
  countLabel?: string;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/aktie") : pathname.startsWith(href));
  return (
    <nav className="nav" aria-label="Hauptnavigation">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}>
          {item.label}
          {item.count ? (
            <span className="count" title={item.countLabel} aria-label={`${item.count} ${item.countLabel}`}>
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
