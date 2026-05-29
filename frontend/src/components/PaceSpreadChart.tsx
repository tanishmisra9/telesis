import { useMemo, useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import { motion, useReducedMotion } from "framer-motion";
import type {
  ChartViewMode,
  ConstructorPaceEntry,
  DriverPaceEntry,
  InsightSelection,
  PaceChartRow,
  PaceResponse,
} from "../api/types";
import { resolveTeamColor, teamColorWithAlpha } from "../design/teamColors";
import { colors } from "../design/tokens";

const MARGIN = { top: 24, right: 16, bottom: 88, left: 52 };
const WIDTH = 1100;
const HEIGHT = 480;
const INNER_W = WIDTH - MARGIN.left - MARGIN.right;
const INNER_H = HEIGHT - MARGIN.top - MARGIN.bottom;

function formatGap(gap: number): string {
  return `+${gap.toFixed(2)}`;
}

function formatCompounds(compounds: string[]): string {
  return compounds.length > 0 ? compounds.join("-") : "—";
}

function driversToRows(drivers: DriverPaceEntry[]): PaceChartRow[] {
  return drivers.map((d) => ({
    id: d.abbr,
    label: d.abbr,
    team: d.team,
    stats: d.stats,
    gap_to_fastest_s: d.gap_to_fastest_s,
  }));
}

function constructorsToRows(constructors: ConstructorPaceEntry[]): PaceChartRow[] {
  return constructors.map((c) => ({
    id: c.team,
    label: c.team,
    team: c.team,
    stats: c.stats,
    gap_to_fastest_s: c.gap_to_fastest_s,
  }));
}

interface PaceSpreadChartProps {
  pace: PaceResponse;
  selectedInsight: InsightSelection | null;
  onSelectInsight: (selection: InsightSelection | null) => void;
}

export function PaceSpreadChart({
  pace,
  selectedInsight,
  onSelectInsight,
}: PaceSpreadChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>("drivers");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const rows = useMemo(
    () =>
      viewMode === "drivers"
        ? driversToRows(pace.drivers)
        : constructorsToRows(pace.constructors),
    [pace, viewMode],
  );

  const { xScale, yScale, yTicks } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of rows) {
      const s = row.stats;
      lo = Math.min(lo, s.whisker_low, ...s.outliers);
      hi = Math.max(hi, s.whisker_high, ...s.outliers);
    }
    const pad = (hi - lo) * 0.06 || 0.5;
    const yMin = lo - pad;
    const yMax = hi + pad;

    const xScale = scaleBand<string>()
      .domain(rows.map((r) => r.id))
      .range([0, INNER_W])
      .paddingInner(0.35)
      .paddingOuter(0.12);

    const yScale = scaleLinear()
      .domain([yMin, yMax])
      .range([INNER_H, 0]);

    const tickCount = 6;
    const yTicks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      yTicks.push(yMin + ((yMax - yMin) * i) / (tickCount - 1));
    }

    return { xScale, yScale, yTicks };
  }, [rows]);

  const hovered = rows.find((r) => r.id === hoveredId) ?? null;

  return (
    <motion.div
      className="w-full overflow-x-auto rounded-card border border-line bg-panel p-5 shadow-panel"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-card-heading font-medium tracking-card-heading text-text">
          Pace spread
        </h2>
        <div
          className="inline-flex rounded-pill border border-line bg-glass p-0.5"
          role="group"
          aria-label="Chart view"
        >
          {(["drivers", "constructors"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-pill px-3 py-1 text-label transition-colors duration-200 ${
                viewMode === mode
                  ? "bg-accent-tint text-accent"
                  : "text-muted hover:text-text"
              }`}
            >
              {mode === "drivers" ? "Drivers" : "Constructors"}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="min-w-0 w-full max-w-full"
        role="img"
        aria-label="Pace spread box plot"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                x2={INNER_W}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke={colors.hairline}
                strokeDasharray="4 4"
              />
              <text
                x={-10}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill={colors.mutedText}
                fontSize={11}
              >
                {tick.toFixed(1)}s
              </text>
            </g>
          ))}

          {rows.map((row) => {
            const cx = (xScale(row.id) ?? 0) + xScale.bandwidth() / 2;
            const bw = Math.min(xScale.bandwidth() * 0.55, 28);
            const s = row.stats;
            const stroke = resolveTeamColor(row.team);
            const fill = teamColorWithAlpha(row.team, 0.28);
            const yQ1 = yScale(s.q1);
            const yQ3 = yScale(s.q3);
            const yMed = yScale(s.median);
            const yMean = yScale(s.mean);
            const yWhiLo = yScale(s.whisker_low);
            const yWhiHi = yScale(s.whisker_high);
            const boxTop = Math.min(yQ1, yQ3);
            const boxH = Math.abs(yQ3 - yQ1) || 1;
            const isHovered = hoveredId === row.id;

            return (
              <g
                key={row.id}
                onMouseEnter={() => setHoveredId(row.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() =>
                  onSelectInsight(
                    selectedInsight?.id === row.id
                      ? null
                      : {
                          kind: viewMode === "drivers" ? "driver" : "constructor",
                          id: row.id,
                        },
                  )
                }
                style={{ cursor: "pointer" }}
                opacity={hoveredId && !isHovered ? 0.45 : 1}
              >
                <line
                  x1={cx}
                  x2={cx}
                  y1={yWhiHi}
                  y2={yQ3}
                  stroke={stroke}
                  strokeWidth={1.5}
                />
                <line
                  x1={cx}
                  x2={cx}
                  y1={yQ1}
                  y2={yWhiLo}
                  stroke={stroke}
                  strokeWidth={1.5}
                />
                <line
                  x1={cx - bw / 2}
                  x2={cx + bw / 2}
                  y1={yWhiHi}
                  y2={yWhiHi}
                  stroke={stroke}
                  strokeWidth={1.5}
                />
                <line
                  x1={cx - bw / 2}
                  x2={cx + bw / 2}
                  y1={yWhiLo}
                  y2={yWhiLo}
                  stroke={stroke}
                  strokeWidth={1.5}
                />
                <rect
                  x={cx - bw / 2}
                  y={boxTop}
                  width={bw}
                  height={boxH}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={selectedInsight?.id === row.id ? 2.25 : 1}
                  rx={2}
                />
                <line
                  x1={cx - bw / 2}
                  x2={cx + bw / 2}
                  y1={yMed}
                  y2={yMed}
                  stroke={stroke}
                  strokeWidth={2}
                />
                <line
                  x1={cx - bw / 2}
                  x2={cx + bw / 2}
                  y1={yMean}
                  y2={yMean}
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                {s.outliers.map((o, i) => (
                  <circle
                    key={`${row.id}-o-${i}`}
                    cx={cx}
                    cy={yScale(o)}
                    r={3}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1.25}
                  />
                ))}
                <text
                  x={cx}
                  y={INNER_H + 18}
                  textAnchor="middle"
                  fill={colors.text}
                  fontSize={12}
                  fontWeight={500}
                >
                  {row.label}
                </text>
                <text
                  x={cx}
                  y={INNER_H + 34}
                  textAnchor="middle"
                  fill={colors.mutedText}
                  fontSize={10}
                >
                  {formatGap(row.gap_to_fastest_s)}
                </text>
                <text
                  x={cx}
                  y={INNER_H + 48}
                  textAnchor="middle"
                  fill={colors.mutedText}
                  fontSize={10}
                >
                  {formatCompounds(s.compounds)}
                </text>
              </g>
            );
          })}

          {hovered && (
            <foreignObject
              x={Math.min(INNER_W - 200, Math.max(0, (xScale(hovered.id) ?? 0)))}
              y={8}
              width={200}
              height={120}
            >
              <div className="rounded-inner border border-line bg-glass px-3 py-2 text-micro text-text shadow-glass backdrop-blur-glass">
                <div className="font-medium">{hovered.label}</div>
                <div className="mt-1 text-muted">{hovered.team}</div>
                <div className="mt-2 space-y-0.5 text-muted">
                  <div>Mean {hovered.stats.mean.toFixed(3)}s</div>
                  <div>Median {hovered.stats.median.toFixed(3)}s</div>
                  <div>
                    Q1–Q3 {hovered.stats.q1.toFixed(3)}–{hovered.stats.q3.toFixed(3)}s
                  </div>
                  <div>
                    Whiskers {hovered.stats.whisker_low.toFixed(3)}–
                    {hovered.stats.whisker_high.toFixed(3)}s
                  </div>
                  <div>{hovered.stats.n_laps} laps</div>
                </div>
              </div>
            </foreignObject>
          )}
        </g>
      </svg>

      <p className="mt-3 max-w-prose text-micro text-muted">
        Dashed line mean, solid line median, box is the middle 50 percent of laps,
        whiskers cover 99.3 percent, dots are outliers.
      </p>
    </motion.div>
  );
}
