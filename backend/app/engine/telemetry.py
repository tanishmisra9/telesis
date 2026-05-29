"""Per-driver telemetry extraction."""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Any

import numpy as np
import pandas as pd

COMPOUND_MAP: dict[str, int] = {
    "SOFT": 0,
    "MEDIUM": 1,
    "HARD": 2,
    "INTERMEDIATE": 3,
    "WET": 4,
    "UNKNOWN": 5,
}

_COMPOUND_INT_TO_NAME: dict[int, str] = {
    value: key for key, value in COMPOUND_MAP.items() if key != "UNKNOWN"
}

_SESSION_NAME_TO_TYPE: dict[str, str] = {
    "Race": "R",
    "Qualifying": "Q",
    "Sprint": "S",
    "Sprint Qualifying": "SQ",
}

_TELEMETRY_CHANNELS: tuple[tuple[str, str], ...] = (
    ("SessionTime", "t"),
    ("X", "x"),
    ("Y", "y"),
    ("Distance", "dist"),
    ("RelativeDistance", "rel_dist"),
    ("Speed", "speed"),
    ("nGear", "gear"),
    ("DRS", "drs"),
    ("Throttle", "throttle"),
    ("Brake", "brake"),
)


def _compound_to_int(compound: Any) -> int:
    if pd.isna(compound):
        return COMPOUND_MAP["UNKNOWN"]
    key = str(compound).upper()
    return COMPOUND_MAP.get(key, COMPOUND_MAP["UNKNOWN"])


def _compound_to_name(compound: Any) -> str:
    if pd.isna(compound):
        return "UNKNOWN"
    key = str(compound).upper()
    return key if key in _COMPOUND_INT_TO_NAME else "UNKNOWN"


def _timedelta_array_to_seconds(values: pd.Series | np.ndarray) -> np.ndarray:
    return pd.to_timedelta(values).dt.total_seconds().to_numpy(dtype=np.float64)


def _get_team(session, driver_abbr: str) -> str:
    results = session.results
    if results is None or results.empty:
        return ""
    matches = results.loc[results["Abbreviation"] == driver_abbr, "TeamName"]
    if matches.empty:
        return ""
    return str(matches.iloc[0])


def _lap_time_seconds(lap) -> float | None:
    lap_time = lap["LapTime"]
    if pd.isna(lap_time):
        return None
    return float(lap_time.total_seconds())


def _session_identity(session) -> tuple[int, int, str]:
    year = int(session.event.year)
    round_number = int(session.event["RoundNumber"])
    session_type = _SESSION_NAME_TO_TYPE.get(session.name)
    if session_type is None:
        raise ValueError(f"Unsupported session name '{session.name}'")
    return year, round_number, session_type


def extract_driver_telemetry(session, driver_abbr: str) -> dict[str, Any] | None:
    laps = session.laps.pick_drivers(driver_abbr)
    if laps.empty:
        return None

    chunk_frames: list[pd.DataFrame] = []
    lap_records: list[dict[str, Any]] = []

    for _, lap in laps.iterlaps():
        telemetry = lap.get_telemetry()
        if telemetry.empty:
            continue

        compound_name = _compound_to_name(lap["Compound"])
        compound_int = _compound_to_int(lap["Compound"])
        lap_number = int(lap["LapNumber"])

        lap_records.append(
            {
                "lap_number": lap_number,
                "lap_time_s": _lap_time_seconds(lap),
                "compound": compound_name,
                "tyre_life": None if pd.isna(lap["TyreLife"]) else int(lap["TyreLife"]),
                "is_accurate": bool(lap["IsAccurate"]) if not pd.isna(lap["IsAccurate"]) else False,
                "is_pit_in": not pd.isna(lap["PitInTime"]),
                "is_pit_out": not pd.isna(lap["PitOutTime"]),
                "track_status": None if pd.isna(lap["TrackStatus"]) else int(lap["TrackStatus"]),
            }
        )

        frame = telemetry.copy()
        frame["lap"] = lap_number
        frame["compound"] = compound_int
        chunk_frames.append(frame)

    if not chunk_frames:
        return None

    combined = pd.concat(chunk_frames, ignore_index=True)
    sort_idx = combined["SessionTime"].argsort(kind="mergesort")
    combined = combined.iloc[sort_idx].reset_index(drop=True)

    telemetry_out: dict[str, np.ndarray] = {}
    for source_col, target_col in _TELEMETRY_CHANNELS:
        if source_col == "SessionTime":
            telemetry_out[target_col] = _timedelta_array_to_seconds(combined[source_col])
        elif source_col == "Brake":
            telemetry_out[target_col] = combined[source_col].astype(np.float64).to_numpy()
        else:
            telemetry_out[target_col] = combined[source_col].to_numpy(dtype=np.float64)

    telemetry_out["lap"] = combined["lap"].to_numpy(dtype=np.int32)
    telemetry_out["compound"] = combined["compound"].to_numpy(dtype=np.int32)

    max_lap = int(max(record["lap_number"] for record in lap_records))

    return {
        "abbr": driver_abbr,
        "team": _get_team(session, driver_abbr),
        "telemetry": telemetry_out,
        "laps": lap_records,
        "max_lap": max_lap,
    }


def _telemetry_worker(
    year: int,
    round_number: int,
    session_type: str,
    driver_abbr: str,
) -> dict[str, Any] | None:
    from app.config import get_settings
    from app.engine.loader import enable_cache, load_session

    enable_cache(str(get_settings().ff1_cache_dir))
    session = load_session(year, round_number, session_type)
    return extract_driver_telemetry(session, driver_abbr)


def extract_all_drivers_telemetry(
    session,
    *,
    max_workers: int | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    year, round_number, session_type = _session_identity(session)
    driver_abbrs = sorted(session.laps["Driver"].dropna().unique().tolist())

    if not driver_abbrs:
        return [], []

    results: list[dict[str, Any]] = []
    skipped: list[str] = []

    def _collect(payload: dict[str, Any] | None, driver_abbr: str) -> None:
        if payload is None:
            skipped.append(driver_abbr)
        else:
            results.append(payload)

    try:
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(
                    _telemetry_worker,
                    year,
                    round_number,
                    session_type,
                    driver_abbr,
                ): driver_abbr
                for driver_abbr in driver_abbrs
            }
            for future in as_completed(futures):
                driver_abbr = futures[future]
                try:
                    _collect(future.result(), driver_abbr)
                except Exception:
                    skipped.append(driver_abbr)
    except (PermissionError, OSError):
        for driver_abbr in driver_abbrs:
            try:
                _collect(extract_driver_telemetry(session, driver_abbr), driver_abbr)
            except Exception:
                skipped.append(driver_abbr)

    results.sort(key=lambda item: item["abbr"])
    skipped.sort()
    return results, skipped
