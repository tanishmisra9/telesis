# Phase 0 Contract Map (Approval Gate)

This artifact freezes current contracts and defines the final schema contracts to be published in Phase 1a before implementation starts.

## Baseline Snapshot

### Backend contracts currently present
- `backend/app/models.py`
  - Existing response models: `PaceResponse`, `CircuitResponse`, `MetricsResponse`, `InsightsResponse`, `ResultsResponse` (partial), `ScheduleEntry` (partial).
  - Missing/new scope models for master prompt: full schedule wrapper, racetrace, stints, speedtrace, tyre degradation.
  - `InsightsResponse` currently has no `briefing`.
- `backend/app/cache.py`
  - Cached JSON columns: `pace_json`, `circuit_json`, `metrics_json`, `insights_json`, `results_json`.
  - Missing cache columns: `racetrace_json`, `stints_json`, `tyredeg_json`, `telemetry_overlay_json`.
- `backend/app/engine/pipeline.py`
  - Pipeline computes/caches only pace/circuit/metrics/insights.
  - No `ensure_results`/`ensure_racetrace`/`ensure_stints`/`ensure_tyredeg`.
- Existing backend routes in `backend/app/routers`: pace/circuit/metrics/insights only.

### Frontend contracts currently present
- `frontend/src/api/types.ts`
  - Typed for current endpoints only: pace/circuit/metrics/insights.
  - No schedule/results/racetrace/stints/speedtrace/tyredeg contracts.
  - `InsightsResponse` currently has no `briefing`.
- `frontend/src/store/sessionStore.ts`
  - Store state and loading flow are built around current four endpoint payloads.

## Final Contract Definitions (Phase 1a Publish Target)

## 1) Schedule
- Endpoint: `GET /schedule/{year}`
- Backend model:
  - `ScheduleEntry`: `round`, `event_name`, `country`, `location`, `event_date`, `has_sprint`, `session_types`.
  - `ScheduleResponse`: `year`, `rounds: ScheduleEntry[]`.
- Frontend type parity:
  - `ScheduleEntry`, `ScheduleResponse`.
- Client function signature:
  - `getSchedule(year: number): Promise<ScheduleResponse>`.

## 2) Results
- Endpoint: `GET /sessions/{year}/{round}/{session_type}/results`
- Backend model:
  - `DriverResultEntry`: `abbr`, `full_name`, `driver_number`, `team`, `team_color`, `headshot_url`, `country_code`, `grid_position`, `finish_position`, `status`, `fastest_lap_s`, `fastest_lap_rank`.
  - `ResultsResponse`: `session`, `drivers: DriverResultEntry[]`.
- Frontend type parity:
  - `DriverResultEntry`, `ResultsResponse`.
- Client function signature:
  - `getResults(year: number, round: number, sessionType: string): Promise<ResultsResponse>`.

## 3) Race Trace
- Endpoint: `GET /sessions/{year}/{round}/{session_type}/racetrace`
- Backend model:
  - `DriverTraceEntry`: `abbr`, `team`, `positions: (number | null)[]`.
  - `RaceTraceResponse`: `session`, `total_laps`, `drivers`, `applicable`.
- Frontend type parity:
  - `DriverTraceEntry`, `RaceTraceResponse`.
- Client function signature:
  - `getRaceTrace(year: number, round: number, sessionType: string): Promise<RaceTraceResponse>`.

## 4) Stints
- Endpoint: `GET /sessions/{year}/{round}/{session_type}/stints`
- Backend model:
  - `StintEntry`: `stint_number`, `compound`, `lap_start`, `lap_end`, `tyre_age_start`, `lap_count`.
  - `DriverStintsEntry`: `abbr`, `team`, `stints: StintEntry[]`.
  - `StintsResponse`: `session`, `total_laps`, `drivers`, `applicable`.
- Frontend type parity:
  - `StintEntry`, `DriverStintsEntry`, `StintsResponse`.
- Client function signature:
  - `getStints(year: number, round: number, sessionType: string): Promise<StintsResponse>`.

## 5) Speed Trace Compare
- Endpoint: `GET /sessions/{year}/{round}/{session_type}/speedtrace/{abbr_a}/{abbr_b}`
- Backend model:
  - `SpeedTraceLap`: `abbr`, `team`, `lap_time_s`, `distance_m[]`, `speed_kmh[]`, `throttle_pct[]`, `brake[]`, `gear[]`.
  - `SpeedTraceResponse`: `session`, `sector_splits_m`, `corners`, `a`, `b`, `delta_a_minus_b_s[]`.
- Frontend type parity:
  - `SpeedTraceLap`, `SpeedTraceResponse`.
- Client function signature:
  - `getSpeedTrace(year: number, round: number, sessionType: string, abbrA: string, abbrB: string): Promise<SpeedTraceResponse>`.

