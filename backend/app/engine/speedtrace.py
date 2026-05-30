"""Two-driver speed trace comparison."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.engine.exceptions import InvalidDriver, SessionNotFound

GRID_POINTS = 1000


def _session_info(session, session_type: str) -> dict[str, Any]:
    return {
        "year": int(session.event.get("Year", session.date.year)),
        "round": int(session.event["RoundNumber"]),
        "type": session_type,
        "event": str(session.event.get("EventName", "Unknown")),
    }


def _driver_team(session, abbr: str) -> str:
    results = session.results
    if results is None or results.empty:
        return "Unknown"
    matches = results.loc[results["Abbreviation"] == abbr, "TeamName"]
    return str(matches.iloc[0]) if not matches.empty else "Unknown"


def _fastest_lap(session, abbr: str):
    laps = session.laps.pick_drivers(abbr).pick_quicklaps()
    if laps.empty:
        laps = session.laps.pick_drivers(abbr)
    if laps.empty:
        return None
    return laps.pick_fastest()


def _series_for_lap(fastest_lap: Any) -> dict[str, np.ndarray]:
    tel = fastest_lap.get_car_data().add_distance()
    if tel is None or tel.empty:
        raise SessionNotFound("Telemetry unavailable for selected driver lap")
    required = ("Distance", "Speed", "Throttle", "Brake", "nGear")
    for col in required:
        if col not in tel.columns:
            raise SessionNotFound(f"Telemetry missing required column '{col}'")

    dist = tel["Distance"].to_numpy(dtype=float)
    unique_dist, idx = np.unique(dist, return_index=True)
    if len(unique_dist) < 2:
        raise SessionNotFound("Telemetry distance coverage is too short for comparison")

    return {
        "distance": unique_dist,
        "speed_kmh": tel["Speed"].to_numpy(dtype=float)[idx],
        "throttle_pct": tel["Throttle"].to_numpy(dtype=float)[idx],
        "brake": tel["Brake"].astype(float).to_numpy()[idx],
        "gear": tel["nGear"].astype(int).to_numpy()[idx],
        "lap_time_s": float(fastest_lap["LapTime"].total_seconds()),
    }


def _interp(source_dist: np.ndarray, source_values: np.ndarray, target_dist: np.ndarray) -> np.ndarray:
    return np.interp(target_dist, source_dist, source_values)


def build_speedtrace_response(
    session,
    session_type: str,
    abbr_a: str,
    abbr_b: str,
    circuit_payload: dict[str, Any],
) -> dict[str, Any]:
    session_type = session_type.upper()
    abbr_a = abbr_a.upper()
    abbr_b = abbr_b.upper()

    lap_a = _fastest_lap(session, abbr_a)
    lap_b = _fastest_lap(session, abbr_b)
    if lap_a is None:
        raise InvalidDriver(f"No fastest lap available for driver '{abbr_a}'")
    if lap_b is None:
        raise InvalidDriver(f"No fastest lap available for driver '{abbr_b}'")

    series_a = _series_for_lap(lap_a)
    series_b = _series_for_lap(lap_b)

    max_distance = min(series_a["distance"][-1], series_b["distance"][-1])
    if max_distance <= 1.0:
        raise SessionNotFound("Insufficient telemetry distance for speed trace comparison")
    grid = np.linspace(0.0, float(max_distance), GRID_POINTS)

    speed_a_kmh = _interp(series_a["distance"], series_a["speed_kmh"], grid)
    speed_b_kmh = _interp(series_b["distance"], series_b["speed_kmh"], grid)
    throttle_a = _interp(series_a["distance"], series_a["throttle_pct"], grid)
    throttle_b = _interp(series_b["distance"], series_b["throttle_pct"], grid)
    brake_a = _interp(series_a["distance"], series_a["brake"], grid)
    brake_b = _interp(series_b["distance"], series_b["brake"], grid)
    gear_a = np.rint(_interp(series_a["distance"], series_a["gear"], grid)).astype(int)
    gear_b = np.rint(_interp(series_b["distance"], series_b["gear"], grid)).astype(int)

    speed_a_ms = np.maximum(speed_a_kmh / 3.6, 1.0)
    speed_b_ms = np.maximum(speed_b_kmh / 3.6, 1.0)
    dx = np.diff(grid, prepend=grid[0])
    delta = np.cumsum(dx * ((1.0 / speed_a_ms) - (1.0 / speed_b_ms)))

    corners = [
        {"number": int(c.get("number", 0)), "dist_m": float(c.get("dist_m", 0.0))}
        for c in (circuit_payload.get("corners") or [])
    ]
    sector_splits = circuit_payload.get("sector_splits")
    sector_splits_m = [float(v) for v in sector_splits] if sector_splits else None

    return {
        "session": _session_info(session, session_type),
        "sector_splits_m": sector_splits_m,
        "corners": corners,
        "a": {
            "abbr": abbr_a,
            "team": _driver_team(session, abbr_a),
            "lap_time_s": series_a["lap_time_s"],
            "distance_m": [float(v) for v in grid.tolist()],
            "speed_kmh": [float(v) for v in speed_a_kmh.tolist()],
            "throttle_pct": [float(v) for v in throttle_a.tolist()],
            "brake": [float(v) for v in brake_a.tolist()],
            "gear": [int(v) for v in gear_a.tolist()],
        },
        "b": {
            "abbr": abbr_b,
            "team": _driver_team(session, abbr_b),
            "lap_time_s": series_b["lap_time_s"],
            "distance_m": [float(v) for v in grid.tolist()],
            "speed_kmh": [float(v) for v in speed_b_kmh.tolist()],
            "throttle_pct": [float(v) for v in throttle_b.tolist()],
            "brake": [float(v) for v in brake_b.tolist()],
            "gear": [int(v) for v in gear_b.tolist()],
        },
        "delta_a_minus_b_s": [float(v) for v in delta.tolist()],
    }
