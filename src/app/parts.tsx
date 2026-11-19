// Gemeinsame Bausteine der Oberfläche.

import { percent } from "./format.ts";

/**
 * Renditeleiste: die Spanne vom vorsichtigen bis zum optimistischen Fall auf einer gemeinsamen Skala, der Basisfall
 * als Strich, die Mindestrendite als gestrichelte Linie. Blau ist die Spanne nur, wenn auch der vorsichtige Fall die
 * Mindestrendite erreicht.
 */
export function ReturnRange(props: {
  cautious: number | null;
  base: number | null;
  optimistic: number | null;
  hurdle: number;
  scaleMax: number;
}) {
  const { cautious, base, optimistic, hurdle, scaleMax } = props;
  if (cautious === null || base === null || optimistic === null) return <span className="meta">nicht berechenbar</span>;
  const at = (value: number) => `${Math.min(100, Math.max(0, (value / scaleMax) * 100))}%`;
  const clears = cautious >= hurdle;
  return (
    <div
      className={`range${clears ? "" : " short"}`}
      role="img"
      aria-label={`${percent(cautious)} bis ${percent(optimistic)}, Basisfall ${percent(base)}, Mindestrendite ${percent(hurdle)}`}
    >
      <span className="track" />
      <span className="span" style={{ left: at(cautious), width: `calc(${at(optimistic)} - ${at(cautious)})` }} />
      <span className="base" style={{ left: at(base) }} />
      <span className="hurdle" style={{ left: at(hurdle) }} />
    </div>
  );
}

export function RangeLegend() {
  return (
    <p className="legend">
      <span>
        <i className="l-span" />
        vorsichtig bis optimistisch
      </span>
      <span>
        <i className="l-base" />
        Basisfall
      </span>
      <span>
        <i className="l-hurdle" />
        Mindestrendite
      </span>
    </p>
  );
}

/** Obere Grenze der Skala: etwas über dem größten Wert, in ganzen fünf Prozentpunkten. */
export function scaleFor(values: readonly (number | null)[], hurdle: number): number {
  const top = Math.max(hurdle, ...values.filter((v): v is number => v !== null));
  return Math.min(0.4, Math.max(0.1, Math.ceil((top * 1.1) / 0.05) * 0.05));
}
