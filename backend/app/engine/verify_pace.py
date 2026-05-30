"""Print pace box-plot stats for sanity-checking (2024 R01 race)."""

from __future__ import annotations

import json
import sys

from app.cache import enable_cache, init_db, make_key
from app.engine.pipeline import ensure_pace


def main() -> None:
    init_db()
    enable_cache()
    year, round_num, session_type = 2024, 1, "R"
    print(f"Running pace pipeline for {year} round {round_num} {session_type}...")
    key = make_key(year, round_num, session_type)
    payload = ensure_pace(key, year, round_num, session_type)
    print(f"\nEvent: {payload['session']['event']}")
    print("\nDrivers (sorted by mean, fastest first):")
    print(f"{'ABBR':<6} {'TEAM':<22} {'MEAN':>8} {'MED':>8} {'Q1':>8} {'Q3':>8} {'WLO':>8} {'WHI':>8} {'N':>4} {'GAP':>6}")
    for d in payload["drivers"]:
        s = d["stats"]
        print(
            f"{d['abbr']:<6} {d['team'][:22]:<22} {s['mean']:8.3f} {s['median']:8.3f} "
            f"{s['q1']:8.3f} {s['q3']:8.3f} {s['whisker_low']:8.3f} {s['whisker_high']:8.3f} "
            f"{s['n_laps']:4d} {d['gap_to_fastest_s']:+6.3f}"
        )
    print("\nConstructors:")
    for c in payload["constructors"][:5]:
        s = c["stats"]
        print(f"  {c['team']}: mean={s['mean']:.3f}s gap={c['gap_to_fastest_s']:+.3f}s n={s['n_laps']}")
    if "--json" in sys.argv:
        print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
