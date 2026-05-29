"""Insight refining layer."""

from __future__ import annotations

import os
from typing import Protocol


class InsightRefiner(Protocol):
    def refine(self, payload: dict) -> dict: ...


class NullRefiner:
    """No-op refiner for deterministic output."""

    def refine(self, payload: dict) -> dict:
        return payload


class LLMRefiner:
    """Placeholder for future model-based phrase refining."""

    def refine(self, payload: dict) -> dict:
        raise NotImplementedError(
            "LLMRefiner is a placeholder and is not wired. Use INSIGHT_REFINER=null."
        )


def get_refiner() -> InsightRefiner:
    kind = os.getenv("INSIGHT_REFINER", "null").strip().lower()
    if kind == "null":
        return NullRefiner()
    if kind == "llm":
        return LLMRefiner()
    return NullRefiner()
