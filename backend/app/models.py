from __future__ import annotations

from pydantic import BaseModel, Field


class SessionInfo(BaseModel):
    year: int
    round: int
    type: str
    event: str


class HealthResponse(BaseModel):
    status: str


class PaceBoxStats(BaseModel):
    mean: float
    median: float
    q1: float
    q3: float
    whisker_low: float
    whisker_high: float
    outliers: list[float] = Field(default_factory=list)
    n_laps: int
    compounds: list[str] = Field(default_factory=list)


class DriverPaceEntry(BaseModel):
    abbr: str
    team: str
    stats: PaceBoxStats
    gap_to_fastest_s: float


class ConstructorPaceEntry(BaseModel):
    team: str
    stats: PaceBoxStats
    gap_to_fastest_s: float


class PaceResponse(BaseModel):
    session: SessionInfo
    drivers: list[DriverPaceEntry]
    constructors: list[ConstructorPaceEntry]


class CircuitBBox(BaseModel):
    x_min: float
    x_max: float
    y_min: float
    y_max: float


class CircuitCorner(BaseModel):
    number: int
    dist_m: float
    x: float
    y: float


class DrsZone(BaseModel):
    start_m: float
    end_m: float
    polyline: list[tuple[float, float]]


class CircuitResponse(BaseModel):
    name: str
    length_m: float
    rotation_applied_deg: float
    bbox: CircuitBBox
    centerline: list[tuple[float, float]]
    centerline_dist_m: list[float] = Field(default_factory=list)
    inner: list[tuple[float, float]]
    outer: list[tuple[float, float]]
    corners: list[CircuitCorner] = Field(default_factory=list)
    drs_zones: list[DrsZone] = Field(default_factory=list)
    sector_splits: tuple[float, float] | None = None


class CornerSpeed(BaseModel):
    number: int
    min_speed_kmh: float


class DriverMetricEntry(BaseModel):
    abbr: str
    team: str
    lap_time_s: float
    top_speed_kmh: float
    min_speed_kmh: float
    full_throttle_pct: float
    deployment_loss_kmh: float
    corner_speeds: list[CornerSpeed] = Field(default_factory=list)
    speed_along_centerline: list[float] | None = None


class FastestCorner(BaseModel):
    number: int
    min_speed_kmh: float


class MetricsResponse(BaseModel):
    session: SessionInfo
    applicable: bool
    reason: str | None = None
    drivers: list[DriverMetricEntry] = Field(default_factory=list)
    fastest_corner: FastestCorner | None = None


class InsightItem(BaseModel):
    id: str  # team name or driver abbr
    phrases: list[str] = Field(default_factory=list)
    refined: str | None = None


class InsightsResponse(BaseModel):
    session: SessionInfo
    mode: str  # "race" or "quali"
    drivers: list[InsightItem] = Field(default_factory=list)
    constructors: list[InsightItem] = Field(default_factory=list)
    briefing: str = ""


class SessionStatus(BaseModel):
    key: str
    status: str
    event_name: str | None = None
    error_message: str | None = None


class ScheduleEntry(BaseModel):
    round: int
    event_name: str
    country: str | None = None
    location: str | None = None
    event_date: str | None = None
    has_sprint: bool
    session_types: list[str] = Field(default_factory=list)


class ScheduleResponse(BaseModel):
    year: int
    rounds: list[ScheduleEntry] = Field(default_factory=list)


class ProcessSessionResponse(BaseModel):
    key: str
    status: str


class DriverResultEntry(BaseModel):
    abbr: str
    full_name: str | None = None
    driver_number: int | None = None
    team: str
    team_color: str | None = None
    headshot_url: str | None = None
    country_code: str | None = None
    grid_position: int | None = None
    finish_position: int | None = None
    status: str | None = None
    fastest_lap_s: float | None = None
    fastest_lap_rank: int | None = None


class ResultsResponse(BaseModel):
    session: SessionInfo
    drivers: list[DriverResultEntry] = Field(default_factory=list)


class DriverTraceEntry(BaseModel):
    abbr: str
    team: str
    positions: list[int | None] = Field(default_factory=list)


class RaceTraceResponse(BaseModel):
    session: SessionInfo
    total_laps: int
    drivers: list[DriverTraceEntry] = Field(default_factory=list)
    applicable: bool
    reason: str | None = None


class StintEntry(BaseModel):
    stint_number: int
    compound: str
    lap_start: int
    lap_end: int
    tyre_age_start: int
    lap_count: int


class DriverStintsEntry(BaseModel):
    abbr: str
    team: str
    stints: list[StintEntry] = Field(default_factory=list)


class StintsResponse(BaseModel):
    session: SessionInfo
    total_laps: int
    drivers: list[DriverStintsEntry] = Field(default_factory=list)
    applicable: bool
    reason: str | None = None


class SpeedTraceLap(BaseModel):
    abbr: str
    team: str
    lap_time_s: float
    distance_m: list[float] = Field(default_factory=list)
    speed_kmh: list[float] = Field(default_factory=list)
    throttle_pct: list[float] = Field(default_factory=list)
    brake: list[float] = Field(default_factory=list)
    gear: list[int] = Field(default_factory=list)


class SpeedTraceCorner(BaseModel):
    number: int
    dist_m: float


class SpeedTraceResponse(BaseModel):
    session: SessionInfo
    sector_splits_m: list[float] | None = None
    corners: list[SpeedTraceCorner] = Field(default_factory=list)
    a: SpeedTraceLap
    b: SpeedTraceLap
    delta_a_minus_b_s: list[float] = Field(default_factory=list)


class StintDegPoint(BaseModel):
    tyre_age: int
    lap_time_s: float


class DriverStintDegEntry(BaseModel):
    stint_number: int
    compound: str
    points: list[StintDegPoint] = Field(default_factory=list)
    slope_s_per_lap: float
    intercept_s: float


class DriverTyreDegEntry(BaseModel):
    abbr: str
    team: str
    stints: list[DriverStintDegEntry] = Field(default_factory=list)


class TyreDegResponse(BaseModel):
    session: SessionInfo
    drivers: list[DriverTyreDegEntry] = Field(default_factory=list)
    applicable: bool
    reason: str | None = None


class TelemetryOverlayDriverEntry(BaseModel):
    abbr: str
    team: str
    speed_along_centerline: list[float] = Field(default_factory=list)


class TelemetryOverlayResponse(BaseModel):
    session: SessionInfo
    applicable: bool
    reason: str | None = None
    drivers: list[TelemetryOverlayDriverEntry] = Field(default_factory=list)
