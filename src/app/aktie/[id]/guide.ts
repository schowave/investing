// Hilfe "Wo nachsehen?" auf der Aktienseite: wo man die Angabe für eine Eingabe findet und welcher Wert welche
// Lage bedeutet. Die Stufen der Urteilsfaktoren kommen mit ihren Werten aus `FACTOR_QUESTIONS`, damit Hilfe und
// Jev denselben Maßstab haben; hier stehen nur die deutschen Kurzfassungen.

import type { RiskFactorId } from "../../../calc/index.ts";
import { FACTOR_QUESTIONS, type JudgedFactor } from "../../../judgement/factors.ts";
import type { InputKey } from "../../../valuation/valuation.ts";

export interface Guide {
  /** Wo die Angabe steht, kurz und in der Reihenfolge, in der man nachsieht. */
  sources: string[];
  /** Was ein Wert bedeutet, vom besten zum schlechtesten Fall; Wert als Anteil (0.1 = 10 %). */
  levels?: { value: number; text: string }[];
}

/** Deutsche Kurzfassung je Stufe, in der Reihenfolge von `FACTOR_QUESTIONS`. */
const LEVEL_TEXT: Record<JudgedFactor, string[]> = {
  sector: [
    "gewöhnliche Branche, Produkte ändern sich langsam, keine Subventionen",
    "schnelllebiger, aber mehrere Produkte und frühere Umbrüche überstanden",
    "schnelllebig, Marktführer werden regelmäßig verdrängt (Halbleiter, Hardware, Mode) oder auf Subventionen angewiesen",
    "im Kern ein Produkt in schnelllebiger Branche oder ohne Subventionen nicht lebensfähig",
  ],
  moat: [
    "außergewöhnlicher Vorsprung und Preissetzungsmacht über viele Jahre",
    "dauerhafter Vorteil, klar stärker als die Konkurrenz",
    "durchschnittlich, wie typische Wettbewerber",
    "schwächer als die Konkurrenz: dauerhaft niedrigere Margen oder verliert Marktanteile",
    "kein Vorteil, Preisnehmer, leicht ersetzbar",
  ],
  management: [
    "belegt hervorragend: lange gute Kapitalverwendung, Gründer oder Vorstand hoch beteiligt",
    "keine Hinweise auf schlechtes oder unredliches Management",
    "wiederholt wertvernichtende Zukäufe oder Strategiefehler",
    "Geschäfte zum Vorteil von Insidern, Sanktionen, irreführende Aussagen",
    "Verdacht auf Betrug, Bilanzmanipulation, Anklagen gegen die Führung",
  ],
  forecast: [
    "stetige Zahlen, kein bekanntes Ereignis stellt die Gewinne infrage",
    "zyklisch oder sprunghaft, aber das Niveau über einen Zyklus ist klar",
    "absehbarer Umbruch bewegt die Gewinne, aber in Grenzen",
    "Umbau mit offenem Ausgang, kurze oder gebrochene Historie",
    "künftiges Gewinnniveau nicht abschätzbar",
  ],
  dependencies: [
    "kein einzelner Kunde, Lieferant oder Rohstoff fällt ins Gewicht",
    "ein Kunde, Lieferant oder Rohstoff steht für einen großen Teil von Umsatz oder Kosten",
    "das Geschäft hängt an einem Rohstoffpreis, Kunden, Lieferanten, einer Lizenz oder Konzession",
  ],
  situation: [
    "keine Krise, gewöhnlicher Gegenwind zählt nicht",
    "Ergebnisse stark eingebrochen oder ernste Bedrohung ungeklärt",
    "Verluste, erzwungene Restrukturierung, Probleme mit Kreditauflagen oder Refinanzierung",
    "Überleben oder Kerngeschäft steht auf dem Spiel",
  ],
};

