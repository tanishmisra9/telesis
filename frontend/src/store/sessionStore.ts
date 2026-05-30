import { create } from "zustand";
import {
  getCircuit,
  getInsights,
  getMetrics,
  getPace,
  getRaceTrace,
  getResults,
  getStints,
  getTelemetryOverlay,
  getTyreDeg,
  TelesisApiError,
} from "../api/client";
import type {
  CircuitResponse,
  InsightsResponse,
  InsightSelection,
  MetricsResponse,
  PaceResponse,
  RaceTraceResponse,
  ResultsResponse,
  SessionSelection,
  StintsResponse,
  TelemetryOverlayResponse,
  TyreDegResponse,
} from "../api/types";

export type SessionStoreError =
  | { kind: "api"; code: TelesisApiError["code"]; message: string }
  | { kind: "unknown"; message: string };

function toStoreError(err: unknown): SessionStoreError {
  if (err instanceof TelesisApiError) {
    return { kind: "api", code: err.code, message: err.message };
  }
  return {
    kind: "unknown",
    message: err instanceof Error ? err.message : "Something went wrong.",
  };
}

interface SessionState {
  selection: SessionSelection | null;
  pace: PaceResponse | null;
  circuit: CircuitResponse | null;
  metrics: MetricsResponse | null;
  insights: InsightsResponse | null;
  results: ResultsResponse | null;
  raceTrace: RaceTraceResponse | null;
  stints: StintsResponse | null;
  tyreDeg: TyreDegResponse | null;
  telemetryOverlay: TelemetryOverlayResponse | null;
  selectedInsight: InsightSelection | null;
  selectedDriver: string | null;
  loadingStep: string | null;
  globalLoading: boolean;
  paceLoading: boolean;
  circuitLoading: boolean;
  insightsLoading: boolean;
  paceError: SessionStoreError | null;
  circuitError: SessionStoreError | null;
  insightsError: SessionStoreError | null;
  globalError: SessionStoreError | null;
  hasLoaded: boolean;
  loadSession: (selection: SessionSelection) => Promise<void>;
  selectInsight: (selection: InsightSelection | null) => void;
  selectDriver: (abbr: string | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  selection: null,
  pace: null,
  circuit: null,
  metrics: null,
  insights: null,
  results: null,
  raceTrace: null,
  stints: null,
  tyreDeg: null,
  telemetryOverlay: null,
  selectedInsight: null,
  selectedDriver: null,
  loadingStep: null,
  globalLoading: false,
  paceLoading: false,
  circuitLoading: false,
  insightsLoading: false,
  paceError: null,
  circuitError: null,
  insightsError: null,
  globalError: null,
  hasLoaded: false,

  loadSession: async (selection) => {
    set({
      selection,
      paceLoading: true,
      circuitLoading: false,
      insightsLoading: false,
      paceError: null,
      circuitError: null,
      insightsError: null,
      pace: null,
      circuit: null,
      metrics: null,
      insights: null,
      selectedInsight: null,
      selectedDriver: null,
      results: null,
      raceTrace: null,
      stints: null,
      tyreDeg: null,
      telemetryOverlay: null,
      globalLoading: true,
      loadingStep: "Loading session",
      globalError: null,
      hasLoaded: true,
    });

    try {
      set({ loadingStep: "Computing pace and circuit" });
      const pace = await getPace(
        selection.year,
        selection.round,
        selection.sessionType,
      );
      set({ pace, paceLoading: false, paceError: null });
    } catch (err) {
      set({
        paceLoading: false,
        paceError: toStoreError(err),
        globalError: toStoreError(err),
        globalLoading: false,
      });
      return;
    }

    set({ circuitLoading: true });
    try {
      const circuit = await getCircuit(
        selection.year,
        selection.round,
        selection.sessionType,
      );
      set({ circuit, circuitLoading: false, circuitError: null });
    } catch (err) {
      set({
        circuitLoading: false,
        circuitError: toStoreError(err),
        globalError: toStoreError(err),
        globalLoading: false,
      });
      return;
    }

    set({ insightsLoading: true });
    try {
      set({ loadingStep: "Building insights and telemetry" });
      const [insights, metrics, results, raceTrace, stints, tyreDeg, telemetryOverlay] = await Promise.all([
        getInsights(selection.year, selection.round, selection.sessionType),
        ["Q", "SQ"].includes(selection.sessionType.toUpperCase())
          ? getMetrics(selection.year, selection.round, selection.sessionType)
          : Promise.resolve(null),
        getResults(selection.year, selection.round, selection.sessionType),
        getRaceTrace(selection.year, selection.round, selection.sessionType),
        getStints(selection.year, selection.round, selection.sessionType),
        getTyreDeg(selection.year, selection.round, selection.sessionType),
        getTelemetryOverlay(selection.year, selection.round, selection.sessionType),
      ]);
      set({
        insights,
        metrics,
        results,
        raceTrace,
        stints,
        tyreDeg,
        telemetryOverlay,
        insightsLoading: false,
        insightsError: null,
        globalLoading: false,
        loadingStep: null,
        selectedDriver: results.drivers[0]?.abbr ?? null,
      });
    } catch (err) {
      set({
        insightsLoading: false,
        insightsError: toStoreError(err),
        globalError: toStoreError(err),
        globalLoading: false,
        loadingStep: null,
      });
    }
  },

  selectInsight: (selection) => set({ selectedInsight: selection }),
  selectDriver: (abbr) => set({ selectedDriver: abbr }),

  clear: () =>
    set({
      selection: null,
      pace: null,
      circuit: null,
      metrics: null,
      insights: null,
      results: null,
      raceTrace: null,
      stints: null,
      tyreDeg: null,
      telemetryOverlay: null,
      selectedInsight: null,
      selectedDriver: null,
      globalLoading: false,
      loadingStep: null,
      paceLoading: false,
      circuitLoading: false,
      insightsLoading: false,
      paceError: null,
      circuitError: null,
      insightsError: null,
      globalError: null,
      hasLoaded: false,
    }),
}));
