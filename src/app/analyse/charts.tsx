"use client";

// Diagramme der Analyse-Ansicht als SVG: Linien für Kursverläufe, Balken für Werte je Jahr. Beide zeigen beim Überfahren
// den Wert unter dem Zeiger; die Breite folgt dem Behälter, damit Schrift nicht verzerrt.

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { formatUnit, logTicks, niceTicks, type Unit } from "./analysis.ts";

const PAD = { top: 12, right: 16, bottom: 26, left: 56 };

function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Datum kurz: „Nov. 2026“. */
function monthLabel(date: string): string {
  const [y, m] = date.split("-");
  const months = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];
  return `${months[Number(m) - 1] ?? m} ${y}`;
}

/** Beschriftung der Zeitachse: Jahreswechsel in gleichen Abständen, höchstens `max` Stück. */
function yearTicks(dates: readonly string[], max: number): number[] {
  const starts: number[] = [];
  dates.forEach((d, i) => {
    if (i === 0 || d.slice(0, 4) !== dates[i - 1]?.slice(0, 4)) starts.push(i);
  });
  if (starts.length <= 1) return dates.length > 1 ? [0, dates.length - 1] : [0];
  // Ein angebrochenes erstes Jahr bekommt keine eigene Beschriftung, sonst stehen zwei Jahreszahlen übereinander.
  const gap = dates.length / Math.max(1, starts.length);
  const usable = starts.length > 1 && starts[1]! < gap * 0.5 ? starts.slice(1) : starts;
  const step = Math.ceil(usable.length / max);
  return usable.filter((_, i) => i % step === 0);
}

export interface LineSeries {
  label: string;
  /** Eine CSS-Variable oder Farbe. */
  color: string;
  values: readonly number[];
  dashed?: boolean;
}

export function LineChart(props: {
  dates: readonly string[];
  series: readonly LineSeries[];
  unit: Unit | "index";
  log?: boolean;
  height?: number;
  /** Waagrechte Bezugslinie, etwa 100 beim Index. */
  baseline?: number;
  label: string;
}) {
  const { dates, series, unit, log = false, height = 300, baseline, label } = props;
  const { ref, width } = useWidth(800);
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v) && (!log || v > 0));
  if (dates.length < 2 || all.length === 0) return <p className="meta">Zu wenige Kurse für ein Diagramm.</p>;

  const lo = Math.min(...all, baseline ?? Number.POSITIVE_INFINITY);
  const hi = Math.max(...all, baseline ?? Number.NEGATIVE_INFINITY);
  const ticks = log ? logTicks(lo, hi) : niceTicks(unit === "index" || lo > 0 ? Math.max(0, lo - (hi - lo) * 0.05) : lo, hi, 5);
  const yMin = log ? lo : Math.min(lo, ticks[0] ?? lo);
  const yMax = log ? hi : Math.max(hi, ticks.at(-1) ?? hi);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (dates.length - 1)) * innerW;
  const y = (v: number) => {
    const t = log ? (Math.log(v) - Math.log(yMin)) / (Math.log(yMax) - Math.log(yMin) || 1) : (v - yMin) / (yMax - yMin || 1);
    return PAD.top + (1 - t) * innerH;
  };
  const fmt = (v: number) => (unit === "index" ? v.toLocaleString("de-DE", { maximumFractionDigits: 0 }) : formatUnit(v, unit));
  const path = (values: readonly number[]) =>
    values
      .map((v, i) => (Number.isFinite(v) && (!log || v > 0) ? `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}` : ""))
      .join("")
      .replace(/^L/, "M");

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.min(dates.length - 1, Math.max(0, Math.round(rel * (dates.length - 1)))));
  };
  const xTicks = yearTicks(dates, Math.max(2, Math.floor(innerW / 80)));
  const shown = hover ?? dates.length - 1;
  const first = series[0]!;
  const areaPath =
    !log && first.values.every(Number.isFinite) ? `${path(first.values)}L${x(dates.length - 1)},${y(yMin)}L${x(0)},${y(yMin)}Z` : null;

  return (
    <div className="chart" ref={ref}>
      <div className="chart-readout" aria-live="polite">
        <span className="meta">{monthLabel(dates[shown]!)}</span>
        {series.map((s) => (
          <span key={s.label}>
            <i className={`swatch${s.dashed ? " dashed" : ""}`} style={s.dashed ? undefined : { background: s.color }} />
            {s.label} <strong>{Number.isFinite(s.values[shown]) ? fmt(s.values[shown]!) : "–"}</strong>
          </span>
        ))}
      </div>
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {fmt(t)}
            </text>
          </g>
        ))}
        {baseline !== undefined && <line className="baseline" x1={PAD.left} x2={width - PAD.right} y1={y(baseline)} y2={y(baseline)} />}
        {xTicks.map((i) => (
          <text key={i} className="tick" x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"}>
            {dates[i]!.slice(0, 4)}
          </text>
        ))}
        {areaPath && <path className="area" d={areaPath} style={{ fill: first.color }} />}
        {series.map((s) => (
          <path
            key={s.label}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s === first ? 2 : 1.5}
            strokeDasharray={s.dashed ? "5 4" : undefined}
            strokeLinejoin="round"
          />
        ))}
        {hover !== null && (
          <g>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />
            {series.map((s) =>
              Number.isFinite(s.values[hover]) && (!log || s.values[hover]! > 0) ? (
                <circle
                  key={s.label}
                  cx={x(hover)}
                  cy={y(s.values[hover]!)}
                  r={3.5}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                />
              ) : null,
            )}
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
    </div>
  );
}