const SOURCES: Record<JudgedFactor, string[]> = {
  sector: [
    "Beschreibung des Geschäfts: Geschäftsbericht, beim 10-K „Item 1. Business“",
    "Frage dich: Gibt es die Produkte in zehn Jahren noch ähnlich? Lebt das Geschäft von Förderung?",
    "Ob du das Geschäft verstehst, kannst nur du beurteilen; im Zweifel Abzug",
  ],
  moat: [
    "Tabelle „Zehn Geschäftsjahre“ unten: EBIT-Marge und Kapitalrendite über Jahre hoch und stabil spricht für einen Vorteil",
    "Geschäftsbericht, Abschnitt Wettbewerb (10-K „Item 1. Business“, „Competition“)",
    "Morningstar „Economic Moat“ (none / narrow / wide) als zweite Meinung",
  ],
  management: [
    "Recherche von Jev rechts unter „Recherche lesen“",
    "Nachrichtensuche nach Firmenname plus „fraud“, „restatement“, „SEC investigation“, „Skandal“",
    "Einladung zur Hauptversammlung (in den USA „Proxy Statement“, DEF 14A): Beteiligung und Vergütung des Vorstands",
  ],
  forecast: [
    "Tabelle „Zehn Geschäftsjahre“ unten: Wie gleichmäßig laufen Gewinn und Umsatz?",
    "Geschäftsbericht, Risiken (10-K „Item 1A. Risk Factors“): Patentablauf, auslaufende Lizenz, Umbau",
    "Ausblick im Lagebericht (10-K „Item 7. MD&A“) mit früheren Ausblicken vergleichen",
  ],
  dependencies: [
    "Geschäftsbericht, Risiken (10-K „Item 1A. Risk Factors“): Großkunden, Lieferanten, Rohstoffe",
    "Segment- und Kundenangaben im Anhang: Ein Kunde über 10 % des Umsatzes muss in den USA genannt werden",
  ],
  situation: [
    "Hinweis „Lage selbst prüfen“ oben, falls angezeigt",
    "Jüngste Quartalsmeldung und Nachrichten der letzten Wochen (Investor-Relations-Seite, Nachrichtensuche)",
    "Ein gefallener Kurs allein ist keine Krise",
  ],
};

/** Hilfe für eine Eingabe, sofern es eine gibt. Faktoren aus Zahlen brauchen sie nur, wenn sie von Hand gesetzt werden. */
export function guideFor(key: InputKey, isJudgement: boolean): Guide | null {
  if (key === "payoutLevel")
    return {
      sources: [
        "Ausgangspunkt ist der Vorschlag; die Herleitung steht rechts unter „Herleitung der Vorschläge“",
        "Angekündigte Dividende fürs kommende Jahr: Investor-Relations-Seite oder Dividendenkalender",
        "Netto-Rückkäufe: Programm aus der letzten Ergebnismeldung, je Aktie gerechnet, abzüglich neu ausgegebener Aktien",
        "Obergrenze: Cashflow je Aktie aus der Kapitalflussrechnung, abzüglich Aktienvergütung; bei schwankendem Gewinn der Median über bis zu zehn Jahre",
      ],
    };
  if (key === "growth")
    return {
      sources: [
        "Rechts unter „Herleitung der Vorschläge“: Wachstum von Gewinn und Umsatz, die Grenze aus Einbehaltung",
        "Tabelle „Zehn Geschäftsjahre“: Wie hat sich Gewinn je Aktie entwickelt?",
        "Ausblick des Unternehmens (Ergebnismeldung, 10-K „Item 7. MD&A“) und Analystenschätzungen als Gegenprobe",
        "Vorsichtig ansetzen: Der Wert gilt nur zu Beginn und schmilzt dann ab",
      ],
    };
  if (!key.startsWith("risk.") || !isJudgement) return null;
  const factorId = key.slice("risk.".length) as RiskFactorId;
  if (factorId in FACTOR_QUESTIONS) {
    const judged = factorId as JudgedFactor;
    return {
      sources: SOURCES[judged],
      levels: FACTOR_QUESTIONS[judged].levels.map((level, index) => ({ value: level.value, text: LEVEL_TEXT[judged][index]! })),
    };
  }
  // Bei Banken und Versicherern sind Finanzierung, Kapitalrendite und EBIT-Marge Urteil.
  const financial: Partial<Record<RiskFactorId, string[]>> = {
    financing: ["Harte Kernkapitalquote (CET1) bzw. Solvenzquote im Geschäftsbericht; deutlich über dem Mindestwert heißt 0"],
    returnOnCapital: ["Eigenkapitalrendite (RoE) über mehrere Jahre im Geschäftsbericht; über 10 % heißt 0"],
    ebitMargin: ["Bei Banken die Aufwand-Ertrag-Quote (Cost-Income-Ratio), bei Versicherern die Schaden-Kosten-Quote"],
  };
  const sources = financial[factorId];
  return sources ? { sources } : null;
}
