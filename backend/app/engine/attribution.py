"""Comparative attribution engine."""

from __future__ import annotations

from collections import defaultdict
from typing import Any


DIMENSIONS = (
    "high_speed_corners",
    "medium_speed_corners",
    "low_speed_corners",
    "straight_line",
    "full_throttle",
    "deployment",
)


DIMENSION_LABELS = {
    "high_speed_corners": "high-speed corners",
    "medium_speed_corners": "medium-speed corners",
    "low_speed_corners": "slow corners",
    "straight_line": "top speed",
    "full_throttle": "full-throttle share",
    "deployment": "deployment",
}


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _normalize(raw: dict[str, dict[str, float]]) -> dict[str, dict[str, float]]:
    by_dim: dict[str, list[float]] = {dim: [] for dim in DIMENSIONS}
    for profile in raw.values():
        for dim in DIMENSIONS:
            by_dim[dim].append(float(profile.get(dim, 0.0)))

    bounds = {
        dim: (min(vals) if vals else 0.0, max(vals) if vals else 0.0)
        for dim, vals in by_dim.items()
    }
    normalized: dict[str, dict[str, float]] = {}
    for entity_id, profile in raw.items():
        normalized[entity_id] = {}
        for dim in DIMENSIONS:
            lo, hi = bounds[dim]
            value = float(profile.get(dim, 0.0))
            if hi <= lo:
                normalized[entity_id][dim] = 0.5
            else:
                normalized[entity_id][dim] = max(0.0, min(1.0, (value - lo) / (hi - lo)))
    return normalized


def _rank(normalized: dict[str, dict[str, float]], dim: str) -> dict[str, int]:
    ranked = sorted(normalized.items(), key=lambda item: item[1].get(dim, 0.0), reverse=True)
    return {entity_id: idx + 1 for idx, (entity_id, _) in enumerate(ranked)}


def _ordinal(rank: int) -> str:
    if 10 <= rank % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(rank % 10, "th")
    return f"{rank}{suffix}"


def _superlative_or_rank(rank: int, total: int, label: str) -> str:
    if rank == 1:
        return f"fastest in {label}"
    if rank == total:
        return f"slowest in {label}"
    return f"{_ordinal(rank)} in {label}"


def _chip_text(dim: str, rank: int, total: int) -> str:
    label = DIMENSION_LABELS[dim]
    return _superlative_or_rank(rank, total, label)


def _evidence_row(raw_profile: dict[str, float]) -> list[str]:
    return [
        f"High-speed apex average {raw_profile['high_speed_corners']:.1f} km/h",
        f"Slow-corner apex average {raw_profile['low_speed_corners']:.1f} km/h",
        f"Top speed {raw_profile['straight_line']:.1f} km/h",
        f"Full throttle {raw_profile['full_throttle']:.1f}%, deployment delta {raw_profile['deployment']:+.1f} km/h",
    ]


def _tradeoff_line(profile: dict[str, float]) -> str | None:
    hs = profile["high_speed_corners"]
    ls = profile["low_speed_corners"]
    sl = profile["straight_line"]
    if sl > 0.7 and hs < 0.35:
        return "It looks trimmed for straight-line speed at the expense of high-speed grip."
    if sl < 0.35 and hs > 0.7:
        return "It looks loaded for cornering and gives up straight-line speed."
    if ls > 0.7 and hs < 0.4:
        return "Mechanical grip is a strength, but aero load drops away as speed rises."
    return None


def _strength_weakness_dimensions(
    pace_rank: int, dim_ranks: dict[str, int], total: int
) -> tuple[str, str]:
    deltas = {
        dim: pace_rank - rank
        for dim, rank in dim_ranks.items()
        if dim in DIMENSION_LABELS and rank <= total
    }
    strength = max(deltas, key=lambda dim: (deltas[dim], -dim_ranks[dim]))
    weakness = min(deltas, key=lambda dim: (deltas[dim], dim_ranks[dim]))
    if strength == weakness:
        ordered = sorted(deltas, key=lambda dim: deltas[dim], reverse=True)
        if len(ordered) > 1:
            weakness = ordered[-1]
    return strength, weakness


def _confidence(
    teammate_count: int,
    dim_gap: int,
    weakness_gap: int,
) -> tuple[str, str | None]:
    if teammate_count < 2:
        return "low", "Limited clean-lap overlap across teammates."
    spread = max(abs(dim_gap), abs(weakness_gap))
    if spread >= 5:
        return "high", None
    if spread >= 3:
        return "medium", None
    return "low", "Signals are tightly clustered against pace rank."


def _verdict_line(
    team: str,
    pace_rank: int,
    strength: tuple[str, int],
    weakness: tuple[str, int],
    total: int,
) -> str:
    rank_label = "leads on pace" if pace_rank == 1 else f"runs {_ordinal(pace_rank)} on pace"
    strength_label = _superlative_or_rank(strength[1], total, DIMENSION_LABELS[strength[0]])
    weakness_label = _superlative_or_rank(weakness[1], total, DIMENSION_LABELS[weakness[0]])
    return f"{team} {rank_label}, with {strength_label} but {weakness_label}."