export function BarChart(props: {
  labels: readonly (string | number)[];
  values: readonly (number | null)[];
  unit: Unit;
  /** Balken, die noch nicht fertig sind (laufendes Jahr), heller. */
  partial?: readonly boolean[];
  height?: number;
  label: string;
}) {
  const { labels, values, unit, partial = [], height = 180, label } = props;
  const { ref, width } = useWidth(400);
  const [hover, setHover] = useState<number | null>(null);
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (known.length === 0) return <p className="meta">Keine Werte.</p>;

  const ticks = niceTicks(Math.min(0, ...known), Math.max(0, ...known), 4);
  const yMin = ticks[0]!;
  const yMax = ticks.at(-1)!;
  const left = unit === "big" ? 62 : 48;
  const innerW = width - left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
  const slot = innerW / values.length;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const every = Math.ceil(values.length / Math.max(2, Math.floor(innerW / 44)));
  const shown = hover ?? values.length - 1;

  return (
    <div className="chart" ref={ref}>
      <div className="chart-readout small" aria-live="polite">
        <span className="meta">{labels[shown]}</span>
        <strong>{formatUnit(values[shown] ?? null, unit)}</strong>
        {partial[shown] && <span className="meta">bisher</span>}
      </div>
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "zero" : "grid"} x1={left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {formatUnit(t, unit === "amount" && Math.abs(yMax) >= 100 ? "big" : unit)}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const cx = left + slot * (i + 0.5);
          const top = v === null ? y(0) : y(Math.max(0, v));
          const bottom = v === null ? y(0) : y(Math.min(0, v));
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: Balken sind fest nach Position geordnet.
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {v !== null && (
                <rect
                  className={`col${v < 0 ? " neg" : ""}${partial[i] ? " partial" : ""}${hover === i ? " active" : ""}`}
                  x={cx - barW / 2}
                  y={top}
                  width={barW}
                  height={Math.max(1, bottom - top)}
                  rx={2}
                />
              )}
              {(i % every === 0 || i === values.length - 1) && (
                <text className="tick" x={cx} y={height - 6} textAnchor="middle">
                  {String(labels[i]).length === 4 && values.length > 12 ? `'${String(labels[i]).slice(2)}` : labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
