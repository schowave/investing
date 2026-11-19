// Was außer den Jahresabschlüssen in der gespeicherten Fundamentals-Antwort von EODHD steht: Kennzahlen zum Kurs,
// Quartalsmeldungen, Insidergeschäfte, Unternehmensangaben. Alles, was diese Antwort liest, liest sie hier, geprüft mit zod.

import { z } from "zod";
import type { Database } from "./db.ts";

/** Art der gespeicherten Rohantwort in `raw_documents`. */
export const FUNDAMENTALS_KIND = "eodhd-fundamentals";

export interface EodhdSnapshot {
  /** CIK bei der SEC, wie der Anbieter sie nennt (nur US-Titel); ungeprüft, ob sie eine gültige CIK ist. */
  cik: string | null;
  /** 52-Wochen-Hoch in der Börseneinheit (z. B. Pence bei der LSE), nicht in der gespeicherten Kurseinheit. */
  week52High: number | null;
  /** Umsatz des letzten Quartals gegen das Vorjahresquartal, z. B. -0.18. */
  quarterlyRevenueGrowth: number | null;
  /** Gemeldete und geschätzte Quartalsgewinne, ungeordnet. */
  earnings: { date: string; epsActual: number | null; epsEstimate: number | null; surprisePercent: number | null }[];
  company: {
    industry: string | null;
    ipoDate: string | null;
    employees: number | null;
    description: string | null;
    /** "Name, Titel". */
    officers: string[];
  };
  insiderTransactions: {
    date: string | null;
    owner: string | null;
    /** "A" Erwerb, "D" Abgabe. */
    acquiredDisposed: string | null;
    code: string | null;
    amount: number | null;
    price: number | null;
    heldAfter: number | null;
  }[];
  analystRatings: { rating: number | null; targetPrice: number | null } | null;
}

/** Beträge kommen als Zahl oder Text; leer, fehlend oder nicht lesbar heißt `null`. */
const Num = z
  .unknown()
  .optional()
  .transform((value): number | null => {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  });
const Text = z
  .unknown()
  .optional()
  .transform((value): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null));
const Section = z.looseObject({}).catch({});

/** Einträge eines Objekts oder einer Liste; Einträge in fremder Form fallen weg, statt die ganze Antwort zu verwerfen. */
function listOf<T>(row: z.ZodType<T>) {
  return z
    .unknown()
    .optional()
    .transform((value): T[] => {
      if (value === null || typeof value !== "object") return [];
      return Object.values(value).flatMap((entry) => {
        const parsed = row.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      });
    });
}

const Officer = z.looseObject({ Name: Text, Title: Text }).transform((o) => [o.Name, o.Title].filter(Boolean).join(", "));
const Quarter = z.looseObject({ date: z.string(), epsActual: Num, epsEstimate: Num, surprisePercent: Num });
const Insider = z
  .looseObject({
    transactionDate: Text,
    date: Text,
    ownerName: Text,
    transactionAcquiredDisposed: Text,
    transactionCode: Text,
    transactionAmount: Num,
    transactionPrice: Num,
    postTransactionAmount: Num,
  })
  .transform((t) => ({
    date: t.transactionDate ?? t.date,
    owner: t.ownerName,
    acquiredDisposed: t.transactionAcquiredDisposed,
    code: t.transactionCode,
    amount: t.transactionAmount,
    price: t.transactionPrice,
    heldAfter: t.postTransactionAmount,
  }));

const Answer = z
  .looseObject({
    General: z
      .looseObject({
        CIK: z.union([z.string(), z.number()]).transform(String).nullish().catch(null),
        Industry: Text,
        GicIndustry: Text,
        IPODate: Text,
        FullTimeEmployees: Num,
        Description: Text,
        Officers: listOf(Officer),
      })
      .catch({ Industry: null, GicIndustry: null, IPODate: null, FullTimeEmployees: null, Description: null, Officers: [] })
      .optional(),
    Technicals: Section.optional(),
    Highlights: Section.optional(),
    Earnings: z
      .looseObject({ History: listOf(Quarter) })
      .catch({ History: [] })
      .optional(),
    InsiderTransactions: listOf(Insider),
    AnalystRatings: z.looseObject({ Rating: Num, TargetPrice: Num }).nullish().catch(null),
  })
  .catch({ InsiderTransactions: [] });

/** Liest die Rohantwort; eine kaputte oder fremde Antwort ergibt eine leere Momentaufnahme, keinen Fehler. */
export function parseEodhdSnapshot(json: string): EodhdSnapshot {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    data = {};
  }
  const root = Answer.parse(data);
  const general = root.General;
  return {
    cik: general?.CIK ?? null,
    week52High: Num.parse(root.Technicals?.["52WeekHigh"]),
    quarterlyRevenueGrowth: Num.parse(root.Highlights?.QuarterlyRevenueGrowthYOY),
    earnings: root.Earnings?.History ?? [],
    company: {
      industry: general?.Industry ?? general?.GicIndustry ?? null,
      ipoDate: general?.IPODate ?? null,
      employees: general?.FullTimeEmployees ?? null,
      description: general?.Description ?? null,
      officers: (general?.Officers ?? []).filter((o) => o !== ""),
    },
    insiderTransactions: root.InsiderTransactions,
    analystRatings: root.AnalystRatings ? { rating: root.AnalystRatings.Rating, targetPrice: root.AnalystRatings.TargetPrice } : null,
  };
}

/** Momentaufnahme aus der gespeicherten Rohantwort; `null`, wenn keine gespeichert ist. */
export function storedSnapshot(db: Database, stockId: string): EodhdSnapshot | null {
  const body = db.rawDocument(stockId, FUNDAMENTALS_KIND)?.body;
  return body === undefined ? null : parseEodhdSnapshot(body);
}
