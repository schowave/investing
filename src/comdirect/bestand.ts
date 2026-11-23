// Ordnet die Positionen eines comdirect-Depots dem Bestand eines Portfolios zu (Spezifikation 6.1). Rein rechnend:
// kein Abruf, keine Datenbank; die Vorschau zeigt, was die Übernahme ändern würde.

/** Eine Position im Depot, wie die Bank sie meldet, schon geprüft und auf das Nötige reduziert. */
export interface DepotPosition {
  isin: string | null;
  wkn: string;
  name: string;
  /** Aktie: kommt über die ISIN in den Bestand. Sonstiges: Fonds, ETF, Anleihe, Zertifikat und alles andere. */
  kind: "aktie" | "sonstiges";
  /** Stückzahl; bei Anleihen der Nennwert. */
  quantity: number;
  /** Kurswert laut Bank in Euro; `null`, wenn die Bank keinen in Euro nennt. */
  valueEur: number | null;
}

/** Notiz in der Datenbank, die zu einer ISIN passt. */
export interface Listing {
  id: string;
  watched: boolean;
  /** Stammaktie laut Anbieter (kein CEDEAR, keine Vorzugsaktie); unbekannt zählt als ja. */
  common: boolean;
  /** Es gibt einen Kurs. */
  priced: boolean;
}

/** `ohne ISIN`: gehalten, aber ohne bekannte ISIN; bleibt, weil sich nicht prüfen lässt, ob sie noch im Depot liegt. */
export type RowStatus = "neu" | "geändert" | "gleich" | "weg" | "ohne ISIN";

interface PreviewRow {
  stockId: string;
  name: string;
  isin: string | null;
  before: number;
  after: number;
  status: RowStatus;
}

/** Position, die als sonstige Anlage zählt: keine Aktie, oder eine Aktie, die noch nicht in der Datenbank steht. */
interface OtherRow {
  name: string;
  isin: string | null;
  wkn: string;
  valueEur: number | null;
  /** `true`: eine Aktie, die über die ISIN aufgenommen wird und beim nächsten Abruf in den Bestand geht. */
  pendingImport: boolean;
  /** `true`: eine Aktie, deren Aufnahme vor Kurzem schon versucht wurde und nicht gelang. */
  notFound: boolean;
}

export interface Preview {
  rows: PreviewRow[];
  others: OtherRow[];
  cash: { before: number; after: number };
  other: { before: number; after: number };
  /** Stückzahl je Aktie nach der Übernahme. */
  shares: Map<string, number>;
  /** ISINs von Aktien, die noch nicht in der Datenbank stehen. */
  missingIsins: string[];
  /** Hinweise, die der Nutzer vor der Übernahme sehen soll. */
  warnings: string[];
}

export interface CurrentBestand {
  cashEur: number;
  otherEur: number;
  shares: ReadonlyMap<string, number>;
  /** Anzeigenamen gehaltener Aktien, für weggefallene Positionen. */
  names: ReadonlyMap<string, string>;
  /** Gehaltene Aktien ohne bekannte ISIN. */
  withoutIsin: ReadonlySet<string>;
}

/**
 * Mehrere Notizen derselben ISIN: die auf der Watchlist, dann die schon gehaltene, dann eine Stammaktie (kein CEDEAR mit
 * eigenem Bezugsverhältnis), dann eine mit Kurs, zuletzt die erste nach Symbol.
 */
function pick(listings: readonly Listing[], held: ReadonlyMap<string, number>): string {
  const rank = (l: Listing) => [Number(l.watched), Number(held.has(l.id)), Number(l.common), Number(l.priced)];
  const sorted = [...listings].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    const diff = ra.map((value, i) => rb[i]! - value).find((d) => d !== 0);
    return diff ?? a.id.localeCompare(b.id);
  });
  return sorted[0]!.id;
}

const round = (value: number) => Math.round(value * 100) / 100;
/** Stückzahlen auf sechs Stellen: Bruchstücke aus Sparplänen in mehreren Lagerstellen addieren sich sonst ungenau. */
const roundShares = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Vergleicht das Depot mit dem heutigen Bestand.
 * @param listings Notizen je ISIN, wie sie in der Datenbank stehen.
 * @param cashEur Saldo des Verrechnungskontos; `null`, wenn keins gefunden wurde (der Barbestand bleibt dann).
 * @param triedIsins ISINs, deren Aufnahme vor Kurzem scheiterte; sie werden nicht noch einmal angestoßen.
 */
