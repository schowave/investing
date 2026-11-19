import { describe, expect, it } from "vitest";
import { dividendLevel, dividendWasCut } from "../calc/index.ts";
import { Database } from "../data/db.ts";
import { foundedYearFrom, parseEodhdFundamentals, stockFromEodhd } from "../data/eodhdFundamentals.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { valueStock } from "./run.ts";
import type { InputValues } from "./valuation.ts";
import {
  dividendsByYear,
  doubtfulNumbers,
  evaluate,
  INPUT_KEYS,
  priceInReportingCurrency,
  proposeInputs,
  unadjustedSplit,
} from "./valuation.ts";

describe("proposeInputs", () => {
  it("leitet Rückfluss, Wachstum und Zahlenfaktoren aus zehn Jahren ab", () => {
    const { values, details, notes } = proposeInputs(stock, steadyYears(), 1, 2026);
    expect(details.earningsLevel).toBeCloseTo(5.9);
    // Dividende 2 plus Rückkäufe 1 je Aktie; nicht gemeldete Vergütung zählt als 0. Tragbar wären 4.
    expect(values.payoutLevel).toBeCloseTo(3);
    expect(values.growth).toBeCloseTo((5.7 / 5.2) ** 0.2 - 1);
    expect(values["risk.earnings"]).toBe(-0.1);
    expect(values["risk.financing"]).toBe(0);
    expect(values["risk.size"]).toBe(0);
    expect(values["risk.age"]).toBe(0);
    expect(values["risk.country"]).toBe(0);
    expect(values["risk.ebitMargin"]).toBeCloseTo(0);
    expect(values["risk.cashFlow"]).toBe(0);
    expect(values["risk.currency"]).toBe(0);
    expect(values["risk.moat"]).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it("deckelt den Rückfluss auf den freien Cashflow und meldet das", () => {
    const { values, notes } = proposeInputs(
      stock,
      steadyYears((y) => (y.freeCashFlow = 250)),
      1,
      2026,
    );
    expect(values.payoutLevel).toBeCloseTo(2.5);
    expect(notes.some((n) => n.includes("gedeckelt"))).toBe(true);
  });

  it("macht bei weniger als zehn Jahren nur Vorschläge aus den Stammdaten", () => {
    const { values, notes } = proposeInputs(stock, steadyYears().slice(3), 1, 2026);
    expect(values.payoutLevel).toBeUndefined();
    expect(values["risk.earnings"]).toBeUndefined();
    expect(values["risk.currency"]).toBe(0);
    expect(notes[0]).toContain("Nur 7 Geschäftsjahre");
  });

  it("schlägt bei Finanzwerten Finanzierung, Kapitalrendite und Marge nicht vor und nimmt das Gewinnniveau als Deckel", () => {
    const { values, details } = proposeInputs(
      { ...stock, isFinancial: true },
      steadyYears((y) => (y.freeCashFlow = null)),
      1,
      2026,
    );
    expect(values["risk.financing"]).toBeUndefined();
    expect(values["risk.returnOnCapital"]).toBeUndefined();
    expect(values["risk.ebitMargin"]).toBeUndefined();
    expect(details.sustainablePayout).toBeCloseTo(5.9);
    expect(values.payoutLevel).toBeCloseTo(3);
  });

  it("gibt bei fallendem Gewinn keinen Wachstumsvorschlag", () => {
    const { values, notes } = proposeInputs(
      stock,
      steadyYears((y, i) => (y.epsDiluted = 5 - i * 0.3)),
      1,
      2026,
    );
    expect(values.growth).toBeUndefined();
    expect(notes.some((n) => n.includes("von Hand"))).toBe(true);
  });

  it("begrenzt das Wachstum auf das Umsatzwachstum je Aktie", () => {
    const flat = proposeInputs(
      stock,
      steadyYears((y) => (y.revenue = 5000)),
      1,
      2026,
    );
    expect(flat.values.growth).toBe(0);
    const slow = proposeInputs(
      stock,
      steadyYears((y, i) => (y.revenue = 5000 * 1.01 ** i)),
      1,
      2026,
    );
    expect(slow.values.growth).toBeCloseTo(0.01);
  });

  it("deckelt das Gewinnniveau auf den höchsten Gewinn der letzten drei Jahre", () => {
    const eps = [0.7, 1.5, 1.4, 1.1, 1.6, 3.0, 1.7, 2.5, 3.0, 2.5];
    const { details } = proposeInputs(
      stock,
      steadyYears((y, i) => (y.epsDiluted = eps[i]!)),
      1,
      2026,
    );
    expect(details.earningsLevel).toBe(3.0);
  });

  it("zählt Rückkäufe nicht doppelt: bei schrumpfender Aktienzahl gilt das Wachstum des Gesamtgewinns", () => {
    // Gesamtgewinn konstant bei 500, die Aktienzahl sinkt um 5 % im Jahr: je Aktie wächst der Gewinn, insgesamt nicht.
    const years = steadyYears((y, i) => {
      y.shares = 100 * 0.95 ** i;
      y.epsDiluted = 500 / y.shares;
    });
    const { values, details } = proposeInputs(stock, years, 1, 2026);
    expect(details.earningsGrowthPerShare!).toBeGreaterThan(0.05);
    expect(details.earningsGrowthTotal!).toBeCloseTo(0);
    expect(values.growth).toBeCloseTo(0);
  });

  it("nimmt bei Verwässerung das Wachstum je Aktie", () => {
    const years = steadyYears((y, i) => {
      y.shares = 100 * 1.05 ** i;
      y.epsDiluted = (500 * 1.06 ** i) / y.shares;
    });
    const { details } = proposeInputs(stock, years, 1, 2026);
    expect(details.historicalGrowth!).toBeCloseTo(details.earningsGrowthPerShare!);
    expect(details.earningsGrowthTotal!).toBeGreaterThan(details.earningsGrowthPerShare!);
  });

  it("zieht die Tilgung überhöhter Schulden vom tragbaren Rückfluss ab und bewertet die Finanzierung", () => {
    // EBITDA rund 1174 im letzten Jahr; Nettoschulden 5000 liegen über dem Dreifachen, der Überhang wird in zehn Jahren getilgt.
    const years = steadyYears((y) => {
      y.netDebt = 5000;
      y.interestExpense = 300;
    });
    const { values, details, notes } = proposeInputs(stock, years, 1, 2026);
    const ebitda = 900 * 1.03 ** 9;
    expect(details.debtRepaymentPerShare!).toBeCloseTo((5000 - 3 * ebitda) / 10 / 100);
    expect(details.sustainablePayout!).toBeCloseTo(4 - details.debtRepaymentPerShare!);
    expect(values.payoutLevel!).toBeCloseTo(details.sustainablePayout!);
    expect(values["risk.financing"]!).toBeGreaterThan(0.3);
    expect(notes.some((n) => n.includes("Tilgung"))).toBe(true);
  });

  it("bewertet die Größe nicht ohne Wechselkurs und das Alter ohne Gründungsjahr nur bei langer Historie", () => {
    const young = proposeInputs({ ...stock, foundedYear: null }, steadyYears(), null, 2026).values;
    expect(young["risk.size"]).toBeUndefined();
    expect(young["risk.age"]).toBeUndefined();
    const long = [...steadyYears((y) => (y.fiscalYear -= 15)), ...steadyYears()];
    expect(proposeInputs({ ...stock, foundedYear: null }, long, 1, 2026).values["risk.age"]).toBe(0);
  });
});

describe("Dividendenniveau", () => {
  it("wertet kleine Schwankungen nicht als Kürzung", () => {
    const series = [3.2, 3.3, 3.293, 3.407, 3.39, 3.39, 3.4, 3.4, 3.4, 3.4];
    expect(dividendWasCut(series)).toBe(false);
    expect(dividendLevel(series)).toBe(3.4);
  });

  it("wird nie negativ", () => {
    expect(dividendLevel([50, 0.5, 0.6, 0.5, 70, 0.2, 0.6, 0.1, 0, 0])).toBe(0);
  });
});

describe("evaluate", () => {
  const full: InputValues = Object.fromEntries(INPUT_KEYS.map((key) => [key, 0]));
  const imperial: InputValues = { ...full, payoutLevel: 3.09, growth: 0.023, "risk.financing": 0.26 };

  it("rechnet das Beispiel Imperial Brands aus den Folien", () => {
    const v = evaluate(imperial, {}, 30);
    expect(v.complete).toBe(true);
    expect(v.defaultProbability).toBeCloseTo(0.018);
    expect(v.returns!.base!).toBeCloseTo(0.106, 2);
    expect(v.returns!.cautious!).toBeLessThan(v.returns!.base!);
  });

  it("lässt manuelle Werte gelten und nennt sie", () => {
    const v = evaluate(imperial, { growth: 0, "risk.moat": -0.2 }, 30);
    expect(v.inputs.growth).toBe(0);
    expect(v.manual).toEqual(["growth", "risk.moat"]);
    expect(v.riskScore).toBeCloseTo(0.06);
  });

  it("ist unvollständig, solange ein Faktor oder der Kurs fehlt, rechnet aber vorläufig", () => {
    const { "risk.management": _, ...rest } = imperial;
    const v = evaluate(rest, {}, 30);
    expect(v.complete).toBe(false);
    expect(v.missing).toEqual(["risk.management"]);
    expect(v.returns!.base).not.toBeNull();
    expect(evaluate(imperial, {}, null).complete).toBe(false);
  });

  it("nimmt mit Gewinnniveau eine steigende Ausschüttungsquote an und weist sie aus", () => {
    const plain = evaluate(imperial, {}, 30);
    expect(plain.payoutRatio).toBeNull();
    // Gewinnniveau 10 bei 3,09 Rückfluss, Wachstum von Hand auf 8 %: Einbehaltenes zählt.
    const grower = evaluate(imperial, { growth: 0.08 }, 30, 0, 10);
    expect(grower.payoutRatio!.now).toBeCloseTo(0.309);
    expect(grower.payoutRatio!.terminal).toBeGreaterThan(0.7);
    expect(grower.returns!.base!).toBeGreaterThan(evaluate(imperial, { growth: 0.08 }, 30).returns!.base!);
    // Wer schon mehr als den Gewinn ausschüttet, bleibt wie er ist.
    expect(evaluate(imperial, {}, 30, 0, 3).payoutRatio).toBeNull();
    expect(evaluate(imperial, {}, 30, 0, 3).returns).toEqual(plain.returns);
  });

  it("zieht bei Fremdwährung den Inflationsunterschied ab und zeigt die Rendite in Landeswährung", () => {
    const euro = evaluate(imperial, {}, 30);
    const tenge = evaluate(imperial, {}, 30, 0.043);
    expect(tenge.localReturn).toBeCloseTo(euro.returns!.base!);
    expect(tenge.returns!.base!).toBeCloseTo((1 + euro.returns!.base!) / 1.043 - 1);
    expect(tenge.returns!.cautious!).toBeLessThan(tenge.returns!.base!);
  });

  it("rechnet Kurse in die Berichtswährung um", () => {
    expect(priceInReportingCurrency(100, 1.25, 500)).toBeCloseTo(40000);
    expect(priceInReportingCurrency(100, 1.25, null)).toBeNull();
  });
});

describe("Datenbank", () => {
  it("speichert manuelle Werte und den Tagesstand der Bewertung", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
    expect(db.stocks().map((s) => s.id)).toEqual(["TEST.US"]);
    expect(db.stocks({ includeStockpile: true })).toHaveLength(2);

    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.saveRawCloses(stock.id, [{ date: "2026-11-18", close: 40 }]);
    db.setManualInput(stock.id, "growth", 0.01, "vorsichtig");
    db.setManualInput(stock.id, "risk.moat", 0.05);
    db.clearManualInput(stock.id, "risk.moat");

    const result = valueStock(db, stock, "2026-11-19");
    expect(result.valuation.manual).toEqual(["growth"]);
    expect(result.valuation.price).toBe(40);
    const stored = db.latestValuation(stock.id)!;
    expect(stored.date).toBe("2026-11-19");
    expect(stored.complete).toBe(false);
    expect(stored.innerReturn).toBeCloseTo(result.valuation.returns!.base!);
    db.close();
  });
});

describe("stockFromEodhd", () => {
  it("leitet Stammdaten für den Datenvorrat ab und erkennt Pence-Notizen", () => {
    const parsed = parseEodhdFundamentals({
      General: { Name: "Beispiel PLC", CurrencyCode: "GBX", CountryISO: "GB", Sector: "Financial Services" },
      Financials: { Income_Statement: { currency_symbol: "GBP", yearly: {} } },
    });
    expect(stockFromEodhd("BSP.LSE", parsed)).toMatchObject({
      name: "Beispiel PLC",
      region: "Europa",
      reportingCurrency: "GBP",
      priceCurrency: "GBP",
      priceDivisor: 100,
      isFinancial: true,
      watched: false,
      foundedYear: null,
    });
  });
});

describe("Rohantworten und Gründungsjahr", () => {
  it("speichert Rohantworten gepackt und liest auch alte ungepackte", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    const body = JSON.stringify({ General: { Name: "Tést" }, text: "x".repeat(5000) });
    db.saveRawDocument(stock.id, "eodhd-fundamentals", body);
    expect(db.rawDocument(stock.id, "eodhd-fundamentals")!.body).toBe(body);
    expect(db.compressRawDocuments()).toBe(0);
    expect([...db.stockIdsWithRawDocument("eodhd-fundamentals")]).toEqual([stock.id]);
    db.close();
  });

  it("liest das Gründungsjahr aus dem Beschreibungstext", () => {
    expect(foundedYearFrom("Imperial Brands PLC was founded in 1901 and is headquartered in Bristol.")).toBe(1901);
    expect(foundedYearFrom("The company was incorporated in 1996. It was founded in 1865.")).toBe(1865);
    expect(foundedYearFrom("Founded in 3021 by nobody.")).toBeNull();
    expect(foundedYearFrom(null)).toBeNull();
  });

  it("trägt das Gründungsjahr nur nach, wenn keines gesetzt ist", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.addStockIfMissing({ ...stock, id: "NEU.US", foundedYear: null });
    db.setFoundedYearIfMissing(stock.id, 1800);
    db.setFoundedYearIfMissing("NEU.US", 1990);
    expect(db.stock(stock.id)!.foundedYear).toBe(1950);
    expect(db.stock("NEU.US")!.foundedYear).toBe(1990);
    db.close();
  });
});

