import { useMemo } from "react";
import type { RaceTraceResponse } from "../api/types";
import { resolveTeamColor } from "../design/teamColors";

interface RaceTraceChartProps {
  data: RaceTraceResponse;
  selectedDriver: string | null;
  onSelectDriver: (abbr: string) => void;
}

const W = 1080;
const H = 320;
const M = { t: 20, r: 64, b: 44, l: 44 };

export function RaceTraceChart({ data, selectedDriver, onSelectDriver }: RaceTraceChartProps) {
  const chart = useMemo(() => {
    const totalLaps = Math.max(1, data.total_laps);
    const toX = (lap: number) => M.l + ((W - M.l - M.r) * lap) / (totalLaps - 1 || 1);
    const toY = (pos: number) => M.t + ((H - M.t - M.b) * (pos - 1)) / 19;
    return { toX, toY };
  }, [data.total_laps]);

  if (!data.applicable) return null;

  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <h3 className="mb-3 text-card-heading font-medium text-primary">Race trace</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[1, 5, 10, 15, 20].map((pos) => (
          <g key={pos}>
            <line
              x1={M.l}
              x2={W - M.r}
              y1={chart.toY(pos)}
              y2={chart.toY(pos)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="3 3"
            />
            <text x={M.l - 8} y={chart.toY(pos)} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.65)" fontSize={10}>
              P{pos}
            </text>
          </g>
        ))}
        {Array.from({ length: Math.floor(data.total_laps / 5) + 1 }, (_, i) => i * 5).map((lap) => (
          <g key={lap}>
            <line
              x1={chart.toX(lap)}
              x2={chart.toX(lap)}
              y1={M.t}
              y2={H - M.b}
              stroke="rgba(255,255,255,0.05)"
            />
            <text x={chart.toX(lap)} y={H - M.b + 14} textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize={10}>
              {lap}
            </text>
          </g>
        ))}
        {data.drivers.map((driver) => {
          const pts = driver.positions
            .map((p, idx) => (p ? `${chart.toX(idx)},${chart.toY(p)}` : null))
            .filter(Boolean)
            .join(" ");
          const active = selectedDriver === driver.abbr;
          return (
            <polyline
              key={driver.abbr}
              points={pts}
              fill="none"
              stroke={resolveTeamColor(driver.team)}
              strokeOpacity={selectedDriver && !active ? 0.25 : 0.9}
              strokeWidth={active ? 2.4 : 1.5}
              onClick={() => onSelectDriver(driver.abbr)}
            />
          );
        })}
        <text x={(W - M.r + M.l) / 2} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={11}>
          Lap number
        </text>
        <text
          x={12}
          y={(H - M.b + M.t) / 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.8)"
          fontSize={11}
          transform={`rotate(-90 12 ${(H - M.b + M.t) / 2})`}
        >
          Position
        </text>
      </svg>
      <p className="mt-2 text-micro text-muted">
        Position by lap for race or sprint sessions; lower y-value is better position.
      </p>
    </section>
  );
}
