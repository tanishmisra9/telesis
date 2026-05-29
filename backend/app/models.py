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
    inner: list[tuple[float, float]]
    outer: list[tuple[float, float]]
    corners: list[CircuitCorner] = Field(default_factory=list)
    drs_zones: list[DrsZone] = Field(default_factory=list)


class CornerSpeed(BaseModel):
    number: int
    speed_kmh: float


class DriverMetricEntry(BaseModel):
    abbr: str
    team: str
    lap_time_s: float
    top_speed_kmh: float
    min_speed_kmh: float
    full_throttle_pct: float
    fastest_corner: dict | None = None
    deployment_loss_kmh: float
    corner_speeds: list[CornerSpeed] = Field(default_factory=list)


class FastestCorner(BaseModel):
    number: int
    speed_kmh: float


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


class SessionStatus(BaseModel):
    key: str
    status: str
    event_name: str | None = None
    error_message: str | None = None


class ScheduleEntry(BaseModel):
    round: int
    event_name: str
    country: str | None = None
    has_sprint: bool
    session_types: list[str] = Field(default_factory=list)


class ProcessSessionResponse(BaseModel):
    key: str
    status: str


class ResultEntry(BaseModel):
    abbr: str
    full_name: str | None = None
    team: str
    team_color: str | None = None
    headshot_url: str | None = None
    driver_number: int | None = None
    grid: int | None = None
    position: int | None = None
    status: str | None = None


class ResultsResponse(BaseModel):
    session: SessionInfo
    results: list[ResultEntry] = Field(default_factory=list)
