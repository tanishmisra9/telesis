"""Print metrics + insights summary for sanity checks."""

from __future__ import annotations

import sys

from app.cache import enable_cache, init_db, make_key
from app.engine.pipeline import ensure_insights, ensure_metrics


def main() -> None:
    init_db()
    enable_cache()
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    round_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    session_type = sys.argv[3] if len(sys.argv) > 3 else "R"

    key = make_key(year, round_num, session_type)
    metrics = ensure_metrics(key, year, round_num, session_type)
    insights = ensure_insights(key, year, round_num, session_type)

    print(f"Session: {year} R{round_num} {session_type.upper()}")
    print(f"Metrics applicable: {metrics.get('applicable')}")
    print(f"Metrics drivers: {len(metrics.get('drivers', []))}")
    print(f"Insights mode: {insights.get('mode')}")
    print(f"Driver insights: {len(insights.get('drivers', []))}")
    print(f"Constructor insights: {len(insights.get('constructors', []))}")
    if insights.get("drivers"):
        print("Top driver phrase:")
        print(f"  {insights['drivers'][0]['phrases'][0]}")
    if insights.get("constructors"):
        print("Top constructor phrase:")
        print(f"  {insights['constructors'][0]['phrases'][0]}")


if __name__ == "__main__":
    main()
