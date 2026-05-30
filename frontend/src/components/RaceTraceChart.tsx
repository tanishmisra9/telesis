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
const M = { t: 18, r: 48, b: 28, l: 38 };

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
      </svg>
    </section>
  );
}
