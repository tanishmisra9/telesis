import { useEffect, useMemo, useState } from "react";
import { getSpeedTrace } from "../api/client";
import type { ResultsResponse, SessionSelection, SpeedTraceResponse } from "../api/types";

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
    const h = 260;
    const m = { t: 18, r: 24, b: 28, l: 24 };
    const n = data.a.distance_m.length || 1;
    const minV = Math.min(...data.a.speed_kmh, ...data.b.speed_kmh);
    const maxV = Math.max(...data.a.speed_kmh, ...data.b.speed_kmh);
    const toX = (i: number) => m.l + ((w - m.l - m.r) * i) / (n - 1 || 1);
    const toY = (v: number) => h - m.b - ((v - minV) / (maxV - minV || 1)) * (h - m.t - m.b);
    const lineA = data.a.speed_kmh.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
    const lineB = data.b.speed_kmh.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
    return { lineA, lineB, w, h };
  }, [data]);

  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-card-heading font-medium text-primary">Speed compare</h3>
        <div className="flex items-center gap-2">
          <select value={a} onChange={(e) => setA(e.target.value)} className="rounded-pill bg-surface-3 px-3 py-1 text-caption">
            {results.drivers.map((d) => (
              <option key={d.abbr} value={d.abbr}>
                {d.abbr}
              </option>
            ))}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} className="rounded-pill bg-surface-3 px-3 py-1 text-caption">
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
        <svg viewBox={`0 0 ${poly.w} ${poly.h}`} className="w-full">
          <polyline points={poly.lineA} fill="none" stroke="#F5C13A" strokeWidth={2} />
          <polyline points={poly.lineB} fill="none" stroke="#5BA3F5" strokeWidth={2} />
        </svg>
      )}
    </section>
  );
}
