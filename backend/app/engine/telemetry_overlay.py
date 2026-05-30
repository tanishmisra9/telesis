"""Speed-along-centerline overlays for map speed layer."""

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


def _interpolate_speed_to_centerline(
    fastest_lap: Any, centerline_dist_m: list[float]
) -> list[float] | None:
    if not centerline_dist_m:
        return None
    try:
        tel = fastest_lap.get_car_data().add_distance()
    except Exception:
        return None
    if tel is None or tel.empty or "Distance" not in tel.columns or "Speed" not in tel.columns:
        return None
    dist = tel["Distance"].to_numpy(dtype=float)
    speed = tel["Speed"].to_numpy(dtype=float)
    if len(dist) < 2 or len(speed) < 2:
        return None
    # Collapse duplicate distance samples for stable interpolation.
    unique_dist, idx = np.unique(dist, return_index=True)
    unique_speed = speed[idx]
    if len(unique_dist) < 2:
        return None
    target = np.asarray(centerline_dist_m, dtype=float)
    interpolated = np.interp(target, unique_dist, unique_speed)
    return [float(v) for v in interpolated.tolist()]


def build_telemetry_overlay_response(
    session, session_type: str, circuit_payload: dict[str, Any]
) -> dict[str, Any]:
    session_type = session_type.upper()
    info = _session_info(session, session_type)
    if session_type in {"Q", "SQ"}:
        return {
            "session": info,
            "applicable": False,
            "reason": "telemetry_overlay_not_required_for_quali_sessions",
            "drivers": [],
        }

    centerline_dist_m = circuit_payload.get("centerline_dist_m") or []
    drivers_payload: list[dict[str, Any]] = []
    for abbr in sorted(session.laps["Driver"].dropna().unique().tolist()):
        laps = session.laps.pick_drivers(abbr).pick_quicklaps()
        if laps.empty:
            laps = session.laps.pick_drivers(abbr)
        if laps.empty:
            continue
        fastest = laps.pick_fastest()
        if fastest is None:
            continue

        team = "Unknown"
        team_vals = laps["Team"].dropna().tolist() if "Team" in laps.columns else []
        if team_vals:
            team = str(team_vals[0])

        speed_along_centerline = _interpolate_speed_to_centerline(fastest, centerline_dist_m)
        if speed_along_centerline is None:
            continue
        drivers_payload.append(
            {
                "abbr": str(abbr),
                "team": team,
                "speed_along_centerline": speed_along_centerline,
            }
        )

    return {
        "session": info,
        "applicable": True,
        "reason": None,
        "drivers": drivers_payload,
    }
