from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS processed_session (
    key TEXT PRIMARY KEY,
    year INTEGER NOT NULL,
    round INTEGER NOT NULL,
    session_type TEXT NOT NULL,
    event_name TEXT,
    status TEXT NOT NULL,
    pace_json TEXT,
    circuit_json TEXT,
    metrics_json TEXT,
    insights_json TEXT,
    results_json TEXT,
    racetrace_json TEXT,
    stints_json TEXT,
    tyredeg_json TEXT,
    telemetry_overlay_json TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)
"""


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    settings = get_settings()
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _migrate_schema(conn: sqlite3.Connection) -> None:
    cols = {
        row[1] for row in conn.execute("PRAGMA table_info(processed_session)").fetchall()
    }

    def add_column_if_missing(name: str, sql_type: str = "TEXT") -> None:
        if name in cols:
            return
        try:
            conn.execute(
                f"ALTER TABLE processed_session ADD COLUMN {name} {sql_type}"
            )
        except sqlite3.OperationalError as exc:
            if "duplicate column name" not in str(exc).lower():
                raise

    add_column_if_missing("circuit_json")
    add_column_if_missing("metrics_json")
    add_column_if_missing("insights_json")
    add_column_if_missing("results_json")
    add_column_if_missing("racetrace_json")
    add_column_if_missing("stints_json")
    add_column_if_missing("tyredeg_json")
    add_column_if_missing("telemetry_overlay_json")
    add_column_if_missing("error_message")
    add_column_if_missing("status")

    # Backfill status for old rows.
    if "status" not in cols:
        conn.execute(
            "UPDATE processed_session SET status = COALESCE(status, 'ready')"
        )


def init_db() -> None:
    with _connect() as conn:
        conn.execute(_CREATE_TABLE_SQL)
        _migrate_schema(conn)
        conn.commit()


def make_key(year: int, round: int, session_type: str) -> str:
    return f"{year}:{round}:{session_type.lower()}"


def get_row(key: str) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM processed_session WHERE key = ?",
            (key,),
        ).fetchone()
    if row is None:
        return None
    return dict(row)


def get_processed(key: str) -> dict[str, Any] | None:
    return get_row(key)


def get_status(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None:
        return None
    return {
        "key": row.get("key"),
        "status": row.get("status"),
        "event_name": row.get("event_name"),
        "error_message": row.get("error_message"),
        "updated_at": row.get("updated_at"),
    }


def get_pace_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("pace_json") is None:
        return None
    return json.loads(row["pace_json"])


def get_circuit_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("circuit_json") is None:
        return None
    return json.loads(row["circuit_json"])


def get_metrics_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("metrics_json") is None:
        return None
    return json.loads(row["metrics_json"])


def get_insights_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("insights_json") is None:
        return None
    return json.loads(row["insights_json"])


def get_results_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("results_json") is None:
        return None
    return json.loads(row["results_json"])


def get_racetrace_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("racetrace_json") is None:
        return None
    return json.loads(row["racetrace_json"])


def get_stints_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("stints_json") is None:
        return None
    return json.loads(row["stints_json"])


def get_tyredeg_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("tyredeg_json") is None:
        return None
    return json.loads(row["tyredeg_json"])


def get_telemetry_overlay_cached(key: str) -> dict[str, Any] | None:
    row = get_row(key)
    if row is None or row.get("telemetry_overlay_json") is None:
        return None
    return json.loads(row["telemetry_overlay_json"])


def set_status(key: str, status: str, *, error_message: str | None = None) -> None:
    init_db()
    now = _utc_now_iso()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE processed_session
            SET status = ?, error_message = ?, updated_at = ?
            WHERE key = ?
            """,
            (status, error_message, now, key),
        )
        conn.commit()


def upsert_processed(
    key: str,
    year: int,
    round: int,
    session_type: str,
    event_name: str,
    *,
    status: str = "ready",
    pace_json: str | None = None,
    circuit_json: str | None = None,
    metrics_json: str | None = None,
    insights_json: str | None = None,
    results_json: str | None = None,
    racetrace_json: str | None = None,
    stints_json: str | None = None,
    tyredeg_json: str | None = None,
    telemetry_overlay_json: str | None = None,
    error_message: str | None = None,
) -> None:
    init_db()
    now = _utc_now_iso()
    existing = get_row(key)

    if existing:
        final_status = status or existing.get("status") or "ready"
        final_pace = pace_json if pace_json is not None else existing.get("pace_json")
        final_circuit = (
            circuit_json if circuit_json is not None else existing.get("circuit_json")
        )
        final_metrics = (
            metrics_json if metrics_json is not None else existing.get("metrics_json")
        )
        final_insights = (
            insights_json if insights_json is not None else existing.get("insights_json")
        )
        final_results = (
            results_json if results_json is not None else existing.get("results_json")
        )
        final_racetrace = (
            racetrace_json
            if racetrace_json is not None
            else existing.get("racetrace_json")
        )
        final_stints = stints_json if stints_json is not None else existing.get("stints_json")
        final_tyredeg = (
            tyredeg_json if tyredeg_json is not None else existing.get("tyredeg_json")
        )
        final_overlay = (
            telemetry_overlay_json
            if telemetry_overlay_json is not None
            else existing.get("telemetry_overlay_json")
        )
        final_error = (
            error_message
            if error_message is not None
            else existing.get("error_message")
        )
        final_event = event_name or existing.get("event_name", "")
        created_at = existing.get("created_at", now)
    else:
        final_status = status
        final_pace = pace_json
        final_circuit = circuit_json
        final_metrics = metrics_json
        final_insights = insights_json
        final_results = results_json
        final_racetrace = racetrace_json
        final_stints = stints_json
        final_tyredeg = tyredeg_json
        final_overlay = telemetry_overlay_json
        final_error = error_message
        final_event = event_name or None
        created_at = now

    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO processed_session (
                key, year, round, session_type, event_name,
                status,
                pace_json, circuit_json, metrics_json, insights_json, results_json,
                racetrace_json, stints_json, tyredeg_json, telemetry_overlay_json,
                error_message,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                year = excluded.year,
                round = excluded.round,
                session_type = excluded.session_type,
                event_name = excluded.event_name,
                status = excluded.status,
                pace_json = COALESCE(excluded.pace_json, processed_session.pace_json),
                circuit_json = COALESCE(excluded.circuit_json, processed_session.circuit_json),
                metrics_json = COALESCE(excluded.metrics_json, processed_session.metrics_json),
                insights_json = COALESCE(excluded.insights_json, processed_session.insights_json),
                results_json = COALESCE(excluded.results_json, processed_session.results_json),
                racetrace_json = COALESCE(excluded.racetrace_json, processed_session.racetrace_json),
                stints_json = COALESCE(excluded.stints_json, processed_session.stints_json),
                tyredeg_json = COALESCE(excluded.tyredeg_json, processed_session.tyredeg_json),
                telemetry_overlay_json = COALESCE(excluded.telemetry_overlay_json, processed_session.telemetry_overlay_json),
                error_message = excluded.error_message,
                updated_at = excluded.updated_at
            """,
            (
                key,
                year,
                round,
                session_type,
                final_event,
                final_status,
                final_pace,
                final_circuit,
                final_metrics,
                final_insights,
                final_results,
                final_racetrace,
                final_stints,
                final_tyredeg,
                final_overlay,
                final_error,
                created_at,
                now,
            ),
        )
        conn.commit()


def enable_cache() -> None:
    from app.engine.loader import enable_cache as enable_ff1_cache

    settings = get_settings()
    enable_ff1_cache(str(settings.ff1_cache_dir))