describe("Dividendenhistorie und Splits", () => {
  const pay = (date: string, value: number, currency = "GBP", period = "Quarterly") => ({ date, value, currency, period });

  it("summiert regelmäßige Dividenden je Jahr, ohne Sonderzahlungen und ohne angekündigte", () => {
    const byYear = dividendsByYear(
      [
        pay("2024-03-01", 0.5),
        pay("2024-09-01", 0.6),
        pay("2025-03-01", 0.7),
        pay("2025-06-01", 3, "GBP", "Special"),
        pay("2027-02-18", 0.9),
      ],
      "GBP",
      "2026-11-19",
    )!;
    expect([...byYear]).toEqual([
      [2024, 1.1],
      [2025, 0.7],
    ]);
  });

  it("rechnet Pence in Pfund und gibt bei fremder Währung auf", () => {
    expect(dividendsByYear([pay("2025-03-01", 40, "GBX")], "GBP", "2026-11-19")!.get(2025)).toBeCloseTo(0.4);
    expect(dividendsByYear([pay("2025-03-01", 0.4, "USD")], "KZT", "2026-11-19")).toBeNull();
  });

  it("nimmt für die Bewertung die Dividendenhistorie, wenn sie vorliegt", () => {
    const history = { dividendsByYear: new Map(steadyYears().map((y) => [y.fiscalYear, 1.5] as [number, number])), splits: [] };
    const { details } = proposeInputs(stock, steadyYears(), 1, 2026, history);
    expect(details.dividendsFromHistory).toBe(true);
    expect(details.dividendLevel).toBe(1.5);
    // Ein Jahr ohne Eintrag heißt: keine Dividende gezahlt.
    const none = proposeInputs(stock, steadyYears(), 1, 2026, { dividendsByYear: new Map(), splits: [] });
    expect(none.details.dividendLevel).toBe(0);
  });

  it("verwirft eine Dividendenhistorie in anderer Stückelung und erkennt daran einen unbereinigten Split", () => {
    // Abschlüsse rechnen mit 2 je Aktie, die Historie mit 0,4: Faktor 5 wie der Split.
    const fifth = new Map(steadyYears().map((y) => [y.fiscalYear, 0.4] as [number, number]));
    const split = proposeInputs(stock, steadyYears(), 1, 2026, { dividendsByYear: fifth, splits: [{ date: "2025-02-11", ratio: 5 }] });
    expect(split.details.dividendsFromHistory).toBe(false);
    expect(split.details.dividendLevel).toBe(2);
    expect(split.details.unadjustedSplit).toEqual({ date: "2025-02-11", ratio: 5 });

    // Ohne passenden Split (Hinterlegungsschein): nur ein Hinweis, kein Split-Verdacht.
    const receipt = proposeInputs(stock, steadyYears(), 1, 2026, { dividendsByYear: fifth, splits: [] });
    expect(receipt.details.unadjustedSplit).toBeNull();
    expect(receipt.notes.some((n) => n.includes("Stückelungen"))).toBe(true);
  });

  it("erkennt einen Split, um den die Aktienzahl nicht bereinigt ist", () => {
    const jumped = [2023, 2024, 2025].map((fiscalYear) => ({ fiscalYear, shares: fiscalYear >= 2025 ? 500 : 100 }));
    const steady = [2023, 2024, 2025].map((fiscalYear) => ({ fiscalYear, shares: 500 }));
    const split = [{ date: "2025-02-11", ratio: 5 }];
    expect(unadjustedSplit(jumped, split)).toEqual(split[0]);
    expect(unadjustedSplit(steady, split)).toBeNull();
    expect(unadjustedSplit(jumped, [])).toBeNull();

    const years = steadyYears((y) => (y.shares = y.fiscalYear >= 2025 ? 500 : 100));
    const { notes, details } = proposeInputs(stock, years, 1, 2026, { dividendsByYear: null, splits: split });
    expect(details.unadjustedSplit).toEqual(split[0]);
    expect(notes.some((n) => n.includes("Aktiensplit"))).toBe(true);
  });
});

