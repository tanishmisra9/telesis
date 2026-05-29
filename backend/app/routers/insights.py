from __future__ import annotations

from fastapi import APIRouter

from app.cache import make_key
from app.engine.pipeline import ensure_insights
from app.models import InsightsResponse

router = APIRouter(tags=["insights"])


@router.get(
    "/sessions/{year}/{round}/{session_type}/insights",
    response_model=InsightsResponse,
)
def get_session_insights(year: int, round: int, session_type: str) -> InsightsResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_insights(key, year, round, session_type)
    return InsightsResponse.model_validate(payload)
