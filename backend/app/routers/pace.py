from __future__ import annotations

from fastapi import APIRouter

from app.cache import make_key
from app.engine.pipeline import ensure_pace
from app.models import PaceResponse

router = APIRouter(tags=["pace"])


@router.get("/sessions/{year}/{round}/{session_type}/pace", response_model=PaceResponse)
def get_session_pace(year: int, round: int, session_type: str) -> PaceResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_pace(key, year, round, session_type)
    return PaceResponse.model_validate(payload)
