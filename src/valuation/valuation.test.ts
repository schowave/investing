import { describe, expect, it } from "vitest";
import { dividendLevel, dividendWasCut, toLocalTerms } from "../calc/index.ts";
import type { FundamentalsYear } from "../data/db.ts";
import { Database } from "../data/db.ts";
import { foundedYearFrom, parseEodhdFundamentals, stockFromEodhd } from "../data/eodhdFundamentals.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { recomputeAll } from "./recompute.ts";
import { computeValuation, inflationGapOf, valueStock } from "./run.ts";
import type { InputValues } from "./valuation.ts";
import {
  dividendsByYear,
  doubtfulNumbers,
  evaluate,
  evaluateFields,
  growthInputBounds,
  growthRangeText,
  INPUT_KEYS,
  parseManualInput,
  priceInReportingCurrency,
  priceSensitivity,
  proposeInputs,
  unadjustedSplit,
  withSuggestions,
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

  it("macht bei weniger als fünf Jahren nur Vorschläge aus den Stammdaten", () => {
    const { values, notes } = proposeInputs(stock, steadyYears().slice(6), 1, 2026);
    expect(values.payoutLevel).toBeUndefined();
    expect(values["risk.earnings"]).toBeUndefined();
    expect(values["risk.currency"]).toBe(0);
    expect(notes[0]).toContain("Nur 4 Geschäftsjahre");
  });

  it("bewertet junge Börsenwerte aus fünf bis neun Jahren, ohne Bonus für Stetigkeit", () => {
    const { values, details, notes } = proposeInputs(stock, steadyYears().slice(3), 1, 2026);
    expect(details.fiscalYears).toHaveLength(7);
    expect(notes[0]).toContain("Nur 7 statt 10 Geschäftsjahre");
    expect(values.payoutLevel).toBeCloseTo(3);
    // Erste gegen letzte drei Jahre, vier Jahre auseinander.
    expect(values.growth).toBeCloseTo((5.8 / 5.4) ** 0.25 - 1);
    // Jedes Jahr gestiegen, aber der Bonus verlangt zehn Jahre.
    expect(values["risk.earnings"]).toBe(0);
    expect(values["risk.cashFlow"]).toBe(0);
  });

  it("gibt bei kurzer Reihe keinen Nachlass auf Schulden für stetige Gewinne", () => {
    const indebted = (y: { netDebt: number | null }) => (y.netDebt = 3600);
    const full = proposeInputs(stock, steadyYears(indebted), 1, 2026).values["risk.financing"]!;
    const short = proposeInputs(stock, steadyYears(indebted).slice(3), 1, 2026).values["risk.financing"]!;
    // Nettoschulden beim Sechsfachen des operativen Cashflows: voller Abzug 30 %, bei zehn stetig steigenden Jahren 40 % davon.
    expect(full).toBeCloseTo(0.12);
    expect(short).toBeCloseTo(0.3);
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

  it("gibt Finanzwerten Ersatzabzüge für die drei offenen Faktoren, anderen Titeln keine", () => {
    const bank = proposeInputs({ ...stock, isFinancial: true }, steadyYears(), 1, 2026);
    expect(bank.standIns).toEqual({ "risk.financing": 0.1, "risk.returnOnCapital": 0.05, "risk.ebitMargin": 0.025 });
    // Auch ohne brauchbare Reihe: Der Risikowert soll nicht mit dem besten Ergebnis rechnen.
    expect(proposeInputs({ ...stock, isFinancial: true }, [], 1, 2026).standIns).toEqual(bank.standIns);
    expect(proposeInputs(stock, steadyYears(), 1, 2026).standIns).toEqual({});
  });

  it("schlägt bei fallendem Gewinn das negative Wachstum vor", () => {
    const { values, notes } = proposeInputs(
      stock,
      steadyYears((y, i) => (y.epsDiluted = 5 - i * 0.3)),
      1,
      2026,
    );
    expect(values.growth).toBeLessThan(0);
    expect(values.growth).toBeGreaterThanOrEqual(-0.05);
    expect(notes.some((n) => n.includes("Gewinn schrumpft"))).toBe(true);
  });

  it("schätzt bei Verlusten am Anfang oder Ende der Reihe das Wachstum aus dem Umsatz, höchstens 3 % bzw. 0 %", () => {
    const growingRevenue = (y: { revenue: number | null }, i: number) => (y.revenue = 1000 * 1.1 ** i);
    const recovery = proposeInputs(
      stock,
      steadyYears((y, i) => {
        y.epsDiluted = i < 5 ? -1 : 2;
        growingRevenue(y, i);
      }),
      1,
      2026,
    );
    expect(recovery.values.growth).toBeCloseTo(0.03);
    expect(recovery.notes.some((n) => n.includes("Verluste am Anfang") && n.includes("bis 3 %"))).toBe(true);
    const losses = proposeInputs(
      stock,
      steadyYears((y, i) => {
        y.epsDiluted = i < 5 ? 2 : -1;
        growingRevenue(y, i);
      }),
      1,
      2026,
    );
    expect(losses.values.growth).toBe(0);
    expect(losses.notes.some((n) => n.includes("Verluste am Ende") && n.includes("bis 0 %"))).toBe(true);
  });

  it("gibt ohne bestimmbares Gewinnwachstum und ohne vollständigen Umsatz keinen Wachstumsvorschlag", () => {
    const { values, notes } = proposeInputs(
      stock,
      steadyYears((y, i) => {
        y.epsDiluted = i < 5 ? -1 : 2;
        if (i === 3) y.revenue = null;
      }),
      1,
      2026,
    );
    expect(values.growth).toBeUndefined();
    expect(notes.some((n) => n.includes("von Hand"))).toBe(true);
  });

  it("nimmt bei Immobilienwerten den operativen statt des freien Cashflows als tragbaren Rückfluss", () => {
    const years = steadyYears((y) => {
      y.freeCashFlow = -500;
      y.operatingCashFlow = 3000;
    });
    const reit = proposeInputs({ ...stock, sector: "Real Estate" }, years, 1, 2026);
    expect(reit.details.sustainableFrom).toBe("operatingCashFlow");
    expect(reit.details.sustainablePayout).toBeGreaterThan(0);
    expect(reit.values.payoutLevel).toBeGreaterThan(0);
    // Anleihen von Versorgern führt der Anbieter als REIT; nach GICS sind sie keine Immobilienwerte.
    const utilityBond = proposeInputs({ ...stock, sector: "Real Estate", gicSector: "Utilities" }, years, 1, 2026);
    expect(utilityBond.details.sustainableFrom).toBe("freeCashFlow");
    expect(proposeInputs({ ...stock, sector: "Real Estate", gicSector: "Real Estate" }, years, 1, 2026).details.sustainableFrom).toBe(
      "operatingCashFlow",
    );
    const other = proposeInputs(stock, years, 1, 2026);
    expect(other.details.sustainableFrom).toBe("freeCashFlow");
    expect(other.values.payoutLevel).toBe(0);
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
    // Nettoschulden beim 8,3-Fachen des operativen Cashflows: voller Abzug von 30 %. Der Gewinn steigt jedes Jahr,
    // deshalb zählen davon 40 %.
    expect(values["risk.financing"]!).toBeCloseTo(0.12);
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

  it("rechnet offene Faktoren mit Ersatzabzug, lässt sie aber offen; ein gesetzter Wert geht vor", () => {
    const { "risk.financing": _f, "risk.returnOnCapital": _r, "risk.ebitMargin": _e, ...bank } = imperial;
    const standIns: InputValues = { "risk.financing": 0.1, "risk.returnOnCapital": 0.05, "risk.ebitMargin": 0.025 };
    const without = evaluate(bank, {}, 30);
    const v = evaluate(bank, {}, 30, 0, null, null, standIns);
    expect(without.riskScore).toBeCloseTo(0);
    expect(v.riskScore).toBeCloseTo(0.175);
    expect(v.standIns).toEqual(standIns);
    expect(v.defaultProbability).toBeCloseTo(0.005 + 0.05 * 0.175);
    expect(v.missing).toEqual(["risk.financing", "risk.returnOnCapital", "risk.ebitMargin"]);
    expect(v.complete).toBe(false);
    expect(v.returns!.base!).toBeLessThan(without.returns!.base!);

    // Ein Urteil ersetzt den Ersatzabzug, auch ein Bonus.
    const judged = evaluate(bank, { "risk.returnOnCapital": -0.05 }, 30, 0, null, null, standIns);
    expect(judged.riskScore).toBeCloseTo(0.075);
    expect(judged.standIns).toEqual({ "risk.financing": 0.1, "risk.ebitMargin": 0.025 });

    // Der Ausschluss prüft ohne Ersatzabzug: Ein Urteil kann ihn wieder senken.
    expect(v.riskFloor).toBeCloseTo(0);
    expect(judged.riskFloor).toBeCloseTo(0);

    // Gesetzt sind alle Faktoren: kein Ersatzabzug mehr, Risikowert und Untergrenze fallen zusammen (Zielportfolio).
    const complete = evaluate(imperial, {}, 30, 0, null, null, standIns);
    expect(complete.standIns).toEqual({});
    expect(complete.riskScore).toBe(complete.riskFloor);
    expect(complete.complete).toBe(true);

    // Boni anderer Faktoren verrechnen sich mit dem Ersatzabzug, der Risikowert bleibt mindestens 0.
    const bonus = evaluate({ ...bank, "risk.moat": -0.2, "risk.management": -0.1 }, {}, 30, 0, null, null, standIns);
    expect(bonus.riskFloor).toBe(0);
    expect(bonus.riskScore).toBe(0);
    const someBonus = evaluate({ ...bank, "risk.moat": -0.1 }, {}, 30, 0, null, null, standIns);
    expect(someBonus.riskScore).toBeCloseTo(0.075);

    // Vorschau beim Tippen und Vorschau mit Vorschlägen rechnen genauso.
    const typed = evaluateFields({ "risk.financing": "0" }, bank, 30, 0, null, null, standIns);
    expect("error" in typed ? null : typed.riskScore).toBeCloseTo(0.075);
    expect(withSuggestions(v, { "risk.ebitMargin": 0 })!.riskScore).toBeCloseTo(0.15);
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

  it("zeigt vorab, was offene Urteile mit Vorschlägen ergäben, ohne gesetzte Werte zu ändern", () => {
    const { "risk.management": _m, "risk.moat": _w, ...rest } = imperial;
    const v = evaluate(rest, { growth: 0.01 }, 30, 0.01, 10);
    const preview = withSuggestions(v, { "risk.management": 0.1, "risk.moat": -0.05, growth: 0.2 })!;
    expect(preview.complete).toBe(true);
    expect(preview.riskScore).toBeCloseTo(v.riskScore + 0.05);
    expect(preview.inputs.growth).toBe(0.01);
    expect(preview.returns!.base!).toBeLessThan(v.returns!.base!);
    expect(preview.returns!.base!).toEqual(
      evaluate({ ...imperial, "risk.management": 0.1, "risk.moat": -0.05 }, { growth: 0.01 }, 30, 0.01, 10).returns!.base,
    );
    expect(withSuggestions(v, { growth: 0.2 })).toBeNull();
  });

  it("rechnet die Felder des Formulars wie Speichern: leer heißt Vorschlag, Fehler werden gemeldet", () => {
    const { "risk.management": _, ...rest } = imperial;
    const fields = { growth: " 1,5 ", "risk.management": "10", payoutLevel: "" };
    const v = evaluateFields(fields, rest, 30, 0.01, 10);
    expect(v).toEqual(evaluate(rest, { growth: 0.015, "risk.management": 0.1 }, 30, 0.01, 10));
    expect(evaluateFields({ "risk.management": "abc" }, rest, 30, 0, null)).toEqual({ error: '"abc" ist keine Zahl.' });
    expect(evaluateFields({ growth: "50" }, rest, 30, 0, null)).toEqual({ error: "Wachstum: erlaubt sind −20 bis 30 %." });
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

  it("rechnet einen Finanzwert ohne Urteil mit Ersatzabzug, im Screening wie auf der Aktienseite", () => {
    const db = new Database(":memory:");
    const bank = { ...stock, id: "BANK.US", isFinancial: true, watched: false };
    db.addStockIfMissing(bank);
    db.saveFundamentals(bank.id, steadyYears(), "eodhd");
    db.saveRawCloses(bank.id, [{ date: "2026-11-18", close: 40 }]);

    const { valuation, proposals } = computeValuation(db, bank, "2026-11-19");
    expect(valuation.standIns).toEqual({ "risk.financing": 0.1, "risk.returnOnCapital": 0.05, "risk.ebitMargin": 0.025 });
    // Wie gesetzte Werte im Risikowert, verrechnet mit dem Bonus für stetig steigenden Gewinn; die Untergrenze ohne sie.
    expect(valuation.riskScore).toBeCloseTo(evaluate({ ...proposals.values, ...valuation.standIns }, {}, 40).riskScore);
    expect(valuation.riskScore).toBeGreaterThan(valuation.riskFloor);
    expect(valuation.missing).toEqual(expect.arrayContaining(["risk.financing", "risk.returnOnCapital", "risk.ebitMargin"]));
    expect(valuation.complete).toBe(false);

    recomputeAll(db, "2026-11-19");
    const { row } = db.screening({ includeImplausible: true }, 10).find((r) => r.stock.id === bank.id)!;
    expect(row.riskScore).toBeCloseTo(valuation.riskScore);
    expect(row.innerReturn).toBeCloseTo(valuation.returns!.base!);
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
    // Kurs beim Anderthalbfachen des Gewinnniveaus; kleiner Rückfluss, damit nur diese Regel greift.
    const earnings = proposals.details.earningsLevel!;
    const cheap = evaluate(proposals.values, { payoutLevel: earnings * 0.1 }, earnings * 1.5);
    expect(doubtfulNumbers(cheap, proposals)).toBe("Kurs ist nur das 1,5-Fache des Gewinnniveaus.");
    // Ein Kurs-Gewinn-Verhältnis von 3 und ein Viertel des Kurses als Rückfluss kommen vor (Höegh Autoliners).
    expect(doubtfulNumbers(evaluate(proposals.values, { payoutLevel: earnings * 0.75 }, earnings * 3), proposals)).toBeNull();
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

describe("Inflationsabstand und Wachstumsgrenzen", () => {
  /** Stark wachsendes Unternehmen mit kleinem Eigenkapital, damit nur die Obergrenze 8,5 % greift. */
  const growerYears = () =>
    steadyYears((y, i) => {
      y.epsDiluted = 5 * 1.3 ** i;
      y.revenue = 5000 * 1.3 ** i;
      y.equity = 1000;
    });

  it("deckelt das Wachstum in Euro-Kaufkraft: verschoben um den Abstand, unverändert beim Abstand 0", () => {
    const euro = proposeInputs(stock, growerYears(), 1, 2026);
    expect(euro.values.growth).toBeCloseTo(0.085);
    expect(proposeInputs(stock, growerYears(), 1, 2026, undefined, 0).values.growth).toBe(euro.values.growth);
    const lira = proposeInputs({ ...stock, reportingCurrency: "TRY" }, growerYears(), 1, 2026, undefined, 0.175);
    expect(lira.values.growth).toBeCloseTo(toLocalTerms(0.085, 0.175));
    expect(proposeInputs(stock, growerYears(), 1, 2026, undefined, -0.02).values.growth).toBeCloseTo(1.085 * 0.98 - 1);
  });

  it("nennt die verschobene Untergrenze, wenn das nominale Wachstum unter dem Abstand liegt", () => {
    const slow = () => steadyYears();
    // Wachstum etwa 1,8 % nominal bei 17,5 Punkten Abstand: real schrumpfend.
    const lira = proposeInputs({ ...stock, reportingCurrency: "TRY" }, slow(), 1, 2026, undefined, 0.175);
    expect(lira.notes.some((n) => n.includes("Gewinn schrumpft") && n.includes("Inflationsabstand"))).toBe(true);
    // Die Untergrenze greift: Der Vorschlag ist nicht das gemessene Wachstum, und der Text sagt das.
    expect(lira.values.growth).toBeCloseTo(toLocalTerms(-0.05, 0.175));
    expect(lira.notes.some((n) => n.includes("Gemessen sind") && n.includes("Untergrenze von"))).toBe(true);
    // Zwischen Untergrenze und Abstand bleibt das gemessene Wachstum.
    const mild = proposeInputs(
      { ...stock, reportingCurrency: "TRY" },
      steadyYears((y, i) => (y.epsDiluted = 5 * 1.14 ** i)),
      1,
      2026,
      undefined,
      0.175,
    );
    expect(mild.values.growth).toBeCloseTo(mild.details.historicalGrowth!);
    expect(mild.notes.some((n) => n.includes("Vorschlag ist das gemessene Wachstum"))).toBe(true);
    expect(proposeInputs(stock, slow(), 1, 2026).notes.some((n) => n.includes("schrumpft"))).toBe(false);
  });

  it("verschiebt den erlaubten Bereich für Wachstum von Hand und hat dafür eine Quelle", () => {
    expect(growthInputBounds(0)).toEqual({ min: -20, max: 30 });
    expect(growthRangeText(0)).toBe("−20 bis 30 %");
    expect(parseManualInput("growth", "50")).toEqual({ error: "Wachstum: erlaubt sind −20 bis 30 %." });
    expect(parseManualInput("growth", "50", 0.4)).toEqual({ value: 0.5 });
    // Nach innen auf Zehntel gerundet: 52,75 wird 52,7, und genau das nimmt auch die Prüfung.
    expect(growthInputBounds(0.175)).toEqual({ min: -6, max: 52.7 });
    expect(growthRangeText(0.175)).toBe("−6 bis 52,7 %");
    expect(parseManualInput("growth", "52,7", 0.175)).toEqual({ value: 0.527 });
    expect(parseManualInput("growth", "52,8", 0.175)).toEqual({ error: "Wachstum: erlaubt sind −6 bis 52,7 %." });
    expect(parseManualInput("growth", "-6", 0.175)).toEqual({ value: -0.06 });
    expect(parseManualInput("growth", "-6,1", 0.175)).toHaveProperty("error");
    for (const gap of [-0.03, -0.0075, 0.0123, 0.175, 0.4]) {
      const { min, max } = growthInputBounds(gap);
      expect(parseManualInput("growth", String(min).replace(".", ","), gap)).toHaveProperty("value");
      expect(parseManualInput("growth", String(max), gap)).toHaveProperty("value");
      expect(parseManualInput("growth", String(min - 0.1), gap)).toHaveProperty("error");
      expect(parseManualInput("growth", String(max + 0.1), gap)).toHaveProperty("error");
      // Meldung und Formular nennen dieselben Zahlen.
      expect((parseManualInput("growth", "1000", gap) as { error: string }).error).toContain(growthRangeText(gap));
    }
  });

  it("verwendet in der Bewertung denselben Abstand für Vorschläge und Rendite", () => {
    const db = new Database(":memory:");
    const tryStock = { ...stock, id: "LIRA.IS", reportingCurrency: "TRY", priceCurrency: "TRY" };
    db.addStockIfMissing(tryStock);
    db.saveFundamentals(tryStock.id, growerYears(), "eodhd");
    db.saveRawCloses(tryStock.id, [{ date: "2026-11-18", close: 40 }]);
    db.saveFxRates("2026-11-18", { TRY: 40 });
    expect(inflationGapOf(db, tryStock)).toEqual({ gap: 0, missing: true });
    expect(inflationGapOf(db, stock)).toEqual({ gap: 0, missing: false });
    expect(computeValuation(db, tryStock, "2026-11-19").proposals.notes.some((n) => n.includes("Keine Inflationsprognose"))).toBe(true);

    db.setReferenceRate("inflation:TRY", 0.2, "2026-11-18");
    db.setReferenceRate("inflation:EUR", 0.02, "2026-11-18");
    const { gap } = inflationGapOf(db, tryStock);
    expect(gap).toBeCloseTo(0.18);
    const result = computeValuation(db, tryStock, "2026-11-19");
    expect(result.valuation.inflationGap).toBeCloseTo(0.18);
    expect(result.proposals.values.growth).toBeCloseTo(toLocalTerms(0.085, 0.18));
    db.close();
  });

  describe("ganzer Weg", () => {
    const price = 40;
    /** Vergleichbare Rendite desselben Unternehmens in Euro und in einer Währung mit Abstand `gap`. */
    function viaProposals(gap: number) {
      const euro = proposeInputs(stock, growerYears(), 1, 2026);
      const local = proposeInputs(stock, growerYears(), 1, 2026, undefined, gap);
      const euroValuation = evaluate(euro.values, {}, price, 0, euro.details.earningsLevel);
      // Dasselbe Unternehmen in Lokalwährung: Rückfluss und Gewinn nominal um den Abstand höher.
      const localValuation = evaluate(
        local.values,
        { payoutLevel: euro.values.payoutLevel! * (1 + gap) },
        price,
        gap,
        local.details.earningsLevel! * (1 + gap),
      );
      return { euro, local, euroValuation, localValuation };
    }

    it.each([0.175, -0.02, 0.0123])("liefert Euro und Fremdwährung bei Abstand %s dieselbe vergleichbare Rendite", (gap) => {
      const { euro, local, euroValuation, localValuation } = viaProposals(gap);
      // Die Grenze aus Einbehaltung bindet nicht (kleines Eigenkapital), die feste Grenze 8,5 % schon.
      expect(euro.values.growth).toBeCloseTo(0.085);
      expect(local.values.growth).toBeCloseTo(toLocalTerms(0.085, gap));
      for (const key of ["base", "cautious", "optimistic"] as const) {
        expect(localValuation.returns![key]!).toBeCloseTo(euroValuation.returns![key]!, 8);
      }
    });

    it("rechnet die Grenze aus Einbehaltung in Fremdwährung mit nominaler Eigenkapitalrendite und verschobenen 2 %", () => {
      const bound = () =>
        steadyYears((y, i) => {
          y.epsDiluted = 5 * 1.3 ** i;
          y.revenue = 5000 * 1.3 ** i;
        });
      const euro = proposeInputs(stock, bound(), 1, 2026);
      const lira = proposeInputs(stock, bound(), 1, 2026, undefined, 0.175);
      expect(euro.values.growth).toBeCloseTo(euro.details.retentionCap!);
      expect(lira.values.growth).toBeCloseTo(lira.details.retentionCap!);
      // Nur die Preissteigerung wandert: derselbe Anteil aus Einbehaltung, 2 % werden 19,85 %.
      expect(lira.details.retentionCap! - euro.details.retentionCap!).toBeCloseTo(toLocalTerms(0.02, 0.175) - 0.02);
      expect(lira.details.retentionCap!).toBeLessThan(toLocalTerms(0.085, 0.175));
    });

    it("rechnet Rendite bei anderen Kursen mit dem verschobenen Dauerwachstum", () => {
      const { localValuation: v } = viaProposals(0.175);
      const steps = priceSensitivity(v, [-0.1, 0, 0.1]);
      expect(steps[1]!.innerReturn!).toBeCloseTo(v.returns!.base!, 10);
      expect(steps[0]!.innerReturn!).toBeGreaterThan(steps[1]!.innerReturn!);
      expect(steps[2]!.innerReturn!).toBeLessThan(steps[1]!.innerReturn!);
      // Gleiche Kurse im Euro-Fall: dieselbe Rendite je Schritt.
      const euro = priceSensitivity(viaProposals(0.175).euroValuation, [-0.1, 0.1]);
      expect(steps[0]!.innerReturn!).toBeCloseTo(euro[0]!.innerReturn!, 8);
      expect(steps[2]!.innerReturn!).toBeCloseTo(euro[1]!.innerReturn!, 8);
    });

    it("rechnet bei Rückfluss über dem Gewinn oder ohne Gewinnniveau mit Abstand ohne steigende Quote", () => {
      const inputs: InputValues = { ...Object.fromEntries(INPUT_KEYS.map((key) => [key, 0])), payoutLevel: 3.09, growth: 0.2 };
      const plain = evaluate(inputs, {}, 30, 0.175, null);
      expect(plain.payoutRatio).toBeNull();
      const over = evaluate(inputs, {}, 30, 0.175, 3);
      expect(over.payoutRatio).toBeNull();
      expect(over.returns).toEqual(plain.returns);
      expect(plain.returns!.base).not.toBeNull();
    });
  });
});

describe("Tragbarer Rückfluss über den Zyklus und aktienbasierte Vergütung", () => {
  /** Cashflow je Aktie 1 in den ersten fünf Jahren, 8 in den letzten; Verlustjahr (EBIT negativ) an Stelle `lossAt`, dazu hohe Dividende. */
  const cycleYears = (lossAt: number | null = 4, change: (y: FundamentalsYear, i: number) => void = () => {}) =>
    steadyYears((y, i) => {
      y.freeCashFlow = i < 5 ? 100 : 800;
      y.dividendPerShare = 5;
      if (i === lossAt) {
        y.epsDiluted = -1;
        y.ebit = -100;
      }
      change(y, i);
    });

  it("nimmt bei Verlustjahr den Median der Reihe und sagt es", () => {
    const { values, details, notes } = proposeInputs(stock, cycleYears(), 1, 2026);
    expect(values["risk.earnings"]).toBeGreaterThan(0);
    expect(details.sustainablePayout).toBeCloseTo(4.5);
    expect(details.cashFlowWindow).toEqual({ years: 10, fiveYearAverage: 8, longMedian: 4.5, usedLong: true });
    // Dividende 5 plus Rückkäufe 1 wären 6.
    expect(values.payoutLevel).toBeCloseTo(4.5);
    expect(notes.some((n) => n.includes("Zyklus: Faktor 1") && n.includes("4.50") && n.includes("8.00"))).toBe(true);
    expect(notes.some((n) => n.includes("ganzer Zyklus"))).toBe(false);
  });

  it("rechnet Titel ohne Abzug in Faktor 1 wie bisher mit den letzten fünf Jahren", () => {
    const { values, details, notes } = proposeInputs(stock, cycleYears(null), 1, 2026);
    expect(values["risk.earnings"]).toBe(-0.1);
    expect(details.sustainablePayout).toBeCloseTo(8);
    expect(details.cashFlowWindow).toMatchObject({ years: 5, usedLong: false, longMedian: null });
    expect(values.payoutLevel).toBeCloseTo(6);
    expect(notes.some((n) => n.includes("Zyklus"))).toBe(false);
  });

  it("maßgeblich ist der Vorschlag für Faktor 1, nicht eine Übersteuerung", () => {
    // `proposeInputs` kennt keine manuellen Werte; der Zehnjahreswert hängt allein am Vorschlag.
    const { values, details } = proposeInputs(stock, cycleYears(), 1, 2026);
    expect(values["risk.earnings"]).toBe(0.25);
    expect(details.cashFlowWindow?.usedLong).toBe(true);
  });

  it("weist bei kurzer Reihe auf den womöglich nicht abgedeckten Zyklus hin", () => {
    // Sieben Jahre: Cashflow 1, 1, 1, 1, 8, 8, 8 je Aktie; Verlustjahr im zweiten.
    const years = cycleYears(4, (y, i) => {
      y.freeCashFlow = i < 7 ? 100 : 800;
    }).slice(3);
    const { details, notes } = proposeInputs(stock, years, 1, 2026);
    expect(details.cashFlowWindow).toMatchObject({ years: 7, usedLong: true, longMedian: 1 });
    expect(details.sustainablePayout).toBeCloseTo(1);
    expect(notes.some((n) => n.includes("ganzer Zyklus"))).toBe(true);
  });

  it("nimmt bei Immobilienwerten den operativen Cashflow über die ganze Reihe", () => {
    const years = cycleYears(4, (y, i) => {
      y.freeCashFlow = -500;
      y.operatingCashFlow = i < 5 ? 100 : 800;
    });
    const reit = proposeInputs({ ...stock, sector: "Real Estate" }, years, 1, 2026);
    expect(reit.details.sustainableFrom).toBe("operatingCashFlow");
    expect(reit.details.sustainablePayout).toBeCloseTo(4.5);
    expect(reit.notes.some((n) => n.includes("operativen Cashflows"))).toBe(true);
  });

  it("rechnet in Fremdwährung ältere Jahre mit dem Inflationsabstand hoch", () => {
    const nominal = proposeInputs(stock, cycleYears(), 1, 2026, undefined, 0);
    const gap = 0.05;
    const lifted = proposeInputs({ ...stock, reportingCurrency: "TRY" }, cycleYears(), 1, 2026, undefined, gap);
    const scaled = [1, 1, 1, 1, 1, 8, 8, 8, 8, 8].map((v, i) => v * (1 + gap) ** (9 - i)).sort((x, y) => x - y);
    const expected = (scaled[4]! + scaled[5]!) / 2;
    expect(nominal.details.cashFlowWindow?.longMedian).toBeCloseTo(4.5);
    expect(lifted.details.cashFlowWindow?.longMedian).toBeCloseTo(expected, 10);
    expect(lifted.details.sustainablePayout!).toBeGreaterThan(nominal.details.sustainablePayout!);
    expect(lifted.notes.some((n) => n.includes("Inflationsabstand auf heutige Kaufkraft"))).toBe(true);
  });

  it("erhöht die Rendite durch die Zyklusregel nie: Einbehaltung und Quote rechnen mit dem Rückfluss ohne sie", () => {
    // Dividende 3 plus Rückkäufe 1; Cashflow je Aktie im Hoch 5 oder über den Zyklus (Median 2,5); kleines Eigenkapital,
    // damit die Grenze aus Einbehaltung nicht an der Preissteigerung klebt.
    const years = (cashFlow: (i: number) => number) =>
      cycleYears(4, (y, i) => {
        y.dividendPerShare = 3;
        y.equity = 1000;
        y.freeCashFlow = cashFlow(i);
      });
    const plain = proposeInputs(
      stock,
      years(() => 500),
      1,
      2026,
    );
    const cyclic = proposeInputs(
      stock,
      years((i) => (i < 5 ? 0 : 500)),
      1,
      2026,
    );
    expect(plain.values.payoutLevel).toBeCloseTo(4);
    expect(cyclic.values.payoutLevel).toBeCloseTo(2.5);
    // Die Differenz ist kein einbehaltener Gewinn: Wachstumsgrenze und Wachstum bleiben wie ohne Zyklusregel.
    expect(plain.details.retentionCap!).toBeGreaterThan(0.1);
    expect(cyclic.details.retentionCap).toBeCloseTo(plain.details.retentionCap!, 12);
    expect(cyclic.values.growth).toBeCloseTo(plain.values.growth!, 12);
    // Die Quote der Rechnung bleibt: Das Gewinnniveau ist im Verhältnis der Rückflüsse gekürzt.
    expect(cyclic.details.payoutEarningsLevel).toBeCloseTo((cyclic.details.earningsLevel! * 2.5) / 4, 12);
    expect(plain.details.payoutEarningsLevel).toBeUndefined();
    const base = (p: typeof plain, capped: number | null = p.details.payoutEarningsLevel ?? null) =>
      evaluate(p.values, {}, 100, 0, p.details.earningsLevel, capped).returns!.base!;
    expect(base(cyclic)).toBeLessThan(base(plain));
    // Ohne die Kürzung stiege der später frei werdende Gewinn, und mit ihm die Rendite.
    expect(base(cyclic, null)).toBeGreaterThan(base(cyclic));
  });

  it("lässt Finanzwerte beim Gewinnniveau, auch mit Zyklusabzug und Vergütung", () => {
    const bank = { ...stock, isFinancial: true };
    const plain = proposeInputs(bank, cycleYears(null), 1, 2026);
    const cyclical = proposeInputs(
      bank,
      cycleYears(4, (y) => (y.stockBasedCompensation = 300)),
      1,
      2026,
    );
    expect(plain.details.sustainableFrom).toBe("earnings");
    expect(cyclical.details.sustainableFrom).toBe("earnings");
    expect(cyclical.details.sustainablePayout).toBe(cyclical.details.earningsLevel);
    expect(cyclical.details.cashFlowWindow).toBeUndefined();
    expect(cyclical.details.compensationPerShare).toBeUndefined();
  });

  describe("aktienbasierte Vergütung", () => {
    /** Dividende 3, keine Rückkäufe, Cashflow 4 je Aktie, Vergütung 1,5 je Aktie: die Rückkäufe fangen sie nicht auf. */
    const dilutive = (sbc: number | null) =>
      steadyYears((y) => {
        y.dividendPerShare = 3;
        y.repurchases = 0;
        y.stockBasedCompensation = sbc;
      });

    it("mindert den tragbaren Rückfluss und bringt den Deckel zum Greifen, mit Hinweis", () => {
      const without = proposeInputs(stock, dilutive(null), 1, 2026);
      expect(without.details.sustainablePayout).toBeCloseTo(4);
      expect(without.values.payoutLevel).toBeCloseTo(3);
      const withPay = proposeInputs(stock, dilutive(150), 1, 2026);
      expect(withPay.details.compensationPerShare).toBeCloseTo(1.5);
      expect(withPay.details.sustainablePayout).toBeCloseTo(2.5);
      expect(withPay.values.payoutLevel).toBeCloseTo(2.5);
      expect(withPay.notes.some((n) => n.includes("Vergütung") && n.includes("Deckelung"))).toBe(true);
    });

    it("zieht sie nicht doppelt ab: Rückkäufe über der Vergütung lassen die Deckelung unverändert", () => {
      // Rückkäufe 3 je Aktie, Vergütung 1 je Aktie: Netto-Rückkäufe 2, Rückfluss 3 + 2 = 5 gegen Cashflow 4 minus 1.
      const years = steadyYears((y) => {
        y.dividendPerShare = 3;
        y.repurchases = 300;
        y.stockBasedCompensation = 100;
      });
      const { values, details, notes } = proposeInputs(stock, years, 1, 2026);
      expect(details.netBuybacksPerShare).toBeCloseTo(2);
      expect(details.sustainablePayout).toBeCloseTo(3);
      expect(values.payoutLevel).toBeCloseTo(3);
      // Ohne Vergütung wäre der Rückfluss 3 + 3 = 6, gedeckelt auf 4, abzüglich der Vergütung 3: dieselbe Zahl.
      expect(notes.some((n) => n.includes("Deckelung"))).toBe(false);
    });

    it("bereinigt Datenfehler der Vergütung für Netto-Rückkäufe und Deckel gleich", () => {
      // Eni: negative Vergütung hob die Netto-Rückkäufe auf 4 statt 1; sie ist kein verwertbarer Wert.
      const negative = steadyYears((y) => {
        y.stockBasedCompensation = -300;
      });
      const eni = proposeInputs(stock, negative, 1, 2026);
      expect(eni.details.netBuybacksPerShare).toBeCloseTo(1);
      expect(eni.details.compensationPerShare).toBe(0);
      // Murphy: zwei Jahre das Tausendfache drücken die Netto-Rückkäufe nicht mehr auf 0.
      const murphy = steadyYears((y, i) => {
        y.stockBasedCompensation = i === 2 || i === 3 ? 100_000 : 20;
      });
      const result = proposeInputs(stock, murphy, 1, 2026);
      expect(result.details.netBuybacksPerShare).toBeCloseTo(0.8);
      expect(result.notes.some((n) => n.includes("Hundertfache"))).toBe(true);
    });

    it("mittelt fehlende Jahre nicht als 0, sondern über die Jahre mit Wert", () => {
      const years = dilutive(null).map((y, i) =>
        i === 7 ? { ...y, stockBasedCompensation: 150 } : i === 9 ? { ...y, stockBasedCompensation: 250 } : y,
      );
      const { details } = proposeInputs(stock, years, 1, 2026);
      // Mittel aus 1,5 und 2,5; als 0 gezählt wären es 0,8.
      expect(details.compensationPerShare).toBeCloseTo(2);
    });

    it("nimmt Ausreißer des Anbieters nicht in die Vergütung und meldet sie", () => {
      const years = dilutive(150).map((y, i) => (i === 2 ? { ...y, stockBasedCompensation: 150e6 } : y));
      const { details, notes } = proposeInputs(stock, years, 1, 2026);
      expect(details.compensationPerShare).toBeCloseTo(1.5);
      expect(notes.some((n) => n.includes("Hundertfache"))).toBe(true);
    });

    it("wirkt bei Zyklikern auf dieselben Jahre wie der Cashflow", () => {
      const { details } = proposeInputs(
        stock,
        cycleYears(4, (y, i) => (y.stockBasedCompensation = i < 5 ? 0 : 200)),
        1,
        2026,
      );
      // Ganze Reihe: fünf Jahre ohne, fünf mit 2 je Aktie Vergütung, im Mittel 1.
      expect(details.compensationPerShare).toBeCloseTo(1);
      expect(details.sustainablePayout).toBeCloseTo(3.5);
    });
  });
});

describe("Deckel und Einbehaltung", () => {
  /** Dividende 3, keine Rückkäufe, Cashflow `cashFlow` je Aktie, Vergütung `sbc` je Aktie; kleines Eigenkapital, damit Einbehaltung zählt. */
  const years = (cashFlow: number, sbc: number | null, equity = 1000, grower = false) =>
    steadyYears((y, i) => {
      y.dividendPerShare = 3;
      y.repurchases = 0;
      y.freeCashFlow = cashFlow * 100;
      y.stockBasedCompensation = sbc === null ? null : sbc * 100;
      y.equity = equity;
      if (grower) y.epsDiluted = 5 * 1.08 ** i;
    });
  const base = (p: ReturnType<typeof proposeInputs>) =>
    evaluate(p.values, {}, 100, 0, p.details.earningsLevel, p.details.payoutEarningsLevel ?? null).returns?.base ?? null;

  it("hebt Wachstum und Rendite nicht, wenn der Vergütungsabzug den Rückfluss senkt (WEX-artig)", () => {
    const without = proposeInputs(stock, years(4, null), 1, 2026);
    const withPay = proposeInputs(stock, years(4, 1.5), 1, 2026);
    expect(without.values.payoutLevel).toBeCloseTo(3);
    expect(withPay.values.payoutLevel).toBeCloseTo(2.5);
    // Die 0,5 Differenz sind nicht einbehalten: Grenze, Wachstum und Quote bleiben wie ohne den Abzug.
    expect(withPay.details.retentionCap).toBeCloseTo(without.details.retentionCap!, 12);
    expect(withPay.values.growth).toBeCloseTo(without.values.growth!, 12);
    expect(withPay.details.payoutEarningsLevel).toBeCloseTo((withPay.details.earningsLevel! * 2.5) / 3, 12);
    expect(base(withPay)!).toBeLessThan(base(without)!);
  });

  it("senkt ein niedrigerer tragbarer Rückfluss bei sonst gleichen Daten die Rendite, hebt sie nie (Gitter)", () => {
    for (const equity of [300, 1000, 5000, 1e9]) {
      for (const grower of [false, true]) {
        let previous = Infinity;
        for (const cap of [8, 6, 5, 4, 3, 2.5, 2, 1, 0.5, 0.1]) {
          const result = proposeInputs(stock, years(cap, null, equity, grower), 1, 2026);
          const value = base(result) ?? -Infinity;
          expect(value, `Eigenkapital ${equity}, Wachstum ${grower}, Cashflow ${cap}`).toBeLessThanOrEqual(previous + 1e-12);
          previous = value;
        }
      }
    }
  });

  it("rechnet bei manuellem Rückfluss die Quote gegen das ungekürzte Gewinnniveau", () => {
    const proposals = { payoutLevel: 2.5, growth: 0.05 };
    const proposed = evaluate(proposals, {}, 100, 0, 6, 4);
    expect(proposed.returnInputs?.earningsLevel).toBe(4);
    expect(proposed.payoutRatio?.now).toBeCloseTo(2.5 / 4);
    const manual = evaluate(proposals, { payoutLevel: 2 }, 100, 0, 6, 4);
    expect(manual.returnInputs?.earningsLevel).toBe(6);
    expect(manual.payoutRatio?.now).toBeCloseTo(2 / 6);
    // Ohne Kürzung gilt das Gewinnniveau wie bisher.
    expect(evaluate(proposals, {}, 100, 0, 6).returnInputs?.earningsLevel).toBe(6);
  });

  const evaluated = (p: ReturnType<typeof proposeInputs>, manual: InputValues = {}, gap = 0) =>
    evaluate(p.values, manual, 100, gap, p.details.earningsLevel, p.details.payoutEarningsLevel ?? null);

  it("hebt auch den vorsichtigen und den optimistischen Fall nie, mit Inflationsabstand und mit Wachstum von Hand", () => {
    const variants = [
      { gap: 0, manual: {} as InputValues },
      { gap: 0.1, manual: {} as InputValues },
      { gap: 0, manual: { growth: 0.085 } as InputValues },
      { gap: 0.1, manual: { growth: toLocalTerms(0.085, 0.1) } as InputValues },
    ];
    for (const { gap, manual } of variants) {
      for (const equity of [300, 5000]) {
        const previous = { cautious: Infinity, base: Infinity, optimistic: Infinity };
        for (const cap of [8, 5, 3, 2, 1, 0.5]) {
          const result = proposeInputs(stock, years(cap, null, equity, true), 1, 2026, undefined, gap);
          const returns = evaluated(result, manual, gap).returns;
          for (const key of ["cautious", "base", "optimistic"] as const) {
            const value = returns?.[key] ?? -Infinity;
            expect(value, `${key}, Abstand ${gap}, Eigenkapital ${equity}, Cashflow ${cap}`).toBeLessThanOrEqual(previous[key] + 1e-12);
            previous[key] = value;
          }
        }
      }
    }
  });

  it("gilt die Quotenregel auch ohne Eigenkapital: dieselbe Rendite mit und ohne", () => {
    // Dividende 3, freier Cashflow 1 (Deckel), Wachstum von Hand 8,5 %.
    const withEquity = proposeInputs(stock, years(1, null, 1000), 1, 2026);
    const noEquity = proposeInputs(
      stock,
      years(1, null).map((y) => ({ ...y, equity: null })),
      1,
      2026,
    );
    expect(noEquity.values.growth).toBeUndefined();
    expect(noEquity.details.payoutEarningsLevel).toBeCloseTo(withEquity.details.payoutEarningsLevel!, 12);
    const manual = { growth: 0.085 };
    expect(evaluated(noEquity, manual).returns!.base!).toBeCloseTo(evaluated(withEquity, manual).returns!.base!, 12);
  });

  it("behandelt Deckel 0, ungedeckelten Rückfluss 0 und ungedeckelten Rückfluss über dem Gewinn", () => {
    // Deckel 0: Der Cashflow trägt nichts; keine Rendite, aber auch kein Fehler.
    const zero = proposeInputs(stock, years(0, null), 1, 2026);
    expect(zero.values.payoutLevel).toBe(0);
    expect(zero.details.payoutEarningsLevel).toBe(0);
    expect(evaluated(zero, { growth: 0.05 }).returns?.base ?? null).toBeNull();
    // Ungedeckelter Rückfluss 0: nichts zu deckeln, keine Kürzung.
    const none = proposeInputs(
      stock,
      years(4, null).map((y) => ({ ...y, dividendPerShare: 0 })),
      1,
      2026,
    );
    expect(none.values.payoutLevel).toBe(0);
    expect(none.details.payoutEarningsLevel).toBeUndefined();
    // Ungedeckelt (8 je Aktie) über dem Gewinn (etwa 5,5), gedeckelt auf 2: Es gibt keine steigende Quote.
    const high = proposeInputs(
      stock,
      years(2, null).map((y) => ({ ...y, dividendPerShare: 8 })),
      1,
      2026,
    );
    expect(high.values.payoutLevel).toBeCloseTo(2);
    expect(high.details.payoutEarningsLevel).toBeCloseTo((high.details.earningsLevel! * 2) / 8, 12);
    const valuation = evaluated(high, { growth: 0.05 });
    expect(valuation.payoutRatio).toBeNull();
  });

  it("nennt den ungedeckelten Rückfluss, auf den sich die Quote bezieht", () => {
    const capped = evaluate({ payoutLevel: 2.5, growth: 0.06 }, {}, 100, 0, 6, 4);
    expect(capped.payoutRatio?.now).toBeCloseTo(2.5 / 4);
    // Ungedeckelt: 2,5 / (4 / 6) = 3,75.
    expect(capped.payoutRatio?.uncappedPayout).toBeCloseTo(3.75);
    expect(evaluate({ payoutLevel: 2.5, growth: 0.06 }, {}, 100, 0, 6).payoutRatio?.uncappedPayout).toBeNull();
    expect(evaluate({ payoutLevel: 2.5, growth: 0.06 }, { payoutLevel: 2 }, 100, 0, 6, 4).payoutRatio?.uncappedPayout).toBeNull();
  });

  it("gibt das gekürzte Gewinnniveau an Formular und Vorschläge-Vorschau weiter", () => {
    const proposals = { ...Object.fromEntries(INPUT_KEYS.map((key) => [key, 0])), payoutLevel: 2.5, growth: 0.06 };
    const viaFields = evaluateFields({}, proposals, 100, 0, 6, 4);
    expect("error" in viaFields).toBe(false);
    if ("error" in viaFields) return;
    expect(viaFields.returnInputs?.earningsLevel).toBe(4);
    const manualField = evaluateFields({ payoutLevel: "2" }, proposals, 100, 0, 6, 4);
    expect("error" in manualField ? null : manualField.returnInputs?.earningsLevel).toBe(6);
    // Die Vorschau mit Vorschlägen für offene Eingaben bleibt bei der wirksamen Quote.
    const open = evaluate({ payoutLevel: 2.5, growth: 0.06 }, {}, 100, 0, 6, 4);
    const filled = withSuggestions(open, { "risk.moat": 0 });
    expect(filled?.returnInputs?.earningsLevel).toBe(4);
    expect(filled?.returns?.base).toBeCloseTo(open.returns!.base!, 12);
  });

  it("reicht das gekürzte Gewinnniveau durch die Bewertung aus der Datenbank", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, years(1, null, 1000), "eodhd");
    db.saveRawCloses(stock.id, [{ date: "2026-11-18", close: 100 }]);
    const { proposals, valuation } = computeValuation(db, stock, "2026-11-19");
    expect(proposals.details.payoutEarningsLevel).toBeDefined();
    expect(valuation.returnInputs?.earningsLevel).toBeCloseTo(proposals.details.payoutEarningsLevel!, 12);
    expect(valuation.returnInputs?.earningsLevel).toBeLessThan(proposals.details.earningsLevel!);
    // Bei einem Rückfluss von Hand gilt das ungekürzte Gewinnniveau.
    const manual = evaluate(
      proposals.values,
      { payoutLevel: valuation.inputs.payoutLevel },
      100,
      0,
      proposals.details.earningsLevel,
      proposals.details.payoutEarningsLevel ?? null,
    );
    expect(manual.returnInputs?.earningsLevel).toBeCloseTo(proposals.details.earningsLevel!, 12);
    db.close();
  });

  it("meldet verworfene Vergütungsjahre auch bei Finanzwerten", () => {
    const bank = { ...stock, isFinancial: true };
    const result = proposeInputs(
      bank,
      years(4, null).map((y, i) => ({ ...y, stockBasedCompensation: i === 3 ? -500 : 100 })),
      1,
      2026,
    );
    expect(result.notes.some((n) => n.includes("negativem Wert") && n.includes("Netto-Rückkäufe"))).toBe(true);
    expect(result.notes.some((n) => n.includes("Abzug vom Cashflow"))).toBe(false);
  });
});