describe("doubtfulNumbers", () => {
  const years = steadyYears();

  it("begründet, warum Zahlen und Kurs nicht zusammenpassen", () => {
    const proposals = proposeInputs(stock, years, 1, 2026);
    expect(doubtfulNumbers(evaluate(proposals.values, {}, 40), proposals)).toBeNull();
    // Kurs beim Doppelten des Gewinnniveaus; kleiner Rückfluss, damit nur diese Regel greift.
    const earnings = proposals.details.earningsLevel!;
    const cheap = evaluate(proposals.values, { payoutLevel: earnings * 0.1 }, earnings * 2);
    expect(doubtfulNumbers(cheap, proposals)).toBe("Kurs ist nur das 2,0-Fache des Gewinnniveaus.");
    expect(doubtfulNumbers(evaluate(proposals.values, { payoutLevel: 20 }, 40), proposals)).toBe("Rückfluss ist 50 % des Kurses.");
  });

  it("nennt einen unbereinigten Split zuerst", () => {
    const shares = steadyYears((y) => (y.shares = y.fiscalYear >= 2025 ? 500 : 100));
    const proposals = proposeInputs(stock, shares, 1, 2026, { dividendsByYear: null, splits: [{ date: "2025-02-11", ratio: 5 }] });
    expect(doubtfulNumbers(evaluate(proposals.values, {}, 40), proposals)).toBe(
      "Aktiensplit vom 2025-02-11 ist in den Zahlen nicht bereinigt.",
    );
  });
});
