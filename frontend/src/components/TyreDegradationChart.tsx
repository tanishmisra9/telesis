import { useMemo, useState } from "react";
import type { DriverStintDegEntry, DriverTyreDegEntry, TyreDegResponse } from "../api/types";
import { resolveTeamColor } from "../design/teamColors";

interface TyreDegradationChartProps {
  data: TyreDegResponse;
}

interface CurvePoint {
  tyreAge: number;
  lapTimeS: number;
}

function mergeStints(drivers: DriverTyreDegEntry[]): DriverStintDegEntry[] {
  return drivers.flatMap((driver) => driver.stints);
}

function averageSlope(stints: DriverStintDegEntry[]): number {
  if (!stints.length) return 0;
  return stints.reduce((sum, stint) => sum + stint.slope_s_per_lap, 0) / stints.length;
}

function buildCurvePoints(stints: DriverStintDegEntry[]): CurvePoint[] {
  const byAge = new Map<number, number[]>();
  for (const stint of stints) {
    for (const point of stint.points) {
      byAge.set(point.tyre_age, [...(byAge.get(point.tyre_age) ?? []), point.lap_time_s]);
    }
  }
  return Array.from(byAge.entries())
    .map(([tyreAge, values]) => ({
      tyreAge,
      lapTimeS: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length),
    }))
    .sort((a, b) => a.tyreAge - b.tyreAge);
}

export function TyreDegradationChart({ data }: TyreDegradationChartProps) {
  const [viewMode, setViewMode] = useState<"ranked" | "curves">("ranked");
  if (!data.applicable) return null;

  const teams = useMemo(() => {
    const map = new Map<string, DriverTyreDegEntry[]>();
    for (const driver of data.drivers) {
      map.set(driver.team, [...(map.get(driver.team) ?? []), driver]);
    }
    return Array.from(map.entries()).map(([team, drivers]) => ({ team, drivers }));
  }, [data.drivers]);

  const rankedTeams = useMemo(
    () =>
      teams
        .map((team) => ({
          team: team.team,
          stints: mergeStints(team.drivers),
        }))
        .map((team) => ({
          ...team,
          slope: averageSlope(team.stints),
        }))
        .sort((a, b) => b.slope - a.slope),
    [teams],
  );

  const allSlopes = rankedTeams.map((team) => team.slope);
  const slopeMin = allSlopes.length ? Math.min(...allSlopes) : -0.05;
  const slopeMax = allSlopes.length ? Math.max(...allSlopes) : 0.05;

  const curveSeries = useMemo(
    () =>
      rankedTeams.map((team) => ({
        team: team.team,
        points: buildCurvePoints(team.stints),
      })),
    [rankedTeams],
  );
  const allCurvePoints = curveSeries.flatMap((series) => series.points);
  const maxTyreAge = allCurvePoints.length ? Math.max(...allCurvePoints.map((point) => point.tyreAge)) : 1;
  const minLapTime = allCurvePoints.length ? Math.min(...allCurvePoints.map((point) => point.lapTimeS)) : 0;
  const maxLapTime = allCurvePoints.length ? Math.max(...allCurvePoints.map((point) => point.lapTimeS)) : 1;

  return (
    <section className="rounded-card border border-line bg-panel p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-card-heading font-medium text-primary">Tyre degradation</h3>
        <div className="inline-flex rounded-pill border border-line bg-glass p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("ranked")}
            className={`rounded-pill px-2.5 py-1 text-caption ${
              viewMode === "ranked" ? "bg-accent-tint text-accent" : "text-secondary"
            }`}
          >
            Ranked rates
          </button>
          <button
            type="button"
            onClick={() => setViewMode("curves")}
            className={`rounded-pill px-2.5 py-1 text-caption ${
              viewMode === "curves" ? "bg-accent-tint text-accent" : "text-secondary"
            }`}
          >
            Overlaid curves
          </button>
        </div>
      </div>

      <svg viewBox="0 0 760 320" className="w-full rounded-inner border border-line bg-surface-2 p-2">
        <rect x={64} y={20} width={660} height={250} fill="transparent" stroke="rgba(255,255,255,0.08)" />
        {viewMode === "ranked" &&
          rankedTeams.map((team, index) => {
            const rowHeight = 250 / Math.max(1, rankedTeams.length);
            const y = 20 + index * rowHeight + rowHeight / 2;
            const xZero = 64 + ((0 - slopeMin) / Math.max(0.0001, slopeMax - slopeMin)) * 660;
            const xValue = 64 + ((team.slope - slopeMin) / Math.max(0.0001, slopeMax - slopeMin)) * 660;
            const barStart = Math.min(xZero, xValue);
            const barWidth = Math.abs(xValue - xZero);
            const color = resolveTeamColor(team.team);
            return (
              <g key={team.team}>
                <text x={12} y={y + 4} fill="rgba(245,245,247,0.9)" fontSize={11}>
                  {index + 1}. {team.team}
                </text>
                <line x1={64} x2={724} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
                <rect x={barStart} y={y - 6} width={Math.max(1, barWidth)} height={12} rx={6} fill={color} />
                <text x={730} y={y + 4} fill="rgba(245,245,247,0.7)" fontSize={10} textAnchor="end">
                  {team.slope >= 0 ? "+" : ""}
                  {team.slope.toFixed(3)} s/lap
                </text>
              </g>
            );
          })}
        {viewMode === "curves" &&
          curveSeries.map((series) => {
            if (!series.points.length) return null;
            const color = resolveTeamColor(series.team);
            const path = series.points
              .map((point, index) => {
                const x = 64 + (point.tyreAge / Math.max(1, maxTyreAge)) * 660;
                const y = 20 + (1 - (point.lapTimeS - minLapTime) / Math.max(0.001, maxLapTime - minLapTime)) * 250;
                return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
              })
              .join(" ");
            return <path key={series.team} d={path} fill="none" stroke={color} strokeWidth={2.2} />;
          })}
        <text x={394} y={306} textAnchor="middle" fill="rgba(245,245,247,0.72)" fontSize={11}>
          {viewMode === "ranked" ? "Average degradation rate (s/lap, positive means slower with age)" : "Tyre age (laps)"}
        </text>
        <text x={22} y={145} textAnchor="middle" fill="rgba(245,245,247,0.72)" fontSize={11} transform="rotate(-90 22 145)">
          {viewMode === "ranked" ? "Constructors (ranked)" : "Lap time (s)"}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-2">
        {rankedTeams.map((team) => (
          <span
            key={team.team}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-3 px-2 py-1 text-caption text-secondary"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: resolveTeamColor(team.team) }} />
            {team.team}
          </span>
        ))}
      </div>

      <p className="mt-3 text-secondary-body text-muted">
        Method: all constructors included, degradation is lap-time change per lap of tyre age (positive means degrading, negative means improving), shared axes across teams.
      </p>
    </section>
  );
}
