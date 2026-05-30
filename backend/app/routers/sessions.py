from fastapi import APIRouter

from app.cache import make_key
from app.engine.loader import load_session
from app.engine.pipeline import (
    ensure_circuit,
    ensure_racetrace,
    ensure_results,
    ensure_stints,
    ensure_telemetry_overlay,
    ensure_tyredeg,
)
from app.engine.schedule import get_schedule_response
from app.engine.speedtrace import build_speedtrace_response
from app.models import (
    RaceTraceResponse,
    ResultsResponse,
    ScheduleResponse,
    SpeedTraceResponse,
    StintsResponse,
    TelemetryOverlayResponse,
    TyreDegResponse,
)

router = APIRouter(tags=["sessions"])


@router.get("/schedule/{year}", response_model=ScheduleResponse)
def get_schedule(year: int) -> ScheduleResponse:
    payload = get_schedule_response(year)
    return ScheduleResponse.model_validate(payload)


@router.get("/sessions/{year}/{round}/{session_type}/results", response_model=ResultsResponse)
def get_session_results(year: int, round: int, session_type: str) -> ResultsResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_results(key, year, round, session_type)
    return ResultsResponse.model_validate(payload)


@router.get("/sessions/{year}/{round}/{session_type}/racetrace", response_model=RaceTraceResponse)
def get_session_racetrace(year: int, round: int, session_type: str) -> RaceTraceResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_racetrace(key, year, round, session_type)
    return RaceTraceResponse.model_validate(payload)


@router.get("/sessions/{year}/{round}/{session_type}/stints", response_model=StintsResponse)
def get_session_stints(year: int, round: int, session_type: str) -> StintsResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_stints(key, year, round, session_type)
    return StintsResponse.model_validate(payload)


@router.get("/sessions/{year}/{round}/{session_type}/tyredeg", response_model=TyreDegResponse)
def get_session_tyredeg(year: int, round: int, session_type: str) -> TyreDegResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_tyredeg(key, year, round, session_type)
    return TyreDegResponse.model_validate(payload)


@router.get(
    "/sessions/{year}/{round}/{session_type}/telemetry-overlay",
    response_model=TelemetryOverlayResponse,
)
def get_session_telemetry_overlay(
    year: int, round: int, session_type: str
) -> TelemetryOverlayResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_telemetry_overlay(key, year, round, session_type)
    return TelemetryOverlayResponse.model_validate(payload)


@router.get(
    "/sessions/{year}/{round}/{session_type}/speedtrace/{abbr_a}/{abbr_b}",
    response_model=SpeedTraceResponse,
)
def get_session_speedtrace(
    year: int, round: int, session_type: str, abbr_a: str, abbr_b: str
) -> SpeedTraceResponse:
    session_type = session_type.upper()
    session = load_session(year, round, session_type)
    key = make_key(year, round, session_type)
    circuit_payload = ensure_circuit(key, year, round, session_type)
    payload = build_speedtrace_response(
        session=session,
        session_type=session_type,
        abbr_a=abbr_a,
        abbr_b=abbr_b,
        circuit_payload=circuit_payload,
    )
    return SpeedTraceResponse.model_validate(payload)