export function previewBestand(
  positions: readonly DepotPosition[],
  cashEur: number | null,
  listings: ReadonlyMap<string, readonly Listing[]>,
  current: CurrentBestand,
  triedIsins: ReadonlySet<string> = new Set(),
): Preview {
  const shares = new Map<string, number>();
  const names = new Map(current.names);
  const isins = new Map<string, string | null>();
  const others: OtherRow[] = [];
  const missing = new Set<string>();
  const warnings: string[] = [];

  for (const position of positions) {
    if (position.quantity <= 0) continue;
    const found = position.kind === "aktie" && position.isin ? listings.get(position.isin) : undefined;
    if (found && found.length > 0) {
      const id = pick(found, current.shares);
      shares.set(id, roundShares((shares.get(id) ?? 0) + position.quantity));
      if (!names.has(id)) names.set(id, position.name);
      isins.set(id, position.isin);
      continue;
    }
    const unknownStock = position.kind === "aktie" && position.isin !== null;
    const notFound = unknownStock && triedIsins.has(position.isin!);
    const pendingImport = unknownStock && !notFound;
    if (pendingImport) missing.add(position.isin!);
    if (notFound && !warnings.some((w) => w.includes(position.isin!)))
      warnings.push(
        `${position.name} (${position.isin}): Die Aufnahme über die ISIN wurde in den letzten 30 Tagen schon versucht und brachte keine Notiz; zählt als sonstige Anlage.`,
      );
    if (position.kind === "aktie" && position.isin === null)
      warnings.push(`${position.name} (WKN ${position.wkn}): Aktie ohne ISIN, zählt als sonstige Anlage.`);
    if (position.valueEur === null) warnings.push(`${position.name} (WKN ${position.wkn}): kein Kurswert in Euro, zählt mit 0.`);
    others.push({ name: position.name, isin: position.isin, wkn: position.wkn, valueEur: position.valueEur, pendingImport, notFound });
  }

  // Gehaltene Aktien ohne ISIN bleiben stehen: Ob sie noch im Depot liegen, lässt sich nicht prüfen.
  for (const id of current.withoutIsin) {
    if (shares.has(id) || !current.shares.has(id)) continue;
    shares.set(id, current.shares.get(id)!);
    warnings.push(`${current.names.get(id) ?? id}: keine ISIN bekannt, die Stückzahl bleibt; bitte von Hand prüfen.`);
  }
  const ids = new Set([...current.shares.keys(), ...shares.keys()]);
  const rows: PreviewRow[] = [...ids].map((stockId) => {
    const before = current.shares.get(stockId) ?? 0;
    const after = shares.get(stockId) ?? 0;
    const status: RowStatus =
      current.withoutIsin.has(stockId) && before === after && !isins.has(stockId)
        ? "ohne ISIN"
        : before === 0
          ? "neu"
          : after === 0
            ? "weg"
            : roundShares(before) === after
              ? "gleich"
              : "geändert";
    return { stockId, name: names.get(stockId) ?? stockId, isin: isins.get(stockId) ?? null, before, after, status };
  });
  const order: Record<RowStatus, number> = { neu: 0, geändert: 1, weg: 2, "ohne ISIN": 3, gleich: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, "de"));

  if (cashEur === null) warnings.push("Kein Verrechnungskonto zum Depot gefunden; der Barbestand bleibt, wie er ist.");
  if (cashEur !== null && cashEur < 0) warnings.push("Das Verrechnungskonto ist im Minus; der Barbestand wird 0.");
  return {
    rows,
    others,
    cash: { before: current.cashEur, after: cashEur === null ? current.cashEur : Math.max(0, round(cashEur)) },
    other: { before: current.otherEur, after: round(others.reduce((sum, o) => sum + (o.valueEur ?? 0), 0)) },
    shares,
    missingIsins: [...missing],
    warnings,
  };
}
