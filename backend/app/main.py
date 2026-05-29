from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.cache import enable_cache, init_db
from app.config import get_settings
from app.engine.exceptions import (
    CircuitGeometryUnavailable,
    SessionNotFound,
    SessionNotReady,
    UpstreamUnavailable,
)
from app.routers import circuit, insights, metrics, pace, sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    enable_cache()
    yield


app = FastAPI(title="Telesis", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router)
app.include_router(circuit.router)
app.include_router(insights.router)
app.include_router(metrics.router)
app.include_router(pace.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _error_body(error: str, message: str, **extra: object) -> dict:
    body: dict = {"error": error, "message": message}
    body.update(extra)
    return body


@app.exception_handler(SessionNotFound)
async def session_not_found_handler(_request: Request, exc: SessionNotFound) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content=_error_body("session_not_found", str(exc) or "Session not found"),
    )


@app.exception_handler(SessionNotReady)
async def session_not_ready_handler(_request: Request, exc: SessionNotReady) -> JSONResponse:
    return JSONResponse(
        status_code=425,
        content=_error_body("session_not_ready", str(exc) or "Session not ready"),
    )


@app.exception_handler(UpstreamUnavailable)
async def upstream_unavailable_handler(
    _request: Request, exc: UpstreamUnavailable
) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content=_error_body(
            "upstream_unavailable",
            str(exc) or "Upstream data source unavailable",
        ),
    )


@app.exception_handler(CircuitGeometryUnavailable)
async def circuit_geometry_unavailable_handler(
    _request: Request, exc: CircuitGeometryUnavailable
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_error_body(
            "circuit_geometry_unavailable",
            str(exc) or "Circuit geometry could not be built for this session",
        ),
    )
