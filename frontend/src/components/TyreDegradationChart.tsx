import { useMemo, useState } from "react";
import type { DriverStintDegEntry, DriverTyreDegEntry, TyreDegResponse } from "../api/types";

interface TyreDegradationChartProps {
  data: TyreDegResponse;
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "rgba(223, 102, 108, 0.82)",
  MEDIUM: "rgba(214, 173, 93, 0.82)",
  HARD: "rgba(206, 210, 216, 0.82)",
  INTERMEDIATE: "rgba(117, 180, 136, 0.82)",
  WET: "rgba(107, 151, 214, 0.82)",
  UNKNOWN: "rgba(181, 181, 181, 0.72)",
};

interface TeamAggregate {
  team: string;
  drivers: DriverTyreDegEntry[];
}

interface ChartDomain {
  yMin: number;
  yMax: number;
  xMin: number;
  xMax: number;
}

function mergeStints(drivers: DriverTyreDegEntry[]): DriverStintDegEntry[] {
  return drivers.flatMap((driver) => driver.stints);
}

function computeDomain(teams: TeamAggregate[]): ChartDomain {
  const lapTimes = teams.flatMap((team) =>
    mergeStints(team.drivers).flatMap((stint) => stint.points.map((point) => point.lap_time_s)),
  );
  const tyreAges = teams.flatMap((team) =>
    mergeStints(team.drivers).flatMap((stint) => stint.points.map((point) => point.tyre_age)),
  );
  const yMin = lapTimes.length ? Math.min(...lapTimes) - 0.15 : 0;
  const yMax = lapTimes.length ? Math.max(...lapTimes) + 0.15 : 1;
  const xMin = 0;
  const xMax = tyreAges.length ? Math.max(...tyreAges) : 1;
  return { yMin, yMax, xMin, xMax };
}

function DegChart({
  stints,
  domain,
}: {
  stints: DriverStintDegEntry[];
  domain: ChartDomain;
}) {
  const width = 320;
  const height = 190;
  const left = 38;
  const top = 16;
  const chartW = 262;
  const chartH = 140;

  const toX = (x: number) => left + ((x - domain.xMin) / (domain.xMax - domain.xMin || 1)) * chartW;
  const toY = (y: number) => top + chartH - ((y - domain.yMin) / (domain.yMax - domain.yMin || 1)) * chartH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full">
      <rect x={left} y={top} width={chartW} height={chartH} fill="transparent" stroke="rgba(255,255,255,0.08)" />
      {[0, 1, 2, 3, 4].map((tick) => {
        const value = domain.yMin + ((domain.yMax - domain.yMin) * tick) / 4;
        const y = toY(value);
        return (
          <g key={tick}>
            <line x1={left} x2={left + chartW} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x={left - 4} y={y} textAnchor="end" dominantBaseline="middle" fill="rgba(255,255,255,0.6)" fontSize={9}>
              {value.toFixed(2)}
            </text>
          </g>
        );
      })}
      {stints.map((stint, index) => {
        const color = COMPOUND_COLORS[stint.compound] ?? COMPOUND_COLORS.UNKNOWN;
        const xValues = stint.points.map((point) => point.tyre_age);
        const localMinX = xValues.length ? Math.min(...xValues) : 0;
        const localMaxX = xValues.length ? Math.max(...xValues) : 0;
        const fitStartY = stint.intercept_s + stint.slope_s_per_lap * localMinX;
        const fitEndY = stint.intercept_s + stint.slope_s_per_lap * localMaxX;
        return (
          <g key={`${stint.compound}-${stint.stint_number}-${index}`}>
            {stint.points.map((point, idx) => (
              <circle
                key={`${stint.stint_number}-${idx}`}
                cx={toX(point.tyre_age)}
                cy={toY(point.lap_time_s)}
                r={2.3}
                fill={color}
              />
            ))}
            <line
              x1={toX(localMinX)}
              y1={toY(fitStartY)}
              x2={toX(localMaxX)}
              y2={toY(fitEndY)}
              stroke={color}
              strokeWidth={1.5}
            />
            <text
              x={toX(localMaxX)}
              y={toY(fitEndY) - 4}
              textAnchor="end"
              fill={color}
              fontSize={9}
            >
              {stint.slope_s_per_lap >= 0 ? "+" : ""}
              {stint.slope_s_per_lap.toFixed(3)} s/lap
            </text>
          </g>
        );
      })}
      <text x={width / 2} y={184} textAnchor="middle" fill="rgba(255,255,255,0.72)" fontSize={10}>
        Tyre age (laps)
      </text>
      <text x={10} y={86} textAnchor="middle" fill="rgba(255,255,255,0.72)" fontSize={10} transform="rotate(-90 10 86)">
        Lap time (s)
      </text>
    </svg>
  );
}

