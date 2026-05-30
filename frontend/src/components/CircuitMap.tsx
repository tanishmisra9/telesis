import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { CircuitResponse, ResultsResponse, TelemetryOverlayResponse } from "../api/types";
import { resolveTeamColor } from "../design/teamColors";
import { circuit, colors } from "../design/tokens";

const MARGIN = 80;
const CORNER_OFFSET = 110;
const CHEVRON_SIZE = 11;
const SECTOR_STROKE_WIDTH = 10;
const SECTOR_STROKE_WIDTH_NEUTRAL = 3.5;
const DRS_STROKE_WIDTH = 6;
const CORNER_RENDER_MODE: "A" | "B" = "A";

type Point = [number, number];

function flipY(y: number, bbox: CircuitResponse["bbox"]): number {
  return bbox.y_max + bbox.y_min - y;
}

function polylinePath(points: Point[], bbox: CircuitResponse["bbox"]): string {
  if (points.length === 0) return "";
  return points
    .map(([x, y], i) => {
      const fy = flipY(y, bbox);
      return `${i === 0 ? "M" : "L"} ${x} ${fy}`;
    })
    .join(" ");
}

function closedRibbonPath(
  outer: Point[],
  inner: Point[],
  bbox: CircuitResponse["bbox"],
): string {
  const outerPath = polylinePath(outer, bbox);
  const innerReversed = [...inner].reverse();
  const innerPath = innerReversed
    .map(([x, y]) => {
      const fy = flipY(y, bbox);
      return `L ${x} ${fy}`;
    })
    .join(" ");
  return `${outerPath} ${innerPath} Z`;
}

function tangentAt(points: Point[], index: number): [number, number] {
  const prev = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const dx = next[0] - prev[0];
  const dy = next[1] - prev[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function findSplitIndex(distances: number[], threshold: number): number {
  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= threshold) return i;
  }
  return Math.max(0, distances.length - 1);
}

function sliceCenterlineSegment(points: Point[], start: number, end: number): Point[] {
  if (points.length === 0 || start >= end) return [];
  const segment = points.slice(start, end + 1);
  return segment.length >= 2 ? segment : [];
}

interface SectorSegment {
  points: Point[];
  color: string;
}

function buildSectorSegments(
  centerline: Point[],
  distM: number[],
  splits: [number, number] | null,
): SectorSegment[] {
  if (!splits || centerline.length < 2 || distM.length !== centerline.length) {
    return [{ points: centerline, color: circuit.sectorNeutral }];
  }
  const idx1 = findSplitIndex(distM, splits[0]);
  const idx2 = findSplitIndex(distM, splits[1]);
  const seg1 = sliceCenterlineSegment(centerline, 0, idx1);
  const seg2 = sliceCenterlineSegment(centerline, idx1, idx2);
  const seg3 = sliceCenterlineSegment(centerline, idx2, centerline.length - 1);
  return [
    { points: seg1, color: circuit.sector1 },
    { points: seg2, color: circuit.sector2 },
    { points: seg3, color: circuit.sector3 },
  ].filter((s) => s.points.length >= 2);
}

