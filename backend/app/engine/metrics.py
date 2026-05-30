"""Session metrics for insights generation."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def _empty_metrics_payload(session, session_type: str) -> dict[str, Any]:
    year = int(session.event.get("Year", session.date.year))
    round_number = int(session.event["RoundNumber"])
    event_name = str(session.event.get("EventName", "Unknown"))
    return {
        "session": {
            "year": year,
            "round": round_number,
            "type": session_type,
            "event": event_name,
        },
        "applicable": False,
        "reason": "metrics_not_available",
        "drivers": [],
        "fastest_corner": None,
    }


def _driver_team(session, abbr: str) -> str:
    try:
        return str(session.get_driver(abbr)["TeamName"])
    except (KeyError, TypeError, ValueError):
        laps = session.laps.pick_drivers(abbr)
        if not laps.empty and "Team" in laps.columns:
            return str(laps.iloc[0]["Team"])
        return "Unknown"


def _corner_min_speed(car_data: pd.DataFrame, corner_dist_m: float) -> float | None:
    if car_data.empty or "Distance" not in car_data.columns or "Speed" not in car_data.columns:
        return None
    dist = car_data["Distance"].to_numpy(dtype=float)
    speed = car_data["Speed"].to_numpy(dtype=float)
    mask = (dist >= corner_dist_m - 75.0) & (dist <= corner_dist_m + 75.0)
    if not np.any(mask):
        return None
    return float(np.nanmin(speed[mask]))


def _full_throttle_pct(car_data: pd.DataFrame) -> float:
    if car_data.empty or "Distance" not in car_data.columns or "Throttle" not in car_data.columns:
        return 0.0
    dist = car_data["Distance"].to_numpy(dtype=float)
    throttle = car_data["Throttle"].to_numpy(dtype=float)
    if len(dist) < 2:
        return 0.0
    segment = np.diff(dist)
    if segment.size == 0 or np.sum(segment) <= 0:
        return 0.0
    full = throttle[:-1] >= 99.0
    covered = float(np.sum(segment[full]))
    total = float(np.sum(segment))
    return max(0.0, min(100.0, (covered / total) * 100.0))


def build_metrics_response(session, session_type: str, circuit_payload: dict[str, Any]) -> dict[str, Any]:
    """Build per-driver single-lap metrics for all timed session types."""
    session_type = session_type.upper()

    year = int(session.event.get("Year", session.date.year))
    round_number = int(session.event["RoundNumber"])
    event_name = str(session.event.get("EventName", "Unknown"))
    corners = circuit_payload.get("corners", [])

    drivers: list[dict[str, Any]] = []
    fastest_corner: dict[str, Any] | None = None

    driver_abbrs = sorted(session.laps["Driver"].dropna().unique().tolist())
    for abbr in driver_abbrs:
        laps = session.laps.pick_drivers(abbr).pick_quicklaps()
        if laps.empty:
            continue
        fastest = laps.pick_fastest()
        if fastest is None or pd.isna(fastest.get("LapTime")):
            continue
        car = fastest.get_car_data().add_distance()
        if car.empty:
            continue

        lap_time = float(fastest["LapTime"].total_seconds())
        speed = car["Speed"].to_numpy(dtype=float) if "Speed" in car.columns else np.array([])
        top_speed = float(np.nanmax(speed)) if speed.size else 0.0
        min_speed = float(np.nanmin(speed)) if speed.size else 0.0
        deployment_loss = float(speed[-1] - speed[0]) if speed.size >= 2 else 0.0
        throttle_pct = _full_throttle_pct(car)

        corner_speeds: list[dict[str, Any]] = []
        for corner in corners:
            cnum = int(corner.get("number", 0))
            cdist = float(corner.get("dist_m", 0.0))
            cmin = _corner_min_speed(car, cdist)
            if cmin is None:
                continue
            corner_speeds.append({"number": cnum, "min_speed_kmh": cmin})
            if fastest_corner is None or cmin > fastest_corner["min_speed_kmh"]:
                fastest_corner = {"number": cnum, "min_speed_kmh": cmin}

        drivers.append(
            {
                "abbr": str(abbr),
                "team": _driver_team(session, str(abbr)),
                "lap_time_s": lap_time,
                "top_speed_kmh": top_speed,
                "min_speed_kmh": min_speed,
                "full_throttle_pct": throttle_pct,
                "deployment_loss_kmh": deployment_loss,
                "corner_speeds": corner_speeds,
            }
        )

    drivers.sort(key=lambda d: d["lap_time_s"])
    return {
        "session": {
            "year": year,
            "round": round_number,
            "type": session_type,
            "event": event_name,
        },
        "applicable": bool(drivers),
        "reason": None if drivers else "metrics_not_available",
        "drivers": drivers,
        "fastest_corner": fastest_corner,
    }
