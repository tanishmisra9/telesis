"""One-off DRS raw channel diagnostic.

Print unique `DRS` channel values from the fastest lap telemetry for:
- 2024 Bahrain Race
- 2024 Bahrain Qualifying

Used by M4.6 to validate which DRS codes indicate DRS activation/open.
"""

from __future__ import annotations

import sys
from typing import Iterable

import numpy as np

from app.engine.loader import load_session


def _unique_sorted_ints(values: Iterable[object]) -> list[int]:
    arr = np.asarray(list(values), dtype=float)
    arr = arr[~np.isnan(arr)]
    if arr.size == 0:
        return []
    return sorted({int(v) for v in arr.tolist()})


def diagnose(year: int, round_num: int, session_type: str) -> None:
    session_type = session_type.upper()
    session = load_session(year, round_num, session_type)

    fastest = session.laps.pick_fastest()
    if fastest is None:
        print(f"{session_type}: no fastest lap found")
        return

    tel = fastest.get_telemetry()
    if tel is None or tel.empty or "DRS" not in tel.columns:
        print(f"{session_type}: missing DRS telemetry channel")
        return

    drs_values = _unique_sorted_ints(tel["DRS"].to_numpy(dtype=float))
    print(f"{session_type}: unique fastest-lap DRS codes = {drs_values}")


def main() -> None:
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    round_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    print(f"DRS diagnostic for {year} round {round_num}")
    diagnose(year, round_num, "R")
    diagnose(year, round_num, "Q")


if __name__ == "__main__":
    main()

