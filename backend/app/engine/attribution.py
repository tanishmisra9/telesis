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


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _normalize(raw: dict[str, float]) -> dict[str, float]:
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


def _tier(rank: int, total: int) -> str:
    if total <= 2:
        return "top" if rank == 1 else "bottom"
    pct = (rank - 1) / max(1, total - 1)
    if pct <= 0.33:
        return "top"
    if pct >= 0.67:
        return "bottom"
    return "mid"


def _phrase_for_signal(signal: str, tier: str) -> str | None:
    mapping = {
        ("high_speed_corners", "top"): "strong in fast corners, points to a high-downforce package",
        ("high_speed_corners", "bottom"): "loses time in fast corners, looks short on downforce",
        ("low_speed_corners", "top"): "strong mechanical grip and traction out of slow corners",
        ("low_speed_corners", "bottom"): "traction-limited on slow-corner exit, suggests balance limitations",
        ("straight_line", "top"): "best straight-line speed",
        ("straight_line", "bottom"): "down on the straights",
    }
    return mapping.get((signal, tier))


def _tradeoff_nugget(profile: dict[str, float]) -> str | None:
    hs = profile["high_speed_corners"]
    ls = profile["low_speed_corners"]
    sl = profile["straight_line"]
    ft = profile["full_throttle"]
    dep = profile["deployment"]
    if sl > 0.75 and hs < 0.4:
        return "likely low-downforce setup, trading cornering for the straights"
    if sl < 0.35 and hs > 0.75:
        return "likely high-downforce setup, trading straight-line speed for cornering"
    if hs > 0.7 and ls > 0.7 and (ft > 0.7 and dep < 0.35):
        return "chassis looks strong, while power delivery appears to be the limiting factor"
    if ls > 0.7 and hs < 0.4:
        return "strong in slow corners but drops off at high speed, suggesting aero load limits"
    return None


def _evidence_row(team: str, raw_profile: dict[str, float], ranks: dict[str, dict[str, int]]) -> list[str]:
    return [
        f"High-speed corner profile {raw_profile['high_speed_corners']:.1f} km/h, rank {ranks['high_speed_corners'][team]}",
        f"Straight-line speed {raw_profile['straight_line']:.1f} km/h, rank {ranks['straight_line'][team]}",
        f"Full throttle {raw_profile['full_throttle']:.1f}% and deployment delta {raw_profile['deployment']:+.1f} km/h",
    ]


def _confidence(nuggets: list[str]) -> str:
    if len(nuggets) >= 3:
        return "high"
    if len(nuggets) == 2:
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

    constructors: list[dict[str, Any]] = []
    for team, profile in sorted(team_profile.items(), key=lambda kv: kv[1]["straight_line"], reverse=True):
        nuggets: list[str] = []
        for signal in ("high_speed_corners", "low_speed_corners", "straight_line"):
            tier = _tier(ranks[signal].get(team, total_teams), total_teams)
            phrase = _phrase_for_signal(signal, tier)
            if phrase:
                nuggets.append(phrase)
        if profile["full_throttle"] > 0.75 and profile["straight_line"] < 0.35:
            nuggets.append("runs full throttle longest to offset a straight-line deficit")
        if profile["deployment"] < 0.3:
            nuggets.append("energy deployment appears to run out before the line")
        tradeoff = _tradeoff_nugget(profile)
        if tradeoff:
            nuggets.append(tradeoff)
        nuggets = nuggets[:4]
        constructors.append(
            {
                "id": team,
                "headline_nuggets": nuggets,
                "profile": profile,
                "evidence": _evidence_row(team, team_raw[team], ranks),
                "confidence": _confidence(nuggets),
            }
        )

    driver_items: list[dict[str, Any]] = []
    for abbr, profile in sorted(driver_profile.items(), key=lambda kv: kv[1]["straight_line"], reverse=True):
        driver_items.append(
            {
                "id": abbr,
                "headline_nuggets": [
                    f"{abbr} shows strongest signal in "
                    f"{max(DIMENSIONS, key=lambda dim: profile[dim]).replace('_', ' ')}"
                ],
                "profile": profile,
                "evidence": [
                    f"Top speed {driver_raw[abbr]['straight_line']:.1f} km/h",
                    f"Full throttle {driver_raw[abbr]['full_throttle']:.1f}%",
                    f"Deployment delta {driver_raw[abbr]['deployment']:+.1f} km/h",
                ],
                "confidence": "medium",
            }
        )

    pace_rank = {row["team"]: idx + 1 for idx, row in enumerate(pace_payload.get("constructors", []))}
    ranked_constructors = sorted(
        constructors,
        key=lambda item: (pace_rank.get(item["id"], 999), -item["profile"]["high_speed_corners"]),
    )
    top = ranked_constructors[:3]
    sentences: list[str] = []
    if top:
        lead = top[0]
        lead_nugget = lead["headline_nuggets"][0] if lead["headline_nuggets"] else "sets the pace profile"
        sentences.append(f"{lead['id']} leads the session profile and {lead_nugget}.")
    if len(top) > 1:
        second = top[1]
        second_nugget = second["headline_nuggets"][0] if second["headline_nuggets"] else "shows a mixed package"
        sentences.append(f"{second['id']} follows with a contrasting balance, and {second_nugget}.")
    if len(top) > 2:
        third = top[2]
        third_nugget = third["headline_nuggets"][0] if third["headline_nuggets"] else "sits in the midfield profile"
        sentences.append(f"{third['id']} sits next in the order, where telemetry {third_nugget}.")
    sentences.append("These signals are inferred from telemetry rankings and should be read as evidence-backed tendencies.")
    verdict = " ".join(sentences[:5]).replace("—", ",")

    mode = "quali" if session_type in {"Q", "SQ"} else ("race" if session_type in {"R", "S"} else "practice")
    return {
        "session": pace_payload["session"],
        "mode": mode,
        "verdict": verdict,
        "drivers": driver_items,
        "constructors": ranked_constructors,
    }
