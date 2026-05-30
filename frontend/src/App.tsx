import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SessionPicker } from "./components/SessionPicker";
import { PaceSpreadChart } from "./components/PaceSpreadChart";
import { CircuitMap } from "./components/CircuitMap";
import { InsightPanel } from "./components/InsightPanel";
import { Leaderboard } from "./components/Leaderboard";
import { RaceTraceChart } from "./components/RaceTraceChart";
import { StintTimeline } from "./components/StintTimeline";
import { SpeedTraceCompare } from "./components/SpeedTraceCompare";
import { TyreDegradationChart } from "./components/TyreDegradationChart";
import { DriverDetailDrawer } from "./components/DriverDetailDrawer";
import { JumpNav } from "./components/JumpNav";
import { KeyboardHelp } from "./components/KeyboardHelp";
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
      case "invalid_driver":
        return "That driver is not available in this session.";
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
  const results = useSessionStore((s) => s.results);
  const raceTrace = useSessionStore((s) => s.raceTrace);
  const stints = useSessionStore((s) => s.stints);
  const tyreDeg = useSessionStore((s) => s.tyreDeg);
  const telemetryOverlay = useSessionStore((s) => s.telemetryOverlay);
  const selectedInsight = useSessionStore((s) => s.selectedInsight);
  const selectInsight = useSessionStore((s) => s.selectInsight);
  const selectedDriver = useSessionStore((s) => s.selectedDriver);
  const selectDriver = useSessionStore((s) => s.selectDriver);
  const hasLoaded = useSessionStore((s) => s.hasLoaded);
  const globalLoading = useSessionStore((s) => s.globalLoading);
  const loadingStep = useSessionStore((s) => s.loadingStep);
  const paceLoading = useSessionStore((s) => s.paceLoading);
  const circuitLoading = useSessionStore((s) => s.circuitLoading);
  const insightsLoading = useSessionStore((s) => s.insightsLoading);
  const paceError = useSessionStore((s) => s.paceError);
  const circuitError = useSessionStore((s) => s.circuitError);
  const insightsError = useSessionStore((s) => s.insightsError);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "?") {
        event.preventDefault();
        setShowHelp((v) => !v);
      }
      if (event.key.toLowerCase() === "j" && results?.drivers.length) {
        event.preventDefault();
        const idx = Math.max(
          0,
          results.drivers.findIndex((d) => d.abbr === selectedDriver),
        );
        const next = results.drivers[(idx + 1) % results.drivers.length];
        selectDriver(next.abbr);
      }
      if (event.key.toLowerCase() === "k" && results?.drivers.length) {
        event.preventDefault();
        const idx = Math.max(
          0,
          results.drivers.findIndex((d) => d.abbr === selectedDriver),
        );
        const next = results.drivers[(idx - 1 + results.drivers.length) % results.drivers.length];
        selectDriver(next.abbr);
      }
      if (event.key === "Escape") {
        setShowHelp(false);
        selectDriver(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, selectedDriver, selectDriver]);

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
            <header className="pt-4" id="hero">
              <h1 className="text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium tracking-hero text-primary">
                {eventTitle(pace, circuit?.name ?? null)}
              </h1>
              <p className="mt-1 text-body-sm text-secondary">
                {selection ? `${selection.year} · Round ${selection.round} · ${selection.sessionType}` : "Session"}
              </p>
              <p className="mt-3 max-w-prose text-body text-secondary">
                {insights?.briefing?.split("—").join(",") ?? "Telemetry-backed session briefing."}
              </p>
              {globalLoading && (
                <div className="mt-4 w-72">
                  <p className="text-caption text-secondary">{loadingStep ?? "Loading session"}</p>
                  <div className="mt-1 h-1 rounded-pill bg-surface-3">
                    <div className="h-full w-1/2 animate-pulse rounded-pill bg-accent/60" />
                  </div>
                </div>
              )}
            </header>

            <div className="flex flex-col gap-8">
              <PanelShell>
                {circuitLoading && !circuit && (
                  <PanelLoading label="Loading circuit map" />
                )}
                {circuitError && !circuit && !circuitLoading && (
                  <PanelError message={errorMessage(circuitError)} />
                )}
                {circuit && results && (
                  <section id="leaderboard-circuit" className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
                    <Leaderboard
                      results={results}
                      stints={stints}
                      selectedDriver={selectedDriver}
                      onSelectDriver={selectDriver}
                    />
                    <CircuitMap
                      circuit={circuit}
                      telemetryOverlay={telemetryOverlay}
                      results={results}
                      selectedDriver={selectedDriver}
                      onSelectDriver={selectDriver}
                    />
                  </section>
                )}
              </PanelShell>

              <PanelShell>
                {paceLoading && !pace && (
                  <PanelLoading label="Loading pace spread" />
                )}
                {paceError && !pace && !paceLoading && (
                  <PanelError message={errorMessage(paceError)} />
                )}
                {pace && (
                  <section id="pace">
                  <PaceSpreadChart
                    pace={pace}
                    selectedInsight={selectedInsight}
                    onSelectInsight={selectInsight}
                  />
                  </section>
                )}
              </PanelShell>

              {raceTrace && (
                <section id="racetrace">
                  <RaceTraceChart
                    data={raceTrace}
                    selectedDriver={selectedDriver}
                    onSelectDriver={selectDriver}
                  />
                </section>
              )}
              {stints && (
                <section id="stints">
                  <StintTimeline data={stints} />
                </section>
              )}
              {selection && results && (
                <section id="speedcompare">
                  <SpeedTraceCompare selection={selection} results={results} />
                </section>
              )}
              {tyreDeg && (
                <section id="tyredeg">
                  <TyreDegradationChart data={tyreDeg} />
                </section>
              )}

              <PanelShell>
                {insightsLoading && !insights && (
                  <PanelLoading label="Loading insights" />
                )}
                {insightsError && !insights && !insightsLoading && (
                  <PanelError message={errorMessage(insightsError)} />
                )}
                {insights && (
                  <section id="insights">
                  <InsightPanel
                    insights={insights}
                    metrics={metrics}
                    selected={selectedInsight}
                  />
                  </section>
                )}
              </PanelShell>
            </div>
          </motion.div>
        )}
      </main>
      <JumpNav
        items={[
          { id: "hero", label: "Hero" },
          { id: "leaderboard-circuit", label: "Leaderboard + Circuit" },
          { id: "pace", label: "Pace" },
          { id: "racetrace", label: "Race trace" },
          { id: "stints", label: "Stints" },
          { id: "speedcompare", label: "Speed compare" },
          { id: "tyredeg", label: "Tyre degradation" },
          { id: "insights", label: "Insights" },
        ]}
      />
      <KeyboardHelp open={showHelp} onClose={() => setShowHelp(false)} />
      {results && (
        <DriverDetailDrawer
          open={!!selectedDriver}
          driverAbbr={selectedDriver}
          results={results}
          stints={stints}
          insights={insights}
          onClose={() => selectDriver(null)}
        />
      )}
    </div>
  );
}

export default App;
