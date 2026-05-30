"""Attribution-first insight generation."""

from __future__ import annotations

from app.engine.attribution import build_attribution_payload
from app.engine.llm import get_refiner


def build_insights_response(
    session_type: str,
    pace_payload: dict[str, Any],
    metrics_payload: dict[str, Any],
    circuit_payload: dict[str, Any],
) -> dict[str, Any]:
    payload = build_attribution_payload(
        session_type=session_type,
        pace_payload=pace_payload,
        metrics_payload=metrics_payload,
        circuit_payload=circuit_payload,
    )
    return get_refiner().refine(payload)
