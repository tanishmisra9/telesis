from __future__ import annotations

from fastapi import APIRouter

from app.cache import make_key
from app.engine.pipeline import ensure_circuit
from app.models import CircuitResponse

router = APIRouter(tags=["circuit"])


@router.get(
    "/sessions/{year}/{round}/{session_type}/circuit",
    response_model=CircuitResponse,
)
def get_session_circuit(year: int, round: int, session_type: str) -> CircuitResponse:
    session_type = session_type.upper()
    key = make_key(year, round, session_type)
    payload = ensure_circuit(key, year, round, session_type)
    return CircuitResponse.model_validate(payload)
