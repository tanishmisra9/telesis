"""Schedule extraction for session picker."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime
import json
from typing import Any

import fastf1
import pandas as pd

from app.cache import get_rows_for_year

_ALL_SESSION_TYPES = ("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")
_STANDARD_WEEKEND = ("FP1", "FP2", "FP3", "Q", "R")
_SPRINT_WEEKEND_2024 = ("FP1", "SQ", "S", "Q", "R")
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
    available: set[str] = set()
    for session_type in _ALL_SESSION_TYPES:
        try:
            event.get_session_name(session_type)
        except Exception:
            continue
        available.add(session_type)
    preferred = _SPRINT_WEEKEND_2024 if {"SQ", "S"}.issubset(available) else _STANDARD_WEEKEND
    ordered = [session_type for session_type in preferred if session_type in available]
    for fallback in _ALL_SESSION_TYPES:
        if fallback in available and fallback not in ordered:
            ordered.append(fallback)
    return ordered


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


def _driver_name(entry: dict[str, Any]) -> str:
    return (
        str(entry.get("full_name") or "").strip()
        or str(entry.get("abbr") or "").strip()
        or "Unknown"
    )


def _build_standings(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    race_rows = [row for row in rows if str(row.get("session_type", "")).upper() == "R"]
    if not race_rows:
        return None

    latest = sorted(race_rows, key=lambda item: int(item.get("round", 0)), reverse=True)[0]
    try:
        payload = json.loads(latest["results_json"]) if latest.get("results_json") else None
    except Exception:
        payload = None
    if not payload:
        return None

    drivers = payload.get("drivers") or []
    if not drivers:
        return None
    frame = pd.DataFrame(drivers)
    if frame.empty:
        return None

    constructor_points = (
        frame.groupby("team", dropna=True)["points"].sum(min_count=1).fillna(0.0).reset_index()
        if "points" in frame.columns
        else pd.DataFrame(columns=["team", "points"])
    )
    constructor_rows = []
    if not constructor_points.empty:
        constructor_points = constructor_points.sort_values(by="points", ascending=False).reset_index(drop=True)
        constructor_rows = [
            {"position": int(idx + 1), "name": str(row["team"]), "points": float(row["points"])}
            for idx, row in constructor_points.iterrows()
        ]

    driver_rows = []
    if "points" in frame.columns:
        ranked_drivers = frame.copy()
        ranked_drivers["points"] = ranked_drivers["points"].fillna(0.0)
        ranked_drivers = ranked_drivers.sort_values(by="points", ascending=False).reset_index(drop=True)
        driver_rows = [
            {
                "position": int(idx + 1),
                "name": _driver_name(row.to_dict()),
                "points": float(row["points"]),
            }
            for idx, row in ranked_drivers.iterrows()
        ]

    if not constructor_rows and not driver_rows:
        return None
    return {"constructors": constructor_rows, "drivers": driver_rows}


def get_season_overview_response(year: int) -> dict[str, Any]:
    schedule_payload = get_schedule_response(year)
    schedule_rounds = schedule_payload.get("rounds", [])
    rows = get_rows_for_year(year)
    by_round_and_type: dict[tuple[int, str], dict[str, Any]] = {}
    for row in rows:
        round_number = _safe_int(row.get("round"), 0)
        session_type = str(row.get("session_type") or "").upper()
        if round_number <= 0 or not session_type:
            continue
        by_round_and_type[(round_number, session_type)] = row

    race_rows = [
        row
        for row in rows
        if str(row.get("session_type") or "").upper() == "R" and row.get("pace_json")
    ]
    analyzed_rounds = sorted({_safe_int(row.get("round"), 0) for row in race_rows if _safe_int(row.get("round"), 0) > 0})

    pace_by_round: dict[int, list[dict[str, Any]]] = {}
    for row in race_rows:
        round_number = _safe_int(row.get("round"), 0)
        if round_number <= 0:
            continue
        try:
            payload = json.loads(row["pace_json"])
            constructors = payload.get("constructors") or []
            if constructors:
                pace_by_round[round_number] = constructors
        except Exception:
            continue

    round_numbers = [int(item["round"]) for item in schedule_rounds]
    team_rank_samples: dict[str, list[int]] = {}
    team_gap_samples: dict[str, list[float]] = {}
    team_trends: dict[str, list[int | None]] = {}

    for round_number in round_numbers:
        constructors = pace_by_round.get(round_number) or []
        for idx, row in enumerate(constructors):
            team = str(row.get("team") or "").strip()
            if not team:
                continue
            team_rank_samples.setdefault(team, []).append(idx + 1)
            team_gap_samples.setdefault(team, []).append(float(row.get("gap_to_fastest_s", 0.0)))

    all_teams = sorted(team_rank_samples.keys())
    for team in all_teams:
        trend: list[int | None] = []
        for round_number in round_numbers:
            constructors = pace_by_round.get(round_number) or []
            rank = next(
                (idx + 1 for idx, row in enumerate(constructors) if str(row.get("team") or "").strip() == team),
                None,
            )
            trend.append(rank)
        team_trends[team] = trend

    constructor_rows = []
    for team in all_teams:
        ranks = team_rank_samples.get(team, [])
        gaps = team_gap_samples.get(team, [])
        if not ranks:
            continue
        constructor_rows.append(
            {
                "team": team,
                "pace_rank": round(sum(ranks) / len(ranks), 3),
                "average_gap_s": round(sum(gaps) / len(gaps), 3) if gaps else 0.0,
                "rounds_sampled": len(ranks),
                "rank_trend": team_trends.get(team, []),
            }
        )
    constructor_rows.sort(key=lambda item: (item["pace_rank"], item["average_gap_s"], item["team"]))

    calendar: list[dict[str, Any]] = []
    for item in schedule_rounds:
        round_number = int(item["round"])
        race_row = by_round_and_type.get((round_number, "R"))
        quali_row = by_round_and_type.get((round_number, "Q")) or by_round_and_type.get((round_number, "SQ"))

        winner = None
        pole = None
        if race_row and race_row.get("results_json"):
            try:
                results_payload = json.loads(race_row["results_json"])
                drivers = results_payload.get("drivers") or []
                win_row = next(
                    (driver for driver in drivers if driver.get("finish_position") == 1),
                    None,
                )
                if win_row:
                    winner = _driver_name(win_row)
            except Exception:
                winner = None

        if quali_row and quali_row.get("results_json"):
            try:
                results_payload = json.loads(quali_row["results_json"])
                drivers = results_payload.get("drivers") or []
                pole_row = next(
                    (driver for driver in drivers if driver.get("finish_position") == 1),
                    None,
                )
                if pole_row:
                    pole = _driver_name(pole_row)
            except Exception:
                pole = None

        calendar.append(
            {
                "round": round_number,
                "event_name": item["event_name"],
                "event_date": item.get("event_date"),
                "winner": winner,
                "pole": pole,
                "session_types": item.get("session_types", []),
            }
        )

    standings = _build_standings(rows)
    return {
        "year": year,
        "total_rounds": len(schedule_rounds),
        "analyzed_rounds": len(analyzed_rounds),
        "constructors": constructor_rows,
        "standings": standings,
        "calendar": calendar,
    }
