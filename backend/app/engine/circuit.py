"""Circuit geometry from fastest-lap telemetry."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from app.engine.exceptions import CircuitGeometryUnavailable

# Increment whenever circuit extraction logic changes in a way that should
# invalidate cached `circuit_json`.
CIRCUIT_LOGIC_VERSION = 3

# FastF1 DRS channel encoding (telemetry["DRS"]):
# - 0: DRS not available/off
# - 1: DRS available but not activated
# - 8: Detected/eligible once in activation zone
# - 10/12/14: DRS on / open
#
# DRS diagnostic (2024 R1 Bahrain):
# - Race fastest lap unique DRS codes: [0]
# - Representative mid-race green-flag lap unique codes: [0, 8, 12, 14]
# - Qualifying fastest lap unique codes: [8, 12, 14]
#
# We keep 8/10/12/14 as active states for compatibility with FastF1 code
# variations observed across sessions.
DRS_ACTIVE_VALUES = frozenset({8, 10, 12, 14})
DEFAULT_TRACK_WIDTH = 200.0


def _to_float(value: Any) -> float:
    if hasattr(value, "item"):
        return float(value.item())
    return float(value)


def _points_from_xy(xs: np.ndarray, ys: np.ndarray) -> list[tuple[float, float]]:
    return [(float(x), float(y)) for x, y in zip(xs, ys)]


def rotate_points(
    xs: np.ndarray, ys: np.ndarray, deg: float, cx: float, cy: float
) -> tuple[np.ndarray, np.ndarray]:
    r = math.radians(deg)
    cos_r, sin_r = math.cos(r), math.sin(r)
    rx = cx + (xs - cx) * cos_r - (ys - cy) * sin_r
    ry = cy + (xs - cx) * sin_r + (ys - cy) * cos_r
    return rx, ry


def build_track_edges(
    x: np.ndarray, y: np.ndarray, track_width: float = DEFAULT_TRACK_WIDTH
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    dx, dy = np.gradient(x), np.gradient(y)
    norm = np.hypot(dx, dy)
    norm[norm == 0] = 1.0
    dx, dy = dx / norm, dy / norm
    nx, ny = -dy, dx
    half = track_width / 2.0
    x_outer = x + nx * half
    y_outer = y + ny * half
    x_inner = x - nx * half
    y_inner = y - ny * half
    return x, y, x_inner, y_inner, x_outer, y_outer


def _compute_bbox(
    *arrays: tuple[np.ndarray, np.ndarray],
) -> dict[str, float]:
    all_x: list[np.ndarray] = []
    all_y: list[np.ndarray] = []
    for xs, ys in arrays:
        all_x.append(xs)
        all_y.append(ys)
    xs_cat = np.concatenate(all_x)
    ys_cat = np.concatenate(all_y)
    return {
        "x_min": float(xs_cat.min()),
        "x_max": float(xs_cat.max()),
        "y_min": float(ys_cat.min()),
        "y_max": float(ys_cat.max()),
    }


def _detect_drs_spans(telemetry: pd.DataFrame) -> list[dict[str, float]]:
    """Detect DRS-active spans using `Distance` only.

    Returned spans are in meters and later mapped onto the geometry basis
    (the fastest-lap XY outline) by slicing with the same meter boundaries.
    """
    if "DRS" not in telemetry.columns or "Distance" not in telemetry.columns:
        return []

    drs = telemetry["DRS"].to_numpy()
    dist = telemetry["Distance"].to_numpy()
    if drs.size == 0:
        return []

    active = np.isin(drs, list(DRS_ACTIVE_VALUES))
    if not active.any():
        return []

    spans: list[dict[str, float]] = []
    in_zone = False
    start_idx = 0

    for i, is_active in enumerate(active):
        if is_active and not in_zone:
            in_zone = True
            start_idx = i
        elif not is_active and in_zone:
            in_zone = False
            span = {
                "start_m": _to_float(dist[start_idx]),
                "end_m": _to_float(dist[i - 1]),
            }
            if span["end_m"] > span["start_m"]:
                spans.append(span)

    if in_zone:
        span = {
            "start_m": _to_float(dist[start_idx]),
            "end_m": _to_float(dist[-1]),
        }
        if span["end_m"] > span["start_m"]:
            spans.append(span)

    return spans


def _slice_points_by_distance(
    x: np.ndarray,
    y: np.ndarray,
    dist_m: np.ndarray,
    start_m: float,
    end_m: float,
) -> list[tuple[float, float]]:
    if dist_m.size < 2 or x.size != dist_m.size or y.size != dist_m.size:
        return []
    if end_m <= start_m:
        return []

    i0 = int(np.searchsorted(dist_m, start_m, side="left"))
    i1 = int(np.searchsorted(dist_m, end_m, side="right")) - 1
    i0 = max(0, min(i0, dist_m.size - 1))
    i1 = max(0, min(i1, dist_m.size - 1))
    if i1 < i0:
        return []

    return _points_from_xy(x[i0 : i1 + 1], y[i0 : i1 + 1])


def _drs_active_sample_count(telemetry: pd.DataFrame) -> int:
    if telemetry is None or telemetry.empty or "DRS" not in telemetry.columns:
        return 0
    drs = telemetry["DRS"].to_numpy(dtype=float)
    drs = drs[~np.isnan(drs)]
    if drs.size == 0:
        return 0
    return int(np.isin(drs, list(DRS_ACTIVE_VALUES)).sum())


def _pick_representative_drs_telemetry(session) -> pd.DataFrame | None:
    """Pick lap telemetry with highest DRS-active sample count.

    Order:
    1) Leader's green-flag laps.
    2) All drivers, all laps fallback.
    """

    def best_from_laps(laps: pd.DataFrame) -> pd.DataFrame | None:
        best_tel: pd.DataFrame | None = None
        best_count = 0
        for _, lap in laps.iterlaps():
            try:
                tel = lap.get_telemetry()
            except Exception:
                continue
            count = _drs_active_sample_count(tel)
            if count > best_count:
                best_count = count
                best_tel = tel
        return best_tel if best_count > 0 else None

    try:
        leader_abbr = str(session.results.iloc[0]["Abbreviation"])
        leader_laps = session.laps.pick_drivers(leader_abbr)
        if "TrackStatus" in leader_laps.columns:
            leader_laps = leader_laps[
                leader_laps["TrackStatus"].fillna("").astype(str) == "1"
            ]
        best = best_from_laps(leader_laps)
        if best is not None:
            return best
    except Exception:
        pass

    try:
        driver_abbrs = sorted(session.laps["Driver"].dropna().unique().tolist())
    except Exception:
        driver_abbrs = []

    overall_best: pd.DataFrame | None = None
    overall_best_count = 0
    for abbr in driver_abbrs:
        laps = session.laps.pick_drivers(abbr)
        if laps.empty:
            continue
        candidate = best_from_laps(laps)
        if candidate is None:
            continue
        count = _drs_active_sample_count(candidate)
        if count > overall_best_count:
            overall_best_count = count
            overall_best = candidate
    return overall_best


def _sector_time_seconds(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    try:
        if hasattr(value, "total_seconds"):
            secs = float(value.total_seconds())
        else:
            secs = float(value)
    except (TypeError, ValueError):
        return None
    if secs <= 0:
        return None
    return secs


def _derive_sector_splits(
    fastest_lap: pd.Series,
    tel: pd.DataFrame,
    length_m: float,
) -> list[float] | None:
    """Map sector1/2/3 lap times to cumulative distance boundaries along the lap."""
    if length_m <= 0:
        return None

    s1 = _sector_time_seconds(fastest_lap.get("Sector1Time"))
    s2 = _sector_time_seconds(fastest_lap.get("Sector2Time"))
    s3 = _sector_time_seconds(fastest_lap.get("Sector3Time"))
    if s1 is None or s2 is None or s3 is None:
        return None

    if "SessionTime" not in tel.columns or "Distance" not in tel.columns:
        return None

    session_time = tel["SessionTime"]
    if hasattr(session_time.iloc[0], "total_seconds"):
        elapsed = (session_time - session_time.iloc[0]).dt.total_seconds().to_numpy(dtype=float)
    else:
        elapsed = (session_time - session_time.iloc[0]).astype(float)

    dist = tel["Distance"].to_numpy(dtype=float)
    if elapsed.size < 2 or dist.size < 2:
        return None

    t1 = s1
    t2 = s1 + s2
    if t2 <= t1:
        return None

    split1 = float(np.interp(t1, elapsed, dist))
    split2 = float(np.interp(t2, elapsed, dist))

    if not (0 < split1 < split2 < length_m):
        return None

    return [split1, split2]


def _extract_corners(session, rotation_deg: float, cx: float, cy: float) -> list[dict[str, Any]]:
    try:
        circuit_info = session.get_circuit_info()
    except Exception:
        return []

    corners_df = getattr(circuit_info, "corners", None)
    if corners_df is None or corners_df.empty:
        return []

    corners: list[dict[str, Any]] = []
    for _, row in corners_df.iterrows():
        x_val = row.get("X")
        y_val = row.get("Y")
        if pd.isna(x_val) or pd.isna(y_val):
            continue
        xs = np.array([float(x_val)])
        ys = np.array([float(y_val)])
        rx, ry = rotate_points(xs, ys, rotation_deg, cx, cy)
        dist = row.get("Distance", 0.0)
        corners.append(
            {
                "number": int(row["Number"]),
                "dist_m": _to_float(dist) if not pd.isna(dist) else 0.0,
                "x": float(rx[0]),
                "y": float(ry[0]),
            }
        )
    return corners


def build_circuit_response(session) -> dict[str, Any]:
    """Build circuit payload from a loaded FastF1 session."""
    fastest = session.laps.pick_fastest()
    if fastest is None or (hasattr(fastest, "empty") and fastest.empty):
        raise CircuitGeometryUnavailable("No fastest lap available for circuit geometry")

    try:
        tel = fastest.get_telemetry()
    except Exception as exc:
        raise CircuitGeometryUnavailable(
            f"Could not load fastest-lap telemetry: {exc}"
        ) from exc

    if tel is None or tel.empty or "X" not in tel.columns or "Y" not in tel.columns:
        raise CircuitGeometryUnavailable("Fastest-lap telemetry has no position data")

    x = tel["X"].to_numpy(dtype=float)
    y = tel["Y"].to_numpy(dtype=float)
    if x.size < 2:
        raise CircuitGeometryUnavailable("Fastest-lap telemetry is too short for a track outline")

    x, y, x_inner, y_inner, x_outer, y_outer = build_track_edges(x, y)
    bbox = _compute_bbox((x, y), (x_inner, y_inner), (x_outer, y_outer))
    cx = (bbox["x_min"] + bbox["x_max"]) / 2.0
    cy = (bbox["y_min"] + bbox["y_max"]) / 2.0

    rotation_deg = 0.0
    try:
        circuit_info = session.get_circuit_info()
        rotation_deg = float(getattr(circuit_info, "rotation", 0.0) or 0.0)
    except Exception:
        rotation_deg = 0.0

    x, y = rotate_points(x, y, rotation_deg, cx, cy)
    x_inner, y_inner = rotate_points(x_inner, y_inner, rotation_deg, cx, cy)
    x_outer, y_outer = rotate_points(x_outer, y_outer, rotation_deg, cx, cy)
    bbox = _compute_bbox((x, y), (x_inner, y_inner), (x_outer, y_outer))

    # DRS spans are detected from telemetry (code semantics), then mapped
    # onto the fastest-lap geometry by slicing XY using distance meters.
    drs_spans = _detect_drs_spans(tel)
    if not drs_spans:
        rep_tel = _pick_representative_drs_telemetry(session)
        if rep_tel is not None:
            drs_spans = _detect_drs_spans(rep_tel) or []

    drs_zones: list[dict[str, Any]] = []
    if drs_spans and "Distance" in tel.columns:
        dist_fast = tel["Distance"].to_numpy(dtype=float)
        for span in drs_spans:
            polyline = _slice_points_by_distance(
                x, y, dist_fast, span["start_m"], span["end_m"]
            )
            if polyline:
                drs_zones.append(
                    {
                        "start_m": span["start_m"],
                        "end_m": span["end_m"],
                        "polyline": polyline,
                    }
                )
    corners = _extract_corners(session, rotation_deg, cx, cy)

    circuit_name = str(session.event.get("Location", session.event.get("EventName", "Unknown")))
    try:
        info = session.get_circuit_info()
        circuit_name = str(getattr(info, "name", circuit_name) or circuit_name)
    except Exception:
        pass

    length_m = 0.0
    centerline_dist_m: list[float] = []
    if "Distance" in tel.columns and len(tel) > 0:
        length_m = _to_float(tel["Distance"].max())
        centerline_dist_m = [float(v) for v in tel["Distance"].to_numpy(dtype=float)]

    sector_splits = _derive_sector_splits(fastest, tel, length_m)

    return {
        "name": circuit_name,
        "length_m": length_m,
        "rotation_applied_deg": rotation_deg,
        "circuit_logic_version": CIRCUIT_LOGIC_VERSION,
        "bbox": bbox,
        "centerline": _points_from_xy(x, y),
        "centerline_dist_m": centerline_dist_m,
        "inner": _points_from_xy(x_inner, y_inner),
        "outer": _points_from_xy(x_outer, y_outer),
        "corners": corners,
        "drs_zones": drs_zones,
        "sector_splits": sector_splits,
    }
