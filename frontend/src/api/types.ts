/** Compound tags from backend pace stats */
export type CompoundTag = "S" | "M" | "H" | "I" | "W";

export interface SessionInfo {
  year: number;
  round: number;
  type: string;
  event: string;
}

export interface PaceBoxStats {
  mean: number;
  median: number;
  q1: number;
  q3: number;
  whisker_low: number;
  whisker_high: number;
  outliers: number[];
  n_laps: number;
  compounds: CompoundTag[];
}

export interface DriverPaceEntry {
  abbr: string;
  team: string;
  stats: PaceBoxStats;
  gap_to_fastest_s: number;
}

export interface ConstructorPaceEntry {
  team: string;
  stats: PaceBoxStats;
  gap_to_fastest_s: number;
}

export interface PaceResponse {
  session: SessionInfo;
  drivers: DriverPaceEntry[];
  constructors: ConstructorPaceEntry[];
}

export interface CircuitBBox {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

export interface CircuitCorner {
  number: number;
  dist_m: number;
  x: number;
  y: number;
}

export interface DrsZone {
  start_m: number;
  end_m: number;
  polyline: [number, number][];
}

export interface CircuitResponse {
  name: string;
  length_m: number;
  rotation_applied_deg: number;
  bbox: CircuitBBox;
  centerline: [number, number][];
  centerline_dist_m: number[];
  inner: [number, number][];
  outer: [number, number][];
  corners: CircuitCorner[];
  drs_zones: DrsZone[];
  sector_splits: [number, number] | null;
}

export interface CornerSpeed {
  number: number;
  min_speed_kmh: number;
}

export interface DriverMetricEntry {
  abbr: string;
  team: string;
  lap_time_s: number;
  top_speed_kmh: number;
  min_speed_kmh: number;
  full_throttle_pct: number;
  deployment_loss_kmh: number;
  corner_speeds: CornerSpeed[];
}

export interface FastestCorner {
  number: number;
  min_speed_kmh: number;
}

export interface MetricsResponse {
  session: SessionInfo;
  applicable: boolean;
  reason: string | null;
  drivers: DriverMetricEntry[];
  fastest_corner: FastestCorner | null;
}

export interface InsightItem {
  id: string;
  phrases: string[];
  refined: string | null;
}

export interface InsightsResponse {
  session: SessionInfo;
  mode: "race" | "quali";
  drivers: InsightItem[];
  constructors: InsightItem[];
}

export type TelesisApiErrorCode =
  | "session_not_found"
  | "session_not_ready"
  | "upstream_unavailable"
  | "circuit_geometry_unavailable";

export interface TelesisApiErrorBody {
  error: TelesisApiErrorCode;
  message: string;
}

export interface SessionSelection {
  year: number;
  round: number;
  sessionType: string;
}

export type ChartViewMode = "drivers" | "constructors";

/** Row rendered in the pace chart (driver or constructor). */
export interface PaceChartRow {
  id: string;
  label: string;
  team: string;
  stats: PaceBoxStats;
  gap_to_fastest_s: number;
}

export interface InsightSelection {
  kind: "driver" | "constructor";
  id: string;
}
