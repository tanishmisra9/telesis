"""Insight refining layer."""

from __future__ import annotations

import json
import os
from typing import Protocol

import requests


class InsightRefiner(Protocol):
    def refine(self, payload: dict) -> dict: ...


class NullRefiner:
    """No-op refiner for deterministic output."""

    def refine(self, payload: dict) -> dict:
        return payload


class LLMRefiner:
    """Optional OpenAI-compatible insight refiner."""

    def refine(self, payload: dict) -> dict:
        base_url = os.getenv("LLM_BASE_URL", "").strip().rstrip("/")
        api_key = os.getenv("LLM_API_KEY", "").strip()
        model = os.getenv("LLM_MODEL", "").strip()
        if not base_url or not api_key or not model:
            return payload

        url = f"{base_url}/chat/completions"
        prompt = (
            "Refine this deterministic telemetry attribution JSON for grammar and fluency only. "
            "Rules: do not invent facts, preserve identifiers and numeric values, preserve ranking intent, "
            "never use em dashes, and do not add new claims. "
            "Return strict JSON with keys verdict, drivers, constructors. "
            "drivers/constructors must be arrays of {id, headline_nuggets}."
        )
        user_payload = {
            "verdict": payload.get("verdict", ""),
            "drivers": [
                {"id": item.get("id"), "headline_nuggets": item.get("headline_nuggets", [])}
                for item in payload.get("drivers", [])
            ],
            "constructors": [
                {"id": item.get("id"), "headline_nuggets": item.get("headline_nuggets", [])}
                for item in payload.get("constructors", [])
            ],
        }
        body = {
            "model": model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(user_payload)},
            ],
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(url, headers=headers, json=body, timeout=20)
            response.raise_for_status()
            data = response.json()
            message = data["choices"][0]["message"]["content"]
            parsed = json.loads(message)
        except Exception:
            return payload

        refined_by_id = {
            str(item.get("id")): [str(n).replace("—", ",") for n in item.get("headline_nuggets", [])]
            for item in parsed.get("drivers", [])
            if item.get("id")
        }
        refined_team_by_id = {
            str(item.get("id")): [str(n).replace("—", ",") for n in item.get("headline_nuggets", [])]
            for item in parsed.get("constructors", [])
            if item.get("id")
        }
        payload["verdict"] = str(parsed.get("verdict", payload.get("verdict", ""))).replace(
            "—", ","
        )
        for item in payload.get("drivers", []):
            item_id = str(item.get("id", ""))
            if item_id in refined_by_id and refined_by_id[item_id]:
                item["headline_nuggets"] = refined_by_id[item_id]
        for item in payload.get("constructors", []):
            item_id = str(item.get("id", ""))
            if item_id in refined_team_by_id and refined_team_by_id[item_id]:
                item["headline_nuggets"] = refined_team_by_id[item_id]
        return payload


def get_refiner() -> InsightRefiner:
    kind = os.getenv("INSIGHT_REFINER", "null").strip().lower()
    if kind == "null":
        return NullRefiner()
    if kind == "llm":
        return LLMRefiner()
    return NullRefiner()
