"""Stint extraction payload."""

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


def _safe_int(value: Any, default: int = 0) -> int:
    if value is None or pd.isna(value):
        return default
    try:
        return int(value)
    except Exception:
        return default


def build_stints_response(session, session_type: str) -> dict[str, Any]:
    session_type = session_type.upper()
    info = _session_info(session, session_type)
    if session_type in {"Q", "SQ"}:
        return {
            "session": info,
            "total_laps": 0,
            "drivers": [],
            "applicable": False,
            "reason": "stints_not_applicable_for_qualifying_sessions",
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

    total_laps = _safe_int(laps["LapNumber"].dropna().max(), 0) if "LapNumber" in laps.columns else 0
    drivers_payload: list[dict[str, Any]] = []
    for abbr in sorted(laps["Driver"].dropna().unique().tolist()):
        dlaps = laps.pick_drivers(abbr)
        if dlaps.empty or "Stint" not in dlaps.columns:
            continue

        team = "Unknown"
        team_values = dlaps["Team"].dropna().tolist() if "Team" in dlaps.columns else []
        if team_values:
            team = str(team_values[0])

        stints: list[dict[str, Any]] = []
        grouped = dlaps.dropna(subset=["Stint"]).groupby("Stint", sort=True)
        for stint_number, group in grouped:
            if group.empty:
                continue
            lap_start = _safe_int(group["LapNumber"].min())
            lap_end = _safe_int(group["LapNumber"].max())
            compound = (
                str(group["Compound"].dropna().iloc[0]).upper()
                if "Compound" in group.columns and not group["Compound"].dropna().empty
                else "UNKNOWN"
            )
            tyre_age_start = (
                _safe_int(group["TyreLife"].dropna().iloc[0])
                if "TyreLife" in group.columns and not group["TyreLife"].dropna().empty
                else 0
            )
            stints.append(
                {
                    "stint_number": _safe_int(stint_number),
                    "compound": compound,
                    "lap_start": lap_start,
                    "lap_end": lap_end,
                    "tyre_age_start": tyre_age_start,
                    "lap_count": max(0, lap_end - lap_start + 1),
                }
            )

        drivers_payload.append({"abbr": str(abbr), "team": team, "stints": stints})

    return {
        "session": info,
        "total_laps": total_laps,
        "drivers": drivers_payload,
        "applicable": True,
        "reason": None,
    }