function nearestCenterlineIndex(distances: number[], target: number): number {
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < distances.length; i++) {
    const diff = Math.abs(distances[i] - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function offsetCornerPosition(
  corner: { x: number; y: number; dist_m: number },
  centerline: Point[],
  distM: number[],
): Point {
  if (centerline.length < 2 || distM.length !== centerline.length) {
    return [corner.x, corner.y];
  }
  const idx = nearestCenterlineIndex(distM, corner.dist_m);
  const [tx, ty] = tangentAt(centerline, idx);
  let nx = -ty;
  let ny = tx;
  const anchor = centerline[idx];
  const vx = corner.x - anchor[0];
  const vy = corner.y - anchor[1];
  if (nx * vx + ny * vy < 0) {
    nx = -nx;
    ny = -ny;
  }
  return [corner.x + nx * CORNER_OFFSET, corner.y + ny * CORNER_OFFSET];
}

function chevronPoints(
  x: number,
  y: number,
  tx: number,
  ty: number,
  size: number,
): string {
  const tipX = x + tx * size;
  const tipY = y + ty * size;
  const baseX = x - tx * size * 0.55;
  const baseY = y - ty * size * 0.55;
  const px = -ty * size * 0.45;
  const py = tx * size * 0.45;
  return `${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`;
}

interface CircuitMapProps {
  circuit: CircuitResponse;
  telemetryOverlay?: TelemetryOverlayResponse | null;
  results?: ResultsResponse | null;
  selectedDriver?: string | null;
  selectedConstructor?: string | null;
  onSelectDriver?: (abbr: string | null) => void;
}

export function CircuitMap({
  circuit: circuitData,
  telemetryOverlay,
  results,
  selectedDriver,
  selectedConstructor,
  onSelectDriver,
}: CircuitMapProps) {
  const [hoveredCorner, setHoveredCorner] = useState<number | null>(null);
  const [mode, setMode] = useState<"sectors" | "dominance" | "delta">("sectors");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const cornerMode = CORNER_RENDER_MODE;
  void onSelectDriver;

  const viewBox = useMemo(() => {
    const { bbox } = circuitData;
    const minX = bbox.x_min - MARGIN;
    const maxX = bbox.x_max + MARGIN;
    const minY = bbox.y_min - MARGIN;
    const maxY = bbox.y_max + MARGIN;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [circuitData]);

  const trackPath = useMemo(
    () => closedRibbonPath(circuitData.outer, circuitData.inner, circuitData.bbox),
    [circuitData],
  );

  const sectorSegments = useMemo(
    () =>
      buildSectorSegments(
        circuitData.centerline,
        circuitData.centerline_dist_m ?? [],
        circuitData.sector_splits,
      ),
    [circuitData],
  );

  const chevronIndices = useMemo(() => {
    const n = circuitData.centerline.length;
    if (n < 4) return [];
    return [Math.floor(n * 0.28), Math.floor(n * 0.52), Math.floor(n * 0.76)];
  }, [circuitData.centerline.length]);

  const start = circuitData.centerline[0];
  const startTangent =
    circuitData.centerline.length > 1
      ? tangentAt(circuitData.centerline, 0)
      : ([1, 0] as [number, number]);
  const startY = start ? flipY(start[1], circuitData.bbox) : 0;
  const sfNormalX = -startTangent[1];
  const sfNormalY = startTangent[0];

  const speedSources = useMemo(() => {
    const driverSpeeds = new Map<string, number[]>();
    for (const driver of telemetryOverlay?.drivers ?? []) {
      driverSpeeds.set(driver.abbr, driver.speed_along_centerline);
    }
    const teamFromDriver = new Map<string, string>();
    for (const row of results?.drivers ?? []) {
      teamFromDriver.set(row.abbr, row.team);
    }
    for (const row of telemetryOverlay?.drivers ?? []) {
      if (!teamFromDriver.has(row.abbr)) teamFromDriver.set(row.abbr, row.team);
    }
    const constructorSpeeds = new Map<string, number[]>();
    const counts = new Map<string, number>();
    for (const [abbr, speed] of driverSpeeds.entries()) {
      const team = teamFromDriver.get(abbr);
      if (!team) continue;
      counts.set(team, (counts.get(team) ?? 0) + 1);
      const existing = constructorSpeeds.get(team);
      if (!existing) {
        constructorSpeeds.set(team, [...speed]);
      } else {
        for (let i = 0; i < Math.min(existing.length, speed.length); i++) {
          existing[i] += speed[i];
        }
      }
    }
    for (const [team, arr] of constructorSpeeds.entries()) {
      const count = counts.get(team) ?? 1;
      for (let i = 0; i < arr.length; i++) arr[i] = arr[i] / count;
    }
    return { driverSpeeds, constructorSpeeds };
  }, [results, telemetryOverlay]);

  const dominanceTeams = useMemo(() => {
    const entries = Array.from(speedSources.constructorSpeeds.entries());
    if (!entries.length) return [];
    const length = entries[0][1].length;
    const byIndex: string[] = [];
    for (let idx = 0; idx < length; idx++) {
      let bestTeam = entries[0][0];
      let bestValue = entries[0][1][idx] ?? -Infinity;
      for (let i = 1; i < entries.length; i++) {
        const [team, values] = entries[i];
        const value = values[idx] ?? -Infinity;
        if (value > bestValue) {
          bestValue = value;
          bestTeam = team;
        }
      }
      byIndex.push(bestTeam);
    }
    return byIndex;
  }, [speedSources.constructorSpeeds]);

  const deltaSeries = useMemo(() => {
    const length = circuitData.centerline.length;
    if (!length) return null;
    const constructorEntries = Array.from(speedSources.constructorSpeeds.values());
    if (!constructorEntries.length) return null;
    const fieldMean = new Array<number>(length).fill(0);
    for (let idx = 0; idx < length; idx++) {
      let sum = 0;
      let count = 0;
      for (const values of constructorEntries) {
        if (typeof values[idx] === "number") {
          sum += values[idx];
          count += 1;
        }
      }
      fieldMean[idx] = count ? sum / count : 0;
    }
    const selected =
      (selectedDriver ? speedSources.driverSpeeds.get(selectedDriver) : undefined) ??
      (selectedConstructor ? speedSources.constructorSpeeds.get(selectedConstructor) : undefined);
    if (!selected) return null;
    return selected.map((value, idx) => value - fieldMean[idx]);
  }, [
    circuitData.centerline.length,
    selectedConstructor,
    selectedDriver,
    speedSources.constructorSpeeds,
    speedSources.driverSpeeds,
  ]);

  const deltaMaxAbs = useMemo(
    () => (deltaSeries?.length ? Math.max(1, ...deltaSeries.map((v) => Math.abs(v))) : 1),
    [deltaSeries],
  );

  const tooltip = useMemo(() => {
    if (hoveredIndex === null) return null;
    const point = circuitData.centerline[hoveredIndex];
    if (!point) return null;
    const y = flipY(point[1], circuitData.bbox);
    if (mode === "dominance") {
      const team = dominanceTeams[hoveredIndex];
      if (!team) return null;
      return { x: point[0], y: y - 14, label: `${team} fastest on this segment` };
    }
    if (mode === "delta" && deltaSeries) {
      const delta = deltaSeries[hoveredIndex] ?? 0;
      return {
        x: point[0],
        y: y - 14,
        label: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} km/h vs field`,
      };
    }
    return null;
  }, [circuitData.bbox, circuitData.centerline, deltaSeries, dominanceTeams, hoveredIndex, mode]);

  const dominanceLegend = useMemo(() => {
    const seen = new Set<string>();
    const items: string[] = [];
    for (const team of dominanceTeams) {
      if (!team || seen.has(team)) continue;
      seen.add(team);
      items.push(team);
    }
    return items;
  }, [dominanceTeams]);

  return (
    <motion.div
      className="w-full rounded-card border border-line bg-panel p-5 shadow-panel"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-card-heading font-medium tracking-card-heading text-text">Circuit map</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectDriver?.(null)}
            disabled={!selectedDriver}
            className={`rounded-pill border border-line px-2.5 py-1 text-caption ${
              selectedDriver ? "bg-surface-3 text-secondary" : "bg-surface-2 text-tertiary"
            }`}
          >
            Clear selection
          </button>
          <div className="inline-flex rounded-pill border border-line bg-glass p-0.5">
            {(["sectors", "dominance", "delta"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setMode(entry)}
                className={`rounded-pill px-2.5 py-1 text-caption ${
                  mode === entry ? "bg-accent-tint text-accent" : "text-secondary"
                }`}
              >
                {entry === "sectors"
                  ? "Sectors"
                  : entry === "dominance"
                    ? "Track dominance"
                    : "Selected delta"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-micro text-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-10 rounded" style={{ background: circuit.sector1 }} />
          <span>S1</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-10 rounded" style={{ background: circuit.sector2 }} />
          <span>S2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-10 rounded" style={{ background: circuit.sector3 }} />
          <span>S3</span>
        </div>
      </div>

      {mode === "dominance" && (
        <div className="mb-3 flex flex-wrap gap-2">
          {dominanceLegend.map((team) => (
            <span
              key={team}
              className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-3 px-2 py-1 text-caption text-secondary"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: resolveTeamColor(team) }} />
              {team}
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto h-auto w-full min-h-[320px] max-h-[min(52vh,560px)]"
        role="img"
        aria-label={`Track map of ${circuitData.name}`}
        onMouseMove={(event) => {
          const svg = event.currentTarget;
          const rect = svg.getBoundingClientRect();
          const vx = svg.viewBox.baseVal;
          const px = ((event.clientX - rect.left) / rect.width) * vx.width + vx.x;
          const py = ((event.clientY - rect.top) / rect.height) * vx.height + vx.y;
          let bestIdx = 0;
          let bestDist = Number.POSITIVE_INFINITY;
          for (let i = 0; i < circuitData.centerline.length; i++) {
            const point = circuitData.centerline[i];
            if (!point) continue;
            const dx = point[0] - px;
            const dy = flipY(point[1], circuitData.bbox) - py;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = i;
            }
          }
          setHoveredIndex(bestIdx);
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <path d={trackPath} fill={circuit.trackSurface} stroke={circuit.trackEdge} strokeWidth={2.8} />

        {mode === "sectors" &&
          sectorSegments.map((segment, idx) => (
            <path
              key={`sector-${idx}`}
              d={polylinePath(segment.points, circuitData.bbox)}
              fill="none"
              stroke={segment.color}
              strokeWidth={circuitData.sector_splits ? SECTOR_STROKE_WIDTH : SECTOR_STROKE_WIDTH_NEUTRAL}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={circuitData.sector_splits ? 1 : 0.45}
            />
          ))}

        {mode === "dominance" &&
          circuitData.centerline.slice(1).map((point, idx) => {
            const prev = circuitData.centerline[idx];
            const team = dominanceTeams[idx] ?? "";
            return (
              <line
                key={`dom-${idx}`}
                x1={prev[0]}
                y1={flipY(prev[1], circuitData.bbox)}
                x2={point[0]}
                y2={flipY(point[1], circuitData.bbox)}
                stroke={resolveTeamColor(team)}
                strokeWidth={9}
                strokeLinecap="round"
                opacity={0.92}
              />
            );
          })}

        {mode === "delta" &&
          deltaSeries &&
          circuitData.centerline.slice(1).map((point, idx) => {
            const prev = circuitData.centerline[idx];
            const delta = deltaSeries[idx] ?? 0;
            const t = Math.min(1, Math.abs(delta) / deltaMaxAbs);
            const color =
              delta >= 0
                ? `rgba(${Math.round(105 - t * 25)}, ${Math.round(188 + t * 45)}, ${Math.round(118 - t * 40)}, 0.95)`
                : `rgba(${Math.round(202 + t * 35)}, ${Math.round(108 - t * 38)}, ${Math.round(104 - t * 38)}, 0.95)`;
            return (
              <line
                key={`delta-${idx}`}
                x1={prev[0]}
                y1={flipY(prev[1], circuitData.bbox)}
                x2={point[0]}
                y2={flipY(point[1], circuitData.bbox)}
                stroke={color}
                strokeWidth={8}
                strokeLinecap="round"
              />
            );
          })}

        {circuitData.drs_zones.map((zone, idx) => (
          <g key={`drs-${idx}`}>
            <path
              d={polylinePath(zone.polyline, circuitData.bbox)}
              fill="none"
              stroke={circuit.drs}
              strokeWidth={DRS_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.75}
            />
            {zone.polyline.length > 0 && (
              <text
                x={zone.polyline[Math.floor(zone.polyline.length / 2)][0]}
                y={flipY(zone.polyline[Math.floor(zone.polyline.length / 2)][1], circuitData.bbox) - 14}
                textAnchor="middle"
                fill={circuit.drs}
                fontSize={10}
                fontWeight={700}
              >
                DRS
              </text>
            )}
          </g>
        ))}

        {chevronIndices.map((idx) => {
          const pt = circuitData.centerline[idx];
          if (!pt) return null;
          const [tx, ty] = tangentAt(circuitData.centerline, idx);
          const cx = pt[0];
          const cy = flipY(pt[1], circuitData.bbox);
          return (
            <polygon
              key={`chevron-${idx}`}
              points={chevronPoints(cx, cy, tx, -ty, CHEVRON_SIZE)}
              fill={circuit.startFinish}
              opacity={0.85}
            />
          );
        })}

        {start && (
          <g>
            <line
              x1={start[0] + sfNormalX * 14}
              x2={start[0] - sfNormalX * 14}
              y1={startY + sfNormalY * 14}
              y2={startY - sfNormalY * 14}
              stroke={circuit.startFinishAccent}
              strokeWidth={4.5}
              strokeLinecap="round"
            />
            <line
              x1={start[0] + sfNormalX * 10}
              x2={start[0] - sfNormalX * 10}
              y1={startY + sfNormalY * 10}
              y2={startY - sfNormalY * 10}
              stroke={circuit.startFinish}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <text
              x={start[0] + sfNormalX * 22}
              y={startY + sfNormalY * 22 - 4}
              textAnchor="middle"
              fill={circuit.startFinish}
              fontSize={12}
              fontWeight={700}
            >
              S/F
            </text>
          </g>
        )}

        {circuitData.corners.map((corner) => {
          const [ox, oy] = offsetCornerPosition(
            corner,
            circuitData.centerline,
            circuitData.centerline_dist_m ?? [],
          );
          const cy = flipY(oy, circuitData.bbox);
          const isHovered = hoveredCorner === corner.number;
          const renderNumber = cornerMode === "A" || isHovered;
          return (
            <g
              key={corner.number}
              onMouseEnter={() => setHoveredCorner(corner.number)}
              onMouseLeave={() => setHoveredCorner(null)}
            >
              <circle
                cx={ox}
                cy={cy}
                r={cornerMode === "A" ? (isHovered ? 11 : 9) : 4.2}
                fill={circuit.startFinish}
                stroke={cornerMode === "A" ? circuit.startFinishAccent : "none"}
                strokeWidth={cornerMode === "A" ? 2.1 : 0}
              />
              {renderNumber && (
                <text
                  x={ox}
                  y={cy + (cornerMode === "A" ? 4.5 : 3.8)}
                  textAnchor="middle"
                  fill={colors.panel}
                  fontSize={cornerMode === "A" ? 12 : 11}
                  fontWeight={700}
                >
                  {corner.number}
                </text>
              )}
            </g>
          );
        })}

        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 82}
              y={tooltip.y - 18}
              width={164}
              height={20}
              rx={10}
              fill="rgba(10,10,14,0.85)"
              stroke="rgba(255,255,255,0.16)"
            />
            <text x={tooltip.x} y={tooltip.y - 4} textAnchor="middle" fill={colors.textPrimary} fontSize={10}>
              {tooltip.label}
            </text>
          </g>
        )}
      </svg>

      {mode === "dominance" && (
        <p className="mt-2 text-caption text-muted">
          Track dominance highlights which constructor is fastest through each segment.
        </p>
      )}
      {mode === "delta" && (
        <p className="mt-2 text-caption text-muted">
          Selected delta shows gain or loss versus field-average speed by segment.
        </p>
      )}
    </motion.div>
  );
}
