"""FastF1 session loading."""

from __future__ import annotations

import os
import time
from typing import Final

import fastf1
import requests
from fastf1.exceptions import (
    InvalidSessionError,
    NoLapDataError,
    RateLimitExceededError,
)

from app.engine.exceptions import SessionNotFound, SessionNotReady, UpstreamUnavailable

SUPPORTED_SESSION_TYPES: Final[frozenset[str]] = frozenset(
    {"FP1", "FP2", "FP3", "Q", "SQ", "S", "R"}
)
SPRINT_SESSION_TYPES: Final[frozenset[str]] = frozenset({"SQ", "S"})
_NETWORK_ERRORS: Final[tuple[type[BaseException], ...]] = (
    requests.exceptions.RequestException,
    RateLimitExceededError,
    ConnectionError,
    TimeoutError,
)


def enable_cache(path: str) -> None:
    os.makedirs(path, exist_ok=True)
    fastf1.Cache.enable_cache(path)


def _get_event(year: int, round_number: int):
    schedule = fastf1.get_event_schedule(year)
    matches = schedule.loc[schedule["RoundNumber"] == round_number]
    if matches.empty:
        raise SessionNotFound(f"No event found for {year} round {round_number}")
    return matches.iloc[0]


def _validate_session_on_schedule(event, session_type: str) -> None:
    try:
        event.get_session_name(session_type)
    except ValueError as exc:
        raise SessionNotFound(str(exc)) from exc


def _is_network_error(exc: BaseException) -> bool:
    return isinstance(exc, _NETWORK_ERRORS)


def _map_load_error(exc: BaseException) -> BaseException:
    if isinstance(exc, InvalidSessionError):
        return SessionNotFound(str(exc))
    if isinstance(exc, NoLapDataError):
        return SessionNotReady(str(exc))
    if isinstance(exc, ValueError):
        return SessionNotFound(str(exc))
    return exc


def load_session(year: int, round_number: int, session_type: str):
    session_type = session_type.upper()
    if session_type not in SUPPORTED_SESSION_TYPES:
        raise SessionNotFound(f"Unsupported session type '{session_type}'")

    event = _get_event(year, round_number)
    if session_type in SPRINT_SESSION_TYPES:
        _validate_session_on_schedule(event, session_type)

    session = fastf1.get_session(year, round_number, session_type)

    last_error: BaseException | None = None
    for attempt in range(2):
        try:
            session.load(telemetry=True, weather=True, laps=True)
            return session
        except _NETWORK_ERRORS as exc:
            last_error = exc
            if attempt == 0:
                time.sleep(1.0)
                continue
            raise UpstreamUnavailable(
                f"FastF1 upstream unavailable after retry: {exc}"
            ) from exc
        except (InvalidSessionError, NoLapDataError, ValueError) as exc:
            raise _map_load_error(exc) from exc
        except Exception as exc:
            if _is_network_error(exc):
                last_error = exc
                if attempt == 0:
                    time.sleep(1.0)
                    continue
                raise UpstreamUnavailable(
                    f"FastF1 upstream unavailable after retry: {exc}"
                ) from exc
            raise

    if last_error is not None:
        raise UpstreamUnavailable(
            f"FastF1 upstream unavailable after retry: {last_error}"
        ) from last_error
    raise UpstreamUnavailable("FastF1 upstream unavailable after retry")
