"""Session results payload."""

from __future__ import annotations

from typing import Any

import pandas as pd


def _safe_int(value: Any) -> int | None:
    if value is None or pd.isna(value):
        return None
    try:
        return int(value)
    except Exception:
        return None


def _safe_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        if hasattr(value, "total_seconds"):
            return float(value.total_seconds())
        return float(value)
    except Exception:
        return None


def _fastest_lap_seconds(session, abbr: str) -> float | None:
    try:
        fastest = session.laps.pick_drivers(abbr).pick_fastest()
    except Exception:
        return None
    if fastest is None:
        return None
    return _safe_float(fastest.get("LapTime"))


def build_results_response(session, session_type: str) -> dict[str, Any]:
    session_type = session_type.upper()
    session_info = {
        "year": int(session.event.get("Year", session.date.year)),
        "round": int(session.event["RoundNumber"]),
        "type": session_type,
        "event": str(session.event.get("EventName", "Unknown")),
    }

    results_df = session.results
    if results_df is None or results_df.empty:
        return {"session": session_info, "drivers": []}

    drivers: list[dict[str, Any]] = []
    for _, row in results_df.iterrows():
        abbr = str(row.get("Abbreviation") or "").strip().upper()
        if not abbr:
            continue
        drivers.append(
            {
                "abbr": abbr,
                "full_name": str(row.get("FullName")) if row.get("FullName") is not None else None,
                "driver_number": _safe_int(row.get("DriverNumber")),
                "team": str(row.get("TeamName") or "Unknown"),
                "team_color": str(row.get("TeamColor")) if row.get("TeamColor") is not None else None,
                "headshot_url": str(row.get("HeadshotUrl")) if row.get("HeadshotUrl") is not None else None,
                "country_code": str(row.get("CountryCode")) if row.get("CountryCode") is not None else None,
                "grid_position": _safe_int(row.get("GridPosition")),
                "finish_position": _safe_int(row.get("Position")),
                "status": str(row.get("Status")) if row.get("Status") is not None else None,
                "fastest_lap_s": _fastest_lap_seconds(session, abbr),
                "fastest_lap_rank": None,
            }
        )

    fastest_sorted = sorted(
        [d for d in drivers if d["fastest_lap_s"] is not None],
        key=lambda item: item["fastest_lap_s"],
    )
    for rank, item in enumerate(fastest_sorted, start=1):
        item["fastest_lap_rank"] = rank

    drivers.sort(
        key=lambda item: (
            item["finish_position"] is None,
            item["finish_position"] or 10_000,
            item["grid_position"] is None,
            item["grid_position"] or 10_000,
            item["abbr"],
        )
    )
    return {"session": session_info, "drivers": drivers}