## 6) Tyre Degradation
- Endpoint: `GET /sessions/{year}/{round}/{session_type}/tyredeg`
- Backend model:
  - `StintDegPoint`: `tyre_age`, `lap_time_s`.
  - `DriverStintDegEntry`: `stint_number`, `compound`, `points`, `slope_s_per_lap`, `intercept_s`.
  - `DriverTyreDegEntry`: `abbr`, `team`, `stints`.
  - `TyreDegResponse`: `session`, `drivers`, `applicable`.
- Frontend type parity:
  - `StintDegPoint`, `DriverStintDegEntry`, `DriverTyreDegEntry`, `TyreDegResponse`.
- Client function signature:
  - `getTyreDeg(year: number, round: number, sessionType: string): Promise<TyreDegResponse>`.

## 7) Circuit and Metrics Contract Extensions
- `CircuitResponse` stays source-of-truth for:
  - `centerline_dist_m`, `sector_splits`, `drs_zones`, geometry fields.
- `MetricsResponse` extension (quali/sprint-quali only):
  - Add optional per-driver `speed_along_centerline` aligned with `centerline_dist_m`.
  - Keep `applicable: false` behavior for non-quali sessions.
- Race/sprint overlay data location is frozen to a separate cache-backed contract:
  - Cache column: `telemetry_overlay_json`.
  - Endpoint: `GET /sessions/{year}/{round}/{session_type}/telemetry-overlay`.
  - Response schema:
    - `TelemetryOverlayDriverEntry`: `abbr`, `team`, `speed_along_centerline: number[]`.
    - `TelemetryOverlayResponse`: `session`, `applicable`, `reason`, `drivers`.
- Frontend parity:
  - Extend `DriverMetricEntry` for quali path.
  - Add `TelemetryOverlayDriverEntry` and `TelemetryOverlayResponse` for race/sprint path.

## 8) Insights Briefing Field
- `InsightsResponse` extension:
  - Add `briefing: string` (always populated; deterministic fallback required).
- Frontend parity:
  - Add `briefing: string` to `InsightsResponse`.

## 9) Error Contract Additions
- Frozen frontend `TelesisApiErrorCode` union:
  - `session_not_found`
  - `session_not_ready`
  - `upstream_unavailable`
  - `circuit_geometry_unavailable`
  - `invalid_driver`
- Keep existing error shape:
  - `{ error: string, message: string }`.
- Session-type non-applicability remains a non-error contract: HTTP 200 with `applicable: false` payloads.

## 10) Cache Schema and Version Constants (Frozen Names)
- `processed_session` JSON columns to be present after implementation:
  - `pace_json`
  - `circuit_json`
  - `metrics_json`
  - `insights_json`
  - `results_json`
  - `racetrace_json`
  - `stints_json`
  - `tyredeg_json`
  - `telemetry_overlay_json`
- Version constants:
  - `CIRCUIT_LOGIC_VERSION` bump target: `3` (current is `2`).
  - Add `PIPELINE_LOGIC_VERSION = 1` to coordinate stale-payload invalidation across expanded outputs.

## 11) DRS Fix Sequencing (Diagnostic First, Then Fix)
- Before implementing DRS logic changes:
  - Print and inspect raw unique DRS values for:
    - 2024 Round 1 Race fastest lap.
    - A representative mid-race green-flag lap candidate.
  - Record findings in comments/notes near DRS detection code.
- Then implement representative-lap detection update and version bump.
- If diagnostics show active codes beyond expected values, include those codes explicitly and document rationale.

## Contract Parity Rules (Must Hold in Phase 1a)
- Every new backend model has a matching frontend interface with identical field names.
- `null` and optional semantics match exactly between Python and TypeScript.
- Endpoint response wrappers (`...Response`) are shared contract anchors and do not diverge per consumer.
- Client method names and signatures for all new endpoints are frozen in Phase 1a and consumed in later phases.
- Race speed overlay contract is independent from metrics non-applicable behavior.

## Impacted Files (Frozen for Phase 1a Publication)
- Backend schema file:
  - `backend/app/models.py`
- Frontend schema/client files:
  - `frontend/src/api/types.ts`
  - `frontend/src/api/client.ts`

## Impacted Files (Known for Later Phases, Not Edited in Phase 0)
- Backend implementation:
  - `backend/app/cache.py`
  - `backend/app/engine/pipeline.py`
  - `backend/app/engine/circuit.py`
  - `backend/app/engine/llm.py`
  - `backend/app/routers/*` (new or expanded endpoint routers)
  - `backend/app/engine/*` (new analytics modules)
- Frontend implementation:
  - `frontend/src/store/sessionStore.ts`
  - `frontend/src/App.tsx`
  - `frontend/src/components/*` (new visualization/layout modules)
  - `frontend/src/design/tokens.ts`
  - `frontend/tailwind.config.ts`
  - `frontend/src/index.css`

## Phase 0 Checkpoint Output
- Contract diff summary: captured in this document.
- Impacted file list: captured above.
- Approval gate: no Phase 1 work should begin until this contract map is approved.
