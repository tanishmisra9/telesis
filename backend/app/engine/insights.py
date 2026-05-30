"""Deterministic insight phrase generation."""

from __future__ import annotations

from typing import Any

from app.engine.llm import get_refiner


def _q_driver_phrase(rank: int, d: dict[str, Any], best_lap: float) -> str:
    delta = d["lap_time_s"] - best_lap
    return (
        f"P{rank} {d['abbr']} ({d['team']}): {d['lap_time_s']:.3f}s, "
        f"top {d['top_speed_kmh']:.1f} km/h, throttle {d['full_throttle_pct']:.1f}%, "
        f"deployment {d['deployment_loss_kmh']:+.1f} km/h, delta {delta:+.3f}s."
    )


def _r_driver_phrase(rank: int, d: dict[str, Any], fastest: float) -> str:
    iqr = d["stats"]["q3"] - d["stats"]["q1"]
    outliers = len(d["stats"]["outliers"])
    return (
        f"P{rank} {d['abbr']} ({d['team']}): mean {d['stats']['mean']:.3f}s, "
        f"gap {d['gap_to_fastest_s']:+.3f}s, IQR {iqr:.3f}s, outliers {outliers}, "
        f"compounds {','.join(d['stats']['compounds']) or '-'}."
    )


def _r_constructor_phrase(rank: int, c: dict[str, Any]) -> str:
    iqr = c["stats"]["q3"] - c["stats"]["q1"]
    return (
        f"P{rank} {c['team']}: mean {c['stats']['mean']:.3f}s, "
        f"gap {c['gap_to_fastest_s']:+.3f}s, IQR {iqr:.3f}s, "
        f"compounds {','.join(c['stats']['compounds']) or '-'}."
    )


def _build_deterministic_briefing(
    session_type: str,
    pace_payload: dict[str, Any],
    metrics_payload: dict[str, Any],
    driver_items: list[dict[str, Any]],
) -> str:
    session_label = "qualifying" if session_type in {"Q", "SQ"} else "race"
    event = str(pace_payload["session"]["event"])
    if session_type in {"Q", "SQ"} and metrics_payload.get("applicable"):
        drivers = sorted(metrics_payload.get("drivers", []), key=lambda d: d["lap_time_s"])
        if not drivers:
            return f"{event} {session_label}: no complete lap metrics were available."
        p1 = drivers[0]
        p2_delta = (
            f"{drivers[1]['lap_time_s'] - p1['lap_time_s']:+.3f}s"
            if len(drivers) > 1
            else "n/a"
        )
        return (
            f"{event} {session_label}: {p1['abbr']} sets the reference at {p1['lap_time_s']:.3f}s, "
            f"with a gap to P2 of {p2_delta}; top-speed and throttle trends align with the lead pace profile."
        )

    drivers = sorted(pace_payload.get("drivers", []), key=lambda d: d["stats"]["mean"])
    constructors = sorted(
        pace_payload.get("constructors", []), key=lambda c: c["stats"]["mean"]
    )
    if not drivers:
        return f"{event} {session_label}: no representative race pace laps were available."
    lead = drivers[0]
    lead_gap = lead["gap_to_fastest_s"]
    top_team = constructors[0]["team"] if constructors else "Unknown"
    phrase_count = sum(len(item.get("phrases", [])) for item in driver_items[:3])
    return (
        f"{event} {session_label}: {lead['abbr']} leads the pace table with a mean of {lead['stats']['mean']:.3f}s "
        f"and gap {lead_gap:+.3f}s; {top_team} tops constructor pace; {phrase_count} primary signals anchor the briefing."
    )


def build_insights_response(
    session_type: str,
    pace_payload: dict[str, Any],
    metrics_payload: dict[str, Any],
) -> dict[str, Any]:
    session_type = session_type.upper()
    session = pace_payload["session"]

    driver_items: list[dict[str, Any]] = []
    constructor_items: list[dict[str, Any]] = []

    if session_type in {"Q", "SQ"} and metrics_payload.get("applicable", False):
        drivers = sorted(metrics_payload.get("drivers", []), key=lambda d: d["lap_time_s"])
        if drivers:
            best = drivers[0]["lap_time_s"]
            for idx, d in enumerate(drivers, start=1):
                phrases = [_q_driver_phrase(idx, d, best)]
                if d.get("corner_speeds"):
                    slowest = min(d["corner_speeds"], key=lambda c: c["min_speed_kmh"])
                    phrases.append(
                        f"Corner tradeoff: T{slowest['number']} minimum {slowest['min_speed_kmh']:.1f} km/h."
                    )
                driver_items.append({"id": d["abbr"], "phrases": phrases, "refined": None})

            teams: dict[str, list[dict[str, Any]]] = {}
            for d in drivers:
                teams.setdefault(d["team"], []).append(d)
            ranked_teams = sorted(
                teams.items(), key=lambda kv: min(x["lap_time_s"] for x in kv[1])
            )
            for idx, (team, entries) in enumerate(ranked_teams, start=1):
                best_driver = min(entries, key=lambda e: e["lap_time_s"])
                phrases = [
                    f"P{idx} {team}: lead lap {best_driver['lap_time_s']:.3f}s by {best_driver['abbr']}."
                ]
                constructor_items.append({"id": team, "phrases": phrases, "refined": None})
    else:
        drivers = sorted(pace_payload.get("drivers", []), key=lambda d: d["stats"]["mean"])
        constructors = sorted(
            pace_payload.get("constructors", []), key=lambda c: c["stats"]["mean"]
        )
        if drivers:
            fastest = drivers[0]["stats"]["mean"]
            for idx, d in enumerate(drivers, start=1):
                driver_items.append(
                    {"id": d["abbr"], "phrases": [_r_driver_phrase(idx, d, fastest)], "refined": None}
                )
        for idx, c in enumerate(constructors, start=1):
            constructor_items.append(
                {"id": c["team"], "phrases": [_r_constructor_phrase(idx, c)], "refined": None}
            )

    payload = {
        "session": session,
        "mode": "quali" if session_type in {"Q", "SQ"} else "race",
        "drivers": driver_items,
        "constructors": constructor_items,
        "briefing": _build_deterministic_briefing(
            session_type, pace_payload, metrics_payload, driver_items
        ),
    }
    return get_refiner().refine(payload)
