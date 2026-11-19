// Mitteilungen von US-Unternehmen an die SEC (EDGAR): kostenlose, amtliche Belege für Ereignisse, die nicht in den
// Zahlen von EODHD stehen, etwa eine abgesagte Übernahme oder eine Bilanzberichtigung. Jev bekommt die Liste mit Datum,
// Formular und den ausgeschriebenen Punkten eines 8-K, bei den gewichtigen 8-Ks dazu den Anfang des Textes.

import { z } from "zod";

/** Wie weit die Mitteilungen zurückreichen. */
const MONTHS = 12;
/** Höchstzahl der Mitteilungen, die Jev sieht (jüngste zuerst). */
const LIMIT = 40;
/** Höchstzahl der 8-Ks, deren Text gelesen wird (jüngste zuerst); jedes ist eine Abfrage bei der SEC. */
const MAX_EXCERPTS = 8;
/** Länge des Auszugs in Zeichen; der erste Punkt eines 8-K steht meist in diesem Umfang. */
const EXCERPT_LENGTH = 1500;
/**
 * Punkte, deren Text etwas sagt, das nicht schon in den Zahlen steht. Nicht dabei: 2.02 (Quartalszahlen), 5.07
 * (Abstimmungsergebnisse), 7.01 (verweist meist nur auf die Anlage).
 */
const EXCERPT_ITEMS = new Set([
  "1.01",
  "1.02",
  "1.03",
  "1.05",
  "2.01",
  "2.04",
  "2.05",
  "2.06",
  "3.01",
  "4.01",
  "4.02",
  "5.01",
  "5.02",
  "8.01",
]);

export interface Filing {
  date: string;
  form: string;
  /** Was die Mitteilung meldet: Punkte eines 8-K oder Bedeutung des Formulars, auf Englisch für Jev. */
  description: string;
  url: string;
  /** Anfang des Textes, nur bei 8-Ks mit gewichtigen Punkten. */
  excerpt?: string;
  /** Punkte eines 8-K, z. B. ["1.02"]. */
  items: string[];
}

/** Punkte eines 8-K (Form 8-K, General Instructions). 9.01 (Anlagen) und 6.x (forderungsbesicherte Papiere) fehlen absichtlich. */
const ITEMS: Record<string, string> = {
  "1.01": "Entry into a Material Definitive Agreement",
  "1.02": "Termination of a Material Definitive Agreement",
  "1.03": "Bankruptcy or Receivership",
  "1.04": "Mine Safety - Reporting of Shutdowns and Patterns of Violations",
  "1.05": "Material Cybersecurity Incident",
  "2.01": "Completion of Acquisition or Disposition of Assets",
  "2.02": "Results of Operations and Financial Condition",
  "2.03": "Creation of a Direct Financial Obligation",
  "2.04": "Triggering Events That Accelerate or Increase a Direct Financial Obligation",
  "2.05": "Costs Associated with Exit or Disposal Activities",
  "2.06": "Material Impairments",
  "3.01": "Notice of Delisting or Failure to Satisfy a Continued Listing Rule",
  "3.02": "Unregistered Sales of Equity Securities",
  "3.03": "Material Modification to Rights of Security Holders",
  "4.01": "Change in Certifying Accountant",
  "4.02": "Non-Reliance on Previously Issued Financial Statements (restatement)",
  "5.01": "Change in Control of Registrant",
  "5.02": "Departure or Appointment of Directors or Officers; Compensation Arrangements",
  "5.03": "Amendments to Articles or Bylaws; Change in Fiscal Year",
  "5.04": "Temporary Suspension of Trading Under Employee Benefit Plans",
  "5.05": "Amendment to or Waiver of the Code of Ethics",
  "5.06": "Change in Shell Company Status",
  "5.07": "Submission of Matters to a Vote of Security Holders",
  "5.08": "Shareholder Director Nominations",
  "7.01": "Regulation FD Disclosure",
  "8.01": "Other Events",
};

/**
 * Formulare außer dem 8-K, die etwas Außergewöhnliches melden. Regelmäßige Berichte (10-K, 10-Q) und
 * Insidergeschäfte (Form 4, die kommen schon von EODHD) fehlen. Die SEC hat SC 13D Ende 2024 in SCHEDULE 13D umbenannt.
 */
const FORMS: Record<string, string> = {
  "10-K/A": "Amended annual report",
  "10-Q/A": "Amended quarterly report",
  "NT 10-K": "Notification of late filing of the annual report",
  "NT 10-Q": "Notification of late filing of a quarterly report",
  // Ausländische Unternehmen mit US-Notierung (ADRs) berichten jährlich über 20-F.
  "20-F/A": "Amended annual report (foreign issuer)",
  "NT 20-F": "Notification of late filing of the annual report (foreign issuer)",
  "SC 13D": "An investor disclosed a stake above 5 % with intent to influence the company",
  "SC 13D/A": "Amendment by an investor holding above 5 % with intent to influence the company",
  "SCHEDULE 13D": "An investor disclosed a stake above 5 % with intent to influence the company",
  "SCHEDULE 13D/A": "Amendment by an investor holding above 5 % with intent to influence the company",
  "SC TO-T": "Tender offer by a third party for the company's shares",
  "SC TO-T/A": "Amendment to a third-party tender offer",
  "SC 14D9": "Company's recommendation on a tender offer",
  PREM14A: "Preliminary proxy statement for a merger or acquisition",
  DEFM14A: "Definitive proxy statement for a merger or acquisition",
  "25-NSE": "Removal of the shares from listing on an exchange",
  "15-12B": "Termination of registration of the shares",
};

