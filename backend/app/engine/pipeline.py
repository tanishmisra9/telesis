"""Synchronous session processing pipeline."""

from __future__ import annotations

import json
from typing import Any

from app.cache import (
    get_circuit_cached,
    get_insights_cached,
    get_metrics_cached,
    get_pace_cached,
    get_racetrace_cached,
    get_results_cached,
    get_stints_cached,
    get_telemetry_overlay_cached,
    get_tyredeg_cached,
    upsert_processed,
)
from app.engine.circuit import CIRCUIT_LOGIC_VERSION, build_circuit_response
from app.engine.insights import build_insights_response
from app.engine.loader import load_session
from app.engine.metrics import build_metrics_response
from app.engine.pace import build_pace_response
from app.engine.racetrace import build_racetrace_response
from app.engine.results import build_results_response
from app.engine.stints import build_stints_response
from app.engine.telemetry_overlay import build_telemetry_overlay_response
from app.engine.tyredeg import build_tyredeg_response

PIPELINE_LOGIC_VERSION = 1


def _with_versions(payload: dict[str, Any]) -> dict[str, Any]:
    payload["pipeline_logic_version"] = PIPELINE_LOGIC_VERSION
    return payload


def _build_payloads_from_session(session, session_type: str) -> dict[str, dict[str, Any]]:
    pace_payload = _with_versions(build_pace_response(session, session_type))
    circuit_payload = _with_versions(build_circuit_response(session))
    metrics_payload = _with_versions(
        build_metrics_response(session, session_type, circuit_payload)
    )
    insights_payload = _with_versions(
        build_insights_response(session_type, pace_payload, metrics_payload)
    )
    results_payload = _with_versions(build_results_response(session, session_type))
    racetrace_payload = _with_versions(build_racetrace_response(session, session_type))
    stints_payload = _with_versions(build_stints_response(session, session_type))
    tyredeg_payload = _with_versions(build_tyredeg_response(session, session_type))
    telemetry_overlay_payload = _with_versions(
        build_telemetry_overlay_response(session, session_type, circuit_payload)
    )
    return {
        "pace": pace_payload,
        "circuit": circuit_payload,
        "metrics": metrics_payload,
        "insights": insights_payload,
        "results": results_payload,
        "racetrace": racetrace_payload,
        "stints": stints_payload,
        "tyredeg": tyredeg_payload,
        "telemetry_overlay": telemetry_overlay_payload,
    }


def run_session_pipeline(year: int, round_number: int, session_type: str) -> dict[str, dict[str, Any]]:
    """Load one session and compute all cache-backed payloads."""
    session_type = session_type.upper()
    session = load_session(year, round_number, session_type)
    return _build_payloads_from_session(session, session_type)


def run_single_payload_backfill(year: int, round_number: int, session_type: str) -> dict[str, dict[str, Any]]:
    """Build all payloads from one loaded session for any backfill path."""
    return run_session_pipeline(year, round_number, session_type)


def cache_session_payloads(
    key: str,
    year: int,
    round_number: int,
    session_type: str,
    payloads: dict[str, dict[str, Any] | None],
) -> None:
    pace_payload = payloads.get("pace")
    circuit_payload = payloads.get("circuit")
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
        metrics_json=json.dumps(payloads.get("metrics")) if payloads.get("metrics") else None,
        insights_json=json.dumps(payloads.get("insights")) if payloads.get("insights") else None,
        results_json=json.dumps(payloads.get("results")) if payloads.get("results") else None,
        racetrace_json=json.dumps(payloads.get("racetrace")) if payloads.get("racetrace") else None,
        stints_json=json.dumps(payloads.get("stints")) if payloads.get("stints") else None,
        tyredeg_json=json.dumps(payloads.get("tyredeg")) if payloads.get("tyredeg") else None,
        telemetry_overlay_json=(
            json.dumps(payloads.get("telemetry_overlay"))
            if payloads.get("telemetry_overlay")
            else None
        ),
    )


def _payload_stale(payload: dict[str, Any]) -> bool:
    return payload.get("pipeline_logic_version", 0) != PIPELINE_LOGIC_VERSION


def ensure_pace(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_pace_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached

    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        payloads,
    )
    return payloads["pace"]


def _circuit_cache_stale(payload: dict[str, Any]) -> bool:
    """Recompute when cached circuit predates M4.5 sector/distance fields."""
    if payload.get("circuit_logic_version", 0) != CIRCUIT_LOGIC_VERSION:
        return True
    if _payload_stale(payload):
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
        payloads = run_single_payload_backfill(year, round_number, session_type)
        cache_session_payloads(
            key,
            year,
            round_number,
            session_type,
            {
                "circuit": payloads["circuit"],
                "metrics": payloads["metrics"],
                "insights": payloads["insights"],
                "results": payloads["results"],
                "racetrace": payloads["racetrace"],
                "stints": payloads["stints"],
                "tyredeg": payloads["tyredeg"],
                "telemetry_overlay": payloads["telemetry_overlay"],
            },
        )
        return payloads["circuit"]

    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        payloads,
    )
    return payloads["circuit"]


def ensure_metrics(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_metrics_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached

    pace_cached = get_pace_cached(key)
    circuit_cached = get_circuit_cached(key)
    if pace_cached is not None and circuit_cached is not None:
        payloads = run_single_payload_backfill(year, round_number, session_type)
        cache_session_payloads(
            key,
            year,
            round_number,
            session_type,
            {
                "metrics": payloads["metrics"],
                "insights": payloads["insights"],
                "results": payloads["results"],
                "racetrace": payloads["racetrace"],
                "stints": payloads["stints"],
                "tyredeg": payloads["tyredeg"],
                "telemetry_overlay": payloads["telemetry_overlay"],
            },
        )
        return payloads["metrics"]

    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        payloads,
    )
    return payloads["metrics"]


def ensure_insights(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_insights_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached

    pace_cached = get_pace_cached(key)
    circuit_cached = get_circuit_cached(key)
    metrics_cached = get_metrics_cached(key)
    if pace_cached is not None and circuit_cached is not None and metrics_cached is not None:
        payloads = run_single_payload_backfill(year, round_number, session_type)
        cache_session_payloads(
            key,
            year,
            round_number,
            session_type,
            {
                "insights": payloads["insights"],
                "results": payloads["results"],
                "racetrace": payloads["racetrace"],
                "stints": payloads["stints"],
                "tyredeg": payloads["tyredeg"],
                "telemetry_overlay": payloads["telemetry_overlay"],
            },
        )
        return payloads["insights"]

    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(
        key,
        year,
        round_number,
        session_type,
        payloads,
    )
    return payloads["insights"]


def ensure_results(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_results_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached
    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(key, year, round_number, session_type, payloads)
    return payloads["results"]


def ensure_racetrace(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_racetrace_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached
    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(key, year, round_number, session_type, payloads)
    return payloads["racetrace"]


def ensure_stints(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_stints_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached
    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(key, year, round_number, session_type, payloads)
    return payloads["stints"]


def ensure_tyredeg(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_tyredeg_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached
    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(key, year, round_number, session_type, payloads)
    return payloads["tyredeg"]


def ensure_telemetry_overlay(
    key: str, year: int, round_number: int, session_type: str
) -> dict[str, Any]:
    cached = get_telemetry_overlay_cached(key)
    if cached is not None and not _payload_stale(cached):
        return cached
    payloads = run_session_pipeline(year, round_number, session_type)
    cache_session_payloads(key, year, round_number, session_type, payloads)
    return payloads["telemetry_overlay"]
