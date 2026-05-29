import type {
  CircuitResponse,
  InsightsResponse,
  MetricsResponse,
  PaceResponse,
  SessionSelection,
  TelesisApiErrorBody,
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
    err === "circuit_geometry_unavailable"
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

export function selectionLabel(sel: SessionSelection): string {
  return `${sel.year} Round ${sel.round} · ${sel.sessionType.toUpperCase()}`;
}
