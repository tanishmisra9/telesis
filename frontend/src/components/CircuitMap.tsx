import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { CircuitResponse, ResultsResponse, TelemetryOverlayResponse } from "../api/types";
import { circuit, colors } from "../design/tokens";

const MARGIN = 80;
const CORNER_OFFSET = 110;
const CHEVRON_SIZE = 11;
const SECTOR_STROKE_WIDTH = 8;
const SECTOR_STROKE_WIDTH_NEUTRAL = 3.5;
const DRS_STROKE_WIDTH = 5;

// Pick corner rendering mode.
// Start with A (numbers always visible); switch to B if Bahrain-level density
// proves visually cluttered at the target panel size.
const CORNER_RENDER_MODE: "A" | "B" = "A";

type Point = [number, number];

function flipY(y: number, bbox: CircuitResponse["bbox"]): number {
  return bbox.y_max + bbox.y_min - y;
}

function polylinePath(
  points: Point[],
  bbox: CircuitResponse["bbox"],
): string {
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
    .map(([x, y], i) => {
      const fy = flipY(y, bbox);
      return `${i === 0 ? "L" : "L"} ${x} ${fy}`;
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

function sliceCenterlineSegment(
  points: Point[],
  start: number,
  end: number,
): Point[] {
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
  if (
    !splits ||
    centerline.length < 2 ||
    distM.length !== centerline.length
  ) {
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
  onSelectDriver?: (abbr: string) => void;
}

function speedColor(value: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const r = Math.round(70 + t * 180);
  const g = Math.round(90 + (1 - Math.abs(t - 0.5) * 2) * 120);
  const b = Math.round(220 - t * 150);
  return `rgb(${r},${g},${b})`;
}

export function CircuitMap({
  circuit: circuitData,
  telemetryOverlay,
  results,
  selectedDriver,
  onSelectDriver,
}: CircuitMapProps) {
  const [hoveredCorner, setHoveredCorner] = useState<number | null>(null);
  const [layer, setLayer] = useState<"sectors" | "speed" | "drs">("sectors");
  const prefersReducedMotion = useReducedMotion();
  const cornerMode = CORNER_RENDER_MODE;

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
    return [
      Math.floor(n * 0.28),
      Math.floor(n * 0.52),
      Math.floor(n * 0.76),
    ];
  }, [circuitData.centerline.length]);

  const start = circuitData.centerline[0];
  const startTangent =
    circuitData.centerline.length > 1
      ? tangentAt(circuitData.centerline, 0)
      : ([1, 0] as [number, number]);
  const startY = start ? flipY(start[1], circuitData.bbox) : 0;
  const sfNormalX = -startTangent[1];
  const sfNormalY = startTangent[0];
  const speedEntry = telemetryOverlay?.drivers.find((d) => d.abbr === selectedDriver) ?? telemetryOverlay?.drivers[0];
  const speedValues = speedEntry?.speed_along_centerline ?? [];
  const speedMin = speedValues.length ? Math.min(...speedValues) : 0;
  const speedMax = speedValues.length ? Math.max(...speedValues) : 1;

  return (
    <motion.div
      className="w-full rounded-card border border-line bg-panel p-5 shadow-panel"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-card-heading font-medium tracking-card-heading text-text">
          Circuit map
        </h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-pill border border-line bg-glass p-0.5">
            {(["sectors", "speed", "drs"] as const).map((name) => (
              <button
                key={name}
                type="button"
                className={`rounded-pill px-2 py-1 text-micro ${
                  layer === name ? "bg-accent-tint text-accent" : "text-muted"
                }`}
                onClick={() => setLayer(name)}
              >
                {name === "drs" ? "DRS" : name[0].toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>
          {layer === "speed" && telemetryOverlay?.drivers.length && (
            <select
              value={speedEntry?.abbr ?? ""}
              onChange={(e) => onSelectDriver?.(e.target.value)}
              className="rounded-pill border border-line bg-surface-3 px-2 py-1 text-micro"
            >
              {(results?.drivers ?? telemetryOverlay.drivers).map((d) => (
                <option key={d.abbr} value={d.abbr}>
                  {d.abbr}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-micro text-muted">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-[2px] w-10 rounded"
            style={{ background: circuit.sector1 }}
          />
          <span>S1</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-[2px] w-10 rounded"
            style={{ background: circuit.sector2 }}
          />
          <span>S2</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-[2px] w-10 rounded"
            style={{ background: circuit.sector3 }}
          />
          <span>S3</span>
        </div>
      </div>
      {layer === "speed" && speedValues.length > 1 && (
        <div className="mb-3 flex items-center gap-2 text-micro text-muted">
          <span>{speedMin.toFixed(0)} km/h</span>
          <div className="h-2 w-44 rounded-pill bg-[linear-gradient(90deg,rgb(70,90,220),rgb(160,210,120),rgb(250,120,70))]" />
          <span>{speedMax.toFixed(0)} km/h</span>
        </div>
      )}

      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="mx-auto h-auto w-full min-h-[320px] max-h-[min(52vh,560px)]"
        role="img"
        aria-label={`Track map of ${circuitData.name}`}
      >
        <path
          d={trackPath}
          fill={circuit.trackSurface}
          stroke={circuit.trackEdge}
          strokeWidth={1.2}
        />

        {layer === "sectors" &&
          sectorSegments.map((segment, idx) => (
          <path
            key={`sector-${idx}`}
            d={polylinePath(segment.points, circuitData.bbox)}
            fill="none"
            stroke={segment.color}
            strokeWidth={
              circuitData.sector_splits ? SECTOR_STROKE_WIDTH : SECTOR_STROKE_WIDTH_NEUTRAL
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={circuitData.sector_splits ? 1 : 0.45}
          />
          ))}

        {layer === "speed" &&
          speedValues.length > 2 &&
          circuitData.centerline.slice(1).map((point, idx) => {
            const prev = circuitData.centerline[idx];
            const val = speedValues[idx] ?? speedValues[0];
            return (
              <line
                key={`speed-${idx}`}
                x1={prev[0]}
                y1={flipY(prev[1], circuitData.bbox)}
                x2={point[0]}
                y2={flipY(point[1], circuitData.bbox)}
                stroke={speedColor(val, speedMin, speedMax)}
                strokeWidth={6}
                strokeLinecap="round"
              />
            );
          })}

        {(layer === "drs" ? circuitData.drs_zones : []).map((zone, idx) => (
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
                y={
                  flipY(
                    zone.polyline[Math.floor(zone.polyline.length / 2)][1],
                    circuitData.bbox,
                  ) - 14
                }
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
                r={
                  cornerMode === "A" ? (isHovered ? 11 : 9) : 4.2
                }
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
                  fontWeight={800}
                >
                  {corner.number}
                </text>
              )}
              {isHovered && cornerMode === "A" && (
                <text
                  x={ox}
                  y={cy + 22}
                  textAnchor="middle"
                  fill={colors.mutedText}
                  fontSize={9}
                >
                  T{corner.number}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}
