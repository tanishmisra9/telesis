import { create } from "zustand";
import {
  getCircuit,
  getInsights,
  getMetrics,
  getPace,
  TelesisApiError,
} from "../api/client";
import type {
  CircuitResponse,
  InsightsResponse,
  InsightSelection,
  MetricsResponse,
  PaceResponse,
  SessionSelection,
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
  selectedInsight: InsightSelection | null;
  paceLoading: boolean;
  circuitLoading: boolean;
  insightsLoading: boolean;
  paceError: SessionStoreError | null;
  circuitError: SessionStoreError | null;
  insightsError: SessionStoreError | null;
  hasLoaded: boolean;
  loadSession: (selection: SessionSelection) => Promise<void>;
  selectInsight: (selection: InsightSelection | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  selection: null,
  pace: null,
  circuit: null,
  metrics: null,
  insights: null,
  selectedInsight: null,
  paceLoading: false,
  circuitLoading: false,
  insightsLoading: false,
  paceError: null,
  circuitError: null,
  insightsError: null,
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
      hasLoaded: true,
    });

    try {
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
      });
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
      });
    }

    set({ insightsLoading: true });
    try {
      const [insights, metrics] = await Promise.all([
        getInsights(selection.year, selection.round, selection.sessionType),
        ["Q", "SQ"].includes(selection.sessionType.toUpperCase())
          ? getMetrics(selection.year, selection.round, selection.sessionType)
          : Promise.resolve(null),
      ]);
      set({
        insights,
        metrics,
        insightsLoading: false,
        insightsError: null,
      });
    } catch (err) {
      set({
        insightsLoading: false,
        insightsError: toStoreError(err),
      });
    }
  },

  selectInsight: (selection) => set({ selectedInsight: selection }),

  clear: () =>
    set({
      selection: null,
      pace: null,
      circuit: null,
      metrics: null,
      insights: null,
      selectedInsight: null,
      paceLoading: false,
      circuitLoading: false,
      insightsLoading: false,
      paceError: null,
      circuitError: null,
      insightsError: null,
      hasLoaded: false,
    }),
}));
