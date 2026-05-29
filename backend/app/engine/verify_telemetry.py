"""Local verification script for M1 telemetry extraction."""

from __future__ import annotations

from app.config import get_settings
from app.engine.loader import enable_cache, load_session
from app.engine.telemetry import extract_all_drivers_telemetry

_CHANNEL_KEYS = (
    "t",
    "x",
    "y",
    "dist",
    "rel_dist",
    "speed",
    "gear",
    "drs",
    "throttle",
    "brake",
    "lap",
    "compound",
)


def main() -> None:
    settings = get_settings()
    enable_cache(str(settings.ff1_cache_dir))

    session = load_session(2024, 1, "R")
    drivers, skipped = extract_all_drivers_telemetry(session)

    print(f"Loaded session: 2024 round 1 R ({session.event['EventName']})")
    print(f"Drivers extracted: {len(drivers)}")
    print()

    for driver in drivers:
        counts = {
            key: len(driver["telemetry"][key])
            for key in _CHANNEL_KEYS
            if key in driver["telemetry"]
        }
        print(f"{driver['abbr']:>3}  {driver['team']:<24}  samples={counts}")

    if skipped:
        print()
        print(f"Skipped drivers ({len(skipped)}): {', '.join(skipped)}")
    else:
        print()
        print("Skipped drivers: none")


if __name__ == "__main__":
    main()