def _driver_takeaway(
    abbr: str,
    pace_rank: int,
    strength: tuple[str, int],
    weakness: tuple[str, int],
    total: int,
) -> str:
    strength_label = _superlative_or_rank(strength[1], total, DIMENSION_LABELS[strength[0]])
    weakness_label = _superlative_or_rank(weakness[1], total, DIMENSION_LABELS[weakness[0]])
    return f"{abbr} runs {_ordinal(pace_rank)} on pace, strongest at {strength_label} but weaker at {weakness_label}."


def _confidence_from_driver_count(driver_count: int) -> str:
    if driver_count >= 16:
        return "high"
    if driver_count >= 10:
        return "medium"
    return "low"


def build_attribution_payload(
    session_type: str,
    pace_payload: dict[str, Any],
    metrics_payload: dict[str, Any],
    circuit_payload: dict[str, Any],
) -> dict[str, Any]:
    session_type = session_type.upper()
    drivers = metrics_payload.get("drivers", [])
    if not drivers:
        mode = "quali" if session_type in {"Q", "SQ"} else ("race" if session_type in {"R", "S"} else "practice")
        return {
            "session": pace_payload["session"],
            "mode": mode,
            "verdict": "Telemetry was insufficient for an attribution verdict in this session.",
            "drivers": [],
            "constructors": [],
        }

    corner_class = {
        int(corner["number"]): corner.get("speed_class")
        for corner in circuit_payload.get("corners", [])
        if corner.get("speed_class")
    }

    driver_raw: dict[str, dict[str, float]] = {}
    team_to_drivers: dict[str, list[str]] = defaultdict(list)
    for d in drivers:
        by_class: dict[str, list[float]] = {"high": [], "medium": [], "low": []}
        for corner in d.get("corner_speeds", []):
            speed_class = corner_class.get(int(corner.get("number", 0)))
            if speed_class in by_class:
                by_class[speed_class].append(float(corner.get("min_speed_kmh", 0.0)))
        profile = {
            "high_speed_corners": _mean(by_class["high"]),
            "medium_speed_corners": _mean(by_class["medium"]),
            "low_speed_corners": _mean(by_class["low"]),
            "straight_line": float(d.get("top_speed_kmh", 0.0)),
            "full_throttle": float(d.get("full_throttle_pct", 0.0)),
            "deployment": float(d.get("deployment_loss_kmh", 0.0)),
        }
        driver_raw[str(d["abbr"])] = profile
        team_to_drivers[str(d["team"])].append(str(d["abbr"]))

    team_raw: dict[str, dict[str, float]] = {}
    for team, abbrs in team_to_drivers.items():
        team_raw[team] = {
            dim: _mean([driver_raw[abbr][dim] for abbr in abbrs if abbr in driver_raw])
            for dim in DIMENSIONS
        }

    driver_profile = _normalize(driver_raw)
    team_profile = _normalize(team_raw)
    ranks = {dim: _rank(team_profile, dim) for dim in DIMENSIONS}
    total_teams = max(1, len(team_profile))
    pace_rank = {row["team"]: idx + 1 for idx, row in enumerate(pace_payload.get("constructors", []))}

    constructors: list[dict[str, Any]] = []
    for team, profile in sorted(team_profile.items(), key=lambda kv: pace_rank.get(kv[0], 999)):
        team_dim_ranks = {dim: ranks[dim].get(team, total_teams) for dim in DIMENSIONS}
        team_pace_rank = pace_rank.get(team, total_teams)
        strength_dim, weakness_dim = _strength_weakness_dimensions(
            team_pace_rank, team_dim_ranks, total_teams
        )
        strength_rank = team_dim_ranks[strength_dim]
        weakness_rank = team_dim_ranks[weakness_dim]
        teammate_count = len(team_to_drivers.get(team, []))
        confidence, confidence_note = _confidence(
            teammate_count,
            team_pace_rank - strength_rank,
            team_pace_rank - weakness_rank,
        )
        takeaway = (
            f"{team} runs {_ordinal(team_pace_rank)} on pace. "
            f"{_superlative_or_rank(strength_rank, total_teams, DIMENSION_LABELS[strength_dim]).capitalize()} "
            f"but {_superlative_or_rank(weakness_rank, total_teams, DIMENSION_LABELS[weakness_dim])}."
        )
        tradeoff = _tradeoff_line(profile)
        if tradeoff:
            takeaway = f"{takeaway} {tradeoff}"
        chips = [
            _chip_text(strength_dim, strength_rank, total_teams),
            _chip_text(weakness_dim, weakness_rank, total_teams),
        ]
        if tradeoff:
            chips.append("clear setup tradeoff")
        constructors.append(
            {
                "id": team,
                "takeaway": takeaway,
                "headline_nuggets": [takeaway],
                "rank_chips": chips[:3],
                "profile": profile,
                "profile_ranks": team_dim_ranks,
                "evidence": _evidence_row(team_raw[team]),
                "pace_rank": team_pace_rank,
                "confidence": confidence,
                "confidence_note": confidence_note,
            }
        )

    driver_items: list[dict[str, Any]] = []
    driver_pace = sorted(
        metrics_payload.get("drivers", []), key=lambda row: float(row.get("lap_time_s", 9999.0))
    )
    driver_pace_rank = {str(row["abbr"]): idx + 1 for idx, row in enumerate(driver_pace)}
    driver_ranks = {dim: _rank(driver_profile, dim) for dim in DIMENSIONS}
    total_drivers = max(1, len(driver_profile))
    for abbr, profile in sorted(driver_profile.items(), key=lambda kv: driver_pace_rank.get(kv[0], 999)):
        dim_ranks = {dim: driver_ranks[dim].get(abbr, total_drivers) for dim in DIMENSIONS}
        pace_position = driver_pace_rank.get(abbr, total_drivers)
        strength_dim, weakness_dim = _strength_weakness_dimensions(
            pace_position, dim_ranks, total_drivers
        )
        strength = (strength_dim, dim_ranks[strength_dim])
        weakness = (weakness_dim, dim_ranks[weakness_dim])
        takeaway = _driver_takeaway(abbr, pace_position, strength, weakness, total_drivers)
        driver_items.append(
            {
                "id": abbr,
                "takeaway": takeaway,
                "headline_nuggets": [takeaway],
                "rank_chips": [
                    _chip_text(strength_dim, strength[1], total_drivers),
                    _chip_text(weakness_dim, weakness[1], total_drivers),
                ],
                "profile": profile,
                "profile_ranks": dim_ranks,
                "evidence": [
                    f"Top speed {driver_raw[abbr]['straight_line']:.1f} km/h",
                    f"Full throttle {driver_raw[abbr]['full_throttle']:.1f}%",
                    f"Deployment delta {driver_raw[abbr]['deployment']:+.1f} km/h",
                ],
                "pace_rank": pace_position,
                "confidence": _confidence_from_driver_count(total_drivers),
                "confidence_note": (
                    "Limited field sample in this session."
                    if total_drivers < 10
                    else None
                ),
            }
        )

    ranked_constructors = sorted(constructors, key=lambda item: item.get("pace_rank", 999))
    top = ranked_constructors[:3]
    sentences: list[str] = []
    if top:
        lead = top[0]
        lead_strength = max(
            DIMENSIONS,
            key=lambda dim: (lead["pace_rank"] or total_teams) - lead["profile_ranks"].get(dim, total_teams),
        )
        lead_weakness = min(
            DIMENSIONS,
            key=lambda dim: (lead["pace_rank"] or total_teams) - lead["profile_ranks"].get(dim, total_teams),
        )
        sentences.append(
            _verdict_line(
                lead["id"],
                lead.get("pace_rank", 1),
                (lead_strength, lead["profile_ranks"].get(lead_strength, total_teams)),
                (lead_weakness, lead["profile_ranks"].get(lead_weakness, total_teams)),
                total_teams,
            )
        )
    if len(top) > 1:
        second = top[1]
        s_strength = max(
            DIMENSIONS,
            key=lambda dim: (second["pace_rank"] or total_teams) - second["profile_ranks"].get(dim, total_teams),
        )
        s_weakness = min(
            DIMENSIONS,
            key=lambda dim: (second["pace_rank"] or total_teams) - second["profile_ranks"].get(dim, total_teams),
        )
        sentences.append(
            _verdict_line(
                second["id"],
                second.get("pace_rank", 2),
                (s_strength, second["profile_ranks"].get(s_strength, total_teams)),
                (s_weakness, second["profile_ranks"].get(s_weakness, total_teams)),
                total_teams,
            )
        )
    if len(top) > 2:
        third = top[2]
        t_strength = max(
            DIMENSIONS,
            key=lambda dim: (third["pace_rank"] or total_teams) - third["profile_ranks"].get(dim, total_teams),
        )
        t_weakness = min(
            DIMENSIONS,
            key=lambda dim: (third["pace_rank"] or total_teams) - third["profile_ranks"].get(dim, total_teams),
        )
        sentences.append(
            _verdict_line(
                third["id"],
                third.get("pace_rank", 3),
                (t_strength, third["profile_ranks"].get(t_strength, total_teams)),
                (t_weakness, third["profile_ranks"].get(t_weakness, total_teams)),
                total_teams,
            )
        )
    sentences.append(
        "Signals are telemetry-based tendencies, and deeper numbers stay in the expanded details."
    )
    verdict = " ".join(sentences[:5]).replace("—", ",")

    mode = "quali" if session_type in {"Q", "SQ"} else ("race" if session_type in {"R", "S"} else "practice")
    return {
        "session": pace_payload["session"],
        "mode": mode,
        "verdict": verdict,
        "drivers": driver_items,
        "constructors": ranked_constructors,
    }
