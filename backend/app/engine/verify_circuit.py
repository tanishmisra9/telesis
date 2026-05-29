"""Print circuit geometry summary for sanity checks."""

from __future__ import annotations

import sys

from app.cache import enable_cache, init_db
from app.engine.pipeline import ensure_circuit


def main() -> None:
    init_db()
    enable_cache()
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    round_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    session_type = sys.argv[3] if len(sys.argv) > 3 else "R"

    print(f"Loading circuit for {year} round {round_num} {session_type}...")
    payload = ensure_circuit(
        f"{year}:{round_num}:{session_type.lower()}",
        year,
        round_num,
        session_type,
    )
    print(f"Circuit: {payload['name']}")
    print(f"Length: {payload['length_m']:.0f} m")
    print(f"Rotation: {payload['rotation_applied_deg']:.1f} deg")
    print(f"Corners: {len(payload['corners'])}")
    print(f"DRS zones: {len(payload['drs_zones'])}")
    splits = payload.get("sector_splits")
    print(f"Sector splits: {splits if splits else 'none'}")
    print(
        f"Points: centerline={len(payload['centerline'])}, "
        f"inner={len(payload['inner'])}, outer={len(payload['outer'])}"
    )
    bbox = payload["bbox"]
    print(
        f"BBox: x=[{bbox['x_min']:.0f},{bbox['x_max']:.0f}] "
        f"y=[{bbox['y_min']:.0f},{bbox['y_max']:.0f}]"
    )


if __name__ == "__main__":
    main()
