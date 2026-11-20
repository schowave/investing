"use client";

import { useEffect, useState } from "react";
import type { InputKey, InputValues } from "../../../valuation/valuation.ts";
import { evaluateFields, INPUT_KEYS } from "../../../valuation/valuation.ts";
import { percent } from "../../format.ts";

/** Was die Vorschau zeigt: innere Rendite im Basisfall, Risikowert, offene Eingaben. */
export interface PreviewSummary {
  base: number | null;
  riskScore: number;
  missing: number;
}

interface Props {
  /** Formular, dessen Felder die Vorschau liest. */
  formId: string;
  proposals: InputValues;
  price: number | null;
  inflationGap: number;
  earningsLevel: number | null;
  /** Gekürztes Gewinnniveau für die Quote, wenn ein Deckel den vorgeschlagenen Rückfluss gesenkt hat. */
  payoutEarningsLevel: number | null;
  /** Ersatzabzüge für offene Risikofaktoren (Finanzwerte: 2, 8, 9). */
  standIns: InputValues;
  /** Gespeicherter Stand; stimmt die Vorschau mit ihm überein, zeigt sie nichts. */
  saved: PreviewSummary;
  /** Vorschau für die vorausgefüllten Felder, schon auf dem Server gerechnet, damit nichts nachspringt. */
  initial: PreviewSummary;
  variant: "figure" | "savebar";
}

const shown = (s: PreviewSummary) => `${percent(s.base)}|${percent(s.riskScore, 0)}|${s.missing}`;

/** Rechnet die Bewertung beim Tippen mit, so wie Speichern sie ergäbe. */
export function LivePreview(props: Props) {
  const { formId, proposals, price, inflationGap, earningsLevel, payoutEarningsLevel, standIns } = props;
  const [state, setState] = useState<PreviewSummary | { error: string }>(props.initial);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const update = () => {
      const data = new FormData(form);
      const fields: Partial<Record<InputKey, string>> = {};
      for (const key of INPUT_KEYS) {
        const value = data.get(key);
        if (typeof value === "string") fields[key] = value;
      }
      const result = evaluateFields(fields, proposals, price, inflationGap, earningsLevel, payoutEarningsLevel, standIns);
      setState(
        "error" in result ? result : { base: result.returns?.base ?? null, riskScore: result.riskScore, missing: result.missing.length },
      );
    };
    form.addEventListener("input", update);
    return () => form.removeEventListener("input", update);
  }, [formId, proposals, price, inflationGap, earningsLevel, payoutEarningsLevel, standIns]);

  if ("error" in state) {
    return props.variant === "figure" ? <span className="sub">Vorschau: {state.error}</span> : <span> Vorschau: {state.error}</span>;
  }
  if (shown(state) === shown(props.saved)) return null;
  const result = state.base === null ? "keine Rendite rechenbar" : `innere Rendite ${percent(state.base)}`;
  const open = state.missing > 0 ? `, ${state.missing === 1 ? "eine Eingabe" : `${state.missing} Eingaben`} offen` : "";
  const text = `Nach dem Speichern: ${result}, Risikowert ${percent(state.riskScore, 0)}${open}`;
  return props.variant === "figure" ? (
    <span className="sub" aria-live="polite">
      <a href="#urteil">{text}</a>
    </span>
  ) : (
    <span aria-live="polite"> {text}.</span>
  );
}
