"""Schedule extraction for session picker."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

import fastf1

_SESSION_ORDER = ("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")
_schedule_cache: dict[int, dict[str, Any]] = {}


def _normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    try:
        text = str(value).strip()
    except Exception:
        return None
    return text or None


def _session_types_for_event(event: Any) -> list[str]:
    available: list[str] = []
    for session_type in _SESSION_ORDER:
        try:
            event.get_session_name(session_type)
        except Exception:
            continue
        available.append(session_type)
    return available


def _is_testing_round(event_name: str, country: str) -> bool:
    text = f"{event_name} {country}".lower()
    return "test" in text or "testing" in text


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _rows_from_schedule(schedule_df: Any) -> Iterable[Any]:
    if schedule_df is None or getattr(schedule_df, "empty", True):
        return []
    return [row for _, row in schedule_df.iterrows()]


def get_schedule_response(year: int) -> dict[str, Any]:
    cached = _schedule_cache.get(year)
    if cached is not None:
        return cached

    schedule_df = fastf1.get_event_schedule(year)
    rounds: list[dict[str, Any]] = []
    for row in _rows_from_schedule(schedule_df):
        round_number = _safe_int(row.get("RoundNumber"), 0)
        if round_number <= 0:
            continue

        event = fastf1.get_event(year, round_number)
        event_name = str(row.get("EventName") or row.get("OfficialEventName") or "")
        country = str(row.get("Country") or "") if row.get("Country") is not None else ""
        if _is_testing_round(event_name, country):
            continue

        rounds.append(
            {
                "round": round_number,
                "event_name": event_name,
                "country": country or None,
                "location": (
                    str(row.get("Location"))
                    if row.get("Location") is not None
                    else None
                ),
                "event_date": _normalize_date(row.get("EventDate")),
                "has_sprint": "S" in _session_types_for_event(event),
                "session_types": _session_types_for_event(event),
            }
        )

    rounds.sort(key=lambda item: item["round"])
    payload = {"year": year, "rounds": rounds}
    _schedule_cache[year] = payload
    return payload
