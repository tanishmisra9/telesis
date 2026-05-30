"""Race trace payload (position over laps)."""

from __future__ import annotations

from typing import Any

import pandas as pd


def _session_info(session, session_type: str) -> dict[str, Any]:
    return {
        "year": int(session.event.get("Year", session.date.year)),
        "round": int(session.event["RoundNumber"]),
        "type": session_type,
        "event": str(session.event.get("EventName", "Unknown")),
    }


def build_racetrace_response(session, session_type: str) -> dict[str, Any]:
    session_type = session_type.upper()
    info = _session_info(session, session_type)
    if session_type not in {"R", "S"}:
        return {
            "session": info,
            "total_laps": 0,
            "drivers": [],
            "applicable": False,
            "reason": "racetrace_only_applicable_for_race_sessions",
        }

    laps = session.laps
    if laps is None or laps.empty:
        return {
            "session": info,
            "total_laps": 0,
            "drivers": [],
            "applicable": True,
            "reason": None,
        }

    total_laps = int(laps["LapNumber"].dropna().max()) if "LapNumber" in laps.columns else 0
    finish_order = {
        str(row.get("Abbreviation")): int(row.get("Position"))
        for _, row in session.results.iterrows()
        if not pd.isna(row.get("Position")) and row.get("Abbreviation") is not None
    }
    drivers: list[dict[str, Any]] = []
    for abbr in sorted(laps["Driver"].dropna().unique().tolist(), key=lambda a: finish_order.get(str(a), 999)):
        dlaps = laps.pick_drivers(abbr)
        if dlaps.empty:
            continue
        positions: list[int | None] = [None] * total_laps
        for _, lap in dlaps.iterrows():
            lap_number = lap.get("LapNumber")
            position = lap.get("Position")
            if pd.isna(lap_number) or pd.isna(position):
                continue
            idx = int(lap_number) - 1
            if 0 <= idx < total_laps:
                positions[idx] = int(position)

        team = "Unknown"
        team_values = dlaps["Team"].dropna().tolist() if "Team" in dlaps.columns else []
        if team_values:
            team = str(team_values[0])
        drivers.append({"abbr": str(abbr), "team": team, "positions": positions})

    return {
        "session": info,
        "total_laps": total_laps,
        "drivers": drivers,
        "applicable": True,
        "reason": None,
    }
