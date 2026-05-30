import { useEffect, useMemo, useState } from "react";
import { getSpeedTrace } from "../api/client";
import type { ResultsResponse, SessionSelection, SpeedTraceResponse } from "../api/types";
import { resolveTeamColor } from "../design/teamColors";

interface SpeedTraceCompareProps {
  selection: SessionSelection;
  results: ResultsResponse;
}

export function SpeedTraceCompare({ selection, results }: SpeedTraceCompareProps) {
  const [a, setA] = useState(results.drivers[0]?.abbr ?? "VER");
  const [b, setB] = useState(results.drivers[1]?.abbr ?? "HAM");
  const [data, setData] = useState<SpeedTraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setA(results.drivers[0]?.abbr ?? "VER");
    setB(results.drivers[1]?.abbr ?? "HAM");
  }, [results]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    if (!a || !b) return;
    void getSpeedTrace(selection.year, selection.round, selection.sessionType, a, b)
      .then((resp) => {
        if (!cancelled) setData(resp);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [selection, a, b]);

  const poly = useMemo(() => {
    if (!data) return null;
    const w = 1080;
    const speedH = 260;
    const deltaH = 132;
    const speedM = { t: 20, r: 26, b: 42, l: 52 };
    const deltaM = { t: 16, r: 26, b: 34, l: 52 };
    const xValues = data.a.distance_m.length ? data.a.distance_m : data.b.distance_m;
    const n = xValues.length || 1;
    const minV = Math.min(...data.a.speed_kmh, ...data.b.speed_kmh);
    const maxV = Math.max(...data.a.speed_kmh, ...data.b.speed_kmh);
    const minX = xValues[0] ?? 0;
    const maxX = xValues[n - 1] ?? 1;
    const toX = (x: number) =>
      speedM.l + ((w - speedM.l - speedM.r) * (x - minX)) / (maxX - minX || 1);
    const toSpeedY = (v: number) =>
      speedH - speedM.b - ((v - minV) / (maxV - minV || 1)) * (speedH - speedM.t - speedM.b);

    const deltaMax = Math.max(0.2, ...data.delta_a_minus_b_s.map((v) => Math.abs(v)));
    const deltaBound = Math.ceil(deltaMax * 5) / 5;
    const toDeltaY = (v: number) => {
      const center = deltaH / 2;
      return center - (v / deltaBound) * ((deltaH - deltaM.t - deltaM.b) / 2);
    };
    const zeroY = toDeltaY(0);

    const lineA = data.a.speed_kmh
      .map((v, i) => `${toX(data.a.distance_m[i] ?? xValues[i] ?? 0)},${toSpeedY(v)}`)
      .join(" ");
    const lineB = data.b.speed_kmh
      .map((v, i) => `${toX(data.b.distance_m[i] ?? xValues[i] ?? 0)},${toSpeedY(v)}`)
      .join(" ");
    const deltaPoints = data.delta_a_minus_b_s
      .map((v, i) => `${toX(xValues[i] ?? 0)},${toDeltaY(v)}`)
      .join(" ");
    const positiveArea = [
      `${toX(minX)},${zeroY}`,
      ...data.delta_a_minus_b_s.map((v, i) => `${toX(xValues[i] ?? 0)},${toDeltaY(Math.max(v, 0))}`),
      `${toX(maxX)},${zeroY}`,
    ].join(" ");
    const negativeArea = [
      `${toX(minX)},${zeroY}`,
      ...data.delta_a_minus_b_s.map((v, i) => `${toX(xValues[i] ?? 0)},${toDeltaY(Math.min(v, 0))}`),
      `${toX(maxX)},${zeroY}`,
    ].join(" ");

    return {
      w,
      speedH,
      deltaH,
      lineA,
      lineB,
      deltaPoints,
      positiveArea,
      negativeArea,
      speedM,
      deltaM,
      minV,
      maxV,
      toX,
      toDeltaY,
      zeroY,
      deltaBound,
      minX,
      maxX,
    };
  }, [data]);

  const colorA = useMemo(() => {
    const team = results.drivers.find((d) => d.abbr === a)?.team ?? "";
    return resolveTeamColor(team);
  }, [results.drivers, a]);
  const colorB = useMemo(() => {
    const team = results.drivers.find((d) => d.abbr === b)?.team ?? "";
    return resolveTeamColor(team);
  }, [results.drivers, b]);

  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-card-heading font-medium text-primary">Speed compare</h3>
        <div className="flex items-center gap-2">
          <select
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="rounded-pill border border-line bg-surface-3 px-3 py-1 text-secondary-body"
          >
            {results.drivers.map((d) => (
              <option key={d.abbr} value={d.abbr}>
                {d.abbr}
              </option>
            ))}
          </select>
          <select
            value={b}
            onChange={(e) => setB(e.target.value)}
            className="rounded-pill border border-line bg-surface-3 px-3 py-1 text-secondary-body"
          >
            {results.drivers.map((d) => (
              <option key={d.abbr} value={d.abbr}>
                {d.abbr}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-caption text-red-400">{error}</p>}
      {!error && !poly && <p className="text-caption text-secondary">Loading speed traces...</p>}
      {poly && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-secondary-body">
            <span className="rounded-pill px-2 py-1" style={{ color: colorA, backgroundColor: `${colorA}1f` }}>
              {a} {data?.a.lap_time_s.toFixed(3)}s
            </span>
            <span className="rounded-pill px-2 py-1" style={{ color: colorB, backgroundColor: `${colorB}1f` }}>
              {b} {data?.b.lap_time_s.toFixed(3)}s
            </span>
          </div>
          <svg viewBox={`0 0 ${poly.w} ${poly.speedH}`} className="w-full rounded-inner border border-line bg-surface-2 p-2">
            {[0, 1, 2, 3, 4].map((idx) => {
              const value = poly.minV + ((poly.maxV - poly.minV) * idx) / 4;
              const y =
                poly.speedH -
                poly.speedM.b -
                ((value - poly.minV) / (poly.maxV - poly.minV || 1)) *
                  (poly.speedH - poly.speedM.t - poly.speedM.b);
              return (
                <g key={idx}>
                  <line
                    x1={poly.speedM.l}
                    x2={poly.w - poly.speedM.r}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="3 3"
                  />
                  <text x={poly.speedM.l - 8} y={y} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.65)" fontSize={10}>
                    {value.toFixed(0)}
                  </text>
                </g>
              );
            })}
            <polyline points={poly.lineA} fill="none" stroke={colorA} strokeWidth={2.2} />
            <polyline points={poly.lineB} fill="none" stroke={colorB} strokeWidth={2.2} />
            <text x={poly.w / 2} y={poly.speedH - 8} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={11}>
              Distance (meters)
            </text>
            <text
              x={14}
              y={poly.speedH / 2}
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              fontSize={11}
              transform={`rotate(-90 14 ${poly.speedH / 2})`}
            >
              Speed (km/h)
            </text>
          </svg>

          <svg viewBox={`0 0 ${poly.w} ${poly.deltaH}`} className="w-full rounded-inner border border-line bg-surface-2 p-2">
            <line
              x1={poly.deltaM.l}
              x2={poly.w - poly.deltaM.r}
              y1={poly.zeroY}
              y2={poly.zeroY}
              stroke="rgba(255,255,255,0.38)"
              strokeWidth={1.5}
            />
            <polygon points={poly.positiveArea} fill={`${colorA}38`} />
            <polygon points={poly.negativeArea} fill={`${colorB}38`} />
            <polyline points={poly.deltaPoints} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
            <text x={poly.deltaM.l - 8} y={poly.toDeltaY(poly.deltaBound)} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.65)" fontSize={10}>
              +{poly.deltaBound.toFixed(1)}
            </text>
            <text x={poly.deltaM.l - 8} y={poly.zeroY} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.65)" fontSize={10}>
              0.0
            </text>
            <text x={poly.deltaM.l - 8} y={poly.toDeltaY(-poly.deltaBound)} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.65)" fontSize={10}>
              -{poly.deltaBound.toFixed(1)}
            </text>
            <text x={poly.w / 2} y={poly.deltaH - 8} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={11}>
              Delta (A minus B) seconds
            </text>
          </svg>
        </div>
      )}
      <p className="mt-2 text-secondary-body text-muted">
        Fastest lap speed traces above, with a separate delta panel where values below zero mean A is ahead.
      </p>
    </section>
  );
}