export function TyreDegradationChart({ data }: TyreDegradationChartProps) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  if (!data.applicable) return null;

  const teams = useMemo(() => {
    const map = new Map<string, DriverTyreDegEntry[]>();
    for (const driver of data.drivers) {
      map.set(driver.team, [...(map.get(driver.team) ?? []), driver]);
    }
    return Array.from(map.entries()).map(([team, drivers]) => ({ team, drivers }));
  }, [data.drivers]);

  const allStintRows = teams.flatMap((team) =>
    mergeStints(team.drivers).map((stint) => ({
      team: team.team,
      slope: stint.slope_s_per_lap,
    })),
  );
  const steepest = allStintRows.slice().sort((a, b) => b.slope - a.slope)[0];
  const shallowest = allStintRows.slice().sort((a, b) => a.slope - b.slope)[0];
  const primaryTeams = Array.from(
    new Set([teams[0]?.team ?? "", teams[1]?.team ?? "", teams[2]?.team ?? "", steepest?.team ?? "", shallowest?.team ?? ""]),
  ).filter(Boolean);
  const selectedTeams = teams.filter((team) => primaryTeams.includes(team.team));
  const domain = computeDomain(selectedTeams);

  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <h3 className="mb-3 text-card-heading font-medium text-primary">Tyre degradation</h3>
      <p className="mb-3 text-secondary-body text-muted">
        Constructor-level view by default, because degradation is mostly car and compound behavior.
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {selectedTeams.map((team) => {
          const stints = mergeStints(team.drivers);
          return (
            <article key={team.team} className="rounded-inner border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-label text-primary">{team.team}</p>
                <button
                  type="button"
                  onClick={() => setExpandedTeam(expandedTeam === team.team ? null : team.team)}
                  className="rounded-pill border border-line bg-surface-3 px-2 py-1 text-caption text-secondary"
                >
                  {expandedTeam === team.team ? "Hide drivers" : "Show drivers"}
                </button>
              </div>
              <DegChart stints={stints} domain={domain} />
              <div className="mt-2 space-y-1 text-caption text-secondary">
                {stints.map((stint, idx) => (
                  <p key={`${team.team}-${stint.stint_number}-${idx}`}>
                    {stint.compound}: {stint.slope_s_per_lap >= 0 ? "degrading" : "improving"} at {stint.slope_s_per_lap.toFixed(3)} s/lap
                  </p>
                ))}
              </div>
              {expandedTeam === team.team && (
                <div className="mt-3 space-y-2 rounded-inner border border-line bg-panel/50 p-2">
                  {team.drivers.map((driver) => (
                    <div key={`${team.team}-${driver.abbr}`}>
                      <p className="text-caption text-primary">{driver.abbr}</p>
                      <div className="space-y-1 text-caption text-muted">
                        {driver.stints.map((stint) => (
                          <p key={`${driver.abbr}-${stint.stint_number}`}>
                            {stint.compound}: {stint.slope_s_per_lap >= 0 ? "degrading" : "improving"} at {stint.slope_s_per_lap.toFixed(3)} s/lap
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="mt-2 text-secondary-body text-muted">
        Each panel shows scatter points and per-stint fit lines, with shared axes across teams.
      </p>
    </section>
  );
}
