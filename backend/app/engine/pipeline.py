"""Synchronous session processing pipeline."""

from __future__ import annotations

import json
from typing import Any

from app.cache import (
    get_circuit_cached,
    get_insights_cached,
    get_metrics_cached,
    get_pace_cached,
    upsert_processed,
)
from app.engine.circuit import CIRCUIT_LOGIC_VERSION, build_circuit_response
from app.engine.insights import build_insights_response
from app.engine.loader import load_session
from app.engine.metrics import build_metrics_response
from app.engine.pace import build_pace_response
from app.engine.telemetry import extract_all_drivers_telemetry


def run_session_pipeline(
    year: int, round_number: int, session_type: str
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    """
    Load session once and compute all payloads used by endpoints.
    """
    session_type = session_type.upper()
    session = load_session(year, round_number, session_type)
    extract_all_drivers_telemetry(session)
    pace_payload = build_pace_response(session, session_type)
    circuit_payload = build_circuit_response(session)
    metrics_payload = build_metrics_response(session, session_type, circuit_payload)
    insights_payload = build_insights_response(session_type, pace_payload, metrics_payload)
    return pace_payload, circuit_payload, metrics_payload, insights_payload


def run_single_payload_backfill(
    year: int, round_number: int, session_type: str
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Build all payloads from one loaded session for any backfill path."""
    session_type = session_type.upper()
    session = load_session(year, round_number, session_type)
    extract_all_drivers_telemetry(session)
    pace_payload = build_pace_response(session, session_type)
    circuit_payload = build_circuit_response(session)
    metrics_payload = build_metrics_response(session, session_type, circuit_payload)
    insights_payload = build_insights_response(session_type, pace_payload, metrics_payload)
    return pace_payload, circuit_payload, metrics_payload, insights_payload


def cache_session_payloads(
    key: str,
    year: int,
    round_number: int,
    session_type: str,
    pace_payload: dict[str, Any] | None,
    circuit_payload: dict[str, Any] | None,
    metrics_payload: dict[str, Any] | None,
    insights_payload: dict[str, Any] | None,
) -> None:
    event_name = ""
    if pace_payload:
        event_name = pace_payload["session"]["event"]
    elif circuit_payload:
        event_name = circuit_payload.get("name", "")

    upsert_processed(
        key=key,
        year=year,
        round=round_number,
        session_type=session_type,
        event_name=event_name,
        pace_json=json.dumps(pace_payload) if pace_payload else None,
        circuit_json=json.dumps(circuit_payload) if circuit_payload else None,
        metrics_json=json.dumps(metrics_payload) if metrics_payload else None,
        insights_json=json.dumps(insights_payload) if insights_payload else None,
    )


def ensure_pace(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_pace_cached(key)
    if cached is not None:
        return cached

    pace_payload, circuit_payload, metrics_payload, insights_payload = run_session_pipeline(
        year, round_number, session_type
    )
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        pace_payload,
        circuit_payload,
        metrics_payload,
        insights_payload,
    )
    return pace_payload


def _circuit_cache_stale(payload: dict[str, Any]) -> bool:
    """Recompute when cached circuit predates M4.5 sector/distance fields."""
    if payload.get("circuit_logic_version", 0) != CIRCUIT_LOGIC_VERSION:
        return True
    if "sector_splits" not in payload or "centerline_dist_m" not in payload:
        return True
    centerline = payload.get("centerline") or []
    dist_m = payload.get("centerline_dist_m") or []
    return bool(centerline) and len(dist_m) != len(centerline)


def ensure_circuit(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_circuit_cached(key)
    if cached is not None and not _circuit_cache_stale(cached):
        return cached

    pace_cached = get_pace_cached(key)
    if pace_cached is not None:
        _, circuit_payload, metrics_payload, insights_payload = run_single_payload_backfill(
            year, round_number, session_type
        )
        cache_session_payloads(
            key,
            year,
            round_number,
            session_type,
            None,
            circuit_payload,
            metrics_payload,
            insights_payload,
        )
        return circuit_payload

    pace_payload, circuit_payload, metrics_payload, insights_payload = run_session_pipeline(
        year, round_number, session_type
    )
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        pace_payload,
        circuit_payload,
        metrics_payload,
        insights_payload,
    )
    return circuit_payload


def ensure_metrics(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_metrics_cached(key)
    if cached is not None:
        return cached

    pace_cached = get_pace_cached(key)
    circuit_cached = get_circuit_cached(key)
    if pace_cached is not None and circuit_cached is not None:
        _, _, metrics_payload, insights_payload = run_single_payload_backfill(
            year, round_number, session_type
        )
        cache_session_payloads(
            key, year, round_number, session_type, None, None, metrics_payload, insights_payload
        )
        return metrics_payload

    pace_payload, circuit_payload, metrics_payload, insights_payload = run_session_pipeline(
        year, round_number, session_type
    )
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        pace_payload,
        circuit_payload,
        metrics_payload,
        insights_payload,
    )
    return metrics_payload


def ensure_insights(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_insights_cached(key)
    if cached is not None:
        return cached

    pace_cached = get_pace_cached(key)
    circuit_cached = get_circuit_cached(key)
    metrics_cached = get_metrics_cached(key)
    if pace_cached is not None and circuit_cached is not None and metrics_cached is not None:
        _, _, _, insights_payload = run_single_payload_backfill(
            year, round_number, session_type
        )
        cache_session_payloads(
            key, year, round_number, session_type, None, None, None, insights_payload
        )
        return insights_payload

    pace_payload, circuit_payload, metrics_payload, insights_payload = run_session_pipeline(
        year, round_number, session_type
    )
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        pace_payload,
        circuit_payload,
        metrics_payload,
        insights_payload,
    )
    return insights_payload