/** Antwort von data.sec.gov/submissions: die Spalten der jüngsten Mitteilungen, je Mitteilung ein Eintrag. */
const Submissions = z.object({
  filings: z.object({
    recent: z
      .object({
        accessionNumber: z.array(z.string()),
        filingDate: z.array(z.string()),
        form: z.array(z.string()),
        items: z.array(z.string()),
        primaryDocument: z.array(z.string()),
      })
      .refine((r) => [r.filingDate, r.form, r.items, r.primaryDocument].every((column) => column.length === r.accessionNumber.length), {
        message: "Spalten unterschiedlich lang",
      }),
  }),
});

/** Zehnstellige CIK, wie data.sec.gov sie im Pfad erwartet; `null`, wenn die Angabe keine CIK ist. */
export function normalizeCik(value: unknown): string | null {
  const digits = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return /^\d{1,10}$/.test(digits) && Number(digits) > 0 ? digits.padStart(10, "0") : null;
}

/** CIK aus der Rohantwort von EODHD (General.CIK); nur US-Titel haben eine. */
export function cikFromFundamentals(fundamentalsJson: string | null): string | null {
  if (!fundamentalsJson) return null;
  const raw = JSON.parse(fundamentalsJson) as { General?: { CIK?: unknown } };
  return normalizeCik(raw.General?.CIK);
}

function describe(form: string, items: string): string | null {
  if (form === "8-K" || form === "8-K/A") {
    const named = items
      .split(",")
      .map((item) => ITEMS[item.trim()])
      .filter((item) => item !== undefined);
    if (named.length === 0) return null;
    return `${form === "8-K/A" ? "Amended current report: " : ""}${named.join("; ")}`;
  }
  return FORMS[form] ?? null;
}

/** Wählt aus der Antwort der SEC die aussagekräftigen Mitteilungen der letzten zwölf Monate bis `asOf`. */
export function selectFilings(submissions: unknown, cik: string, asOf: string): Filing[] {
  const parsed = Submissions.safeParse(submissions);
  if (!parsed.success) throw new Error("EDGAR: unerwartete Antwort.");
  const recent = parsed.data.filings.recent;
  const from = new Date(`${asOf}T00:00:00Z`);
  from.setUTCMonth(from.getUTCMonth() - MONTHS);
  const cutoff = from.toISOString().slice(0, 10);

  const filings: Filing[] = [];
  recent.accessionNumber.forEach((accession, i) => {
    const date = recent.filingDate[i]!;
    if (date < cutoff || date > asOf) return;
    const form = recent.form[i]!;
    const description = describe(form, recent.items[i]!);
    if (description === null) return;
    const folder = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}`;
    const document = recent.primaryDocument[i]!;
    const items = recent.items[i]!.split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
    filings.push({ date, form, description, url: document ? `${folder}/${document}` : `${folder}/`, items });
  });
  return filings.sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIMIT);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * Text eines 8-K ab dem ersten Punkt ("Item 1.02 …"), ohne Deckblatt und HTML, gekürzt auf `EXCERPT_LENGTH` Zeichen.
 * @returns `null`, wenn kein Punkt im Text steht.
 */
export function excerptFrom(document: string): string | null {
  const text = document
    .replace(/<(script|style|ix:header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? entity;
      const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/\s+/g, " ");
  const start = text.search(/Item\s+\d\.\d{2}/);
  if (start < 0) return null;
  const excerpt = text.slice(start).trim();
  if (excerpt.length <= EXCERPT_LENGTH) return excerpt;
  const cut = excerpt.lastIndexOf(" ", EXCERPT_LENGTH);
  return `${excerpt.slice(0, cut > 0 ? cut : EXCERPT_LENGTH)} …`;
}

/** Liest den Anfang eines 8-K; ein einzelnes unlesbares Dokument lässt nur seinen Auszug weg. */
async function readExcerpt(filing: Filing, userAgent: string): Promise<string | null> {
  try {
    const response = await fetch(filing.url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(30_000) });
    return response.ok ? excerptFrom(await response.text()) : null;
  } catch {
    return null;
  }
}

/**
 * Holt die Mitteilungen eines Unternehmens. Die SEC verlangt einen User-Agent mit Kontaktangabe (`SEC_USER_AGENT`).
 * @returns `null`, wenn kein User-Agent gesetzt ist.
 */
export async function fetchFilings(cik: string, asOf: string, userAgent = process.env.SEC_USER_AGENT): Promise<Filing[] | null> {
  if (!userAgent) return null;
  const response = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`EDGAR antwortet mit ${response.status}.`);
  const filings = selectFilings(await response.json(), cik, asOf);
  // Nacheinander statt parallel: die SEC lässt höchstens zehn Abfragen je Sekunde zu.
  const weighty = filings
    .filter((f) => f.form.startsWith("8-K") && !f.url.endsWith("/") && f.items.some((item) => EXCERPT_ITEMS.has(item)))
    .slice(0, MAX_EXCERPTS);
  for (const filing of weighty) {
    const excerpt = await readExcerpt(filing, userAgent);
    if (excerpt !== null) filing.excerpt = excerpt;
  }
  return filings;
}
