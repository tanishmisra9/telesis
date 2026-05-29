from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, Field

APP_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = APP_DIR.parent
DEFAULT_FF1_CACHE_DIR = APP_DIR / "data" / "ff1_cache"
DEFAULT_DB_PATH = APP_DIR / "data" / "telesis.db"


class Settings(BaseModel):
    frontend_origin: str = Field(default="http://localhost:5173")
    ff1_cache_dir: Path = Field(default=DEFAULT_FF1_CACHE_DIR)
    db_path: Path = Field(default=DEFAULT_DB_PATH)
    insight_refiner: str | None = Field(default=None)


def _parse_insight_refiner(value: str | None) -> str | None:
    if value is None or value.strip() == "" or value.strip().lower() == "null":
        return None
    return value.strip()


@lru_cache
def get_settings() -> Settings:
    load_dotenv(BACKEND_ROOT / ".env")
    return Settings(
        frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
        ff1_cache_dir=Path(os.getenv("FF1_CACHE_DIR", str(DEFAULT_FF1_CACHE_DIR))),
        db_path=Path(os.getenv("DB_PATH", str(DEFAULT_DB_PATH))),
        insight_refiner=_parse_insight_refiner(os.getenv("INSIGHT_REFINER")),
    )
