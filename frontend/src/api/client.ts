import type {
  CircuitResponse,
  InsightsResponse,
  MetricsResponse,
  PaceResponse,
  RaceTraceResponse,
  ResultsResponse,
  ScheduleResponse,
  SeasonOverviewResponse,
  SessionSelection,
  SpeedTraceResponse,
  StintsResponse,
  TelesisApiErrorBody,
  TelemetryOverlayResponse,
  TyreDegResponse,
} from "./types";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class TelesisApiError extends Error {
  readonly code: TelesisApiErrorBody["error"];

  constructor(body: TelesisApiErrorBody) {
    super(body.message);
    this.name = "TelesisApiError";
    this.code = body.error;
  }
}

function isApiErrorBody(value: unknown): value is TelesisApiErrorBody {
  if (!value || typeof value !== "object") return false;
  const err = (value as TelesisApiErrorBody).error;
  return (
    err === "session_not_found" ||
    err === "session_not_ready" ||
    err === "upstream_unavailable" ||
    err === "circuit_geometry_unavailable" ||
    err === "invalid_driver"
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    if (isApiErrorBody(body)) {
      throw new TelesisApiError(body);
    }
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : res.statusText;
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return body as T;
}

export function getPace(
  year: number,
  round: number,
  sessionType: string,
): Promise<PaceResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/pace`;

  return fetchJson<PaceResponse>(url);
}

export function getCircuit(
  year: number,
  round: number,
  sessionType: string,
): Promise<CircuitResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/circuit`;
  return fetchJson<CircuitResponse>(url);
}

export function getMetrics(
  year: number,
  round: number,
  sessionType: string,
): Promise<MetricsResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/metrics`;
  return fetchJson<MetricsResponse>(url);
}

export function getInsights(
  year: number,
  round: number,
  sessionType: string,
): Promise<InsightsResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/insights`;
  return fetchJson<InsightsResponse>(url);
}

export function getSchedule(year: number): Promise<ScheduleResponse> {
  const url = `${API_BASE}/schedule/${year}`;
  return fetchJson<ScheduleResponse>(url);
}

export function getSeasonOverview(year: number): Promise<SeasonOverviewResponse> {
  const url = `${API_BASE}/season/${year}/overview`;
  return fetchJson<SeasonOverviewResponse>(url);
}

export function getResults(
  year: number,
  round: number,
  sessionType: string,
): Promise<ResultsResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/results`;
  return fetchJson<ResultsResponse>(url);
}

export function getRaceTrace(
  year: number,
  round: number,
  sessionType: string,
): Promise<RaceTraceResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/racetrace`;
  return fetchJson<RaceTraceResponse>(url);
}

export function getStints(
  year: number,
  round: number,
  sessionType: string,
): Promise<StintsResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/stints`;
  return fetchJson<StintsResponse>(url);
}

export function getSpeedTrace(
  year: number,
  round: number,
  sessionType: string,
  abbrA: string,
  abbrB: string,
): Promise<SpeedTraceResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/speedtrace/${abbrA}/${abbrB}`;
  return fetchJson<SpeedTraceResponse>(url);
}

export function getTyreDeg(
  year: number,
  round: number,
  sessionType: string,
): Promise<TyreDegResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/tyredeg`;
  return fetchJson<TyreDegResponse>(url);
}

export function getTelemetryOverlay(
  year: number,
  round: number,
  sessionType: string,
): Promise<TelemetryOverlayResponse> {
  const type = sessionType.toUpperCase();
  const url = `${API_BASE}/sessions/${year}/${round}/${type}/telemetry-overlay`;
  return fetchJson<TelemetryOverlayResponse>(url);
}

export function selectionLabel(sel: SessionSelection): string {
  return `${sel.year} Round ${sel.round} · ${sel.sessionType.toUpperCase()}`;
}
