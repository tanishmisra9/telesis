"""Tyre degradation payload."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def _session_info(session, session_type: str) -> dict[str, Any]:
    return {
        "year": int(session.event.get("Year", session.date.year)),
        "round": int(session.event["RoundNumber"]),
        "type": session_type,
        "event": str(session.event.get("EventName", "Unknown")),
    }


def _safe_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        if hasattr(value, "total_seconds"):
            return float(value.total_seconds())
        return float(value)
    except Exception:
        return None


def build_tyredeg_response(session, session_type: str) -> dict[str, Any]:
    session_type = session_type.upper()
    info = _session_info(session, session_type)
    if session_type not in {"R", "S"}:
        return {
            "session": info,
            "drivers": [],
            "applicable": False,
            "reason": "tyredeg_only_applicable_for_race_sessions",
        }

    laps = session.laps
    if laps is None or laps.empty:
        return {"session": info, "drivers": [], "applicable": True, "reason": None}

    finish_order = {
        str(row.get("Abbreviation")): int(row.get("Position"))
        for _, row in session.results.iterrows()
        if row.get("Abbreviation") is not None and not pd.isna(row.get("Position"))
    }
    drivers_payload: list[dict[str, Any]] = []
    for abbr in sorted(laps["Driver"].dropna().unique().tolist(), key=lambda a: finish_order.get(str(a), 999)):
        dlaps = laps.pick_drivers(abbr).pick_quicklaps()
        if dlaps.empty or "Stint" not in dlaps.columns:
            continue
        team = "Unknown"
        team_values = dlaps["Team"].dropna().tolist() if "Team" in dlaps.columns else []
        if team_values:
            team = str(team_values[0])

        stints_payload: list[dict[str, Any]] = []
        for stint_number, group in dlaps.dropna(subset=["Stint"]).groupby("Stint", sort=True):
            points: list[dict[str, Any]] = []
            x_vals: list[float] = []
            y_vals: list[float] = []
            compound = (
                str(group["Compound"].dropna().iloc[0]).upper()
                if "Compound" in group.columns and not group["Compound"].dropna().empty
                else "UNKNOWN"
            )
            for _, lap in group.iterrows():
                age_raw = lap.get("TyreLife")
                age = None if pd.isna(age_raw) else int(age_raw)
                lap_time = _safe_float(lap.get("LapTime"))
                if age is None or lap_time is None:
                    continue
                points.append({"tyre_age": age, "lap_time_s": lap_time})
                x_vals.append(float(age))
                y_vals.append(float(lap_time))

            if not points:
                continue

            if len(points) >= 2:
                slope, intercept = np.polyfit(np.asarray(x_vals), np.asarray(y_vals), 1)
            else:
                slope, intercept = 0.0, y_vals[0]

            stints_payload.append(
                {
                    "stint_number": int(stint_number),
                    "compound": compound,
                    "points": points,
                    "slope_s_per_lap": float(slope),
                    "intercept_s": float(intercept),
                }
            )

        drivers_payload.append({"abbr": str(abbr), "team": team, "stints": stints_payload})

    return {"session": info, "drivers": drivers_payload, "applicable": True, "reason": None}
