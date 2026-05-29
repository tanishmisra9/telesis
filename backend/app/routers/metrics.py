from __future__ import annotations

from fastapi import APIRouter

from app.cache import make_key
from app.engine.pipeline import ensure_metrics
from app.models import MetricsResponse

router = APIRouter(tags=["metrics"])


@router.get(
    "/sessions/{year}/{round}/{session_type}/metrics",
    response_model=MetricsResponse,
)
def get_session_metrics(year: int, round: int, session_type: str) -> MetricsResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_metrics(key, year, round, session_type)
    return MetricsResponse.model_validate(payload)
