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
  speed_class: "low" | "medium" | "high" | null;
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
  speed_along_centerline?: number[] | null;
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
  takeaway: string;
  headline_nuggets: string[];
  rank_chips: string[];
  profile: Record<string, number>;
  profile_ranks: Record<string, number>;
  evidence: string[];
  pace_rank: number | null;
  confidence: "high" | "medium" | "low";
  confidence_note: string | null;
}

export interface InsightsResponse {
  session: SessionInfo;
  mode: "practice" | "quali" | "race";
  verdict: string;
  drivers: InsightItem[];
  constructors: InsightItem[];
}

export type TelesisApiErrorCode =
  | "session_not_found"
  | "session_not_ready"
  | "upstream_unavailable"
  | "circuit_geometry_unavailable"
  | "invalid_driver";

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

export interface ScheduleEntry {
  round: number;
  event_name: string;
  country: string | null;
  location: string | null;
  event_date: string | null;
  has_sprint: boolean;
  session_types: string[];
}

export interface ScheduleResponse {
  year: number;
  rounds: ScheduleEntry[];
}

export interface SeasonConstructorPaceEntry {
  team: string;
  pace_rank: number;
  average_gap_s: number;
  rounds_sampled: number;
  rank_trend: Array<number | null>;
}

export interface SeasonStandingsEntry {
  position: number;
  name: string;
  points: number;
}

export interface SeasonStandings {
  constructors: SeasonStandingsEntry[];
  drivers: SeasonStandingsEntry[];
}

export interface SeasonRoundSummary {
  round: number;
  event_name: string;
  event_date: string | null;
  winner: string | null;
  pole: string | null;
  session_types: string[];
}

export interface SeasonOverviewResponse {
  year: number;
  total_rounds: number;
  analyzed_rounds: number;
  constructors: SeasonConstructorPaceEntry[];
  standings: SeasonStandings | null;
  calendar: SeasonRoundSummary[];
}

export interface DriverResultEntry {
  abbr: string;
  full_name: string | null;
  driver_number: number | null;
  team: string;
  team_color: string | null;
  headshot_url: string | null;
  country_code: string | null;
  grid_position: number | null;
  finish_position: number | null;
  status: string | null;
  fastest_lap_s: number | null;
  fastest_lap_rank: number | null;
}

export interface ResultsResponse {
  session: SessionInfo;
  drivers: DriverResultEntry[];
}

export interface DriverTraceEntry {
  abbr: string;
  team: string;
  positions: Array<number | null>;
}

export interface RaceTraceResponse {
  session: SessionInfo;
  total_laps: number;
  drivers: DriverTraceEntry[];
  applicable: boolean;
  reason: string | null;
}

export interface StintEntry {
  stint_number: number;
  compound: string;
  lap_start: number;
  lap_end: number;
  tyre_age_start: number;
  lap_count: number;
}

export interface DriverStintsEntry {
  abbr: string;
  team: string;
  stints: StintEntry[];
}

export interface StintsResponse {
  session: SessionInfo;
  total_laps: number;
  drivers: DriverStintsEntry[];
  applicable: boolean;
  reason: string | null;
}

export interface SpeedTraceLap {
  abbr: string;
  team: string;
  lap_time_s: number;
  distance_m: number[];
  speed_kmh: number[];
  throttle_pct: number[];
  brake: number[];
  gear: number[];
}

export interface SpeedTraceCorner {
  number: number;
  dist_m: number;
}

export interface SpeedTraceResponse {
  session: SessionInfo;
  sector_splits_m: number[] | null;
  corners: SpeedTraceCorner[];
  a: SpeedTraceLap;
  b: SpeedTraceLap;
  delta_a_minus_b_s: number[];
}

export interface StintDegPoint {
  tyre_age: number;
  lap_time_s: number;
}

export interface DriverStintDegEntry {
  stint_number: number;
  compound: string;
  points: StintDegPoint[];
  slope_s_per_lap: number;
  intercept_s: number;
}

export interface DriverTyreDegEntry {
  abbr: string;
  team: string;
  stints: DriverStintDegEntry[];
}

export interface TyreDegResponse {
  session: SessionInfo;
  drivers: DriverTyreDegEntry[];
  applicable: boolean;
  reason: string | null;
}

export interface TelemetryOverlayDriverEntry {
  abbr: string;
  team: string;
  speed_along_centerline: number[];
}

export interface TelemetryOverlayResponse {
  session: SessionInfo;
  applicable: boolean;
  reason: string | null;
  drivers: TelemetryOverlayDriverEntry[];
}
