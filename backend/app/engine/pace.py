"""Pace spread statistics from cleaned lap times."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

COMPOUND_LABELS: dict[str, str] = {
    "SOFT": "S",
    "MEDIUM": "M",
    "HARD": "H",
    "INTERMEDIATE": "I",
    "WET": "W",
}


def _compound_tags(laps: pd.DataFrame) -> list[str]:
    if laps.empty or "Compound" not in laps.columns:
        return []
    order = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]
    seen: list[str] = []
    for compound in order:
        if (laps["Compound"] == compound).any():
            tag = COMPOUND_LABELS.get(compound)
            if tag and tag not in seen:
                seen.append(tag)
    return seen


def _is_null(value: Any) -> bool:
    if value is None:
        return True
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def _lap_passes_track_status(lap: pd.Series) -> bool:
    status = lap.get("TrackStatus")
    if _is_null(status):
        return True
    try:
        code = int(status)
    except (TypeError, ValueError):
        return True
    return code in (1, 2)


def filter_race_laps(laps: pd.DataFrame) -> pd.DataFrame:
    """Representative racing laps for pace spread."""
    if laps.empty:
        return laps

    cleaned = laps.pick_quicklaps().copy()

    if "PitInTime" in cleaned.columns:
        cleaned = cleaned[cleaned["PitInTime"].isna()]
    if "PitOutTime" in cleaned.columns:
        cleaned = cleaned[cleaned["PitOutTime"].isna()]
    if "IsAccurate" in cleaned.columns:
        cleaned = cleaned[cleaned["IsAccurate"] == True]  # noqa: E712

    if not cleaned.empty:
        mask = cleaned.apply(_lap_passes_track_status, axis=1)
        cleaned = cleaned[mask]

    cleaned = cleaned[cleaned["LapTime"].notna()]
    return cleaned


def pace_box_stats(lap_times_s: np.ndarray) -> dict[str, Any]:
    if lap_times_s.size == 0:
        raise ValueError("Cannot compute pace stats on empty lap times")

    q1, med, q3 = np.percentile(lap_times_s, [25, 50, 75])
    iqr = q3 - q1
    lo_fence, hi_fence = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    inliers = lap_times_s[(lap_times_s >= lo_fence) & (lap_times_s <= hi_fence)]

    return {
        "mean": float(np.mean(lap_times_s)),
        "median": float(med),
        "q1": float(q1),
        "q3": float(q3),
        "whisker_low": float(inliers.min()),
        "whisker_high": float(inliers.max()),
        "outliers": [
            float(v) for v in lap_times_s if v < lo_fence or v > hi_fence
        ],
        "n_laps": int(len(lap_times_s)),
        "compounds": [],
    }


def _driver_team(session, abbr: str) -> str:
    try:
        return str(session.get_driver(abbr)["TeamName"])
    except (KeyError, TypeError, ValueError):
        laps = session.laps.pick_drivers(abbr)
        if not laps.empty and "Team" in laps.columns:
            return str(laps.iloc[0]["Team"])
        return "Unknown"


def _lap_times_seconds(laps: pd.DataFrame) -> np.ndarray:
    return laps["LapTime"].dt.total_seconds().to_numpy(dtype=float)


def build_pace_response(session, session_type: str) -> dict[str, Any]:
    """Build full pace payload from a loaded FastF1 session."""
    year = int(session.event.get("Year", session.date.year))
    round_number = int(session.event["RoundNumber"])
    event_name = str(session.event.get("EventName", "Unknown"))

    driver_abbrs = sorted(session.laps["Driver"].dropna().unique().tolist())

    driver_entries: list[dict[str, Any]] = []
    driver_lap_times: dict[str, np.ndarray] = {}
    for abbr in driver_abbrs:
        abbr = str(abbr)
        laps = session.laps.pick_drivers(abbr)
        cleaned = filter_race_laps(laps)
        if cleaned.empty:
            continue

        times = _lap_times_seconds(cleaned)
        driver_lap_times[abbr] = times
        stats = pace_box_stats(times)
        stats["compounds"] = _compound_tags(cleaned)
        driver_entries.append(
            {
                "abbr": abbr,
                "team": _driver_team(session, abbr),
                "stats": stats,
            }
        )

    if not driver_entries:
        raise ValueError("No drivers with valid pace laps in session")

    driver_entries.sort(key=lambda d: d["stats"]["mean"])
    fastest_mean = driver_entries[0]["stats"]["mean"]
    for entry in driver_entries:
        entry["gap_to_fastest_s"] = round(
            entry["stats"]["mean"] - fastest_mean, 3
        )

    team_times: dict[str, list[float]] = {}
    team_compounds: dict[str, list[str]] = {}
    for entry in driver_entries:
        team = entry["team"]
        abbr = entry["abbr"]
        team_times.setdefault(team, []).extend(driver_lap_times[abbr].tolist())
        for tag in entry["stats"]["compounds"]:
            team_compounds.setdefault(team, [])
            if tag not in team_compounds[team]:
                team_compounds[team].append(tag)

    constructor_entries: list[dict[str, Any]] = []
    for team, times_list in team_times.items():
        if not times_list:
            continue
        stats = pace_box_stats(np.array(times_list, dtype=float))
        stats["compounds"] = team_compounds.get(team, [])
        constructor_entries.append({"team": team, "stats": stats})

    constructor_entries.sort(key=lambda c: c["stats"]["mean"])
    fastest_team_mean = constructor_entries[0]["stats"]["mean"]
    for entry in constructor_entries:
        entry["gap_to_fastest_s"] = round(
            entry["stats"]["mean"] - fastest_team_mean, 3
        )

    return {
        "session": {
            "year": year,
            "round": round_number,
            "type": session_type,
            "event": event_name,
        },
        "drivers": driver_entries,
        "constructors": constructor_entries,
    }
