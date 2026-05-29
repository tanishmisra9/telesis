import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SessionPicker } from "./components/SessionPicker";
import { PaceSpreadChart } from "./components/PaceSpreadChart";
import { CircuitMap } from "./components/CircuitMap";
import { InsightPanel } from "./components/InsightPanel";
import { selectionLabel } from "./api/client";
import { pageTransition } from "./design/tokens";
import { useSessionStore, type SessionStoreError } from "./store/sessionStore";
import type { PaceResponse } from "./api/types";

function errorMessage(error: SessionStoreError): string {
  if (error.kind === "api") {
    switch (error.code) {
      case "session_not_found":
        return "That session could not be found. Check the year, round, and session type.";
      case "session_not_ready":
        return "This session is not ready yet. Try again once timing data is published.";
      case "upstream_unavailable":
        return "FastF1 is temporarily unavailable. Please try again in a moment.";
      case "circuit_geometry_unavailable":
        return "Circuit geometry is not available for this session.";
      default:
        return error.message;
    }
  }
  return error.message;
}

function PanelShell({ children }: { children: ReactNode }) {
  return <section className="min-w-0">{children}</section>;
}

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-card border border-line bg-panel p-8 shadow-panel">
      <div className="text-center">
        <p className="text-card-heading font-medium text-text">{label}</p>
        <p className="mt-2 text-secondary-body text-muted">
          First load can take a few minutes.
        </p>
        <div
          className="mx-auto mt-6 h-1 w-24 overflow-hidden rounded-pill bg-glass"
          aria-hidden
        >
          <div className="h-full w-1/2 animate-pulse rounded-pill bg-accent-tint" />
        </div>
      </div>
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-card border border-line bg-panel p-8 shadow-panel">
      <div className="max-w-sm text-center">
        <p className="text-card-heading font-medium text-text">Unable to load</p>
        <p className="mt-2 text-secondary-body text-muted">{message}</p>
      </div>
    </div>
  );
}

function eventTitle(pace: PaceResponse | null, circuitName: string | null): string {
  if (pace) return pace.session.event;
  if (circuitName) return circuitName;
  return "Session";
}

function App() {
  const prefersReducedMotion = useReducedMotion();
  const pace = useSessionStore((s) => s.pace);
  const circuit = useSessionStore((s) => s.circuit);
  const selection = useSessionStore((s) => s.selection);
  const metrics = useSessionStore((s) => s.metrics);
  const insights = useSessionStore((s) => s.insights);
  const selectedInsight = useSessionStore((s) => s.selectedInsight);
  const selectInsight = useSessionStore((s) => s.selectInsight);
  const hasLoaded = useSessionStore((s) => s.hasLoaded);
  const paceLoading = useSessionStore((s) => s.paceLoading);
  const circuitLoading = useSessionStore((s) => s.circuitLoading);
  const insightsLoading = useSessionStore((s) => s.insightsLoading);
  const paceError = useSessionStore((s) => s.paceError);
  const circuitError = useSessionStore((s) => s.circuitError);
  const insightsError = useSessionStore((s) => s.insightsError);

  const fadeProps = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3 },
      }
    : pageTransition;

  const anyLoading = paceLoading || circuitLoading || insightsLoading;
  const showEmpty = !hasLoaded && !anyLoading;
  const showDashboard =
    hasLoaded &&
    (pace || circuit || insights || anyLoading || paceError || circuitError || insightsError);

  return (
    <div className="relative min-h-screen bg-canvas text-text">
      <div className="top-glass-band" aria-hidden="true" />

      <header className="fixed inset-x-0 top-0 z-20 px-page-x pt-3.5 md:px-page-x-md">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-5 py-3.5 glass-surface rounded-nav">
          <span className="text-card-heading font-medium tracking-card-heading text-text">
            Telesis
          </span>
          <SessionPicker />
        </div>
      </header>

      <main className="mx-auto max-w-content px-page-x pb-20 pt-nav-offset md:px-page-x-md">
        {showEmpty && (
          <motion.div
            className="mx-auto max-w-prose py-24 text-center"
            {...fadeProps}
          >
            <h1 className="text-[clamp(2rem,6vw,3rem)] font-medium leading-headline tracking-hero text-text">
              Select a session to begin
            </h1>
            <p className="mt-4 text-body text-muted">
              Choose a season, round, and session type, then load session data.
            </p>
          </motion.div>
        )}

        {showDashboard && (
          <motion.div className="space-y-6" {...fadeProps}>
            <header className="pt-4">
              <h1 className="text-section-title font-medium tracking-section-title text-text">
                {eventTitle(pace, circuit?.name ?? null)}
              </h1>
              <p className="mt-1 text-secondary-body text-muted">
                {selection
                  ? selectionLabel(selection)
                  : "Session"}
                {paceLoading || circuitLoading ? " · loading" : ""}
              </p>
            </header>

            <div className="flex flex-col gap-8">
              <PanelShell>
                {circuitLoading && !circuit && (
                  <PanelLoading label="Loading circuit map" />
                )}
                {circuitError && !circuit && !circuitLoading && (
                  <PanelError message={errorMessage(circuitError)} />
                )}
                {circuit && <CircuitMap circuit={circuit} />}
              </PanelShell>

              <PanelShell>
                {paceLoading && !pace && (
                  <PanelLoading label="Loading pace spread" />
                )}
                {paceError && !pace && !paceLoading && (
                  <PanelError message={errorMessage(paceError)} />
                )}
                {pace && (
                  <PaceSpreadChart
                    pace={pace}
                    selectedInsight={selectedInsight}
                    onSelectInsight={selectInsight}
                  />
                )}
              </PanelShell>

              <PanelShell>
                {insightsLoading && !insights && (
                  <PanelLoading label="Loading insights" />
                )}
                {insightsError && !insights && !insightsLoading && (
                  <PanelError message={errorMessage(insightsError)} />
                )}
                {insights && (
                  <InsightPanel
                    insights={insights}
                    metrics={metrics}
                    selected={selectedInsight}
                  />
                )}
              </PanelShell>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default App;
